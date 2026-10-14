import type { Metadata } from "next";
import Link from "next/link";
import { Plus, ReceiptText } from "lucide-react";
import { Cabecalho, Etiqueta, Secao, Vazio } from "@/components/ui";
import { exigirSessao } from "@/lib/auth";
import { subtotalDosItens } from "@/lib/comandas";
import { db } from "@/lib/db";
import { filialDoPainel, naFilial } from "@/lib/filial";
import { NOME_FORMA, formatarDinheiro } from "@/lib/formato";
import { diaLocal, diaValido, formatarDia, horaLocal, inicioEFimDoDia } from "@/lib/tempo";

export const metadata: Metadata = { title: "Comandas" };
export const dynamic = "force-dynamic";

export default async function Comandas({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const sessao = await exigirSessao();
  const p = await searchParams;
  const dia = p.dia && diaValido(p.dia) ? p.dia : diaLocal();
  const { inicio, fim } = inicioEFimDoDia(dia);
  const meu = { ...(sessao.profissionalId ? { profissionalId: sessao.profissionalId } : {}), ...naFilial(await filialDoPainel(sessao)) };

  const [abertas, fechadas] = await Promise.all([
    db.comanda.findMany({
      where: { salaoId: sessao.salaoId, status: "ABERTA", ...meu },
      include: { cliente: true, profissional: true, itens: true },
      orderBy: { abertaEm: "asc" },
    }),
    db.comanda.findMany({
      where: { salaoId: sessao.salaoId, status: { in: ["FECHADA", "CANCELADA"] }, fechadaEm: { gte: inicio, lt: fim }, ...meu },
      include: { cliente: true, profissional: true },
      orderBy: { fechadaEm: "desc" },
    }),
  ]);
  const total = fechadas.filter((c) => c.status === "FECHADA").reduce((s, c) => s + c.totalCentavos, 0);

  return (
    <div>
      <Cabecalho
        titulo="Comandas"
        descricao="Tudo o que o cliente consumiu: serviços, produtos, desconto e pagamento."
        acoes={
          <Link href="/painel/comandas/nova" className="btn-destaque">
            <Plus className="size-4" /> Nova comanda
          </Link>
        }
      />

      <h2 className="rotulo mb-3">Abertas agora</h2>
      {abertas.length === 0 ? (
        <Vazio
          icone={ReceiptText}
          titulo="Nenhuma comanda aberta"
          texto='Ao iniciar um atendimento pela agenda, a comanda abre sozinha. Para vender só um produto, use "Nova comanda".'
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {abertas.map((c) => (
            <Link key={c.id} href={`/painel/comandas/${c.id}`} className="card block transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <span className="rotulo">#{c.numero} · desde {horaLocal(c.abertaEm)}</span>
                <Etiqueta tom="latao">Aberta</Etiqueta>
              </div>
              <p className="mt-2 truncate font-semibold">{c.cliente?.nome ?? "Cliente avulso"}</p>
              <p className="truncate text-sm text-couro-400">
                {c.itens.length} item(ns){c.profissional && ` · ${c.profissional.nome}`}
              </p>
              <p className="numero mt-3 text-xl">{formatarDinheiro(subtotalDosItens(c.itens))}</p>
            </Link>
          ))}
        </div>
      )}

      <Secao
        className="mt-6"
        titulo={`Fechadas em ${formatarDia(dia)} · ${formatarDinheiro(total)}`}
        acoes={
          <form className="flex gap-1">
            <input key={dia} type="date" name="dia" defaultValue={dia} className="input w-auto py-1.5" aria-label="Data" />
            <button className="btn-secundario btn-pequeno">Ver</button>
          </form>
        }
      >
        {fechadas.length === 0 ? (
          <p className="text-sm text-couro-400">Nenhuma comanda fechada neste dia.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-couro-400">
                <tr className="[&>th]:px-5 [&>th]:pb-2 [&>th]:font-medium">
                  <th>Nº</th><th>Hora</th><th>Cliente</th><th>Profissional</th><th>Pagamento</th><th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {fechadas.map((c) => (
                  <tr key={c.id} className={`border-t border-black/[0.06] [&>td]:px-5 [&>td]:py-2.5 ${c.status === "CANCELADA" ? "text-couro-300 line-through" : ""}`}>
                    <td><Link href={`/painel/comandas/${c.id}`} className="font-semibold text-latao-700 hover:underline">#{c.numero}</Link></td>
                    <td className="tabular-nums">{c.fechadaEm ? horaLocal(c.fechadaEm) : "—"}</td>
                    <td>{c.cliente?.nome ?? "Avulso"}</td>
                    <td>{c.profissional?.nome ?? "—"}</td>
                    <td>{c.status === "CANCELADA" ? "Cancelada" : NOME_FORMA[c.formaPagamento ?? ""] ?? "—"}</td>
                    <td className="text-right font-semibold tabular-nums">{formatarDinheiro(c.totalCentavos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>
    </div>
  );
}
