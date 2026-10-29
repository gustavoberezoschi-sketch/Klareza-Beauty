import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatarDinheiro, lerDinheiro } from "../src/lib/formato";
import { diaDaSemana, diaLocal, limitesDoMes, somarDias, somarMeses } from "../src/lib/tempo";
import { cpfValido } from "../src/lib/clubeOnline";
import { normalizarCodigo } from "../src/lib/indicacao";
import { descreverFaixas, lerFaixas } from "../src/lib/pedido";

describe("lerDinheiro: valor digitado no painel", () => {
  test("aceita inteiro e centavos com vírgula", () => {
    assert.equal(lerDinheiro("35"), 3500);
    assert.equal(lerDinheiro("35,50"), 3550);
    assert.equal(lerDinheiro("0,99"), 99);
  });

  test("ponto sem vírgula é decimal (35.50 = R$ 35,50)", () => {
    assert.equal(lerDinheiro("35.50"), 3550);
    assert.equal(lerDinheiro("9.9"), 990);
  });

  test("ponto com vírgula: ponto é milhar", () => {
    assert.equal(lerDinheiro("1.000,50"), 100050);
    assert.equal(lerDinheiro("R$ 1.250,00"), 125000);
  });

  test("ponto em grupos de três é milhar", () => {
    assert.equal(lerDinheiro("1.000"), 100000);
    assert.equal(lerDinheiro("12.345"), 1234500);
  });

  test("valores inválidos devolvem null", () => {
    assert.equal(lerDinheiro(""), null);
    assert.equal(lerDinheiro("abc"), null);
    assert.equal(lerDinheiro("1,2,3"), null);
    assert.equal(lerDinheiro("10,123"), null);
  });

  test("formatarDinheiro escreve em reais, no padrão brasileiro", () => {
    assert.equal(formatarDinheiro(3550).replace(/ /g, " "), "R$ 35,50");
    assert.equal(formatarDinheiro(100050).replace(/ /g, " "), "R$ 1.000,50");
  });
});

describe("datas no horário de Brasília", () => {
  test("somar meses respeita o fim do mês", () => {
    assert.equal(somarMeses("2026-01-31", 1), "2026-02-28");
    assert.equal(somarMeses("2028-01-31", 1), "2028-02-29");
    assert.equal(somarMeses("2026-03-15", 12), "2027-03-15");
  });

  test("somar dias atravessa o mês e o ano", () => {
    assert.equal(somarDias("2026-10-31", 1), "2026-11-01");
    assert.equal(somarDias("2026-12-31", 1), "2027-01-01");
    assert.equal(somarDias("2026-03-01", -1), "2026-02-28");
  });

  test("limites do mês", () => {
    assert.deepEqual(limitesDoMes("2026-02-15"), { inicio: "2026-02-01", fim: "2026-02-28" });
    assert.deepEqual(limitesDoMes("2028-02-10"), { inicio: "2028-02-01", fim: "2028-02-29" });
  });

  test("dia da semana: 0 = domingo", () => {
    assert.equal(diaDaSemana("2024-01-01"), 1); // segunda
    assert.equal(diaDaSemana("2024-01-07"), 0); // domingo
  });

  test("diaLocal usa o dia de Brasília, não o UTC (23h em Brasília já é o dia seguinte em UTC)", () => {
    assert.equal(diaLocal(new Date("2026-10-10T01:30:00Z")), "2026-10-09");
    assert.equal(diaLocal(new Date("2026-10-10T12:00:00Z")), "2026-10-10");
  });
});

describe("CPF e código de indicação", () => {
  test("valida o dígito verificador", () => {
    assert.equal(cpfValido("52998224725"), true);
    assert.equal(cpfValido("52998224726"), false);
    assert.equal(cpfValido("11111111111"), false);
    assert.equal(cpfValido("123"), false);
  });

  test("normaliza o código digitado pela cliente", () => {
    assert.equal(normalizarCodigo("  joana-7k2p "), "JOANA7K2P");
    assert.equal(normalizarCodigo("ab cd 12"), "ABCD12");
  });
});

describe("faixas de manutenção", () => {
  test("lê só faixas válidas e ordena por dias", () => {
    const faixas = lerFaixas([
      { ateDias: 21, precoCentavos: 13000 },
      { ateDias: 15, precoCentavos: 10000 },
      { ateDias: 0, precoCentavos: 5000 },
      { ateDias: 10, precoCentavos: -1 },
      "lixo",
    ]);
    assert.deepEqual(faixas, [
      { ateDias: 15, precoCentavos: 10000 },
      { ateDias: 21, precoCentavos: 13000 },
    ]);
  });

  test("valor que não é lista vira lista vazia", () => {
    assert.deepEqual(lerFaixas(null), []);
    assert.deepEqual(lerFaixas({ ateDias: 15 }), []);
  });

  test("descreve as faixas para o cliente", () => {
    assert.equal(
      descreverFaixas([
        { ateDias: 15, precoCentavos: 10000 },
        { ateDias: 21, precoCentavos: 13000 },
      ]).replace(/ /g, " "),
      "Até 15 dias: R$ 100,00 · até 21 dias: R$ 130,00 · depois: aplicação nova",
    );
    assert.equal(descreverFaixas([]), "");
  });
});
