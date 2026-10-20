import type { Metadata } from "next";
import { Landmark, Trash2 } from "lucide-react";
import { FormAcao } from "@/components/FormAcao";
import { Cabecalho, Etiqueta, Indicador, Secao, Vazio } from "@/components/ui";
import { exigirGestor } from "@/lib/auth";
import { exigirRecurso } from "@/lib/planosSistema";
import { db } from "@/lib/db";
import { FORMAS_PAGAMENTO, formatarDinheiro } from "@/lib/formato";
import { numerosDoPeriodo } from "@/lib/relatorios";
import { diaLocal, formatarDia, limitesDoMes, somarMeses } from "@/lib/tempo";
import { excluirConta, novaConta, pagarConta } from "./actions";

export const metadata: Metadata = { title: "Financeiro" };
export const dynamic = "force-dynamic";

const CATEGORIAS = ["Aluguel", "Água e luz", "Internet e telefone", "Fornecedores", "Comissões", "Salários", "Impostos", "Marketing", "Manutenção", "Outros"];
const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export default async function Financeiro({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "financeiro");
  const p = await searchParams;
  const hoje = diaLocal();
  const ref = p.mes && /^\d{4}-\d{2}$/.test(p.mes) ? `${p.mes}-01` : hoje;
  const mes = limitesDoMes(ref);
  const [n, contas] = await Promise.all([
    numerosDoPeriodo(salaoId, mes.inicio, mes.fim),
    db.contaPagar.findMany({
      where: { salaoId, OR: [{ vencimento: { gte: mes.inicio, lte: mes.fim } }, { pagoEm: null, vencimento: { lt: mes.inicio } }] },
      orderBy: { vencimento: "asc" },
    }),
  ]);
  const abertas = contas.filter((c) => !c.pagoEm);
  const pagas = contas.filter((c) => c.pagoEm);
  const nomeMes = `${NOMES_MES[Number(mes.inicio.slice(5, 7)) - 1]} de ${mes.inicio.slice(0, 4)}`;

  return (
    <div>
      <Cabecalho
        titulo="Financeiro"
        descricao={`Entradas, contas e resultado de ${nomeMes}.`}
        acoes={
          <div className="flex items-center gap-1">
            <a href={`/painel/financeiro?mes=${somarMeses(mes.inicio, -1).slice(0, 7)}`} className="btn-secundario">← Mês anterior</a>
            <a href={`/painel/financeiro?mes=${somarMeses(mes.inicio, 1).slice(0, 7)}`} className="btn-secundario">Próximo →</a>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Entradas" valor={formatarDinheiro(n.receita)} detalhe={`Vendas ${formatarDinheiro(n.vendas)} · assinaturas ${formatarDinheiro(n.assinaturas)}`} />
        <Indicador rotulo="Comissões" valor={formatarDinheiro(n.comissoes)} detalhe="Devidas à equipe no mês" />
        <Indicador rotulo="Despesas pagas" valor={formatarDinheiro(n.despesas)} detalhe="Contas + despesas do caixa" />
        <Indicador rotulo="Resultado" valor={formatarDinheiro(n.resultado)} destaque detalhe={n.resultado >= 0 ? "Lucro do mês" : "Prejuízo do mês"} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Secao titulo={`Contas a pagar (${abertas.length})`}>
            {abertas.length === 0 ? (
              <Vazio icone={Landmark} titulo="Nenhuma conta em aberto" texto="Lance aluguel, luz e fornecedores para ver o lucro real e receber avisos de vencimento." />
            ) : (
              <ul className="divide-y divide-black/[0.06]">
                {abertas.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{c.descricao}</p>
                      <p className="text-sm text-couro-400">{c.categoria}</p>
                    </div>
                    {c.vencimento < hoje ? <Etiqueta tom="vermelho">Venceu {formatarDia(c.vencimento)}</Etiqueta> : <Etiqueta>Vence {formatarDia(c.vencimento)}</Etiqueta>}
                    <span className="w-24 text-right font-semibold tabular-nums">{formatarDinheiro(c.valorCentavos)}</span>
                    <form action={pagarConta} className="flex gap-1">
                      <input type="hidden" name="id" value={c.id} />
                      <select name="formaPagamento" className="input w-auto py-1.5 text-xs" defaultValue="PIX" aria-label="Forma de pagamento">
                        {Object.entries(FORMAS_PAGAMENTO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                      </select>
                      <button className="btn-secundario btn-pequeno">Pagar</button>
                    </form>
                    <form action={excluirConta}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="rounded-lg p-1.5 text-couro-300 hover:text-poste-vermelho" aria-label={`Excluir ${c.descricao}`}><Trash2 className="size-4" /></button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Secao>

          <Secao titulo="Pagas no mês">
            {pagas.length === 0 && n.despesasCaixa.length === 0 ? (
              <p className="text-sm text-couro-400">Nenhuma despesa paga neste mês.</p>
            ) : (
              <ul className="divide-y divide-black/[0.06] text-sm">
                {pagas.map((c) => (
                  <li key={c.id} className="flex justify-between gap-3 py-2.5">
                    <span>{c.descricao} <span className="text-couro-400">· {c.categoria}</span></span>
                    <span className="tabular-nums">{formatarDinheiro(c.valorCentavos)}</span>
                  </li>
                ))}
                {n.despesasCaixa.map((d) => (
                  <li key={d.id} className="flex justify-between gap-3 py-2.5">
                    <span>{d.descricao} <span className="text-couro-400">· paga pelo caixa</span></span>
                    <span className="tabular-nums">{formatarDinheiro(d.valorCentavos)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </div>

        <Secao titulo="Lançar conta">
          <FormAcao acao={novaConta} limparAoSalvar className="grid gap-3">
            <input name="descricao" className="input" placeholder="Descrição (ex.: Aluguel)" required aria-label="Descrição" />
            <select name="categoria" className="input" aria-label="Categoria">
              {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="valor">Valor</label><input id="valor" name="valor" className="input" placeholder="1.500,00" inputMode="decimal" required /></div>
              <div><label className="label" htmlFor="vencimento">Vencimento</label><input id="vencimento" name="vencimento" type="date" defaultValue={hoje} className="input" required /></div>
            </div>
            <div>
              <label className="label" htmlFor="repetir">Repetir por (meses)</label>
              <input id="repetir" name="repetir" type="number" min={1} max={24} defaultValue={1} className="input" />
              <p className="mt-1 text-xs text-couro-400">Para contas fixas como aluguel, coloque 12.</p>
            </div>
            <button className="btn-primario">Lançar</button>
          </FormAcao>
        </Secao>
      </div>
    </div>
  );
}
