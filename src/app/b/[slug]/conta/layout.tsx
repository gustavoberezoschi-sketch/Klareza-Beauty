import { notFound } from "next/navigation";
import { MenuCliente } from "@/components/MenuCliente";
import { checkinAutomatico } from "@/lib/agenda";
import { exigirCliente } from "@/lib/clienteAuth";
import { db } from "@/lib/db";
import { estiloDaMarca } from "@/lib/publico";
import { sair } from "./actions";

export const dynamic = "force-dynamic";

export default async function LayoutConta({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await exigirCliente(slug);
  const b = await db.salao.findUnique({ where: { slug }, select: { id: true, nome: true, logo: true, corDestaque: true, _count: { select: { parceiros: { where: { ativo: true } } } } } });
  if (!b) notFound();
  await checkinAutomatico(b.id);
  return (
    <div className="min-h-screen bg-[#f6f5f3]" style={estiloDaMarca(b.corDestaque)}>
      <MenuCliente slug={slug} nome={b.nome} logo={b.logo} temVantagens={b._count.parceiros > 0} sair={sair.bind(null, slug)} />
      <main className="px-4 pt-6 pb-28 lg:ml-64 lg:px-10 lg:pt-10">
        <div className="mx-auto max-w-2xl">{children}</div>
      </main>
    </div>
  );
}
