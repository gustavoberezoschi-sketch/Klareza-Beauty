import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { FormAcao } from "@/components/FormAcao";
import { Cabecalho, Etiqueta, Indicador, Secao } from "@/components/ui";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { filialDoPainel } from "@/lib/filial";
import { formatarDinheiro } from "@/lib/formato";
import { formatarDataHora } from "@/lib/tempo";
import { exigirRecurso } from "@/lib/planosSistema";
import { alternarProduto, definirMinimo, movimentar, salvarProduto, transferir } from "../actions";

export const metadata: Metadata = { title: "Produto" };
export const dynamic = "force-dynamic";

const NOMES: Record<string, string> = { ENTRADA: "Entrada", VENDA: "Venda", AJUSTE: "Ajuste", ESTORNO: "Estorno", TRANSFERENCIA: "Transferência" };
const reais = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export default async function Produto({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirGestor();
  await exigirRecurso(sessao.salaoId, "estoque");
  const ctx = await filialDoPainel(sessao);
  const ativas = ctx.filiais.filter((f) => f.ativo);
  const varias = ativas.length > 1;
  const produto = await db.produto.findFirst({
    where: { id: (await params).id, salaoId: sessao.salaoId },
    include: {
      estoques: true,
      movimentos: {
        where: ctx.atual ? { filialId: ctx.atual.id } : {},
        include: { filial: { select: { nome: true } } },
        orderBy: { criadoEm: "desc" },
        take: 40,
      },
    },
  });
  if (!produto) notFound();

  const em = (filialId: string) => produto.estoques.find((e) => e.filialId === filialId) ?? { quantidade: 0, minimo: 0 };
  const visiveis = ctx.atual ? ativas.filter((f) => f.id === ctx.atual!.id) : ativas;
  const total = visiveis.reduce((s, f) => s + em(f.id).quantidade, 0);
  const desde = new Date(Date.now() - 30 * 864e5);
  const vendidos30 = produto.movimentos.filter((m) => m.tipo === "VENDA" && m.criadoEm > desde).reduce((s, m) => s - m.quantidade, 0);
  const padrao = ctx.atual?.id ?? ativas[0]?.id;

  return (
    <div className="mx-auto max-w-5xl">
      <Cabecalho
        titulo={produto.nome}
        descricao={produto.categoria}
        voltar={{ href: "/painel/produtos", rotulo: "Produtos" }}
        acoes={
          <form action={alternarProduto}>
            <input type="hidden" name="id" value={produto.id} />
            <button className={produto.ativo ? "btn-perigo" : "btn-secundario"}>{produto.ativo ? "Desativar produto" : "Reativar produto"}</button>
          </form>
        }
      />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Indicador rotulo={varias && !ctx.atual ? "Em estoque (todas)" : "Em estoque"} valor={total} />
        <Indicador rotulo="Vendidos (30 dias)" valor={vendidos30} />
        <Indicador rotulo="Lucro por unidade" valor={formatarDinheiro(produto.precoCentavos - produto.custoCentavos)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Secao titulo={varias ? "Estoque por unidade" : "Estoque"}>
            <ul className="divide-y divide-black/[0.06]">
              {visiveis.map((f) => {
                const e = em(f.id);
                return (
                  <li key={f.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{varias ? f.nome : "Quantidade atual"}</p>
                      <p className="numero text-2xl">{e.quantidade} {e.quantidade <= e.minimo && <Etiqueta tom="vermelho">Repor</Etiqueta>}</p>
                    </div>
                    <form action={definirMinimo} className="flex items-end gap-1.5">
                      <input type="hidden" name="id" value={produto.id} />
                      <input type="hidden" name="filialId" value={f.id} />
                      <label className="text-xs text-couro-400">
                        Avisar com
                        <input name="minimo" type="number" min={0} defaultValue={e.minimo} className="input mt-1 w-20 py-1.5" />
                      </label>
                      <button className="btn-secundario btn-pequeno">Salvar</button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </Secao>

          <Secao titulo="Movimentar estoque">
            <FormAcao acao={movimentar} limparAoSalvar className="grid gap-3">
              <input type="hidden" name="id" value={produto.id} />
              {varias ? (
                <select name="filialId" className="input" defaultValue={padrao} aria-label="Unidade">
                  {ativas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              ) : (
                <input type="hidden" name="filialId" value={padrao} />
              )}
              <select name="tipo" className="input" aria-label="Tipo de movimentação">
                <option value="ENTRADA">Entrada (chegou mercadoria)</option>
                <option value="SAIDA">Saída (perda, uso interno)</option>
                <option value="AJUSTE">Contagem (informar quantidade real)</option>
              </select>
              <input name="quantidade" type="number" min={0} className="input" placeholder="Quantidade" required />
              <input name="observacao" className="input" placeholder="Observação (ex.: nota fiscal 123)" />
              <button className="btn-secundario">Registrar</button>
            </FormAcao>
          </Secao>

          {varias && (
            <Secao titulo="Transferir entre unidades">
              <FormAcao acao={transferir} limparAoSalvar className="grid gap-3">
                <input type="hidden" name="id" value={produto.id} />
                <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                  <div>
                    <label className="label" htmlFor="de">De</label>
                    <select id="de" name="de" className="input" defaultValue={ativas.find((f) => em(f.id).quantidade > 0)?.id ?? ativas[0].id}>
                      {ativas.map((f) => <option key={f.id} value={f.id}>{f.nome} ({em(f.id).quantidade})</option>)}
                    </select>
                  </div>
                  <ArrowRightLeft className="mb-3 size-4 text-couro-400" />
                  <div>
                    <label className="label" htmlFor="para">Para</label>
                    <select id="para" name="para" className="input" defaultValue={ativas.find((f) => f.id !== (ativas.find((x) => em(x.id).quantidade > 0)?.id ?? ativas[0].id))?.id}>
                      {ativas.map((f) => <option key={f.id} value={f.id}>{f.nome} ({em(f.id).quantidade})</option>)}
                    </select>
                  </div>
                </div>
                <input name="quantidade" type="number" min={1} className="input" placeholder="Quantidade" required aria-label="Quantidade a transferir" />
                <button className="btn-secundario"><ArrowRightLeft className="size-4" /> Transferir</button>
              </FormAcao>
            </Secao>
          )}
        </div>

        <div className="space-y-4">
          <Secao titulo="Dados do produto">
            <FormAcao acao={salvarProduto} className="grid gap-3">
              <input type="hidden" name="id" value={produto.id} />
              <div><label className="label" htmlFor="nome">Nome</label><input id="nome" name="nome" defaultValue={produto.nome} className="input" required /></div>
              <div><label className="label" htmlFor="categoria">Categoria</label><input id="categoria" name="categoria" defaultValue={produto.categoria} className="input" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label" htmlFor="preco">Preço</label><input id="preco" name="preco" defaultValue={reais(produto.precoCentavos)} className="input" inputMode="decimal" required /></div>
                <div><label className="label" htmlFor="custo">Custo</label><input id="custo" name="custo" defaultValue={reais(produto.custoCentavos)} className="input" inputMode="decimal" /></div>
              </div>
              <button className="btn-primario">Salvar</button>
            </FormAcao>
          </Secao>

          <Secao titulo={`Histórico${varias ? ` · ${ctx.atual ? ctx.atual.nome : "todas as unidades"}` : ""}`}>
            {produto.movimentos.length === 0 ? (
              <p className="text-sm text-couro-400">Nenhuma movimentação ainda.</p>
            ) : (
              <ul className="divide-y divide-black/[0.06] text-sm">
                {produto.movimentos.map((m) => (
                  <li key={m.id} className="flex justify-between gap-3 py-2">
                    <span>
                      {NOMES[m.tipo] ?? m.tipo}
                      {m.observacao && <span className="text-couro-400"> · {m.observacao}</span>}
                      <span className="block text-xs text-couro-400">
                        {varias && !ctx.atual && `${m.filial.nome} · `}
                        {formatarDataHora(m.criadoEm)}
                      </span>
                    </span>
                    <span className={`font-semibold tabular-nums ${m.quantidade > 0 ? "text-emerald-700" : "text-poste-vermelho"}`}>
                      {m.quantidade > 0 ? "+" : ""}
                      {m.quantidade}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </div>
      </div>
    </div>
  );
}
