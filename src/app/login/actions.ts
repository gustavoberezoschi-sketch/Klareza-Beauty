"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { type Papel, criarSessao, encerrarSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { bloqueioDeLogin, falhaDeLogin, sucessoDeLogin } from "@/lib/limite";

// Hash de uma senha qualquer: e-mail inexistente leva o mesmo tempo que senha errada (não dá para descobrir quem tem conta).
const HASH_FALSO = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.Wd8LgFm4pvC6mMQ5ExPjD0W1rq2e";

export async function entrar(_estado: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const senha = String(form.get("senha") ?? "").slice(0, 200);

  const bloqueio = await bloqueioDeLogin("painel", email);
  if (bloqueio) return bloqueio;

  const usuario = await db.usuario.findUnique({ where: { email }, include: { profissional: { select: { ativo: true } } } });
  const confere = await bcrypt.compare(senha, usuario?.senhaHash ?? HASH_FALSO);
  if (!usuario || !confere || (usuario.profissionalId && !usuario.profissional?.ativo)) {
    await falhaDeLogin("painel", email);
    return "E-mail ou senha incorretos.";
  }
  await sucessoDeLogin("painel", email);

  const papel = (["DONO", "GERENTE", "PROFISSIONAL"].includes(usuario.papel) ? usuario.papel : "DONO") as Papel;
  await criarSessao(
    { usuarioId: usuario.id, salaoId: usuario.salaoId, nome: usuario.nome, papel, profissionalId: usuario.profissionalId },
    usuario.senhaHash,
  );
  redirect(papel === "PROFISSIONAL" ? "/painel/agenda" : "/painel");
}

export async function sair() {
  await encerrarSessao();
  redirect("/login");
}
