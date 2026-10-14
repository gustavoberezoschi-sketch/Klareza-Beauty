import { Simbolo } from "@/app/marca/Simbolo";

/** Marca do sistema: Klareza Beauty. */
export function Marca({ tamanho = "md", clara = false }: { tamanho?: "sm" | "md" | "lg"; clara?: boolean }) {
  const texto = { sm: "text-sm", md: "text-xl", lg: "text-3xl" }[tamanho];
  const icone = { sm: 24, md: 36, lg: 48 }[tamanho];
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="shrink-0" aria-hidden>
        <Simbolo tamanho={icone} id={`marca-${tamanho}${clara ? "-c" : ""}`} />
      </span>
      <span className={`font-display font-bold tracking-tight ${texto} ${clara ? "text-white" : "text-tinta"}`}>
        Klareza<span className={clara ? "text-verde-claro" : "text-latao-500"}>Beauty</span>
      </span>
    </span>
  );
}
