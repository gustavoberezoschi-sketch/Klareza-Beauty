import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../../src/lib/db";
import { cancelarComanda, fecharComanda } from "../../src/lib/comandas";
import { pacoteParaServico, pacotesDaCliente } from "../../src/lib/pacotes";
import { diaLocal, somarDias } from "../../src/lib/tempo";
import { apagarSaloesDeTeste, criarCliente, criarProfissional, criarSalao, criarServico } from "./ambiente";

after(apagarSaloesDeTeste);

/** Salão, serviço, pacote de 4 sessões e uma cliente que já comprou o pacote. */
async function cenario(validoAte: string | null = "2999-01-01") {
  const { salao, filial } = await criarSalao({ cashbackPct: 10 });
  const prof = await criarProfissional(salao.id, filial.id);
  const servico = await criarServico(salao.id, "Cílios", 10000);
  const pacote = await db.pacote.create({ data: { salaoId: salao.id, servicoId: servico.id, nome: "4 cílios", sessoes: 4, precoCentavos: 30000, validadeDias: 30 } });
  const cliente = await criarCliente(salao.id);
  const compra = await db.pacoteCliente.create({
    data: { salaoId: salao.id, clienteId: cliente.id, pacoteId: pacote.id, servicoId: servico.id, sessoes: 4, valorCentavos: 30000, validoAte },
  });
  return { salao, filial, prof, servico, pacote, cliente, compra };
}

/** Comanda aberta com um item de sessão (ou de serviço) para a cliente. */
async function comandaComSessao(c: Awaited<ReturnType<typeof cenario>>, pacoteClienteId: string | null, status = "ABERTA") {
  return db.comanda.create({
    data: {
      salaoId: c.salao.id, filialId: c.filial.id, clienteId: c.cliente.id, profissionalId: c.prof.id, status,
      itens: { create: [{ tipo: "SERVICO", servicoId: c.servico.id, profissionalId: c.prof.id, descricao: "Cílios", precoUnitCentavos: 10000, comissaoPct: 50, pacoteClienteId }] },
    },
  });
}

describe("pacotes: saldo de sessões", () => {
  test("pacote novo tem todas as sessões disponíveis", async () => {
    const c = await cenario();
    const [p] = await pacotesDaCliente(c.cliente.id);
    assert.equal(p.usadas, 0);
    assert.equal(p.restantes, 4);
    assert.equal(p.disponivel, true);
    assert.equal((await pacoteParaServico(db, c.cliente.id, c.servico.id))?.id, c.compra.id);
  });

  test("pacote de outro serviço não é usado", async () => {
    const c = await cenario();
    const outro = await criarServico(c.salao.id, "Unhas", 5000);
    assert.equal(await pacoteParaServico(db, c.cliente.id, outro.id), null);
  });

  test("pacote vencido não é usado, mas aparece no histórico", async () => {
    const c = await cenario("2000-01-01");
    const [p] = await pacotesDaCliente(c.cliente.id);
    assert.equal(p.vencido, true);
    assert.equal(p.disponivel, false);
    assert.equal(await pacoteParaServico(db, c.cliente.id, c.servico.id), null);
  });

  test("ao fechar a comanda, a sessão é abatida e o serviço não cobra", async () => {
    const c = await cenario();
    const comanda = await comandaComSessao(c, c.compra.id);
    const r = await fecharComanda(c.salao.id, comanda.id, { formaPagamento: "PIX", descontoCentavos: 0, usarCashback: false });
    assert.equal(r.status, "FECHADA");
    assert.equal(r.totalCentavos, 0);
    assert.equal(r.formaPagamento, "SEM_COBRANCA");
    const [p] = await pacotesDaCliente(c.cliente.id);
    assert.equal(p.usadas, 1);
    assert.equal(p.restantes, 3);
  });

  test("comanda cancelada não gasta sessão", async () => {
    const c = await cenario();
    const comanda = await comandaComSessao(c, c.compra.id);
    await cancelarComanda(c.salao.id, comanda.id);
    const [p] = await pacotesDaCliente(c.cliente.id);
    assert.equal(p.usadas, 0);
  });

  test("pacote esgotado deixa de ser usado", async () => {
    const c = await cenario();
    for (let i = 0; i < 4; i++) {
      const comanda = await comandaComSessao(c, c.compra.id);
      await fecharComanda(c.salao.id, comanda.id, { formaPagamento: "PIX", descontoCentavos: 0, usarCashback: false });
    }
    const [p] = await pacotesDaCliente(c.cliente.id);
    assert.equal(p.restantes, 0);
    assert.equal(p.disponivel, false);
    assert.equal(await pacoteParaServico(db, c.cliente.id, c.servico.id), null);
  });
});

describe("venda de pacote na comanda", () => {
  test("vender 2 pacotes cobra 2 vezes o preço, libera 8 sessões com validade e gera cashback", async () => {
    const c = await cenario();
    const comanda = await db.comanda.create({
      data: {
        salaoId: c.salao.id, filialId: c.filial.id, clienteId: c.cliente.id, status: "ABERTA",
        itens: { create: [{ tipo: "PACOTE", pacoteId: c.pacote.id, descricao: "4 cílios", quantidade: 2, precoUnitCentavos: 30000 }] },
      },
    });
    const r = await fecharComanda(c.salao.id, comanda.id, { formaPagamento: "CARTAO_CREDITO", descontoCentavos: 0, usarCashback: false });
    assert.equal(r.totalCentavos, 60000);
    assert.equal(r.cashbackGeradoCentavos, 6000, "10% do que foi pago");

    const vendido = await db.pacoteCliente.findFirst({ where: { clienteId: c.cliente.id, itemVendaId: { not: null } } });
    assert.ok(vendido, "pacote vendido precisa estar registrado para a cliente");
    assert.equal(vendido.sessoes, 8);
    assert.equal(vendido.valorCentavos, 60000);
    assert.equal(vendido.validoAte, somarDias(diaLocal(), 30));
  });
});
