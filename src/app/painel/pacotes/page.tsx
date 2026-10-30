import type { Metadata } from "next";
import { Ticket } from "lucide-react";
import { FormAcao } from "@/components/FormAcao";
import { Cabecalho, Etiqueta, Secao, Vazio } from "@/components/ui";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatarDinheiro } from "@/lib/formato";
import { exigirRecurso } from "@/lib/planosSistema";
import { alternarPacote, salvarPacote } from "./actions";

export const metadata: Metadata = { title: "Pacotes" };
export const dynamic = "force-dynamic";

export default async function Pacotes() {
  const { salaoId } = await exigirGestor();
  await exigirRecurso(salaoId, "comandas");
  const [pacotes, servicos] = await Promise.all([
    db.pacote.findMany({
      where: { salaoId },
      include: { servico: { select: { nome: true, precoCentavos: true } }, _count: { select: { vendas: { where: { status: "ATIVO" } } } } },
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    }),
    db.servico.findMany({ where: { salaoId, ativo: true }, orderBy: [{ categoria: "asc" }, { nome: "asc" }] }),
  ]);

  return (
    <div>
      <Cabecalho
        titulo="Pacotes"
        descricao="Sessões vendidas antecipadas (ex.: 4 manutenções de cílios). O cliente compra na comanda e cada sessão é abatida sozinha nas próximas visitas."
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div>
          {pacotes.length === 0 ? (
            <Vazio icone={Ticket} titulo="Nenhum pacote cadastrado" texto="Pacotes fidelizam e garantem o dinheiro antes do atendimento." />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {pacotes.map((p) => {
                const avulso = p.servico.precoCentavos * p.sessoes;
                const economia = avulso > p.precoCentavos ? Math.round(((avulso - p.precoCentavos) / avulso) * 100) : 0;
                return (
                  <li key={p.id} className={`card p-4 ${p.ativo ? "" : "opacity-60"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold leading-snug">{p.nome}</p>
                      <p className="numero shrink-0 text-lg">{formatarDinheiro(p.precoCentavos)}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-couro-400">
                      {p.sessoes}× {p.servico.nome} · {p.validadeDias ? `vale ${p.validadeDias} dias` : "não vence"}
                      {economia > 0 && ` · ${economia}% mais barato que avulso`}
                    </p>
                    {p.descricao && <p className="mt-1.5 text-sm text-couro-700">{p.descricao}</p>}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      {p.ativo ? <Etiqueta tom="verde">{p._count.vendas} cliente(s) com este pacote</Etiqueta> : <Etiqueta>Desativado</Etiqueta>}
                      <form action={alternarPacote}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="btn-secundario btn-pequeno">{p.ativo ? "Desativar" : "Reativar"}</button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="xl:sticky xl:top-6 xl:self-start">
          <Secao titulo="Novo pacote">
            {servicos.length === 0 ? (
              <p className="text-sm text-couro-400">Cadastre um serviço antes de criar pacotes.</p>
            ) : (
              <FormAcao acao={salvarPacote} limparAoSalvar className="grid gap-3">
                <div><label className="label" htmlFor="nome">Nome</label><input id="nome" name="nome" className="input" placeholder="Manutenção de cílios ×4" required /></div>
                <div>
                  <label className="label" htmlFor="servicoId">Serviço</label>
                  <select id="servicoId" name="servicoId" className="input" required>
                    {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome} · {formatarDinheiro(s.precoCentavos)}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="label" htmlFor="sessoes">Sessões</label><input id="sessoes" name="sessoes" type="number" min={2} max={50} defaultValue={4} className="input" required /></div>
                  <div><label className="label" htmlFor="preco">Preço (R$)</label><input id="preco" name="preco" className="input" placeholder="280,00" inputMode="decimal" required /></div>
                  <div><label className="label" htmlFor="validadeDias">Vale (dias)</label><input id="validadeDias" name="validadeDias" type="number" min={7} max={730} className="input" placeholder="90" /></div>
                </div>
                <div><label className="label" htmlFor="descricao">Descrição</label><input id="descricao" name="descricao" className="input" placeholder="Opcional" /></div>
                <button className="btn-destaque">Cadastrar pacote</button>
              </FormAcao>
            )}
          </Secao>
        </div>
      </div>
    </div>
  );
}
