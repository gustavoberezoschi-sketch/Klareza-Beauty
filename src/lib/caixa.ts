import { db } from "./db";

export async function caixaAberto(salaoId: string, filialId: string) {
  return db.caixa.findFirst({ where: { salaoId, filialId, fechadoEm: null }, orderBy: { abertoEm: "desc" } });
}

export type ResumoCaixa = Awaited<ReturnType<typeof resumoDoCaixa>>;

/** Totais do caixa: vendas por forma de pagamento, movimentos e dinheiro esperado na gaveta. */
export async function resumoDoCaixa(caixaId: string) {
  const caixa = await db.caixa.findUniqueOrThrow({
    where: { id: caixaId },
    include: {
      movimentos: { orderBy: { criadoEm: "asc" } },
      comandas: { where: { status: "FECHADA" }, include: { cliente: true }, orderBy: { fechadaEm: "asc" } },
      pagamentos: { include: { assinatura: { include: { cliente: true, plano: true } } } },
    },
  });

  const porForma: Record<string, number> = {};
  let naFatura = 0; // vai para a próxima cobrança do clube: não entra no caixa de hoje
  for (const c of caixa.comandas) {
    if (c.formaPagamento === "FATURA") naFatura += c.totalCentavos;
    else if (c.totalCentavos > 0 && c.formaPagamento) porForma[c.formaPagamento] = (porForma[c.formaPagamento] ?? 0) + c.totalCentavos;
  }
  for (const p of caixa.pagamentos) porForma[p.formaPagamento] = (porForma[p.formaPagamento] ?? 0) + p.valorCentavos;

  const soma = (tipo: string) => caixa.movimentos.filter((m) => m.tipo === tipo).reduce((s, m) => s + m.valorCentavos, 0);
  const suprimentos = soma("SUPRIMENTO");
  const sangrias = soma("SANGRIA");
  const despesas = soma("DESPESA");
  const entradas = Object.values(porForma).reduce((s, v) => s + v, 0);
  const dinheiroEsperado = caixa.saldoInicialCentavos + (porForma.DINHEIRO ?? 0) + suprimentos - sangrias - despesas;

  return { caixa, porForma, naFatura, suprimentos, sangrias, despesas, entradas, dinheiroEsperado };
}
