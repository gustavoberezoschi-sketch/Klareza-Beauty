import { formatarDinheiro } from "@/lib/formato";

/**
 * Gráfico de barras de uma série (ex.: faturamento por dia).
 * Barras finas, topo arredondado, eixo discreto, dica ao passar o mouse e tabela para leitores de tela.
 */
export function GraficoBarras({
  dados,
  titulo,
  altura = 160,
  destacarUltimo = true,
}: {
  dados: { rotulo: string; detalhe: string; valor: number }[];
  titulo: string;
  altura?: number;
  destacarUltimo?: boolean;
}) {
  const maximo = Math.max(1, ...dados.map((d) => d.valor));
  const passo = maximo > 0 ? Math.ceil(maximo / 2 / 1000) * 1000 : 1;
  const topo = Math.max(passo * 2, maximo);

  return (
    <figure>
      <div className="relative" style={{ height: altura }} aria-hidden>
        {[0, 0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: f * altura }}>
            <span className="w-14 shrink-0 -translate-y-px text-right text-[10px] text-couro-400 tabular-nums">
              {f === 0 ? "" : formatarDinheiro(Math.round(topo * f)).replace(",00", "")}
            </span>
            <span className={`h-px flex-1 ${f === 0 ? "bg-black/15" : "bg-black/[0.05]"}`} />
          </div>
        ))}
        <div className="absolute inset-y-0 right-0 left-16 flex items-end gap-[2px]">
          {dados.map((d, i) => {
            const h = (d.valor / topo) * altura;
            const ultimo = destacarUltimo && i === dados.length - 1;
            return (
              <div key={i} className="group relative flex h-full flex-1 items-end justify-center">
                <div
                  className={`w-full max-w-7 rounded-t-[4px] transition ${ultimo ? "bg-couro-900" : "bg-latao-500 group-hover:bg-latao-600"}`}
                  style={{ height: d.valor > 0 ? Math.max(3, h) : 0 }}
                />
                <div className="pointer-events-none absolute z-10 hidden rounded-lg bg-couro-900 px-2.5 py-1.5 text-center text-xs whitespace-nowrap text-white shadow-lg group-hover:block" style={{ bottom: Math.max(3, h) + 6 }}>
                  <span className="block text-couro-300">{d.detalhe}</span>
                  <span className="font-semibold tabular-nums">{formatarDinheiro(d.valor)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 ml-16 flex gap-[2px]" aria-hidden>
        {dados.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[10px] text-couro-400 tabular-nums">
            {dados.length <= 16 || i % 2 === 0 ? d.rotulo : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{titulo}</caption>
        <tbody>
          {dados.map((d, i) => (
            <tr key={i}>
              <th>{d.detalhe}</th>
              <td>{formatarDinheiro(d.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
