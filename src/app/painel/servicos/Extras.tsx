"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

const reais = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",");
const centavos = (texto: string) => {
  const n = Number(texto.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

type Opcao = { id?: string; tipo: "VARIACAO" | "ADICIONAL"; nome: string; preco: string; duracao: string };

/** Variações (preço/duração próprios) e adicionais (somam preço/duração), guardados num campo JSON. */
export function OpcoesServico({ inicial }: { inicial: { id: string; tipo: string; nome: string; precoCentavos: number; duracaoMin: number }[] }) {
  const [linhas, setLinhas] = useState<Opcao[]>(
    inicial.map((o) => ({ id: o.id, tipo: o.tipo as Opcao["tipo"], nome: o.nome, preco: reais(o.precoCentavos), duracao: String(o.duracaoMin) })),
  );
  const json = JSON.stringify(
    linhas.filter((l) => l.nome.trim()).map((l) => ({ id: l.id, tipo: l.tipo, nome: l.nome.trim(), precoCentavos: centavos(l.preco), duracaoMin: Number(l.duracao) })),
  );
  const mudar = (i: number, campo: keyof Opcao, valor: string) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));

  const bloco = (tipo: Opcao["tipo"], titulo: string, ajuda: string, exemplo: string) => (
    <div>
      <p className="label">{titulo}</p>
      <p className="mb-2 text-xs text-couro-400">{ajuda}</p>
      <div className="space-y-2">
        {linhas.map((l, i) =>
          l.tipo !== tipo ? null : (
            <div key={i} className="grid grid-cols-[1fr_90px_70px_auto] gap-2">
              <input className="input" value={l.nome} onChange={(e) => mudar(i, "nome", e.target.value)} placeholder={exemplo} aria-label="Nome" />
              <input className="input" value={l.preco} onChange={(e) => mudar(i, "preco", e.target.value)} placeholder={tipo === "VARIACAO" ? "Preço" : "+ R$"} inputMode="decimal" aria-label="Preço" />
              <input className="input" value={l.duracao} onChange={(e) => mudar(i, "duracao", e.target.value)} placeholder="min" inputMode="numeric" aria-label="Minutos" />
              <button type="button" onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))} className="rounded-lg p-2 text-couro-300 hover:text-poste-vermelho" aria-label="Remover">
                <Trash2 className="size-4" />
              </button>
            </div>
          ),
        )}
      </div>
      <button type="button" onClick={() => setLinhas((ls) => [...ls, { tipo, nome: "", preco: "", duracao: tipo === "VARIACAO" ? "60" : "0" }])} className="btn-secundario btn-pequeno mt-2">
        <Plus className="size-3.5" /> {tipo === "VARIACAO" ? "Adicionar variação" : "Adicionar adicional"}
      </button>
    </div>
  );

  return (
    <div className="grid gap-5">
      <input type="hidden" name="opcoesJson" value={json} />
      {bloco("VARIACAO", "Variações", "Tipos do mesmo serviço, cada um com preço e duração (o cliente escolhe um). Ex.: clássico, híbrido, volume russo; unha curta, longa.", "Volume russo")}
      {bloco("ADICIONAL", "Adicionais", "Extras que o cliente marca e que somam preço e tempo. Ex.: remoção, nail art, francesinha.", "Remoção")}
    </div>
  );
}

type Faixa = { dias: string; preco: string };

/** Faixas de preço da manutenção por dias desde a última aplicação. */
export function FaixasManutencao({
  inicial,
  aplicacaoId,
  servicos,
}: {
  inicial: { ateDias: number; precoCentavos: number }[];
  aplicacaoId: string | null;
  servicos: { id: string; nome: string }[];
}) {
  const [faixas, setFaixas] = useState<Faixa[]>(inicial.map((f) => ({ dias: String(f.ateDias), preco: reais(f.precoCentavos) })));
  const json = JSON.stringify(faixas.filter((f) => f.dias && f.preco).map((f) => ({ ateDias: Number(f.dias), precoCentavos: centavos(f.preco) })));
  return (
    <div className="grid gap-3">
      <input type="hidden" name="faixasJson" value={json} />
      <div>
        <label className="label" htmlFor="manutencaoDeId">É a manutenção de qual aplicação?</label>
        <select id="manutencaoDeId" name="manutencaoDeId" className="input" defaultValue={aplicacaoId ?? ""}>
          <option value="">Não é manutenção</option>
          {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      </div>
      <div>
        <p className="label">Preço pelo prazo desde a última aplicação</p>
        <p className="mb-2 text-xs text-couro-400">Ex.: até 15 dias R$ 100; até 21 dias R$ 130. Depois disso, o sistema pede uma aplicação nova.</p>
        <div className="space-y-2">
          {faixas.map((f, i) => (
            <div key={i} className="grid grid-cols-[auto_80px_auto_1fr_auto] items-center gap-2 text-sm">
              <span>Até</span>
              <input className="input" value={f.dias} onChange={(e) => setFaixas((fs) => fs.map((x, j) => (j === i ? { ...x, dias: e.target.value } : x)))} inputMode="numeric" aria-label="Dias" />
              <span>dias: R$</span>
              <input className="input" value={f.preco} onChange={(e) => setFaixas((fs) => fs.map((x, j) => (j === i ? { ...x, preco: e.target.value } : x)))} inputMode="decimal" aria-label="Preço" />
              <button type="button" onClick={() => setFaixas((fs) => fs.filter((_, j) => j !== i))} className="rounded-lg p-2 text-couro-300 hover:text-poste-vermelho" aria-label="Remover faixa">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setFaixas((fs) => [...fs, { dias: "", preco: "" }])} className="btn-secundario btn-pequeno mt-2">
          <Plus className="size-3.5" /> Adicionar faixa
        </button>
      </div>
    </div>
  );
}

type Insumo = { produtoId: string; quantidade: string };

/** Material gasto no serviço (fração da unidade do produto), para o custo e a margem. */
export function InsumosServico({
  inicial,
  produtos,
}: {
  inicial: { produtoId: string; quantidade: number }[];
  produtos: { id: string; nome: string; custoCentavos: number }[];
}) {
  const [linhas, setLinhas] = useState<Insumo[]>(inicial.map((i) => ({ produtoId: i.produtoId, quantidade: String(i.quantidade).replace(".", ",") })));
  const qtd = (t: string) => Number(t.replace(",", "."));
  const custo = linhas.reduce((s, l) => s + (produtos.find((p) => p.id === l.produtoId)?.custoCentavos ?? 0) * (qtd(l.quantidade) || 0), 0);
  const json = JSON.stringify(linhas.filter((l) => l.produtoId && qtd(l.quantidade) > 0).map((l) => ({ produtoId: l.produtoId, quantidade: qtd(l.quantidade) })));
  if (produtos.length === 0) return <p className="text-sm text-couro-400">Cadastre os produtos (com o custo) em Produtos e estoque para calcular o custo do serviço.</p>;
  return (
    <div>
      <input type="hidden" name="insumosJson" value={json} />
      <p className="mb-2 text-xs text-couro-400">Quanto de cada produto vai em um atendimento. Ex.: 0,25 = um quarto do frasco.</p>
      <div className="space-y-2">
        {linhas.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_auto] gap-2">
            <select className="input" value={l.produtoId} onChange={(e) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, produtoId: e.target.value } : x)))} aria-label="Produto">
              <option value="">Escolha o produto</option>
              {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} (custo R$ {reais(p.custoCentavos)})</option>)}
            </select>
            <input className="input" value={l.quantidade} onChange={(e) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, quantidade: e.target.value } : x)))} inputMode="decimal" placeholder="0,5" aria-label="Quantidade" />
            <button type="button" onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))} className="rounded-lg p-2 text-couro-300 hover:text-poste-vermelho" aria-label="Remover material">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button type="button" onClick={() => setLinhas((ls) => [...ls, { produtoId: "", quantidade: "" }])} className="btn-secundario btn-pequeno">
          <Plus className="size-3.5" /> Adicionar material
        </button>
        <span className="text-sm">Custo por atendimento: <strong>R$ {reais(Math.round(custo))}</strong></span>
      </div>
    </div>
  );
}
