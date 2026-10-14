import { db } from "./db";
import { diaLocal, somarDias, somarMeses } from "./tempo";

// Planos do Klareza Beauty. Para mudar preço ou limite, altere só aqui.
// Base: Bairro. Cidade = 2x, Nacional = 3,5x; anual = 10 mensalidades (2 meses grátis).
export const PLANOS_SISTEMA = {
  BAIRRO: { nome: "Bairro", mensal: 14990, anual: 149900, unidades: 1, assinantes: 300 },
  CIDADE: { nome: "Cidade", mensal: 29990, anual: 299900, unidades: 2, assinantes: 500 },
  NACIONAL: { nome: "Nacional", mensal: 52490, anual: 524900, unidades: null, assinantes: null },
} as const satisfies Record<string, { nome: string; mensal: number; anual: number; unidades: number | null; assinantes: number | null }>;

export type CodigoPlano = keyof typeof PLANOS_SISTEMA;
export const CODIGOS_PLANO = Object.keys(PLANOS_SISTEMA) as CodigoPlano[];
export const DIAS_TOLERANCIA = 10; // depois do vencimento, antes de considerar atrasada

export function planoDe(codigo: string) {
  return PLANOS_SISTEMA[(codigo in PLANOS_SISTEMA ? codigo : "BAIRRO") as CodigoPlano];
}

export function valorDoCiclo(codigo: string, ciclo: string) {
  const p = planoDe(codigo);
  return ciclo === "ANUAL" ? p.anual : p.mensal;
}

/** Próximo vencimento a partir de hoje (ou do vencimento atual, se ainda estiver em dia). */
export function proximoVencimento(pagoAte: string | null, ciclo: string) {
  const hoje = diaLocal();
  const base = pagoAte && pagoAte > hoje ? pagoAte : hoje;
  return somarMeses(base, ciclo === "ANUAL" ? 12 : 1);
}

export type Situacao = "SUSPENSA" | "ATRASADA" | "VENCENDO" | "EM_DIA" | "SEM_CONTROLE";

export function situacaoDaSalao(b: { pagoAte: string | null; suspensa: boolean }): Situacao {
  if (b.suspensa) return "SUSPENSA";
  if (!b.pagoAte) return "SEM_CONTROLE";
  const hoje = diaLocal();
  if (b.pagoAte < hoje) return "ATRASADA";
  if (b.pagoAte <= somarDias(hoje, 5)) return "VENCENDO";
  return "EM_DIA";
}

/** Quanto do plano o salão está usando. */
/** Assinaturas que o cliente cancelou e cujo período pago já acabou passam a "CANCELADA". */
export async function encerrarCanceladasVencidas(salaoId: string) {
  await db.assinatura.updateMany({ where: { salaoId, status: "ATIVA", canceladaEm: { not: null }, pagoAte: { lt: diaLocal() } }, data: { status: "CANCELADA" } });
}

export async function usoDoPlano(salaoId: string) {
  await encerrarCanceladasVencidas(salaoId);
  const [b, unidades, assinantes] = await Promise.all([
    db.salao.findUniqueOrThrow({ where: { id: salaoId }, select: { plano: true, ciclo: true, pagoAte: true, suspensa: true } }),
    db.filial.count({ where: { salaoId, ativo: true } }),
    db.assinatura.count({ where: { salaoId, status: "ATIVA" } }),
  ]);
  const plano = planoDe(b.plano);
  return { ...b, plano, codigo: b.plano as CodigoPlano, unidades, assinantes, situacao: situacaoDaSalao(b) };
}

export class LimiteDoPlano extends Error {}

/** Lança LimiteDoPlano se o salão não puder ter mais uma unidade ativa. */
export async function garantirVagaDeUnidade(salaoId: string) {
  const u = await usoDoPlano(salaoId);
  if (u.plano.unidades !== null && u.unidades >= u.plano.unidades)
    throw new LimiteDoPlano(
      `O plano ${u.plano.nome} permite ${u.plano.unidades} unidade${u.plano.unidades > 1 ? "s" : ""}. Para abrir outra, mude de plano em Configurações → Meu plano.`,
    );
}

/** Lança LimiteDoPlano se o salão não puder ter mais um assinante ativo no clube. */
export async function garantirVagaDeAssinante(salaoId: string) {
  const u = await usoDoPlano(salaoId);
  if (u.plano.assinantes !== null && u.assinantes >= u.plano.assinantes)
    throw new LimiteDoPlano(
      `O plano ${u.plano.nome} permite até ${u.plano.assinantes} assinantes ativos no clube. Para cadastrar mais, mude de plano em Configurações → Meu plano.`,
    );
}
