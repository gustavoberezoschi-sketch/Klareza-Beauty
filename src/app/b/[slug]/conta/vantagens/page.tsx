import type { Metadata } from "next";
import { ExternalLink, Gift } from "lucide-react";
import { exigirCliente } from "@/lib/clienteAuth";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { temRecurso } from "@/lib/planosSistema";
import { CopiarCupom } from "./CopiarCupom";

export const metadata: Metadata = { title: "Clube de vantagens" };

export default async function Vantagens({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await exigirCliente(slug);
  const salao = await db.salao.findUnique({ where: { slug }, select: { plano: true } });
  if (!salao || !temRecurso(salao.plano, "clube")) notFound();
  const parceiros = await db.parceiro.findMany({ where: { salao: { slug }, ativo: true }, orderBy: { nome: "asc" } });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Clube de vantagens</h1>
        <p className="mt-1 text-sm text-couro-700">Descontos exclusivos com os parceiros do salão. Mostre o cupom na hora da compra.</p>
      </div>
      {parceiros.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-sm text-couro-400">Nenhum parceiro no momento.</p>}
      {parceiros.map((p) => (
        <div key={p.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {p.imagem && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imagem} alt="" className="aspect-[2.6/1] w-full object-cover" />
          )}
          <div className="p-5">
            <p className="flex items-center gap-2 font-display text-lg font-bold">{!p.imagem && <Gift className="size-5 text-[var(--cor)]" />} {p.nome}</p>
            {p.descricao && <p className="mt-1 text-sm text-couro-700">{p.descricao}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {p.cupom && <CopiarCupom cupom={p.cupom} />}
              {p.link && (
                <a href={p.link} target="_blank" rel="noopener" className="btn-secundario btn-pequeno"><ExternalLink className="size-3.5" /> Ver parceiro</a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
