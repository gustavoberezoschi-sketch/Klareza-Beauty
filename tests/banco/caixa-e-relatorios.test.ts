import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../../src/lib/db";
import { resumoDoCaixa } from "../../src/lib/caixa";
import { numerosDoPeriodo } from "../../src/lib/relatorios";
import { criarDataHora } from "../../src/lib/tempo";
import { apagarSaloesDeTeste, criarCliente, criarProfissional, criarSalao, criarServico } from "./ambiente";

after(apagarSaloesDeTeste);

describe("caixa: resumo do dia", () => {
  test("soma vendas por forma, deixa a fatura de fora e calcula o dinheiro na gaveta", async () => {
    const { salao, filial } = await criarSalao();
    const caixa = await db.caixa.create({ data: { salaoId: salao.id, filialId: filial.id, saldoInicialCentavos: 10000 } });
    const cliente = await criarCliente(salao.id);
    const comanda = (total: number, formaPagamento: string) =>
      db.comanda.create({
        data: { salaoId: salao.id, filialId: filial.id, clienteId: cliente.id, status: "FECHADA", fechadaEm: new Date(), totalCentavos: total, formaPagamento, caixaId: caixa.id },
      });
    await comanda(5000, "DINHEIRO");
    await comanda(3000, "PIX");
    await comanda(2000, "FATURA"); // vai para a próxima cobrança do clube, não entra no caixa de hoje
    await comanda(0, "SEM_COBRANCA"); // incluso no plano: não entra
    await db.movimentoCaixa.createMany({
      data: [
        { caixaId: caixa.id, tipo: "SUPRIMENTO", valorCentavos: 1000, descricao: "troco" },
        { caixaId: caixa.id, tipo: "SANGRIA", valorCentavos: 500, descricao: "depósito" },
        { caixaId: caixa.id, tipo: "DESPESA", valorCentavos: 300, descricao: "café" },
      ],
    });
    const assinatura = await db.assinatura.create({
      data: { salaoId: salao.id, clienteId: cliente.id, planoId: (await db.plano.create({ data: { salaoId: salao.id, nome: "Clube", precoCentavos: 9990 } })).id, pagoAte: "2026-12-01" },
    });
    await db.pagamentoAssinatura.create({ data: { assinaturaId: assinatura.id, caixaId: caixa.id, valorCentavos: 4000, formaPagamento: "PIX" } });

    const r = await resumoDoCaixa(caixa.id);
    assert.equal(r.porForma.DINHEIRO, 5000);
    assert.equal(r.porForma.PIX, 7000); // 3000 da comanda + 4000 da mensalidade do clube
    assert.equal(r.naFatura, 2000);
    assert.equal(r.suprimentos, 1000);
    assert.equal(r.sangrias, 500);
    assert.equal(r.despesas, 300);
    assert.equal(r.entradas, 12000);
    // 10000 de troco inicial + 5000 em dinheiro + 1000 de suprimento - 500 de sangria - 300 de despesa
    assert.equal(r.dinheiroEsperado, 15200);
  });
});

describe("relatório do período", () => {
  test("totais batem entre si: vendas = soma por dia = soma por unidade, com sinal retido por falta", async () => {
    const { salao, filial } = await criarSalao();
    const prof = await criarProfissional(salao.id, filial.id, "Carla", 50);
    const servico = await criarServico(salao.id, "Cílios", 10000);
    const cliente = await criarCliente(salao.id);
    const dia1 = criarDataHora("2026-10-05", "15:00");
    const dia2 = criarDataHora("2026-10-06", "15:00");

    // 05/10: serviço de 10000, sinal de 3000 abatido, o resto pago no Pix (total 7000)
    await db.comanda.create({
      data: {
        salaoId: salao.id, filialId: filial.id, clienteId: cliente.id, profissionalId: prof.id, status: "FECHADA",
        fechadaEm: dia1, totalCentavos: 7000, sinalCentavos: 3000, formaPagamento: "PIX",
        itens: { create: [{ tipo: "SERVICO", servicoId: servico.id, profissionalId: prof.id, descricao: "Cílios", precoUnitCentavos: 10000, comissaoPct: 50 }] },
      },
    });
    // 06/10: produto de 4000 pago em dinheiro (comissão de 10%)
    await db.comanda.create({
      data: {
        salaoId: salao.id, filialId: filial.id, clienteId: cliente.id, profissionalId: prof.id, status: "FECHADA",
        fechadaEm: dia2, totalCentavos: 4000, formaPagamento: "DINHEIRO",
        itens: { create: [{ tipo: "PRODUTO", profissionalId: prof.id, descricao: "Pomada", precoUnitCentavos: 4000, comissaoPct: 10 }] },
      },
    });
    // 05/10: cliente faltou, com sinal de 2000 pago que fica com o salão
    await db.agendamento.create({
      data: {
        salaoId: salao.id, filialId: filial.id, profissionalId: prof.id, servicoId: servico.id, clienteId: cliente.id,
        inicio: dia1, fim: criarDataHora("2026-10-05", "16:00"), precoCentavos: 10000, status: "FALTOU", origem: "ONLINE",
        sinalCentavos: 2000, sinalDestino: "RETIDO", sinalPagoEm: dia1,
      },
    });

    const r = await numerosDoPeriodo(salao.id, "2026-10-05", "2026-10-06");
    assert.equal(r.vendas, 7000 + 4000 + 3000 + 2000, "vendas = comandas + sinal abatido + sinal retido");
    assert.equal(r.porForma.PIX, 7000 + 3000 + 2000, "Pix inclui o sinal");
    assert.equal(r.porForma.DINHEIRO, 4000);
    assert.equal(r.comissoes, 5000 + 400, "comissão do serviço (50%) e do produto (10%)");
    assert.equal(r.faltas, 1);
    assert.equal(r.online, 1);
    assert.equal(r.atendimentos, 1);

    const somaDias = [...r.porDia.values()].reduce((s, v) => s + v, 0);
    assert.equal(somaDias, r.vendas, "a soma por dia precisa bater com as vendas");
    const somaUnidades = r.porFilial.reduce((s, f) => s + f.vendas, 0);
    assert.equal(somaUnidades, r.vendas, "a soma por unidade precisa bater com as vendas");
  });
});
