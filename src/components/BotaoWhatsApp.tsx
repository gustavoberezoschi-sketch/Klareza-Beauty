"use client";

import { useOptimistic, useTransition } from "react";
import { Check, MessageCircle, RotateCcw } from "lucide-react";
import { marcarEnviado } from "@/app/painel/lembretes/actions";

/**
 * Abre o WhatsApp com a mensagem pronta e marca como enviada.
 * Se já foi enviada, mostra o horário e permite reenviar ou desmarcar.
 */
export function BotaoWhatsApp({
  href,
  ids,
  tipo,
  enviadoEm,
  rotulo = "Enviar",
}: {
  href: string;
  ids: string[];
  tipo: "LEMBRETE" | "CONFIRMACAO";
  enviadoEm: string | null;
  rotulo?: string;
}) {
  const [, iniciar] = useTransition();
  const [enviado, setEnviado] = useOptimistic(enviadoEm);

  function enviar() {
    window.open(href, "_blank", "noopener");
    iniciar(async () => {
      setEnviado(new Date().toISOString());
      await marcarEnviado(ids, tipo);
    });
  }

  if (enviado) {
    const hora = new Date(enviado).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    return (
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <Check className="size-3.5" /> Enviado às {hora}
        </span>
        <button onClick={enviar} className="rounded-lg p-1.5 text-couro-400 hover:bg-fundo hover:text-tinta" title="Enviar de novo" aria-label="Enviar de novo">
          <MessageCircle className="size-4" />
        </button>
        <button
          onClick={() => iniciar(async () => { setEnviado(null); await marcarEnviado(ids, tipo, false); })}
          className="rounded-lg p-1.5 text-couro-400 hover:bg-fundo hover:text-tinta"
          title="Marcar como não enviado"
          aria-label="Marcar como não enviado"
        >
          <RotateCcw className="size-4" />
        </button>
      </span>
    );
  }
  return (
    <button onClick={enviar} className="btn shrink-0 bg-[#25d366] px-3.5 py-2 text-white hover:bg-[#1fb457]">
      <MessageCircle className="size-4" /> {rotulo}
    </button>
  );
}
