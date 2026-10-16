import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { formatarDinheiro } from "./formato";
import { diaLocal } from "./tempo";

type Tx = Prisma.TransactionClient | typeof db;

/** Um serviço pedido, com a variação (opcional) e os adicionais escolhidos. */
export type ItemPedido = { servicoId: string; variacaoId?: string | null; adicionalIds?: string[] };

/** Cópia do que foi escolhido, guardada no agendamento (o preço do dia fica registrado). */
export type OpcaoEscolhida = { id: string; tipo: "VARIACAO" | "ADICIONAL"; nome: string; precoCentavos: number; duracaoMin: number };

export type FaixaManutencao = { ateDias: number; precoCentavos: number };

export class ErroPedido extends Error {}

/** Lê e valida as faixas guardadas no serviço (JSON). Devolve em ordem crescente de dias. */
export function lerFaixas(valor: unknown): FaixaManutencao[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter(
      (f): f is FaixaManutencao =>
        !!f && Number.isInteger((f as FaixaManutencao).ateDias) && (f as FaixaManutencao).ateDias > 0 && Number.isInteger((f as FaixaManutencao).precoCentavos) && (f as FaixaManutencao).precoCentavos >= 0,
    )
    .sort((a, b) => a.ateDias - b.ateDias);
}

/** "Até 15 dias: R$ 100,00 · até 21 dias: R$ 130,00 · depois: aplicação nova" */
export function descreverFaixas(faixas: FaixaManutencao[]) {
  if (!faixas.length) return "";
  return [...faixas.map((f, i) => `${i === 0 ? "Até" : "até"} ${f.ateDias} dias: ${formatarDinheiro(f.precoCentavos)}`), "depois: aplicação nova"].join(" · ");
}

function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 864e5);
}

/** Último dia em que o cliente fez a aplicação ou a manutenção (atendimento concluído ou comanda fechada). */
export async function ultimoAtendimento(clienteId: string, servicoIds: string[], tx: Tx = db): Promise<string | null> {
  const [ag, item] = await Promise.all([
    tx.agendamento.findFirst({
      where: { clienteId, servicoId: { in: servicoIds }, status: "CONCLUIDO" },
      orderBy: { inicio: "desc" },
      select: { inicio: true },
    }),
    tx.comandaItem.findFirst({
      where: { servicoId: { in: servicoIds }, comanda: { clienteId, status: "FECHADA" } },
      orderBy: { comanda: { fechadaEm: "desc" } },
      select: { comanda: { select: { fechadaEm: true } } },
    }),
  ]);
  const datas = [ag?.inicio, item?.comanda.fechadaEm].filter((d): d is Date => !!d).map((d) => diaLocal(d));
  return datas.length ? datas.sort().at(-1)! : null;
}

export type PrecoManutencao =
  | { tipo: "FAIXA"; dias: number; precoCentavos: number; faixa: FaixaManutencao }
  | { tipo: "VENCIDA"; dias: number | null; aplicacao: { id: string; nome: string; precoCentavos: number } | null };

/** Preço da manutenção pelo prazo desde a última aplicação/manutenção do cliente. */
export async function precoDaManutencao(
  servico: { id: string; manutencaoDeId: string | null; faixasManutencao: Prisma.JsonValue },
  clienteId: string,
  tx: Tx = db,
): Promise<PrecoManutencao | null> {
  const faixas = lerFaixas(servico.faixasManutencao);
  if (!faixas.length) return null;
  const ids = [servico.id, ...(servico.manutencaoDeId ? [servico.manutencaoDeId] : [])];
  const ultimo = await ultimoAtendimento(clienteId, ids, tx);
  const dias = ultimo ? diasEntre(ultimo, diaLocal()) : null;
  const faixa = dias === null ? undefined : faixas.find((f) => dias <= f.ateDias);
  if (faixa) return { tipo: "FAIXA", dias: dias!, precoCentavos: faixa.precoCentavos, faixa };
  const aplicacao = servico.manutencaoDeId
    ? await tx.servico.findUnique({ where: { id: servico.manutencaoDeId }, select: { id: true, nome: true, precoCentavos: true } })
    : null;
  return { tipo: "VENCIDA", dias, aplicacao };
}

const incluirServico = {
  profissionais: { select: { id: true } },
  opcoes: { where: { ativo: true }, orderBy: [{ ordem: "asc" as const }, { nome: "asc" as const }] },
};

/**
 * Confere o pedido (serviço, variação e adicionais do próprio serviço) e calcula duração e preço de cada item.
 * Com o cliente, aplica o preço da manutenção por prazo.
 * opcoes.manutencaoVencida = "erro": o cliente passou do prazo (agendamento online não aceita);
 * "aplicacao": cobra o preço da aplicação (comanda no balcão).
 */
export async function resolverItens(
  salaoId: string,
  itens: ItemPedido[],
  tx: Tx = db,
  opcoes: { clienteId?: string | null; manutencaoVencida?: "erro" | "aplicacao"; somenteOnline?: boolean } = {},
) {
  if (itens.length === 0) throw new ErroPedido("Escolha pelo menos um serviço.");
  const servicos = await tx.servico.findMany({
    where: { id: { in: itens.map((i) => i.servicoId) }, salaoId, ativo: true, ...(opcoes.somenteOnline ? { exibirOnline: true } : {}) },
    include: incluirServico,
  });
  return Promise.all(
    itens.map(async (item) => {
      const servico = servicos.find((s) => s.id === item.servicoId);
      if (!servico) throw new ErroPedido("Serviço indisponível.");
      const variacoes = servico.opcoes.filter((o) => o.tipo === "VARIACAO");
      const variacao = item.variacaoId ? variacoes.find((o) => o.id === item.variacaoId) : null;
      if (item.variacaoId && !variacao) throw new ErroPedido(`Escolha uma opção válida de ${servico.nome}.`);
      const adicionais = (item.adicionalIds ?? []).map((id) => {
        const a = servico.opcoes.find((o) => o.id === id && o.tipo === "ADICIONAL");
        if (!a) throw new ErroPedido(`Adicional inválido em ${servico.nome}.`);
        return a;
      });
      if (new Set(item.adicionalIds ?? []).size !== adicionais.length) throw new ErroPedido("Adicional repetido.");

      let base = variacao?.precoCentavos ?? servico.precoCentavos;
      let observacao: string | null = null;
      if (opcoes.clienteId) {
        const m = await precoDaManutencao(servico, opcoes.clienteId, tx);
        if (m?.tipo === "FAIXA") {
          base = m.precoCentavos;
          observacao = `${m.dias} dias desde a última`;
        } else if (m?.tipo === "VENCIDA") {
          const quando = m.dias === null ? "Não encontramos uma aplicação anterior aqui" : `Já se passaram ${m.dias} dias desde a última aplicação`;
          if (opcoes.manutencaoVencida === "erro")
            throw new ErroPedido(`${quando}, então a manutenção não vale mais.${m.aplicacao ? ` Agende "${m.aplicacao.nome}" (aplicação nova).` : " Agende uma aplicação nova."}`);
          if (m.aplicacao) {
            base = m.aplicacao.precoCentavos;
            observacao = "prazo vencido: valor de aplicação";
          }
        }
      }
      const escolhidas: OpcaoEscolhida[] = [
        ...(variacao ? [variacao] : []),
        ...adicionais,
      ].map((o) => ({ id: o.id, tipo: o.tipo as OpcaoEscolhida["tipo"], nome: o.nome, precoCentavos: o.precoCentavos, duracaoMin: o.duracaoMin }));
      const duracaoMin = (variacao?.duracaoMin ?? servico.duracaoMin) + adicionais.reduce((s, a) => s + a.duracaoMin, 0);
      const precoCentavos = base + adicionais.reduce((s, a) => s + a.precoCentavos, 0);
      return { servico, duracaoMin, precoCentavos, opcoes: escolhidas, descricao: descreverItem(servico.nome, escolhidas, observacao) };
    }),
  );
}

/** "Extensão de cílios · Volume russo + Remoção" */
export function descreverItem(nome: string, opcoes: Pick<OpcaoEscolhida, "tipo" | "nome">[] | null | undefined, observacao?: string | null) {
  const variacao = opcoes?.find((o) => o.tipo === "VARIACAO");
  const adicionais = opcoes?.filter((o) => o.tipo === "ADICIONAL") ?? [];
  return [`${nome}${variacao ? ` · ${variacao.nome}` : ""}`, ...adicionais.map((a) => a.nome)].join(" + ") + (observacao ? ` (${observacao})` : "");
}

/** Lê o JSON de opções guardado no agendamento. */
export function lerOpcoes(valor: unknown): OpcaoEscolhida[] {
  return Array.isArray(valor) ? (valor as OpcaoEscolhida[]).filter((o) => o && typeof o.nome === "string") : [];
}
