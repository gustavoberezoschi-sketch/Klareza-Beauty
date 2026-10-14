import Link from "next/link";
import { Marca } from "@/components/Marca";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Salões" };

export default async function Saloes() {
  const saloes = await db.salao.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true, slug: true, endereco: true, logo: true } });

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 p-6">
      <div>
        <div className="mb-8"><Marca tamanho="lg" /></div>
        <h1 className="titulo">Agende seu horário</h1>
        <p className="mt-1 text-couro-400">Escolha o salão.</p>
      </div>
      {saloes.length > 0 && (
        <ul className="space-y-2">
          {saloes.map((b) => (
            <li key={b.id}>
              <Link href={`/b/${b.slug}`} className="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                {b.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.logo} alt="" className="size-12 rounded-xl object-cover" />
                ) : (
                  <span className="grid size-12 place-items-center rounded-xl bg-latao-100 font-display text-xl font-bold text-latao-700">{b.nome[0]}</span>
                )}
                <span>
                  <span className="block font-semibold">{b.nome}</span>
                  {b.endereco && <span className="text-sm text-couro-400">{b.endereco}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/" className="text-center text-sm font-semibold text-couro-400 hover:text-tinta">Conheça o Klareza Beauty</Link>
    </main>
  );
}
