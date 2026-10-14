import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, CalendarCheck, Check, Clock, MessageCircle, ReceiptText, Scissors, UserRound } from "lucide-react";
import { BotaoWhatsApp } from "@/components/BotaoWhatsApp";
import { FormAcao } from "@/components/FormAcao";
import { Avatar, Cabecalho, Etiqueta, Secao } from "@/components/ui";
import { exigirSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatarDinheiro, formatarTelefone } from "@/lib/formato";
import { MSG_CONFIRMACAO_PADRAO, MSG_LEMBRETE_PADRAO, linkDaMensagem } from "@/lib/mensagens";
import { enderecoDoSite } from "@/lib/site";
import { diaLocal, formatarDiaExtenso, horaLocal } from "@/lib/tempo";
import { iniciarAtendimento, mudarStatus, remarcarAgendamento } from "../../agenda/actions";

export const metadata: Metadata = { title: "Agendamento" };
export const dynamic = "force-dynamic";

const STATUS = {
  AGENDADO: { rotulo: "Agendado", tom: "latao" },
  CONFIRMADO: { rotulo: "Confirmado", tom: "azul" },
  CONCLUIDO: { rotulo: "Concluído", tom: "verde" },
  CANCELADO: { rotulo: "Cancelado", tom: "neutro" },
  FALTOU: { rotulo: "Faltou", tom: "vermelho" },
} as const;

export default async function Agendamento({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirSessao();
  const ag = await db.agendamento.findFirst({
    where: {
      id: (await params).id,
      salaoId: sessao.salaoId,
      ...(sessao.profissionalId ? { profissionalId: sessao.profissionalId } : {}),
    },
    include: { cliente: true, servico: true, profissional: true, salao: true, comanda: true, filial: true },
  });
  if (!ag) notFound();

  const profissionais = await db.profissional.findMany({ where: { salaoId: sessao.salaoId, ativo: true }, orderBy: { nome: "asc" } });
  const dia = diaLocal(ag.inicio);
  const quando = `${formatarDiaExtenso(dia)} às ${horaLocal(ag.inicio)}`;
  const status = STATUS[ag.status as keyof typeof STATUS] ?? STATUS.AGENDADO;
  const aberto = ag.status === "AGENDADO" || ag.status === "CONFIRMADO";
  // passou do horário sem comanda fechada: conta como atendido sozinho, mas o profissional ainda pode marcar falta ou lançar a comanda
  const checkinAuto = ag.status === "CONCLUIDO" && !!ag.checkinAutoEm;
  const grupo = ag.grupo
    ? await db.agendamento.findMany({ where: { grupo: ag.grupo, status: { not: "CANCELADO" } }, include: { servico: true }, orderBy: { inicio: "asc" } })
    : [ag];
  const dadosMsg = {
    cliente: ag.cliente.nome,
    salao: ag.salao.nome,
    inicio: grupo[0].inicio,
    servicos: grupo.map((g) => g.servico.nome),
    profissional: ag.profissional.nome,
    unidade: ag.filial.nome,
    endereco: ag.filial.endereco,
    link: `${await enderecoDoSite()}/b/${ag.salao.slug}/agendamento/${grupo[0].token}`,
  };
  const ids = grupo.map((g) => g.id);

  return (
    <div className="mx-auto max-w-4xl">
      <Cabecalho
        voltar={{ href: `/painel/agenda?dia=${dia}`, rotulo: "Agenda" }}
        titulo={
          <span className="flex items-center gap-3">
            {ag.cliente.nome} <Etiqueta tom={status.tom}>{checkinAuto ? "Atendido · check-in automático" : status.rotulo}</Etiqueta>
          </span>
        }
        descricao={<span className="inline-block first-letter:uppercase">{quando}</span>}
        acoes={
          aberto || (checkinAuto && !(ag.comanda && ag.comanda.status !== "CANCELADA")) ? (
            <form action={iniciarAtendimento}>
              <input type="hidden" name="id" value={ag.id} />
              <button className="btn-destaque">
                <ReceiptText className="size-4" /> {ag.comanda ? "Abrir comanda" : "Iniciar atendimento"}
              </button>
            </form>
          ) : ag.comanda && ag.comanda.status !== "CANCELADA" ? (
            <Link href={`/painel/comandas/${ag.comanda.id}`} className="btn-secundario">
              <ReceiptText className="size-4" /> Ver comanda #{ag.comanda.numero}
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Secao titulo="Detalhes">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Info icone={Scissors} rotulo="Serviço" valor={`${ag.servico.nome} · ${formatarDinheiro(ag.precoCentavos)}`} />
              <Info icone={Clock} rotulo="Horário" valor={`${horaLocal(ag.inicio)} às ${horaLocal(ag.fim)}`} />
              <div className="flex items-center gap-3">
                <Avatar nome={ag.profissional.nome} foto={ag.profissional.foto} tamanho={36} />
                <div>
                  <dt className="rotulo">Profissional</dt>
                  <dd className="font-medium">{ag.profissional.nome}</dd>
                </div>
              </div>
              <Info icone={CalendarCheck} rotulo="Origem" valor={ag.origem === "ONLINE" ? "Agendou pelo link" : "Agendado no balcão"} />
            </dl>
            {ag.observacao && <p className="mt-4 rounded-xl bg-fundo p-3 text-sm">{ag.observacao}</p>}
          </Secao>

          {aberto && (
            <Secao titulo="Remarcar">
              <FormAcao acao={remarcarAgendamento} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                <input type="hidden" name="id" value={ag.id} />
                <div>
                  <label className="label" htmlFor="dia">Data</label>
                  <input id="dia" type="date" name="dia" defaultValue={dia} className="input" required />
                </div>
                <div>
                  <label className="label" htmlFor="hora">Hora</label>
                  <input id="hora" type="time" name="hora" defaultValue={horaLocal(ag.inicio)} className="input" required />
                </div>
                <div>
                  <label className="label" htmlFor="profissionalId">Profissional</label>
                  <select id="profissionalId" name="profissionalId" defaultValue={ag.profissionalId} className="input" disabled={!!sessao.profissionalId}>
                    {profissionais.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
                  </select>
                </div>
                <button className="btn-primario">Remarcar</button>
                <label className="flex items-center gap-2 text-sm sm:col-span-4">
                  <input type="checkbox" name="encaixe" /> Encaixe (ignorar conflitos)
                </label>
              </FormAcao>
            </Secao>
          )}
        </div>

        <div className="space-y-4">
          <Secao titulo="Cliente">
            <Link href={`/painel/clientes/${ag.cliente.id}`} className="flex items-center gap-3 rounded-xl p-1 hover:bg-fundo">
              <span className="grid size-10 place-items-center rounded-full bg-latao-100 text-latao-700">
                <UserRound className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">{ag.cliente.nome}</span>
                <span className="text-sm text-couro-400">{formatarTelefone(ag.cliente.telefone)}</span>
              </span>
            </Link>
            {aberto && (
              <div className="mt-4 space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium"><MessageCircle className="size-4 text-emerald-600" /> Confirmação</span>
                  <BotaoWhatsApp
                    href={linkDaMensagem(ag.cliente.telefone, ag.salao.msgConfirmacao ?? MSG_CONFIRMACAO_PADRAO, dadosMsg)}
                    ids={ids}
                    tipo="CONFIRMACAO"
                    enviadoEm={grupo[0].confirmacaoEnviadaEm?.toISOString() ?? null}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium"><MessageCircle className="size-4 text-emerald-600" /> Lembrete</span>
                  <BotaoWhatsApp
                    href={linkDaMensagem(ag.cliente.telefone, ag.salao.msgLembrete ?? MSG_LEMBRETE_PADRAO, dadosMsg)}
                    ids={ids}
                    tipo="LEMBRETE"
                    enviadoEm={grupo[0].lembreteEnviadoEm?.toISOString() ?? null}
                  />
                </div>
              </div>
            )}
          </Secao>

          {aberto && (
            <Secao titulo="Situação">
              <div className="grid gap-2">
                {ag.status === "AGENDADO" && (
                  <BotaoStatus id={ag.id} status="CONFIRMADO" classe="btn-secundario justify-start">
                    <Check className="size-4 text-poste-azul" /> Cliente confirmou
                  </BotaoStatus>
                )}
                <BotaoStatus id={ag.id} status="FALTOU" classe="btn-secundario justify-start">
                  <Ban className="size-4 text-poste-vermelho" /> Cliente faltou
                </BotaoStatus>
                <BotaoStatus id={ag.id} status="CANCELADO" classe="btn-perigo justify-start">
                  <Ban className="size-4" /> Cancelar agendamento
                </BotaoStatus>
              </div>
            </Secao>
          )}
          {checkinAuto && (
            <Secao titulo="Situação">
              <p className="mb-3 text-sm text-couro-700">
                O horário passou e o atendimento foi marcado como feito sozinho. Para assinante, conta como um uso do plano.
              </p>
              <BotaoStatus id={ag.id} status="FALTOU" classe="btn-secundario w-full justify-start">
                <Ban className="size-4 text-poste-vermelho" /> Cliente faltou
              </BotaoStatus>
            </Secao>
          )}
          {(ag.status === "FALTOU" || ag.status === "CANCELADO") && (
            <BotaoStatus id={ag.id} status="AGENDADO" classe="btn-secundario w-full">
              Reabrir agendamento
            </BotaoStatus>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ icone: Icone, rotulo, valor }: { icone: typeof Clock; rotulo: string; valor: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-fundo text-couro-700">
        <Icone className="size-4" />
      </span>
      <div>
        <dt className="rotulo">{rotulo}</dt>
        <dd className="font-medium">{valor}</dd>
      </div>
    </div>
  );
}

function BotaoStatus({ id, status, classe, children }: { id: string; status: string; classe: string; children: React.ReactNode }) {
  return (
    <form action={mudarStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`${classe} w-full`}>{children}</button>
    </form>
  );
}
