"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { ErroAgendamento, ErroJaAgendado, SINAL_PRAZO_MIN, horariosDisponiveis, reservarOnline } from "@/lib/agenda";
import { ErroAsaas } from "@/lib/asaas";
import { clienteLogado, entrarComoCliente } from "@/lib/clienteAuth";
import { cpfValido } from "@/lib/clubeOnline";
import { assinaturaVigente } from "@/lib/comandas";
import { db } from "@/lib/db";
import { registrarIndicacao } from "@/lib/indicacao";
import { excedeuLimite, ipDaRequisicao } from "@/lib/limite";
import { ErroPedido, type ItemPedido } from "@/lib/pedido";
import { problemaNaSenha } from "@/lib/senha";
import { ErroSinal, creditarSinal, gerarCobrancaDoSinal, sinalAtivo, valorDoSinal } from "@/lib/sinal";
import { formatarDinheiro, somenteDigitos } from "@/lib/formato";
import { diaLocal, diaValido, formatarDiaExtenso, horaLocal, somarDias } from "@/lib/tempo";

async function carregarSalao(slug: string) {
  return db.salao.findFirst({ where: { slug, suspensa: false } });
}

function diaPermitido(dia: string, antecedenciaDias: number) {
  const hoje = diaLocal();
  return diaValido(dia) && dia >= hoje && dia <= somarDias(hoje, antecedenciaDias);
}

/** Só aceita o formato esperado (vem do navegador do cliente). */
function lerItens(itens: unknown): ItemPedido[] | null {
  if (!Array.isArray(itens) || itens.length === 0 || itens.length > 6) return null;
  const ok = itens.every(
    (i) =>
      i &&
      typeof i.servicoId === "string" &&
      (i.variacaoId == null || typeof i.variacaoId === "string") &&
      (i.adicionalIds == null || (Array.isArray(i.adicionalIds) && i.adicionalIds.length <= 10 && i.adicionalIds.every((x: unknown) => typeof x === "string"))),
  );
  if (!ok || new Set(itens.map((i) => i.servicoId)).size !== itens.length) return null;
  return itens.map((i) => ({ servicoId: i.servicoId, variacaoId: i.variacaoId ?? null, adicionalIds: i.adicionalIds ?? [] }));
}

async function servicosOnline(salaoId: string, servicoIds: string[]) {
  const n = await db.servico.count({ where: { id: { in: servicoIds }, salaoId, ativo: true, exibirOnline: true } });
  return n === new Set(servicoIds).size;
}

async function filialAtiva(salaoId: string, filialId: string) {
  return db.filial.findFirst({ where: { id: filialId, salaoId, ativo: true } });
}

export async function buscarHorarios(slug: string, filialId: string, itensBrutos: unknown, profissionalId: string | null, dia: string, simultaneo = false) {
  const salao = await carregarSalao(slug);
  const itens = lerItens(itensBrutos);
  if (!salao || !itens || !diaPermitido(dia, salao.antecedenciaDias)) return [];
  if (!(await filialAtiva(salao.id, filialId)) || !(await servicosOnline(salao.id, itens.map((i) => i.servicoId)))) return [];
  const horarios = await horariosDisponiveis({ salaoId: salao.id, filialId, itens, profissionalId, dia, simultaneo });
  return horarios.map((h) => h.hora);
}

export type SinalPix = { valorCentavos: number; pix: string | null; qrCode: string | null; link: string | null; expiraEm: string };

export type Confirmacao =
  | {
      ok: true;
      token: string;
      contaCriada: boolean;
      resumo: { profissional: string; servicos: string; dia: string; hora: string; inicioISO: string; fimISO: string; totalCentavos: number };
      sinal: SinalPix | null;
    }
  | { ok: false; erro: string; horarioOcupado?: boolean; jaAgendado?: string };

export async function agendar(
  slug: string,
  dados: {
    filialId: string;
    itens: unknown;
    profissionalId: string | null;
    simultaneo?: boolean;
    dia: string;
    hora: string;
    nome?: string;
    telefone?: string;
    senha?: string;
    aceite?: boolean;
    cpf?: string;
    indicacao?: string;
  },
): Promise<Confirmacao> {
  const salao = await carregarSalao(slug);
  if (!salao) return { ok: false, erro: "Salão não encontrado." };
  const itens = lerItens(dados.itens);
  if (!itens) return { ok: false, erro: "Escolha os serviços de novo." };
  if (!(await filialAtiva(salao.id, dados.filialId))) return { ok: false, erro: "Unidade indisponível." };
  if (!diaPermitido(dados.dia, salao.antecedenciaDias) || !/^\d{2}:\d{2}$/.test(dados.hora))
    return { ok: false, erro: "Data ou horário inválido." };
  if (!(await servicosOnline(salao.id, itens.map((i) => i.servicoId)))) return { ok: false, erro: "Serviço indisponível." };

  const logado = await clienteLogado(slug);
  let cliente: { id: string } | { nome: string; telefone: string };
  if (logado) {
    cliente = { id: logado.id };
  } else {
    const nome = (dados.nome ?? "").trim().slice(0, 80);
    const telefone = somenteDigitos(dados.telefone ?? "");
    if (!nome) return { ok: false, erro: "Informe seu nome." };
    if (telefone.length < 10 || telefone.length > 11) return { ok: false, erro: "Informe seu WhatsApp com DDD." };
    if (dados.senha) {
      if (!dados.aceite) return { ok: false, erro: "Para criar a conta, aceite os Termos de Uso e a Política de Privacidade." };
      const problema = await problemaNaSenha(dados.senha, nome, telefone);
      if (problema) return { ok: false, erro: problema };
    }
    // sem login, qualquer um agenda: limita por aparelho/rede e por telefone para ninguém lotar a agenda com robô
    const ip = await ipDaRequisicao();
    if ((await excedeuLimite(`agendar:ip:${ip}`, 10, 60)) || (await excedeuLimite(`agendar:tel:${salao.id}:${telefone}`, 4, 60)))
      return { ok: false, erro: "Muitos agendamentos seguidos. Tente de novo mais tarde ou fale com o salão." };
    cliente = { nome, telefone };
  }

  // Sinal: o Pix precisa do CPF (o Asaas exige); conferido de novo ao gerar a cobrança
  const comSinal = sinalAtivo(salao);
  const cpf = somenteDigitos(dados.cpf ?? "") || (logado?.cpf ?? "");
  if (comSinal && cpf && !cpfValido(cpf)) return { ok: false, erro: "CPF inválido. Confira os números." };

  let reserva;
  try {
    reserva = await reservarOnline({
      salaoId: salao.id,
      filialId: dados.filialId,
      itens,
      profissionalId: dados.profissionalId,
      simultaneo: !!dados.simultaneo,
      dia: dados.dia,
      hora: dados.hora,
      cliente,
      aguardandoSinal: comSinal,
      aoIdentificar: async (clienteId, novo, tx) => {
        if (novo && salao.indicacaoCreditoCentavos > 0) await registrarIndicacao(tx, salao.id, clienteId, dados.indicacao);
      },
    });
  } catch (e) {
    if (e instanceof ErroJaAgendado) return { ok: false, erro: e.message, jaAgendado: e.token };
    if (e instanceof ErroAgendamento) return { ok: false, erro: e.message, horarioOcupado: true };
    if (e instanceof ErroPedido) return { ok: false, erro: e.message };
    throw e;
  }
  const { criados, clienteId } = reserva;
  const primeiro = criados[0];
  const ultimo = criados.reduce((a, b) => (b.fim > a.fim ? b : a));
  const totalCentavos = criados.reduce((s, a) => s + a.precoCentavos, 0);

  // Sinal sobre o que não está no plano do cliente
  let sinal: SinalPix | null = null;
  if (comSinal) {
    const assinatura = await assinaturaVigente(clienteId);
    const doPlano = new Set(assinatura?.plano.servicos.map((s) => s.id) ?? []);
    const valor = valorDoSinal(criados.filter((a) => !doPlano.has(a.servicoId)).reduce((s, a) => s + a.precoCentavos, 0), salao.sinalPct);
    const doGrupo = primeiro.grupo ? { grupo: primeiro.grupo } : { id: primeiro.id };
    if (valor === 0) {
      await db.agendamento.updateMany({ where: doGrupo, data: { status: "AGENDADO" } });
    } else {
      try {
        const ag = await gerarCobrancaDoSinal({ salaoId: salao.id, agendamentoId: primeiro.id, clienteId, valorCentavos: valor, cpf });
        sinal = {
          valorCentavos: valor,
          pix: ag.sinalPix,
          qrCode: ag.sinalQrCode,
          link: ag.sinalLink,
          expiraEm: new Date(ag.criadoEm.getTime() + SINAL_PRAZO_MIN * 60_000).toISOString(),
        };
      } catch (e) {
        // sem Pix não segura o horário
        await db.agendamento.updateMany({ where: doGrupo, data: { status: "CANCELADO" } });
        if (e instanceof ErroAsaas || e instanceof ErroSinal) return { ok: false, erro: `Não foi possível gerar o Pix do sinal: ${e.message}` };
        throw e;
      }
    }
  }

  // Cria o acesso à área do cliente, se ele pediu e ainda não tinha senha.
  let contaCriada = false;
  if (!logado && dados.senha) {
    const c = await db.cliente.findUniqueOrThrow({ where: { id: clienteId } });
    // Só cria a senha para um cadastro que nasceu agora, neste agendamento. Um cliente que já existia
    // (balcão ou agendamento anterior) não pode ser "assumido" por quem só sabe o telefone dele.
    const recemCriado = c.criadoEm.getTime() > Date.now() - 2 * 60_000 && (await db.agendamento.count({ where: { clienteId: c.id } })) === criados.length;
    if (!c.senhaHash && recemCriado) {
      const senhaHash = await bcrypt.hash(dados.senha, 10);
      await db.cliente.update({ where: { id: c.id }, data: { senhaHash, aceiteTermosEm: new Date() } });
      await entrarComoCliente(slug, c.id, senhaHash);
      contaCriada = true;
    }
  }
  revalidatePath("/painel", "layout");
  const nomes = [...new Set(criados.map((a) => a.profissional.nome))];
  return {
    ok: true,
    token: primeiro.token,
    contaCriada,
    sinal,
    resumo: {
      profissional: nomes.join(" e "),
      servicos: reserva.itens.map((i) => i.descricao).join(" + "),
      dia: formatarDiaExtenso(dados.dia),
      hora: horaLocal(primeiro.inicio),
      inicioISO: primeiro.inicio.toISOString(),
      fimISO: ultimo.fim.toISOString(),
      totalCentavos,
    },
  };
}

/** O cliente na tela do Pix: o sinal já foi pago? */
export async function statusDoSinal(slug: string, token: string) {
  const ag = await db.agendamento.findFirst({ where: { token, salao: { slug } }, select: { status: true, sinalPagoEm: true } });
  return ag ? { status: ag.status, pago: !!ag.sinalPagoEm } : null;
}

export async function cancelarPeloCliente(slug: string, token: string): Promise<{ ok: boolean; erro?: string; credito?: string }> {
  const ag = await db.agendamento.findFirst({ where: { token, salao: { slug } }, include: { salao: true } });
  if (!ag) return { ok: false, erro: "Agendamento não encontrado." };
  if (!["AGUARDANDO_SINAL", "AGENDADO", "CONFIRMADO"].includes(ag.status)) return { ok: false, erro: "Este agendamento não pode mais ser cancelado." };
  if (ag.status !== "AGUARDANDO_SINAL" && ag.inicio.getTime() - Date.now() < ag.salao.cancelamentoHoras * 3600_000)
    return { ok: false, erro: `O cancelamento pelo site vai até ${ag.salao.cancelamentoHoras}h antes. Fale com o salão pelo WhatsApp.` };
  const credito = await db.$transaction(async (tx) => {
    await tx.agendamento.updateMany({
      where: ag.grupo ? { grupo: ag.grupo, status: { in: ["AGUARDANDO_SINAL", "AGENDADO", "CONFIRMADO"] } } : { id: ag.id },
      data: { status: "CANCELADO" },
    });
    const comSinal = await tx.agendamento.findFirst({ where: ag.grupo ? { grupo: ag.grupo, sinalCentavos: { not: null } } : { id: ag.id } });
    return comSinal ? creditarSinal(tx, comSinal.id) : 0;
  });
  revalidatePath(`/b/${slug}`, "layout");
  revalidatePath("/painel", "layout");
  return { ok: true, credito: credito ? `O sinal de ${formatarDinheiro(credito)} virou crédito para o seu próximo atendimento.` : undefined };
}

/** Cliente confirma que vai comparecer (pelo link do lembrete). */
export async function confirmarPeloCliente(slug: string, token: string): Promise<{ ok: boolean; erro?: string }> {
  const ag = await db.agendamento.findFirst({ where: { token, salao: { slug } } });
  if (!ag) return { ok: false, erro: "Agendamento não encontrado." };
  if (ag.status !== "AGENDADO") return { ok: ag.status === "CONFIRMADO" };
  await db.agendamento.updateMany({
    where: ag.grupo ? { grupo: ag.grupo, status: "AGENDADO" } : { id: ag.id },
    data: { status: "CONFIRMADO" },
  });
  revalidatePath(`/b/${slug}`, "layout");
  revalidatePath("/painel", "layout");
  return { ok: true };
}

/** Dia cheio: o cliente entra na lista de espera e o salão avisa se abrir um horário. */
export async function entrarNaListaDeEspera(
  slug: string,
  dados: { filialId: string; itens: unknown; dia: string; periodo: string; nome?: string; telefone?: string },
): Promise<{ ok: boolean; erro?: string }> {
  const salao = await carregarSalao(slug);
  const itens = lerItens(dados.itens);
  if (!salao || !itens) return { ok: false, erro: "Escolha os serviços de novo." };
  if (!(await filialAtiva(salao.id, dados.filialId)) || !diaPermitido(dados.dia, salao.antecedenciaDias)) return { ok: false, erro: "Dia indisponível." };
  const periodo = ["MANHA", "TARDE", "NOITE"].includes(dados.periodo) ? dados.periodo : "QUALQUER";
  const logado = await clienteLogado(slug);
  const nome = (logado?.nome ?? dados.nome ?? "").trim().slice(0, 80);
  const telefone = logado?.telefone ?? somenteDigitos(dados.telefone ?? "");
  if (!nome) return { ok: false, erro: "Informe seu nome." };
  if (telefone.length < 10 || telefone.length > 11) return { ok: false, erro: "Informe seu WhatsApp com DDD." };
  const ip = await ipDaRequisicao();
  if ((await excedeuLimite(`espera:ip:${ip}`, 6, 60)) || (await excedeuLimite(`espera:tel:${salao.id}:${telefone}`, 3, 60)))
    return { ok: false, erro: "Muitos pedidos seguidos. Tente de novo mais tarde." };
  const existente = await db.listaEspera.findFirst({ where: { salaoId: salao.id, telefone, dia: dados.dia, avisadoEm: null } });
  if (existente) await db.listaEspera.update({ where: { id: existente.id }, data: { servicoIds: itens.map((i) => i.servicoId), periodo, filialId: dados.filialId, nome } });
  else await db.listaEspera.create({ data: { salaoId: salao.id, filialId: dados.filialId, servicoIds: itens.map((i) => i.servicoId), nome, telefone, dia: dados.dia, periodo } });
  revalidatePath("/painel", "layout");
  return { ok: true };
}
