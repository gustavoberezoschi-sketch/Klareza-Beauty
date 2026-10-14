"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErroAsaas } from "@/lib/asaas";
import { exigirCliente, entrarComoCliente, sairDoCliente } from "@/lib/clienteAuth";
import { ErroClube, assinarClubeOnline, cancelarAssinaturaDoClube } from "@/lib/clubeOnline";
import { LimiteDoPlano } from "@/lib/planosSistema";
import { db } from "@/lib/db";
import { somenteDigitos } from "@/lib/formato";
import { bloqueioDeLogin, excedeuLimite, falhaDeLogin, ipDaRequisicao, sucessoDeLogin } from "@/lib/limite";
import { problemaNaSenha } from "@/lib/senha";
import { notificarCliente } from "@/lib/push";
import type { Resultado } from "@/app/painel/actions";

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();

// Hash de uma senha qualquer: telefone sem conta leva o mesmo tempo que senha errada.
const HASH_FALSO = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.Wd8LgFm4pvC6mMQ5ExPjD0W1rq2e";

export async function entrar(slug: string, _: Resultado, form: FormData): Promise<Resultado> {
  const telefone = somenteDigitos(texto(form, "telefone")).slice(0, 15);
  const senha = texto(form, "senha").slice(0, 200);
  const conta = `${slug}:${telefone}`;
  const bloqueio = await bloqueioDeLogin("cliente", conta);
  if (bloqueio) return { erro: bloqueio };
  const cliente = await db.cliente.findFirst({ where: { telefone, salao: { slug } } });
  const confere = await bcrypt.compare(senha, cliente?.senhaHash ?? HASH_FALSO);
  if (!cliente?.senhaHash || !confere) {
    await falhaDeLogin("cliente", conta);
    return { erro: "WhatsApp ou senha incorretos. Se ainda não tem conta, crie uma." };
  }
  await sucessoDeLogin("cliente", conta);
  await entrarComoCliente(slug, cliente.id, cliente.senhaHash);
  redirect(`/b/${slug}/conta`);
}

export async function criarConta(slug: string, _: Resultado, form: FormData): Promise<Resultado> {
  const salao = await db.salao.findUnique({ where: { slug } });
  if (!salao) return { erro: "Salão não encontrada." };
  const nome = texto(form, "nome").slice(0, 80);
  const telefone = somenteDigitos(texto(form, "telefone"));
  const senha = texto(form, "senha");
  if (!nome) return { erro: "Informe seu nome." };
  if (telefone.length < 10 || telefone.length > 11) return { erro: "Informe seu WhatsApp com DDD." };
  if (form.get("aceite") !== "on") return { erro: "Para criar a conta, aceite os Termos de Uso e a Política de Privacidade." };
  if (await excedeuLimite(`criar-conta:ip:${await ipDaRequisicao()}`, 5, 60)) return { erro: "Muitas contas criadas daqui. Tente de novo mais tarde." };
  const problema = await problemaNaSenha(senha, nome, telefone);
  if (problema) return { erro: problema };

  const existente = await db.cliente.findUnique({ where: { salaoId_telefone: { salaoId: salao.id, telefone } } });
  // Quem já é cliente (cadastro do balcão ou agendamento sem conta) não pode "assumir" o cadastro só sabendo o
  // telefone: sem confirmar que o número é dele, qualquer um veria o histórico e cancelaria o plano de outra pessoa.
  // O salão libera o acesso pelo painel (Clientes → senha do app).
  if (existente)
    return { erro: existente.senhaHash ? "Esse WhatsApp já tem conta. Use a aba Entrar." : "Esse WhatsApp já é cliente do salão. Peça no balcão para liberarem seu acesso ao app." };
  const senhaHash = await bcrypt.hash(senha, 10);
  const cliente = await db.cliente.create({ data: { salaoId: salao.id, nome, telefone, senhaHash, aceiteTermosEm: new Date() } });
  await entrarComoCliente(slug, cliente.id, senhaHash);
  redirect(`/b/${slug}/conta`);
}

export async function sair(slug: string) {
  await sairDoCliente(slug);
  redirect(`/b/${slug}`);
}

export async function salvarPerfil(slug: string, _: Resultado, form: FormData): Promise<Resultado> {
  const cliente = await exigirCliente(slug);
  const nome = texto(form, "nome").slice(0, 80);
  const nascimento = texto(form, "nascimento");
  if (!nome) return { erro: "Informe seu nome." };
  if (nascimento && !/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) return { erro: "Data de nascimento inválida." };
  await db.cliente.update({
    where: { id: cliente.id },
    data: { nome, email: texto(form, "email") || null, nascimento: nascimento || null },
  });
  revalidatePath(`/b/${slug}`, "layout");
  return { ok: "Perfil salvo." };
}

export async function trocarSenha(slug: string, _: Resultado, form: FormData): Promise<Resultado> {
  const cliente = await exigirCliente(slug);
  const conta = `${slug}:${cliente.telefone}`;
  const bloqueio = await bloqueioDeLogin("cliente", conta);
  if (bloqueio) return { erro: bloqueio };
  if (!(await bcrypt.compare(texto(form, "atual"), cliente.senhaHash!))) {
    await falhaDeLogin("cliente", conta);
    return { erro: "A senha atual está incorreta." };
  }
  const nova = texto(form, "nova");
  const problema = await problemaNaSenha(nova, cliente.nome, cliente.telefone);
  if (problema) return { erro: problema };
  const senhaHash = await bcrypt.hash(nova, 10);
  await db.cliente.update({ where: { id: cliente.id }, data: { senhaHash } });
  await entrarComoCliente(slug, cliente.id, senhaHash); // os outros aparelhos saem; este continua
  return { ok: "Senha alterada. Os outros aparelhos foram desconectados." };
}

export async function assinarPeloCliente(slug: string, _: Resultado, form: FormData): Promise<Resultado> {
  const cliente = await exigirCliente(slug);
  // cada tentativa cria cliente/assinatura no Asaas: limita para não lotar a conta do salão
  if (await excedeuLimite(`assinar:${cliente.id}`, 5, 60)) return { erro: "Muitas tentativas. Tente de novo em uma hora ou fale com o salão." };
  let link: string | null = null;
  try {
    const r = await assinarClubeOnline({
      salaoId: cliente.salaoId,
      clienteId: cliente.id,
      planoId: texto(form, "planoId"),
      cpf: somenteDigitos(texto(form, "cpf")),
    });
    link = r.link;
  } catch (e) {
    if (e instanceof ErroClube || e instanceof ErroAsaas || e instanceof LimiteDoPlano) return { erro: e.message };
    throw e;
  }
  revalidatePath(`/b/${slug}`, "layout");
  revalidatePath("/painel", "layout");
  if (link) redirect(link);
  return { ok: "Assinatura criada. O link de pagamento aparece aqui em instantes." };
}

/** O próprio cliente cancela a assinatura: para de cobrar e o plano vale até o fim do período pago. */
export async function cancelarPeloCliente(slug: string, _: Resultado, form: FormData): Promise<Resultado> {
  const cliente = await exigirCliente(slug);
  const a = await db.assinatura.findFirst({
    where: { id: String(form.get("id") ?? ""), clienteId: cliente.id, status: { in: ["ATIVA", "AGUARDANDO"] }, canceladaEm: null },
  });
  if (!a) return { erro: "Assinatura não encontrada." };
  try {
    await cancelarAssinaturaDoClube(cliente.salaoId, a.id, { peloCliente: true });
  } catch (e) {
    if (e instanceof ErroClube) return { erro: e.message };
    throw e;
  }
  revalidatePath(`/b/${slug}`, "layout");
  revalidatePath("/painel", "layout");
  return { ok: "Assinatura cancelada. Nenhuma nova cobrança será feita." };
}

/** Guarda o celular do cliente para receber notificações do app e manda um aviso de teste. */
export async function salvarInscricaoPush(slug: string, i: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<{ erro?: string }> {
  const cliente = await exigirCliente(slug);
  const erro = { erro: "Não foi possível ativar neste navegador." };
  // O servidor faz POST para esse endereço: só aceita os serviços de push dos navegadores (evita SSRF).
  if (!endpointDePushValido(i?.endpoint) || !i.keys?.p256dh || !i.keys?.auth || i.keys.p256dh.length > 200 || i.keys.auth.length > 100) return erro;
  const dono = await db.pushInscricao.findUnique({ where: { endpoint: i.endpoint } });
  if (dono && dono.clienteId !== cliente.id) return erro; // não "rouba" a inscrição de outro cliente
  if (!dono && (await db.pushInscricao.count({ where: { clienteId: cliente.id } })) >= 5) return { erro: "Limite de 5 aparelhos. Desative em um deles primeiro." };
  await db.pushInscricao.upsert({
    where: { endpoint: i.endpoint },
    create: { salaoId: cliente.salaoId, clienteId: cliente.id, endpoint: i.endpoint, p256dh: i.keys.p256dh, auth: i.keys.auth },
    update: { p256dh: i.keys.p256dh, auth: i.keys.auth },
  });
  const b = await db.salao.findUnique({ where: { id: cliente.salaoId }, select: { nome: true } });
  await notificarCliente(cliente.id, {
    endpoint: i.endpoint, // o aviso de teste vai só para o aparelho que acabou de ativar
    titulo: "Lembretes ativados ✂️",
    texto: `Pronto, ${cliente.nome.split(" ")[0]}! A ${b?.nome ?? "salão"} vai te avisar aqui um dia antes de cada horário.`,
    url: `/b/${slug}/conta`,
    icone: `/b/${slug}/icone/192`,
  });
  return {};
}

const HOSTS_PUSH = [/\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /\.push\.apple\.com$/];
function endpointDePushValido(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    if (process.env.NODE_ENV !== "production" && u.hostname === "localhost") return true; // receptor dos testes locais
    return u.protocol === "https:" && !u.port && HOSTS_PUSH.some((h) => h.test(u.hostname));
  } catch {
    return false;
  }
}

export async function removerInscricaoPush(slug: string, endpoint: string) {
  const cliente = await exigirCliente(slug);
  await db.pushInscricao.deleteMany({ where: { endpoint, clienteId: cliente.id } });
}
