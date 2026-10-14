import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, Crown, MessageCircle, ReceiptText, Store, Users } from "lucide-react";
import { Marca } from "@/components/Marca";
import { TabelaPlanos } from "@/components/TabelaPlanos";
import { db } from "@/lib/db";
import { linkWhatsApp } from "@/lib/formato";
import { PLANOS_SISTEMA } from "@/lib/planosSistema";

export const metadata: Metadata = {
  title: { absolute: "Planos · Klareza Beauty" },
  description: "Agenda online, comandas, caixa, clube de assinatura e lembretes por WhatsApp para seu salão.",
};
export const dynamic = "force-dynamic";

const RECURSOS = [
  { icone: CalendarCheck, t: "Agendamento online", d: "O cliente agenda sozinho pelo celular, escolhendo unidade, profissional, serviços e horário." },
  { icone: Users, t: "Área do cliente", d: "Login do cliente com seus agendamentos, plano, cupons de parceiros e cashback." },
  { icone: Crown, t: "Clube de assinatura", d: "Planos mensais com serviços inclusos e controle de mensalidades." },
  { icone: ReceiptText, t: "Comandas, caixa e estoque", d: "Venda de serviços e produtos, fechamento de caixa e estoque por unidade." },
  { icone: MessageCircle, t: "Lembretes por WhatsApp", d: "Um botão e a mensagem pronta: menos faltas, sem custo extra." },
  { icone: Store, t: "Várias unidades", d: "Cada unidade com sua equipe, agenda e caixa, tudo num só painel." },
];

export default async function Planos() {
  const suporte = (await db.configSistema.findUnique({ where: { id: "geral" } }))?.whatsappSuporte;
  return (
    <main className="min-h-screen">
      <header className="bg-couro-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <Marca tamanho="md" clara />
          <Link href="/login" className="text-sm font-semibold text-couro-300 hover:text-white">Entrar</Link>
        </div>
        <div className="mx-auto max-w-6xl px-4 pt-10 pb-16">
          <h1 className="max-w-3xl font-display text-4xl leading-tight font-bold sm:text-5xl">
            A agenda, o caixa e os clientes do seu salão num lugar só.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-couro-300">Agendamento online, clube de assinatura, comandas, comissões e lembretes por WhatsApp.</p>
        </div>
      </header>

      <section className="mx-auto -mt-8 max-w-6xl px-4">
        <TabelaPlanos
          acao={(c) =>
            suporte ? (
              <a href={linkWhatsApp(suporte, `Olá! Tenho interesse no plano ${PLANOS_SISTEMA[c].nome} do Klareza Beauty.`)} target="_blank" className="btn-destaque w-full py-3">
                Quero o plano {PLANOS_SISTEMA[c].nome}
              </a>
            ) : null
          }
        />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-2xl font-bold">Tudo incluso em todos os planos</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map(({ icone: Icone, t, d }) => (
            <div key={t} className="card">
              <Icone className="size-6 text-latao-600" />
              <p className="mt-3 font-semibold">{t}</p>
              <p className="mt-1 text-sm text-couro-700">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
