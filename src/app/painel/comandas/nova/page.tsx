import type { Metadata } from "next";
import { FormAcao } from "@/components/FormAcao";
import { Cabecalho } from "@/components/ui";
import { exigirSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { filialDoPainel } from "@/lib/filial";
import { formatarTelefone } from "@/lib/formato";
import { exigirRecurso } from "@/lib/planosSistema";
import { novaComanda } from "../actions";

export const metadata: Metadata = { title: "Nova comanda" };

export default async function NovaComanda() {
  const sessao = await exigirSessao();
  await exigirRecurso(sessao.salaoId, "comandas");
  const ctx = await filialDoPainel(sessao);
  const ativas = ctx.filiais.filter((f) => f.ativo);
  const [clientes, profissionais] = await Promise.all([
    db.cliente.findMany({ where: { salaoId: sessao.salaoId }, orderBy: { nome: "asc" } }),
    db.profissional.findMany({ where: { salaoId: sessao.salaoId, ativo: true, ...(ctx.atual ? { filialId: ctx.atual.id } : {}) }, orderBy: { nome: "asc" } }),
  ]);
  return (
    <div className="mx-auto max-w-xl">
      <Cabecalho titulo="Nova comanda" descricao="Para atendimento sem agendamento ou venda de produto no balcão." voltar={{ href: "/painel/comandas", rotulo: "Comandas" }} />
      <FormAcao acao={novaComanda} className="card grid gap-4">
        <div>
          <label className="label" htmlFor="clienteId">Cliente</label>
          <select id="clienteId" name="clienteId" className="input">
            <option value="">Cliente avulso (sem cadastro)</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome} · {formatarTelefone(c.telefone)}</option>)}
          </select>
        </div>
        {ctx.atual ? (
          <input type="hidden" name="filialId" value={ctx.atual.id} />
        ) : (
          <div>
            <label className="label" htmlFor="filialId">Unidade</label>
            <select id="filialId" name="filialId" className="input" required>
              {ativas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
        )}
        {!sessao.profissionalId && (
          <div>
            <label className="label" htmlFor="profissionalId">Profissional responsável</label>
            <select id="profissionalId" name="profissionalId" className="input">
              <option value="">Nenhum (venda do balcão)</option>
              {profissionais.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </div>
        )}
        <button className="btn-destaque">Abrir comanda</button>
      </FormAcao>
    </div>
  );
}
