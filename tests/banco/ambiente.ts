import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { cifrar } from "../../src/lib/cripto";
import { db } from "../../src/lib/db";

// Os testes de banco apagam e criam dados. Por isso só rodam contra um banco local com "teste" no nome
// (ex.: klareza_teste). Nunca contra o banco de produção.
const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1):\d+\/[\w-]*teste/.test(url))
  throw new Error("Os testes de banco só rodam com DATABASE_URL de um banco local com 'teste' no nome (ex.: klareza_teste).");

process.env.AUTH_SECRET ??= "teste-auth-secret-0123456789";
process.env.ASAAS_API_KEY = "chave-da-conta-principal-de-teste";

// ---------- Asaas falso (HTTP local) ----------
// O cliente do Asaas aponta para ASAAS_URL, então os testes passam pelo caminho real de rede.

export const pagamentosNoAsaas = new Map<string, Record<string, unknown>>();
let asaasFora = false;
let servidor: Server | null = null;

export function derrubarAsaas(valor: boolean) {
  asaasFora = valor;
}

export async function subirAsaasFalso() {
  servidor = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (asaasFora) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ errors: [{ description: "indisponível" }] }));
    }
    const id = req.url?.match(/^\/payments\/([^/?]+)/)?.[1];
    const pagamento = id ? pagamentosNoAsaas.get(decodeURIComponent(id)) : undefined;
    if (!pagamento) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ errors: [{ description: "Cobrança não encontrada" }] }));
    }
    res.end(JSON.stringify(pagamento));
  });
  await new Promise<void>((ok) => servidor!.listen(0, "127.0.0.1", ok));
  process.env.ASAAS_URL = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
}

export async function desligarAsaasFalso() {
  if (!servidor) return;
  servidor.closeAllConnections();
  await new Promise((ok) => servidor!.close(ok));
  servidor = null;
}

// ---------- Fábricas de dados ----------

const saloesCriados: string[] = [];
let sequencia = 0;

function sufixo() {
  return `${Date.now().toString(36)}${(++sequencia).toString(36)}${randomBytes(2).toString("hex")}`;
}

/** Salão com uma unidade. Todo salão criado aqui é apagado em `apagarSaloesDeTeste`. */
export async function criarSalao(dados: Partial<{ plano: string; cashbackPct: number; sinalPct: number; asaasApiKey: string | null; asaasStatus: string | null; asaasAssinaturaSistema: string | null; pagoAte: string | null; ciclo: string; cobrancaSistemaCartao: boolean }> = {}) {
  const s = sufixo();
  const salao = await db.salao.create({
    data: {
      nome: `Salão ${s}`,
      slug: `teste-${s}`,
      plano: "CIDADE",
      asaasStatus: "APPROVED",
      asaasApiKey: cifrar(`chave-subconta-${s}`),
      ...dados,
    },
  });
  saloesCriados.push(salao.id);
  const filial = await db.filial.create({ data: { salaoId: salao.id, nome: "Matriz" } });
  return { salao, filial };
}

export async function criarCliente(salaoId: string, nome = "Cliente de teste") {
  return db.cliente.create({ data: { salaoId, nome, telefone: `11${sufixo().replace(/\D/g, "").padEnd(9, "7").slice(0, 9)}` } });
}

export async function criarProfissional(salaoId: string, filialId: string, nome = "Profissional de teste", comissaoPct = 50) {
  return db.profissional.create({ data: { salaoId, filialId, nome, comissaoPct } });
}

export async function criarServico(salaoId: string, nome = "Serviço de teste", precoCentavos = 10000) {
  return db.servico.create({ data: { salaoId, nome, precoCentavos, duracaoMin: 60 } });
}

/** Apaga todos os salões criados pelos testes (o banco apaga o resto em cascata). */
export async function apagarSaloesDeTeste() {
  if (saloesCriados.length) await db.salao.deleteMany({ where: { id: { in: saloesCriados } } });
  saloesCriados.length = 0;
}
