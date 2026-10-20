"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirGestor } from "@/lib/auth";
import { caixaAberto } from "@/lib/caixa";
import { db } from "@/lib/db";
import { filialDoPainel } from "@/lib/filial";
import { FORMAS_PAGAMENTO, lerDinheiro } from "@/lib/formato";
import { ErroAsaas } from "@/lib/asaas";
import { ErroClube, assinarClubeOnline, cancelarAssinaturaDoClube } from "@/lib/clubeOnline";
import { somenteDigitos } from "@/lib/formato";
import { LimiteDoPlano, exigirRecurso, garantirVagaDeAssinante } from "@/lib/planosSistema";
import { diaLocal, somarMeses } from "@/lib/tempo";
import type { Resultado } from "../actions";

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();

export async function salvarPlano(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "clube");
  const id = texto(form, "id");
  const nome = texto(form, "nome");
  const preco = lerDinheiro(texto(form, "preco"));
  const usos = texto(form, "usos") ? Number(texto(form, "usos")) : null;
  const servicoIds = form.getAll("servicos").map(String);
  if (!nome) return { erro: "Informe o nome do plano." };
  if (!preco) return { erro: "Informe a mensalidade. Exemplo: 99,90" };
  if (usos !== null && (!Number.isInteger(usos) || usos < 1)) return { erro: "Usos por mês inválido." };
  const servicos = await db.servico.findMany({ where: { salaoId, id: { in: servicoIds } }, select: { id: true } });
  if (servicos.length === 0) return { erro: "Marque pelo menos um serviço incluso no plano." };

  const dados = { nome, descricao: texto(form, "descricao") || null, precoCentavos: preco, usosPorMes: usos, exibirOnline: form.get("exibirOnline") === "on" };
  if (id) {
    if (!(await db.plano.findFirst({ where: { id, salaoId } }))) return { erro: "Plano não encontrado." };
    await db.plano.update({ where: { id }, data: { ...dados, servicos: { set: servicos } } });
  } else {
    await db.plano.create({ data: { ...dados, salaoId, servicos: { connect: servicos } } });
  }
  revalidatePath("/painel", "layout");
  redirect("/painel/assinaturas");
}

export async function alternarPlano(form: FormData) {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "clube");
  const p = await db.plano.findFirst({ where: { id: texto(form, "id"), salaoId } });
  if (p) await db.plano.update({ where: { id: p.id }, data: { ativo: !p.ativo } });
  revalidatePath("/painel", "layout");
}

/** Registra a mensalidade; entra no caixa aberto da unidade escolhida no painel (se houver). */
async function registrar(assinaturaId: string, valor: number, forma: string, salaoId: string) {
  const { atual } = await filialDoPainel(await exigirGestor());
  const caixa = atual ? await caixaAberto(salaoId, atual.id) : null;
  await db.pagamentoAssinatura.create({ data: { assinaturaId, valorCentavos: valor, formaPagamento: forma, caixaId: caixa?.id ?? null } });
}

export async function novaAssinatura(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "clube");
  const [cliente, plano] = await Promise.all([
    db.cliente.findFirst({ where: { id: texto(form, "clienteId"), salaoId } }),
    db.plano.findFirst({ where: { id: texto(form, "planoId"), salaoId, ativo: true } }),
  ]);
  const forma = texto(form, "formaPagamento");
  if (!cliente) return { erro: "Escolha o cliente." };
  if (!plano) return { erro: "Escolha o plano." };
  if (forma === "ONLINE") {
    try {
      await assinarClubeOnline({ salaoId, clienteId: cliente.id, planoId: plano.id, cpf: somenteDigitos(texto(form, "cpf")) });
    } catch (e) {
      if (e instanceof ErroClube || e instanceof ErroAsaas || e instanceof LimiteDoPlano) return { erro: e.message };
      throw e;
    }
    revalidatePath("/painel", "layout");
    return { ok: `Cobrança criada. Envie o link de pagamento para ${cliente.nome} pelo botão do WhatsApp na lista.` };
  }
  if (!(forma in FORMAS_PAGAMENTO)) return { erro: "Escolha a forma de pagamento." };
  if (await db.assinatura.findFirst({ where: { clienteId: cliente.id, status: "ATIVA" } }))
    return { erro: `${cliente.nome} já tem uma assinatura ativa.` };
  try {
    await garantirVagaDeAssinante(salaoId);
  } catch (e) {
    if (e instanceof LimiteDoPlano) return { erro: e.message };
    throw e;
  }

  const hoje = diaLocal();
  const assinatura = await db.assinatura.create({
    data: { salaoId, clienteId: cliente.id, planoId: plano.id, pagoAte: somarMeses(hoje, 1) },
  });
  await registrar(assinatura.id, plano.precoCentavos, forma, salaoId);
  revalidatePath("/painel", "layout");
  return { ok: `${cliente.nome} agora é assinante do ${plano.nome}. Primeira mensalidade registrada.` };
}

export async function pagarMensalidade(form: FormData) {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "clube");
  const a = await db.assinatura.findFirst({ where: { id: texto(form, "id"), salaoId, status: "ATIVA" }, include: { plano: true } });
  const forma = texto(form, "formaPagamento");
  if (!a || !(forma in FORMAS_PAGAMENTO)) return;
  const base = a.pagoAte > diaLocal() ? a.pagoAte : diaLocal();
  await db.assinatura.update({ where: { id: a.id }, data: { pagoAte: somarMeses(base, 1) } });
  await registrar(a.id, a.plano.precoCentavos, forma, salaoId);
  revalidatePath("/painel", "layout");
}

export async function cancelarAssinatura(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "clube");
  try {
    await cancelarAssinaturaDoClube(salaoId, texto(form, "id"));
  } catch (e) {
    if (e instanceof ErroClube) return { erro: e.message };
    throw e;
  }
  revalidatePath("/painel", "layout");
  return { ok: "Assinatura cancelada." };
}
