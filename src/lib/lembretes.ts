import type { Sessao } from "./auth";
import { db } from "./db";
import { type ContextoFilial, naFilial } from "./filial";
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
