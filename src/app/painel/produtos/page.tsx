import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";
import { FormAcao } from "@/components/FormAcao";
import { Cabecalho, Etiqueta, Indicador, Secao, Vazio } from "@/components/ui";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { filialDoPainel } from "@/lib/filial";
import { formatarDinheiro } from "@/lib/formato";
import { salvarProduto } from "./actions";

export const metadata: Metadata = { title: "Produtos e estoque" };
export const dynamic = "force-dynamic";

export default async function Produtos() {
  const sessao = await exigirGestor();
  const { salaoId } = sessao;
  const ctx = await filialDoPainel(sessao);
  const ativas = ctx.filiais.filter((f) => f.ativo);
  const colunas = ctx.atual ? ativas.filter((f) => f.id === ctx.atual!.id) : ativas;
  const varias = ativas.length > 1;

  const produtos = await db.produto.findMany({
    where: { salaoId },
    include: { estoques: true },
    orderBy: [{ ativo: "desc" }, { categoria: "asc" }, { nome: "asc" }],
  });
  const em = (p: (typeof produtos)[number], filialId: string) => p.estoques.find((e) => e.filialId === filialId) ?? { quantidade: 0, minimo: 0 };
  const ativos = produtos.filter((p) => p.ativo);
  const baixo = ativos.filter((p) => colunas.some((f) => em(p, f.id).quantidade <= em(p, f.id).minimo));
  const valorEstoque = ativos.reduce((s, p) => s + colunas.reduce((t, f) => t + Math.max(0, em(p, f.id).quantidade), 0) * p.custoCentavos, 0);
  const categorias = [...new Set(produtos.map((p) => p.categoria))];

  return (
    <div>
      <Cabecalho
        titulo="Produtos e estoque"
        descricao={
          varias
            ? `O cadastro vale para todas as unidades; o estoque é de cada uma. Mostrando: ${ctx.atual ? ctx.atual.nome : "todas as unidades"}.`
            : "Pomadas, óleos, bebidas: o que o salão vende e quanto tem guardado."
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Indicador rotulo="Produtos ativos" valor={ativos.length} />
        <Indicador rotulo="Estoque baixo" valor={baixo.length} destaque={baixo.length > 0} detalhe={varias && !ctx.atual ? "Em alguma unidade" : "No mínimo ou abaixo dele"} />
        <Indicador rotulo="Valor em estoque (custo)" valor={formatarDinheiro(valorEstoque)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Secao titulo="Produtos">
          {produtos.length === 0 ? (
            <Vazio icone={Package} titulo="Nenhum produto cadastrado" texto="Cadastre o primeiro produto ao lado para vender nas comandas." />
          ) : (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-couro-400">
                  <tr className="[&>th]:px-5 [&>th]:pb-2 [&>th]:font-medium">
                    <th>Produto</th>
                    <th>Preço</th>
                    <th>Margem</th>
                    {colunas.map((f) => <th key={f.id}>{varias ? f.nome : "Estoque"}</th>)}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((p) => {
                    const margem = p.precoCentavos ? Math.round(((p.precoCentavos - p.custoCentavos) / p.precoCentavos) * 100) : 0;
                    return (
                      <tr key={p.id} className={`border-t border-black/[0.06] [&>td]:px-5 [&>td]:py-3 ${p.ativo ? "" : "opacity-50"}`}>
                        <td>
                          <p className="font-semibold">{p.nome}</p>
                          <p className="text-xs text-couro-400">{p.categoria}</p>
                        </td>
                        <td className="tabular-nums">{formatarDinheiro(p.precoCentavos)}</td>
                        <td className="tabular-nums">{p.custoCentavos ? `${margem}%` : "—"}</td>
                        {colunas.map((f) => {
                          const e = em(p, f.id);
                          return (
                            <td key={f.id} className="whitespace-nowrap">
                              <span className="font-semibold tabular-nums">{e.quantidade}</span>{" "}
                              {p.ativo && e.quantidade <= e.minimo && <Etiqueta tom="vermelho">Repor</Etiqueta>}
                            </td>
                          );
                        })}
                        <td className="text-right">
                          <Link href={`/painel/produtos/${p.id}`} className="btn-secundario btn-pequeno">Gerenciar</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Secao>

        <Secao titulo="Novo produto">
          <FormAcao acao={salvarProduto} className="grid gap-3">
            <div>
              <label className="label" htmlFor="nome">Nome</label>
              <input id="nome" name="nome" className="input" placeholder="Pomada modeladora 120g" required />
            </div>
            <div>
              <label className="label" htmlFor="categoria">Categoria</label>
              <input id="categoria" name="categoria" className="input" list="categorias-produto" placeholder="Cabelo, Unhas, Cílios..." />
              <datalist id="categorias-produto">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="preco">Preço de venda</label>
                <input id="preco" name="preco" className="input" placeholder="45,00" inputMode="decimal" required />
              </div>
              <div>
                <label className="label" htmlFor="custo">Custo</label>
                <input id="custo" name="custo" className="input" placeholder="20,00" inputMode="decimal" />
              </div>
            </div>
            {varias ? (
              <div>
                <label className="label" htmlFor="filialId">Estoque inicial em</label>
                <select id="filialId" name="filialId" className="input" defaultValue={ctx.atual?.id ?? ativas[0]?.id}>
                  {ativas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
            ) : (
              <input type="hidden" name="filialId" value={ativas[0]?.id ?? ""} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="estoqueInicial">Quantidade</label>
                <input id="estoqueInicial" name="estoqueInicial" type="number" min={0} defaultValue={0} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="estoqueMinimo">Avisar com</label>
                <input id="estoqueMinimo" name="estoqueMinimo" type="number" min={0} defaultValue={2} className="input" />
              </div>
            </div>
            <button className="btn-destaque">Cadastrar produto</button>
          </FormAcao>
        </Secao>
      </div>
    </div>
  );
}
