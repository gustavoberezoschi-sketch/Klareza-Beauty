import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { type ItemPedido, resolverItens } from "./pedido";
import { criarDataHora, diaDaSemana, horaParaMinutos, minutosParaHora } from "./tempo";

type Cliente = Prisma.TransactionClient | typeof db;

// Status que ocupam o horário do profissional. "Aguardando sinal" segura o horário por SINAL_PRAZO_MIN.
export const STATUS_OCUPADOS = ["AGUARDANDO_SINAL", "AGENDADO", "CONFIRMADO", "CONCLUIDO"];
export const SINAL_PRAZO_MIN = 30;

/** Agendamentos cujo sinal não foi pago no prazo liberam o horário. */
export async function expirarSinais(tx: Cliente = db) {
  await tx.agendamento.updateMany({
    where: { status: "AGUARDANDO_SINAL", criadoEm: { lt: new Date(Date.now() - SINAL_PRAZO_MIN * 60_000) } },
    data: { status: "CANCELADO" },
  });
}

/**
 * hora: início. profissionalIds: quem está livre (em sequência, o primeiro atende tudo).
 * atribuicao (atendimento simultâneo): a profissional de cada item, na ordem do pedido.
 */
export type Horario = { hora: string; profissionalIds: string[]; atribuicao?: string[] };

/**
 * Serviços escolhidos e profissionais ativos que fazem TODOS eles
 * (serviço sem profissionais definidos = todos fazem).
 */
export async function profissionaisQueFazem(
  salaoId: string,
  servicoIds: string[],
  tx: Cliente = db,
  profissionalId?: string | null,
  filialId?: string | null,
) {
  const servicos = await tx.servico.findMany({
    where: { id: { in: servicoIds }, salaoId, ativo: true },
    include: { profissionais: { select: { id: true } } },
  });
  if (servicos.length === 0 || servicos.length !== new Set(servicoIds).size) return { servicos: [], profissionais: [] };
  const todos = await tx.profissional.findMany({
    where: { salaoId, ativo: true, ...(profissionalId ? { id: profissionalId } : {}), ...(filialId ? { filialId } : {}) },
    orderBy: { nome: "asc" },
  });
  const profissionais = todos.filter((b) => servicos.every((s) => s.profissionais.length === 0 || s.profissionais.some((x) => x.id === b.id)));
  // mantém a ordem escolhida pelo cliente
  const ordenados = servicoIds.map((id) => servicos.find((s) => s.id === id)!);
  return { servicos: ordenados, profissionais };
}

/**
 * Lista os horários livres de um dia, numa unidade, para um ou mais serviços feitos em sequência.
 * Se profissionalId for null, considera qualquer profissional da unidade que faça os serviços ("sem preferência").
 */
export async function horariosDisponiveis(
  params: { salaoId: string; filialId: string; itens: ItemPedido[]; profissionalId: string | null; dia: string; simultaneo?: boolean },
  tx: Cliente = db,
): Promise<Horario[]> {
  const { salaoId, filialId, itens, dia } = params;
  // simultâneo: cada serviço com uma profissional diferente, todos começando juntos
  const simultaneo = !!params.simultaneo && itens.length > 1;
  const profissionalId = simultaneo ? null : params.profissionalId;
  const servicoIds = itens.map((i) => i.servicoId);
  await expirarSinais(tx);

  const [salao, funcionamento, { servicos, profissionais }, resolvidos] = await Promise.all([
    tx.salao.findUnique({ where: { id: salaoId } }),
    tx.horarioFuncionamento.findFirst({
      where: { filialId, diaSemana: diaDaSemana(dia), filial: { salaoId, ativo: true } },
    }),
    simultaneo ? profissionaisDaUnidade(salaoId, servicoIds, filialId, tx) : profissionaisQueFazem(salaoId, servicoIds, tx, profissionalId, filialId),
    resolverItens(salaoId, itens, tx).catch(() => null),
  ]);
  if (!salao || !funcionamento || !resolvidos || servicos.length === 0 || profissionais.length === 0) return [];
  const duracoes = resolvidos.map((r) => r.duracaoMin);
  const duracaoMin = simultaneo ? Math.max(...duracoes) : duracoes.reduce((s, d) => s + d, 0);

  const abertura = criarDataHora(dia, funcionamento.abre);
  const fechamento = criarDataHora(dia, funcionamento.fecha);
  const ids = profissionais.map((b) => b.id);
  const [ocupados, bloqueios] = await Promise.all([
    tx.agendamento.findMany({
      where: { profissionalId: { in: ids }, status: { in: STATUS_OCUPADOS }, inicio: { lt: fechamento }, fim: { gt: abertura } },
      select: { profissionalId: true, inicio: true, fim: true },
    }),
    tx.bloqueio.findMany({
      where: {
        salaoId,
        OR: [{ profissionalId: null, filialId: null }, { profissionalId: null, filialId }, { profissionalId: { in: ids } }],
        inicio: { lt: fechamento },
        fim: { gt: abertura },
      },
      select: { profissionalId: true, inicio: true, fim: true },
    }),
  ]);

  const agora = Date.now();
  const duracaoMs = duracaoMin * 60_000;
  const fimDoExpediente = horaParaMinutos(funcionamento.fecha);
  const horarios: Horario[] = [];

  for (let min = horaParaMinutos(funcionamento.abre); min + duracaoMin <= fimDoExpediente; min += salao.intervaloMin) {
    const hora = minutosParaHora(min);
    const inicio = criarDataHora(dia, hora).getTime();
    if (inicio <= agora) continue;
    const fim = inicio + duracaoMs;
    const sobrepoe = (a: { inicio: Date; fim: Date }) => a.inicio.getTime() < fim && a.fim.getTime() > inicio;
    if (simultaneo) {
      // quem está livre durante o serviço de cada item (cada item tem a sua duração)
      const livresPorItem = resolvidos.map((r) => {
        const fimItem = inicio + r.duracaoMin * 60_000;
        const cruza = (a: { inicio: Date; fim: Date }) => a.inicio.getTime() < fimItem && a.fim.getTime() > inicio;
        return profissionais
          .filter((b) => r.servico.profissionais.length === 0 || r.servico.profissionais.some((x) => x.id === b.id))
          .filter(
            (b) =>
              !ocupados.some((a) => a.profissionalId === b.id && cruza(a)) &&
              !bloqueios.some((x) => (x.profissionalId === null || x.profissionalId === b.id) && cruza(x)),
          )
          .map((b) => b.id);
      });
      const atribuicao = atribuirDistintas(livresPorItem);
      if (atribuicao) horarios.push({ hora, profissionalIds: atribuicao, atribuicao });
      continue;
    }
    const livres = profissionais
      .filter(
        (b) =>
          !ocupados.some((a) => a.profissionalId === b.id && sobrepoe(a)) &&
          !bloqueios.some((x) => (x.profissionalId === null || x.profissionalId === b.id) && sobrepoe(x)),
      )
      .map((b) => b.id);
    if (livres.length > 0) horarios.push({ hora, profissionalIds: livres });
  }
  return horarios;
}

/** Profissionais ativas da unidade que fazem pelo menos um dos serviços (para o atendimento simultâneo). */
async function profissionaisDaUnidade(salaoId: string, servicoIds: string[], filialId: string, tx: Cliente) {
  const servicos = await tx.servico.findMany({ where: { id: { in: servicoIds }, salaoId, ativo: true }, include: { profissionais: { select: { id: true } } } });
  if (servicos.length !== new Set(servicoIds).size) return { servicos: [], profissionais: [] };
  const todos = await tx.profissional.findMany({ where: { salaoId, ativo: true, filialId }, orderBy: { nome: "asc" } });
  const profissionais = todos.filter((b) => servicos.some((s) => s.profissionais.length === 0 || s.profissionais.some((x) => x.id === b.id)));
  return { servicos, profissionais };
}

/** Uma profissional diferente para cada item (busca com volta atrás; são poucos itens). */
export function atribuirDistintas(opcoesPorItem: string[][]): string[] | null {
  const escolha: string[] = [];
  const usadas = new Set<string>();
  const tentar = (i: number): boolean => {
    if (i === opcoesPorItem.length) return true;
    for (const id of opcoesPorItem[i]) {
      if (usadas.has(id)) continue;
      usadas.add(id);
      escolha[i] = id;
      if (tentar(i + 1)) return true;
      usadas.delete(id);
    }
    return false;
  };
  return tentar(0) ? [...escolha] : null;
}

/** Verifica se o profissional tem agendamento ou bloqueio que se sobrepõe ao intervalo. */
export async function temConflito(
  profissionalId: string,
  inicio: Date,
  fim: Date,
  tx: Cliente = db,
  ignorarId?: string,
): Promise<"agendamento" | "bloqueio" | null> {
  const profissional = await tx.profissional.findUniqueOrThrow({ where: { id: profissionalId }, select: { salaoId: true, filialId: true } });
  const [agendamento, bloqueio] = await Promise.all([
    tx.agendamento.findFirst({
      where: {
        profissionalId,
        status: { in: STATUS_OCUPADOS },
        inicio: { lt: fim },
        fim: { gt: inicio },
        ...(ignorarId ? { id: { not: ignorarId } } : {}),
      },
      select: { id: true },
    }),
    tx.bloqueio.findFirst({
      where: {
        salaoId: profissional.salaoId,
        OR: [{ profissionalId: null, filialId: null }, { profissionalId: null, filialId: profissional.filialId }, { profissionalId }],
        inicio: { lt: fim },
        fim: { gt: inicio },
      },
      select: { id: true },
    }),
  ]);
  return agendamento ? "agendamento" : bloqueio ? "bloqueio" : null;
}

/** Encontra o cliente pelo telefone ou cria um novo. */
export async function obterOuCriarCliente(salaoId: string, nome: string, telefone: string, tx: Cliente = db) {
  return tx.cliente.upsert({
    where: { salaoId_telefone: { salaoId, telefone } },
    update: {},
    create: { salaoId, nome, telefone },
  });
}

export class ErroAgendamento extends Error {}

/** O cliente já tem um horário em aberto: só marca outro depois que esse passar ou for cancelado. */
export class ErroJaAgendado extends Error {
  constructor(public token: string, mensagem: string) {
    super(mensagem);
  }
}

/** Próximo horário do cliente que ainda não aconteceu (agendado ou confirmado). */
export async function horarioEmAberto(clienteId: string, tx: Prisma.TransactionClient | typeof db = db) {
  return tx.agendamento.findFirst({
    where: { clienteId, status: { in: ["AGUARDANDO_SINAL", "AGENDADO", "CONFIRMADO"] }, fim: { gt: new Date() } },
    orderBy: { inicio: "asc" },
    include: { profissional: { select: { nome: true } }, servico: { select: { nome: true } } },
  });
}

/**
 * Executa a função numa transação com trava exclusiva do salão, para que dois
 * agendamentos simultâneos não reservem o mesmo horário.
 */
export async function comTravaDaAgenda<T>(salaoId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${salaoId}))`;
    return fn(tx);
  });
}

/**
 * Agendamento feito pelo cliente na página pública. Revalida o horário dentro da transação.
 * Em sequência: os serviços viram agendamentos seguidos com a mesma profissional, ligados pelo "grupo".
 * Simultâneo: todos começam juntos, cada um com uma profissional (também no mesmo grupo).
 * Com sinal, os agendamentos nascem "aguardando sinal" e seguram o horário por SINAL_PRAZO_MIN.
 */
export async function reservarOnline(params: {
  salaoId: string;
  filialId: string;
  itens: ItemPedido[];
  profissionalId: string | null;
  simultaneo?: boolean;
  dia: string;
  hora: string;
  cliente: { id: string } | { nome: string; telefone: string };
  aguardandoSinal?: boolean;
  /** chamado com o cliente já identificado, antes de criar (ex.: registrar indicação) */
  aoIdentificar?: (clienteId: string, novo: boolean, tx: Prisma.TransactionClient) => Promise<void>;
}) {
  return comTravaDaAgenda(params.salaoId, async (tx) => {
    const horarios = await horariosDisponiveis(params, tx);
    const escolhido = horarios.find((h) => h.hora === params.hora);
    if (!escolhido) throw new ErroAgendamento("Esse horário acabou de ser ocupado. Escolha outro.");

    let clienteId: string;
    let novo = false;
    if ("id" in params.cliente) clienteId = params.cliente.id;
    else {
      const existente = await tx.cliente.findUnique({ where: { salaoId_telefone: { salaoId: params.salaoId, telefone: params.cliente.telefone } } });
      novo = !existente;
      clienteId = (existente ?? (await obterOuCriarCliente(params.salaoId, params.cliente.nome, params.cliente.telefone, tx))).id;
    }
    // um horário por vez: dentro da trava, para dois cliques seguidos não passarem juntos
    const aberto = await horarioEmAberto(clienteId, tx);
    if (aberto)
      throw new ErroJaAgendado(
        aberto.token,
        `Você já tem um horário marcado: ${formatarQuando(aberto.inicio)}. Para marcar outro, cancele ou remarque esse primeiro.`,
      );
    // preço com o cliente identificado (manutenção por prazo); passou do prazo, não agenda
    const itens = await resolverItens(params.salaoId, params.itens, tx, { clienteId, manutencaoVencida: "erro", somenteOnline: true });
    await params.aoIdentificar?.(clienteId, novo, tx);

    const grupo = itens.length > 1 ? crypto.randomUUID() : null;
    const simultaneo = !!escolhido.atribuicao;
    const inicioPedido = criarDataHora(params.dia, params.hora);
    let inicio = inicioPedido;
    const criados = [];
    for (const [i, item] of itens.entries()) {
      const comeca = simultaneo ? inicioPedido : inicio;
      const fim = new Date(comeca.getTime() + item.duracaoMin * 60_000);
      criados.push(
        await tx.agendamento.create({
          data: {
            salaoId: params.salaoId,
            filialId: params.filialId,
            profissionalId: simultaneo ? escolhido.atribuicao![i] : escolhido.profissionalIds[0],
            servicoId: item.servico.id,
            clienteId,
            inicio: comeca,
            fim,
            precoCentavos: item.precoCentavos,
            opcoes: item.opcoes.length ? item.opcoes : undefined,
            origem: "ONLINE",
            status: params.aguardandoSinal ? "AGUARDANDO_SINAL" : "AGENDADO",
            grupo,
          },
          include: { profissional: true, servico: true },
        }),
      );
      inicio = fim;
    }
    return { criados, itens, clienteId, novo };
  });
}

/**
 * Check-in automático: quando o horário termina, o agendamento vira "concluído" sozinho,
 * sem o profissional confirmar presença. O profissional ainda pode marcar "faltou" depois (só para estatística).
 */
export async function checkinAutomatico(salaoId?: string) {
  const agora = new Date();
  await db.agendamento.updateMany({
    where: { ...(salaoId ? { salaoId } : {}), status: { in: ["AGENDADO", "CONFIRMADO"] }, fim: { lt: agora } },
    data: { status: "CONCLUIDO", checkinAutoEm: agora },
  });
}

/** "sábado, 17/10 às 10:00" (fuso do salão). */
export function formatarQuando(data: Date) {
  const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit" }).format(data);
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(data);
  return `${dia} às ${hora}`;
}
