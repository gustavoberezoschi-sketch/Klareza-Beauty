import { Prisma } from "@prisma/client";
import { db } from "./db";

type Tx = Prisma.TransactionClient | typeof db;

// "Indique uma amiga": cada cliente tem um código. Quem chega com o código e faz o primeiro
// atendimento pago gera crédito (cashback) para as duas. O valor é definido pelo salão (0 = desligado).

const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O e 1/I, para ninguém digitar errado

function sufixo(n = 4) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => LETRAS[b % LETRAS.length]).join("");
}

function prefixo(nome: string) {
  const primeiro = nome.split(" ")[0] ?? "";
  return primeiro.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 8) || "AMIGA";
}

export function normalizarCodigo(codigo: string) {
  return codigo.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
}

/** Código do cliente; cria na primeira vez. */
export async function codigoDoCliente(clienteId: string) {
  const c = await db.cliente.findUniqueOrThrow({ where: { id: clienteId }, select: { codigoIndicacao: true, nome: true } });
  if (c.codigoIndicacao) return c.codigoIndicacao;
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = `${prefixo(c.nome)}${sufixo()}`;
    try {
      const r = await db.cliente.updateMany({ where: { id: clienteId, codigoIndicacao: null }, data: { codigoIndicacao: codigo } });
      if (r.count) return codigo;
      return (await db.cliente.findUniqueOrThrow({ where: { id: clienteId }, select: { codigoIndicacao: true } })).codigoIndicacao!;
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e; // código repetido: tenta outro
    }
  }
  throw new Error("Não foi possível gerar o código de indicação.");
}

/** Cliente novo chegou com um código: guarda quem indicou (não vale indicar a si mesmo). */
export async function registrarIndicacao(tx: Tx, salaoId: string, clienteId: string, codigo: string | null | undefined) {
  const c = codigo ? normalizarCodigo(codigo) : "";
  if (!c) return false;
  const quem = await tx.cliente.findUnique({ where: { salaoId_codigoIndicacao: { salaoId, codigoIndicacao: c } }, select: { id: true } });
  if (!quem || quem.id === clienteId) return false;
  const r = await tx.cliente.updateMany({ where: { id: clienteId, indicadoPorId: null }, data: { indicadoPorId: quem.id } });
  return r.count > 0;
}

/** Primeiro atendimento pago de quem foi indicado: crédito para as duas (uma vez só). */
export async function creditarIndicacao(tx: Tx, clienteId: string, creditoCentavos: number) {
  if (creditoCentavos <= 0) return false;
  const c = await tx.cliente.findUnique({ where: { id: clienteId }, select: { indicadoPorId: true, indicacaoCreditadaEm: true } });
  if (!c?.indicadoPorId || c.indicacaoCreditadaEm) return false;
  const r = await tx.cliente.updateMany({ where: { id: clienteId, indicacaoCreditadaEm: null }, data: { indicacaoCreditadaEm: new Date(), saldoCashbackCentavos: { increment: creditoCentavos } } });
  if (!r.count) return false;
  await tx.cliente.update({ where: { id: c.indicadoPorId }, data: { saldoCashbackCentavos: { increment: creditoCentavos } } });
  return true;
}
