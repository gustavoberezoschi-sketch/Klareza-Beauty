import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarCheck, Clock, Crown, Instagram, MapPin, MessageCircle, Star, UserRound } from "lucide-react";
import { InstalarApp } from "@/components/AppDaSalao";
import { Carrossel } from "@/components/Carrossel";
import { clienteLogado } from "@/lib/clienteAuth";
import { db } from "@/lib/db";
import { corDoTexto, formatarDinheiro, linkWhatsApp } from "@/lib/formato";
import { estiloDaMarca } from "@/lib/publico";
import { NOMES_DIAS, diaDaSemana, diaLocal, horaLocal } from "@/lib/tempo";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await db.salao.findUnique({ where: { slug: (await params).slug }, select: { nome: true, descricao: true } });
  return b
    ? { title: { absolute: `${b.nome} · Agende seu horário` }, description: b.descricao ?? `Agende seu horário na ${b.nome}.` }
    : { title: "Salão não encontrada" };
}

export default async function PaginaPublica({ params }: Props) {
  const { slug } = await params;
  if (await clienteLogado(slug)) redirect(`/b/${slug}/conta`);
  const b = await db.salao.findUnique({
    where: { slug },
    include: {
      filiais: { where: { ativo: true }, include: { horarios: true }, orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }] },
      servicos: { where: { ativo: true, exibirOnline: true }, orderBy: [{ categoria: "asc" }, { precoCentavos: "asc" }] },
      profissionais: { where: { ativo: true, filial: { ativo: true } }, include: { filial: { select: { nome: true } } }, orderBy: [{ destaque: "desc" }, { nome: "asc" }] },
      planos: { where: { ativo: true, exibirOnline: true }, include: { servicos: { select: { nome: true } } }, orderBy: { precoCentavos: "asc" } },
      banners: { orderBy: { ordem: "asc" } },
    },
  });
  if (!b) notFound();

  const hoje = diaLocal();
  const agora = horaLocal(new Date());
  const variasFiliais = b.filiais.length > 1;
  // Status "aberto agora" considera a unidade principal (ou qualquer uma aberta, se houver várias).
  const hojeDe = (f: (typeof b.filiais)[number]) => f.horarios.find((h) => h.diaSemana === diaDaSemana(hoje));
  const abertas = b.filiais.filter((f) => { const h = hojeDe(f); return h && agora >= h.abre && agora < h.fecha; });
  const hojeHorario = b.filiais[0] ? hojeDe(b.filiais[0]) : undefined;
  const abertoAgora = abertas.length > 0;
  const cor = b.corDestaque;
  const categorias = [...new Set(b.servicos.map((s) => s.categoria))];

  return (
    <main className="min-h-screen bg-[#f6f5f3] pb-28" style={estiloDaMarca(cor)}>
      <header className="relative">
        <div className="relative h-44 w-full overflow-hidden bg-couro-900 sm:h-60">
          {b.capa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.capa} alt="" className="size-full object-cover" />
          ) : (
            <div className="size-full" style={{ backgroundImage: `repeating-linear-gradient(-45deg, ${cor}22 0 18px, transparent 18px 36px)` }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-couro-950/70 via-couro-950/10 to-transparent" />
          <Link href={`/b/${slug}/entrar`} className="absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-2 text-sm font-semibold backdrop-blur hover:bg-white">
            <UserRound className="size-4" /> Entrar
          </Link>
        </div>
        <div className="mx-auto -mt-14 max-w-3xl px-4">
          <div className="relative rounded-3xl bg-white p-5 shadow-[0_10px_40px_-12px_rgba(20,16,14,0.25)] sm:p-6">
            <div className="flex items-start gap-4">
              {b.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.logo} alt={`Logo ${b.nome}`} className="-mt-12 size-20 shrink-0 rounded-2xl border-4 border-white object-cover shadow-md sm:size-24" />
              ) : (
                <span className="-mt-12 grid size-20 shrink-0 place-items-center rounded-2xl border-4 border-white font-display text-3xl font-bold shadow-md sm:size-24" style={{ background: cor, color: corDoTexto(cor) }}>
                  {b.nome[0]}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-2xl leading-tight font-bold sm:text-3xl">{b.nome}</h1>
                <p className="mt-1 flex items-center gap-1.5 text-sm">
                  <span className={`size-2 rounded-full ${abertoAgora ? "bg-emerald-500" : "bg-couro-300"}`} />
                  {variasFiliais
                    ? `${b.filiais.length} unidades${abertoAgora ? ` · ${abertas.length} aberta(s) agora` : ""}`
                    : abertoAgora ? `Aberto agora · fecha às ${hojeHorario!.fecha}` : hojeHorario ? `Hoje das ${hojeHorario.abre} às ${hojeHorario.fecha}` : "Fechado hoje"}
                </p>
              </div>
            </div>
            {b.descricao && <p className="mt-4 text-[15px] leading-relaxed text-couro-700">{b.descricao}</p>}
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {!variasFiliais && (b.filiais[0]?.endereco ?? b.endereco) && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.filiais[0]?.endereco ?? b.endereco ?? "")}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-full bg-fundo px-3 py-1.5 hover:bg-black/[0.06]">
                  <MapPin className="size-4" /> {b.filiais[0]?.endereco ?? b.endereco}
                </a>
              )}
              {b.telefone && (
                <a href={linkWhatsApp(b.telefone)} target="_blank" className="inline-flex items-center gap-1.5 rounded-full bg-fundo px-3 py-1.5 hover:bg-black/[0.06]">
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              )}
              {b.instagram && (
                <a href={`https://instagram.com/${b.instagram}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-full bg-fundo px-3 py-1.5 hover:bg-black/[0.06]">
                  <Instagram className="size-4" /> @{b.instagram}
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-10 px-4 pt-6">
        {b.suspensa && (
          <p className="rounded-2xl bg-white p-5 text-center text-couro-700 shadow-sm">O agendamento online está indisponível no momento. Fale com o salão pelo WhatsApp.</p>
        )}
        {!b.suspensa && <InstalarApp slug={slug} nome={b.nome} />}
        {b.banners.length > 0 && <Carrossel banners={b.banners} />}

        {b.profissionais.length > 0 && (
          <section>
            <h2 className="mb-4 font-display text-xl font-bold">Profissionais</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {b.profissionais.map((x) => (
                <div key={x.id} className="text-center">
                  <div className="relative aspect-square overflow-hidden rounded-2xl bg-fundo">
                    {x.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={x.foto} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="grid size-full place-items-center text-couro-300"><UserRound className="size-10" /></span>
                    )}
                    {x.destaque && (
                      <span className="absolute right-0 bottom-0 flex items-center gap-1 rounded-tl-lg bg-poste-azul px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        <Star className="size-3 fill-current" /> Destaque
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm leading-tight font-semibold">{x.nome}</p>
                  {variasFiliais && <p className="text-xs text-couro-400">{x.filial.nome}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {b.servicos.length > 0 && (
          <section>
            <h2 className="mb-4 font-display text-xl font-bold">Serviços</h2>
            {categorias.map((cat) => (
              <div key={cat} className="mb-4">
                {categorias.length > 1 && <p className="rotulo mb-2">{cat}</p>}
                <ul className="divide-y divide-black/[0.05] overflow-hidden rounded-2xl bg-white shadow-sm">
                  {b.servicos.filter((s) => s.categoria === cat).map((s) => (
                    <li key={s.id} className="flex items-center gap-3 p-3">
                      {s.foto && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.foto} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{s.nome}</p>
                        {s.descricao && <p className="line-clamp-2 text-sm text-couro-400">{s.descricao}</p>}
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-couro-400"><Clock className="size-3" /> {s.duracaoMin} min</p>
                      </div>
                      <p className="numero shrink-0">{formatarDinheiro(s.precoCentavos)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {b.planos.length > 0 && (
          <section>
            <h2 className="mb-1 flex items-center gap-2 font-display text-xl font-bold"><Crown className="size-5" style={{ color: cor }} /> Clube de assinatura</h2>
            <p className="mb-4 text-sm text-couro-400">Pague um valor fixo por mês e venha quando quiser.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {b.planos.map((p) => (
                <div key={p.id} className="rounded-2xl border-2 bg-white p-5" style={{ borderColor: cor }}>
                  <p className="font-display text-lg font-bold">{p.nome}</p>
                  <p className="numero mt-1 text-3xl">{formatarDinheiro(p.precoCentavos)}<span className="text-sm font-normal text-couro-400">/mês</span></p>
                  <p className="mt-2 text-sm text-couro-700">{p.descricao ?? p.servicos.map((s) => s.nome).join(", ")}</p>
                  <p className="mt-1 text-xs text-couro-400">{p.usosPorMes ? `Até ${p.usosPorMes} vez(es) por mês` : "Uso ilimitado"}</p>
                  {b.telefone && (
                    <a href={linkWhatsApp(b.telefone, `Olá! Quero assinar o plano ${p.nome} da ${b.nome}.`)} target="_blank" className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[var(--cor)] px-4 py-2.5 text-sm font-semibold text-[var(--cor-texto)]">
                      Quero assinar
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
            {variasFiliais ? <><MapPin className="size-5" /> Unidades</> : <><Clock className="size-5" /> Horários</>}
          </h2>
          <div className={variasFiliais ? "grid gap-3 sm:grid-cols-2" : ""}>
            {b.filiais.map((f) => (
              <div key={f.id} className="rounded-2xl bg-white p-4 text-sm shadow-sm">
                {variasFiliais && (
                  <div className="mb-3">
                    <p className="font-display text-base font-bold">{f.nome}</p>
                    {f.endereco && (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.endereco)}`} target="_blank" className="text-couro-400 underline">{f.endereco}</a>
                    )}
                    {f.telefone && (
                      <a href={linkWhatsApp(f.telefone)} target="_blank" className="mt-1 flex items-center gap-1 font-medium"><MessageCircle className="size-3.5" /> WhatsApp da unidade</a>
                    )}
                  </div>
                )}
                <ul className="space-y-1.5">
                  {NOMES_DIAS.map((nome, d) => {
                    const h = f.horarios.find((x) => x.diaSemana === d);
                    return (
                      <li key={d} className={`flex justify-between ${d === diaDaSemana(hoje) ? "font-semibold" : ""}`}>
                        <span>{nome}</span>
                        <span className="tabular-nums text-couro-700">{h ? `${h.abre} às ${h.fecha}` : "Fechado"}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>

      <p className="mt-12 text-center text-xs text-couro-400">
        Agendamento online por <span className="font-semibold">Klareza<span className="text-latao-600">Beauty</span></span>
        {" · "}
        <Link href="/privacidade" className="hover:text-tinta">Privacidade</Link>
        {" · "}
        <Link href="/termos" className="hover:text-tinta">Termos</Link>
      </p>

      <div className={`fixed inset-x-0 bottom-0 z-20 border-t border-black/[0.06] bg-white/95 p-3 backdrop-blur ${b.suspensa ? "hidden" : ""}`}>
        <div className="mx-auto max-w-3xl">
          <Link href={`/b/${slug}/agendar`} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--cor)] py-3.5 font-bold text-[var(--cor-texto)] shadow-sm">
            <CalendarCheck className="size-5" /> Agendar horário
          </Link>
        </div>
      </div>
    </main>
  );
}
