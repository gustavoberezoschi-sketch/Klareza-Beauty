import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Crown, Gift, Plus } from "lucide-react";
import { Carrossel } from "@/components/Carrossel";
import { atendimentosDoCliente } from "@/lib/atendimentosCliente";
import { exigirCliente } from "@/lib/clienteAuth";
import { db } from "@/lib/db";
import { formatarDinheiro } from "@/lib/formato";
import { planoDoCliente } from "@/lib/publico";
import { CartaoAgendamento } from "./CartaoAgendamento";
import { InstalarApp, LembretesNoCelular } from "@/components/AppDoSalao";
import { chavesVapid } from "@/lib/push";
import { removerInscricaoPush, salvarInscricaoPush } from "./actions";

export const metadata: Metadata = { title: "Minha conta" };

export default async function InicioCliente({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cliente = await exigirCliente(slug);
  const [b, plano, proximos] = await Promise.all([
    db.salao.findUniqueOrThrow({
      where: { slug },
      select: { nome: true, banners: { orderBy: { ordem: "asc" } }, _count: { select: { parceiros: { where: { ativo: true } }, planos: { where: { ativo: true, exibirOnline: true } } } } },
    }),
    planoDoCliente(cliente.id),
    atendimentosDoCliente(cliente.id, "futuros", 3),
  ]);
  const { publica } = await chavesVapid();

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Olá, {cliente.nome.split(" ")[0]}</h1>
      <InstalarApp slug={slug} nome={b.nome} />
      <Carrossel banners={b.banners} />

      {plano ? (
        <Link href={`/b/${slug}/conta/plano`} className="block rounded-2xl bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 font-semibold"><Crown className="size-5 text-[var(--cor)]" /> Seu plano</p>
          <p className="mt-1 text-sm text-couro-700">Você está aproveitando as vantagens do {plano.nome}.</p>
          <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--cor)]">Detalhes sobre o plano <ArrowRight className="size-4" /></p>
        </Link>
      ) : b._count.planos > 0 ? (
        <Link href={`/b/${slug}/conta/plano`} className="block rounded-2xl bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 font-semibold"><Crown className="size-5 text-[var(--cor)]" /> Clube de assinatura</p>
          <p className="mt-1 text-sm text-couro-700">Pague um valor fixo por mês e corte quando quiser.</p>
          <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--cor)]">Conhecer os planos <ArrowRight className="size-4" /></p>
        </Link>
      ) : null}

      {b._count.parceiros > 0 && (
        <Link href={`/b/${slug}/conta/vantagens`} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--cor)] p-5 text-[var(--cor-texto)] shadow-sm" style={{ backgroundImage: "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.25))" }}>
          <span>
            <span className="flex items-center gap-2 font-bold"><Gift className="size-5" /> Conheça o Clube de vantagens do {b.nome}</span>
            <span className="text-sm opacity-90">e pegue seus cupons de desconto com os parceiros</span>
          </span>
          <ArrowRight className="size-5 shrink-0" />
        </Link>
      )}

      {cliente.saldoCashbackCentavos > 0 && (
        <p className="rounded-2xl bg-emerald-600/10 px-5 py-3 text-sm text-emerald-800">
          Você tem <strong>{formatarDinheiro(cliente.saldoCashbackCentavos)}</strong> de cashback para usar no próximo atendimento.
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        <h2 className="text-sm text-couro-700">Próximos agendamentos</h2>
        <Link href={`/b/${slug}/conta/agendamentos`} className="text-sm font-semibold">Ver tudo</Link>
      </div>
      {proximos.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-center text-sm text-couro-400 shadow-sm">Nenhum horário marcado.</p>
      ) : (
        proximos.map((a) => <CartaoAgendamento key={a.token} a={a} slug={slug} />)
      )}
      <Link href={`/b/${slug}/agendar`} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--cor)] py-3.5 font-bold text-[var(--cor-texto)] shadow-sm">
        <Plus className="size-5" /> Novo agendamento
      </Link>
      <LembretesNoCelular chavePublica={publica} salvar={salvarInscricaoPush.bind(null, slug)} remover={removerInscricaoPush.bind(null, slug)} />
    </div>
  );
}
