"use server";

import { revalidatePath } from "next/cache";
import { exigirGestor, exigirSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Resultado } from "../actions";

/** Marca (ou desmarca) que a mensagem foi enviada pelo WhatsApp. */
export async function marcarEnviado(ids: string[], tipo: "LEMBRETE" | "CONFIRMACAO", enviado = true) {
  const sessao = await exigirSessao();
  const campo = tipo === "LEMBRETE" ? "lembreteEnviadoEm" : "confirmacaoEnviadaEm";
  await db.agendamento.updateMany({
    where: { id: { in: ids.slice(0, 10) }, salaoId: sessao.salaoId, ...(sessao.profissionalId ? { profissionalId: sessao.profissionalId } : {}) },
    data: { [campo]: enviado ? new Date() : null },
  });
  revalidatePath("/painel", "layout");
}

export async function salvarMensagens(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  const limpar = (v: FormDataEntryValue | null) => String(v ?? "").trim().slice(0, 1500) || null;
  await db.salao.update({
    where: { id: salaoId },
    data: { msgLembrete: limpar(form.get("msgLembrete")), msgConfirmacao: limpar(form.get("msgConfirmacao")) },
  });
  revalidatePath("/painel", "layout");
  return { ok: "Mensagens salvas." };
}
