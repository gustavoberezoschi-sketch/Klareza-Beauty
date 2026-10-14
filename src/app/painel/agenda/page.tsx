import type { Metadata } from "next";
import Link from "next/link";
import { CalendarOff, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Avatar, Cabecalho, Vazio } from "@/components/ui";
import { exigirSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { filialDoPainel, naFilial } from "@/lib/filial";
import { formatarDinheiro } from "@/lib/formato";
import {
  diaDaSemana,
  diaLocal,
  diaValido,
  formatarDiaExtenso,
  horaLocal,
  horaParaMinutos,
  inicioEFimDoDia,
  minutosParaHora,
  somarDias,
} from "@/lib/tempo";

export const metadata: Metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

const PX_POR_MIN = 1.7;

const ESTILO_STATUS: Record<string, string> = {
  AGENDADO: "border-l-latao-500 bg-white",
  CONFIRMADO: "border-l-poste-azul bg-[#eef3f8]",
  CONCLUIDO: "border-l-emerald-600 bg-emerald-50",
  FALTOU: "border-l-poste-vermelho bg-poste-vermelho/[0.06] opacity-70",
};
const ROTULO_STATUS: Record<string, string> = {
  AGENDADO: "Agendado",
  CONFIRMADO: "Confirmado",
  CONCLUIDO: "Concluído",
  FALTOU: "Faltou",
};

export default async function Agenda({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const sessao = await exigirSessao();
  const { salaoId } = sessao;
  const parametro = (await searchParams).dia;
  const hoje = diaLocal();
  const dia = parametro && diaValido(parametro) ? parametro : hoje;
  const { inicio, fim } = inicioEFimDoDia(dia);
  const soMeu = sessao.papel === "PROFISSIONAL" && sessao.profissionalId ? { id: sessao.profissionalId } : {};
  const ctx = await filialDoPainel(sessao);
  const varias = ctx.filiais.filter((f) => f.ativo).length > 1;

  const [horariosDoDia, profissionais, agendamentos, bloqueios] = await Promise.all([
    db.horarioFuncionamento.findMany({
      where: { diaSemana: diaDaSemana(dia), filial: { salaoId, ativo: true, ...(ctx.atual ? { id: ctx.atual.id } : {}) } },
    }),
    db.profissional.findMany({
      where: { salaoId, ativo: true, ...naFilial(ctx), ...soMeu },
      include: { filial: { select: { nome: true } } },
      orderBy: [{ filial: { ordem: "asc" } }, { nome: "asc" }],
    }),
    db.agendamento.findMany({
      where: { salaoId, ...naFilial(ctx), inicio: { gte: inicio, lt: fim }, status: { not: "CANCELADO" } },
      include: { cliente: true, servico: true },
      orderBy: { inicio: "asc" },
    }),
    db.bloqueio.findMany({ where: { salaoId, inicio: { lt: fim }, fim: { gt: inicio } } }),
  ]);
  // Com "todas as unidades", a grade vai da abertura mais cedo ao fechamento mais tarde.
  const funcionamento = horariosDoDia.length
    ? { abre: horariosDoDia.map((h) => h.abre).sort()[0], fecha: horariosDoDia.map((h) => h.fecha).sort().at(-1)! }
    : null;

  // Faixa de horário exibida: expediente do dia (ou 08h–20h se fechado), ampliada para caber tudo.
  let abre = funcionamento ? horaParaMinutos(funcionamento.abre) : 8 * 60;
  let fecha = funcionamento ? horaParaMinutos(funcionamento.fecha) : 20 * 60;
  for (const a of agendamentos) {
    abre = Math.min(abre, horaParaMinutos(horaLocal(a.inicio)));
    fecha = Math.max(fecha, horaParaMinutos(horaLocal(a.fim)) || 24 * 60);
  }
  abre = Math.floor(abre / 60) * 60;
  fecha = Math.ceil(fecha / 60) * 60;
  const altura = (fecha - abre) * PX_POR_MIN;
  const minutosDoDia = (d: Date) => horaParaMinutos(horaLocal(d));
  const posicao = (ini: Date, fi: Date) => {
    const inicioMin = Math.max(abre, diaLocal(ini) < dia ? abre : minutosDoDia(ini));
    const fimMin = Math.min(fecha, diaLocal(fi) > dia ? fecha : minutosDoDia(fi));
    return { top: (inicioMin - abre) * PX_POR_MIN, height: Math.max(18, (fimMin - inicioMin) * PX_POR_MIN) };
  };
  const colunas = `56px repeat(${profissionais.length}, minmax(190px, 1fr))`;
  const agoraMin = dia === hoje ? minutosDoDia(new Date()) : null;
  const linhas = Array.from({ length: (fecha - abre) / 30 }, (_, i) => abre + i * 30);
  const previsto = agendamentos.filter((a) => a.status !== "FALTOU").reduce((s, a) => s + a.precoCentavos, 0);

  return (
    <div>
      <Cabecalho
        titulo={<span className="inline-block first-letter:uppercase">{formatarDiaExtenso(dia)}</span>}
        descricao={
          funcionamento
            ? `${ctx.atual && varias ? `${ctx.atual.nome} · ` : ""}${agendamentos.length} atendimento(s) · ${formatarDinheiro(previsto)} previstos · aberto das ${funcionamento.abre} às ${funcionamento.fecha}`
            : "Salão fechada neste dia"
        }
        acoes={
          <>
            <div className="flex items-center rounded-xl border border-black/10 bg-white">
              <Link className="rounded-l-xl p-2.5 hover:bg-black/[0.03]" href={`/painel/agenda?dia=${somarDias(dia, -1)}`} aria-label="Dia anterior">
                <ChevronLeft className="size-4" />
              </Link>
              <Link className="border-x border-black/10 px-3 py-2 text-sm font-semibold hover:bg-black/[0.03]" href="/painel/agenda">
                Hoje
              </Link>
              <Link className="rounded-r-xl p-2.5 hover:bg-black/[0.03]" href={`/painel/agenda?dia=${somarDias(dia, 1)}`} aria-label="Próximo dia">
                <ChevronRight className="size-4" />
              </Link>
            </div>
            <form className="flex gap-1">
              <input key={dia} type="date" name="dia" defaultValue={dia} className="input w-auto py-2" aria-label="Escolher data" />
              <button className="btn-secundario">Ir</button>
            </form>
            <Link href={`/painel/agenda/bloqueios?dia=${dia}`} className="btn-secundario">
              <CalendarOff className="size-4" /> Bloquear horário
            </Link>
            <Link href={`/painel/agenda/novo?dia=${dia}`} className="btn-destaque">
              <Plus className="size-4" /> Agendar
            </Link>
          </>
        }
      />

      {profissionais.length === 0 ? (
        <Vazio
          icone={CalendarOff}
          titulo="Ninguém na equipe ainda"
          texto="Cadastre os profissionais e os serviços para começar a usar a agenda."
          acao={<Link href="/painel/equipe/novo" className="btn-primario">Cadastrar profissional</Link>}
        />
      ) : (
        <div className="card overflow-x-auto p-0">
          <div style={{ minWidth: 56 + profissionais.length * 190 }}>
          <div className="grid" style={{ gridTemplateColumns: colunas }}>
            {/* Cabeçalho das colunas */}
            <div className="border-b border-black/[0.06] bg-white" />
            {profissionais.map((b) => (
              <div key={b.id} className="flex items-center gap-2.5 border-b border-l border-black/[0.06] bg-white px-3 py-3">
                <Avatar nome={b.nome} foto={b.foto} tamanho={30} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{b.nome}</p>
                  <p className="text-xs text-couro-400">
                    {varias && !ctx.atual && `${b.filial.nome} · `}
                    {agendamentos.filter((a) => a.profissionalId === b.id).length} atendimento(s)
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative grid pt-2 pb-4" style={{ gridTemplateColumns: colunas }}>
            {/* Coluna de horas */}
            <div className="relative" style={{ height: altura }}>
              {linhas.filter((m) => m % 60 === 0).map((m) => (
                <span key={m} className="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-couro-400 tabular-nums" style={{ top: (m - abre) * PX_POR_MIN }}>
                  {minutosParaHora(m)}
                </span>
              ))}
            </div>

            {profissionais.map((b) => (
              <div key={b.id} className="relative border-l border-black/[0.06]" style={{ height: altura }}>
                {/* Faixas clicáveis para agendar no horário livre */}
                {linhas.map((m) => (
                  <Link
                    key={m}
                    href={`/painel/agenda/novo?dia=${dia}&hora=${minutosParaHora(m)}&profissional=${b.id}`}
                    className={`group absolute inset-x-0 flex items-center px-2 hover:bg-latao-50 ${m % 60 === 0 ? "border-t border-black/[0.06]" : "border-t border-dashed border-black/[0.04]"}`}
                    style={{ top: (m - abre) * PX_POR_MIN, height: 30 * PX_POR_MIN }}
                    aria-label={`Agendar com ${b.nome} às ${minutosParaHora(m)}`}
                  >
                    <span className="hidden text-xs font-medium text-latao-700 group-hover:inline">+ {minutosParaHora(m)}</span>
                  </Link>
                ))}

                {bloqueios
                  .filter((x) => x.profissionalId === b.id || (x.profissionalId === null && (x.filialId === null || x.filialId === b.filialId)))
                  .map((x) => (
                    <div
                      key={x.id}
                      className="absolute inset-x-1 z-10 flex items-start overflow-hidden rounded-lg border border-black/10 p-2 text-xs font-medium text-couro-700"
                      style={{
                        ...posicao(x.inicio, x.fim),
                        backgroundImage: "repeating-linear-gradient(135deg, #e9e7e3 0 8px, #f4f3f0 8px 16px)",
                      }}
                    >
                      🚫 {x.motivo || "Bloqueado"}
                    </div>
                  ))}

                {agendamentos
                  .filter((a) => a.profissionalId === b.id)
                  .map((a) => {
                    const pos = posicao(a.inicio, a.fim);
                    return (
                      <Link
                        key={a.id}
                        href={`/painel/agendamentos/${a.id}`}
                        className={`absolute inset-x-1 z-10 overflow-hidden rounded-lg border border-l-4 border-black/[0.08] px-2.5 py-1.5 text-xs shadow-sm transition hover:z-20 hover:shadow-md ${ESTILO_STATUS[a.status] ?? ESTILO_STATUS.AGENDADO}`}
                        style={pos}
                      >
                        <p className="truncate font-semibold text-tinta">
                          <span className="tabular-nums">{horaLocal(a.inicio)}</span> · {a.cliente.nome}
                        </p>
                        {pos.height > 34 && <p className="truncate text-couro-700">{a.servico.nome}</p>}
                        {pos.height > 54 && (
                          <p className="truncate text-couro-400">
                            {ROTULO_STATUS[a.status]}
                            {a.origem === "ONLINE" && " · online"}
                          </p>
                        )}
                      </Link>
                    );
                  })}
              </div>
            ))}

            {/* Linha do "agora", listrada como o poste de salão */}
            {agoraMin !== null && agoraMin >= abre && agoraMin <= fecha && (
              <div
                className="pointer-events-none absolute right-0 left-0 z-30 flex items-center"
                style={{ top: 8 + (agoraMin - abre) * PX_POR_MIN - 2 }}
              >
                <span className="ml-1 rounded-md bg-poste-vermelho px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                  {minutosParaHora(agoraMin)}
                </span>
                <span className="poste h-1 flex-1 rounded-full shadow-sm" />
              </div>
            )}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
