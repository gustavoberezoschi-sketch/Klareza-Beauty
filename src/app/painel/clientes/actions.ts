"use server";

import { revalidatePath } from "next/cache";
import { exigirGestor } from "@/lib/auth";
import { type Anamnese, PERGUNTAS_SIM_NAO, PERGUNTAS_TEXTO } from "@/lib/anamnese";
import { db } from "@/lib/db";
import type { Resultado } from "../actions";

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();

async function clienteDoSalao(salaoId: string, id: string) {
  return db.cliente.findFirst({ where: { id, salaoId }, select: { id: true, anamneseEm: true } });
}

export async function salvarAnamnese(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  const cliente = await clienteDoSalao(salaoId, texto(form, "clienteId"));
  if (!cliente) return { erro: "Cliente não encontrado." };

  const ficha: Anamnese = {};
  for (const [campo] of PERGUNTAS_SIM_NAO) ficha[campo] = form.get(campo) === "sim";
  for (const [campo] of PERGUNTAS_TEXTO) {
    const v = texto(form, campo).slice(0, 500);
    if (v) ficha[campo] = v;
  }
  const autorizou = form.get("autorizou") === "on";
  await db.cliente.update({
    where: { id: cliente.id },
    data: { anamnese: ficha, anamneseEm: autorizou ? (cliente.anamneseEm ?? new Date()) : null },
  });
  revalidatePath(`/painel/clientes/${cliente.id}`);
  return { ok: "Ficha salva." };
}

export async function adicionarFoto(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  const cliente = await clienteDoSalao(salaoId, texto(form, "clienteId"));
  if (!cliente) return { erro: "Cliente não encontrado." };
  const imagem = texto(form, "imagem");
  if (!imagem.startsWith("data:image/") || imagem.length > 1_500_000) return { erro: "Escolha uma foto." };
  const tipo = texto(form, "tipo") === "DEPOIS" ? "DEPOIS" : "ANTES";
  if ((await db.fotoCliente.count({ where: { clienteId: cliente.id } })) >= 60)
    return { erro: "Limite de 60 fotos por cliente. Apague algumas antigas." };
  await db.fotoCliente.create({ data: { salaoId, clienteId: cliente.id, imagem, tipo, legenda: texto(form, "legenda").slice(0, 120) || null } });
  revalidatePath(`/painel/clientes/${cliente.id}`);
  return { ok: "Foto guardada." };
}

export async function excluirFoto(form: FormData) {
  const { salaoId } = await exigirGestor();
  const foto = await db.fotoCliente.findFirst({ where: { id: texto(form, "id"), salaoId } });
  if (!foto) return;
  await db.fotoCliente.delete({ where: { id: foto.id } });
  revalidatePath(`/painel/clientes/${foto.clienteId}`);
}

/** Mostra (ou esconde) a foto na galeria da página do salão. Só com autorização do cliente. */
export async function alternarFotoPublica(form: FormData) {
  const { salaoId } = await exigirGestor();
  const foto = await db.fotoCliente.findFirst({ where: { id: texto(form, "id"), salaoId } });
  if (!foto) return;
  await db.fotoCliente.update({ where: { id: foto.id }, data: { publica: !foto.publica } });
  revalidatePath(`/painel/clientes/${foto.clienteId}`);
  revalidatePath("/b", "layout");
}

export async function adicionarFormula(_: Resultado, form: FormData): Promise<Resultado> {
  const sessao = await exigirGestor();
  const cliente = await clienteDoSalao(sessao.salaoId, texto(form, "clienteId"));
  if (!cliente) return { erro: "Cliente não encontrado." };
  const titulo = texto(form, "titulo").slice(0, 80);
  const formula = texto(form, "formula").slice(0, 2000);
  if (!titulo || !formula) return { erro: "Informe o serviço e a fórmula." };
  const usuario = await db.usuario.findUnique({ where: { id: sessao.usuarioId }, select: { nome: true } });
  await db.formulaCliente.create({ data: { salaoId: sessao.salaoId, clienteId: cliente.id, titulo, formula, autor: usuario?.nome ?? null } });
  revalidatePath(`/painel/clientes/${cliente.id}`);
  return { ok: "Fórmula guardada." };
}

export async function excluirFormula(form: FormData) {
  const { salaoId } = await exigirGestor();
  const f = await db.formulaCliente.findFirst({ where: { id: texto(form, "id"), salaoId } });
  if (!f) return;
  await db.formulaCliente.delete({ where: { id: f.id } });
  revalidatePath(`/painel/clientes/${f.clienteId}`);
}
