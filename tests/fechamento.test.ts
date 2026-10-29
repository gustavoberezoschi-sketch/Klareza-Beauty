import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { calcularFechamento, subtotalDosItens } from "../src/lib/comandas";
import { SINAL_MINIMO_CENTAVOS, sinalAtivo, valorDoSinal } from "../src/lib/sinal";
import { itemSemCobranca } from "../src/lib/pacotes";

const base = { subtotal: 10000, descontoPedido: 0, sinal: 0, temCliente: true, cashbackSaldo: 0, usarCashback: false, cashbackPct: 10 };

describe("calcularFechamento: desconto", () => {
  test("sem desconto, sinal ou cashback: cashback ganho sobre o total", () => {
    const r = calcularFechamento(base);
    assert.equal(r.total, 10000);
    assert.equal(r.cashbackGerado, 1000);
  });

  test("desconto reduz o total e o cashback ganho", () => {
    const r = calcularFechamento({ ...base, descontoPedido: 2000 });
    assert.equal(r.desconto, 2000);
    assert.equal(r.total, 8000);
    assert.equal(r.cashbackGerado, 800);
  });

  test("desconto maior que o subtotal fica limitado ao subtotal", () => {
    const r = calcularFechamento({ ...base, descontoPedido: 50000 });
    assert.equal(r.desconto, 10000);
    assert.equal(r.total, 0);
    assert.equal(r.cashbackGerado, 0);
  });

  test("desconto negativo vira zero", () => {
    const r = calcularFechamento({ ...base, descontoPedido: -500 });
    assert.equal(r.desconto, 0);
    assert.equal(r.total, 10000);
  });
});

describe("calcularFechamento: sinal pago no agendamento", () => {
  test("sinal menor que o total é abatido e o cashback conta o sinal também", () => {
    const r = calcularFechamento({ ...base, sinal: 5000 });
    assert.equal(r.sinalAplicado, 5000);
    assert.equal(r.sobraDoSinal, 0);
    assert.equal(r.total, 5000);
    assert.equal(r.cashbackGerado, 1000); // 10% de 10000 pagos (5000 no Pix + 5000 na comanda)
  });

  test("sinal maior que o total: a sobra vira crédito inteiro, sem cashback sobre ela", () => {
    const r = calcularFechamento({ ...base, sinal: 15000 });
    assert.equal(r.sinalAplicado, 10000);
    assert.equal(r.sobraDoSinal, 5000);
    assert.equal(r.total, 0);
    assert.equal(r.cashbackGerado, 6000); // 10% de 10000 + os 5000 de sobra
  });

  test("sinal com desconto: o desconto vem antes e o sinal abate o que sobrar", () => {
    const r = calcularFechamento({ ...base, descontoPedido: 3000, sinal: 4000 });
    assert.equal(r.sinalAplicado, 4000);
    assert.equal(r.sobraDoSinal, 0);
    assert.equal(r.total, 3000);
  });

  test("sinal zero não mexe no total", () => {
    const r = calcularFechamento({ ...base, sinal: 0 });
    assert.equal(r.sinalAplicado, 0);
    assert.equal(r.sobraDoSinal, 0);
  });
});

describe("calcularFechamento: cashback do cliente", () => {
  test("usa o saldo até o valor da comanda, e o cashback ganho sai do total já descontado", () => {
    const r = calcularFechamento({ ...base, cashbackSaldo: 3000, usarCashback: true });
    assert.equal(r.cashbackUsado, 3000);
    assert.equal(r.total, 7000);
    assert.equal(r.cashbackGerado, 700);
  });

  test("saldo maior que a comanda é usado só até zerar a conta", () => {
    const r = calcularFechamento({ ...base, cashbackSaldo: 20000, usarCashback: true });
    assert.equal(r.cashbackUsado, 10000);
    assert.equal(r.total, 0);
    assert.equal(r.cashbackGerado, 0);
  });

  test("sem pedir para usar, o saldo fica guardado", () => {
    const r = calcularFechamento({ ...base, cashbackSaldo: 3000, usarCashback: false });
    assert.equal(r.cashbackUsado, 0);
    assert.equal(r.total, 10000);
  });

  test("sinal e cashback juntos: o sinal entra antes do cashback", () => {
    const r = calcularFechamento({ ...base, sinal: 4000, cashbackSaldo: 9000, usarCashback: true });
    assert.equal(r.sinalAplicado, 4000);
    assert.equal(r.cashbackUsado, 6000);
    assert.equal(r.total, 0);
    assert.equal(r.cashbackGerado, 400);
  });

  test("sem cliente cadastrado não há cashback, nem uso nem ganho", () => {
    const r = calcularFechamento({ ...base, temCliente: false, cashbackSaldo: 3000, usarCashback: true });
    assert.equal(r.cashbackUsado, 0);
    assert.equal(r.cashbackGerado, 0);
    assert.equal(r.total, 10000);
  });

  test("salão sem cashback (0%) não gera crédito", () => {
    const r = calcularFechamento({ ...base, cashbackPct: 0 });
    assert.equal(r.cashbackGerado, 0);
  });
});

describe("calcularFechamento: invariantes", () => {
  test("para várias combinações, o que é cobrado mais o que foi abatido fecha com o subtotal", () => {
    const valores = [0, 1, 499, 500, 2500, 10000, 99999];
    for (const subtotal of [1, 500, 10000, 33333])
      for (const descontoPedido of valores)
        for (const sinal of valores)
          for (const cashbackSaldo of valores)
            for (const usarCashback of [true, false]) {
              const r = calcularFechamento({ subtotal, descontoPedido, sinal, temCliente: true, cashbackSaldo, usarCashback, cashbackPct: 15 });
              assert.ok(r.total >= 0, `total negativo em ${JSON.stringify({ subtotal, descontoPedido, sinal, cashbackSaldo })}`);
              assert.ok(r.cashbackUsado <= cashbackSaldo, "usou mais cashback do que o cliente tem");
              assert.ok(r.sinalAplicado + r.sobraDoSinal === sinal, "o sinal não bate");
              assert.equal(r.desconto + r.sinalAplicado + r.cashbackUsado + r.total, subtotal, "a conta não fecha com o subtotal");
              assert.ok(Number.isInteger(r.cashbackGerado) && r.cashbackGerado >= 0, "cashback ganho inválido");
            }
  });
});

describe("subtotal e cobrança dos itens", () => {
  test("soma quantidade x preço e ignora o que é coberto pelo plano ou por pacote", () => {
    const itens = [
      { quantidade: 2, precoUnitCentavos: 5000, cobertoPorPlano: false },
      { quantidade: 1, precoUnitCentavos: 9000, cobertoPorPlano: true },
      { quantidade: 1, precoUnitCentavos: 7000, cobertoPorPlano: false, pacoteClienteId: "pc_1" },
    ];
    assert.equal(subtotalDosItens(itens), 10000);
  });

  test("itemSemCobranca reconhece plano e pacote", () => {
    assert.equal(itemSemCobranca({ cobertoPorPlano: true }), true);
    assert.equal(itemSemCobranca({ cobertoPorPlano: false, pacoteClienteId: "x" }), true);
    assert.equal(itemSemCobranca({ cobertoPorPlano: false, pacoteClienteId: null }), false);
  });
});

describe("sinal por Pix", () => {
  const pronto = { plano: "BAIRRO", sinalPct: 30, asaasApiKey: "chave", asaasStatus: "APPROVED" };

  test("valor do sinal é a porcentagem do total, arredondada", () => {
    assert.equal(valorDoSinal(10000, 30), 3000);
    assert.equal(valorDoSinal(1667, 30), 500);
  });

  test("abaixo do mínimo do Asaas não cobra sinal", () => {
    assert.equal(SINAL_MINIMO_CENTAVOS, 500);
    assert.equal(valorDoSinal(1000, 30), 0);
  });

  test("sinal só fica ativo com plano que tem o recurso, conta aprovada e % definida", () => {
    assert.equal(sinalAtivo(pronto), true);
    assert.equal(sinalAtivo({ ...pronto, plano: "SOLO" }), false);
    assert.equal(sinalAtivo({ ...pronto, sinalPct: 0 }), false);
    assert.equal(sinalAtivo({ ...pronto, asaasStatus: "PENDING" }), false);
    assert.equal(sinalAtivo({ ...pronto, asaasApiKey: null }), false);
  });
});
