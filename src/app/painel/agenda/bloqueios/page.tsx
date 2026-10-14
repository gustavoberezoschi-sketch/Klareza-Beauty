import type { Metadata } from "next";
import { CalendarOff, Trash2 } from "lucide-react";
import { FormAcao } from "@/components/FormAcao";
import { Cabecalho, Secao, Vazio } from "@/components/ui";
import { exigirSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { filialDoPainel } from "@/lib/filial";
import { diaLocal, diaValido, formatarDataHora } from "@/lib/tempo";
import { criarBloqueio, removerBloqueio } from "../actions";

export const metadata: Metadata = { title: "Bloqueios de agenda" };
export const dynamic = "force-dynamic";

export default async function Bloqueios({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const sessao = await exigirSessao();
  const p = await searchParams;
  const dia = p.dia && diaValido(p.dia) ? p.dia : diaLocal();
  const meu = sessao.profissionalId ? { profissionalId: sessao.profissionalId } : {};
  const ctx = await filialDoPainel(sessao);
  const ativas = ctx.filiais.filter((f) => f.ativo);
  const daUnidade = ctx.atual
    ? { OR: [{ filialId: ctx.atual.id }, { filialId: null }] }
    : {};

  const [profissionais, bloqueios] = await Promise.all([
    db.profissional.findMany({
      where: { salaoId: sessao.salaoId, ativo: true, ...(ctx.atual ? { filialId: ctx.atual.id } : {}), ...(sessao.profissionalId ? { id: sessao.profissionalId } : {}) },
      orderBy: { nome: "asc" },
    }),
    db.bloqueio.findMany({
      where: { salaoId: sessao.salaoId, fim: { gte: new Date() }, ...meu, ...daUnidade },
      include: { profissional: true, filial: true },
      orderBy: { inicio: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <Cabecalho
        titulo="Folgas e bloqueios"
        descricao="Almoço, folga, férias ou compromisso: horários bloqueados não aparecem para o cliente agendar."
        voltar={{ href: `/painel/agenda?dia=${dia}`, rotulo: "Agenda" }}
      />
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Secao titulo="Novo bloqueio">
          <FormAcao acao={criarBloqueio} limparAoSalvar className="grid gap-3">
            {!sessao.profissionalId && (
              <div>
                <label className="label" htmlFor="quem">Quem</label>
                <select id="quem" name="quem" className="input" defaultValue={ctx.atual ? `filial:${ctx.atual.id}` : ativas.length > 1 ? "todas" : `filial:${ativas[0]?.id}`}>
                  {ativas.length > 1 && <option value="todas">Todas as unidades (feriado...)</option>}
                  {ativas.filter((f) => !ctx.atual || f.id === ctx.atual.id).map((f) => (
                    <option key={f.id} value={`filial:${f.id}`}>{ativas.length > 1 ? `Unidade ${f.nome} inteira` : "Salão inteira (feriado, reforma...)"}</option>
                  ))}
                  {profissionais.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label" htmlFor="motivo">Motivo</label>
              <input id="motivo" name="motivo" className="input" placeholder="Almoço, folga, férias..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="diaInicio">De</label>
                <input id="diaInicio" type="date" name="diaInicio" defaultValue={dia} className="input" required />
              </div>
              <div>
                <label className="label" htmlFor="diaFim">Até</label>
                <input id="diaFim" type="date" name="diaFim" defaultValue={dia} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="horaInicio">Das</label>
                <input id="horaInicio" type="time" name="horaInicio" defaultValue="12:00" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="horaFim">Às</label>
                <input id="horaFim" type="time" name="horaFim" defaultValue="13:00" className="input" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="diaInteiro" /> Dia(s) inteiro(s)
            </label>
            <button className="btn-primario">Bloquear</button>
          </FormAcao>
        </Secao>

        <Secao titulo="Próximos bloqueios">
          {bloqueios.length === 0 ? (
            <Vazio icone={CalendarOff} titulo="Nenhum bloqueio marcado" texto="A agenda está toda disponível para agendamento." />
          ) : (
            <ul className="divide-y divide-black/[0.06]">
              {bloqueios.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{b.motivo || "Bloqueado"} · <span className="font-normal text-couro-400">{b.profissional?.nome ?? (b.filial ? (ativas.length > 1 ? `Unidade ${b.filial.nome}` : "Salão inteira") : "Todas as unidades")}</span></p>
                    <p className="text-sm text-couro-400 tabular-nums">
                      {formatarDataHora(b.inicio)} até {formatarDataHora(b.fim)}
                    </p>
                  </div>
                  <form action={removerBloqueio}>
                    <input type="hidden" name="id" value={b.id} />
                    <button className="rounded-lg p-2 text-couro-400 hover:bg-poste-vermelho/10 hover:text-poste-vermelho" aria-label="Remover bloqueio">
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </div>
    </div>
  );
}
