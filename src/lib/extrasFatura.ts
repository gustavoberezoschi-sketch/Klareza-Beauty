import { ErroAsaas, alterarCobranca, buscarCobranca, criarCobranca, excluirCobranca, proximaCobrancaPendente } from "./asaas";
import { db } from "./db";
import { diaLocal, somarDias } from "./tempo";

// Extras na fatura: o assinante com cobrança automática faz um serviço ou leva um produto fora do plano
// e, em vez de pagar na hora, o valor entra na próxima cobrança do clube no Asaas.

export class ErroExtra extends Error {}

const reais = (centavos: number) => centavos / 100;

/** Trava por assinatura, para dois extras não somarem ao mesmo tempo na mesma cobrança. */
async function comTrava<T>(assinaturaId: string, fn: () => Promise<T>) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"extra:" + assinaturaId}))`;
      return fn();
    },
    { timeout: 60_000, maxWait: 30_000 },
  );
}

/** Assinatura que pode receber extras na fatura (cobrança automática ativa no Asaas). */
export async function assinaturaComFatura(clienteId: string, salaoId: string) {
  const salao = await db.salao.findUnique({ where: { id: salaoId }, select: { cobrancaOnlineClube: true, asaasApiKey: true } });
  if (!salao?.cobrancaOnlineClube || !salao.asaasApiKey) return null;
  return db.assinatura.findFirst({ where: { clienteId, salaoId, status: "ATIVA", asaasId: { not: null }, canceladaEm: null, pagoAte: { gte: diaLocal() } } });
}

/** Lança no Asaas um extra já registrado: soma na próxima cobrança da assinatura ou cria uma cobrança no mesmo vencimento. */
export async function lancarNaFatura(extraId: string) {
  const extra = await db.extraFatura.findUniqueOrThrow({
    where: { id: extraId },
    include: { assinatura: { include: { cliente: true } }, salao: { select: { asaasApiKey: true } } },
  });
  if (extra.asaasPagamentoId || extra.status !== "PENDENTE") return extra;
  const chave = extra.salao.asaasApiKey;
  const assinaturaId = extra.assinatura.asaasId;
  if (!chave || !assinaturaId) throw new ErroExtra("A assinatura deste cliente não tem cobrança automática.");

  return comTrava(extra.assinaturaId, async () => {
    try {
      const pendente = extra.assinatura.canceladaEm ? null : await proximaCobrancaPendente(assinaturaId, chave);
      let cobranca;
      if (pendente) {
        const descricao = `${pendente.description ?? "Mensalidade"} + ${extra.descricao}`;
        cobranca = await alterarCobranca(pendente, pendente.value + reais(extra.valorCentavos), descricao, chave);
        cobranca = { ...pendente, ...cobranca };
      } else {
        const clienteAsaas = extra.assinatura.cliente.asaasClienteId;
        if (!clienteAsaas) throw new ErroExtra("Cliente sem cadastro no Asaas.");
        const amanha = somarDias(diaLocal(), 1);
        cobranca = await criarCobranca(
          {
            customer: clienteAsaas,
            value: reais(extra.valorCentavos),
            dueDate: extra.assinatura.pagoAte > amanha ? extra.assinatura.pagoAte : amanha,
            description: extra.descricao,
            externalReference: `extra:${extra.id}`,
          },
          chave,
        );
      }
      return db.extraFatura.update({ where: { id: extra.id }, data: { asaasPagamentoId: cobranca.id, vencimento: cobranca.dueDate, erro: null } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao lançar na fatura.";
      await db.extraFatura.update({ where: { id: extra.id }, data: { erro: msg.slice(0, 300) } });
      throw e instanceof ErroAsaas || e instanceof ErroExtra ? e : new ErroExtra(msg);
    }
  });
}

/** Tira um extra da fatura (comanda estornada). Não dá se a cobrança já foi paga. */
export async function retirarDaFatura(comandaId: string) {
  const extra = await db.extraFatura.findUnique({ where: { comandaId }, include: { salao: { select: { asaasApiKey: true } } } });
  if (!extra || extra.status === "CANCELADO") return;
  if (extra.status === "PAGO") throw new ErroExtra("Esse extra já foi cobrado na fatura do cliente. Faça o estorno pelo Asaas.");
  const chave = extra.salao.asaasApiKey;
  if (extra.asaasPagamentoId && chave) {
    const pagamentoId = extra.asaasPagamentoId;
    await comTrava(extra.assinaturaId, async () => {
      const c = await buscarCobranca(pagamentoId, chave);
      if (c.status !== "PENDING" && c.status !== "OVERDUE") throw new ErroExtra("A fatura com esse extra já foi paga. Faça o estorno pelo Asaas.");
      if (!c.subscription) await excluirCobranca(c.id, chave);
      else
        await alterarCobranca(
          c,
          Math.max(0, c.value - reais(extra.valorCentavos)),
          (c.description ?? "").replace(` + ${extra.descricao}`, ""),
          chave,
        );
    });
  }
  await db.extraFatura.update({ where: { id: extra.id }, data: { status: "CANCELADO" } });
}

/** Marca como pagos os extras de uma cobrança paga e devolve quanto deles estava nela. */
export async function quitarExtrasDaCobranca(asaasPagamentoId: string) {
  const extras = await db.extraFatura.findMany({ where: { asaasPagamentoId, status: "PENDENTE" } });
  if (extras.length) await db.extraFatura.updateMany({ where: { id: { in: extras.map((e) => e.id) } }, data: { status: "PAGO" } });
  return extras.reduce((s, e) => s + e.valorCentavos, 0);
}
