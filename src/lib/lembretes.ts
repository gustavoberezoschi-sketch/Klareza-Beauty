import type { Sessao } from "./auth";
import { db } from "./db";
import { type ContextoFilial, naFilial } from "./filial";
import { linkWhatsApp } from "./formato";
import { MSG_CONFIRMACAO_PADRAO, MSG_LEMBRETE_PADRAO, linkDaMensagem } from "./mensagens";
import { criarDataHora, diaLocal, somarDias } from "./tempo";

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
      servicos: g.map((x) => x.servico.nome),
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
