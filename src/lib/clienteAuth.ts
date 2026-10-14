import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { marcaDaSenha } from "./auth";
import { db } from "./db";
import { limparVariavel } from "./env";

// Sessão do cliente final: um cookie por salão (o cliente pode usar mais de uma).
const DURACAO_DIAS = 180;
const nomeCookie = (slug: string) => `cliente_${slug}`;

function chave() {
  return new TextEncoder().encode(`cliente:${limparVariavel(process.env.AUTH_SECRET) ?? ""}`);
}

/** Trocar a senha (ou o salão redefinir) derruba as sessões abertas com a senha antiga. */
export async function entrarComoCliente(slug: string, clienteId: string, senhaHash: string) {
  const token = await new SignJWT({ clienteId, sv: marcaDaSenha(senhaHash) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_DIAS}d`)
    .sign(chave());
  (await cookies()).set(nomeCookie(slug), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_DIAS * 86400,
  });
}

export async function sairDoCliente(slug: string) {
  (await cookies()).delete(nomeCookie(slug));
}

/** Cliente logado nesta salão (ou null). */
export async function clienteLogado(slug: string) {
  const token = (await cookies()).get(nomeCookie(slug))?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave(), { algorithms: ["HS256"] });
    const cliente = await db.cliente.findFirst({ where: { id: String(payload.clienteId), salao: { slug } } });
    return cliente?.senhaHash && payload.sv === marcaDaSenha(cliente.senhaHash) ? cliente : null;
  } catch {
    return null;
  }
}

export async function exigirCliente(slug: string) {
  const cliente = await clienteLogado(slug);
  if (!cliente) redirect(`/b/${slug}/entrar`);
  return cliente;
}
