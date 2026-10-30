"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { movimentarEstoque } from "@/lib/estoque";
import { lerDinheiro } from "@/lib/formato";
import { exigirRecurso } from "@/lib/planosSistema";
import type { Resultado } from "../actions";

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();

async function filialDaSalao(salaoId: string, filialId: string) {
  return db.filial.findFirst({ where: { id: filialId, salaoId } });
}

export async function salvarProduto(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "estoque");
  const id = texto(form, "id");
  const nome = texto(form, "nome");
  const preco = lerDinheiro(texto(form, "preco"));
  const custo = lerDinheiro(texto(form, "custo") || "0");
  if (!nome) return { erro: "Informe o nome do produto." };
  if (preco === null || custo === null) return { erro: "Preço ou custo inválido. Exemplo: 45,00" };
  const dados = { nome, categoria: texto(form, "categoria") || "Geral", precoCentavos: preco, custoCentavos: custo };

  if (id) {
    const r = await db.produto.updateMany({ where: { id, salaoId }, data: dados });
    if (r.count === 0) return { erro: "Produto não encontrado." };
    revalidatePath("/painel", "layout");
    return { ok: "Produto salvo." };
  }

  const inicial = Number(texto(form, "estoqueInicial") || 0);
  const minimo = Number(texto(form, "estoqueMinimo") || 0);
  if (!Number.isInteger(inicial) || inicial < 0) return { erro: "Estoque inicial inválido." };
  if (!Number.isInteger(minimo) || minimo < 0) return { erro: "Estoque mínimo inválido." };
  const filial = await filialDaSalao(salaoId, texto(form, "filialId"));
  if (!filial) return { erro: "Escolha a unidade do estoque inicial." };

  const filiais = await db.filial.findMany({ where: { salaoId }, select: { id: true } });
  await db.$transaction(async (tx) => {
    const produto = await tx.produto.create({ data: { ...dados, salaoId } });
    // O mínimo vale para todas as unidades; o estoque inicial entra só na unidade escolhida.
    await tx.estoqueFilial.createMany({ data: filiais.map((f) => ({ produtoId: produto.id, filialId: f.id, minimo })) });
    if (inicial > 0) await movimentarEstoque(tx, { produtoId: produto.id, filialId: filial.id, quantidade: inicial, tipo: "ENTRADA", observacao: "Estoque inicial" });
  });
  revalidatePath("/painel", "layout");
  redirect("/painel/produtos");
}

export async function movimentar(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "estoque");
  const produto = await db.produto.findFirst({ where: { id: texto(form, "id"), salaoId } });
  const filial = await filialDaSalao(salaoId, texto(form, "filialId"));
  if (!produto) return { erro: "Produto não encontrado." };
  if (!filial) return { erro: "Escolha a unidade." };
  const tipo = texto(form, "tipo");
  const qtd = Number(texto(form, "quantidade"));
  if (!Number.isInteger(qtd) || (tipo !== "AJUSTE" && qtd <= 0) || qtd < 0) return { erro: "Informe a quantidade." };

  const atual = await db.estoqueFilial.findUnique({ where: { produtoId_filialId: { produtoId: produto.id, filialId: filial.id } } });
  let delta: number;
  if (tipo === "ENTRADA") delta = qtd;
  else if (tipo === "SAIDA") delta = -qtd;
  else if (tipo === "AJUSTE") delta = qtd - (atual?.quantidade ?? 0); // quantidade contada
  else return { erro: "Tipo inválido." };
  if (delta === 0) return { ok: "O estoque já estava com essa quantidade." };

  await db.$transaction(async (tx) => {
    await movimentarEstoque(tx, {
      produtoId: produto.id,
      filialId: filial.id,
      quantidade: delta,
      tipo: tipo === "SAIDA" ? "AJUSTE" : tipo,
      observacao: texto(form, "observacao") || (tipo === "AJUSTE" ? `Contagem: ${qtd}` : null),
    });
  });
  revalidatePath("/painel", "layout");
  const varias = (await db.filial.count({ where: { salaoId, ativo: true } })) > 1;
  return { ok: varias ? `Estoque de ${filial.nome} atualizado.` : "Estoque atualizado." };
}

export async function transferir(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "estoque");
  const produto = await db.produto.findFirst({ where: { id: texto(form, "id"), salaoId } });
  const [de, para] = await Promise.all([filialDaSalao(salaoId, texto(form, "de")), filialDaSalao(salaoId, texto(form, "para"))]);
  const qtd = Number(texto(form, "quantidade"));
  if (!produto) return { erro: "Produto não encontrado." };
  if (!de || !para || de.id === para.id) return { erro: "Escolha unidades de origem e destino diferentes." };
  if (!Number.isInteger(qtd) || qtd <= 0) return { erro: "Informe a quantidade." };
  const origem = await db.estoqueFilial.findUnique({ where: { produtoId_filialId: { produtoId: produto.id, filialId: de.id } } });
  if ((origem?.quantidade ?? 0) < qtd) return { erro: `${de.nome} só tem ${origem?.quantidade ?? 0} unidade(s).` };

  await db.$transaction(async (tx) => {
    await movimentarEstoque(tx, { produtoId: produto.id, filialId: de.id, quantidade: -qtd, tipo: "TRANSFERENCIA", observacao: `Para ${para.nome}` });
    await movimentarEstoque(tx, { produtoId: produto.id, filialId: para.id, quantidade: qtd, tipo: "TRANSFERENCIA", observacao: `De ${de.nome}` });
  });
  revalidatePath("/painel", "layout");
  return { ok: `${qtd} unidade(s) transferida(s) de ${de.nome} para ${para.nome}.` };
}

export async function definirMinimo(form: FormData) {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "estoque");
  const produto = await db.produto.findFirst({ where: { id: texto(form, "id"), salaoId } });
  const filial = await filialDaSalao(salaoId, texto(form, "filialId"));
  const minimo = Number(texto(form, "minimo"));
  if (!produto || !filial || !Number.isInteger(minimo) || minimo < 0) return;
  await db.estoqueFilial.upsert({
    where: { produtoId_filialId: { produtoId: produto.id, filialId: filial.id } },
    update: { minimo },
    create: { produtoId: produto.id, filialId: filial.id, minimo },
  });
  revalidatePath("/painel", "layout");
}

export async function alternarProduto(form: FormData) {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "estoque");
  const p = await db.produto.findFirst({ where: { id: texto(form, "id"), salaoId } });
  if (p) await db.produto.update({ where: { id: p.id }, data: { ativo: !p.ativo } });
  revalidatePath("/painel", "layout");
}
