import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function Cabecalho({
  titulo,
  descricao,
  acoes,
  voltar,
}: {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
  voltar?: { href: string; rotulo: string };
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {voltar && (
          <Link href={voltar.href} className="mb-1 inline-block text-sm font-medium text-couro-400 hover:text-tinta">
            ← {voltar.rotulo}
          </Link>
        )}
        <h1 className="titulo">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-couro-400">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  );
}

export function Indicador({
  rotulo,
  valor,
  detalhe,
  icone: Icone,
  destaque,
}: {
  rotulo: string;
  valor: React.ReactNode;
  detalhe?: React.ReactNode;
  icone?: LucideIcon;
  destaque?: boolean;
}) {
  return (
    <div className={`card relative overflow-hidden ${destaque ? "border-latao-500/30 bg-latao-50" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="rotulo">{rotulo}</p>
        {Icone && <Icone className={`size-4 ${destaque ? "text-latao-600" : "text-couro-300"}`} aria-hidden />}
      </div>
      <p className="numero mt-2 text-[26px] leading-none">{valor}</p>
      {detalhe && <p className="mt-1.5 text-xs text-couro-400">{detalhe}</p>}
    </div>
  );
}

const TONS = {
  neutro: "bg-black/[0.05] text-couro-700",
  azul: "bg-poste-azul/10 text-poste-azul",
  verde: "bg-emerald-600/10 text-emerald-700",
  vermelho: "bg-poste-vermelho/10 text-poste-vermelho",
  latao: "bg-latao-100 text-latao-700",
};

export function Etiqueta({ tom = "neutro", children }: { tom?: keyof typeof TONS; children: React.ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONS[tom]}`}>
      {children}
    </span>
  );
}

export function Vazio({
  icone: Icone,
  titulo,
  texto,
  acao,
}: {
  icone: LucideIcon;
  titulo: string;
  texto?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-black/10 px-6 py-10 text-center">
      <div className="mb-3 grid size-11 place-items-center rounded-full bg-latao-100 text-latao-700">
        <Icone className="size-5" aria-hidden />
      </div>
      <p className="font-semibold">{titulo}</p>
      {texto && <p className="mt-1 max-w-sm text-sm text-couro-400">{texto}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

export function Avatar({ nome, foto, tamanho = 36 }: { nome: string; foto?: string | null; tamanho?: number }) {
  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={foto} alt="" width={tamanho} height={tamanho} className="shrink-0 rounded-full object-cover" style={{ width: tamanho, height: tamanho }} />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-couro-800 font-semibold text-verde-claro"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.38 }}
      aria-hidden
    >
      {iniciais}
    </span>
  );
}

export function Secao({ titulo, acoes, children, className = "" }: { titulo: React.ReactNode; acoes?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold">{titulo}</h2>
        {acoes}
      </div>
      {children}
    </section>
  );
}
