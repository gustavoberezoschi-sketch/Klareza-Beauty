"use server";

import { revalidatePath } from "next/cache";
import { exigirGestor } from "@/lib/auth";
import { exigirRecurso } from "@/lib/planosSistema";
import { db } from "@/lib/db";
import { FORMAS_PAGAMENTO, lerDinheiro } from "@/lib/formato";
import { diaValido, somarMeses } from "@/lib/tempo";
import type { Resultado } from "../actions";

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();

export async function novaConta(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "financeiro");
  const descricao = texto(form, "descricao");
  const valor = lerDinheiro(texto(form, "valor"));
  const vencimento = texto(form, "vencimento");
  const repetir = Number(texto(form, "repetir") || 1);
  if (!descricao) return { erro: "Descreva a conta." };
  if (!valor) return { erro: "Informe o valor." };
  if (!diaValido(vencimento)) return { erro: "Informe o vencimento." };
  if (!Number.isInteger(repetir) || repetir < 1 || repetir > 24) return { erro: "Repetir: de 1 a 24 meses." };
  await db.contaPagar.createMany({
    data: Array.from({ length: repetir }, (_, i) => ({
      salaoId,
      descricao: repetir > 1 ? `${descricao} (${i + 1}/${repetir})` : descricao,
      categoria: texto(form, "categoria") || "Outros",
      valorCentavos: valor,
      vencimento: somarMeses(vencimento, i),
    })),
  });
  revalidatePath("/painel", "layout");
  return { ok: repetir > 1 ? `${repetir} contas lançadas.` : "Conta lançada." };
}

export async function pagarConta(form: FormData) {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "financeiro");
  const forma = texto(form, "formaPagamento");
  await db.contaPagar.updateMany({
    where: { id: texto(form, "id"), salaoId, pagoEm: null },
    data: { pagoEm: new Date(), formaPagamento: forma in FORMAS_PAGAMENTO ? forma : null },
  });
  revalidatePath("/painel", "layout");
}

export async function excluirConta(form: FormData) {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "financeiro");
  await db.contaPagar.deleteMany({ where: { id: texto(form, "id"), salaoId } });
  revalidatePath("/painel", "layout");
}
