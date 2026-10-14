import type { Metadata } from "next";
import Link from "next/link";
import { Clock, EyeOff, Plus, Sparkles } from "lucide-react";
import { Avatar, Cabecalho, Etiqueta, Vazio } from "@/components/ui";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatarDinheiro } from "@/lib/formato";
import { alternarServico } from "../actions";

export const metadata: Metadata = { title: "Serviços" };
export const dynamic = "force-dynamic";

export default async function Servicos() {
  const { salaoId } = await exigirGestor();
  const [servicos, totalProfissionais] = await Promise.all([
    db.servico.findMany({
      where: { salaoId },
      include: { profissionais: true, _count: { select: { agendamentos: true } } },
      orderBy: [{ ativo: "desc" }, { categoria: "asc" }, { precoCentavos: "asc" }],
    }),
    db.profissional.count({ where: { salaoId, ativo: true } }),
  ]);
  const categorias = [...new Set(servicos.filter((s) => s.ativo).map((s) => s.categoria))];
  const inativos = servicos.filter((s) => !s.ativo);

  return (
    <div>
      <Cabecalho
        titulo="Serviços"
        descricao="O cardápio do salão: o que aparece para o cliente agendar e entra nas comandas."
        acoes={<Link href="/painel/servicos/novo" className="btn-destaque"><Plus className="size-4" /> Novo serviço</Link>}
      />
      {servicos.length === 0 && (
        <Vazio icone={Sparkles} titulo="Nenhum serviço cadastrado" texto="Comece pelos mais pedidos: manicure, design de sobrancelha e cílios." acao={<Link href="/painel/servicos/novo" className="btn-primario">Cadastrar serviço</Link>} />
      )}

      {categorias.map((cat) => (
        <section key={cat} className="mb-8">
          <h2 className="rotulo mb-3">{cat}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {servicos.filter((s) => s.ativo && s.categoria === cat).map((s) => (
              <Link key={s.id} href={`/painel/servicos/${s.id}`} className="card group flex gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                {s.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.foto} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="grid size-20 shrink-0 place-items-center rounded-xl bg-latao-50 text-latao-600"><Sparkles className="size-7" /></span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-snug group-hover:text-latao-700">{s.nome}</p>
                    <p className="numero shrink-0 text-lg">{formatarDinheiro(s.precoCentavos)}</p>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-couro-400">
                    <Clock className="size-3" /> {s.duracaoMin} min · {s._count.agendamentos} agendamento(s)
                    {s.comissaoPct !== null && ` · comissão ${s.comissaoPct}%`}
                    {s.retornoDias && ` · retorno em ${s.retornoDias} dias`}
                  </p>
                  {s.descricao && <p className="mt-1.5 line-clamp-2 text-sm text-couro-700">{s.descricao}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {!s.exibirOnline && <Etiqueta><EyeOff className="mr-1 size-3" /> Só no balcão</Etiqueta>}
                    {s.profissionais.length > 0 && s.profissionais.length < totalProfissionais ? (
                      <span className="flex -space-x-1.5">
                        {s.profissionais.map((b) => <span key={b.id} className="rounded-full ring-2 ring-white" title={b.nome}><Avatar nome={b.nome} foto={b.foto} tamanho={22} /></span>)}
                      </span>
                    ) : (
                      <span className="text-xs text-couro-400">Todos os profissionais</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {inativos.length > 0 && (
        <section>
          <h2 className="rotulo mb-3">Desativados</h2>
          <ul className="card divide-y divide-black/[0.06] py-1">
            {inativos.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-couro-400">{s.nome} · {formatarDinheiro(s.precoCentavos)}</span>
                <form action={alternarServico}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="btn-secundario btn-pequeno">Reativar</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
