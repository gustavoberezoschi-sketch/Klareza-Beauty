"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarCheck, CalendarPlus, Check, ChevronDown, Clock, MapPin, Sparkles, Star, Store, UserRound } from "lucide-react";
import { formatarDinheiro, linkWhatsApp } from "@/lib/formato";
import { FUSO, criarDataHora } from "@/lib/tempo";
import { type Confirmacao, agendar, buscarHorarios } from "../actions";

export type ServicoOnline = {
  id: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  foto: string | null;
  precoCentavos: number;
  duracaoMin: number;
  profissionalIds: string[];
};
export type ProfissionalOnline = { id: string; nome: string; foto: string | null; destaque: boolean; bio: string | null; filialId: string };
export type FilialOnline = { id: string; nome: string; endereco: string | null; dias: string[] };
export type Plano = { nome: string; servicoIds: string[]; restantes: number | null } | null;

const SEM_PREFERENCIA = "";
const ativo = "border-[var(--cor)] bg-[var(--cor)] text-[var(--cor-texto)]";

function rotuloDia(dia: string) {
  const data = criarDataHora(dia, "12:00");
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, ...o }).format(data).replace(".", "");
  return { semana: f({ weekday: "short" }), numero: f({ day: "2-digit" }), mes: f({ month: "short" }) };
}

function linkGoogleAgenda(titulo: string, inicioISO: string, fimISO: string) {
  const f = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&dates=${f(inicioISO)}/${f(fimISO)}`;
}

export function Agendar({
  slug,
  nomeSalao,
  telefoneSalao,
  servicos,
  profissionais: todosProfissionais,
  filiais,
  cliente,
  plano,
  horarioAberto,
}: {
  slug: string;
  nomeSalao: string;
  telefoneSalao: string | null;
  servicos: ServicoOnline[];
  profissionais: ProfissionalOnline[];
  filiais: FilialOnline[];
  cliente: { nome: string } | null;
  plano: Plano;
  /** cliente logado que já tem um horário marcado (só marca outro depois desse) */
  horarioAberto?: { token: string; quando: string; descricao: string } | null;
}) {
  const variasFiliais = filiais.length > 1;
  const [filialId, setFilialId] = useState<string | null>(variasFiliais ? null : filiais[0]?.id ?? null);
  const [aberta, setAberta] = useState(variasFiliais ? 0 : 1);
  const [profissionalId, setProfissionalId] = useState<string | null>(null);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const filial = filiais.find((f) => f.id === filialId);
  const dias = filial?.dias ?? [];
  const profissionais = todosProfissionais.filter((b) => b.filialId === filialId);
  const [dia, setDia] = useState(dias[0] ?? "");
  const [horarios, setHorarios] = useState<string[] | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [jaAgendado, setJaAgendado] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState<Extract<Confirmacao, { ok: true }> | null>(null);
  const [carregando, iniciar] = useTransition();

  const profissional = profissionais.find((b) => b.id === profissionalId);
  const faz = (s: ServicoOnline, id: string | null) => !id || s.profissionalIds.length === 0 || s.profissionalIds.includes(id);
  const disponiveis = servicos.filter((s) => faz(s, profissionalId || null));
  const selecionados = escolhidos.map((id) => servicos.find((s) => s.id === id)!).filter(Boolean);

  // Quais dos escolhidos o plano do cliente cobre (respeitando o limite de usos).
  const cobertos = useMemo(() => {
    const set = new Set<string>();
    if (!plano) return set;
    let restantes = plano.restantes ?? Infinity;
    for (const s of selecionados) if (plano.servicoIds.includes(s.id) && restantes > 0) { set.add(s.id); restantes--; }
    return set;
  }, [plano, selecionados]);
  const total = selecionados.reduce((t, s) => t + (cobertos.has(s.id) ? 0 : s.precoCentavos), 0);
  const duracao = selecionados.reduce((t, s) => t + s.duracaoMin, 0);

  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem("salão:contato") ?? "null");
      if (salvo) { setNome(salvo.nome ?? ""); setTelefone(salvo.telefone ?? ""); }
    } catch {}
  }, []);

  useEffect(() => {
    if (aberta !== 3 || escolhidos.length === 0 || profissionalId === null || !filialId) return;
    setHora(null);
    setHorarios(null);
    let vivo = true;
    buscarHorarios(slug, filialId, escolhidos, profissionalId || null, dia).then((h) => vivo && setHorarios(h));
    return () => { vivo = false; };
  }, [slug, filialId, escolhidos, profissionalId, dia, aberta]);

  function escolherFilial(f: FilialOnline) {
    if (f.id !== filialId) {
      setFilialId(f.id);
      setProfissionalId(null);
      setHora(null);
      setDia(f.dias[0]);
    }
    setAberta(1);
  }

  function escolherProfissional(id: string) {
    setProfissionalId(id);
    setEscolhidos((atual) => atual.filter((sid) => faz(servicos.find((s) => s.id === sid)!, id || null)));
    setAberta(2);
  }

  function alternarServico(id: string) {
    setEscolhidos((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }

  function confirmar() {
    if (!hora || profissionalId === null || !filialId) return;
    setErro(null);
    setJaAgendado(null);
    iniciar(async () => {
      const r = await agendar(slug, { filialId, servicoIds: escolhidos, profissionalId: profissionalId || null, dia, hora, ...(cliente ? {} : { nome, telefone, senha, aceite }) });
      if (r.ok) {
        try { if (!cliente) localStorage.setItem("salão:contato", JSON.stringify({ nome, telefone })); } catch {}
        setConfirmado(r);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setErro(r.erro);
        setJaAgendado(r.jaAgendado ?? null);
        if (r.horarioOcupado) {
          setHora(null);
          setHorarios(await buscarHorarios(slug, filialId, escolhidos, profissionalId || null, dia));
        }
      }
    });
  }

  // a tela de confirmação vem antes: depois de agendar, a página recarrega e o horário recém-marcado já conta como "em aberto"
  if (horarioAberto && !confirmado) {
    return (
      <div className="mt-4 rounded-2xl bg-white p-6 text-center shadow-sm">
        <CalendarCheck className="mx-auto size-10 text-[var(--cor)]" />
        <p className="mt-3 font-display text-lg font-bold">Você já tem um horário marcado</p>
        <p className="mt-2 text-couro-700">
          <span className="inline-block first-letter:uppercase">{horarioAberto.quando}</span> · {horarioAberto.descricao}
        </p>
        <p className="mt-2 text-sm text-couro-400">Para marcar outro, cancele ou remarque esse primeiro. Depois do atendimento, o próximo já fica liberado.</p>
        <Link href={`/b/${slug}/agendamento/${horarioAberto.token}`} className="mt-5 inline-block rounded-xl bg-[var(--cor)] px-5 py-3 font-semibold text-[var(--cor-texto)]">
          Ver meu horário
        </Link>
      </div>
    );
  }

  if (confirmado) {
    const r = confirmado.resumo;
    return (
      <section className="rounded-3xl bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--cor)] text-[var(--cor-texto)]">
          <Check className="size-7" strokeWidth={3} />
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold">Horário marcado!</h2>
        <p className="mt-2 text-lg first-letter:uppercase">{r.dia}, às {r.hora}</p>
        <p className="text-couro-700">{r.servicos} com {r.profissional}</p>
        {variasFiliais && filial && <p className="text-sm text-couro-400">{filial.nome}{filial.endereco ? ` · ${filial.endereco}` : ""}</p>}
        {confirmado.contaCriada && <p className="mt-3 rounded-xl bg-emerald-600/10 p-2 text-sm text-emerald-800">Sua conta foi criada. Você já está conectado.</p>}
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <a href={linkGoogleAgenda(`${r.servicos} · ${nomeSalao}`, r.inicioISO, r.fimISO)} target="_blank" className="btn-secundario">
            <CalendarPlus className="size-4" /> Salvar na agenda
          </a>
          {cliente || confirmado.contaCriada ? (
            <Link href={`/b/${slug}/conta/agendamentos`} className="btn-secundario">Meus agendamentos</Link>
          ) : (
            <a href={`/b/${slug}/agendamento/${confirmado.token}`} className="btn-secundario">Ver ou cancelar</a>
          )}
        </div>
        {telefoneSalao && (
          <a href={linkWhatsApp(telefoneSalao, `Olá! Acabei de agendar ${r.servicos} com ${r.profissional}: ${r.dia} às ${r.hora}.`)} target="_blank" className="mt-3 inline-block text-sm font-semibold text-couro-700 underline">
            Avisar o salão pelo WhatsApp
          </a>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-3 pb-28">
      <p className="text-sm text-couro-700">Selecione os detalhes do seu agendamento</p>

      {variasFiliais && (
        <Etapa n={0} aberta={aberta === 0} feita={!!filialId} icone={Store} titulo="Selecione a filial" resumo={filial?.nome ?? null} abrir={() => setAberta(0)}>
          <div className="space-y-2">
            {filiais.map((f) => (
              <button key={f.id} onClick={() => escolherFilial(f)} aria-pressed={filialId === f.id} className={`flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${filialId === f.id ? "border-[var(--cor)] bg-[var(--cor)]/[0.06]" : "border-black/[0.06] bg-white hover:border-black/15"}`}>
                <MapPin className="mt-0.5 size-5 shrink-0 text-[var(--cor)]" />
                <span>
                  <span className="block font-semibold">{f.nome}</span>
                  {f.endereco && <span className="block text-sm text-couro-400">{f.endereco}</span>}
                </span>
              </button>
            ))}
          </div>
        </Etapa>
      )}

      <Etapa n={1} aberta={aberta === 1} feita={profissionalId !== null} bloqueada={!filialId} icone={UserRound} titulo="Selecione um profissional" resumo={profissionalId === null ? null : profissional?.nome ?? "Sem preferência"} abrir={() => filialId && setAberta(1)}>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {profissionais.length > 1 && (
            <CartaoProfissional nome="Sem preferência" selecionado={profissionalId === SEM_PREFERENCIA} onClick={() => escolherProfissional(SEM_PREFERENCIA)} />
          )}
          {profissionais.map((b) => (
            <CartaoProfissional key={b.id} nome={b.nome} foto={b.foto} destaque={b.destaque} selecionado={profissionalId === b.id} onClick={() => escolherProfissional(b.id)} />
          ))}
        </div>
      </Etapa>

      <Etapa n={2} aberta={aberta === 2} feita={escolhidos.length > 0} bloqueada={profissionalId === null} icone={Sparkles} titulo="Selecione os serviços" resumo={selecionados.length ? selecionados.map((s) => s.nome).join(", ") : null} abrir={() => profissionalId !== null && setAberta(2)}>
        <div className="space-y-2">
          {disponiveis.map((s) => {
            const marcado = escolhidos.includes(s.id);
            const doPlano = plano?.servicoIds.includes(s.id);
            return (
              <button key={s.id} onClick={() => alternarServico(s.id)} aria-pressed={marcado} className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${marcado ? "border-[var(--cor)] bg-[var(--cor)]/[0.06]" : "border-black/[0.06] bg-white hover:border-black/15"}`}>
                <span className={`grid size-6 shrink-0 place-items-center rounded-md border-2 ${marcado ? ativo : "border-black/20"}`}>{marcado && <Check className="size-4" strokeWidth={3} />}</span>
                {s.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.foto} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{s.nome}</span>
                  {s.descricao && <span className="line-clamp-2 block text-sm text-couro-400">{s.descricao}</span>}
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-couro-400"><Clock className="size-3" /> {s.duracaoMin} min</span>
                </span>
                <span className="shrink-0 text-right">
                  {doPlano ? (
                    <>
                      <span className="block text-xs font-semibold text-emerald-700">No seu plano</span>
                      <span className="text-xs text-couro-400 line-through">{formatarDinheiro(s.precoCentavos)}</span>
                    </>
                  ) : (
                    <span className="numero">{formatarDinheiro(s.precoCentavos)}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <button disabled={escolhidos.length === 0} onClick={() => setAberta(3)} className="mt-3 w-full rounded-2xl bg-[var(--cor)] py-3 font-bold text-[var(--cor-texto)] disabled:opacity-40">
          Continuar{escolhidos.length > 1 ? ` com ${escolhidos.length} serviços` : ""}
        </button>
      </Etapa>

      <Etapa n={3} aberta={aberta === 3} feita={!!hora} bloqueada={escolhidos.length === 0} icone={CalendarCheck} titulo="Selecione um horário" resumo={hora ? `${rotuloDia(dia).numero}/${dia.slice(5, 7)} às ${hora}` : null} abrir={() => escolhidos.length && setAberta(3)}>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
          {dias.map((d) => {
            const r = rotuloDia(d);
            return (
              <button key={d} onClick={() => setDia(d)} aria-pressed={dia === d} className={`w-16 shrink-0 rounded-2xl border px-2 py-2.5 text-center transition ${dia === d ? ativo : "border-black/[0.08] bg-white"}`}>
                <span className="block text-[11px] font-medium capitalize opacity-80">{r.semana}</span>
                <span className="numero block text-xl leading-tight">{r.numero}</span>
                <span className="block text-[11px] capitalize opacity-70">{r.mes}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3">
          {horarios === null ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{Array.from({ length: 8 }, (_, i) => <span key={i} className="h-10 animate-pulse rounded-xl bg-black/[0.05]" />)}</div>
          ) : horarios.length === 0 ? (
            <p className="rounded-2xl bg-fundo p-4 text-center text-sm text-couro-700">Sem horários livres neste dia. Escolha outro dia acima.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {horarios.map((h) => (
                <button key={h} onClick={() => { setHora(h); setErro(null); if (!cliente) setAberta(4); }} aria-pressed={hora === h} className={`rounded-xl border py-2.5 text-sm font-semibold tabular-nums transition ${hora === h ? ativo : "border-black/[0.08] bg-white hover:border-black/20"}`}>
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>
      </Etapa>

      {!cliente && (
        <Etapa n={4} aberta={aberta === 4} feita={!!nome && telefone.length >= 10} bloqueada={!hora} icone={UserRound} titulo="Seus dados" resumo={nome || null} abrir={() => hora && setAberta(4)}>
          <div className="space-y-3">
            <div><label className="label" htmlFor="nome-cliente">Seu nome</label><input id="nome-cliente" className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" /></div>
            <div><label className="label" htmlFor="tel-cliente">WhatsApp com DDD</label><input id="tel-cliente" className="input" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} autoComplete="tel" placeholder="(11) 91234-5678" /></div>
            <div>
              <label className="label" htmlFor="senha-cliente">Crie uma senha (opcional)</label>
              <input id="senha-cliente" type="password" className="input" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" placeholder="Para acompanhar seus agendamentos" />
              {senha && (
                <label className="mt-2 flex items-start gap-2 text-xs text-couro-700">
                  <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5" />
                  <span>
                    Li e aceito os <Link href="/termos" target="_blank" className="underline">Termos de Uso</Link> e a{" "}
                    <Link href="/privacidade" target="_blank" className="underline">Política de Privacidade</Link>.
                  </span>
                </label>
              )}
            </div>
            <p className="text-sm text-couro-400">Já tem conta? <Link href={`/b/${slug}/entrar`} className="font-semibold text-tinta underline">Entrar</Link></p>
            <p className="text-xs text-couro-400">
              Seus dados são usados pelo salão só para o seu atendimento. Veja a{" "}
              <Link href="/privacidade" target="_blank" className="underline">Política de Privacidade</Link>.
            </p>
          </div>
        </Etapa>
      )}

      {/* Resumo fixo no rodapé */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/[0.06] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            {selecionados.length ? (
              <>
                <p className="numero text-lg leading-tight">{formatarDinheiro(total)}</p>
                <p className="truncate text-xs text-couro-400">
                  {selecionados.length} serviço(s) · {duracao} min{cobertos.size ? ` · ${cobertos.size} no plano ${plano?.nome}` : ""}
                </p>
              </>
            ) : (
              <p className="text-sm text-couro-400">Nenhum serviço escolhido</p>
            )}
            {erro && hora && !jaAgendado && <p className="text-xs text-poste-vermelho">{erro}</p>}
          </div>
          <button
            onClick={confirmar}
            disabled={carregando || !hora || (!cliente && (!nome || telefone.replace(/\D/g, "").length < 10))}
            className="shrink-0 rounded-2xl bg-[var(--cor)] px-5 py-3 font-bold text-[var(--cor-texto)] shadow-sm disabled:opacity-40"
          >
            {carregando ? "Agendando..." : "Confirmar"}
          </button>
        </div>
      </div>
      {erro && !hora && !jaAgendado && <p className="rounded-xl bg-poste-vermelho/10 p-3 text-sm text-poste-vermelho">{erro}</p>}
      {jaAgendado && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/50 p-4" onClick={() => setJaAgendado(null)}>
          <div role="alertdialog" aria-labelledby="ja-agendado" className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CalendarCheck className="mx-auto size-10 text-[var(--cor)]" />
            <p id="ja-agendado" className="mt-3 font-display text-lg font-bold">Você já tem um horário marcado</p>
            <p className="mt-2 text-sm text-couro-700">{erro}</p>
            <Link href={`/b/${slug}/agendamento/${jaAgendado}`} className="mt-5 block rounded-xl bg-[var(--cor)] py-3 font-semibold text-[var(--cor-texto)]">
              Ver meu horário
            </Link>
            <button onClick={() => setJaAgendado(null)} className="mt-2 w-full py-2 text-sm font-medium text-couro-400">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Etapa({
  n, aberta, feita, bloqueada, icone: Icone, titulo, resumo, abrir, children,
}: {
  n: number; aberta: boolean; feita: boolean; bloqueada?: boolean; icone: typeof Sparkles; titulo: string; resumo: string | null; abrir: () => void; children: React.ReactNode;
}) {
  return (
    <section className={`overflow-hidden rounded-2xl bg-white shadow-sm transition ${bloqueada ? "opacity-60" : ""}`}>
      <button onClick={abrir} disabled={bloqueada} aria-expanded={aberta} className="flex w-full items-center gap-3 px-4 py-4 text-left">
        <span className={`grid size-8 shrink-0 place-items-center rounded-full ${feita ? "bg-[var(--cor)] text-[var(--cor-texto)]" : "bg-fundo text-[var(--cor)]"}`}>
          {feita ? <Check className="size-4" strokeWidth={3} /> : <Icone className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{titulo}</span>
          {resumo && !aberta && <span className="block truncate text-sm text-couro-400">{resumo}</span>}
        </span>
        <span className="sr-only">Etapa {n}</span>
        <ChevronDown className={`size-5 text-couro-400 transition ${aberta ? "rotate-180" : ""}`} />
      </button>
      {aberta && <div className="border-t border-black/[0.05] px-4 pt-4 pb-5">{children}</div>}
    </section>
  );
}

function CartaoProfissional({ nome, foto, destaque, selecionado, onClick }: { nome: string; foto?: string | null; destaque?: boolean; selecionado: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={selecionado} className="group text-center">
      <span className={`relative block aspect-square overflow-hidden rounded-2xl border-[3px] transition ${selecionado ? "border-[var(--cor)]" : "border-transparent"}`}>
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center bg-fundo text-couro-300">
            {nome === "Sem preferência" ? <Sparkles className="size-8" /> : <UserRound className="size-10" />}
          </span>
        )}
        {destaque && (
          <span className="absolute right-0 bottom-0 flex items-center gap-1 rounded-tl-lg bg-poste-azul px-1.5 py-0.5 text-[10px] font-semibold text-white">
            <Star className="size-3 fill-current" /> Destaque
          </span>
        )}
        {selecionado && (
          <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-[var(--cor)] text-[var(--cor-texto)]"><Check className="size-4" strokeWidth={3} /></span>
        )}
      </span>
      <span className="mt-1.5 block text-sm leading-tight font-semibold">{nome}</span>
    </button>
  );
}
