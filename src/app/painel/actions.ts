"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarSessao, exigirGestor, exigirSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { lerDinheiro, somenteDigitos } from "@/lib/formato";
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
  const profissionalIds = form.getAll("profissionais").map(String);

  if (!nome) return { erro: "Informe o nome do serviço." };
  if (precoCentavos === null) return { erro: "Preço inválido. Exemplo: 35,00" };
  if (!Number.isInteger(duracaoMin) || duracaoMin < 5 || duracaoMin > 480)
    return { erro: "A duração deve ficar entre 5 e 480 minutos." };
  if (comissaoPct !== null && (!Number.isInteger(comissaoPct) || comissaoPct < 0 || comissaoPct > 100))
    return { erro: "A comissão deve ficar entre 0 e 100%." };

  const validos = await db.profissional.findMany({ where: { salaoId, id: { in: profissionalIds } }, select: { id: true } });
  const dados = {
    nome,
    categoria: texto(form, "categoria") || "Cabelo",
    descricao: texto(form, "descricao") || null,
    foto: imagem(form, "foto"),
    precoCentavos,
    duracaoMin,
    comissaoPct,
    exibirOnline: form.get("exibirOnline") === "on",
  };

  if (id) {
    const existe = await db.servico.findFirst({ where: { id, salaoId } });
    if (!existe) return { erro: "Serviço não encontrado." };
    await db.servico.update({ where: { id }, data: { ...dados, profissionais: { set: validos } } });
  } else {
    await db.servico.create({ data: { ...dados, salaoId, profissionais: { connect: validos } } });
  }
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
  const email = texto(form, "email").toLowerCase();
  const senha = texto(form, "senha");

  if (!nome) return { erro: "Informe o nome." };
  for (const pct of [comissaoPct, comissaoProdutoPct])
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
    destaque: form.get("destaque") === "on",
    bio: texto(form, "bio") || null,
  };

  let profissionalId = id;
  if (id) {
    const existe = await db.profissional.findFirst({ where: { id, salaoId } });
    if (!existe) return { erro: "Profissional não encontrado." };
    await db.profissional.update({ where: { id }, data: dados });
  } else {
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
  if (profissional) await db.profissional.update({ where: { id: profissional.id }, data: { ativo: !profissional.ativo } });
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
  const cor = texto(form, "cor");

  if (!nome) return { erro: "Informe o nome do salão." };
  if (![10, 15, 20, 30, 45, 60].includes(intervaloMin)) return { erro: "Intervalo inválido." };
  if (!Number.isInteger(antecedenciaDias) || antecedenciaDias < 1 || antecedenciaDias > 90)
    return { erro: "A antecedência deve ficar entre 1 e 90 dias." };
  if (!Number.isInteger(cancelamentoHoras) || cancelamentoHoras < 0 || cancelamentoHoras > 72)
    return { erro: "O prazo de cancelamento deve ficar entre 0 e 72 horas." };
  if (!Number.isInteger(cashbackPct) || cashbackPct < 0 || cashbackPct > 50)
    return { erro: "O cashback deve ficar entre 0 e 50%." };

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
        corDestaque: /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : "#145c3c",
        intervaloMin,
        antecedenciaDias,
        cancelamentoHoras,
        cashbackPct,
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
