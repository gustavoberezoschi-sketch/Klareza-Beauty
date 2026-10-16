import type { Metadata } from "next";
import { BellRing, CalendarCheck, HeartHandshake, MessageCircle, RefreshCw, X } from "lucide-react";
import { BotaoWhatsApp } from "@/components/BotaoWhatsApp";
import { FormAcao } from "@/components/FormAcao";
import { Cabecalho, Etiqueta, Secao, Vazio } from "@/components/ui";
import { exigirSessao } from "@/lib/auth";
import { filialDoPainel } from "@/lib/filial";
import { formatarTelefone } from "@/lib/formato";
import { type ItemCuidados, type ItemEspera, type ItemLembrete, type ItemRetorno, NOME_PERIODO, listaDeCuidados, listaDeEspera, listaDeLembretes, listaDeRetornos } from "@/lib/lembretes";
import { MSG_CONFIRMACAO_PADRAO, MSG_LEMBRETE_PADRAO, VARIAVEIS } from "@/lib/mensagens";
import { enderecoDoSite } from "@/lib/site";
import { formatarDia, diaLocal, horaLocal } from "@/lib/tempo";
import { removerDaEspera, salvarMensagens } from "./actions";

export const metadata: Metadata = { title: "Lembretes" };
export const dynamic = "force-dynamic";

export default async function Lembretes() {
  const sessao = await exigirSessao();
  const ctx = await filialDoPainel(sessao);
  const varias = ctx.filiais.filter((f) => f.ativo).length > 1;
  const site = await enderecoDoSite();
  const [{ salao, hoje, amanha, novos }, retornos, espera, cuidados] = await Promise.all([
    listaDeLembretes(sessao, ctx, site),
    listaDeRetornos(sessao, ctx, site),
    listaDeEspera(sessao, ctx, site),
    listaDeCuidados(sessao, ctx),
  ]);
  const faltam = (l: ItemLembrete[]) => l.filter((i) => !i.lembreteEnviadoEm).length;

  return (
    <div>
      <Cabecalho
        titulo="Lembretes por WhatsApp"
        descricao="Aperte o botão: o WhatsApp abre com a mensagem pronta para o cliente. Depois de enviar, ele fica marcado aqui."
      />
      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <Etiqueta tom={faltam(amanha) ? "latao" : "verde"}>Amanhã: {faltam(amanha)} para enviar</Etiqueta>
        <Etiqueta tom={faltam(hoje) ? "latao" : "verde"}>Hoje: {faltam(hoje)} para enviar</Etiqueta>
        <Etiqueta tom={novos.length ? "azul" : "verde"}>Novos pelo site: {novos.length}</Etiqueta>
        <Etiqueta tom={retornos.some((r) => !r.lembradoEm) ? "latao" : "verde"}>Manutenção: {retornos.filter((r) => !r.lembradoEm).length} para avisar</Etiqueta>
        <Etiqueta tom={espera.some((e) => e.horarios.length && !e.avisadoEm) ? "azul" : "verde"}>Lista de espera: {espera.filter((e) => e.horarios.length && !e.avisadoEm).length} com horário livre</Etiqueta>
        <Etiqueta tom={cuidados.some((c) => !c.enviadoEm) ? "latao" : "verde"}>Cuidados: {cuidados.filter((c) => !c.enviadoEm).length} para enviar</Etiqueta>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <Lista titulo="Clientes de amanhã" itens={amanha} tipo="LEMBRETE" varias={varias} vazio="Ninguém agendado para amanhã." />
          <Lista titulo="Clientes de hoje" itens={hoje} tipo="LEMBRETE" varias={varias} vazio="Nenhum atendimento pela frente hoje." />
          <Lista
            titulo="Novos agendamentos pelo site"
            descricao="Mande a confirmação para quem agendou sozinho pelo link."
            itens={novos}
            tipo="CONFIRMACAO"
            varias={varias}
            vazio="Nenhum agendamento novo esperando confirmação."
          />
          <Espera itens={espera} />
          <Cuidados itens={cuidados} />
          <Retornos itens={retornos} />
        </div>

        {!sessao.profissionalId && (
          <div className="xl:sticky xl:top-6 xl:self-start">
            <Secao titulo="Texto das mensagens">
              <FormAcao acao={salvarMensagens} className="grid gap-4">
                <div>
                  <label className="label" htmlFor="msgLembrete">Lembrete (hoje e amanhã)</label>
                  <textarea id="msgLembrete" name="msgLembrete" rows={8} className="input font-sans" defaultValue={salao.msgLembrete ?? MSG_LEMBRETE_PADRAO} />
                </div>
                <div>
                  <label className="label" htmlFor="msgConfirmacao">Confirmação de agendamento</label>
                  <textarea id="msgConfirmacao" name="msgConfirmacao" rows={8} className="input font-sans" defaultValue={salao.msgConfirmacao ?? MSG_CONFIRMACAO_PADRAO} />
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer font-semibold text-couro-700">Palavras que viram dados do cliente</summary>
                  <ul className="mt-2 space-y-1 text-couro-400">
                    {VARIAVEIS.map(([v, d]) => <li key={v}><code className="rounded bg-fundo px-1 font-semibold text-tinta">{v}</code> {d}</li>)}
                  </ul>
                </details>
                <p className="text-xs text-couro-400">Apague todo o texto e salve para voltar à mensagem padrão.</p>
                <button className="btn-primario">Salvar mensagens</button>
              </FormAcao>
            </Secao>
          </div>
        )}
      </div>
    </div>
  );
}

function Lista({
  titulo,
  descricao,
  itens,
  tipo,
  varias,
  vazio,
}: {
  titulo: string;
  descricao?: string;
  itens: ItemLembrete[];
  tipo: "LEMBRETE" | "CONFIRMACAO";
  varias: boolean;
  vazio: string;
}) {
  return (
    <Secao titulo={titulo}>
      {descricao && <p className="-mt-2 mb-3 text-sm text-couro-400">{descricao}</p>}
      {itens.length === 0 ? (
        <Vazio icone={tipo === "LEMBRETE" ? MessageCircle : CalendarCheck} titulo={vazio} />
      ) : (
        <ul className="divide-y divide-black/[0.06]">
          {itens.map((i) => (
            <li key={i.ids[0]} className="flex flex-wrap items-center gap-3 py-3">
              <span className="numero w-16 text-lg">
                {horaLocal(i.inicio)}
                {tipo === "CONFIRMACAO" && <span className="block text-xs font-normal text-couro-400">{formatarDia(diaLocal(i.inicio)).slice(0, 5)}</span>}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {i.cliente} {i.status === "CONFIRMADO" && <Etiqueta tom="azul">Confirmado</Etiqueta>}
                </p>
                <p className="truncate text-sm text-couro-400">
                  {i.servicos.join(" + ")} com {i.profissional}
                  {varias && ` · ${i.unidade}`} · {formatarTelefone(i.telefone)}
                </p>
              </div>
              <BotaoWhatsApp
                href={tipo === "LEMBRETE" ? i.linkLembrete : i.linkConfirmacao}
                ids={i.ids}
                tipo={tipo}
                enviadoEm={tipo === "LEMBRETE" ? i.lembreteEnviadoEm : i.confirmacaoEnviadaEm}
                rotulo={tipo === "LEMBRETE" ? "Lembrar" : "Confirmar"}
              />
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

function Retornos({ itens }: { itens: ItemRetorno[] }) {
  const hoje = diaLocal();
  return (
    <Secao titulo="Hora da manutenção">
      <p className="-mt-2 mb-3 text-sm text-couro-400">
        Clientes cujo serviço (cílios, unhas...) está vencendo e que ainda não marcaram horário. Defina o prazo em Serviços → “Manutenção: lembrar após”.
      </p>
      {itens.length === 0 ? (
        <Vazio icone={RefreshCw} titulo="Ninguém precisando de manutenção agora." />
      ) : (
        <ul className="divide-y divide-black/[0.06]">
          {itens.map((i) => (
            <li key={i.clienteId} className="flex flex-wrap items-center gap-3 py-3">
              <span className="w-16 text-sm">
                <span className="numero block text-lg">{i.dias}d</span>
                <span className="text-xs text-couro-400">desde a última</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {i.cliente} {i.vence < hoje ? <Etiqueta tom="vermelho">Venceu {formatarDia(i.vence).slice(0, 5)}</Etiqueta> : <Etiqueta tom="latao">Vence {formatarDia(i.vence).slice(0, 5)}</Etiqueta>}
                </p>
                <p className="truncate text-sm text-couro-400">
                  {i.servico} em {formatarDia(i.ultimaVez).slice(0, 5)} · {formatarTelefone(i.telefone)}
                </p>
              </div>
              <BotaoWhatsApp href={i.link} ids={[i.clienteId]} tipo="RETORNO" enviadoEm={i.lembradoEm} rotulo="Avisar" />
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

function Espera({ itens }: { itens: ItemEspera[] }) {
  return (
    <Secao titulo="Lista de espera">
      <p className="-mt-2 mb-3 text-sm text-couro-400">Clientes que queriam um dia cheio. Quando abre horário (cancelamento), avise com um toque.</p>
      {itens.length === 0 ? (
        <Vazio icone={BellRing} titulo="Ninguém na lista de espera." />
      ) : (
        <ul className="divide-y divide-black/[0.06]">
          {itens.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="numero w-16 text-lg">{formatarDia(i.dia).slice(0, 5)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {i.nome}{" "}
                  {i.horarios.length ? <Etiqueta tom="verde">{i.horarios.length} horário(s) livre(s)</Etiqueta> : <Etiqueta>Dia ainda cheio</Etiqueta>}
                </p>
                <p className="truncate text-sm text-couro-400">
                  {i.servicos} · {NOME_PERIODO[i.periodo]} · {formatarTelefone(i.telefone)}
                  {i.horarios.length > 0 && ` · ${i.horarios.slice(0, 5).join(", ")}`}
                </p>
              </div>
              {i.horarios.length > 0 && <BotaoWhatsApp href={i.link} ids={[i.id]} tipo="ESPERA" enviadoEm={i.avisadoEm} rotulo="Avisar" />}
              <form action={removerDaEspera}>
                <input type="hidden" name="id" value={i.id} />
                <button className="rounded-lg p-1.5 text-couro-300 hover:bg-fundo hover:text-poste-vermelho" title="Tirar da lista" aria-label={`Tirar ${i.nome} da lista`}><X className="size-4" /></button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

function Cuidados({ itens }: { itens: ItemCuidados[] }) {
  return (
    <Secao titulo="Cuidados pós-atendimento">
      <p className="-mt-2 mb-3 text-sm text-couro-400">Orientações de cada serviço (cadastradas em Serviços), com pedido de foto e de avaliação. Atendimentos de hoje e de ontem.</p>
      {itens.length === 0 ? (
        <Vazio icone={HeartHandshake} titulo="Nenhum atendimento com cuidados para enviar." />
      ) : (
        <ul className="divide-y divide-black/[0.06]">
          {itens.map((i) => (
            <li key={i.comandaId} className="flex flex-wrap items-center gap-3 py-3">
              <span className="numero w-16 text-lg">{horaLocal(new Date(i.fechadaEm))}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{i.cliente}</p>
                <p className="truncate text-sm text-couro-400">{i.servicos} · {formatarTelefone(i.telefone)}</p>
              </div>
              <BotaoWhatsApp href={i.link} ids={[i.comandaId]} tipo="CUIDADOS" enviadoEm={i.enviadoEm} rotulo="Enviar cuidados" />
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}
