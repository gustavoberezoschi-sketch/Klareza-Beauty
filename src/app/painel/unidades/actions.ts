"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirGestor, exigirSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { escolherFilial } from "@/lib/filial";
import { somenteDigitos } from "@/lib/formato";
import { LimiteDoPlano, garantirVagaDeUnidade } from "@/lib/planosSistema";
import type { Resultado } from "../actions";

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();

/** Troca a unidade em que o painel está trabalhando ("" = todas). */
export async function trocarFilial(form: FormData) {
  const sessao = await exigirSessao();
  if (sessao.papel === "PROFISSIONAL") return;
  const id = texto(form, "filialId");
  const valida = id ? await db.filial.findFirst({ where: { id, salaoId: sessao.salaoId, ativo: true } }) : null;
  await escolherFilial(sessao.salaoId, valida?.id ?? null);
  revalidatePath("/painel", "layout");
}

export async function salvarFilial(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  const id = texto(form, "id");
  const nome = texto(form, "nome");
  if (!nome) return { erro: "Informe o nome da unidade (ex.: Centro, Shopping, Bairro X)." };

  const horarios: { diaSemana: number; abre: string; fecha: string }[] = [];
  for (let d = 0; d < 7; d++) {
    if (form.get(`aberto_${d}`) !== "on") continue;
    const abre = texto(form, `abre_${d}`);
    const fecha = texto(form, `fecha_${d}`);
    if (!/^\d{2}:\d{2}$/.test(abre) || !/^\d{2}:\d{2}$/.test(fecha) || abre >= fecha)
      return { erro: "Confira os horários de abertura e fechamento." };
    horarios.push({ diaSemana: d, abre, fecha });
  }
  const dados = { nome, endereco: texto(form, "endereco") || null, telefone: somenteDigitos(texto(form, "telefone")) || null };

  if (id) {
    const f = await db.filial.findFirst({ where: { id, salaoId } });
    if (!f) return { erro: "Unidade não encontrada." };
    await db.$transaction([
      db.filial.update({ where: { id }, data: dados }),
      db.horarioFuncionamento.deleteMany({ where: { filialId: id } }),
      db.horarioFuncionamento.createMany({ data: horarios.map((h) => ({ ...h, filialId: id })) }),
    ]);
  } else {
    try {
      await garantirVagaDeUnidade(salaoId);
    } catch (e) {
      if (e instanceof LimiteDoPlano) return { erro: e.message };
      throw e;
    }
    const total = await db.filial.count({ where: { salaoId } });
    const nova = await db.filial.create({ data: { ...dados, salaoId, ordem: total, horarios: { create: horarios } } });
    // Produtos entram na unidade nova zerados, com o mesmo estoque mínimo da unidade principal.
    const produtos = await db.produto.findMany({ where: { salaoId }, include: { estoques: { orderBy: { minimo: "desc" }, take: 1 } } });
    await db.estoqueFilial.createMany({
      data: produtos.map((p) => ({ produtoId: p.id, filialId: nova.id, minimo: p.estoques[0]?.minimo ?? 0 })),
      skipDuplicates: true,
    });
  }
  revalidatePath("/painel", "layout");
  revalidatePath("/b", "layout");
  redirect("/painel/unidades");
}

export async function alternarFilial(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  const f = await db.filial.findFirst({ where: { id: texto(form, "id"), salaoId } });
  if (!f) return { erro: "Unidade não encontrada." };
  if (!f.ativo) {
    try {
      await garantirVagaDeUnidade(salaoId);
    } catch (e) {
      if (e instanceof LimiteDoPlano) return { erro: e.message };
      throw e;
    }
  }
  if (f.ativo && (await db.filial.count({ where: { salaoId, ativo: true } })) <= 1)
    return { erro: "O salão precisa de pelo menos uma unidade ativa." };
  await db.filial.update({ where: { id: f.id }, data: { ativo: !f.ativo } });
  revalidatePath("/painel", "layout");
  revalidatePath("/b", "layout");
  return { ok: f.ativo ? "Unidade desativada." : "Unidade reativada." };
}
