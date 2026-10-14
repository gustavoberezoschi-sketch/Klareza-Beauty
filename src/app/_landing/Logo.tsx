import { Simbolo } from "../marca/Simbolo";

/** Logo do Klareza Beauty na landing e nas páginas legais. */
export function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="shrink-0" aria-hidden><Simbolo tamanho={28} id={claro ? "logo-c" : "logo"} /></span>
      <span className="text-[17px] font-semibold tracking-tight">
        Klareza<span className={claro ? "text-white/60" : "text-[var(--lp-verde)]"}>Beauty</span>
      </span>
    </span>
  );
}
