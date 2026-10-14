import { cookies } from "next/headers";
import type { Sessao } from "./auth";
import { db } from "./db";

const nomeCookie = (salaoId: string) => `filial_${salaoId}`;

export type ContextoFilial = {
  filiais: { id: string; nome: string; endereco: string | null; ativo: boolean }[];
  /** Unidade escolhida no painel; null = "Todas as unidades". */
  atual: { id: string; nome: string } | null;
};

/**
 * Unidade em que o painel está trabalhando. Com uma unidade só, é sempre ela.
 * O profissional fica preso à unidade dele.
 */
export async function filialDoPainel(sessao: Sessao): Promise<ContextoFilial> {
  const filiais = await db.filial.findMany({
    where: { salaoId: sessao.salaoId },
    orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { criadoEm: "asc" }],
    select: { id: true, nome: true, endereco: true, ativo: true },
  });
  const ativas = filiais.filter((f) => f.ativo);

  if (sessao.profissionalId) {
    const b = await db.profissional.findUnique({ where: { id: sessao.profissionalId }, select: { filialId: true } });
    return { filiais, atual: filiais.find((f) => f.id === b?.filialId) ?? null };
  }
  if (ativas.length <= 1) return { filiais, atual: ativas[0] ?? filiais[0] ?? null };

  const escolhida = (await cookies()).get(nomeCookie(sessao.salaoId))?.value;
  return { filiais, atual: ativas.find((f) => f.id === escolhida) ?? null };
}

export async function escolherFilial(salaoId: string, filialId: string | null) {
  const c = await cookies();
  if (filialId) c.set(nomeCookie(salaoId), filialId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 365 * 86400 });
  else c.delete(nomeCookie(salaoId));
}

/** Filtro Prisma para registros que têm filialId (agendamentos, comandas, profissionais...). */
export function naFilial(ctx: ContextoFilial) {
  return ctx.atual ? { filialId: ctx.atual.id } : {};
}

/** Primeira unidade ativa (para cadastros que precisam de uma). */
export async function filialPadrao(salaoId: string) {
  return db.filial.findFirstOrThrow({ where: { salaoId }, orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { criadoEm: "asc" }] });
}
