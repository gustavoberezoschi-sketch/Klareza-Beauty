import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { PLANOS_SISTEMA, planoDe, proximoVencimento, situacaoDaSalao, temPagamentosOnline, temRecurso, valorDoCiclo } from "../src/lib/planosSistema";
import { diaLocal, somarDias } from "../src/lib/tempo";

describe("recursos por plano", () => {
  test("Solo não tem clube, comissões, financeiro nem sinal", () => {
    for (const r of ["clube", "comissoes", "financeiro", "sinal"] as const) assert.equal(temRecurso("SOLO", r), false, r);
  });

  test("Bairro para cima tem todos os recursos", () => {
    for (const plano of ["BAIRRO", "CIDADE", "NACIONAL"])
      for (const r of ["clube", "comissoes", "financeiro", "sinal"] as const) assert.equal(temRecurso(plano, r), true, `${plano} ${r}`);
  });

  test("plano desconhecido cai no Bairro", () => {
    assert.equal(planoDe("INVENTADO").nome, "Bairro");
    assert.equal(temRecurso("INVENTADO", "clube"), true);
  });

  test("Solo sem clube nem sinal não tem pagamentos online", () => {
    assert.equal(temPagamentosOnline("SOLO"), false);
    assert.equal(temPagamentosOnline("BAIRRO"), true);
  });
});

describe("preços e vencimentos", () => {
  test("anual é 10 mensalidades (2 meses grátis)", () => {
    for (const [codigo, p] of Object.entries(PLANOS_SISTEMA)) assert.equal(p.anual, p.mensal * 10, codigo);
  });

  test("valor do ciclo escolhe mensal ou anual", () => {
    assert.equal(valorDoCiclo("BAIRRO", "MENSAL"), 14990);
    assert.equal(valorDoCiclo("BAIRRO", "ANUAL"), 149900);
  });

  test("próximo vencimento soma um mês a partir do vencimento atual, se ainda estiver em dia", () => {
    assert.equal(proximoVencimento("2999-01-15", "MENSAL"), "2999-02-15");
    assert.equal(proximoVencimento("2999-01-15", "ANUAL"), "3000-01-15");
  });

  test("próximo vencimento com o pagamento vencido parte de hoje", () => {
    const hoje = diaLocal();
    assert.equal(proximoVencimento("2000-01-01", "MENSAL"), proximoVencimento(null, "MENSAL"));
    assert.ok(proximoVencimento("2000-01-01", "MENSAL") > hoje);
  });

  test("situação do salão: suspenso, atrasado, vencendo, em dia e sem controle", () => {
    assert.equal(situacaoDaSalao({ pagoAte: "2999-01-01", suspensa: true }), "SUSPENSA");
    assert.equal(situacaoDaSalao({ pagoAte: null, suspensa: false }), "SEM_CONTROLE");
    assert.equal(situacaoDaSalao({ pagoAte: "2000-01-01", suspensa: false }), "ATRASADA");
    assert.equal(situacaoDaSalao({ pagoAte: somarDias(diaLocal(), 3), suspensa: false }), "VENCENDO");
    assert.equal(situacaoDaSalao({ pagoAte: "2999-01-01", suspensa: false }), "EM_DIA");
  });
});
