import { Check, X } from "lucide-react";
import { formatarDinheiro } from "@/lib/formato";
import { CODIGOS_PLANO, PLANOS_SISTEMA, linhasDoPlano, type CodigoPlano } from "@/lib/planosSistema";

/** Os planos lado a lado (usado na página /planos e no "Meu plano"). */
export function TabelaPlanos({ atual, acao }: { atual?: CodigoPlano; acao?: (codigo: CodigoPlano) => React.ReactNode }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {CODIGOS_PLANO.map((c) => {
        const p = PLANOS_SISTEMA[c];
        const economia = p.mensal * 12 - p.anual;
        const destaque = c === "CIDADE";
        return (
          <div key={c} className={`relative flex flex-col rounded-3xl border-2 bg-white p-6 ${c === atual ? "border-latao-500" : destaque ? "border-couro-900" : "border-black/[0.06]"}`}>
            {c === atual ? (
              <span className="absolute -top-3 left-6 rounded-full bg-latao-500 px-3 py-0.5 text-xs font-bold text-white">Seu plano</span>
            ) : destaque ? (
              <span className="absolute -top-3 left-6 rounded-full bg-couro-900 px-3 py-0.5 text-xs font-bold text-white">Ideal para 2 unidades</span>
            ) : null}
            <p className="font-display text-2xl font-bold">{p.nome}</p>
            <p className="mt-3">
              <span className="numero text-4xl">{formatarDinheiro(p.mensal).replace(",00", "")}</span>
              <span className="text-couro-400">/mês</span>
            </p>
            <p className="mt-1 text-sm text-couro-700">
              ou <strong>{formatarDinheiro(p.anual).replace(",00", "")}/ano</strong>
              {economia > 0 && <span className="ml-1 rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">economize {formatarDinheiro(economia).replace(",00", "")}</span>}
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {linhasDoPlano(c).map((l) => (
                <li key={l.texto} className={`flex gap-2 ${l.tem ? (l.forte ? "font-semibold" : "") : "text-couro-400 line-through"}`}>
                  {l.tem ? <Check className="size-4 shrink-0 text-latao-600" /> : <X className="size-4 shrink-0 text-red-500" />} {l.texto}
                </li>
              ))}
            </ul>
            {acao && <div className="mt-6">{acao(c)}</div>}
          </div>
        );
      })}
    </div>
  );
}
