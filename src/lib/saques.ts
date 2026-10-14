import { ErroAsaas, type Transferencia, buscarTransferencia, saldoDaSubconta, transferirPix } from "./asaas";
import { db } from "./db";
import { somenteDigitos } from "./formato";
import { diaDaSemana, diaLocal } from "./tempo";

// Saque por Pix da conta de recebimento do salão (subconta Asaas) para a conta do dono.
// Todo saque nasce aqui (status CRIANDO) antes de ir ao Asaas; a validação de saque do Asaas
// (/api/asaas/saque) só aprova transferências que existem nesta tabela com o mesmo valor e chave.

export class ErroSaque extends Error {}

export const TIPOS_CHAVE = { CPF: "CPF", CNPJ: "CNPJ", EMAIL: "E-mail", PHONE: "Celular", EVP: "Chave aleatória" } as const;
export type TipoChave = keyof typeof TIPOS_CHAVE;

export const STATUS_SAQUE: Record<string, { r: string; t: "verde" | "latao" | "vermelho" | "neutro" }> = {
  CRIANDO: { r: "Enviando", t: "latao" },
  PENDING: { r: "Em processamento", t: "latao" },
  BANK_PROCESSING: { r: "Em processamento", t: "latao" },
  DONE: { r: "Na sua conta", t: "verde" },
  CANCELLED: { r: "Cancelado", t: "neutro" },
  FAILED: { r: "Falhou", t: "vermelho" },
  ERRO: { r: "Não enviado", t: "vermelho" },
};
const EM_ANDAMENTO = ["CRIANDO", "PENDING", "BANK_PROCESSING"];

export const SAQUE_MINIMO_CENTAVOS = 100;
const MINIMO_AUTOMATICO_CENTAVOS = 1000;

/** Confere o formato da chave Pix e devolve como o Asaas espera. */
export function normalizarChavePix(tipo: string, chave: string): string {
  const c = chave.trim();
  switch (tipo) {
    case "CPF":
      if (somenteDigitos(c).length !== 11) throw new ErroSaque("CPF da chave Pix deve ter 11 números.");
      return somenteDigitos(c);
    case "CNPJ":
      if (somenteDigitos(c).length !== 14) throw new ErroSaque("CNPJ da chave Pix deve ter 14 números.");
      return somenteDigitos(c);
    case "EMAIL":
      if (!/^\S+@\S+\.\S+$/.test(c)) throw new ErroSaque("E-mail da chave Pix inválido.");
      return c.toLowerCase();
    case "PHONE": {
      let d = somenteDigitos(c);
      if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
      if (d.length !== 11) throw new ErroSaque("Celular da chave Pix: informe DDD + número (11 números).");
      return d;
    }
    case "EVP":
      if (!/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(c)) throw new ErroSaque("Chave aleatória inválida.");
      return c.toLowerCase();
    default:
      throw new ErroSaque("Escolha o tipo da chave Pix.");
  }
}

export function mascararChave(tipo: string, chave: string) {
  if (tipo === "CPF") return `***.${chave.slice(3, 6)}.${chave.slice(6, 9)}-**`;
  if (tipo === "CNPJ") return `**.${chave.slice(2, 5)}.${chave.slice(5, 8)}/${chave.slice(8, 12)}-**`;
  if (tipo === "PHONE") return `(${chave.slice(0, 2)}) *****-${chave.slice(7)}`;
  return chave;
}

/**
 * Pede um saque por Pix. Sem valor, saca todo o saldo disponível.
 * Um saque por vez por salão (trava no banco), para dois cliques não virarem dois saques.
 */
export async function sacar(params: { salaoId: string; valorCentavos?: number | null; automatico?: boolean; pedidoPor?: string | null }) {
  const b = await db.salao.findUniqueOrThrow({ where: { id: params.salaoId } });
  if (!b.asaasApiKey || b.asaasStatus !== "APPROVED") throw new ErroSaque("A conta de recebimento ainda não está aprovada.");
  if (!b.saqueChavePix || !b.saqueTipoChave) throw new ErroSaque("Cadastre a chave Pix que vai receber os saques.");

  const saldo = Math.floor((await saldoDaSubconta(b.asaasApiKey)) * 100 + 1e-6);
  const valor = params.valorCentavos ?? saldo;
  if (valor < SAQUE_MINIMO_CENTAVOS) throw new ErroSaque(saldo < SAQUE_MINIMO_CENTAVOS ? "Ainda não tem saldo para sacar." : "O valor mínimo do saque é R$ 1,00.");
  if (valor > saldo) throw new ErroSaque("O valor é maior que o saldo disponível.");

  const saque = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`saque:${b.id}`}))`;
    const andamento = await tx.saque.findFirst({ where: { salaoId: b.id, status: "CRIANDO", criadoEm: { gt: new Date(Date.now() - 10 * 60_000) } } });
    if (andamento) throw new ErroSaque("Já tem um saque sendo enviado. Espere alguns segundos.");
    return tx.saque.create({
      data: {
        salaoId: b.id,
        valorCentavos: valor,
        chavePix: b.saqueChavePix!,
        tipoChave: b.saqueTipoChave!,
        automatico: !!params.automatico,
        pedidoPor: params.pedidoPor ?? null,
      },
    });
  });

  try {
    const t = await transferirPix(
      {
        value: valor / 100,
        pixAddressKey: saque.chavePix,
        pixAddressKeyType: saque.tipoChave,
        description: `Saque ${b.nome} (Klareza Beauty)`.slice(0, 140),
        externalReference: saque.id,
      },
      b.asaasApiKey,
    );
    return await aplicarTransferencia(saque.id, t);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao enviar o saque.";
    // Sem resposta do Asaas a transferência pode ter sido criada: fica "Enviando" e a validação/consulta resolve depois.
    const semResposta = e instanceof ErroAsaas && /falar com o Asaas|instabilidade/.test(msg);
    if (!semResposta) await db.saque.update({ where: { id: saque.id }, data: { status: "ERRO", erro: msg.slice(0, 300) } });
    throw new ErroSaque(msg);
  }
}

async function aplicarTransferencia(saqueId: string, t: Transferencia) {
  return db.saque.update({
    where: { id: saqueId },
    data: {
      asaasId: t.id,
      status: t.status ?? "PENDING",
      taxaCentavos: t.transferFee !== undefined ? Math.round(t.transferFee * 100) : undefined,
      erro: t.failReason ?? null,
    },
  });
}

/** Atualiza a situação dos saques em andamento consultando o Asaas. */
export async function atualizarSaques(salaoId: string) {
  const b = await db.salao.findUnique({ where: { id: salaoId }, select: { asaasApiKey: true } });
  if (!b?.asaasApiKey) return;
  const abertos = await db.saque.findMany({ where: { salaoId, status: { in: EM_ANDAMENTO } } });
  for (const s of abertos) {
    if (!s.asaasId) {
      if (s.criadoEm < new Date(Date.now() - 30 * 60_000))
        await db.saque.update({ where: { id: s.id }, data: { status: "ERRO", erro: "O Asaas não confirmou o saque. Confira o extrato antes de tentar de novo." } });
      continue;
    }
    try {
      await aplicarTransferencia(s.id, await buscarTransferencia(s.asaasId, b.asaasApiKey));
    } catch {
      // tenta de novo na próxima vez
    }
  }
}

/**
 * Validação de saque pedida pelo Asaas: só aprova o que o Klareza Beauty pediu,
 * com o mesmo valor e a mesma chave Pix, e ainda não concluído.
 */
export async function validarSaque(t: { id?: string; value?: number; externalReference?: string | null; pixAddressKey?: string | null; bankAccount?: { pixAddressKey?: string | null } | null }) {
  if (!t.externalReference) return { aprovado: false, motivo: "Saque não foi pedido pelo Klareza Beauty." };
  const s = await db.saque.findUnique({ where: { id: t.externalReference } });
  if (!s || !EM_ANDAMENTO.includes(s.status)) return { aprovado: false, motivo: "Saque não encontrado no Klareza Beauty." };
  if (s.criadoEm < new Date(Date.now() - 30 * 60_000)) return { aprovado: false, motivo: "Pedido de saque expirado." };
  if (t.value === undefined || Math.round(t.value * 100) !== s.valorCentavos) return { aprovado: false, motivo: "Valor diferente do pedido." };
  const chave = t.pixAddressKey ?? t.bankAccount?.pixAddressKey;
  if (chave && chave.replace(/^\+55/, "").toLowerCase() !== s.chavePix.toLowerCase()) return { aprovado: false, motivo: "Chave Pix diferente da cadastrada." };
  if (t.id && s.asaasId && t.id !== s.asaasId) return { aprovado: false, motivo: "Transferência diferente da registrada." };
  if (t.id && !s.asaasId) await db.saque.update({ where: { id: s.id }, data: { asaasId: t.id, status: "PENDING" } });
  return { aprovado: true, motivo: null };
}

/** Saque automático (cron diário): diário todo dia, semanal às segundas. Saca todo o saldo disponível. */
export async function saquesAutomaticos() {
  const segunda = diaDaSemana(diaLocal()) === 1;
  const contas = await db.salao.findMany({
    where: {
      asaasApiKey: { not: null },
      asaasStatus: "APPROVED",
      saqueChavePix: { not: null },
      saqueAutomatico: segunda ? { in: ["DIARIO", "SEMANAL"] } : "DIARIO",
    },
    select: { id: true, asaasApiKey: true },
  });
  let feitos = 0;
  for (const c of contas) {
    try {
      const saldo = Math.floor((await saldoDaSubconta(c.asaasApiKey!)) * 100 + 1e-6);
      if (saldo < MINIMO_AUTOMATICO_CENTAVOS) continue;
      await sacar({ salaoId: c.id, valorCentavos: saldo, automatico: true });
      feitos++;
    } catch {
      // segue para a próxima; o erro fica registrado no saque (quando chegou a ser criado)
    }
  }
  return feitos;
}
