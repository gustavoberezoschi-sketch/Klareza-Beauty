import webpush from "web-push";
import { cifrar, decifrar } from "./cripto";
import { db } from "./db";
import { criarDataHora, diaLocal, horaLocal, somarDias } from "./tempo";

// Notificações do app (Web Push). As chaves VAPID são criadas no primeiro uso e guardadas
// no banco (a privada criptografada), sem precisar configurar nada na Vercel.

const CONTATO = "mailto:gustavoberezoschi@gmail.com";

export async function chavesVapid() {
  const config = await db.configSistema.findUnique({ where: { id: "geral" } });
  if (config?.vapidPublica && config.vapidPrivada) return { publica: config.vapidPublica, privada: decifrar(config.vapidPrivada) };
  const novas = webpush.generateVAPIDKeys();
  const salvo = await db.configSistema.upsert({
    where: { id: "geral" },
    create: { id: "geral", vapidPublica: novas.publicKey, vapidPrivada: cifrar(novas.privateKey) },
    update: {},
  });
  // se outra requisição criou as chaves ao mesmo tempo, vale a que ficou no banco
  if (salvo.vapidPublica && salvo.vapidPrivada) return { publica: salvo.vapidPublica, privada: decifrar(salvo.vapidPrivada) };
  await db.configSistema.update({ where: { id: "geral" }, data: { vapidPublica: novas.publicKey, vapidPrivada: cifrar(novas.privateKey) } });
  return { publica: novas.publicKey, privada: novas.privateKey };
}

export type Notificacao = { titulo: string; texto: string; url: string; icone?: string; endpoint?: string };

/** Envia para todos os celulares inscritos do cliente. Devolve quantos receberam. */
export async function notificarCliente(clienteId: string, { endpoint, ...n }: Notificacao) {
  // com endpoint: só aquele aparelho (aviso de teste ao ativar)
  const inscricoes = await db.pushInscricao.findMany({ where: { clienteId, ...(endpoint ? { endpoint } : {}) } });
  if (!inscricoes.length) return 0;
  const { publica, privada } = await chavesVapid();
  let enviados = 0;
  for (const i of inscricoes) {
    try {
      await webpush.sendNotification(
        { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
        JSON.stringify(n),
        { vapidDetails: { subject: CONTATO, publicKey: publica, privateKey: privada }, TTL: 60 * 60 * 12 },
      );
      enviados++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.pushInscricao.delete({ where: { id: i.id } }).catch(() => null); // celular desinstalou ou bloqueou
    }
  }
  return enviados;
}

/** Lembrete no app para os horários de amanhã (cada atendimento recebe uma vez só). */
export async function enviarLembretesDeAmanha() {
  const amanha = somarDias(diaLocal(), 1);
  const agendamentos = await db.agendamento.findMany({
    where: {
      inicio: { gte: criarDataHora(amanha, "00:00"), lt: criarDataHora(somarDias(amanha, 1), "00:00") },
      status: { in: ["AGENDADO", "CONFIRMADO"] },
      pushLembreteEm: null,
      cliente: { inscricoesPush: { some: {} } },
      salao: { suspensa: false },
    },
    include: { salao: { select: { nome: true, slug: true } }, profissional: { select: { nome: true } }, servico: { select: { nome: true } } },
    orderBy: { inicio: "asc" },
  });
  // vários serviços em sequência (mesmo grupo) viram um lembrete só
  const vistos = new Set<string>();
  let enviados = 0;
  for (const a of agendamentos) {
    const chave = a.grupo ?? a.id;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const doGrupo = a.grupo ? agendamentos.filter((x) => x.grupo === a.grupo) : [a];
    const servicos = doGrupo.map((x) => x.servico.nome).join(" + ");
    const ok = await notificarCliente(a.clienteId, {
      titulo: `Amanhã às ${horaLocal(a.inicio)} no ${a.salao.nome}`,
      texto: `${servicos} com ${a.profissional.nome.split(" ")[0]}. Toque para confirmar ou remarcar.`,
      url: `/b/${a.salao.slug}/agendamento/${a.token}`,
      icone: `/b/${a.salao.slug}/icone/192`,
    });
    await db.agendamento.updateMany({ where: { id: { in: doGrupo.map((x) => x.id) } }, data: { pushLembreteEm: new Date() } });
    enviados += ok;
  }
  return { atendimentos: vistos.size, enviados };
}
