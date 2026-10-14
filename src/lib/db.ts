import { PrismaClient } from "@prisma/client";
import { limparVariavel } from "./env";

const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

function criarCliente() {
  const url = limparVariavel(process.env.DATABASE_URL);
  return new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
}

export const db = globalParaPrisma.prisma ?? criarCliente();

if (process.env.NODE_ENV !== "production") globalParaPrisma.prisma = db;
