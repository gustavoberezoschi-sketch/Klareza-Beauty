import { after, before, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { tokenWebhookAsaas } from "../../src/lib/cripto";
import { db } from "../../src/lib/db";
import { apagarSaloesDeTeste, criarCliente, criarProfissional, criarSalao, criarServico, derrubarAsaas, desligarAsaasFalso, pagamentosNoAsaas, subirAsaasFalso } from "./ambiente";

// A rota chama revalidatePath, que só existe dentro do Next. Aqui ele vira no-op.
mock.module("next/cache", { namedExports: { revalidatePath() {} } });

type Rota = { POST: (req: Request) => Promise<Response> };
let rota: Rota;

before(async () => {
  await subirAsaasFalso();
  rota = (await import("../../src/app/api/asaas/webhook/route")) as Rota;
});
after(async () => {
  await apagarSaloesDeTeste();
  await desligarAsaasFalso();
});

async function enviar(event: string, payment: Record<string, unknown>, token: string | null = tokenWebhookAsaas()) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers["asaas-access-token"] = token;
  const res = await rota.POST(new Request("http://localhost/api/asaas/webhook", { method: "POST", headers, body: JSON.stringify({ event, payment }) }));
  return { status: res.status, corpo: (await res.json()) as Record<string, unknown> };
}

/** Cobrança como o Asaas a devolveria na consulta. */
function noAsaas(id: string, dados: Record<string, unknown>) {
  pagamentosNoAsaas.set(id, { id, status: "RECEIVED", billingType: "PIX", value: 30, dueDate: "2026-11-10", ...dados });
}

/** Agendamento online que espera o sinal por Pix. */
async function agendamentoComSinal(pagamentoId: string, salaoDados: Parameters<typeof criarSalao>[0] = {}) {
  const { salao, filial } = await criarSalao(salaoDados);
  const prof = await criarProfissional(salao.id, filial.id);
  const servico = await criarServico(salao.id);
  const cliente = await criarCliente(salao.id);
  const inicio = new Date(Date.now() + 5 * 864e5);
  const agendamento = await db.agendamento.create({
    data: {
      salaoId: salao.id, filialId: filial.id, profissionalId: prof.id, servicoId: servico.id, clienteId: cliente.id,
      inicio, fim: new Date(inicio.getTime() + 60 * 6e4), precoCentavos: 10000, status: "AGUARDANDO_SINAL",
      sinalCentavos: 3000, sinalAsaasId: pagamentoId,
    },
  });
  return { salao, agendamento };
}

describe("webhook do Asaas: segurança", () => {
  test("sem o token certo, não aceita nada", async () => {
    const { agendamento } = await agendamentoComSinal("pay_sem_token");
    noAsaas("pay_sem_token", { subscription: null });
    const r = await enviar("PAYMENT_RECEIVED", { id: "pay_sem_token", value: 30, dueDate: "2026-11-10" }, "token-errado");
    assert.equal(r.status, 401);
    const depois = await db.agendamento.findUniqueOrThrow({ where: { id: agendamento.id } });
    assert.equal(depois.status, "AGUARDANDO_SINAL");
  });

  test("aviso forjado (cobrança que o Asaas não tem) é ignorado, mesmo com o token certo", async () => {
    const { agendamento } = await agendamentoComSinal("pay_real_mas_nao_no_asaas");
    const r = await enviar("PAYMENT_RECEIVED", { id: "pay_real_mas_nao_no_asaas", value: 30, dueDate: "2026-11-10" });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.ignorado, "cobrança não existe no Asaas");
    const depois = await db.agendamento.findUniqueOrThrow({ where: { id: agendamento.id } });
    assert.equal(depois.status, "AGUARDANDO_SINAL");
    assert.equal(depois.sinalPagoEm, null);
  });

  test("Asaas fora do ar: responde 503 para o Asaas reenviar depois, e não mexe em nada", async () => {
    const { agendamento } = await agendamentoComSinal("pay_asaas_fora");
    noAsaas("pay_asaas_fora", { subscription: null });
    derrubarAsaas(true);
    try {
      const r = await enviar("PAYMENT_RECEIVED", { id: "pay_asaas_fora", value: 30, dueDate: "2026-11-10" });
      assert.equal(r.status, 503);
    } finally {
      derrubarAsaas(false);
    }
    const depois = await db.agendamento.findUniqueOrThrow({ where: { id: agendamento.id } });
    assert.equal(depois.status, "AGUARDANDO_SINAL");
  });
});

describe("webhook do Asaas: sinal por Pix", () => {
  test("sinal pago confirma o agendamento", async () => {
    const { agendamento } = await agendamentoComSinal("pay_sinal_ok");
    noAsaas("pay_sinal_ok", { subscription: null, status: "RECEIVED" });
    const r = await enviar("PAYMENT_RECEIVED", { id: "pay_sinal_ok", value: 30, dueDate: "2026-11-10", billingType: "PIX" });
    assert.equal(r.corpo.tipo, "sinal");
    const depois = await db.agendamento.findUniqueOrThrow({ where: { id: agendamento.id } });
    assert.equal(depois.status, "AGENDADO");
    assert.notEqual(depois.sinalPagoEm, null);
  });

  test("Asaas diz que o sinal ainda está pendente: não confirma, mesmo que o aviso diga pago", async () => {
    const { agendamento } = await agendamentoComSinal("pay_sinal_pendente");
    noAsaas("pay_sinal_pendente", { subscription: null, status: "PENDING" });
    await enviar("PAYMENT_RECEIVED", { id: "pay_sinal_pendente", value: 30, dueDate: "2026-11-10" });
    const depois = await db.agendamento.findUniqueOrThrow({ where: { id: agendamento.id } });
    assert.equal(depois.status, "AGUARDANDO_SINAL");
    assert.equal(depois.sinalPagoEm, null);
  });

  test("evento que não é pagamento (ex.: cobrança criada) não confirma o agendamento", async () => {
    const { agendamento } = await agendamentoComSinal("pay_sinal_criado");
    noAsaas("pay_sinal_criado", { subscription: null, status: "RECEIVED" });
    await enviar("PAYMENT_CREATED", { id: "pay_sinal_criado", value: 30, dueDate: "2026-11-10" });
    const depois = await db.agendamento.findUniqueOrThrow({ where: { id: agendamento.id } });
    assert.equal(depois.status, "AGUARDANDO_SINAL");
  });
});

describe("webhook do Asaas: mensalidade do clube", () => {
  async function clube() {
    const { salao } = await criarSalao({ cashbackPct: 0 });
    const cliente = await criarCliente(salao.id);
    const plano = await db.plano.create({ data: { salaoId: salao.id, nome: "Clube", precoCentavos: 9990 } });
    const assinatura = await db.assinatura.create({
      data: { salaoId: salao.id, clienteId: cliente.id, planoId: plano.id, pagoAte: "2026-10-01", status: "ATIVA", asaasId: `sub_${salao.id}` },
    });
    return { salao, assinatura };
  }

  test("pagamento confirmado registra a mensalidade e empurra o vencimento um mês", async () => {
    const { assinatura } = await clube();
    noAsaas("pay_mens_1", { subscription: assinatura.asaasId, value: 99.9, netValue: 95, dueDate: "2026-11-10", billingType: "CREDIT_CARD" });
    const r = await enviar("PAYMENT_RECEIVED", { id: "pay_mens_1", subscription: assinatura.asaasId, value: 99.9, dueDate: "2026-11-10", billingType: "CREDIT_CARD" });
    assert.equal(r.corpo.tipo, "clube");

    const pagos = await db.pagamentoAssinatura.findMany({ where: { assinaturaId: assinatura.id } });
    assert.equal(pagos.length, 1);
    assert.equal(pagos[0].valorCentavos, 9990);
    assert.equal(pagos[0].formaPagamento, "CARTAO_CREDITO");
    assert.equal(pagos[0].valorLiquidoCentavos, 9500);
    const depois = await db.assinatura.findUniqueOrThrow({ where: { id: assinatura.id } });
    assert.equal(depois.pagoAte, "2026-12-10");
    assert.equal(depois.status, "ATIVA");
  });

  test("o mesmo aviso chegando duas vezes não registra a mensalidade em dobro", async () => {
    const { assinatura } = await clube();
    noAsaas("pay_mens_2", { subscription: assinatura.asaasId, value: 99.9, dueDate: "2026-11-10", billingType: "CREDIT_CARD", netValue: 95 });
    const aviso = { id: "pay_mens_2", subscription: assinatura.asaasId, value: 99.9, dueDate: "2026-11-10", billingType: "CREDIT_CARD" };
    await enviar("PAYMENT_RECEIVED", aviso);
    await enviar("PAYMENT_RECEIVED", aviso);
    assert.equal(await db.pagamentoAssinatura.count({ where: { assinaturaId: assinatura.id } }), 1);
    const depois = await db.assinatura.findUniqueOrThrow({ where: { id: assinatura.id } });
    assert.equal(depois.pagoAte, "2026-12-10", "o vencimento não pode andar duas vezes");
  });

  test("cobrança que no Asaas pertence a outra assinatura é ignorada", async () => {
    const { assinatura } = await clube();
    noAsaas("pay_outra_assinatura", { subscription: "sub_de_outro_salao", value: 99.9, dueDate: "2026-11-10" });
    const r = await enviar("PAYMENT_RECEIVED", { id: "pay_outra_assinatura", subscription: assinatura.asaasId, value: 99.9, dueDate: "2026-11-10" });
    assert.equal(r.corpo.ignorado, "cobrança não confere com o Asaas");
    assert.equal(await db.pagamentoAssinatura.count({ where: { assinaturaId: assinatura.id } }), 0);
  });
});

describe("webhook do Asaas: mensalidade do Klareza Beauty (salão paga o sistema)", () => {
  test("pagamento da mensalidade do sistema renova o vencimento do salão", async () => {
    const id = `sub_sis_${Date.now()}`;
    const { salao } = await criarSalao({ plano: "CIDADE", ciclo: "MENSAL", pagoAte: "2026-10-01", asaasApiKey: null, asaasAssinaturaSistema: id });
    noAsaas("pay_sis_1", { subscription: id, value: 299.9, dueDate: "2026-11-05", billingType: "PIX" });
    const r = await enviar("PAYMENT_RECEIVED", { id: "pay_sis_1", subscription: id, value: 299.9, dueDate: "2026-11-05", billingType: "PIX" });
    assert.equal(r.corpo.tipo, "sistema");

    const pago = await db.pagamentoSistema.findUniqueOrThrow({ where: { asaasPagamentoId: "pay_sis_1" } });
    assert.equal(pago.valorCentavos, 29990);
    assert.equal(pago.referenteAte, "2026-12-05");
    const depois = await db.salao.findUniqueOrThrow({ where: { id: salao.id } });
    assert.equal(depois.pagoAte, "2026-12-05");
    assert.equal(depois.suspensa, false);
  });
});
