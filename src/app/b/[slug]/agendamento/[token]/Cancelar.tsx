"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelarPeloCliente } from "../../actions";

export function Cancelar({ slug, token }: { slug: string; token: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, iniciar] = useTransition();
  const router = useRouter();

  if (!confirmando)
    return (
      <button onClick={() => setConfirmando(true)} className="btn-perigo mt-4 w-full">
        Cancelar agendamento
      </button>
    );

  return (
    <div className="mt-4 rounded-2xl border border-poste-vermelho/20 p-4">
      <p className="text-sm font-medium">Cancelar mesmo? O horário fica livre para outra pessoa.</p>
      {erro && <p className="mt-2 text-sm text-poste-vermelho">{erro}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => setConfirmando(false)} className="btn-secundario">Manter</button>
        <button
          disabled={carregando}
          onClick={() =>
            iniciar(async () => {
              const r = await cancelarPeloCliente(slug, token);
              if (r.ok) router.refresh();
              else setErro(r.erro ?? "Não foi possível cancelar.");
            })
          }
          className="btn-perigo"
        >
          {carregando ? "Cancelando..." : "Sim, cancelar"}
        </button>
      </div>
    </div>
  );
}
