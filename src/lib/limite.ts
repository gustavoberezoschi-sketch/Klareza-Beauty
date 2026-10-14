import { headers } from "next/headers";
import { db } from "./db";

// Limite de tentativas guardado no banco (funciona em várias instâncias da Vercel sem Redis).

export async function ipDaRequisicao() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "desconhecido").trim().slice(0, 64);
}

/** Quantos minutos faltam para liberar, ou 0 se pode tentar. */
export async function minutosBloqueado(chave: string, max: number, janelaMin: number) {
  const desde = new Date(Date.now() - janelaMin * 60_000);
  const falhas = await db.limiteTentativa.findMany({ where: { chave, criadoEm: { gt: desde } }, orderBy: { criadoEm: "asc" }, select: { criadoEm: true } });
  if (falhas.length < max) return 0;
  const libera = falhas[falhas.length - max].criadoEm.getTime() + janelaMin * 60_000;
  return Math.max(1, Math.ceil((libera - Date.now()) / 60_000));
}

export async function registrarFalha(...chaves: string[]) {
  await db.limiteTentativa.createMany({ data: chaves.map((chave) => ({ chave })) });
}

export async function limparFalhas(...chaves: string[]) {
  await db.limiteTentativa.deleteMany({ where: { chave: { in: chaves } } });
}

/**
 * Bloqueio de login: 5 erros na mesma conta em 15 min, ou 30 erros do mesmo IP em 15 min.
 * Devolve a mensagem de bloqueio, ou null se pode tentar.
 */
export async function bloqueioDeLogin(tipo: string, conta: string) {
  const ip = await ipDaRequisicao();
  const [porConta, porIp] = await Promise.all([minutosBloqueado(`${tipo}:conta:${conta}`, 5, 15), minutosBloqueado(`${tipo}:ip:${ip}`, 30, 15)]);
  const min = Math.max(porConta, porIp);
  return min ? `Muitas tentativas. Tente de novo em ${min} minuto${min > 1 ? "s" : ""}.` : null;
}

export async function falhaDeLogin(tipo: string, conta: string) {
  await registrarFalha(`${tipo}:conta:${conta}`, `${tipo}:ip:${await ipDaRequisicao()}`);
}

export async function sucessoDeLogin(tipo: string, conta: string) {
  await limparFalhas(`${tipo}:conta:${conta}`);
}

/** Limite de uso de ações caras (ex.: criar conta, inscrição de notificação): N por janela, por chave. */
export async function excedeuLimite(chave: string, max: number, janelaMin: number) {
  if (await minutosBloqueado(chave, max, janelaMin)) return true;
  await registrarFalha(chave);
  return false;
}

export async function limparTentativasAntigas() {
  await db.limiteTentativa.deleteMany({ where: { criadoEm: { lt: new Date(Date.now() - 24 * 3600_000) } } });
}
