import type { Sessao } from "./auth";
import { descreverItem, lerOpcoes } from "./pedido";
import { db } from "./db";
import { type ContextoFilial, naFilial } from "./filial";
import { linkWhatsApp } from "./formato";
import { MSG_CONFIRMACAO_PADRAO, MSG_LEMBRETE_PADRAO, linkDaMensagem } from "./mensagens";
import { horariosDisponiveis } from "./agenda";
import { criarDataHora, diaLocal, formatarDia, horaParaMinutos, somarDias } from "./tempo";

export type ItemLembrete = {
  ids: string[];
  inicio: Date;
  cliente: string;
  telefone: string;
  servicos: string[];
  profissional: string;
  unidade: string;
  status: string;
  lembreteEnviadoEm: string | null;
  confirmacaoEnviadaEm: string | null;
  linkLembrete: string;
  linkConfirmacao: string;
};

/** Atendimentos de hoje e amanhã (para lembrar) e novos agendamentos pelo site (para confirmar). */
export async function listaDeLembretes(sessao: Sessao, ctx: ContextoFilial, site: string) {
  const hoje = diaLocal();
  const depoisDeAmanha = criarDataHora(somarDias(hoje, 2), "00:00");
  const agora = new Date();
  const [salao, ags] = await Promise.all([
    db.salao.findUniqueOrThrow({ where: { id: sessao.salaoId }, select: { nome: true, slug: true, msgLembrete: true, msgConfirmacao: true } }),
    db.agendamento.findMany({
      where: {
        salaoId: sessao.salaoId,
        ...naFilial(ctx),
        ...(sessao.profissionalId ? { profissionalId: sessao.profissionalId } : {}),
        status: { in: ["AGENDADO", "CONFIRMADO"] },
        fim: { gt: agora },
        OR: [{ inicio: { lt: depoisDeAmanha } }, { origem: "ONLINE", confirmacaoEnviadaEm: null }],
      },
      include: { cliente: true, servico: true, profissional: true, filial: true },
      orderBy: { inicio: "asc" },
      take: 300,
    }),
  ]);

  const grupos = new Map<string, typeof ags>();
  for (const a of ags) grupos.set(a.grupo ?? a.id, [...(grupos.get(a.grupo ?? a.id) ?? []), a]);

  const itens: ItemLembrete[] = [...grupos.values()].map((g) => {
    const a = g[0];
    const dados = {
      cliente: a.cliente.nome,
      salao: salao.nome,
      inicio: a.inicio,
      servicos: g.map((x) => descreverItem(x.servico.nome, lerOpcoes(x.opcoes))),
      profissional: a.profissional.nome,
      unidade: a.filial.nome,
      endereco: a.filial.endereco,
      link: `${site}/b/${salao.slug}/agendamento/${a.token}`,
    };
    return {
      ids: g.map((x) => x.id),
      inicio: a.inicio,
      cliente: a.cliente.nome,
      telefone: a.cliente.telefone,
      servicos: dados.servicos,
      profissional: a.profissional.nome,
      unidade: a.filial.nome,
      status: a.status,
      lembreteEnviadoEm: a.lembreteEnviadoEm?.toISOString() ?? null,
      confirmacaoEnviadaEm: a.confirmacaoEnviadaEm?.toISOString() ?? null,
      linkLembrete: linkDaMensagem(a.cliente.telefone, salao.msgLembrete ?? MSG_LEMBRETE_PADRAO, dados),
      linkConfirmacao: linkDaMensagem(a.cliente.telefone, salao.msgConfirmacao ?? MSG_CONFIRMACAO_PADRAO, dados),
    };
  });
  const origemOnline = new Set(ags.filter((a) => a.origem === "ONLINE").map((a) => a.id));

  return {
    salao,
    hoje: itens.filter((i) => diaLocal(i.inicio) === hoje),
    amanha: itens.filter((i) => diaLocal(i.inicio) === somarDias(hoje, 1)),
    // Quem já confirmou (pelo link ou no balcão) não precisa da mensagem de confirmação.
    novos: itens.filter((i) => i.ids.some((id) => origemOnline.has(id)) && !i.confirmacaoEnviadaEm && i.status === "AGENDADO"),
  };
}

export type ItemRetorno = {
  clienteId: string;
  cliente: string;
  telefone: string;
  servico: string;
  ultimaVez: string; // "2026-10-01"
  vence: string; // dia em que a manutenção vence
  dias: number; // dias desde o último atendimento
  lembradoEm: string | null;
  link: string;
};

/**
 * Clientes na hora da manutenção: o último atendimento de um serviço com "retorno em X dias"
 * vence entre 14 dias atrás e daqui a 3 dias, e o cliente não tem horário marcado.
 */
export async function listaDeRetornos(sessao: Sessao, ctx: ContextoFilial, site: string): Promise<ItemRetorno[]> {
  const hoje = diaLocal();
  const salao = await db.salao.findUniqueOrThrow({ where: { id: sessao.salaoId }, select: { nome: true, slug: true } });
  const itens = await db.comandaItem.findMany({
    where: {
      tipo: "SERVICO",
      servico: { retornoDias: { not: null } },
      ...(sessao.profissionalId ? { profissionalId: sessao.profissionalId } : {}),
      comanda: {
        salaoId: sessao.salaoId,
        ...naFilial(ctx),
        status: "FECHADA",
        clienteId: { not: null },
        fechadaEm: { gte: criarDataHora(somarDias(hoje, -400), "00:00") },
      },
    },
    select: {
      servico: { select: { nome: true, retornoDias: true } },
      comanda: { select: { fechadaEm: true, cliente: { select: { id: true, nome: true, telefone: true, retornoLembradoEm: true } } } },
    },
    orderBy: { comanda: { fechadaEm: "desc" } },
    take: 3000,
  });

  // último atendimento de cada cliente (o mais recente entre os serviços com retorno)
  const ultimo = new Map<string, (typeof itens)[number]>();
  for (const i of itens) if (i.comanda.cliente && !ultimo.has(i.comanda.cliente.id)) ultimo.set(i.comanda.cliente.id, i);

  const candidatos = [...ultimo.values()].filter((i) => {
    const vence = somarDias(diaLocal(i.comanda.fechadaEm!), i.servico!.retornoDias!);
    return vence >= somarDias(hoje, -14) && vence <= somarDias(hoje, 3);
  });
  const comHorario = new Set(
    (
      await db.agendamento.findMany({
        where: { salaoId: sessao.salaoId, clienteId: { in: candidatos.map((i) => i.comanda.cliente!.id) }, status: { in: ["AGENDADO", "CONFIRMADO"] }, inicio: { gt: new Date() } },
        select: { clienteId: true },
      })
    ).map((a) => a.clienteId),
  );

  return candidatos
    .filter((i) => !comHorario.has(i.comanda.cliente!.id))
    .map((i) => {
      const c = i.comanda.cliente!;
      const ultimaVez = diaLocal(i.comanda.fechadaEm!);
      const dias = Math.round((new Date(`${hoje}T12:00:00Z`).getTime() - new Date(`${ultimaVez}T12:00:00Z`).getTime()) / 864e5);
      const texto = `Oi, ${c.nome.split(" ")[0]}! Já se passaram ${dias} dias desde o seu último atendimento de ${i.servico!.nome.toLowerCase()} com a gente ✨ Está na hora da manutenção. Quer agendar? ${site}/b/${salao.slug}\n\n${salao.nome}`;
      return {
        clienteId: c.id,
        cliente: c.nome,
        telefone: c.telefone,
        servico: i.servico!.nome,
        ultimaVez,
        vence: somarDias(ultimaVez, i.servico!.retornoDias!),
        dias,
        // só conta como enviado se o aviso foi depois do último atendimento
        lembradoEm: c.retornoLembradoEm && c.retornoLembradoEm > i.comanda.fechadaEm! ? c.retornoLembradoEm.toISOString() : null,
        link: linkWhatsApp(c.telefone, texto),
      };
    })
    .sort((a, b) => a.vence.localeCompare(b.vence));
}

export type ItemEspera = {
  id: string;
  nome: string;
  telefone: string;
  dia: string;
  periodo: string;
  servicos: string;
  horarios: string[]; // horários livres agora, no período pedido
  avisadoEm: string | null;
  link: string;
};

const PERIODOS: Record<string, [number, number]> = { MANHA: [0, 12 * 60], TARDE: [12 * 60, 18 * 60], NOITE: [18 * 60, 24 * 60], QUALQUER: [0, 24 * 60] };
export const NOME_PERIODO: Record<string, string> = { MANHA: "de manhã", TARDE: "à tarde", NOITE: "à noite", QUALQUER: "qualquer horário" };

/** Lista de espera de hoje em diante, com os horários que abriram desde o pedido. */
export async function listaDeEspera(sessao: Sessao, ctx: ContextoFilial, site: string): Promise<ItemEspera[]> {
  const hoje = diaLocal();
  const [salao, pedidos] = await Promise.all([
    db.salao.findUniqueOrThrow({ where: { id: sessao.salaoId }, select: { nome: true, slug: true } }),
    db.listaEspera.findMany({ where: { salaoId: sessao.salaoId, ...naFilial(ctx), dia: { gte: hoje } }, orderBy: [{ dia: "asc" }, { criadoEm: "asc" }], take: 40 }),
  ]);
  const servicos = await db.servico.findMany({ where: { id: { in: [...new Set(pedidos.flatMap((p) => p.servicoIds))] } }, select: { id: true, nome: true } });
  const itens: ItemEspera[] = [];
  for (const p of pedidos) {
    const livres = await horariosDisponiveis({ salaoId: sessao.salaoId, filialId: p.filialId, itens: p.servicoIds.map((servicoId) => ({ servicoId })), profissionalId: null, dia: p.dia }).catch(() => []);
    const [de, ate] = PERIODOS[p.periodo] ?? PERIODOS.QUALQUER;
    const horarios = livres.map((h) => h.hora).filter((h) => horaParaMinutos(h) >= de && horaParaMinutos(h) < ate);
    const nomes = p.servicoIds.map((id) => servicos.find((s) => s.id === id)?.nome).filter(Boolean).join(" + ");
    const quando = formatarDia(p.dia).slice(0, 5);
    const texto = `Oi, ${p.nome.split(" ")[0]}! Abriu horário no dia ${quando} para ${nomes || "o seu atendimento"} aqui no ${salao.nome}${horarios.length ? ` (${horarios.slice(0, 4).join(", ")})` : ""} ✨ Quer garantir? Agende pelo link: ${site}/b/${salao.slug}/agendar`;
    itens.push({ id: p.id, nome: p.nome, telefone: p.telefone, dia: p.dia, periodo: p.periodo, servicos: nomes, horarios, avisadoEm: p.avisadoEm?.toISOString() ?? null, link: linkWhatsApp(p.telefone, texto) });
  }
  // quem tem horário livre primeiro
  return itens.sort((a, b) => Number(b.horarios.length > 0) - Number(a.horarios.length > 0) || a.dia.localeCompare(b.dia));
}

export type ItemCuidados = { comandaId: string; cliente: string; telefone: string; servicos: string; fechadaEm: string; enviadoEm: string | null; link: string };

/** Atendimentos de hoje e de ontem com cuidados pós-atendimento para mandar ao cliente. */
export async function listaDeCuidados(sessao: Sessao, ctx: ContextoFilial): Promise<ItemCuidados[]> {
  const desde = criarDataHora(somarDias(diaLocal(), -1), "00:00");
  const [salao, comandas] = await Promise.all([
    db.salao.findUniqueOrThrow({ where: { id: sessao.salaoId }, select: { nome: true, linkAvaliacao: true } }),
    db.comanda.findMany({
      where: {
        salaoId: sessao.salaoId,
        ...naFilial(ctx),
        ...(sessao.profissionalId ? { profissionalId: sessao.profissionalId } : {}),
        status: "FECHADA",
        fechadaEm: { gte: desde },
        clienteId: { not: null },
        itens: { some: { servico: { cuidados: { not: null } } } },
      },
      include: { cliente: true, itens: { include: { servico: { select: { nome: true, cuidados: true } } } } },
      orderBy: { fechadaEm: "desc" },
      take: 60,
    }),
  ]);
  return comandas.map((c) => {
    const comCuidados = c.itens.filter((i) => i.servico?.cuidados);
    const unicos = [...new Map(comCuidados.map((i) => [i.servico!.nome, i.servico!.cuidados!])).entries()];
    const texto = [
      `Oi, ${c.cliente!.nome.split(" ")[0]}! Obrigada pela visita ao ${salao.nome} ✨`,
      "",
      ...unicos.map(([nome, cuidados]) => `*Cuidados com ${nome.toLowerCase()}:*\n${cuidados}`),
      "",
      "Se puder, manda uma foto do resultado pra gente 📸",
      ...(salao.linkAvaliacao ? [`E se gostou, sua avaliação ajuda muito: ${salao.linkAvaliacao}`] : []),
    ].join("\n");
    return {
      comandaId: c.id,
      cliente: c.cliente!.nome,
      telefone: c.cliente!.telefone,
      servicos: unicos.map(([n]) => n).join(", "),
      fechadaEm: c.fechadaEm!.toISOString(),
      enviadoEm: c.cuidadosEnviadosEm?.toISOString() ?? null,
      link: linkWhatsApp(c.cliente!.telefone, texto),
    };
  });
}
