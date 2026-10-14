import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";
import { FormAcao } from "@/components/FormAcao";
import { Cabecalho, Etiqueta, Indicador, Secao } from "@/components/ui";
import { exigirGestor } from "@/lib/auth";
import { caixaAberto, resumoDoCaixa } from "@/lib/caixa";
import { db } from "@/lib/db";
import { filialDoPainel } from "@/lib/filial";
import { NOME_FORMA, formatarDinheiro } from "@/lib/formato";
import { formatarDataHora, horaLocal } from "@/lib/tempo";
import { trocarFilial } from "../unidades/actions";
import { abrirCaixa, fecharCaixa, lancarMovimento } from "./actions";

export const metadata: Metadata = { title: "Caixa" };
export const dynamic = "force-dynamic";

const TIPOS = { SUPRIMENTO: "Suprimento (entrada de troco)", SANGRIA: "Sangria (retirada)", DESPESA: "Despesa paga do caixa" };

export default async function Caixa({ searchParams }: { searchParams: Promise<{ id?: string; fechado?: string }> }) {
  const sessao = await exigirGestor();
  const { salaoId } = sessao;
  const p = await searchParams;
  const ctx = await filialDoPainel(sessao);

  // Com "todas as unidades", o caixa pede para escolher qual unidade abrir.
  if (!ctx.atual && !p.id) {
    const ativas = ctx.filiais.filter((f) => f.ativo);
    const abertos = await db.caixa.findMany({ where: { salaoId, fechadoEm: null }, select: { filialId: true, abertoEm: true } });
    return (
      <div>
        <Cabecalho titulo="Caixa" descricao="Cada unidade tem o próprio caixa. Escolha a unidade." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ativas.map((f) => {
            const cx = abertos.find((c) => c.filialId === f.id);
            return (
              <form key={f.id} action={trocarFilial} className="card">
                <input type="hidden" name="filialId" value={f.id} />
                <p className="font-display text-lg font-bold">{f.nome}</p>
                <p className="mt-1 text-sm text-couro-400">{cx ? `Caixa aberto desde ${horaLocal(cx.abertoEm)}` : "Caixa fechado"}</p>
                <button className="btn-primario btn-pequeno mt-4"><Wallet className="size-3.5" /> Ir para o caixa</button>
              </form>
            );
          })}
        </div>
      </div>
    );
  }

  const aberto = ctx.atual ? await caixaAberto(salaoId, ctx.atual.id) : null;
  const verId = p.id ?? aberto?.id;
  const selecionado = verId ? await db.caixa.findFirst({ where: { id: verId, salaoId }, include: { filial: true } }) : null;
  const resumo = selecionado ? await resumoDoCaixa(selecionado.id) : null;
  const historico = await db.caixa.findMany({
    where: { salaoId, fechadoEm: { not: null }, ...(ctx.atual ? { filialId: ctx.atual.id } : {}) },
    include: { filial: true },
    orderBy: { abertoEm: "desc" },
    take: 15,
  });
  const varias = ctx.filiais.filter((f) => f.ativo).length > 1;

  return (
    <div>
      <Cabecalho titulo={varias ? `Caixa · ${selecionado?.filial.nome ?? ctx.atual?.nome}` : "Caixa"} descricao="Abertura, entradas, retiradas e fechamento do dia." />

      {!aberto && !p.id && (
        <Secao titulo="Abrir o caixa" className="mb-6 max-w-lg">
          <FormAcao acao={abrirCaixa} className="flex flex-wrap items-end gap-3">
            <div className="flex-1">
              <label className="label" htmlFor="saldoInicial">Dinheiro na gaveta (troco)</label>
              <input id="saldoInicial" name="saldoInicial" className="input" placeholder="0,00" inputMode="decimal" />
            </div>
            <button className="btn-destaque"><Wallet className="size-4" /> Abrir caixa</button>
          </FormAcao>
        </Secao>
      )}

      {p.fechado && (
        <p className="mb-4 rounded-2xl bg-emerald-600/10 px-4 py-3 text-sm font-medium text-emerald-800">
          Caixa fechado. Confira o resumo abaixo e abra um novo caixa no próximo expediente.
        </p>
      )}
      {resumo && selecionado && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-couro-700">
            {selecionado.fechadoEm ? <Etiqueta>Fechado</Etiqueta> : <Etiqueta tom="verde">Aberto</Etiqueta>}
            Aberto em {formatarDataHora(selecionado.abertoEm)}
            {selecionado.fechadoEm && ` · fechado em ${formatarDataHora(selecionado.fechadoEm)}`}
            {p.id && <Link href="/painel/caixa" className="ml-2 font-semibold text-latao-700 hover:underline">{aberto ? "Voltar ao caixa aberto" : "Abrir novo caixa"}</Link>}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador rotulo="Entradas" valor={formatarDinheiro(resumo.entradas)} destaque detalhe={`${resumo.caixa.comandas.length} comanda(s), ${resumo.caixa.pagamentos.length} mensalidade(s)`} />
            <Indicador rotulo="Troco inicial" valor={formatarDinheiro(selecionado.saldoInicialCentavos)} />
            <Indicador rotulo="Saídas" valor={formatarDinheiro(resumo.sangrias + resumo.despesas)} detalhe="Sangrias e despesas" />
            <Indicador
              rotulo="Dinheiro na gaveta"
              valor={formatarDinheiro(resumo.dinheiroEsperado)}
              detalhe={
                selecionado.dinheiroContadoCentavos !== null
                  ? `Contado: ${formatarDinheiro(selecionado.dinheiroContadoCentavos)} (diferença ${formatarDinheiro(selecionado.dinheiroContadoCentavos - resumo.dinheiroEsperado)})`
                  : "Valor esperado"
              }
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <Secao titulo="Por forma de pagamento">
                {Object.keys(resumo.porForma).length === 0 ? (
                  <p className="text-sm text-couro-400">Nenhuma venda neste caixa ainda.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {Object.entries(resumo.porForma).sort((a, b) => b[1] - a[1]).map(([forma, valor]) => (
                      <li key={forma} className="flex items-center gap-3">
                        <span className="w-36 shrink-0">{NOME_FORMA[forma] ?? forma}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-fundo">
                          <span className="block h-full rounded-full bg-latao-500" style={{ width: `${(valor / resumo.entradas) * 100}%` }} />
                        </span>
                        <span className="w-24 text-right font-semibold tabular-nums">{formatarDinheiro(valor)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {resumo.naFatura > 0 && (
                  <p className="mt-3 rounded-xl bg-latao-50 p-3 text-xs text-couro-700">
                    + {formatarDinheiro(resumo.naFatura)} lançados na fatura do clube. Entram quando o cliente pagar a mensalidade.
                  </p>
                )}
              </Secao>

              <Secao titulo="Movimentações">
                <ul className="divide-y divide-black/[0.06] text-sm">
                  {resumo.caixa.comandas.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 py-2.5">
                      <ArrowDownCircle className="size-4 shrink-0 text-emerald-600" />
                      <span className="w-12 tabular-nums text-couro-400">{c.fechadaEm ? horaLocal(c.fechadaEm) : ""}</span>
                      <Link href={`/painel/comandas/${c.id}`} className="flex-1 truncate hover:underline">
                        Comanda #{c.numero} · {c.cliente?.nome ?? "Avulso"} · {NOME_FORMA[c.formaPagamento ?? ""]}
                      </Link>
                      <span className="font-semibold tabular-nums">{formatarDinheiro(c.totalCentavos)}</span>
                    </li>
                  ))}
                  {resumo.caixa.pagamentos.map((pg) => (
                    <li key={pg.id} className="flex items-center gap-3 py-2.5">
                      <ArrowDownCircle className="size-4 shrink-0 text-emerald-600" />
                      <span className="w-12 tabular-nums text-couro-400">{horaLocal(pg.pagoEm)}</span>
                      <span className="flex-1 truncate">Mensalidade {pg.assinatura.plano.nome} · {pg.assinatura.cliente.nome} · {NOME_FORMA[pg.formaPagamento]}</span>
                      <span className="font-semibold tabular-nums">{formatarDinheiro(pg.valorCentavos)}</span>
                    </li>
                  ))}
                  {resumo.caixa.movimentos.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 py-2.5">
                      {m.tipo === "SUPRIMENTO" ? <ArrowDownCircle className="size-4 shrink-0 text-emerald-600" /> : <ArrowUpCircle className="size-4 shrink-0 text-poste-vermelho" />}
                      <span className="w-12 tabular-nums text-couro-400">{horaLocal(m.criadoEm)}</span>
                      <span className="flex-1 truncate">{TIPOS[m.tipo as keyof typeof TIPOS]?.split(" (")[0]}: {m.descricao}</span>
                      <span className="font-semibold tabular-nums">{m.tipo === "SUPRIMENTO" ? "" : "-"}{formatarDinheiro(m.valorCentavos)}</span>
                    </li>
                  ))}
                  {resumo.caixa.comandas.length + resumo.caixa.movimentos.length + resumo.caixa.pagamentos.length === 0 && (
                    <li className="py-2 text-couro-400">Nada lançado ainda.</li>
                  )}
                </ul>
              </Secao>
            </div>

            {!selecionado.fechadoEm && (
              <div className="space-y-4">
                <Secao titulo="Lançar entrada ou saída">
                  <FormAcao acao={lancarMovimento} limparAoSalvar className="grid gap-3">
                    <select name="tipo" className="input" aria-label="Tipo">
                      {Object.entries(TIPOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                    </select>
                    <input name="valor" className="input" placeholder="Valor (R$)" inputMode="decimal" required />
                    <input name="descricao" className="input" placeholder="Descrição (ex.: compra de água)" required />
                    <button className="btn-secundario">Lançar</button>
                  </FormAcao>
                </Secao>
                <Secao titulo="Fechar o caixa">
                  <FormAcao acao={fecharCaixa} className="grid gap-3">
                    <p className="text-sm text-couro-400">
                      Conte o dinheiro da gaveta. O esperado é <strong className="text-tinta">{formatarDinheiro(resumo.dinheiroEsperado)}</strong>.
                    </p>
                    <input name="dinheiroContado" className="input" placeholder="Dinheiro contado (R$)" inputMode="decimal" required />
                    <input name="observacao" className="input" placeholder="Observação (opcional)" />
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirmar" /> Fechar mesmo com comandas abertas</label>
                    <button className="btn-primario">Fechar caixa</button>
                  </FormAcao>
                </Secao>
              </div>
            )}
          </div>
        </>
      )}

      {historico.length > 0 && (
        <Secao titulo="Caixas anteriores" className="mt-6">
          <ul className="divide-y divide-black/[0.06] text-sm">
            {historico.map((c) => (
              <li key={c.id}>
                <Link href={`/painel/caixa?id=${c.id}`} className="flex justify-between py-2.5 hover:text-latao-700">
                  <span>{varias && `${c.filial.nome} · `}{formatarDataHora(c.abertoEm)} até {c.fechadoEm ? formatarDataHora(c.fechadoEm) : ""}</span>
                  <span className="font-semibold">Ver</span>
                </Link>
              </li>
            ))}
          </ul>
        </Secao>
      )}
    </div>
  );
}
