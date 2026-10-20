import type { Prisma } from "@prisma/client";
import { temConflito } from "./agenda";
import { ErroAsaas, criarCliente, criarCobrancaPix, qrCodePix } from "./asaas";
import { cpfValido } from "./clubeOnline";
import { db } from "./db";
import { temRecurso } from "./planosSistema";
import { diaLocal } from "./tempo";

type Tx = Prisma.TransactionClient | typeof db;

// Sinal antifalta: no agendamento online o cliente paga uma parte por Pix para garantir o horário.
// Pago: vira desconto na comanda. Cancelou no prazo (ou o salão cancelou): vira crédito do cliente.
// Faltou: o salão fica com o sinal.

export const SINAL_MINIMO_CENTAVOS = 500; // o Asaas não cobra menos de R$ 5,00

export class ErroSinal extends Error {}

/** O salão cobra sinal no agendamento online? (conta de recebimento aprovada e % definida) */
export function sinalAtivo(b: { plano: string; sinalPct: number; asaasApiKey: string | null; asaasStatus: string | null }) {
  return temRecurso(b.plano, "sinal") && b.sinalPct > 0 && !!b.asaasApiKey && b.asaasStatus === "APPROVED";
}

/** Valor do sinal; abaixo do mínimo do Asaas não cobra. */
export function valorDoSinal(totalCentavos: number, pct: number) {
  const v = Math.round((totalCentavos * pct) / 100);
  return v >= SINAL_MINIMO_CENTAVOS ? v : 0;
}

/** Cria a cobrança Pix do sinal e guarda QR Code e "copia e cola" no 1º agendamento do grupo. */
export async function gerarCobrancaDoSinal(p: { salaoId: string; agendamentoId: string; clienteId: string; valorCentavos: number; cpf: string | null }) {
  const [b, cliente, config] = await Promise.all([
    db.salao.findUniqueOrThrow({ where: { id: p.salaoId } }),
    db.cliente.findUniqueOrThrow({ where: { id: p.clienteId } }),
    db.configSistema.findUnique({ where: { id: "geral" } }),
  ]);
  if (!sinalAtivo(b)) throw new ErroSinal("Sinal não está ligado neste salão.");
  const cpf = p.cpf ?? cliente.cpf;
  if (!cpf || !cpfValido(cpf)) throw new ErroSinal("Informe um CPF válido para gerar o Pix do sinal.");
  const chave = b.asaasApiKey!;
  let asaasClienteId = cliente.asaasClienteId;
  if (!asaasClienteId || cliente.cpf !== cpf) {
    asaasClienteId = (await criarCliente({ name: cliente.nome, cpfCnpj: cpf, mobilePhone: cliente.telefone, email: cliente.email ?? undefined, externalReference: cliente.id }, chave)).id;
    await db.cliente.update({ where: { id: cliente.id }, data: { cpf, asaasClienteId } });
  }
  const taxa = config?.taxaPlataformaPct ?? 0;
  const split = taxa > 0 && config?.asaasWalletId ? [{ walletId: config.asaasWalletId, percentualValue: taxa }] : undefined;
  const cobranca = await criarCobrancaPix(
    {
      customer: asaasClienteId,
      value: p.valorCentavos / 100,
      dueDate: diaLocal(),
      description: `Sinal do agendamento · ${b.nome}`,
      externalReference: p.agendamentoId,
      split,
    },
    chave,
  );
  const qr = await qrCodePix(cobranca.id, chave).catch(() => null);
  return db.agendamento.update({
    where: { id: p.agendamentoId },
    data: {
      sinalCentavos: p.valorCentavos,
      sinalAsaasId: cobranca.id,
      sinalPix: qr?.payload ?? null,
      sinalQrCode: qr?.encodedImage ?? null,
      sinalLink: cobranca.invoiceUrl ?? null,
    },
  });
}

/** Agendamentos do mesmo atendimento (grupo) do agendamento que carrega o sinal. */
function doAtendimento(ag: { id: string; grupo: string | null }) {
  return ag.grupo ? { grupo: ag.grupo } : { id: ag.id };
}

/**
 * Sinal pago (aviso do Asaas, já conferido). Se o horário ainda está reservado, confirma.
 * Se expirou e alguém pegou o horário, o valor vira crédito do cliente.
 */
export async function sinalPago(agendamentoId: string) {
  return db.$transaction(async (tx) => {
    const ag = await tx.agendamento.findUniqueOrThrow({ where: { id: agendamentoId } });
    if (ag.sinalPagoEm) return "ja-registrado";
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ag.salaoId}))`;
    const grupo = await tx.agendamento.findMany({ where: doAtendimento(ag) });
    let livre = grupo.every((a) => a.status === "AGUARDANDO_SINAL");
    if (!livre && grupo.every((a) => a.status === "CANCELADO") && ag.inicio > new Date()) {
      // pagou depois do prazo: se o horário ainda está livre, confirma mesmo assim
      livre = true;
      for (const a of grupo) if (await temConflito(a.profissionalId, a.inicio, a.fim, tx, a.id)) livre = false;
    }
    await tx.agendamento.update({ where: { id: ag.id }, data: { sinalPagoEm: new Date() } });
    if (livre) {
      await tx.agendamento.updateMany({ where: doAtendimento(ag), data: { status: "AGENDADO" } });
      return "confirmado";
    }
    await creditarSinal(tx, ag.id);
    return "credito";
  });
}

/** Cancelamento: sinal pago e ainda não usado vira crédito (cashback) do cliente. */
export async function creditarSinal(tx: Tx, agendamentoId: string) {
  const ag = await tx.agendamento.findUnique({ where: { id: agendamentoId } });
  if (!ag?.sinalPagoEm || ag.sinalDestino || !ag.sinalCentavos) return 0;
  // só um crédito por sinal, mesmo com dois cancelamentos ao mesmo tempo
  const r = await tx.agendamento.updateMany({ where: { id: ag.id, sinalDestino: null }, data: { sinalDestino: "CREDITO" } });
  if (r.count === 0) return 0;
  await tx.cliente.update({ where: { id: ag.clienteId }, data: { saldoCashbackCentavos: { increment: ag.sinalCentavos } } });
  return ag.sinalCentavos;
}

/** O 1º agendamento do grupo, que é quem carrega o sinal. */
export async function agendamentoDoSinal(tx: Tx, ag: { id: string; grupo: string | null }) {
  return tx.agendamento.findFirst({ where: { ...doAtendimento(ag), sinalCentavos: { not: null } }, orderBy: { inicio: "asc" } });
}

/** Mudança de status no painel: cancelado devolve como crédito; faltou retém; voltar atrás desfaz a retenção. */
export async function ajustarSinalPeloStatus(tx: Tx, ag: { id: string; grupo: string | null }, status: string) {
  const comSinal = await agendamentoDoSinal(tx, ag);
  if (!comSinal?.sinalPagoEm) return;
  if (status === "CANCELADO") await creditarSinal(tx, comSinal.id);
  else if (status === "FALTOU") await tx.agendamento.updateMany({ where: { id: comSinal.id, sinalDestino: null }, data: { sinalDestino: "RETIDO" } });
  else if (comSinal.sinalDestino === "RETIDO") await tx.agendamento.update({ where: { id: comSinal.id }, data: { sinalDestino: null } });
}

export { ErroAsaas };
