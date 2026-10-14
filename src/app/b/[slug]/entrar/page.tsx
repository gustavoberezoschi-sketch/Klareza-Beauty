import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { clienteLogado } from "@/lib/clienteAuth";
import { db } from "@/lib/db";
import { corDoTexto } from "@/lib/formato";
import { estiloDaMarca } from "@/lib/publico";
import { Acesso } from "./Acesso";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function Entrar({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ aba?: string }> }) {
  const { slug } = await params;
  if (await clienteLogado(slug)) redirect(`/b/${slug}/conta`);
  const b = await db.salao.findUnique({ where: { slug }, select: { nome: true, logo: true, corDestaque: true } });
  if (!b) notFound();

  return (
    <main className="flex min-h-screen flex-col bg-[#f6f5f3]" style={estiloDaMarca(b.corDestaque)}>
      <div className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <Link href={`/b/${slug}`} className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-couro-700">
          <ArrowLeft className="size-4" /> {b.nome}
        </Link>
        <div className="mb-6 flex flex-col items-center text-center">
          {b.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.logo} alt="" className="size-20 rounded-2xl object-cover shadow-md" />
          ) : (
            <span className="grid size-20 place-items-center rounded-2xl font-display text-3xl font-bold shadow-md" style={{ background: b.corDestaque, color: corDoTexto(b.corDestaque) }}>{b.nome[0]}</span>
          )}
          <h1 className="mt-4 font-display text-2xl font-bold">Sua conta no {b.nome}</h1>
          <p className="mt-1 text-sm text-couro-400">Acompanhe seus agendamentos, seu plano e as vantagens do clube.</p>
        </div>
        <Acesso slug={slug} abaInicial={(await searchParams).aba === "criar" ? "criar" : "entrar"} />
      </div>
    </main>
  );
}
