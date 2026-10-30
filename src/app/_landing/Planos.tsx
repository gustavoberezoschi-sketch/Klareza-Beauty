"use client";

import { useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { formatarDinheiro } from "@/lib/formato";

const real = (c: number) => formatarDinheiro(c).replace(",00", "");
const reais = (c: number) => formatarDinheiro(c);

export type PlanoLanding = {
  codigo: string;
  nome: string;
  mensal: number;
  anual: number;
  linhas: { texto: string; tem: boolean; forte?: boolean }[];
  href: string;
};

/** Cartões de plano da landing, com a chave Mensal/Anual. No anual, o preço é mostrado já dividido por mês. */
export function Planos({ planos }: { planos: PlanoLanding[] }) {
  const [anual, setAnual] = useState(true);
  return (
    <>
      <div className="mt-8 inline-flex rounded-full border border-[var(--lp-linha)] p-1 text-sm font-medium" role="group" aria-label="Periodicidade">
        <button type="button" aria-pressed={!anual} onClick={() => setAnual(false)} className={`rounded-full px-5 py-2 transition-colors ${!anual ? "bg-[var(--lp-tinta)] text-white" : "text-[var(--lp-cinza)]"}`}>
          Mensal
        </button>
        <button type="button" aria-pressed={anual} onClick={() => setAnual(true)} className={`flex items-center gap-2 rounded-full px-5 py-2 transition-colors ${anual ? "bg-[var(--lp-tinta)] text-white" : "text-[var(--lp-cinza)]"}`}>
          Anual <span className="rounded-full bg-[var(--lp-verde)] px-2 py-0.5 text-[11px] text-white">2 meses grátis</span>
        </button>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {planos.map((p) => {
          const forte = p.codigo === "CIDADE";
          const mudo = forte ? "text-white/60" : "text-[var(--lp-cinza)]";
          const porMes = anual ? Math.round(p.anual / 12) : p.mensal;
          return (
            <div key={p.codigo} className={`flex flex-col rounded-3xl p-7 ${forte ? "bg-[var(--lp-tinta)] text-white" : "border border-[var(--lp-linha)]"}`}>
              <div className="flex items-center justify-between">
                <p className="text-xl font-semibold">{p.nome}</p>
                {forte && <span className="rounded-full bg-white/10 px-3 py-1 text-xs">Para 2 unidades</span>}
                {p.codigo === "SOLO" && <span className="rounded-full bg-[var(--lp-verde-claro)] px-3 py-1 text-xs text-[var(--lp-verde)]">Trabalho sozinha</span>}
              </div>
              <p className="lp-titulo mt-6 text-5xl">
                {reais(porMes)}
                <span className={`ml-1 font-sans text-base font-normal tracking-normal ${mudo}`}>/mês</span>
              </p>
              <div className={`mt-2 h-11 text-sm ${mudo}`}>
                {anual ? (
                  <>
                    <p>no anual · <strong className={forte ? "text-white" : "text-[var(--lp-verde)]"}>economize {real(p.mensal * 12 - p.anual)}</strong></p>
                    <p className="mt-1">Pix ou boleto <strong className="font-semibold">{real(p.anual)}/ano</strong></p>
                  </>
                ) : (
                  <p>cobrado todo mês, sem fidelidade</p>
                )}
              </div>
              <ul className={`mt-6 flex-1 space-y-2.5 border-t pt-6 text-[15px] ${forte ? "border-white/15" : "border-[var(--lp-linha)]"}`}>
                {p.linhas.map((l) => (
                  <li key={l.texto} className={`flex items-start gap-2.5 ${l.tem ? (l.forte ? "font-semibold" : "") : `line-through ${mudo} opacity-70`}`}>
                    {l.tem ? <Check className="mt-0.5 size-4 shrink-0 text-[var(--lp-verde)]" /> : <X className="mt-0.5 size-4 shrink-0 text-red-500" />}
                    {l.texto}
                  </li>
                ))}
              </ul>
              <a
                href={p.href}
                target={p.href.startsWith("http") ? "_blank" : undefined}
                rel="noopener"
                className={`lp-btn mt-8 w-full ${forte ? "bg-white text-[var(--lp-tinta)] hover:bg-white/90" : "lp-btn-linha"}`}
              >
                Quero o {p.nome} <ArrowRight className="lp-seta size-4" />
              </a>
            </div>
          );
        })}
      </div>
    </>
  );
}
