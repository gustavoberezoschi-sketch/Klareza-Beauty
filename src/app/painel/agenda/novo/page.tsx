import type { Metadata } from "next";
import { FormAcao } from "@/components/FormAcao";
import { Cabecalho } from "@/components/ui";
import { exigirSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { filialDoPainel, naFilial } from "@/lib/filial";
import { formatarDinheiro, formatarTelefone } from "@/lib/formato";
import { diaLocal, diaValido } from "@/lib/tempo";
import { criarAgendamento } from "../actions";

export const metadata: Metadata = { title: "Novo agendamento" };

export default async function NovoAgendamento({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; hora?: string; profissional?: string; cliente?: string }>;
}) {
  const sessao = await exigirSessao();
  const { salaoId } = sessao;
  const p = await searchParams;
  const dia = p.dia && diaValido(p.dia) ? p.dia : diaLocal();

  const [profissionais, servicos, clientes] = await Promise.all([
    db.profissional.findMany({
      where: { salaoId, ativo: true, ...naFilial(await filialDoPainel(sessao)), ...(sessao.profissionalId ? { id: sessao.profissionalId } : {}) },
      include: { filial: { select: { nome: true } } },
      orderBy: [{ filial: { ordem: "asc" } }, { nome: "asc" }],
    }),
    db.servico.findMany({ where: { salaoId, ativo: true }, orderBy: [{ categoria: "asc" }, { nome: "asc" }] }),
    db.cliente.findMany({ where: { salaoId }, orderBy: { nome: "asc" }, select: { id: true, nome: true, telefone: true } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <Cabecalho titulo="Novo agendamento" voltar={{ href: `/painel/agenda?dia=${dia}`, rotulo: "Agenda" }} />

      <FormAcao acao={criarAgendamento} className="card grid gap-5 sm:grid-cols-2">
        <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
          <legend className="rotulo mb-3">Cliente</legend>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="clienteId">Cliente cadastrado</label>
            <select id="clienteId" name="clienteId" className="input" defaultValue={p.cliente ?? ""}>
              <option value="">Cliente novo (preencha abaixo)</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} · {formatarTelefone(c.telefone)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="clienteNome">Nome do cliente novo</label>
            <input id="clienteNome" name="clienteNome" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="clienteTelefone">WhatsApp do cliente novo</label>
            <input id="clienteTelefone" name="clienteTelefone" className="input" inputMode="tel" placeholder="(11) 91234-5678" />
          </div>
        </fieldset>

        <fieldset className="grid gap-4 border-t border-black/[0.06] pt-5 sm:col-span-2 sm:grid-cols-2">
          <legend className="rotulo mb-3 pt-5">Atendimento</legend>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="servicoId">Serviço</label>
            <select id="servicoId" name="servicoId" className="input" required>
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.categoria} · {s.nome} · {formatarDinheiro(s.precoCentavos)} · {s.duracaoMin} min
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="profissionalId">Profissional</label>
            <select id="profissionalId" name="profissionalId" className="input" required defaultValue={p.profissional}>
              {profissionais.map((b) => <option key={b.id} value={b.id}>{b.nome}{new Set(profissionais.map((x) => x.filialId)).size > 1 ? ` · ${b.filial.nome}` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="dia">Data</label>
            <input id="dia" type="date" name="dia" className="input" defaultValue={dia} required />
          </div>
          <div>
            <label className="label" htmlFor="hora">Hora</label>
            <input id="hora" type="time" name="hora" className="input" required step={300} defaultValue={p.hora} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="observacao">Observação</label>
            <input id="observacao" name="observacao" className="input" placeholder="Ex.: prefere máquina 2 na lateral" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="encaixe" /> Encaixe: agendar mesmo se o profissional estiver ocupado
          </label>
        </fieldset>
        <button className="btn-destaque sm:col-span-2">Agendar</button>
      </FormAcao>
    </div>
  );
}
