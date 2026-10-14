"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { confirmarPeloCliente } from "../../actions";

export function Confirmar({ slug, token }: { slug: string; token: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, iniciar] = useTransition();
  const router = useRouter();
  return (
    <>
      <button
        disabled={carregando}
        onClick={() =>
          iniciar(async () => {
            const r = await confirmarPeloCliente(slug, token);
            if (r.ok) router.refresh();
            else setErro(r.erro ?? "Não foi possível confirmar.");
          })
        }
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--cor)] py-3.5 font-bold text-[var(--cor-texto)] shadow-sm disabled:opacity-50"
      >
        <Check className="size-5" strokeWidth={3} /> {carregando ? "Confirmando..." : "Confirmar presença"}
      </button>
      {erro && <p className="mt-2 text-sm text-poste-vermelho">{erro}</p>}
    </>
  );
}
