import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { diaLocal } from "./tempo";

type Tx = Prisma.TransactionClient;

// Sessão usada = item de comanda (aberta ou fechada, não cancelada) ligado ao pacote da cliente.
const sessaoValida = { comanda: { status: { not: "CANCELADA" } } } satisfies Prisma.ComandaItemWhereInput;

/** Pacotes ativos do cliente, com sessões usadas e restantes. Inclui vencidos e esgotados (para o histórico). */
export async function pacotesDaCliente(clienteId: string, tx: Tx | typeof db = db) {
  const pacotes = await tx.pacoteCliente.findMany({
    where: { clienteId, status: "ATIVO" },
    include: { pacote: { select: { nome: true } }, _count: { select: { sessoesUsadas: { where: sessaoValida } } } },
    orderBy: { criadoEm: "asc" },
  });
  const hoje = diaLocal();
  return pacotes.map((p) => {
    const usadas = p._count.sessoesUsadas;
    const vencido = !!p.validoAte && p.validoAte < hoje;
    return { ...p, usadas, restantes: Math.max(0, p.sessoes - usadas), vencido, disponivel: !vencido && usadas < p.sessoes };
  });
}

/** Pacote do cliente que cobre esse serviço agora (o mais antigo primeiro), se houver. */
export async function pacoteParaServico(tx: Tx, clienteId: string, servicoId: string) {
  const pacotes = await pacotesDaCliente(clienteId, tx);
  return pacotes.find((p) => p.servicoId === servicoId && p.disponivel) ?? null;
}

/** O item não é cobrado na comanda (incluso no plano ou sessão de pacote). */
export function itemSemCobranca(i: { cobertoPorPlano: boolean; pacoteClienteId?: string | null }) {
  return i.cobertoPorPlano || !!i.pacoteClienteId;
}
