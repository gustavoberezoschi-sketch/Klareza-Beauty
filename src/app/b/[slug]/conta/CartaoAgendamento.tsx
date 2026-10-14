import Link from "next/link";
import { Clock, MapPin, Scissors, UserRound } from "lucide-react";
import { formatarDinheiro } from "@/lib/formato";
import { diaLocal, formatarDiaExtenso, horaLocal } from "@/lib/tempo";

export type Atendimento = {
  token: string;
  inicio: Date;
  servicos: string[];
  profissional: string;
  unidade?: string | null;
  total: number;
  status: string;
};

const STATUS: Record<string, { r: string; c: string }> = {
  AGENDADO: { r: "Agendado", c: "text-[var(--cor)]" },
  CONFIRMADO: { r: "Confirmado", c: "text-poste-azul" },
  CONCLUIDO: { r: "Concluído", c: "text-emerald-700" },
  CANCELADO: { r: "Cancelado", c: "text-couro-400" },
  FALTOU: { r: "Não compareceu", c: "text-poste-vermelho" },
};

export function CartaoAgendamento({ a, slug }: { a: Atendimento; slug: string }) {
  const st = STATUS[a.status] ?? STATUS.AGENDADO;
  const futuro = a.status === "AGENDADO" || a.status === "CONFIRMADO";
  return (
    <Link href={`/b/${slug}/agendamento/${a.token}`} className="block rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className={`flex items-center gap-1.5 font-semibold ${futuro ? "text-tinta" : "text-couro-700"}`}>
          <Clock className="size-4 text-[var(--cor)]" />
          <span className="first-letter:uppercase">{formatarDiaExtenso(diaLocal(a.inicio))}, {horaLocal(a.inicio)}</span>
        </p>
        <span className={`text-xs font-semibold ${st.c}`}>{st.r}</span>
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm"><Scissors className="size-4 text-[var(--cor)]" /> {a.servicos.join(" + ")}</p>
      <p className="mt-1.5 flex items-center gap-2 text-sm"><UserRound className="size-4 text-[var(--cor)]" /> {a.profissional}</p>
      {a.unidade && <p className="mt-1.5 flex items-center gap-2 text-sm"><MapPin className="size-4 text-[var(--cor)]" /> {a.unidade}</p>}
      <p className="mt-3 text-sm font-semibold">Total: {formatarDinheiro(a.total)}</p>
    </Link>
  );
}
