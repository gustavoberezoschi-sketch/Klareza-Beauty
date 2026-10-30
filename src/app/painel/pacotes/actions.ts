"use server";

import { revalidatePath } from "next/cache";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { lerDinheiro } from "@/lib/formato";
import { exigirRecurso } from "@/lib/planosSistema";
import type { Resultado } from "../actions";

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();

export async function salvarPacote(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "comandas");
  const nome = texto(form, "nome");
  const sessoes = Number(texto(form, "sessoes"));
  const precoCentavos = lerDinheiro(texto(form, "preco"));
  const validadeDias = texto(form, "validadeDias") ? Number(texto(form, "validadeDias")) : null;

  if (!nome) return { erro: "Informe o nome do pacote." };
  if (!Number.isInteger(sessoes) || sessoes < 2 || sessoes > 50) return { erro: "O pacote deve ter de 2 a 50 sessões." };
  if (precoCentavos === null || precoCentavos <= 0) return { erro: "Preço inválido. Exemplo: 280,00" };
  if (validadeDias !== null && (!Number.isInteger(validadeDias) || validadeDias < 7 || validadeDias > 730))
    return { erro: "A validade deve ficar entre 7 e 730 dias (ou vazia)." };
  const servico = await db.servico.findFirst({ where: { id: texto(form, "servicoId"), salaoId } });
  if (!servico) return { erro: "Escolha o serviço do pacote." };

  await db.pacote.create({
    data: { salaoId, servicoId: servico.id, nome, sessoes, precoCentavos, validadeDias, descricao: texto(form, "descricao") || null },
  });
  revalidatePath("/painel", "layout");
  return { ok: "Pacote cadastrado. Ele já aparece para venda nas comandas." };
}

export async function alternarPacote(form: FormData) {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "comandas");
  const pacote = await db.pacote.findFirst({ where: { id: texto(form, "id"), salaoId } });
  if (pacote) await db.pacote.update({ where: { id: pacote.id }, data: { ativo: !pacote.ativo } });
  revalidatePath("/painel", "layout");
}
