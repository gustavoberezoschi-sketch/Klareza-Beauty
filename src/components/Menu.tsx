"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  CreditCard,
  BadgeCheck,
  Building2,
  ChartColumn,
  Crown,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu as IconeMenu,
  MessageCircle,
  Package,
  ReceiptText,
  Sparkles,
  Settings,
  Store,
  Ticket,
  Users,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; rotulo: string; icone: LucideIcon };
type Grupo = { titulo: string; itens: Item[] };

const GESTOR: Grupo[] = [
  {
    titulo: "Dia a dia",
    itens: [
      { href: "/painel", rotulo: "Início", icone: LayoutDashboard },
      { href: "/painel/agenda", rotulo: "Agenda", icone: CalendarDays },
      { href: "/painel/lembretes", rotulo: "Lembretes", icone: MessageCircle },
      { href: "/painel/comandas", rotulo: "Comandas", icone: ReceiptText },
      { href: "/painel/caixa", rotulo: "Caixa", icone: Wallet },
    ],
  },
  {
    titulo: "Clientes",
    itens: [
      { href: "/painel/clientes", rotulo: "Clientes", icone: Users },
      { href: "/painel/assinaturas", rotulo: "Clube de assinatura", icone: Crown },
      { href: "/painel/pacotes", rotulo: "Pacotes", icone: Ticket },
      { href: "/painel/vitrine", rotulo: "Página do cliente", icone: Store },
    ],
  },
  {
    titulo: "Cadastros",
    itens: [
      { href: "/painel/servicos", rotulo: "Serviços", icone: Sparkles },
      { href: "/painel/produtos", rotulo: "Produtos e estoque", icone: Package },
      { href: "/painel/equipe", rotulo: "Equipe", icone: UsersRound },
    ],
  },
  {
    titulo: "Gestão",
    itens: [
      { href: "/painel/financeiro", rotulo: "Financeiro", icone: Landmark },
      { href: "/painel/pagamentos", rotulo: "Pagamentos online", icone: CreditCard },
      { href: "/painel/unidades", rotulo: "Unidades", icone: Building2 },
      { href: "/painel/relatorios", rotulo: "Relatórios", icone: ChartColumn },
      { href: "/painel/configuracoes", rotulo: "Configurações", icone: Settings },
      { href: "/painel/plano", rotulo: "Meu plano", icone: BadgeCheck },
    ],
  },
];

const PROFISSIONAL: Grupo[] = [
  {
    titulo: "Meu dia",
    itens: [
      { href: "/painel/agenda", rotulo: "Minha agenda", icone: CalendarDays },
      { href: "/painel/lembretes", rotulo: "Lembretes", icone: MessageCircle },
      { href: "/painel/comandas", rotulo: "Comandas", icone: ReceiptText },
      { href: "/painel/relatorios", rotulo: "Minhas comissões", icone: ChartColumn },
    ],
  },
];

export function Menu({
  salao,
  logo,
  usuario,
  papel,
  sair,
  filiais,
  filialAtual,
  trocarFilial,
}: {
  salao: string;
  logo: string | null;
  usuario: string;
  papel: string;
  sair: () => Promise<void>;
  filiais: { id: string; nome: string }[];
  filialAtual: { id: string; nome: string } | null;
  trocarFilial: (form: FormData) => Promise<void>;
}) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  useEffect(() => setAberto(false), [caminho]);

  const grupos = papel === "PROFISSIONAL" ? PROFISSIONAL : GESTOR;
  const ativo = (href: string) => (href === "/painel" ? caminho === href : caminho.startsWith(href));

  const conteudo = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="size-10 rounded-xl object-cover" />
        ) : (
          <span className="grid size-10 place-items-center rounded-xl bg-latao-500 text-white">
            <Sparkles className="size-5" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <p className="line-clamp-2 font-display text-[15px] leading-tight font-bold text-white">{salao}</p>
          <p className="text-xs text-couro-400">{papel === "PROFISSIONAL" ? "Profissional" : "Gestão"}</p>
        </div>
      </div>

      {filiais.length > 1 && papel !== "PROFISSIONAL" && (
        <form action={trocarFilial} className="mx-3 mb-4">
          <label htmlFor="filial-menu" className="mb-1 block px-1 text-[10px] font-semibold tracking-[0.14em] text-couro-400 uppercase">Unidade</label>
          <select
            id="filial-menu"
            name="filialId"
            defaultValue={filialAtual?.id ?? ""}
            key={filialAtual?.id ?? "todas"}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="w-full cursor-pointer rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-white outline-none focus:border-latao-500 [&>option]:text-tinta"
          >
            <option value="">Todas as unidades</option>
            {filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </form>
      )}
      {papel === "PROFISSIONAL" && filialAtual && filiais.length > 1 && (
        <p className="mx-6 mb-4 text-xs text-couro-400">Unidade {filialAtual.nome}</p>
      )}

      <nav className="rolagem-escura flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Menu principal">
        {grupos.map((g) => (
          <div key={g.titulo}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.14em] text-couro-400 uppercase">{g.titulo}</p>
            {g.itens.map(({ href, rotulo, icone: Icone }) => (
              <Link
                key={href}
                href={href}
                aria-current={ativo(href) ? "page" : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition ${
                  ativo(href) ? "bg-white/[0.07] text-white" : "text-couro-300 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {ativo(href) && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-verde-claro" aria-hidden />}
                <Icone className={`size-[18px] ${ativo(href) ? "text-verde-claro" : "text-couro-400 group-hover:text-couro-300"}`} aria-hidden />
                {rotulo}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <form action={sair} className="border-t border-white/[0.06] p-3">
        <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2">
          <p className="min-w-0 truncate text-sm text-couro-300">
            {usuario}
            <span className="block text-[10px] font-semibold tracking-[0.12em] text-couro-400 uppercase">
              Klareza<span className="text-verde-claro">Beauty</span>
            </span>
          </p>
          <button className="rounded-lg p-1.5 text-couro-400 hover:bg-white/[0.06] hover:text-white" title="Sair" aria-label="Sair">
            <LogOut className="size-4" />
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-couro-900 lg:block">{conteudo}</aside>

      <div className="sticky top-0 z-30 flex items-center justify-between bg-couro-900 px-4 py-3 lg:hidden">
        <p className="truncate font-display font-bold text-white">
          {salao}
          {filiais.length > 1 && <span className="ml-1.5 text-xs font-medium text-couro-300">· {filialAtual?.nome ?? "Todas"}</span>}
        </p>
        <button onClick={() => setAberto(true)} className="rounded-lg p-2 text-white hover:bg-white/10" aria-label="Abrir menu">
          <IconeMenu className="size-5" />
        </button>
      </div>
      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-couro-950/60" onClick={() => setAberto(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-couro-900 shadow-2xl">
            <button onClick={() => setAberto(false)} className="absolute top-5 right-3 rounded-lg p-2 text-couro-300 hover:bg-white/10" aria-label="Fechar menu">
              <X className="size-5" />
            </button>
            {conteudo}
          </aside>
        </div>
      )}
    </>
  );
}
