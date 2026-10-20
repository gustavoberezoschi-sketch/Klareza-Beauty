import type { Metadata } from "next";
import { Check, Crown } from "lucide-react";
import { FormAcao } from "@/components/FormAcao";
import { exigirCliente } from "@/lib/clienteAuth";
import { cobraOnline } from "@/lib/clubeOnline";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { temRecurso } from "@/lib/planosSistema";
import { formatarDinheiro, linkWhatsApp } from "@/lib/formato";
import { planoDoCliente } from "@/lib/publico";
import { diaLocal, formatarDia } from "@/lib/tempo";
import { assinarPeloCliente, cancelarPeloCliente } from "../actions";

export const metadata: Metadata = { title: "Meu plano" };

export default async function Plano({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cliente = await exigirCliente(slug);
  const [plano, b] = await Promise.all([
    planoDoCliente(cliente.id),
    db.salao.findUniqueOrThrow({
      where: { slug },
      select: { nome: true, plano: true, telefone: true, asaasApiKey: true, asaasStatus: true, cobrancaOnlineClube: true, planos: { where: { ativo: true, exibirOnline: true }, include: { servicos: { select: { nome: true, id: true } } }, orderBy: { precoCentavos: "asc" } } },
    }),
  ]);
  if (!temRecurso(b.plano, "clube")) notFound();
  const atual = plano ? b.planos.find((p) => p.nome === plano.nome) : null;
  const online = cobraOnline(b);
  const minha = await db.assinatura.findFirst({
    where: { clienteId: cliente.id, status: { in: ["ATIVA", "AGUARDANDO"] } },
    include: { plano: true, extras: { where: { status: "PENDENTE" }, orderBy: { criadoEm: "asc" } } },
    orderBy: { criadoEm: "desc" },
  });
  const totalExtras = minha?.extras.reduce((s, e) => s + e.valorCentavos, 0) ?? 0;
  const botao = "mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[var(--cor)] px-4 py-3 font-semibold text-[var(--cor-texto)]";

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Plano</h1>
      {minha?.status === "AGUARDANDO" && (
        <div className="rounded-2xl border-2 border-[var(--cor)] bg-white p-5">
          <p className="font-display text-lg font-bold">{minha.plano.nome}: falta cadastrar o cartão</p>
          <p className="mt-1 text-sm text-couro-700">
            Informe o cartão uma vez só. A primeira mensalidade é cobrada agora e as próximas são debitadas automaticamente todo mês.
          </p>
          {minha.linkPagamento && <a href={minha.linkPagamento} className={botao}>Cadastrar cartão e assinar</a>}
        </div>
      )}
      {plano ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 font-display text-xl font-bold"><Crown className="size-5 text-[var(--cor)]" /> {plano.nome}</p>
          {plano.descricao && <p className="mt-1 text-sm text-couro-700">{plano.descricao}</p>}
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-fundo p-3"><dt className="text-couro-400">Mensalidade</dt><dd className="numero text-lg">{formatarDinheiro(plano.precoCentavos)}</dd></div>
            <div className="rounded-xl bg-fundo p-3"><dt className="text-couro-400">Pago até</dt><dd className="numero text-lg">{formatarDia(plano.pagoAte)}</dd></div>
            <div className="col-span-2 rounded-xl bg-fundo p-3">
              <dt className="text-couro-400">Uso neste mês</dt>
              <dd className="font-semibold">{plano.limite ? `${plano.usados} de ${plano.limite} atendimento(s)` : `${plano.usados} atendimento(s) · ilimitado`}</dd>
            </div>
          </dl>
          {minha && minha.extras.length > 0 && (
            <div className="mt-4 rounded-xl border border-black/[0.06] p-3 text-sm">
              <p className="font-semibold">{minha.canceladaEm ? "Extras a pagar (cobrança à parte)" : "Extras na próxima fatura"}</p>
              <ul className="mt-2 space-y-1">
                {minha.extras.map((e) => (
                  <li key={e.id} className="flex justify-between gap-3">
                    <span className="text-couro-700">{e.descricao.replace(/^Comanda #\d+: /, "")}</span>
                    <span className="shrink-0 tabular-nums">{formatarDinheiro(e.valorCentavos)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex justify-between border-t border-black/[0.06] pt-2 font-semibold">
                <span>{minha.canceladaEm ? "Total" : "Próxima fatura"}</span>
                <span className="tabular-nums">{formatarDinheiro((minha.canceladaEm ? 0 : minha.plano.precoCentavos) + totalExtras)}</span>
              </p>
              {minha.canceladaEm && <p className="mt-1 text-xs text-couro-400">O link de pagamento chega por e-mail ou SMS, enviado pelo Asaas.</p>}
            </div>
          )}
          {atual && (
            <ul className="mt-4 space-y-1.5 text-sm">
              {atual.servicos.map((s) => <li key={s.id} className="flex items-center gap-2"><Check className="size-4 text-[var(--cor)]" /> {s.nome}</li>)}
            </ul>
          )}
          {minha?.asaasId && !minha.canceladaEm && (
            <p className="mt-4 text-sm text-couro-700">
              Cobrança automática no cartão: a mensalidade é debitada todo mês e o plano renova sozinho. Próxima renovação em {formatarDia(minha.pagoAte)}.
            </p>
          )}
          {minha?.canceladaEm && (
            <p className="mt-4 rounded-xl bg-fundo p-3 text-sm text-couro-700">
              Assinatura cancelada: nenhuma nova cobrança será feita. Você continua usando o plano até {formatarDia(minha.pagoAte)}.
            </p>
          )}
          {minha?.status === "ATIVA" && minha.linkPagamento && (
            <div className="mt-4 rounded-xl bg-poste-vermelho/10 p-3 text-sm text-poste-vermelho">
              A cobrança da mensalidade no seu cartão não foi aprovada. Atualize o cartão para continuar usando o plano.
              <a href={minha.linkPagamento} className={botao}>Atualizar cartão</a>
            </div>
          )}
          {plano.pagoAte < diaLocal() && !minha?.linkPagamento && <p className="mt-4 rounded-xl bg-poste-vermelho/10 p-3 text-sm text-poste-vermelho">A mensalidade está em aberto. Acerte na próxima visita para continuar usando o plano.</p>}
          {minha?.asaasId && minha.status === "ATIVA" && !minha.canceladaEm && (
            <details className="group mt-5 border-t border-black/[0.06] pt-4">
              <summary className="cursor-pointer list-none text-sm font-medium text-couro-400 hover:text-poste-vermelho [&::-webkit-details-marker]:hidden">Cancelar assinatura</summary>
              <FormAcao acao={cancelarPeloCliente.bind(null, slug)} className="mt-3 grid gap-2">
                <input type="hidden" name="id" value={minha.id} />
                <p className="text-sm text-couro-700">
                  As cobranças no cartão param agora e você continua usando o plano até {formatarDia(minha.pagoAte)}.
                  {minha.extras.length > 0 && " Os extras em aberto serão cobrados à parte."}
                </p>
                <button className="w-full rounded-xl border border-poste-vermelho/30 py-2.5 text-sm font-semibold text-poste-vermelho">Sim, cancelar assinatura</button>
              </FormAcao>
            </details>
          )}
        </div>
      ) : (
        <p className="text-sm text-couro-700">Você ainda não é assinante. Conheça os planos:</p>
      )}

      {!plano && minha?.status !== "AGUARDANDO" && b.planos.map((p) => (
        <div key={p.id} className="rounded-2xl border-2 border-[var(--cor)] bg-white p-5">
          <p className="font-display text-lg font-bold">{p.nome}</p>
          <p className="numero mt-1 text-3xl">{formatarDinheiro(p.precoCentavos)}<span className="text-sm font-normal text-couro-400">/mês</span></p>
          {p.descricao && <p className="mt-2 text-sm text-couro-700">{p.descricao}</p>}
          <ul className="mt-3 space-y-1 text-sm">{p.servicos.map((s) => <li key={s.id} className="flex items-center gap-2"><Check className="size-4 text-[var(--cor)]" /> {s.nome}</li>)}</ul>
          <p className="mt-2 text-xs text-couro-400">{p.usosPorMes ? `Até ${p.usosPorMes} vez(es) por mês` : "Uso ilimitado"}</p>
          {online ? (
            <FormAcao acao={assinarPeloCliente.bind(null, slug)} className="mt-4 grid gap-2">
              <input type="hidden" name="planoId" value={p.id} />
              <input name="cpf" defaultValue={cliente.cpf ?? ""} className="input" placeholder="Seu CPF" inputMode="numeric" required aria-label="Seu CPF" />
              <button className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--cor)] px-4 py-3 font-semibold text-[var(--cor-texto)]">
                Assinar com cartão de crédito
              </button>
              <p className="text-center text-xs text-couro-400">Você cadastra o cartão uma vez e a mensalidade é cobrada automaticamente todo mês. Cancele quando quiser aqui no app.</p>
            </FormAcao>
          ) : (
            b.telefone && (
              <a href={linkWhatsApp(b.telefone, `Olá! Sou ${cliente.nome} e quero assinar o plano ${p.nome}.`)} target="_blank" className={botao}>
                Quero assinar
              </a>
            )
          )}
        </div>
      ))}
      {!plano && b.planos.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-sm text-couro-400">O salão ainda não tem planos de assinatura.</p>}
    </div>
  );
}
