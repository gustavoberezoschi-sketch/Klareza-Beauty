import Link from "next/link";
import { EMPRESA } from "@/lib/empresa";
import { fontesLanding } from "./fontes";
import { Logo } from "./Logo";
import "./landing.css";

/** Moldura das páginas legais (privacidade e termos). */
export function Documento({ titulo, resumo, children }: { titulo: string; resumo: string; children: React.ReactNode }) {
  return (
    <main className={`lp ${fontesLanding} min-h-screen`}>
      <header className="border-b border-[var(--lp-linha)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" aria-label="Klareza Beauty"><Logo /></Link>
          <nav className="flex gap-5 text-sm text-[var(--lp-cinza)]">
            <Link href="/privacidade" className="hover:text-[var(--lp-tinta)]">Privacidade</Link>
            <Link href="/termos" className="hover:text-[var(--lp-tinta)]">Termos</Link>
          </nav>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
        <p className="font-mono text-xs tracking-wide text-[var(--lp-cinza)] uppercase">Atualizado em {EMPRESA.atualizadoEm}</p>
        <h1 className="lp-titulo mt-4 text-5xl sm:text-6xl">{titulo}</h1>
        <p className="mt-6 text-lg text-[var(--lp-cinza)]">{resumo}</p>
        <div className="doc mt-12 space-y-10 text-[16px] leading-relaxed text-[#2a2a28] [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-[var(--lp-tinta)] [&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:font-semibold [&_li]:mt-1.5 [&_p+p]:mt-3 [&_section]:scroll-mt-8 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </article>
      <footer className="border-t border-[var(--lp-linha)]">
        <div className="mx-auto flex max-w-3xl flex-wrap justify-between gap-4 px-5 py-8 text-sm text-[var(--lp-cinza)]">
          <p>© {new Date().getFullYear()} {EMPRESA.proprietaria} · {EMPRESA.marca} é uma marca da {EMPRESA.proprietaria}</p>
          <Link href="/" className="hover:text-[var(--lp-tinta)]">Voltar ao site</Link>
        </div>
      </footer>
    </main>
  );
}

/** Como falar com a gente: e-mail, se cadastrado, ou o WhatsApp de suporte. */
export function Contato({ whatsapp }: { whatsapp: string | null }) {
  const fone = EMPRESA.telefone ?? whatsapp;
  const zap = fone && (
    <a href={`https://wa.me/55${fone}`} target="_blank" rel="noopener">
      WhatsApp ({fone.slice(0, 2)}) {fone.slice(2, -4)}-{fone.slice(-4)}
    </a>
  );
  if (EMPRESA.email && zap) return <>e-mail (<a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a>) ou {zap}</>;
  if (EMPRESA.email) return <>e-mail (<a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a>)</>;
  if (zap) return zap;
  return <>nossos canais de atendimento</>;
}
