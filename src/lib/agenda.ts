import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { criarDataHora, diaDaSemana, horaParaMinutos, minutosParaHora } from "./tempo";

type Cliente = Prisma.TransactionClient | typeof db;

// Status que ocupam o horário do profissional.
export const STATUS_OCUPADOS = ["AGENDADO", "CONFIRMADO", "CONCLUIDO"];

export type Horario = { hora: string; profissionalIds: string[] };

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
  params: { salaoId: string; filialId: string; servicoIds: string[]; profissionalId: string | null; dia: string },
  tx: Cliente = db,
): Promise<Horario[]> {
  const { salaoId, filialId, servicoIds, profissionalId, dia } = params;

  const [salao, funcionamento, { servicos, profissionais }] = await Promise.all([
    tx.salao.findUnique({ where: { id: salaoId } }),
    tx.horarioFuncionamento.findFirst({
      where: { filialId, diaSemana: diaDaSemana(dia), filial: { salaoId, ativo: true } },
    }),
    profissionaisQueFazem(salaoId, servicoIds, tx, profissionalId, filialId),
  ]);
  if (!salao || !funcionamento || servicos.length === 0 || profissionais.length === 0) return [];
  const duracaoMin = servicos.reduce((s, x) => s + x.duracaoMin, 0);

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
    where: { clienteId, status: { in: ["AGENDADO", "CONFIRMADO"] }, fim: { gt: new Date() } },
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
 * Vários serviços viram agendamentos em sequência com o mesmo profissional, ligados pelo "grupo".
 */
export async function reservarOnline(params: {
  salaoId: string;
  filialId: string;
  servicoIds: string[];
  profissionalId: string | null;
  dia: string;
  hora: string;
  cliente: { id: string } | { nome: string; telefone: string };
}) {
  return comTravaDaAgenda(params.salaoId, async (tx) => {
    const horarios = await horariosDisponiveis(params, tx);
    const escolhido = horarios.find((h) => h.hora === params.hora);
    if (!escolhido) throw new ErroAgendamento("Esse horário acabou de ser ocupado. Escolha outro.");

    const { servicos } = await profissionaisQueFazem(params.salaoId, params.servicoIds, tx);
    const clienteId =
      "id" in params.cliente
        ? params.cliente.id
        : (await obterOuCriarCliente(params.salaoId, params.cliente.nome, params.cliente.telefone, tx)).id;
    // um horário por vez: dentro da trava, para dois cliques seguidos não passarem juntos
    const aberto = await horarioEmAberto(clienteId, tx);
    if (aberto)
      throw new ErroJaAgendado(
        aberto.token,
        `Você já tem um horário marcado: ${formatarQuando(aberto.inicio)}. Para marcar outro, cancele ou remarque esse primeiro.`,
      );
    const grupo = servicos.length > 1 ? crypto.randomUUID() : null;
    const profissionalId = escolhido.profissionalIds[0];

    let inicio = criarDataHora(params.dia, params.hora);
    const criados = [];
    for (const servico of servicos) {
      const fim = new Date(inicio.getTime() + servico.duracaoMin * 60_000);
      criados.push(
        await tx.agendamento.create({
          data: {
            salaoId: params.salaoId,
            filialId: params.filialId,
            profissionalId,
            servicoId: servico.id,
            clienteId,
            inicio,
            fim,
            precoCentavos: servico.precoCentavos,
            origem: "ONLINE",
            grupo,
          },
          include: { profissional: true, servico: true },
        }),
      );
      inicio = fim;
    }
    return criados;
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
