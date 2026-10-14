import { db } from "./db";
import { criarDataHora, somarDias } from "./tempo";

/** Números de um período (dias inclusivos) a partir das comandas fechadas. */
export async function numerosDoPeriodo(salaoId: string, de: string, ate: string, profissionalId?: string | null, filialId?: string | null) {
  const intervalo = { gte: criarDataHora(de, "00:00"), lt: criarDataHora(somarDias(ate, 1), "00:00") };
  const naUnidade = filialId ? { filialId } : {};
  const [comandas, pagamentosPlano, despesasCaixa, contasPagas, agendamentos, novosClientes] = await Promise.all([
    db.comanda.findMany({
      where: { salaoId, ...naUnidade, status: "FECHADA", fechadaEm: intervalo },
      include: { itens: { include: { profissional: true } }, filial: { select: { nome: true } } },
    }),
    db.pagamentoAssinatura.findMany({
      where: { assinatura: { salaoId }, pagoEm: intervalo, ...(filialId ? { caixa: { filialId } } : {}) },
      include: { assinatura: { include: { plano: true } } },
    }),
    db.movimentoCaixa.findMany({ where: { caixa: { salaoId, ...naUnidade }, tipo: "DESPESA", criadoEm: intervalo } }),
    db.contaPagar.findMany({ where: { salaoId, pagoEm: intervalo } }),
    db.agendamento.findMany({ where: { salaoId, ...naUnidade, inicio: intervalo, ...(profissionalId ? { profissionalId } : {}) }, select: { status: true, origem: true } }),
    db.cliente.count({ where: { salaoId, criadoEm: intervalo } }),
  ]);

  const itens = comandas.flatMap((c) => c.itens.map((i) => ({ ...i, fechadaEm: c.fechadaEm! })));
  const meusItens = profissionalId ? itens.filter((i) => i.profissionalId === profissionalId) : itens;
  const valorItem = (i: { quantidade: number; precoUnitCentavos: number }) => i.quantidade * i.precoUnitCentavos;
  const comissaoItem = (i: { quantidade: number; precoUnitCentavos: number; comissaoPct: number }) => Math.round((valorItem(i) * i.comissaoPct) / 100);

  const porProfissional = new Map<string, { nome: string; servicos: number; qtdServicos: number; produtos: number; comissao: number }>();
  for (const i of meusItens) {
    if (!i.profissionalId || !i.profissional) continue;
    const b = porProfissional.get(i.profissionalId) ?? { nome: i.profissional.nome, servicos: 0, qtdServicos: 0, produtos: 0, comissao: 0 };
    if (i.tipo === "SERVICO") {
      b.servicos += valorItem(i);
      b.qtdServicos += 1;
    } else b.produtos += valorItem(i);
    b.comissao += comissaoItem(i);
    porProfissional.set(i.profissionalId, b);
  }

  const agrupar = (tipo: string) => {
    const m = new Map<string, { qtd: number; valor: number }>();
    for (const i of meusItens.filter((x) => x.tipo === tipo)) {
      const v = m.get(i.descricao) ?? { qtd: 0, valor: 0 };
      v.qtd += i.quantidade;
      v.valor += i.cobertoPorPlano ? 0 : valorItem(i);
      m.set(i.descricao, v);
    }
    return [...m.entries()].map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.qtd - a.qtd);
  };

  const porForma: Record<string, number> = {};
  for (const c of comandas) if (c.totalCentavos > 0 && c.formaPagamento) porForma[c.formaPagamento] = (porForma[c.formaPagamento] ?? 0) + c.totalCentavos;
  for (const p of pagamentosPlano) porForma[p.formaPagamento] = (porForma[p.formaPagamento] ?? 0) + p.valorCentavos;

  const porDia = new Map<string, number>();
  for (const c of comandas) {
    const d = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(c.fechadaEm!);
    porDia.set(d, (porDia.get(d) ?? 0) + c.totalCentavos);
  }

  const porFilial = new Map<string, { nome: string; vendas: number; comandas: number }>();
  for (const c of comandas) {
    const f = porFilial.get(c.filialId) ?? { nome: c.filial.nome, vendas: 0, comandas: 0 };
    f.vendas += c.totalCentavos;
    f.comandas += 1;
    porFilial.set(c.filialId, f);
  }

  const vendas = comandas.reduce((s, c) => s + c.totalCentavos, 0);
  const assinaturas = pagamentosPlano.reduce((s, p) => s + p.valorCentavos, 0);
  const comissoes = [...porProfissional.values()].reduce((s, b) => s + b.comissao, 0);
  const despesas = despesasCaixa.reduce((s, d) => s + d.valorCentavos, 0) + contasPagas.reduce((s, c) => s + c.valorCentavos, 0);

  return {
    comandas,
    vendas,
    assinaturas,
    receita: vendas + assinaturas,
    comissoes,
    despesas,
    resultado: vendas + assinaturas - comissoes - despesas,
    atendimentos: meusItens.filter((i) => i.tipo === "SERVICO").length,
    clientesAtendidos: new Set(comandas.filter((c) => !profissionalId || c.itens.some((i) => i.profissionalId === profissionalId)).map((c) => c.clienteId).filter(Boolean)).size,
    novosClientes,
    agendamentos: agendamentos.length,
    faltas: agendamentos.filter((a) => a.status === "FALTOU").length,
    online: agendamentos.filter((a) => a.origem === "ONLINE").length,
    porProfissional: [...porProfissional.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.servicos + b.produtos - (a.servicos + a.produtos)),
    servicos: agrupar("SERVICO"),
    produtos: agrupar("PRODUTO"),
    porForma,
    porDia,
    porFilial: [...porFilial.values()].sort((a, b) => b.vendas - a.vendas),
    contasPagas,
    despesasCaixa,
  };
}
