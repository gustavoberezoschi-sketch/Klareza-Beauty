import type { Prisma } from "@prisma/client";
import { db } from "./db";

type Tx = Prisma.TransactionClient | typeof db;

/** Soma (ou subtrai) do estoque de um produto numa unidade e registra no histórico. */
export async function movimentarEstoque(
  tx: Tx,
  m: { produtoId: string; filialId: string; quantidade: number; tipo: string; observacao?: string | null },
) {
  await tx.estoqueFilial.upsert({
    where: { produtoId_filialId: { produtoId: m.produtoId, filialId: m.filialId } },
    update: { quantidade: { increment: m.quantidade } },
    create: { produtoId: m.produtoId, filialId: m.filialId, quantidade: m.quantidade },
  });
  await tx.movimentoEstoque.create({
    data: { produtoId: m.produtoId, filialId: m.filialId, quantidade: m.quantidade, tipo: m.tipo, observacao: m.observacao ?? null },
  });
}

/** Estoque de cada produto numa unidade (ou somado em todas, se filialId for null). */
export async function estoquePorProduto(salaoId: string, filialId: string | null) {
  const linhas = await db.estoqueFilial.findMany({
    where: { produto: { salaoId }, ...(filialId ? { filialId } : { filial: { ativo: true } }) },
    select: { produtoId: true, filialId: true, quantidade: true, minimo: true },
  });
  const mapa = new Map<string, { quantidade: number; minimo: number; baixo: boolean }>();
  for (const l of linhas) {
    const atual = mapa.get(l.produtoId) ?? { quantidade: 0, minimo: 0, baixo: false };
    atual.quantidade += l.quantidade;
    atual.minimo += l.minimo;
    // Com todas as unidades, "baixo" se qualquer unidade estiver no mínimo ou abaixo.
    if (l.quantidade <= l.minimo) atual.baixo = true;
    mapa.set(l.produtoId, atual);
  }
  return (produtoId: string) => mapa.get(produtoId) ?? { quantidade: 0, minimo: 0, baixo: true };
}
