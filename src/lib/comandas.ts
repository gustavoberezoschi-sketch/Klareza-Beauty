import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { movimentarEstoque } from "./estoque";
import { itemSemCobranca, pacoteParaServico } from "./pacotes";
import { diaLocal, limitesDoMes, criarDataHora, somarDias } from "./tempo";

type Tx = Prisma.TransactionClient;

export class ErroComanda extends Error {}

/** Assinatura ativa e em dia do cliente, se houver. */
export async function assinaturaVigente(clienteId: string, tx: Tx | typeof db = db) {
  return tx.assinatura.findFirst({
    where: { clienteId, status: "ATIVA", pagoAte: { gte: diaLocal() } },
    include: { plano: { include: { servicos: { select: { id: true } } } } },
  });
}

/**
 * Quantos usos do plano o cliente já fez no mês atual:
 * - serviços cobertos pelo plano em comandas (abertas ou fechadas);
 * - agendamentos de serviços do plano cujo horário já chegou e que não viraram comanda.
 *   Contam mesmo se o cliente faltou: marcou o horário, gastou o uso.
 */
export async function usosDoPlanoNoMes(clienteId: string, tx: Tx | typeof db = db) {
  const { inicio, fim } = limitesDoMes(diaLocal());
  const doMes = { gte: criarDataHora(inicio, "00:00"), lt: criarDataHora(somarDias(fim, 1), "00:00") };
  const [itens, assinatura] = await Promise.all([
    tx.comandaItem.count({ where: { cobertoPorPlano: true, comanda: { clienteId, status: { not: "CANCELADA" }, abertaEm: doMes } } }),
    assinaturaVigente(clienteId, tx),
  ]);
  if (!assinatura) return itens;
  const servicosDoPlano = assinatura.plano.servicos.map((s) => s.id);
  if (!servicosDoPlano.length) return itens;
  const [agendamentos, comandas] = await Promise.all([
    tx.agendamento.findMany({
      where: {
        clienteId,
        servicoId: { in: servicosDoPlano },
        status: { in: ["AGENDADO", "CONFIRMADO", "CONCLUIDO", "FALTOU"] },
        inicio: { gte: doMes.gte, lte: new Date() },
      },
      select: { id: true, grupo: true },
    }),
    tx.comanda.findMany({
      where: { clienteId, status: { not: "CANCELADA" }, agendamentoId: { not: null } },
      select: { agendamento: { select: { id: true, grupo: true } } },
    }),
  ]);
  // o que virou comanda já está contado pelos itens dela
  const ids = new Set(comandas.map((c) => c.agendamento?.id));
  const grupos = new Set(comandas.map((c) => c.agendamento?.grupo).filter(Boolean));
  return itens + agendamentos.filter((a) => !ids.has(a.id) && !(a.grupo && grupos.has(a.grupo))).length;
}

/** Monta o item de serviço já com comissão (e auxiliar) e cobertura do plano ou de um pacote do cliente. */
async function montarItemServico(
  tx: Tx,
  salaoId: string,
  comandaId: string,
  servicoId: string,
  profissionalId: string | null,
  clienteId: string | null,
  auxiliarId: string | null = null,
) {
  const servico = await tx.servico.findFirstOrThrow({ where: { id: servicoId, salaoId } });
  // profissional sempre do mesmo salão (o id vem do formulário)
  const profissional = profissionalId ? await tx.profissional.findFirst({ where: { id: profissionalId, salaoId } }) : null;
  if (profissionalId && !profissional) throw new ErroComanda("Profissional não encontrado.");
  const auxiliar = auxiliarId ? await tx.profissional.findFirst({ where: { id: auxiliarId, salaoId } }) : null;
  if (auxiliarId && !auxiliar) throw new ErroComanda("Auxiliar não encontrada.");
  if (auxiliar && auxiliar.id === profissionalId) throw new ErroComanda("A auxiliar precisa ser outra pessoa.");

  let cobertoPorPlano = false;
  if (clienteId) {
    const assinatura = await assinaturaVigente(clienteId, tx);
    if (assinatura && assinatura.plano.servicos.some((s) => s.id === servicoId)) {
      const limite = assinatura.plano.usosPorMes;
      cobertoPorPlano = limite === null || (await usosDoPlanoNoMes(clienteId, tx)) < limite;
    }
  }
  // Sem plano cobrindo: usa uma sessão de pacote, se a cliente tiver
  const pacote = clienteId && !cobertoPorPlano ? await pacoteParaServico(tx, clienteId, servicoId) : null;

  return tx.comandaItem.create({
    data: {
      comandaId,
      tipo: "SERVICO",
      servicoId,
      profissionalId,
      descricao: servico.nome,
      precoUnitCentavos: servico.precoCentavos,
      comissaoPct: servico.comissaoPct ?? profissional?.comissaoPct ?? 0,
      auxiliarId: auxiliar?.id ?? null,
      comissaoAuxiliarPct: auxiliar?.comissaoAuxiliarPct ?? 0,
      cobertoPorPlano,
      pacoteClienteId: pacote?.id ?? null,
    },
  });
}

/** Abre uma comanda (opcionalmente a partir de um agendamento, já com o serviço). */
export async function abrirComanda(params: {
  salaoId: string;
  filialId?: string | null; // obrigatório quando não vem de um agendamento
  clienteId?: string | null;
  profissionalId?: string | null;
  agendamentoId?: string | null;
}) {
  return db.$transaction(async (tx) => {
    let { clienteId = null, profissionalId = null, filialId = null } = params;
    let servicos: { servicoId: string; profissionalId: string }[] = [];

    if (params.agendamentoId) {
      const ag = await tx.agendamento.findFirstOrThrow({
        where: { id: params.agendamentoId, salaoId: params.salaoId },
      });
      // Vários serviços agendados juntos (grupo) viram uma comanda só.
      const existente = await tx.comanda.findFirst({
        where: {
          status: { not: "CANCELADA" },
          ...(ag.grupo ? { agendamento: { grupo: ag.grupo } } : { agendamentoId: ag.id }),
        },
      });
      if (existente) return existente;
      const doGrupo = ag.grupo
        ? await tx.agendamento.findMany({ where: { grupo: ag.grupo, status: { not: "CANCELADO" } }, orderBy: { inicio: "asc" } })
        : [ag];
      clienteId = ag.clienteId;
      profissionalId = ag.profissionalId;
      filialId = ag.filialId;
      servicos = doGrupo.map((a) => ({ servicoId: a.servicoId, profissionalId: a.profissionalId }));
    }

    if (!filialId && profissionalId) filialId = (await tx.profissional.findUnique({ where: { id: profissionalId } }))?.filialId ?? null;
    if (!filialId) throw new ErroComanda("Escolha a unidade da comanda.");
    const caixa = await tx.caixa.findFirst({ where: { filialId, fechadoEm: null } });
    const comanda = await tx.comanda.create({
      data: {
        salaoId: params.salaoId,
        filialId,
        clienteId,
        profissionalId,
        agendamentoId: params.agendamentoId ?? null,
        caixaId: caixa?.id ?? null,
      },
    });
    for (const item of servicos) await montarItemServico(tx, params.salaoId, comanda.id, item.servicoId, item.profissionalId, clienteId);
    return comanda;
  });
}

async function comandaAberta(tx: Tx, salaoId: string, comandaId: string) {
  const comanda = await tx.comanda.findFirst({ where: { id: comandaId, salaoId } });
  if (!comanda) throw new ErroComanda("Comanda não encontrada.");
  if (comanda.status !== "ABERTA") throw new ErroComanda("Essa comanda já foi fechada.");
  return comanda;
}

export async function adicionarServico(salaoId: string, comandaId: string, servicoId: string, profissionalId: string | null, auxiliarId: string | null = null) {
  return db.$transaction(async (tx) => {
    const comanda = await comandaAberta(tx, salaoId, comandaId);
    const servico = await tx.servico.findFirst({ where: { id: servicoId, salaoId } });
    if (!servico) throw new ErroComanda("Serviço não encontrado.");
    return montarItemServico(tx, salaoId, comanda.id, servicoId, profissionalId ?? comanda.profissionalId, comanda.clienteId, auxiliarId);
  });
}

/** Vende um pacote de sessões na comanda. As sessões ficam disponíveis quando a comanda é fechada. */
export async function adicionarPacote(salaoId: string, comandaId: string, pacoteId: string) {
  return db.$transaction(async (tx) => {
    const comanda = await comandaAberta(tx, salaoId, comandaId);
    if (!comanda.clienteId) throw new ErroComanda("Escolha o cliente da comanda para vender um pacote.");
    const pacote = await tx.pacote.findFirst({ where: { id: pacoteId, salaoId, ativo: true } });
    if (!pacote) throw new ErroComanda("Pacote não encontrado.");
    return tx.comandaItem.create({
      data: {
        comandaId,
        tipo: "PACOTE",
        pacoteId: pacote.id,
        descricao: `Pacote ${pacote.nome} (${pacote.sessoes} sessões)`,
        precoUnitCentavos: pacote.precoCentavos,
        comissaoPct: 0,
      },
    });
  });
}

export async function adicionarProduto(
  salaoId: string,
  comandaId: string,
  produtoId: string,
  quantidade: number,
  profissionalId: string | null,
) {
  if (!Number.isInteger(quantidade) || quantidade < 1) throw new ErroComanda("Quantidade inválida.");
  return db.$transaction(async (tx) => {
    const comanda = await comandaAberta(tx, salaoId, comandaId);
    const produto = await tx.produto.findFirst({ where: { id: produtoId, salaoId, ativo: true } });
    if (!produto) throw new ErroComanda("Produto não encontrado.");
    const vendedorId = profissionalId ?? comanda.profissionalId;
    const vendedor = vendedorId ? await tx.profissional.findFirst({ where: { id: vendedorId, salaoId } }) : null;
    if (vendedorId && !vendedor) throw new ErroComanda("Profissional não encontrado.");
    return tx.comandaItem.create({
      data: {
        comandaId,
        tipo: "PRODUTO",
        produtoId,
        profissionalId: vendedorId,
        descricao: produto.nome,
        quantidade,
        precoUnitCentavos: produto.precoCentavos,
        comissaoPct: vendedor?.comissaoProdutoPct ?? 0,
      },
    });
  });
}

export async function removerItem(salaoId: string, comandaId: string, itemId: string) {
  return db.$transaction(async (tx) => {
    // o item precisa ser da comanda conferida (profissional só mexe na comanda dele)
    const item = await tx.comandaItem.findFirst({ where: { id: itemId, comandaId, comanda: { salaoId } } });
    if (!item) throw new ErroComanda("Item não encontrado.");
    await comandaAberta(tx, salaoId, item.comandaId);
    await tx.comandaItem.delete({ where: { id: itemId } });
  });
}

/** O agendamento da comanda e os outros do mesmo grupo (vários serviços agendados juntos). */
async function filtroDoAtendimento(tx: Tx, agendamentoId: string) {
  const ag = await tx.agendamento.findUniqueOrThrow({ where: { id: agendamentoId }, select: { id: true, grupo: true } });
  return ag.grupo ? { grupo: ag.grupo, status: { not: "CANCELADO" } } : { id: ag.id };
}

export function subtotalDosItens(itens: { quantidade: number; precoUnitCentavos: number; cobertoPorPlano: boolean; pacoteClienteId?: string | null }[]) {
  return itens.reduce((s, i) => s + (itemSemCobranca(i) ? 0 : i.quantidade * i.precoUnitCentavos), 0);
}

/** Fecha a comanda: aplica desconto e cashback, baixa estoque e conclui o agendamento. */
export async function fecharComanda(
  salaoId: string,
  comandaId: string,
  opcoes: { formaPagamento: string; descontoCentavos: number; usarCashback: boolean },
) {
  return db.$transaction(async (tx) => {
    const comanda = await comandaAberta(tx, salaoId, comandaId);
    const [itens, salao, cliente] = await Promise.all([
      tx.comandaItem.findMany({ where: { comandaId } }),
      tx.salao.findUniqueOrThrow({ where: { id: salaoId } }),
      comanda.clienteId ? tx.cliente.findUnique({ where: { id: comanda.clienteId } }) : null,
    ]);
    if (itens.length === 0) throw new ErroComanda("Adicione pelo menos um item.");

    const naFatura = opcoes.formaPagamento === "FATURA";
    const assinaturaFatura = naFatura && cliente
      ? await tx.assinatura.findFirst({ where: { clienteId: cliente.id, salaoId, status: "ATIVA", asaasId: { not: null }, canceladaEm: null, pagoAte: { gte: diaLocal() } } })
      : null;
    if (naFatura && (!assinaturaFatura || !salao.cobrancaOnlineClube || !salao.asaasApiKey))
      throw new ErroComanda("Só dá para lançar na fatura de assinantes com cobrança automática do clube.");

    const subtotal = subtotalDosItens(itens);
    const desconto = Math.min(Math.max(0, opcoes.descontoCentavos), subtotal);
    const cashbackUsado =
      opcoes.usarCashback && cliente ? Math.min(cliente.saldoCashbackCentavos, subtotal - desconto) : 0;
    const total = subtotal - desconto - cashbackUsado;
    const cashbackGerado = cliente ? Math.floor((total * salao.cashbackPct) / 100) : 0;

    for (const item of itens) {
      if (item.tipo !== "PRODUTO" || !item.produtoId) continue;
      await movimentarEstoque(tx, {
        produtoId: item.produtoId,
        filialId: comanda.filialId,
        quantidade: -item.quantidade,
        tipo: "VENDA",
        observacao: `Comanda #${comanda.numero}`,
      });
    }
    // Pacotes vendidos nesta comanda: libera as sessões para o cliente
    for (const item of itens) {
      if (item.tipo !== "PACOTE" || !item.pacoteId || !comanda.clienteId) continue;
      const pacote = await tx.pacote.findUniqueOrThrow({ where: { id: item.pacoteId } });
      await tx.pacoteCliente.create({
        data: {
          salaoId,
          clienteId: comanda.clienteId,
          pacoteId: pacote.id,
          servicoId: pacote.servicoId,
          sessoes: pacote.sessoes * item.quantidade,
          valorCentavos: item.quantidade * item.precoUnitCentavos,
          validoAte: pacote.validadeDias ? somarDias(diaLocal(), pacote.validadeDias) : null,
          itemVendaId: item.id,
        },
      });
    }
    if (cliente && (cashbackUsado || cashbackGerado)) {
      // só desconta se o saldo ainda cobre (dois fechamentos ao mesmo tempo não usam o mesmo crédito duas vezes)
      const r = await tx.cliente.updateMany({
        where: { id: cliente.id, saldoCashbackCentavos: { gte: cashbackUsado } },
        data: { saldoCashbackCentavos: { increment: cashbackGerado - cashbackUsado } },
      });
      if (r.count === 0) throw new ErroComanda("O saldo de cashback do cliente mudou. Tente fechar de novo.");
    }
    if (comanda.agendamentoId) {
      await tx.agendamento.updateMany({
        where: await filtroDoAtendimento(tx, comanda.agendamentoId),
        data: { status: "CONCLUIDO", checkinAutoEm: null, formaPagamento: total > 0 ? opcoes.formaPagamento : null },
      });
    }
    if (naFatura && total <= 0) throw new ErroComanda("Não há valor para lançar na fatura.");
    const caixa = await tx.caixa.findFirst({ where: { filialId: comanda.filialId, fechadoEm: null } });
    if (assinaturaFatura) {
      const nomes = itens.filter((i) => !itemSemCobranca(i)).map((i) => (i.quantidade > 1 ? `${i.quantidade}x ${i.descricao}` : i.descricao));
      await tx.extraFatura.create({
        data: { salaoId, assinaturaId: assinaturaFatura.id, comandaId, valorCentavos: total, descricao: `Comanda #${comanda.numero}: ${nomes.join(", ")}`.slice(0, 200) },
      });
    }
    return tx.comanda.update({
      where: { id: comandaId },
      data: {
        status: "FECHADA",
        fechadaEm: new Date(),
        descontoCentavos: desconto,
        cashbackUsadoCentavos: cashbackUsado,
        cashbackGeradoCentavos: cashbackGerado,
        totalCentavos: total,
        formaPagamento: total > 0 ? opcoes.formaPagamento : "SEM_COBRANCA",
        caixaId: caixa?.id ?? comanda.caixaId,
      },
    });
  });
}

/** Cancela a comanda. Se já estava fechada, devolve estoque e cashback. */
export async function cancelarComanda(salaoId: string, comandaId: string) {
  return db.$transaction(async (tx) => {
    const comanda = await tx.comanda.findFirst({ where: { id: comandaId, salaoId }, include: { itens: true } });
    if (!comanda || comanda.status === "CANCELADA") throw new ErroComanda("Comanda não encontrada.");

    if (comanda.status === "FECHADA") {
      // Pacote vendido nesta comanda: só dá para estornar se nenhuma sessão foi usada
      const vendidos = await tx.pacoteCliente.findMany({
        where: { itemVendaId: { in: comanda.itens.map((i) => i.id) } },
        include: { _count: { select: { sessoesUsadas: { where: { comanda: { status: { not: "CANCELADA" } } } } } } },
      });
      if (vendidos.some((p) => p._count.sessoesUsadas > 0))
        throw new ErroComanda("O pacote vendido nesta comanda já teve sessões usadas. Cancele primeiro as comandas dessas sessões.");
      await tx.pacoteCliente.updateMany({ where: { id: { in: vendidos.map((p) => p.id) } }, data: { status: "CANCELADO" } });
      for (const item of comanda.itens) {
        if (item.tipo !== "PRODUTO" || !item.produtoId) continue;
        await movimentarEstoque(tx, {
          produtoId: item.produtoId,
          filialId: comanda.filialId,
          quantidade: item.quantidade,
          tipo: "ESTORNO",
          observacao: `Comanda #${comanda.numero} cancelada`,
        });
      }
      if (comanda.clienteId && (comanda.cashbackUsadoCentavos || comanda.cashbackGeradoCentavos)) {
        await tx.cliente.update({
          where: { id: comanda.clienteId },
          data: { saldoCashbackCentavos: { increment: comanda.cashbackUsadoCentavos - comanda.cashbackGeradoCentavos } },
        });
      }
    }
    if (comanda.agendamentoId) {
      await tx.agendamento.updateMany({
        where: await filtroDoAtendimento(tx, comanda.agendamentoId),
        data: { status: "AGENDADO", formaPagamento: null },
      });
    }
    await tx.extraFatura.updateMany({ where: { comandaId, status: "PENDENTE" }, data: { status: "CANCELADO" } });
    await tx.comanda.update({ where: { id: comandaId }, data: { status: "CANCELADA", agendamentoId: null } });
  });
}
