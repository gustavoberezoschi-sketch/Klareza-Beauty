import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { atendimentosDoCliente } from "@/lib/atendimentosCliente";
import { exigirCliente } from "@/lib/clienteAuth";
import { CartaoAgendamento } from "../CartaoAgendamento";

export const metadata: Metadata = { title: "Meus agendamentos" };

export default async function Agendamentos({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ aba?: string }> }) {
  const { slug } = await params;
  const cliente = await exigirCliente(slug);
  const aba = (await searchParams).aba === "anteriores" ? "anteriores" : "futuros";
  const lista = await atendimentosDoCliente(cliente.id, aba);
  const base = `/b/${slug}/conta/agendamentos`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 border-b border-black/[0.08]" role="tablist">
        {[
          { id: "futuros", r: "Agendados", href: base },
          { id: "anteriores", r: "Anteriores", href: `${base}?aba=anteriores` },
        ].map((t) => (
          <Link key={t.id} href={t.href} role="tab" aria-selected={aba === t.id} className={`-mb-px border-b-2 py-3 text-center font-semibold ${aba === t.id ? "border-[var(--cor)] text-tinta" : "border-transparent text-couro-400"}`}>
            {t.r}
          </Link>
        ))}
      </div>
      <Link href={`/b/${slug}/agendar`} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--cor)] py-3.5 font-bold text-[var(--cor-texto)] shadow-sm">
        <Plus className="size-5" /> Novo agendamento
      </Link>
      {lista.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-couro-400 shadow-sm">
          {aba === "futuros" ? "Você não tem horários marcados." : "Nenhum atendimento anterior por aqui."}
        </p>
      ) : (
        lista.map((a) => <CartaoAgendamento key={a.token} a={a} slug={slug} />)
      )}
    </div>
  );
}
