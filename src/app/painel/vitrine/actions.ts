"use server";

import { revalidatePath } from "next/cache";
import { exigirGestor } from "@/lib/auth";
import { exigirRecurso } from "@/lib/planosSistema";
import { db } from "@/lib/db";
import type { Resultado } from "../actions";

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();
const imagem = (form: FormData, campo: string) => {
  const v = texto(form, campo);
  return v.startsWith("data:image/") && v.length < 2_000_000 ? v : null;
};
const link = (v: string) => (!v ? null : /^https?:\/\//.test(v) ? v : `https://${v}`);

function atualizar() {
  revalidatePath("/painel", "layout");
  revalidatePath("/b", "layout");
}

export async function novoBanner(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "clube");
  const img = imagem(form, "imagem");
  if (!img) return { erro: "Escolha a imagem do banner." };
  if ((await db.banner.count({ where: { salaoId } })) >= 8) return { erro: "Máximo de 8 banners. Remova algum antes." };
  const ultimo = await db.banner.findFirst({ where: { salaoId }, orderBy: { ordem: "desc" } });
  await db.banner.create({ data: { salaoId, imagem: img, link: link(texto(form, "link")), ordem: (ultimo?.ordem ?? 0) + 1 } });
  atualizar();
  return { ok: "Banner adicionado." };
}

export async function removerBanner(form: FormData) {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "clube");
  await db.banner.deleteMany({ where: { id: texto(form, "id"), salaoId } });
  atualizar();
}

export async function moverBanner(form: FormData) {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "clube");
  const banners = await db.banner.findMany({ where: { salaoId }, orderBy: { ordem: "asc" } });
  const i = banners.findIndex((b) => b.id === texto(form, "id"));
  const j = i + (texto(form, "direcao") === "subir" ? -1 : 1);
  if (i < 0 || j < 0 || j >= banners.length) return;
  [banners[i], banners[j]] = [banners[j], banners[i]];
  await db.$transaction(banners.map((b, k) => db.banner.update({ where: { id: b.id }, data: { ordem: k } })));
  atualizar();
}

export async function salvarParceiro(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "clube");
  const id = texto(form, "id");
  const nome = texto(form, "nome");
  if (!nome) return { erro: "Informe o nome do parceiro." };
  const dados = {
    nome,
    descricao: texto(form, "descricao") || null,
    cupom: texto(form, "cupom").toUpperCase() || null,
    link: link(texto(form, "link")),
    imagem: imagem(form, "imagem"),
  };
  if (id) await db.parceiro.updateMany({ where: { id, salaoId }, data: dados });
  else await db.parceiro.create({ data: { ...dados, salaoId } });
  atualizar();
  return { ok: "Parceiro salvo." };
}

export async function alternarParceiro(form: FormData) {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "clube");
  const p = await db.parceiro.findFirst({ where: { id: texto(form, "id"), salaoId } });
  if (p) await db.parceiro.update({ where: { id: p.id }, data: { ativo: !p.ativo } });
  atualizar();
}

export async function removerParceiro(form: FormData) {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "clube");
  await db.parceiro.deleteMany({ where: { id: texto(form, "id"), salaoId } });
  atualizar();
}
