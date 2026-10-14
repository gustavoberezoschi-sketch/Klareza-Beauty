"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopiarCupom({ cupom }: { cupom: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(cupom).then(() => {
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        });
      }}
      className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-[var(--cor)] px-3 py-1.5 font-mono text-sm font-bold"
    >
      {cupom} {copiado ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4 text-couro-400" />}
      <span className="sr-only">{copiado ? "Copiado" : "Copiar cupom"}</span>
    </button>
  );
}
