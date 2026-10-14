"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { ErroAgendamento, ErroJaAgendado, horariosDisponiveis, reservarOnline } from "@/lib/agenda";
import { clienteLogado, entrarComoCliente } from "@/lib/clienteAuth";
import { db } from "@/lib/db";
import { excedeuLimite, ipDaRequisicao } from "@/lib/limite";
import { problemaNaSenha } from "@/lib/senha";
import { somenteDigitos } from "@/lib/formato";
import { diaLocal, diaValido, formatarDiaExtenso, horaLocal, somarDias } from "@/lib/tempo";

async function carregarSalao(slug: string) {
  return db.salao.findFirst({ where: { slug, suspensa: false } });
}

function diaPermitido(dia: string, antecedenciaDias: number) {
  const hoje = diaLocal();
  return diaValido(dia) && dia >= hoje && dia <= somarDias(hoje, antecedenciaDias);
}

async function servicosOnline(salaoId: string, servicoIds: string[]) {
  if (servicoIds.length === 0 || servicoIds.length > 6) return false;
  const n = await db.servico.count({ where: { id: { in: servicoIds }, salaoId, ativo: true, exibirOnline: true } });
  return n === new Set(servicoIds).size;
}

async function filialAtiva(salaoId: string, filialId: string) {
  return db.filial.findFirst({ where: { id: filialId, salaoId, ativo: true } });
}

export async function buscarHorarios(slug: string, filialId: string, servicoIds: string[], profissionalId: string | null, dia: string) {
  const salao = await carregarSalao(slug);
  if (!salao || !diaPermitido(dia, salao.antecedenciaDias)) return [];
  if (!(await filialAtiva(salao.id, filialId)) || !(await servicosOnline(salao.id, servicoIds))) return [];
  const horarios = await horariosDisponiveis({ salaoId: salao.id, filialId, servicoIds, profissionalId, dia });
  return horarios.map((h) => h.hora);
}

export type Confirmacao =
  | {
      ok: true;
      token: string;
      contaCriada: boolean;
      resumo: { profissional: string; servicos: string; dia: string; hora: string; inicioISO: string; fimISO: string };
    }
  | { ok: false; erro: string; horarioOcupado?: boolean; jaAgendado?: string };

export async function agendar(
  slug: string,
  dados: { filialId: string; servicoIds: string[]; profissionalId: string | null; dia: string; hora: string; nome?: string; telefone?: string; senha?: string; aceite?: boolean },
): Promise<Confirmacao> {
  const salao = await carregarSalao(slug);
  if (!salao) return { ok: false, erro: "Salão não encontrada." };
  if (!(await filialAtiva(salao.id, dados.filialId))) return { ok: false, erro: "Unidade indisponível." };
  if (!diaPermitido(dados.dia, salao.antecedenciaDias) || !/^\d{2}:\d{2}$/.test(dados.hora))
    return { ok: false, erro: "Data ou horário inválido." };
  if (!(await servicosOnline(salao.id, dados.servicoIds))) return { ok: false, erro: "Serviço indisponível." };

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

  try {
    const criados = await reservarOnline({ ...dados, salaoId: salao.id, cliente });
    const primeiro = criados[0];
    const ultimo = criados[criados.length - 1];

    // Cria o acesso à área do cliente, se ele pediu e ainda não tinha senha.
    let contaCriada = false;
    if (!logado && dados.senha) {
      const c = await db.cliente.findUniqueOrThrow({ where: { id: primeiro.clienteId } });
      // Só cria a senha para um cadastro que nasceu agora, neste agendamento. Um cliente que já existia
      // (balcão ou agendamento anterior) não pode ser "assumido" por quem só sabe o telefone dele.
      const recemCriado =
        c.criadoEm.getTime() > Date.now() - 2 * 60_000 && (await db.agendamento.count({ where: { clienteId: c.id } })) === criados.length;
      if (!c.senhaHash && recemCriado) {
        const senhaHash = await bcrypt.hash(dados.senha, 10);
        await db.cliente.update({ where: { id: c.id }, data: { senhaHash, aceiteTermosEm: new Date() } });
        await entrarComoCliente(slug, c.id, senhaHash);
        contaCriada = true;
      }
    }
    revalidatePath("/painel", "layout");
    return {
      ok: true,
      token: primeiro.token,
      contaCriada,
      resumo: {
        profissional: primeiro.profissional.nome,
        servicos: criados.map((a) => a.servico.nome).join(" + "),
        dia: formatarDiaExtenso(dados.dia),
        hora: horaLocal(primeiro.inicio),
        inicioISO: primeiro.inicio.toISOString(),
        fimISO: ultimo.fim.toISOString(),
      },
    };
  } catch (e) {
    if (e instanceof ErroJaAgendado) return { ok: false, erro: e.message, jaAgendado: e.token };
    if (e instanceof ErroAgendamento) return { ok: false, erro: e.message, horarioOcupado: true };
    throw e;
  }
}

export async function cancelarPeloCliente(slug: string, token: string): Promise<{ ok: boolean; erro?: string }> {
  const ag = await db.agendamento.findFirst({ where: { token, salao: { slug } }, include: { salao: true } });
  if (!ag) return { ok: false, erro: "Agendamento não encontrado." };
  if (ag.status !== "AGENDADO" && ag.status !== "CONFIRMADO") return { ok: false, erro: "Este agendamento não pode mais ser cancelado." };
  if (ag.inicio.getTime() - Date.now() < ag.salao.cancelamentoHoras * 3600_000)
    return { ok: false, erro: `O cancelamento pelo site vai até ${ag.salao.cancelamentoHoras}h antes. Fale com o salão pelo WhatsApp.` };
  await db.agendamento.updateMany({
    where: ag.grupo ? { grupo: ag.grupo, status: { in: ["AGENDADO", "CONFIRMADO"] } } : { id: ag.id },
    data: { status: "CANCELADO" },
  });
  revalidatePath(`/b/${slug}`, "layout");
  revalidatePath("/painel", "layout");
  return { ok: true };
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
