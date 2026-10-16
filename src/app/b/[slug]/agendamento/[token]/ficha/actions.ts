"use server";

import { revalidatePath } from "next/cache";
import { type Anamnese, PERGUNTAS_SIM_NAO, PERGUNTAS_TEXTO } from "@/lib/anamnese";
import { db } from "@/lib/db";
import { excedeuLimite, ipDaRequisicao } from "@/lib/limite";

export type DadosFicha = { respostas: Record<string, string>; nome: string; assinatura: string; aceite: boolean };

/** O cliente preenche a ficha e assina o termo pelo link do agendamento. */
export async function salvarFichaPeloCliente(slug: string, token: string, dados: DadosFicha): Promise<{ ok: boolean; erro?: string }> {
  const ag = await db.agendamento.findFirst({ where: { token, salao: { slug } }, select: { clienteId: true, status: true } });
  if (!ag || !["AGUARDANDO_SINAL", "AGENDADO", "CONFIRMADO"].includes(ag.status)) return { ok: false, erro: "Este agendamento não aceita mais a ficha." };
  const ip = await ipDaRequisicao();
  if (await excedeuLimite(`ficha:${token}:${ip}`, 8, 60)) return { ok: false, erro: "Muitas tentativas. Tente de novo mais tarde." };
  const nome = (dados.nome ?? "").trim().slice(0, 80);
  if (!dados.aceite) return { ok: false, erro: "Para enviar, marque que concorda com o termo." };
  if (nome.length < 3) return { ok: false, erro: "Digite seu nome completo." };
  const assinatura = String(dados.assinatura ?? "");
  if (!assinatura.startsWith("data:image/png;base64,") || assinatura.length > 300_000) return { ok: false, erro: "Assine no quadro antes de enviar." };

  const ficha: Anamnese = {};
  for (const [campo] of PERGUNTAS_SIM_NAO) {
    const v = dados.respostas?.[campo];
    if (v !== "sim" && v !== "nao") return { ok: false, erro: "Responda todas as perguntas de sim ou não." };
    ficha[campo] = v === "sim";
  }
  for (const [campo] of PERGUNTAS_TEXTO) {
    const v = String(dados.respostas?.[campo] ?? "").trim().slice(0, 500);
    if (v) ficha[campo] = v;
  }
  await db.cliente.update({
    where: { id: ag.clienteId },
    data: { anamnese: ficha, anamneseEm: new Date(), termoAssinatura: assinatura, termoNome: nome, termoAssinadoEm: new Date(), termoIp: ip },
  });
  revalidatePath(`/b/${slug}/agendamento/${token}`);
  revalidatePath("/painel", "layout");
  return { ok: true };
}
