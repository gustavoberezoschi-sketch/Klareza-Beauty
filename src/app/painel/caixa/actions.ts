"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirGestor } from "@/lib/auth";
import { caixaAberto } from "@/lib/caixa";
import { db } from "@/lib/db";
import { filialDoPainel } from "@/lib/filial";
import { lerDinheiro } from "@/lib/formato";
import { exigirRecurso } from "@/lib/planosSistema";
import type { Resultado } from "../actions";

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();

/** Caixa é sempre de uma unidade: exige uma unidade escolhida no menu. */
async function unidade() {
  const sessao = await exigirGestor();
  await exigirRecurso(sessao.salaoId, "comandas");
  const { atual } = await filialDoPainel(sessao);
  return { salaoId: sessao.salaoId, filialId: atual?.id ?? null };
}

export async function abrirCaixa(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId, filialId } = await unidade();
  if (!filialId) return { erro: "Escolha a unidade no menu." };
  if (await caixaAberto(salaoId, filialId)) return { erro: "Já existe um caixa aberto nesta unidade." };
  const saldo = lerDinheiro(texto(form, "saldoInicial") || "0");
  if (saldo === null) return { erro: "Valor inválido. Exemplo: 100,00" };
  const caixa = await db.caixa.create({ data: { salaoId, filialId, saldoInicialCentavos: saldo } });
  // Comandas abertas antes passam a contar neste caixa.
  await db.comanda.updateMany({ where: { filialId, status: "ABERTA", caixaId: null }, data: { caixaId: caixa.id } });
  revalidatePath("/painel", "layout");
  return { ok: "Caixa aberto." };
}

export async function lancarMovimento(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId, filialId } = await unidade();
  const caixa = filialId ? await caixaAberto(salaoId, filialId) : null;
  if (!caixa) return { erro: "Abra o caixa primeiro." };
  const tipo = texto(form, "tipo");
  const valor = lerDinheiro(texto(form, "valor"));
  const descricao = texto(form, "descricao");
  if (!["SUPRIMENTO", "SANGRIA", "DESPESA"].includes(tipo)) return { erro: "Escolha o tipo." };
  if (!valor) return { erro: "Informe o valor." };
  if (!descricao) return { erro: "Descreva o lançamento." };
  await db.movimentoCaixa.create({ data: { caixaId: caixa.id, tipo, valorCentavos: valor, descricao } });
  revalidatePath("/painel", "layout");
  return { ok: "Lançamento registrado." };
}

export async function fecharCaixa(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId, filialId } = await unidade();
  const caixa = filialId ? await caixaAberto(salaoId, filialId) : null;
  if (!caixa) return { erro: "Nenhum caixa aberto." };
  const contado = lerDinheiro(texto(form, "dinheiroContado") || "0");
  if (contado === null) return { erro: "Valor contado inválido." };
  const abertas = await db.comanda.count({ where: { filialId: caixa.filialId, status: "ABERTA" } });
  if (abertas > 0 && form.get("confirmar") !== "on")
    return { erro: `Ainda há ${abertas} comanda(s) aberta(s). Feche-as ou marque "Fechar mesmo assim".` };
  await db.caixa.update({
    where: { id: caixa.id },
    data: { fechadoEm: new Date(), dinheiroContadoCentavos: contado, observacao: texto(form, "observacao") || null },
  });
  revalidatePath("/painel", "layout");
  redirect(`/painel/caixa?id=${caixa.id}&fechado=1`);
}
