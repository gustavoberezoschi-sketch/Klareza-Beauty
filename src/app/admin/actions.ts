"use server";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ErroCadastro, criarSalao, redefinirSenha } from "@/lib/saloes";
import { db } from "@/lib/db";
import { lerDinheiro, somenteDigitos } from "@/lib/formato";
import { ErroAsaas, cancelarAssinaturaAsaas, carteiraPrincipal, configurarWebhook, criarAssinatura, criarCliente, linkDaPrimeiraCobranca } from "@/lib/asaas";
import { tokenWebhookAsaas } from "@/lib/cripto";
import { CODIGOS_PLANO, planoDe, proximoVencimento, valorDoCiclo } from "@/lib/planosSistema";
import { enderecoDoSite } from "@/lib/site";
import { diaLocal, diaValido } from "@/lib/tempo";
import { limparVariavel } from "@/lib/env";
import { ipDaRequisicao, limparFalhas, minutosBloqueado, registrarFalha } from "@/lib/limite";
import type { Resultado } from "../painel/actions";

// Área do dono do sistema (você), separada do login dos salões.
const COOKIE = "admin";

function chave() {
  return new TextEncoder().encode(`admin:${limparVariavel(process.env.AUTH_SECRET)}`);
}

function senhaConfere(senha: string) {
  const esperada = limparVariavel(process.env.ADMIN_SENHA);
  if (!esperada) return false;
  // HMAC de tamanho fixo: a comparação não revela nem o tamanho da senha
  const h = (v: string) => createHmac("sha256", "admin-senha").update(v).digest();
  return timingSafeEqual(h(senha), h(esperada));
}

/** Trocar ADMIN_SENHA na Vercel derruba as sessões de admin abertas. */
function marcaDoAdmin() {
  return createHash("sha256").update(`admin:${limparVariavel(process.env.ADMIN_SENHA) ?? ""}`).digest("base64url").slice(0, 22);
}

export async function eAdmin(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !limparVariavel(process.env.AUTH_SECRET)) return false;
  try {
    const { payload } = await jwtVerify(token, chave(), { algorithms: ["HS256"] });
    return payload.sv === marcaDoAdmin();
  } catch {
    return false;
  }
}

async function exigirAdmin() {
  if (!(await eAdmin())) redirect("/admin");
}

export async function entrarAdmin(_: Resultado, form: FormData): Promise<Resultado> {
  if (!limparVariavel(process.env.ADMIN_SENHA)) return { erro: "Configure a variável ADMIN_SENHA no servidor." };
  // 5 erros por IP em 15 min; e no máximo 50 erros no total (tentativa espalhada em muitos IPs)
  const ip = await ipDaRequisicao();
  const min = Math.max(await minutosBloqueado(`admin:ip:${ip}`, 5, 15), await minutosBloqueado("admin:global", 50, 15));
  if (min) return { erro: `Muitas tentativas. Tente de novo em ${min} minuto${min > 1 ? "s" : ""}.` };
  if (!senhaConfere(String(form.get("senha") ?? "").slice(0, 200))) {
    await registrarFalha(`admin:ip:${ip}`, "admin:global");
    return { erro: "Senha incorreta." };
  }
  await limparFalhas(`admin:ip:${ip}`);
  const token = await new SignJWT({ admin: true, sv: marcaDoAdmin() })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("12h")
    .sign(chave());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: 12 * 60 * 60,
  });
  redirect("/admin");
}

export async function sairAdmin() {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
  redirect("/admin");
}

export async function novaSalao(_: Resultado, form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const plano = String(form.get("plano") ?? "BAIRRO");
  const ciclo = String(form.get("ciclo") ?? "MENSAL") === "ANUAL" ? "ANUAL" : "MENSAL";
  const pagoAte = String(form.get("pagoAte") ?? "");
  if (!(CODIGOS_PLANO as string[]).includes(plano)) return { erro: "Escolha o plano." };
  if (pagoAte && !diaValido(pagoAte)) return { erro: "Data de vencimento inválida." };
  try {
    const b = await criarSalao({
      nome: String(form.get("nome") ?? ""),
      slug: String(form.get("slug") ?? ""),
      dono: String(form.get("dono") ?? ""),
      email: String(form.get("email") ?? ""),
      senha: String(form.get("senha") ?? ""),
      plano,
      ciclo,
      pagoAte: pagoAte || null,
    });
    revalidatePath("/admin");
    return { ok: `Salão criada! Link dos clientes: /b/${b.slug}` };
  } catch (e) {
    if (e instanceof ErroCadastro) return { erro: e.message };
    throw e;
  }
}

export async function trocarSenha(_: Resultado, form: FormData): Promise<Resultado> {
  await exigirAdmin();
  try {
    await redefinirSenha(String(form.get("email") ?? ""), String(form.get("senha") ?? ""));
    return { ok: "Senha alterada." };
  } catch (e) {
    if (e instanceof ErroCadastro) return { erro: e.message };
    throw e;
  }
}

const campo = (form: FormData, nome: string) => String(form.get(nome) ?? "").trim();

export async function alterarPlano(_: Resultado, form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const plano = campo(form, "plano");
  const ciclo = campo(form, "ciclo") === "ANUAL" ? "ANUAL" : "MENSAL";
  const pagoAte = campo(form, "pagoAte");
  if (!(CODIGOS_PLANO as string[]).includes(plano)) return { erro: "Plano inválido." };
  if (pagoAte && !diaValido(pagoAte)) return { erro: "Data inválida." };
  await db.salao.update({ where: { id: campo(form, "id") }, data: { plano, ciclo, pagoAte: pagoAte || null } });
  revalidatePath("/admin");
  revalidatePath("/painel", "layout");
  return { ok: "Plano atualizado." };
}

/** Registra que o salão pagou: estende o vencimento em 1 mês ou 1 ano e tira a suspensão. */
export async function registrarPagamento(_: Resultado, form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const b = await db.salao.findUnique({ where: { id: campo(form, "id") } });
  if (!b) return { erro: "Salão não encontrada." };
  const valor = campo(form, "valor") ? lerDinheiro(campo(form, "valor")) : valorDoCiclo(b.plano, b.ciclo);
  if (valor === null) return { erro: "Valor inválido." };
  const ate = proximoVencimento(b.pagoAte, b.ciclo);
  await db.$transaction([
    db.pagamentoSistema.create({
      data: { salaoId: b.id, plano: b.plano, ciclo: b.ciclo, valorCentavos: valor, referenteAte: ate, observacao: campo(form, "observacao") || null },
    }),
    db.salao.update({ where: { id: b.id }, data: { pagoAte: ate, suspensa: false } }),
  ]);
  revalidatePath("/admin");
  revalidatePath("/painel", "layout");
  return { ok: `Pagamento registrado. ${b.nome} está paga até ${ate.split("-").reverse().join("/")}.` };
}

export async function alternarSuspensao(form: FormData) {
  await exigirAdmin();
  const b = await db.salao.findUnique({ where: { id: campo(form, "id") } });
  if (!b) return;
  await db.salao.update({ where: { id: b.id }, data: { suspensa: !b.suspensa } });
  revalidatePath("/admin");
  revalidatePath("/painel", "layout");
  revalidatePath("/b", "layout");
}

export async function salvarConfigSistema(_: Resultado, form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const whatsappSuporte = somenteDigitos(campo(form, "whatsappSuporte")) || null;
  await db.configSistema.upsert({ where: { id: "geral" }, update: { whatsappSuporte }, create: { id: "geral", whatsappSuporte } });
  revalidatePath("/admin");
  revalidatePath("/painel", "layout");
  return { ok: "Configuração salva." };
}

// ---------- Asaas (conta principal do Klareza Beauty) ----------

export async function salvarConfigAsaas(_: Resultado, form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const taxa = Number(campo(form, "taxaPlataformaPct") || 0);
  if (!Number.isInteger(taxa) || taxa < 0 || taxa > 20) return { erro: "A taxa deve ficar entre 0 e 20%." };
  let walletId: string | null = null;
  if (taxa > 0) {
    try {
      walletId = await carteiraPrincipal();
    } catch (e) {
      if (e instanceof ErroAsaas) return { erro: `Não consegui buscar sua carteira no Asaas: ${e.message}` };
      throw e;
    }
    if (!walletId) return { erro: "Não encontrei a carteira da conta principal no Asaas." };
  }
  await db.configSistema.upsert({
    where: { id: "geral" },
    update: { taxaPlataformaPct: taxa, asaasWalletId: walletId },
    create: { id: "geral", taxaPlataformaPct: taxa, asaasWalletId: walletId },
  });
  revalidatePath("/admin");
  return { ok: taxa > 0 ? `Taxa de ${taxa}% salva: vale para as próximas assinaturas online.` : "Sem taxa da plataforma." };
}

export async function configurarWebhookPrincipal(_: Resultado, form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const email = campo(form, "email");
  if (!/^\S+@\S+\.\S+$/.test(email)) return { erro: "Informe o e-mail para avisos do Asaas." };
  try {
    await configurarWebhook(`${await enderecoDoSite()}/api/asaas/webhook`, tokenWebhookAsaas(), email);
  } catch (e) {
    if (e instanceof ErroAsaas) return { erro: e.message };
    throw e;
  }
  return { ok: "Webhook configurado: os pagamentos do seu plano agora renovam o vencimento sozinhos." };
}

/** Cria a cobrança recorrente do plano do Klareza Beauty para o salão (conta principal). */
export async function cobrarPlanoPeloAsaas(_: Resultado, form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const b = await db.salao.findUnique({ where: { id: campo(form, "id") } });
  if (!b) return { erro: "Salão não encontrada." };
  if (b.asaasAssinaturaSistema) return { erro: "Esse salão já tem cobrança automática." };
  const documento = somenteDigitos(campo(form, "cpfCnpj"));
  const email = campo(form, "email");
  if (documento.length !== 11 && documento.length !== 14) return { erro: "Informe o CPF ou CNPJ de quem paga." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { erro: "Informe o e-mail de quem paga." };
  const cartao = campo(form, "forma") !== "PIX_BOLETO";
  try {
    const clienteId = b.asaasClienteSistemaId ?? (await criarCliente({ name: b.nome, cpfCnpj: documento, email, mobilePhone: b.telefone ?? undefined, externalReference: b.id })).id;
    const hoje = diaLocal();
    const assinatura = await criarAssinatura({
      customer: clienteId,
      value: valorDoCiclo(b.plano, b.ciclo) / 100,
      nextDueDate: b.pagoAte && b.pagoAte > hoje ? b.pagoAte : hoje,
      cycle: b.ciclo === "ANUAL" ? "YEARLY" : "MONTHLY",
      description: `Klareza Beauty · plano ${planoDe(b.plano).nome} ${b.ciclo === "ANUAL" ? "anual" : "mensal"}`,
      externalReference: b.id,
      // cartão: o salão informa o cartão na 1ª cobrança e as seguintes são debitadas sozinhas
      billingType: cartao ? "CREDIT_CARD" : "UNDEFINED",
    });
    const link = await linkDaPrimeiraCobranca(assinatura.id);
    await db.salao.update({
      where: { id: b.id },
      data: { asaasClienteSistemaId: clienteId, asaasAssinaturaSistema: assinatura.id, linkPagamentoSistema: link, cobrancaSistemaCartao: cartao },
    });
  } catch (e) {
    if (e instanceof ErroAsaas) return { erro: e.message };
    throw e;
  }
  revalidatePath("/admin");
  return {
    ok: cartao
      ? "Cobrança no cartão criada. Envie o link para o salão cadastrar o cartão (só na 1ª vez); depois é debitado sozinho todo mês."
      : "Cobrança por Pix/boleto criada. Todo mês o salão recebe um link novo para pagar.",
  };
}

export async function pararCobrancaPlano(_: Resultado, form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const b = await db.salao.findUnique({ where: { id: campo(form, "id") } });
  if (!b?.asaasAssinaturaSistema) return { erro: "Sem cobrança automática." };
  try {
    await cancelarAssinaturaAsaas(b.asaasAssinaturaSistema);
  } catch (e) {
    if (e instanceof ErroAsaas) return { erro: e.message };
    throw e;
  }
  await db.salao.update({ where: { id: b.id }, data: { asaasAssinaturaSistema: null, linkPagamentoSistema: null, cobrancaSistemaCartao: false } });
  revalidatePath("/admin");
  return { ok: "Cobrança automática encerrada." };
}

/**
 * Troca de ambiente do Asaas (ex.: sandbox → produção) ou de conta principal: as subcontas, assinaturas
 * e clientes criados na conta antiga não existem na nova. Solta tudo isso no sistema (nada é apagado no Asaas),
 * para os salões abrirem a conta de recebimento de novo. Histórico de pagamentos fica guardado.
 */
export async function desconectarAsaas(_: Resultado, form: FormData): Promise<Resultado> {
  await exigirAdmin();
  if (campo(form, "confirmar").toUpperCase() !== "DESCONECTAR") return { erro: "Digite DESCONECTAR para confirmar." };
  const agora = new Date();
  const [saloes, assinaturas] = await db.$transaction(async (tx) => {
    // extras que estavam somados a uma cobrança da conta antiga voltam a ficar pendentes, sem cobrança
    await tx.extraFatura.updateMany({ where: { status: "PENDENTE", asaasPagamentoId: { not: null } }, data: { asaasPagamentoId: null } });
    // assinatura que nunca foi paga online é cancelada; as pagas continuam valendo até o vencimento, como no balcão
    await tx.assinatura.updateMany({
      where: { asaasId: { not: null }, status: "AGUARDANDO" },
      data: { status: "CANCELADA", canceladaEm: agora, asaasId: null, linkPagamento: null },
    });
    const a = await tx.assinatura.updateMany({ where: { asaasId: { not: null } }, data: { asaasId: null, linkPagamento: null } });
    await tx.cliente.updateMany({ where: { asaasClienteId: { not: null } }, data: { asaasClienteId: null } });
    await tx.saque.updateMany({ where: { status: { in: ["CRIANDO", "PENDING", "BANK_PROCESSING"] } }, data: { status: "CANCELLED", erro: "Conta do Asaas desconectada." } });
    const b = await tx.salao.updateMany({
      where: { OR: [{ asaasContaId: { not: null } }, { asaasAssinaturaSistema: { not: null } }, { asaasClienteSistemaId: { not: null } }] },
      data: {
        asaasContaId: null,
        asaasWalletId: null,
        asaasApiKey: null,
        asaasStatus: null,
        cobrancaOnlineClube: false,
        saqueAutomatico: "NAO",
        asaasClienteSistemaId: null,
        asaasAssinaturaSistema: null,
        linkPagamentoSistema: null,
        cobrancaSistemaCartao: false,
      },
    });
    await tx.configSistema.updateMany({ data: { asaasWalletId: null } });
    return [b.count, a.count];
  });
  revalidatePath("/admin");
  revalidatePath("/painel", "layout");
  return {
    ok: `Pronto: ${saloes} salão(ões) e ${assinaturas} assinatura(s) desconectados do Asaas antigo. Agora cada salão abre a conta de recebimento de novo em Pagamentos online. Se usa taxa da plataforma, salve a taxa de novo.`,
  };
}
