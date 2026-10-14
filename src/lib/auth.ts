import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { limparVariavel } from "./env";

const COOKIE = "sessao";
const DURACAO_DIAS = 30;

export type Papel = "DONO" | "GERENTE" | "PROFISSIONAL";
export type Sessao = { usuarioId: string; salaoId: string; nome: string; papel: Papel; profissionalId: string | null };

function chave() {
  const segredo = limparVariavel(process.env.AUTH_SECRET);
  if (!segredo) throw new Error("Defina AUTH_SECRET no arquivo .env");
  return new TextEncoder().encode(segredo);
}

/**
 * "Impressão" da senha atual dentro do token: trocar a senha (ou o admin redefinir) derruba
 * na hora todas as sessões abertas com a senha antiga, em qualquer aparelho.
 */
export function marcaDaSenha(senhaHash: string) {
  return createHash("sha256").update(`sessao:${senhaHash}`).digest("base64url").slice(0, 22);
}

export async function criarSessao(sessao: Sessao, senhaHash: string) {
  const token = await new SignJWT({ ...sessao, sv: marcaDaSenha(senhaHash) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_DIAS}d`)
    .sign(chave());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_DIAS * 24 * 60 * 60,
  });
}

export async function encerrarSessao() {
  (await cookies()).delete(COOKIE);
}

/**
 * Sessão do painel. Além da assinatura do token, confere no banco a cada requisição: usuário removido,
 * senha trocada ou papel alterado valem na hora (o papel e o salão vêm do banco, não do token).
 */
export const lerSessao = cache(async (): Promise<Sessao | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let payload;
  try {
    ({ payload } = await jwtVerify(token, chave(), { algorithms: ["HS256"] }));
  } catch {
    return null;
  }
  const usuario = await db.usuario.findUnique({ where: { id: String(payload.usuarioId) }, include: { profissional: { select: { ativo: true } } } });
  if (!usuario || payload.sv !== marcaDaSenha(usuario.senhaHash)) return null;
  if (usuario.profissionalId && !usuario.profissional?.ativo) return null; // profissional desativado perde o acesso na hora
  const papel = (["DONO", "GERENTE", "PROFISSIONAL"].includes(usuario.papel) ? usuario.papel : "DONO") as Papel;
  return {
    usuarioId: usuario.id,
    salaoId: usuario.salaoId,
    nome: usuario.nome,
    papel,
    profissionalId: papel === "PROFISSIONAL" ? usuario.profissionalId : null,
  };
});

/** Use em páginas e ações do painel: redireciona para o login se não houver sessão. */
export async function exigirSessao(): Promise<Sessao> {
  const sessao = await lerSessao();
  if (!sessao) redirect("/login");
  return sessao;
}

/** Páginas e ações que só o dono/gerente pode usar (profissional é mandado para a agenda). */
export async function exigirGestor(): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (sessao.papel === "PROFISSIONAL") redirect("/painel/agenda");
  return sessao;
}
