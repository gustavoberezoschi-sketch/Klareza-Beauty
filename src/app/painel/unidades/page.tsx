import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Plus } from "lucide-react";
import { Cabecalho, Etiqueta } from "@/components/ui";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatarTelefone } from "@/lib/formato";
import { usoDoPlano } from "@/lib/planosSistema";
import { NOMES_DIAS } from "@/lib/tempo";

export const metadata: Metadata = { title: "Unidades" };
export const dynamic = "force-dynamic";

export default async function Unidades() {
  const { salaoId } = await exigirGestor();
  const filiais = await db.filial.findMany({
    where: { salaoId },
    include: { horarios: { orderBy: { diaSemana: "asc" } }, _count: { select: { profissionais: { where: { ativo: true } } } } },
    orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { criadoEm: "asc" }],
  });
  const uso = await usoDoPlano(salaoId);
  const noLimite = uso.plano.unidades !== null && uso.unidades >= uso.plano.unidades;

  return (
    <div>
      <Cabecalho
        titulo="Unidades"
        descricao="Cada unidade tem endereço, horário, equipe, agenda e caixa próprios. Clientes, serviços e planos valem em todas."
        acoes={
          noLimite ? (
            <Link href="/painel/plano" className="btn-secundario">Plano {uso.plano.nome}: {uso.plano.unidades} unidade(s) · mudar plano</Link>
          ) : (
            <Link href="/painel/unidades/nova" className="btn-destaque"><Plus className="size-4" /> Nova unidade</Link>
          )
        }
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filiais.map((f) => (
          <Link key={f.id} href={`/painel/unidades/${f.id}`} className={`card group transition hover:-translate-y-0.5 hover:shadow-md ${f.ativo ? "" : "opacity-50"}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="flex items-center gap-2 font-display text-lg font-bold group-hover:text-latao-700"><MapPin className="size-5 text-latao-600" /> {f.nome}</p>
              {!f.ativo && <Etiqueta>Inativa</Etiqueta>}
            </div>
            <p className="mt-1 text-sm text-couro-400">{f.endereco ?? "Sem endereço"}{f.telefone && ` · ${formatarTelefone(f.telefone)}`}</p>
            <p className="mt-3 text-sm">{f._count.profissionais} profissional(s)</p>
            <p className="mt-1 text-xs text-couro-400">
              {f.horarios.length === 0 ? "Sem horário definido" : f.horarios.map((h) => `${NOMES_DIAS[h.diaSemana].slice(0, 3)} ${h.abre}–${h.fecha}`).join(" · ")}
            </p>
          </Link>
        ))}
      </div>
      {filiais.length === 1 && (
        <p className="mt-6 max-w-xl text-sm text-couro-400">
          Com uma unidade só, nada muda para você nem para o cliente. Ao cadastrar a segunda, aparece um seletor de unidade no menu e o cliente escolhe a filial ao agendar.
        </p>
      )}
    </div>
  );
}
