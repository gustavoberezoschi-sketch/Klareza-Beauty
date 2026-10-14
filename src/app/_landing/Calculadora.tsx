"use client";

import { useState } from "react";
import { formatarDinheiro } from "@/lib/formato";

const real = (centavos: number) => formatarDinheiro(centavos).replace(",00", "");

/** Simulador da receita do clube de assinatura. */
export function Calculadora() {
  const [assinantes, setAssinantes] = useState(80);
  const [preco, setPreco] = useState(89);
  const mensal = assinantes * preco * 100;
  return (
    <div className="rounded-[28px] border border-white/15 p-6 sm:p-8">
      <label className="block">
        <span className="flex items-baseline justify-between text-sm text-white/70">
          Assinantes no clube <strong className="text-2xl font-semibold text-white tabular-nums">{assinantes}</strong>
        </span>
        <input type="range" min={10} max={300} step={5} value={assinantes} onChange={(e) => setAssinantes(+e.target.value)} className="mt-3 w-full" aria-label="Número de assinantes" />
      </label>
      <label className="mt-6 block">
        <span className="flex items-baseline justify-between text-sm text-white/70">
          Mensalidade do plano <strong className="text-2xl font-semibold text-white tabular-nums">{real(preco * 100)}</strong>
        </span>
        <input type="range" min={39} max={199} step={5} value={preco} onChange={(e) => setPreco(+e.target.value)} className="mt-3 w-full" aria-label="Valor da mensalidade" />
      </label>
      <div className="mt-8 border-t border-white/15 pt-6">
        <p className="text-sm text-white/70">Entrando todo mês</p>
        <p className="lp-titulo mt-1 text-6xl text-white tabular-nums sm:text-7xl">{real(mensal)}</p>
        <p className="mt-2 text-white/70">{real(mensal * 12)} por ano</p>
      </div>
      <p className="mt-6 text-xs text-white/50">Simulação de valores brutos, antes das taxas do meio de pagamento.</p>
    </div>
  );
}
