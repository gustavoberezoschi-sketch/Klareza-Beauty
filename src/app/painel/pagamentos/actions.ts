"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { ErroAsaas, aprovarSubcontaSandbox, asaasConfigurado, configurarWebhook, criarSubconta, statusDaSubconta } from "@/lib/asaas";
import { exigirGestor } from "@/lib/auth";
import { exigirPagamentosOnline } from "@/lib/planosSistema";
import { cifrar, tokenWebhookAsaas } from "@/lib/cripto";
import { db } from "@/lib/db";
import { lerDinheiro, somenteDigitos } from "@/lib/formato";
import { ErroSaque, normalizarChavePix, sacar } from "@/lib/saques";
import { enderecoDoSite } from "@/lib/site";
import { diaValido } from "@/lib/tempo";
import type { Resultado } from "../actions";

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();
const TIPOS_EMPRESA = ["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"] as const;

export async function criarContaRecebimento(_: Resultado, form: FormData): Promise<Resultado> {
  // a conta de recebimento fica no nome/e-mail do titular: só o dono cria
  const { salaoId, papel } = await exigirGestor();
  await exigirPagamentosOnline(salaoId);
  if (papel !== "DONO") return { erro: "Só o dono do salão pode abrir a conta de recebimento." };
  if (!asaasConfigurado()) return { erro: "Os pagamentos online ainda não estão liberados. Fale com o Klareza Beauty." };
  const salao = await db.salao.findUniqueOrThrow({ where: { id: salaoId } });
  if (salao.asaasContaId) return { erro: "A conta de recebimento já foi criada." };

  const documento = somenteDigitos(texto(form, "cpfCnpj"));
  const pessoaFisica = documento.length === 11;
  const celular = somenteDigitos(texto(form, "celular"));
  const cep = somenteDigitos(texto(form, "cep"));
  const faturamento = lerDinheiro(texto(form, "faturamento"));
  const nascimento = texto(form, "nascimento");
  const tipoEmpresa = texto(form, "tipoEmpresa");

  if (!texto(form, "nome")) return { erro: "Informe o nome ou a razão social." };
  if (documento.length !== 11 && documento.length !== 14) return { erro: "Informe um CPF (11 números) ou CNPJ (14 números)." };
  if (!/^\S+@\S+\.\S+$/.test(texto(form, "email"))) return { erro: "Informe um e-mail válido." };
  if (celular.length < 10) return { erro: "Informe o celular com DDD." };
  if (pessoaFisica && !diaValido(nascimento)) return { erro: "Para CPF, informe a data de nascimento." };
  if (!pessoaFisica && !(TIPOS_EMPRESA as readonly string[]).includes(tipoEmpresa)) return { erro: "Escolha o tipo de empresa." };
  if (cep.length !== 8) return { erro: "CEP inválido." };
  if (!texto(form, "endereco") || !texto(form, "numero") || !texto(form, "bairro")) return { erro: "Preencha endereço, número e bairro." };
  if (!faturamento) return { erro: "Informe o faturamento mensal aproximado." };

  try {
    const conta = await criarSubconta({
      name: texto(form, "nome"),
      email: texto(form, "email"),
      cpfCnpj: documento,
      ...(pessoaFisica ? { birthDate: nascimento } : { companyType: tipoEmpresa as (typeof TIPOS_EMPRESA)[number] }),
      mobilePhone: celular,
      incomeValue: faturamento / 100,
      address: texto(form, "endereco"),
      addressNumber: texto(form, "numero"),
      province: texto(form, "bairro"),
      postalCode: cep,
    });
    const chave = cifrar(conta.apiKey);
    await db.salao.update({
      where: { id: salaoId },
      data: { asaasContaId: conta.id, asaasWalletId: conta.walletId, asaasApiKey: chave, asaasStatus: "PENDING" },
    });
    // Avisos de pagamento da subconta chegam no Klareza Beauty
    try {
      await configurarWebhook(`${await enderecoDoSite()}/api/asaas/webhook`, tokenWebhookAsaas(), texto(form, "email"), chave);
    } catch {
      // segue: o webhook pode ser configurado de novo em "Atualizar status"
    }
  } catch (e) {
    if (e instanceof ErroAsaas) return { erro: e.message };
    throw e;
  }
  revalidatePath("/painel", "layout");
  return { ok: "Conta criada! Agora envie os documentos pedidos pelo Asaas para liberar os recebimentos." };
}

export async function atualizarStatusConta(_: Resultado): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  await exigirPagamentosOnline(salaoId);
  const b = await db.salao.findUniqueOrThrow({ where: { id: salaoId } });
  if (!b.asaasApiKey) return { erro: "A conta de recebimento ainda não foi criada." };
  try {
    const status = await statusDaSubconta(b.asaasApiKey);
    await db.salao.update({ where: { id: salaoId }, data: { asaasStatus: status } });
    revalidatePath("/painel", "layout");
    return { ok: status === "APPROVED" ? "Conta aprovada! Já dá para cobrar online." : "Status atualizado. A conta ainda está em análise." };
  } catch (e) {
    if (e instanceof ErroAsaas) return { erro: e.message };
    throw e;
  }
}

export async function alternarCobrancaClube(form: FormData) {
  const { salaoId, papel } = await exigirGestor();
  await exigirPagamentosOnline(salaoId);
  if (papel !== "DONO") return;
  const b = await db.salao.findUniqueOrThrow({ where: { id: salaoId } });
  if (b.asaasStatus !== "APPROVED" && form.get("ligar") === "1") return;
  await db.salao.update({ where: { id: salaoId }, data: { cobrancaOnlineClube: form.get("ligar") === "1" } });
  revalidatePath("/painel", "layout");
  revalidatePath("/b", "layout");
}

/** Ambiente de testes: aprova a conta de recebimento sem esperar análise de documentos. */
export async function aprovarNoTeste(_: Resultado): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  await exigirPagamentosOnline(salaoId);
  const b = await db.salao.findUniqueOrThrow({ where: { id: salaoId } });
  if (!b.asaasApiKey) return { erro: "A conta de recebimento ainda não foi criada." };
  try {
    await aprovarSubcontaSandbox(b.asaasApiKey, b.asaasContaId);
    const status = await statusDaSubconta(b.asaasApiKey);
    await db.salao.update({ where: { id: salaoId }, data: { asaasStatus: status } });
    revalidatePath("/painel", "layout");
    return status === "APPROVED" ? { ok: "Conta aprovada (teste)." } : { ok: "Aprovação enviada. Clique em Atualizar status em alguns segundos." };
  } catch (e) {
    if (e instanceof ErroAsaas) return { erro: e.message };
    throw e;
  }
}

// ---------- Saldo e saque ----------

/** Só o dono mexe em saque e na chave Pix (gerente vê o saldo, mas não tira dinheiro). */
async function exigirDono() {
  const sessao = await exigirGestor();
  await exigirPagamentosOnline(sessao.salaoId);
  if (sessao.papel !== "DONO") throw new ErroSaque("Só o dono do salão pode fazer saques e mudar a chave Pix.");
  return sessao;
}

export async function salvarChavePix(_: Resultado, form: FormData): Promise<Resultado> {
  try {
    const sessao = await exigirDono();
    // trocar a chave muda para onde o dinheiro vai: pede a senha de novo
    const usuario = await db.usuario.findUnique({ where: { id: sessao.usuarioId } });
    if (!usuario || !(await bcrypt.compare(texto(form, "senha"), usuario.senhaHash))) return { erro: "Senha incorreta." };
    const tipo = texto(form, "tipo");
    const chave = normalizarChavePix(tipo, texto(form, "chave"));
    const automatico = ["NAO", "DIARIO", "SEMANAL"].includes(texto(form, "automatico")) ? texto(form, "automatico") : "NAO";
    await db.salao.update({ where: { id: sessao.salaoId }, data: { saqueChavePix: chave, saqueTipoChave: tipo, saqueAutomatico: automatico } });
    revalidatePath("/painel/pagamentos");
    return { ok: "Chave Pix salva." };
  } catch (e) {
    if (e instanceof ErroSaque) return { erro: e.message };
    throw e;
  }
}

export async function mudarSaqueAutomatico(_: Resultado, form: FormData): Promise<Resultado> {
  try {
    const sessao = await exigirDono();
    const automatico = ["NAO", "DIARIO", "SEMANAL"].includes(texto(form, "automatico")) ? texto(form, "automatico") : "NAO";
    await db.salao.update({ where: { id: sessao.salaoId }, data: { saqueAutomatico: automatico } });
    revalidatePath("/painel/pagamentos");
    return { ok: automatico === "NAO" ? "Saque automático desligado." : `Saque automático ${automatico === "DIARIO" ? "todo dia" : "toda segunda"} ligado.` };
  } catch (e) {
    if (e instanceof ErroSaque) return { erro: e.message };
    throw e;
  }
}

export async function pedirSaque(_: Resultado, form: FormData): Promise<Resultado> {
  try {
    const sessao = await exigirDono();
    const bruto = texto(form, "valor");
    const valor = bruto ? lerDinheiro(bruto) : null;
    if (bruto && !valor) return { erro: "Valor inválido." };
    const s = await sacar({ salaoId: sessao.salaoId, valorCentavos: valor, pedidoPor: sessao.nome });
    revalidatePath("/painel/pagamentos");
    return s.status === "DONE" ? { ok: "Saque feito! O dinheiro já está na sua conta." } : { ok: "Saque enviado! Pelo Pix costuma cair em segundos." };
  } catch (e) {
    revalidatePath("/painel/pagamentos");
    if (e instanceof ErroSaque || e instanceof ErroAsaas) return { erro: e.message };
    throw e;
  }
}
