/** Logo do Klareza Beauty na landing e nas páginas legais. */
export function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`grid size-7 place-items-center rounded-lg text-sm font-bold ${claro ? "bg-white text-[var(--lp-tinta)]" : "bg-[var(--lp-tinta)] text-white"}`}>K</span>
      <span className="text-[17px] font-semibold tracking-tight">
        Klareza<span className={claro ? "text-white/60" : "text-[var(--lp-verde)]"}>Beauty</span>
      </span>
    </span>
  );
}
