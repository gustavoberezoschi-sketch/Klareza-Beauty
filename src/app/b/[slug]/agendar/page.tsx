import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatarQuando, horarioEmAberto } from "@/lib/agenda";
import { clienteLogado } from "@/lib/clienteAuth";
import { dadosDoAgendamento, estiloDaMarca, planoDoCliente } from "@/lib/publico";
import { sinalAtivo } from "@/lib/sinal";
import { Agendar } from "./Agendar";

export const metadata: Metadata = { title: "Agendar horário" };
export const dynamic = "force-dynamic";

export default async function PaginaAgendar({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ indicacao?: string }> }) {
  const { slug } = await params;
  const { indicacao } = await searchParams;
  const dados = await dadosDoAgendamento(slug);
  if (!dados) notFound();
  const { salao: b } = dados;
  const cliente = await clienteLogado(slug);
  const plano = cliente ? await planoDoCliente(cliente.id) : null;
  const indisponivel = dados.servicos.length === 0 || dados.filiais.length === 0;
  // um horário por vez: quem já tem um marcado vê esse horário em vez de marcar outro
  const aberto = cliente ? await horarioEmAberto(cliente.id) : null;

  return (
    <main className="min-h-screen bg-[#f6f5f3]" style={estiloDaMarca(b.corDestaque)}>
      <header className="sticky top-0 z-10 border-b border-black/[0.05] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href={cliente ? `/b/${slug}/conta` : `/b/${slug}`} className="rounded-lg p-1.5 hover:bg-fundo" aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </Link>
          <p className="flex-1 truncate font-display font-bold">{b.nome}</p>
          {cliente ? (
            <span className="text-sm text-couro-400">Olá, {cliente.nome.split(" ")[0]}</span>
          ) : (
            <Link href={`/b/${slug}/entrar`} className="text-sm font-semibold underline">Entrar</Link>
          )}
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-1 font-display text-2xl font-bold">Novo agendamento</h1>
        {indisponivel ? (
          <p className="mt-4 rounded-2xl bg-white p-6 text-center text-couro-700">O agendamento online ainda não está disponível. Fale com o salão pelo WhatsApp.</p>
        ) : (
          <Agendar
            slug={slug}
            nomeSalao={b.nome}
            telefoneSalao={b.telefone}
            servicos={dados.servicos}
            profissionais={dados.profissionais}
            filiais={dados.filiais}
            cliente={cliente ? { nome: cliente.nome } : null}
            plano={plano ? { nome: plano.nome, servicoIds: plano.servicoIds, restantes: plano.restantes } : null}
            sinalPct={sinalAtivo(b) ? b.sinalPct : 0}
            creditoIndicacao={b.indicacaoCreditoCentavos}
            indicacaoInicial={(indicacao ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20)}
            horarioAberto={
              aberto
                ? { token: aberto.token, quando: formatarQuando(aberto.inicio), descricao: `${aberto.servico.nome} com ${aberto.profissional.nome.split(" ")[0]}` }
                : null
            }
          />
        )}
      </div>
    </main>
  );
}
