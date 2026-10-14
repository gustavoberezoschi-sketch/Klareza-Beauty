import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Plus, UsersRound } from "lucide-react";
import { Avatar, Cabecalho, Etiqueta, Vazio } from "@/components/ui";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { filialDoPainel, naFilial } from "@/lib/filial";
import { formatarDinheiro, formatarTelefone } from "@/lib/formato";
import { criarDataHora, diaLocal, limitesDoMes, somarDias } from "@/lib/tempo";

export const metadata: Metadata = { title: "Equipe" };
export const dynamic = "force-dynamic";

export default async function Equipe() {
  const sessao = await exigirGestor();
  const { salaoId } = sessao;
  const ctx = await filialDoPainel(sessao);
  const mes = limitesDoMes(diaLocal());
  const [profissionais, itens] = await Promise.all([
    db.profissional.findMany({ where: { salaoId, ...naFilial(ctx) }, include: { usuario: true, servicos: true, filial: true }, orderBy: [{ ativo: "desc" }, { nome: "asc" }] }),
    db.comandaItem.findMany({
      where: {
        comanda: { salaoId, status: "FECHADA", fechadaEm: { gte: criarDataHora(mes.inicio, "00:00"), lt: criarDataHora(somarDias(mes.fim, 1), "00:00") } },
      },
      select: { profissionalId: true, auxiliarId: true, quantidade: true, precoUnitCentavos: true, comissaoPct: true, comissaoAuxiliarPct: true, tipo: true },
    }),
  ]);
  const doMes = (id: string) => {
    const meus = itens.filter((i) => i.profissionalId === id);
    return {
      atendimentos: meus.filter((i) => i.tipo === "SERVICO").length,
      comissao:
        meus.reduce((s, i) => s + Math.round((i.quantidade * i.precoUnitCentavos * i.comissaoPct) / 100), 0) +
        itens.filter((i) => i.auxiliarId === id).reduce((s, i) => s + Math.round((i.quantidade * i.precoUnitCentavos * i.comissaoAuxiliarPct) / 100), 0),
    };
  };

  return (
    <div>
      <Cabecalho
        titulo="Equipe"
        descricao="Profissionais, comissões e acesso de cada um ao sistema."
        acoes={<Link href="/painel/equipe/novo" className="btn-destaque"><Plus className="size-4" /> Novo profissional</Link>}
      />
      {profissionais.length === 0 ? (
        <Vazio icone={UsersRound} titulo="Nenhum profissional cadastrado" acao={<Link href="/painel/equipe/novo" className="btn-primario">Cadastrar profissional</Link>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {profissionais.map((b) => {
            const m = doMes(b.id);
            return (
              <Link key={b.id} href={`/painel/equipe/${b.id}`} className={`card group transition hover:-translate-y-0.5 hover:shadow-md ${b.ativo ? "" : "opacity-50"}`}>
                <div className="flex items-center gap-4">
                  <Avatar nome={b.nome} foto={b.foto} tamanho={56} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-bold group-hover:text-latao-700">{b.nome}</p>
                    <p className="text-sm text-couro-400">
                      {ctx.filiais.length > 1 && `${b.filial.nome} · `}
                      {b.telefone ? formatarTelefone(b.telefone) : "Sem telefone"}
                    </p>
                  </div>
                  {!b.ativo ? <Etiqueta>Inativo</Etiqueta> : b.usuario && <Etiqueta tom="azul"><KeyRound className="mr-1 size-3" /> Tem acesso</Etiqueta>}
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-black/[0.06] pt-4 text-center">
                  <div><dt className="rotulo">Comissão</dt><dd className="numero mt-1">{b.comissaoPct}%</dd></div>
                  <div><dt className="rotulo">No mês</dt><dd className="numero mt-1">{m.atendimentos}</dd></div>
                  <div><dt className="rotulo">A receber</dt><dd className="numero mt-1 text-latao-700">{formatarDinheiro(m.comissao)}</dd></div>
                </dl>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
