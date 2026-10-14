"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Crown, Gift, House, LogOut, UserRound } from "lucide-react";

export function MenuCliente({ slug, nome, logo, temVantagens, sair }: { slug: string; nome: string; logo: string | null; temVantagens: boolean; sair: () => Promise<void> }) {
  const caminho = usePathname();
  const base = `/b/${slug}/conta`;
  const itens = [
    { href: base, rotulo: "Início", icone: House },
    { href: `${base}/agendamentos`, rotulo: "Agendamentos", icone: CalendarDays },
    ...(temVantagens ? [{ href: `${base}/vantagens`, rotulo: "Vantagens", icone: Gift }] : []),
    { href: `${base}/plano`, rotulo: "Plano", icone: Crown },
    { href: `${base}/perfil`, rotulo: "Perfil", icone: UserRound },
  ];
  const ativo = (href: string) => (href === base ? caminho === base : caminho.startsWith(href));

  return (
    <>
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-black/[0.05] bg-white p-5 lg:flex">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={nome} className="aspect-square w-full rounded-2xl object-cover" />
        ) : (
          <div className="grid aspect-square w-full place-items-center rounded-2xl bg-[var(--cor)] p-4 text-center font-display text-2xl font-bold text-[var(--cor-texto)]">{nome}</div>
        )}
        <nav className="mt-8 flex-1 space-y-1" aria-label="Menu">
          {itens.map(({ href, rotulo, icone: Icone }) => (
            <Link key={href} href={href} aria-current={ativo(href) ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 font-semibold transition ${ativo(href) ? "bg-[var(--cor)]/10 text-tinta" : "text-couro-700 hover:bg-fundo"}`}>
              <Icone className={`size-5 ${ativo(href) ? "text-[var(--cor)]" : "text-couro-400"}`} />
              {rotulo === "Vantagens" ? "Clube de vantagens" : rotulo}
            </Link>
          ))}
        </nav>
        <form action={sair}>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 font-semibold text-couro-700 hover:bg-fundo">
            <LogOut className="size-5 text-couro-400" /> Sair
          </button>
        </form>
      </aside>

      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-black/[0.05] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="size-9 rounded-xl object-cover" />
        ) : (
          <span className="grid size-9 place-items-center rounded-xl bg-[var(--cor)] font-display font-bold text-[var(--cor-texto)]">{nome[0]}</span>
        )}
        <p className="flex-1 truncate font-display font-bold">{nome}</p>
        <form action={sair}>
          <button className="rounded-lg p-2 text-couro-400 hover:bg-fundo" aria-label="Sair"><LogOut className="size-5" /></button>
        </form>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-black/[0.06] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Menu">
        {itens.map(({ href, rotulo, icone: Icone }) => (
          <Link key={href} href={href} aria-current={ativo(href) ? "page" : undefined} className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${ativo(href) ? "text-tinta" : "text-couro-400"}`}>
            <Icone className={`size-5 ${ativo(href) ? "text-[var(--cor)]" : ""}`} />
            {rotulo}
          </Link>
        ))}
      </nav>
    </>
  );
}
