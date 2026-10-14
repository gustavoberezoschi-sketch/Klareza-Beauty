import type { Metadata } from "next";
import Link from "next/link";
import { Crown, Plus, Search, Users } from "lucide-react";
import { Cabecalho, Etiqueta, Indicador, Vazio } from "@/components/ui";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatarDinheiro, formatarTelefone, somenteDigitos } from "@/lib/formato";
import { diaLocal, formatarDia, somarDias } from "@/lib/tempo";

export const metadata: Metadata = { title: "Clientes" };
export const dynamic = "force-dynamic";

const FILTROS = { todos: "Todos", sumidos: "Sumidos há 45+ dias", assinantes: "Assinantes", cashback: "Com cashback" } as const;

export default async function Clientes({ searchParams }: { searchParams: Promise<{ busca?: string; filtro?: string }> }) {
  const { salaoId } = await exigirGestor();
  const p = await searchParams;
  const busca = (p.busca ?? "").trim();
  const filtro = (p.filtro ?? "todos") as keyof typeof FILTROS;
  const digitos = somenteDigitos(busca);
  const hoje = diaLocal();

  const clientes = await db.cliente.findMany({
    where: {
      salaoId,
      ...(busca ? { OR: [{ nome: { contains: busca, mode: "insensitive" as const } }, ...(digitos ? [{ telefone: { contains: digitos } }] : [])] } : {}),
      ...(filtro === "cashback" ? { saldoCashbackCentavos: { gt: 0 } } : {}),
      ...(filtro === "assinantes" ? { assinaturas: { some: { status: "ATIVA" } } } : {}),
    },
    include: {
      comandas: { where: { status: "FECHADA" }, select: { totalCentavos: true, fechadaEm: true }, orderBy: { fechadaEm: "desc" } },
      assinaturas: { where: { status: "ATIVA" }, select: { id: true } },
    },
    orderBy: { nome: "asc" },
    take: 500,
  });
  const total = await db.cliente.count({ where: { salaoId } });
  const limiteSumido = somarDias(hoje, -45);
  const lista = filtro === "sumidos" ? clientes.filter((c) => c.comandas[0]?.fechadaEm && diaLocal(c.comandas[0].fechadaEm) < limiteSumido) : clientes;
  const novosMes = clientes.filter((c) => diaLocal(c.criadoEm).slice(0, 7) === hoje.slice(0, 7)).length;

  return (
    <div>
      <Cabecalho
        titulo="Clientes"
        descricao="Histórico, frequência e quanto cada cliente já gastou."
        acoes={<Link href="/painel/clientes/novo" className="btn-destaque"><Plus className="size-4" /> Novo cliente</Link>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Indicador rotulo="Clientes cadastrados" valor={total} icone={Users} />
        <Indicador rotulo="Novos este mês" valor={novosMes} />
        <Indicador rotulo="Assinantes ativos" valor={clientes.filter((c) => c.assinaturas.length).length} icone={Crown} destaque />
      </div>

      <form className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-couro-300" />
          <input name="busca" defaultValue={busca} className="input pl-9" placeholder="Buscar por nome ou telefone" />
        </div>
        <select name="filtro" defaultValue={filtro} className="input w-auto">
          {Object.entries(FILTROS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
        <button className="btn-secundario">Filtrar</button>
      </form>

      {lista.length === 0 ? (
        <Vazio icone={Users} titulo="Nenhum cliente encontrado" texto="Clientes que agendam pelo link entram aqui automaticamente." />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-fundo/60 text-left text-couro-400">
              <tr className="[&>th]:px-5 [&>th]:py-3 [&>th]:font-medium">
                <th>Cliente</th><th>WhatsApp</th><th>Visitas</th><th>Total gasto</th><th>Última visita</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="border-t border-black/[0.06] hover:bg-fundo/50 [&>td]:px-5 [&>td]:py-3">
                  <td>
                    <Link href={`/painel/clientes/${c.id}`} className="font-semibold hover:text-latao-700">{c.nome}</Link>
                    <span className="ml-2 inline-flex gap-1">
                      {c.assinaturas.length > 0 && <Etiqueta tom="latao">Assinante</Etiqueta>}
                      {c.saldoCashbackCentavos > 0 && <Etiqueta tom="verde">{formatarDinheiro(c.saldoCashbackCentavos)}</Etiqueta>}
                    </span>
                  </td>
                  <td className="tabular-nums">{formatarTelefone(c.telefone)}</td>
                  <td className="tabular-nums">{c.comandas.length}</td>
                  <td className="tabular-nums">{formatarDinheiro(c.comandas.reduce((s, x) => s + x.totalCentavos, 0))}</td>
                  <td className="tabular-nums">{c.comandas[0]?.fechadaEm ? formatarDia(diaLocal(c.comandas[0].fechadaEm)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
