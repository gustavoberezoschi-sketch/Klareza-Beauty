import { db } from "./db";
import { planoDoCliente } from "./publico";

/**
 * Agendamentos do cliente agrupados por atendimento (vários serviços juntos = um cartão),
 * com o total: o valor pago na comanda, se houver; senão o previsto (descontando o plano).
 */
export async function atendimentosDoCliente(clienteId: string, filtro: "futuros" | "anteriores", limite = 50) {
  const agora = new Date();
  const ags = await db.agendamento.findMany({
    where: {
      clienteId,
      ...(filtro === "futuros"
        ? { fim: { gte: agora }, status: { in: ["AGENDADO", "CONFIRMADO"] } }
        : { OR: [{ fim: { lt: agora } }, { status: { in: ["CONCLUIDO", "CANCELADO", "FALTOU"] } }] }),
    },
    include: { servico: true, profissional: true, comanda: true, filial: { select: { nome: true } } },
    orderBy: { inicio: filtro === "futuros" ? "asc" : "desc" },
    take: limite * 3,
  });
  const plano = filtro === "futuros" ? await planoDoCliente(clienteId) : null;
  const cliente = await db.cliente.findUniqueOrThrow({ where: { id: clienteId }, select: { salaoId: true } });
  const variasUnidades = (await db.filial.count({ where: { salaoId: cliente.salaoId, ativo: true } })) > 1;
  let restantes = plano?.restantes ?? Infinity;

  const grupos = new Map<string, typeof ags>();
  for (const a of ags) {
    const chave = a.grupo ?? a.id;
    grupos.set(chave, [...(grupos.get(chave) ?? []), a]);
  }
  return [...grupos.values()].slice(0, limite).map((itens) => {
    itens.sort((x, y) => x.inicio.getTime() - y.inicio.getTime());
    const comanda = itens.find((i) => i.comanda && i.comanda.status === "FECHADA")?.comanda;
    let total = 0;
    if (comanda) total = comanda.totalCentavos;
    else
      for (const i of itens) {
        if (plano?.servicoIds.includes(i.servicoId) && restantes > 0) restantes--;
        else total += i.precoCentavos;
      }
    return {
      token: itens[0].token,
      inicio: itens[0].inicio,
      servicos: itens.map((i) => i.servico.nome),
      profissional: itens[0].profissional.nome,
      unidade: variasUnidades ? itens[0].filial.nome : null,
      total,
      status: itens[0].status,
    };
  });
}
