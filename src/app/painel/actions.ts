"use server";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarSessao, exigirGestor, exigirSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { lerDinheiro, somenteDigitos } from "@/lib/formato";
import { LimiteDoPlano, garantirVagaDeProfissional, temRecurso } from "@/lib/planosSistema";
import { bloqueioDeLogin, falhaDeLogin, sucessoDeLogin } from "@/lib/limite";
import { problemaNaSenha } from "@/lib/senha";

export type Resultado = { erro?: string; ok?: string } | null;

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();
const imagem = (form: FormData, campo: string) => {
  const v = texto(form, campo);
  return v.startsWith("data:image/") && v.length < 1_500_000 ? v : null;
};
const inteiro = (form: FormData, campo: string) => {
  const v = texto(form, campo);
  return v === "" ? null : Number(v);
};

// ---------- Serviços ----------

export async function salvarServico(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  const id = texto(form, "id");
  const nome = texto(form, "nome");
  const precoCentavos = lerDinheiro(texto(form, "preco"));
  const duracaoMin = Number(texto(form, "duracao"));
  const comissaoPct = inteiro(form, "comissao");
  const retornoDias = inteiro(form, "retornoDias");
  const profissionalIds = form.getAll("profissionais").map(String);

  if (!nome) return { erro: "Informe o nome do serviço." };
  if (precoCentavos === null) return { erro: "Preço inválido. Exemplo: 35,00" };
  if (!Number.isInteger(duracaoMin) || duracaoMin < 5 || duracaoMin > 480)
    return { erro: "A duração deve ficar entre 5 e 480 minutos." };
  if (comissaoPct !== null && (!Number.isInteger(comissaoPct) || comissaoPct < 0 || comissaoPct > 100))
    return { erro: "A comissão deve ficar entre 0 e 100%." };
  if (retornoDias !== null && (!Number.isInteger(retornoDias) || retornoDias < 1 || retornoDias > 365))
    return { erro: "O retorno deve ficar entre 1 e 365 dias." };

  // Variações, adicionais, faixas da manutenção e material (vêm em JSON dos campos dinâmicos)
  const json = (campo: string) => {
    try {
      const v = JSON.parse(texto(form, campo) || "[]");
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  };
  const opcoes = json("opcoesJson");
  const faixas = json("faixasJson");
  const insumos = json("insumosJson") ?? [];
  if (!opcoes || opcoes.length > 30) return { erro: "Confira as variações e os adicionais." };
  for (const o of opcoes) {
    if (!["VARIACAO", "ADICIONAL"].includes(o.tipo) || typeof o.nome !== "string" || !o.nome.trim()) return { erro: "Toda variação e adicional precisa de nome." };
    if (!Number.isInteger(o.precoCentavos) || o.precoCentavos < 0) return { erro: `Preço inválido em "${o.nome}". Exemplo: 35,00` };
    const minimo = o.tipo === "VARIACAO" ? 5 : 0;
    if (!Number.isInteger(o.duracaoMin) || o.duracaoMin < minimo || o.duracaoMin > 480) return { erro: `Duração inválida em "${o.nome}".` };
  }
  if (!faixas || faixas.length > 6) return { erro: "Confira as faixas da manutenção." };
  for (const f of faixas)
    if (!Number.isInteger(f.ateDias) || f.ateDias < 1 || f.ateDias > 365 || !Number.isInteger(f.precoCentavos) || f.precoCentavos < 0)
      return { erro: "Cada faixa da manutenção precisa de dias (1 a 365) e preço." };
  if (new Set(faixas.map((f: { ateDias: number }) => f.ateDias)).size !== faixas.length) return { erro: "Há duas faixas com o mesmo número de dias." };
  const manutencaoDeId = texto(form, "manutencaoDeId") || null;
  if (manutencaoDeId && (manutencaoDeId === id || !(await db.servico.findFirst({ where: { id: manutencaoDeId, salaoId } }))))
    return { erro: "Escolha a aplicação de que este serviço é manutenção." };
  if (faixas.length && !manutencaoDeId) return { erro: "Para usar as faixas de preço, escolha de qual aplicação este serviço é a manutenção." };
  const produtosValidos = await db.produto.findMany({ where: { salaoId, id: { in: insumos.map((i: { produtoId: string }) => String(i.produtoId)) } }, select: { id: true } });
  const material = insumos
    .filter((i: { produtoId: string; quantidade: number }) => produtosValidos.some((p) => p.id === i.produtoId) && typeof i.quantidade === "number" && i.quantidade > 0 && i.quantidade <= 1000)
    .map((i: { produtoId: string; quantidade: number }) => ({ produtoId: i.produtoId, quantidade: i.quantidade }));

  const validos = await db.profissional.findMany({ where: { salaoId, id: { in: profissionalIds } }, select: { id: true } });
  const dados = {
    nome,
    categoria: texto(form, "categoria") || "Cabelo",
    descricao: texto(form, "descricao") || null,
    foto: imagem(form, "foto"),
    precoCentavos,
    duracaoMin,
    comissaoPct,
    retornoDias,
    exibirOnline: form.get("exibirOnline") === "on",
    cuidados: texto(form, "cuidados").slice(0, 1500) || null,
    manutencaoDeId,
    faixasManutencao: faixas.length ? [...faixas].sort((a: { ateDias: number }, b: { ateDias: number }) => a.ateDias - b.ateDias) : Prisma.DbNull,
  };

  let servicoId = id;
  if (id) {
    const existe = await db.servico.findFirst({ where: { id, salaoId } });
    if (!existe) return { erro: "Serviço não encontrado." };
    await db.servico.update({ where: { id }, data: { ...dados, profissionais: { set: validos } } });
  } else {
    servicoId = (await db.servico.create({ data: { ...dados, salaoId, profissionais: { connect: validos } } })).id;
  }
  // opções: atualiza as que continuam, cria as novas e desativa as removidas (agendamentos guardam cópia)
  const atuais = await db.servicoOpcao.findMany({ where: { servicoId }, select: { id: true } });
  const mantidas = new Set(opcoes.filter((o: { id?: string }) => o.id && atuais.some((a) => a.id === o.id)).map((o: { id: string }) => o.id));
  await db.$transaction([
    db.servicoOpcao.updateMany({ where: { servicoId, id: { notIn: [...mantidas] as string[] } }, data: { ativo: false } }),
    ...opcoes.map((o: { id?: string; tipo: string; nome: string; precoCentavos: number; duracaoMin: number }, ordem: number) =>
      o.id && mantidas.has(o.id)
        ? db.servicoOpcao.update({ where: { id: o.id }, data: { tipo: o.tipo, nome: o.nome.trim().slice(0, 60), precoCentavos: o.precoCentavos, duracaoMin: o.duracaoMin, ordem, ativo: true } })
        : db.servicoOpcao.create({ data: { servicoId, tipo: o.tipo, nome: o.nome.trim().slice(0, 60), precoCentavos: o.precoCentavos, duracaoMin: o.duracaoMin, ordem } }),
    ),
    db.servicoInsumo.deleteMany({ where: { servicoId } }),
    db.servicoInsumo.createMany({ data: material.map((m: { produtoId: string; quantidade: number }) => ({ ...m, servicoId })), skipDuplicates: true }),
  ]);
  revalidatePath("/painel", "layout");
  redirect("/painel/servicos");
}

export async function alternarServico(form: FormData) {
  const { salaoId } = await exigirGestor();
  const servico = await db.servico.findFirst({ where: { id: texto(form, "id"), salaoId } });
  if (servico) await db.servico.update({ where: { id: servico.id }, data: { ativo: !servico.ativo } });
  revalidatePath("/painel", "layout");
}

// ---------- Equipe ----------

export async function salvarProfissional(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  const id = texto(form, "id");
  const nome = texto(form, "nome");
  const comissaoPct = Number(texto(form, "comissao"));
  const comissaoProdutoPct = Number(texto(form, "comissaoProduto"));
  const comissaoAuxiliarPct = Number(texto(form, "comissaoAuxiliar") || 10);
  const email = texto(form, "email").toLowerCase();
  const senha = texto(form, "senha");

  if (!nome) return { erro: "Informe o nome." };
  for (const pct of [comissaoPct, comissaoProdutoPct, comissaoAuxiliarPct])
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) return { erro: "As comissões devem ficar entre 0 e 100%." };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { erro: "E-mail de acesso inválido." };

  const filial = await db.filial.findFirst({ where: { id: texto(form, "filialId"), salaoId } });
  if (!filial) return { erro: "Escolha a unidade em que o profissional trabalha." };
  const dados = {
    nome,
    filialId: filial.id,
    telefone: somenteDigitos(texto(form, "telefone")) || null,
    foto: imagem(form, "foto"),
    comissaoPct,
    comissaoProdutoPct,
    comissaoAuxiliarPct,
    destaque: form.get("destaque") === "on",
    bio: texto(form, "bio") || null,
  };

  let profissionalId = id;
  if (id) {
    const existe = await db.profissional.findFirst({ where: { id, salaoId } });
    if (!existe) return { erro: "Profissional não encontrado." };
    await db.profissional.update({ where: { id }, data: dados });
  } else {
    try {
      await garantirVagaDeProfissional(salaoId);
    } catch (e) {
      if (e instanceof LimiteDoPlano) return { erro: e.message };
      throw e;
    }
    profissionalId = (await db.profissional.create({ data: { ...dados, salaoId } })).id;
  }

  // Acesso do profissional ao sistema (opcional)
  const usuario = await db.usuario.findUnique({ where: { profissionalId } });
  if (email && senha) {
    const problema = await problemaNaSenha(senha, nome, email);
    if (problema) return { erro: problema };
  }
  if (email) {
    const outro = await db.usuario.findUnique({ where: { email } });
    if (outro && outro.id !== usuario?.id) return { erro: `O e-mail ${email} já é usado por outro acesso.` };
    if (usuario) {
      await db.usuario.update({
        where: { id: usuario.id },
        data: { email, nome, ...(senha ? { senhaHash: await bcrypt.hash(senha, 10) } : {}) },
      });
    } else {
      if (!senha) return { erro: "Para criar o acesso, defina uma senha com pelo menos 8 caracteres." };
      await db.usuario.create({
        data: { salaoId, profissionalId, nome, email, papel: "PROFISSIONAL", senhaHash: await bcrypt.hash(senha, 10) },
      });
    }
  } else if (usuario) {
    await db.usuario.delete({ where: { id: usuario.id } });
  }

  revalidatePath("/painel", "layout");
  redirect("/painel/equipe");
}

export async function alternarProfissional(form: FormData) {
  const { salaoId } = await exigirGestor();
  const profissional = await db.profissional.findFirst({ where: { id: texto(form, "id"), salaoId } });
  if (!profissional) return;
  // reativar conta no limite do plano (Solo = 1 profissional ativa)
  if (!profissional.ativo) {
    try {
      await garantirVagaDeProfissional(salaoId);
    } catch (e) {
      if (e instanceof LimiteDoPlano) return;
      throw e;
    }
  }
  await db.profissional.update({ where: { id: profissional.id }, data: { ativo: !profissional.ativo } });
  revalidatePath("/painel", "layout");
}

// ---------- Clientes ----------

export async function salvarCliente(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  const id = texto(form, "id");
  const nome = texto(form, "nome");
  const telefone = somenteDigitos(texto(form, "telefone"));
  const nascimento = texto(form, "nascimento");

  if (!nome) return { erro: "Informe o nome do cliente." };
  if (telefone.length < 10 || telefone.length > 11) return { erro: "O telefone precisa ter DDD + número." };
  if (nascimento && !/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) return { erro: "Data de nascimento inválida." };

  const mesmoTelefone = await db.cliente.findUnique({ where: { salaoId_telefone: { salaoId, telefone } } });
  if (mesmoTelefone && mesmoTelefone.id !== id)
    return { erro: `Já existe um cliente com esse telefone (${mesmoTelefone.nome}).` };

  const dados = {
    nome,
    telefone,
    email: texto(form, "email") || null,
    nascimento: nascimento || null,
    observacao: texto(form, "observacao") || null,
  };
  let clienteId = id;
  if (id) {
    const r = await db.cliente.updateMany({ where: { id, salaoId }, data: dados });
    if (r.count === 0) return { erro: "Cliente não encontrado." };
  } else {
    clienteId = (await db.cliente.create({ data: { ...dados, salaoId } })).id;
  }
  revalidatePath("/painel", "layout");
  redirect(`/painel/clientes/${clienteId}`);
}

// ---------- Configurações ----------

export async function salvarConfiguracoes(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  const nome = texto(form, "nome");
  const intervaloMin = Number(texto(form, "intervalo"));
  const antecedenciaDias = Number(texto(form, "antecedencia"));
  const cancelamentoHoras = Number(texto(form, "cancelamento"));
  const cashbackPct = Number(texto(form, "cashback"));
  const salaoAtual = await db.salao.findUniqueOrThrow({ where: { id: salaoId }, select: { plano: true } });
  // plano sem sinal (Solo): o campo nem aparece; se vier, vale 0
  const sinalPct = temRecurso(salaoAtual.plano, "sinal") ? Number(texto(form, "sinal") || 0) : 0;
  const indicacao = texto(form, "indicacao") ? lerDinheiro(texto(form, "indicacao")) : 0;
  const linkAvaliacao = texto(form, "avaliacao");
  const cor = texto(form, "cor");

  if (!nome) return { erro: "Informe o nome do salão." };
  if (![10, 15, 20, 30, 45, 60].includes(intervaloMin)) return { erro: "Intervalo inválido." };
  if (!Number.isInteger(antecedenciaDias) || antecedenciaDias < 1 || antecedenciaDias > 90)
    return { erro: "A antecedência deve ficar entre 1 e 90 dias." };
  if (!Number.isInteger(cancelamentoHoras) || cancelamentoHoras < 0 || cancelamentoHoras > 72)
    return { erro: "O prazo de cancelamento deve ficar entre 0 e 72 horas." };
  if (!Number.isInteger(cashbackPct) || cashbackPct < 0 || cashbackPct > 50)
    return { erro: "O cashback deve ficar entre 0 e 50%." };
  if (!Number.isInteger(sinalPct) || sinalPct < 0 || sinalPct > 100) return { erro: "O sinal deve ficar entre 0 e 100%." };
  if (indicacao === null || indicacao > 100_000) return { erro: "Crédito por indicação inválido. Exemplo: 20,00" };
  if (linkAvaliacao && !/^https:\/\/\S+$/.test(linkAvaliacao)) return { erro: "O link de avaliação deve começar com https://" };

  await db.$transaction([
    db.salao.update({
      where: { id: salaoId },
      data: {
        nome,
        telefone: somenteDigitos(texto(form, "telefone")) || null,
        endereco: texto(form, "endereco") || null,
        instagram: texto(form, "instagram").replace(/^@/, "") || null,
        descricao: texto(form, "descricao") || null,
        logo: imagem(form, "logo"),
        capa: imagem(form, "capa"),
        corDestaque: /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : "#7a2e52",
        intervaloMin,
        antecedenciaDias,
        cancelamentoHoras,
        cashbackPct,
        sinalPct,
        indicacaoCreditoCentavos: indicacao,
        linkAvaliacao: linkAvaliacao || null,
        termoConsentimento: texto(form, "termo").slice(0, 2000) || null,
      },
    }),
  ]);
  revalidatePath("/painel", "layout");
  return { ok: "Configurações salvas." };
}

export async function alterarMinhaSenha(_: Resultado, form: FormData): Promise<Resultado> {
  const sessao = await exigirSessao();
  const atual = texto(form, "atual");
  const nova = texto(form, "nova");
  const usuario = await db.usuario.findUniqueOrThrow({ where: { id: sessao.usuarioId } });
  // mesma trava do login: quem pegou o celular aberto não fica chutando a senha atual
  const bloqueio = await bloqueioDeLogin("painel", usuario.email);
  if (bloqueio) return { erro: bloqueio };
  if (!(await bcrypt.compare(atual, usuario.senhaHash))) {
    await falhaDeLogin("painel", usuario.email);
    return { erro: "A senha atual está incorreta." };
  }
  await sucessoDeLogin("painel", usuario.email);
  const problema = await problemaNaSenha(nova, usuario.nome, usuario.email);
  if (problema) return { erro: problema };
  const senhaHash = await bcrypt.hash(nova, 10);
  await db.usuario.update({ where: { id: usuario.id }, data: { senhaHash } });
  // a senha nova derruba as sessões de todos os outros aparelhos; este continua logado
  await criarSessao(sessao, senhaHash);
  return { ok: "Senha alterada. Os outros aparelhos foram desconectados." };
}

export async function definirSenhaDoApp(_: Resultado, form: FormData): Promise<Resultado> {
  const { salaoId } = await exigirGestor();
  const senha = texto(form, "senha");
  const problema = await problemaNaSenha(senha);
  if (problema) return { erro: problema };
  const r = await db.cliente.updateMany({ where: { id: texto(form, "id"), salaoId }, data: { senhaHash: await bcrypt.hash(senha, 10) } });
  if (r.count === 0) return { erro: "Cliente não encontrado." };
  revalidatePath("/painel", "layout");
  return { ok: `Senha definida. Envie para o cliente: ele entra com o WhatsApp e essa senha.` };
}
