"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { BellRing, CalendarCheck, CalendarPlus, Check, ChevronDown, Clock, Copy, MapPin, QrCode, Sparkles, Star, Store, UserRound, Users } from "lucide-react";
import { formatarDinheiro, linkWhatsApp } from "@/lib/formato";
import { FUSO, criarDataHora } from "@/lib/tempo";
import { type Confirmacao, agendar, buscarHorarios, entrarNaListaDeEspera, statusDoSinal } from "../actions";

export type ServicoOnline = {
  id: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  foto: string | null;
  precoCentavos: number;
  duracaoMin: number;
  profissionalIds: string[];
  variacoes: Opcao[];
  adicionais: Opcao[];
  /** faixas de preço da manutenção, já descritas */
  manutencao: string | null;
};
type Opcao = { id: string; nome: string; precoCentavos: number; duracaoMin: number };
type Escolha = { variacaoId: string | null; adicionalIds: string[] };
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
  sinalPct = 0,
  creditoIndicacao = 0,
  indicacaoInicial = "",
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
  /** % de sinal por Pix (0 = sem sinal) */
  sinalPct?: number;
  /** "Indique uma amiga": crédito em centavos (0 = desligado) */
  creditoIndicacao?: number;
  indicacaoInicial?: string;
}) {
  const variasFiliais = filiais.length > 1;
  const [filialId, setFilialId] = useState<string | null>(variasFiliais ? null : filiais[0]?.id ?? null);
  const [aberta, setAberta] = useState(variasFiliais ? 0 : 1);
  const [profissionalId, setProfissionalId] = useState<string | null>(null);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const [simultaneo, setSimultaneo] = useState(false);
  const [cpf, setCpf] = useState("");
  const [indicacao, setIndicacao] = useState(indicacaoInicial);
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
  const itens = useMemo(
    () => escolhidos.map((id) => ({ servicoId: id, variacaoId: escolhas[id]?.variacaoId ?? null, adicionalIds: escolhas[id]?.adicionalIds ?? [] })),
    [escolhidos, escolhas],
  );
  const chaveItens = JSON.stringify(itens);
  // preço e duração de cada serviço com a variação e os adicionais escolhidos
  const valorItem = (s: ServicoOnline) => {
    const e = escolhas[s.id];
    const v = s.variacoes.find((x) => x.id === e?.variacaoId);
    const extras = s.adicionais.filter((a) => e?.adicionalIds.includes(a.id));
    return {
      preco: (v?.precoCentavos ?? s.precoCentavos) + extras.reduce((t, a) => t + a.precoCentavos, 0),
      duracao: (v?.duracaoMin ?? s.duracaoMin) + extras.reduce((t, a) => t + a.duracaoMin, 0),
    };
  };
  const podeSimultaneo = profissionalId === SEM_PREFERENCIA && escolhidos.length > 1 && profissionais.length > 1;
  const emSimultaneo = podeSimultaneo && simultaneo;

  // Quais dos escolhidos o plano do cliente cobre (respeitando o limite de usos).
  const cobertos = useMemo(() => {
    const set = new Set<string>();
    if (!plano) return set;
    let restantes = plano.restantes ?? Infinity;
    for (const s of selecionados) if (plano.servicoIds.includes(s.id) && restantes > 0) { set.add(s.id); restantes--; }
    return set;
  }, [plano, selecionados]);
  const total = selecionados.reduce((t, s) => t + (cobertos.has(s.id) ? 0 : valorItem(s).preco), 0);
  const duracoes = selecionados.map((s) => valorItem(s).duracao);
  const duracao = emSimultaneo ? Math.max(0, ...duracoes) : duracoes.reduce((t, d) => t + d, 0);
  const sinalPrevisto = sinalPct > 0 ? Math.round((total * sinalPct) / 100) : 0;
  const temSinal = sinalPrevisto >= 500; // abaixo de R$ 5 o Asaas não cobra
  const [espera, setEspera] = useState<{ periodo: string; enviado: boolean; erro: string | null }>({ periodo: "QUALQUER", enviado: false, erro: null });

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
    setEspera((e) => ({ ...e, enviado: false, erro: null }));
    buscarHorarios(slug, filialId, JSON.parse(chaveItens), profissionalId || null, dia, emSimultaneo).then((h) => vivo && setHorarios(h));
    return () => { vivo = false; };
  }, [slug, filialId, chaveItens, profissionalId, dia, aberta, emSimultaneo, escolhidos.length]);

  // Tela do Pix: confere a cada 5 segundos se o sinal já foi pago
  const [sinalPago, setSinalPago] = useState(false);
  const tokenConfirmado = confirmado?.token;
  const aguardaPix = !!confirmado?.sinal;
  useEffect(() => {
    if (!tokenConfirmado || !aguardaPix || sinalPago) return;
    const t = setInterval(() => statusDoSinal(slug, tokenConfirmado).then((r) => r?.pago && setSinalPago(true)), 5000);
    return () => clearInterval(t);
  }, [slug, tokenConfirmado, aguardaPix, sinalPago]);

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
    const s = servicos.find((x) => x.id === id);
    setEscolhidos((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
    // com variações, já deixa a primeira marcada
    if (s && !escolhas[id]) setEscolhas((e) => ({ ...e, [id]: { variacaoId: s.variacoes[0]?.id ?? null, adicionalIds: [] } }));
  }

  function escolherVariacao(servicoId: string, variacaoId: string) {
    setEscolhas((e) => ({ ...e, [servicoId]: { variacaoId, adicionalIds: e[servicoId]?.adicionalIds ?? [] } }));
  }

  function alternarAdicional(servicoId: string, adicionalId: string) {
    setEscolhas((e) => {
      const atual = e[servicoId] ?? { variacaoId: null, adicionalIds: [] };
      const ids = atual.adicionalIds.includes(adicionalId) ? atual.adicionalIds.filter((x) => x !== adicionalId) : [...atual.adicionalIds, adicionalId];
      return { ...e, [servicoId]: { ...atual, adicionalIds: ids } };
    });
  }

  function entrarNaEspera() {
    if (!filialId) return;
    iniciar(async () => {
      const r = await entrarNaListaDeEspera(slug, { filialId, itens, dia, periodo: espera.periodo, ...(cliente ? {} : { nome, telefone }) });
      setEspera((e) => ({ ...e, enviado: r.ok, erro: r.erro ?? null }));
    });
  }

  function confirmar() {
    if (!hora || profissionalId === null || !filialId) return;
    setErro(null);
    setJaAgendado(null);
    iniciar(async () => {
      const r = await agendar(slug, {
        filialId,
        itens,
        profissionalId: profissionalId || null,
        simultaneo: emSimultaneo,
        dia,
        hora,
        cpf: temSinal ? cpf : undefined,
        ...(cliente ? {} : { nome, telefone, senha, aceite, indicacao }),
      });
      if (r.ok) {
        try { if (!cliente) localStorage.setItem("salão:contato", JSON.stringify({ nome, telefone })); } catch {}
        setConfirmado(r);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setErro(r.erro);
        setJaAgendado(r.jaAgendado ?? null);
        if (r.horarioOcupado) {
          setHora(null);
          setHorarios(await buscarHorarios(slug, filialId, itens, profissionalId || null, dia, emSimultaneo));
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

  if (confirmado?.sinal && !sinalPago) {
    const r = confirmado.resumo;
    const s = confirmado.sinal;
    const expira = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(new Date(s.expiraEm));
    return (
      <section className="rounded-3xl bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--cor)] text-[var(--cor-texto)]">
          <QrCode className="size-7" />
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold">Falta só o sinal</h2>
        <p className="mt-2 text-couro-700">
          Pague <strong>{formatarDinheiro(s.valorCentavos)}</strong> por Pix até as <strong>{expira}</strong> para garantir{" "}
          <span className="first-letter:uppercase">{r.dia}, às {r.hora}</span>. O valor é descontado no dia do atendimento.
        </p>
        {s.qrCode && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:image/png;base64,${s.qrCode}`} alt="QR Code do Pix" className="mx-auto mt-5 size-56 rounded-xl border border-black/10" />
        )}
        {s.pix && <CopiaECola texto={s.pix} />}
        {s.link && (
          <a href={s.link} target="_blank" className="mt-3 inline-block text-sm font-semibold text-couro-700 underline">Abrir a cobrança no navegador</a>
        )}
        <p className="mt-5 flex items-center justify-center gap-2 text-sm text-couro-400">
          <span className="size-2 animate-pulse rounded-full bg-[var(--cor)]" /> Esperando o pagamento. Esta tela atualiza sozinha.
        </p>
        <p className="mt-2 text-xs text-couro-400">Se o Pix não for pago no prazo, o horário volta a ficar livre. Cancelando dentro do prazo do salão, o sinal vira crédito.</p>
        <a href={`/b/${slug}/agendamento/${confirmado.token}`} className="btn-secundario mt-5 w-full">Ver meu agendamento</a>
      </section>
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
        {confirmado.sinal && <p className="mt-2 text-sm font-semibold text-emerald-700">Sinal de {formatarDinheiro(confirmado.sinal.valorCentavos)} recebido. Horário garantido!</p>}
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
            const aPartir = s.variacoes.length > 0 ? Math.min(...s.variacoes.map((v) => v.precoCentavos)) : null;
            const escolha = escolhas[s.id];
            return (
              <div key={s.id}>
              <button onClick={() => alternarServico(s.id)} aria-pressed={marcado} className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${marcado ? "border-[var(--cor)] bg-[var(--cor)]/[0.06]" : "border-black/[0.06] bg-white hover:border-black/15"}`}>
                <span className={`grid size-6 shrink-0 place-items-center rounded-md border-2 ${marcado ? ativo : "border-black/20"}`}>{marcado && <Check className="size-4" strokeWidth={3} />}</span>
                {s.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.foto} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{s.nome}</span>
                  {s.descricao && <span className="line-clamp-2 block text-sm text-couro-400">{s.descricao}</span>}
                  {s.manutencao && <span className="mt-0.5 block text-xs text-couro-700">Manutenção: {s.manutencao}</span>}
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-couro-400"><Clock className="size-3" /> {marcado ? valorItem(s).duracao : s.duracaoMin} min</span>
                </span>
                <span className="shrink-0 text-right">
                  {doPlano ? (
                    <>
                      <span className="block text-xs font-semibold text-emerald-700">No seu plano</span>
                      <span className="text-xs text-couro-400 line-through">{formatarDinheiro(s.precoCentavos)}</span>
                    </>
                  ) : aPartir !== null && !marcado ? (
                    <>
                      <span className="block text-[11px] text-couro-400">a partir de</span>
                      <span className="numero">{formatarDinheiro(aPartir)}</span>
                    </>
                  ) : (
                    <span className="numero">{formatarDinheiro(marcado ? valorItem(s).preco : s.precoCentavos)}</span>
                  )}
                </span>
              </button>
              {marcado && (s.variacoes.length > 0 || s.adicionais.length > 0) && (
                <div className="mx-2 -mt-2 space-y-3 rounded-b-2xl border-2 border-t-0 border-[var(--cor)]/30 bg-[var(--cor)]/[0.03] px-3 pt-4 pb-3">
                  {s.variacoes.length > 0 && (
                    <fieldset>
                      <legend className="mb-1.5 text-xs font-semibold text-couro-700">Escolha o tipo</legend>
                      <div className="flex flex-wrap gap-2">
                        {s.variacoes.map((v) => (
                          <button key={v.id} type="button" onClick={() => escolherVariacao(s.id, v.id)} aria-pressed={escolha?.variacaoId === v.id} className={`rounded-xl border px-3 py-2 text-left text-sm transition ${escolha?.variacaoId === v.id ? ativo : "border-black/10 bg-white"}`}>
                            <span className="block font-semibold">{v.nome}</span>
                            <span className="text-xs opacity-80">{formatarDinheiro(v.precoCentavos)} · {v.duracaoMin} min</span>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  )}
                  {s.adicionais.length > 0 && (
                    <fieldset>
                      <legend className="mb-1.5 text-xs font-semibold text-couro-700">Adicionais</legend>
                      <div className="space-y-1.5">
                        {s.adicionais.map((a) => (
                          <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                            <input type="checkbox" checked={!!escolha?.adicionalIds.includes(a.id)} onChange={() => alternarAdicional(s.id, a.id)} />
                            <span className="flex-1">{a.nome}</span>
                            <span className="text-xs text-couro-400">+{formatarDinheiro(a.precoCentavos)}{a.duracaoMin ? ` · +${a.duracaoMin} min` : ""}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </div>
              )}
              </div>
            );
          })}
        </div>
        {podeSimultaneo && (
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-black/[0.06] bg-white p-3 text-sm">
            <input type="checkbox" checked={simultaneo} onChange={(e) => setSimultaneo(e.target.checked)} className="mt-1" />
            <span>
              <span className="flex items-center gap-1.5 font-semibold"><Users className="size-4 text-[var(--cor)]" /> Fazer tudo ao mesmo tempo</span>
              <span className="block text-couro-400">Cada serviço com uma profissional, começando juntos. Você sai mais cedo.</span>
            </span>
          </label>
        )}
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
            <div className="rounded-2xl bg-fundo p-4 text-sm text-couro-700">
              <p className="text-center">Sem horários livres neste dia. Escolha outro dia acima ou entre na lista de espera.</p>
              {espera.enviado ? (
                <p className="mt-3 rounded-xl bg-emerald-600/10 p-3 text-center font-semibold text-emerald-800">Pronto! Se abrir um horário, o salão te avisa pelo WhatsApp.</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  <select className="input" value={espera.periodo} onChange={(e) => setEspera({ ...espera, periodo: e.target.value })} aria-label="Período">
                    <option value="QUALQUER">Qualquer horário</option>
                    <option value="MANHA">De manhã</option>
                    <option value="TARDE">À tarde</option>
                    <option value="NOITE">À noite</option>
                  </select>
                  {!cliente && (
                    <div className="grid grid-cols-2 gap-2">
                      <input className="input" placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Seu nome" />
                      <input className="input" placeholder="WhatsApp" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} aria-label="WhatsApp" />
                    </div>
                  )}
                  <button onClick={entrarNaEspera} disabled={carregando} className="flex items-center justify-center gap-2 rounded-xl border-2 border-[var(--cor)] bg-white py-2.5 font-semibold text-[var(--cor)] disabled:opacity-50">
                    <BellRing className="size-4" /> Entrar na lista de espera
                  </button>
                  {espera.erro && <p className="text-center text-poste-vermelho">{espera.erro}</p>}
                </div>
              )}
            </div>
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
            {temSinal && (
              <div>
                <label className="label" htmlFor="cpf-cliente">CPF (para o Pix do sinal)</label>
                <input id="cpf-cliente" className="input" inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
              </div>
            )}
            {creditoIndicacao > 0 && (
              <div>
                <label className="label" htmlFor="indicacao">Código de quem te indicou (opcional)</label>
                <input id="indicacao" className="input uppercase" value={indicacao} onChange={(e) => setIndicacao(e.target.value)} placeholder="Ex.: JOANA7K2P" />
                <p className="mt-1 text-xs text-couro-400">Vocês duas ganham {formatarDinheiro(creditoIndicacao)} de crédito no seu primeiro atendimento.</p>
              </div>
            )}
            <p className="text-sm text-couro-400">Já tem conta? <Link href={`/b/${slug}/entrar`} className="font-semibold text-tinta underline">Entrar</Link></p>
            <p className="text-xs text-couro-400">
              Seus dados são usados pelo salão só para o seu atendimento. Veja a{" "}
              <Link href="/privacidade" target="_blank" className="underline">Política de Privacidade</Link>.
            </p>
          </div>
        </Etapa>
      )}

      {cliente && temSinal && hora && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <label className="label" htmlFor="cpf-logado">CPF (para o Pix do sinal)</label>
          <input id="cpf-logado" className="input" inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="Deixe vazio se já informou antes" />
        </section>
      )}

      {/* Resumo fixo no rodapé */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/[0.06] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            {selecionados.length ? (
              <>
                <p className="numero text-lg leading-tight">{formatarDinheiro(total)}</p>
                <p className="truncate text-xs text-couro-400">
                  {selecionados.length} serviço(s) · {duracao} min{emSimultaneo ? " (ao mesmo tempo)" : ""}{cobertos.size ? ` · ${cobertos.size} no plano ${plano?.nome}` : ""}
                </p>
                {temSinal && <p className="truncate text-xs font-semibold text-[var(--cor)]">Sinal de {formatarDinheiro(sinalPrevisto)} por Pix para garantir</p>}
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
            {carregando ? "Agendando..." : temSinal ? "Pagar sinal" : "Confirmar"}
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

function CopiaECola({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(texto).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2500); })}
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor)] py-3 font-semibold text-[var(--cor-texto)]"
    >
      {copiado ? <Check className="size-4" /> : <Copy className="size-4" />} {copiado ? "Copiado!" : "Copiar código Pix (copia e cola)"}
    </button>
  );
}
