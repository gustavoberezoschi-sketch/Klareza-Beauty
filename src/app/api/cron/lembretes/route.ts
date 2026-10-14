import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { limparVariavel } from "@/lib/env";
import { checkinAutomatico } from "@/lib/agenda";
import { statusDaSubconta } from "@/lib/asaas";
import { db } from "@/lib/db";
import { enviarLembretesDeAmanha } from "@/lib/push";
import { recifrarSegredosAntigos } from "@/lib/cofre";
import { limparTentativasAntigas } from "@/lib/limite";
import { saquesAutomaticos } from "@/lib/saques";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Chamado pela Vercel todo dia às 18h de Brasília (vercel.json → crons): lembretes no app, manutenção das contas do Asaas e saques automáticos.
// Se CRON_SECRET estiver configurada, a Vercel manda "Authorization: Bearer <CRON_SECRET>".
// Sem ela a rota continua segura de repetir: cada atendimento recebe o lembrete uma vez só.
export async function GET(req: Request) {
  const segredo = limparVariavel(process.env.CRON_SECRET);
  const autorizado = !!segredo && iguais(req.headers.get("authorization") ?? "", `Bearer ${segredo}`);
  if (segredo && !autorizado) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  await checkinAutomatico();
  const r = await enviarLembretesDeAmanha();
  await limparTentativasAntigas();
  // Sem CRON_SECRET a rota é pública: faz só o que é inofensivo repetir (lembrete uma vez por atendimento, check-in).
  // Saques e consultas ao Asaas só com o segredo, para ninguém disparar saques chamando a URL.
  if (!autorizado) return NextResponse.json({ ok: true, ...r, aviso: "Configure CRON_SECRET na Vercel para ligar saques automáticos." });
  await recifrarSegredosAntigos();
  // O Asaas desativa chaves de subconta sem uso por 3 meses: consultar o status todo dia mantém a chave viva
  // (e já atualiza a aprovação das contas que estavam em análise).
  const contas = await db.salao.findMany({ where: { asaasApiKey: { not: null } }, select: { id: true, asaasApiKey: true, asaasStatus: true } });
  let contasConferidas = 0;
  for (const b of contas) {
    try {
      const status = await statusDaSubconta(b.asaasApiKey!);
      if (status !== b.asaasStatus) await db.salao.update({ where: { id: b.id }, data: { asaasStatus: status } });
      contasConferidas++;
    } catch {
      // segue para a próxima; amanhã tenta de novo
    }
  }
  // Saque automático por Pix (diário, ou semanal às segundas) de quem ligou a opção
  const saques = await saquesAutomaticos().catch(() => 0);
  return NextResponse.json({ ok: true, ...r, contasConferidas, saques });
}

function iguais(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
