import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PERGUNTAS_SIM_NAO, PERGUNTAS_TEXTO, textoDoTermo } from "@/lib/anamnese";
import { db } from "@/lib/db";
import { estiloDaMarca } from "@/lib/publico";
import { Ficha } from "./Ficha";

export const metadata: Metadata = { title: "Ficha de atendimento", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PaginaFicha({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const ag = await db.agendamento.findFirst({
    where: { token, salao: { slug } },
    select: { status: true, salao: { select: { nome: true, corDestaque: true, termoConsentimento: true } }, cliente: { select: { nome: true } } },
  });
  if (!ag) notFound();
  const aberto = ["AGUARDANDO_SINAL", "AGENDADO", "CONFIRMADO"].includes(ag.status);

  return (
    <main className="mx-auto min-h-screen max-w-md p-4" style={estiloDaMarca(ag.salao.corDestaque)}>
      <div className="mb-4 flex items-center gap-2">
        <Link href={`/b/${slug}/agendamento/${token}`} className="rounded-lg p-1.5 hover:bg-white" aria-label="Voltar"><ArrowLeft className="size-5" /></Link>
        <p className="font-display font-bold">{ag.salao.nome}</p>
      </div>
      <h1 className="font-display text-2xl font-bold">Ficha de atendimento</h1>
      <p className="mt-1 mb-4 text-sm text-couro-700">
        Responda antes de vir. Assim a profissional já sabe das suas alergias e cuidados, e o atendimento começa na hora. Por segurança, as respostas anteriores não aparecem aqui.
      </p>
      {aberto ? (
        <Ficha slug={slug} token={token} simNao={PERGUNTAS_SIM_NAO} textos={PERGUNTAS_TEXTO} termo={textoDoTermo(ag.salao)} nomeInicial={ag.cliente.nome} />
      ) : (
        <p className="rounded-3xl bg-white p-6 text-center text-couro-700">Este agendamento já passou ou foi cancelado.</p>
      )}
    </main>
  );
}
