/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Plus, QrCode } from "lucide-react";
import { db } from "@/lib/db";
import { EMPRESA } from "@/lib/empresa";
import { formatarDinheiro, linkWhatsApp } from "@/lib/formato";
import { CODIGOS_PLANO, PLANOS_SISTEMA } from "@/lib/planosSistema";
import { AvisoCookies } from "./_landing/AvisoCookies";
import { Calculadora } from "./_landing/Calculadora";
import { Efeitos } from "./_landing/Efeitos";
import { Historia } from "./_landing/Historia";
import { Logo } from "./_landing/Logo";
import { fontesLanding } from "./_landing/fontes";
import "./_landing/landing.css";


export const metadata: Metadata = {
  title: { absolute: "Klareza Beauty · Sistema para salões" },
  description:
    "Agendamento online, clube de assinatura com cobrança automática, comandas, caixa, estoque, financeiro e lembretes por WhatsApp. Tudo para o seu salão num lugar só.",
  openGraph: {
    title: "Klareza Beauty · Sistema para salões",
    description: "O salão organizado de verdade: agenda online, clube de assinatura e o caixa batendo.",
    type: "website",
    locale: "pt_BR",
    images: ["/landing/agenda.webp"],
  },
};
export const dynamic = "force-dynamic";

const real = (c: number) => formatarDinheiro(c).replace(",00", "");
const atraso = (d: number) => ({ "--d": `${d}s` }) as React.CSSProperties;

const FAIXA = ["Agendamento online", "Clube de assinatura", "Comandas", "Caixa", "Estoque", "Lembretes no WhatsApp", "Relatórios", "Várias unidades"];

const FRASE =
  "Chega de agenda no caderno, de cliente que esquece o horário, de mensalidade que ninguém lembra de cobrar e de caixa que não bate no fim do dia.";

const RECURSOS = [
  { t: "Agendamento online", d: "Link próprio do salão, funciona no celular, sem aplicativo." },
  { t: "Clube de assinatura", d: "Planos mensais cobrados sozinhos no cartão do cliente, todo mês." },
  { t: "Lembretes no WhatsApp", d: "Mensagem pronta com um toque e confirmação por link." },
  { t: "Comandas e caixa", d: "Serviços e produtos, sangria, suprimento e fechamento." },
  { t: "Estoque", d: "Baixa automática na venda e aviso de produto acabando." },
  { t: "Financeiro", d: "Contas a pagar, despesas, comissões e resultado do mês." },
  { t: "Área do cliente", d: "Plano, horários, promoções e clube de vantagens com a sua marca." },
  { t: "Várias unidades", d: "Agenda, caixa e estoque separados, com visão geral do dono." },
];

const PASSOS = [
  { t: "Conversa", d: "Mostramos o sistema funcionando com a realidade do seu salão." },
  { t: "Configuração", d: "Cadastramos com você equipe, serviços, preços, horários e os planos do clube." },
  { t: "No ar", d: "Você coloca o link na bio do Instagram e no WhatsApp e os horários começam a entrar." },
];

const PERGUNTAS = [
  { p: "Meu cliente precisa baixar aplicativo?", r: "Não. Ele agenda e acessa a área dele pelo navegador do celular, a partir do link do seu salão." },
  { p: "Como recebo as mensalidades do clube?", r: "Pelo Asaas, instituição de pagamento autorizada pelo Banco Central. O salão tem a própria conta, e o dinheiro cai direto nela. O cliente cadastra o cartão uma vez e a mensalidade é debitada automaticamente todo mês, até ele cancelar pelo app." },
  { p: "Os lembretes de WhatsApp têm custo?", r: "Não. O sistema monta a mensagem e abre o seu WhatsApp. Você só aperta enviar." },
  { p: "Funciona no celular?", r: "Sim. O painel funciona no celular, no tablet e no computador, e cada profissional pode ter o próprio login." },
  { p: "E os dados dos meus clientes?", r: "Ficam guardados com senha criptografada e conexão segura, e são usados só para o funcionamento do seu salão, como manda a LGPD. Veja a nossa Política de Privacidade." },
  { p: "Como meus clientes encontram a página para agendar?", r: "Pelo link do seu salão na bio do Instagram e no WhatsApp e pelo QR code. Na primeira mensalidade você ganha uma placa de acrílico com o QR code para deixar no balcão." },
  { p: "Posso mudar de plano depois?", r: "Pode. É só falar com a gente que ajustamos o plano conforme o salão cresce." },
];

export default async function Landing() {
  // sem WhatsApp de suporte no /admin, usa o da empresa (o mesmo do rodapé) em vez de mandar para o login
  const suporte = (await db.configSistema.findUnique({ where: { id: "geral" } }).catch(() => null))?.whatsappSuporte ?? EMPRESA.telefone;
  const contato = (msg: string) => (suporte ? linkWhatsApp(suporte, msg) : "/login");
  const alvo = suporte ? { target: "_blank", rel: "noopener" } : {};
  const demo = contato("Olá! Vi o site do Klareza Beauty e quero uma demonstração para o meu salão.");
  const palavras = FRASE.split(" ");

  return (
    <main className={`lp ${fontesLanding} overflow-x-clip`}>
      <Efeitos />
      <div className="lp-progresso fixed inset-x-0 top-0 z-[60] h-[2px] bg-[var(--lp-verde)]" aria-hidden />

      {/* Topo */}
      <header className="sticky top-0 z-50 border-b border-[var(--lp-linha)]/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/" aria-label="Klareza Beauty"><Logo /></Link>
          <nav className="hidden items-center gap-8 text-sm text-[var(--lp-cinza)] md:flex">
            <a href="#como-funciona" className="hover:text-[var(--lp-tinta)]">Como funciona</a>
            <a href="#clube" className="hover:text-[var(--lp-tinta)]">Clube</a>
            <a href="#planos" className="hover:text-[var(--lp-tinta)]">Planos</a>
            <a href="#duvidas" className="hover:text-[var(--lp-tinta)]">Dúvidas</a>
          </nav>
          <div className="flex items-center gap-1 sm:gap-3">
            <Link href="/login" className="px-2 text-sm font-medium text-[var(--lp-cinza)] hover:text-[var(--lp-tinta)]">Entrar</Link>
            <a href={demo} {...alvo} className="lp-btn lp-btn-verde px-4 py-2 text-sm">Demonstração</a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-5 pt-16 sm:pt-24">
        <p className="lp-surge font-mono text-xs tracking-wide text-[var(--lp-cinza)] uppercase" style={atraso(0)}>Sistema de gestão para salões</p>
        <h1 className="lp-titulo mt-6 text-[13vw] sm:text-[88px] lg:text-[112px]">
          <span className="lp-linha-mascara"><span style={atraso(0.05)}>O salão</span></span>
          <span className="lp-linha-mascara"><span style={atraso(0.15)}>organizado</span></span>
          <span className="lp-linha-mascara"><span style={atraso(0.25)}><span className="lp-serifa text-[var(--lp-verde)]">de verdade.</span></span></span>
        </h1>
        <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <p className="lp-surge max-w-xl text-lg text-[var(--lp-cinza)] sm:text-xl" style={atraso(0.5)}>
            Agenda online, clube de assinatura com cobrança automática, comandas, estoque e financeiro. Tudo o que o seu salão precisa, num lugar só.
          </p>
          <div className="lp-surge flex flex-wrap items-center gap-3" style={atraso(0.65)}>
            <a href={demo} {...alvo} className="lp-btn lp-btn-verde">Agendar demonstração <ArrowRight className="lp-seta size-4" /></a>
          </div>
        </div>
      </section>

      <section className="lp-palco relative mx-auto mt-16 max-w-7xl px-5 sm:mt-20">
        <div data-inclina className="lp-inclina lp-janela">
          <div className="lp-janela-barra"><i /><i /><i /><span className="ml-3 text-[11px] text-[var(--lp-cinza)]">klarezabeauty · painel</span></div>
          <img src="/landing/inicio.webp" alt="Painel do Klareza Beauty com o resumo do dia" width={1600} height={1000} className="block w-full" fetchPriority="high" />
        </div>
        <div data-paralaxe="0.1" className="lp-paralaxe absolute -bottom-10 right-2 w-[30%] max-w-[250px] sm:right-10 lg:-bottom-16">
          <div className="lp-celular"><img src="/landing/cel-conta.webp" alt="Área do cliente no celular" width={585} height={1266} className="block w-full" /></div>
        </div>
      </section>

      {/* Faixa */}
      <section className="lp-faixa-wrap mt-32 overflow-hidden border-y border-[var(--lp-linha)] py-6 sm:mt-52" aria-label="Recursos">
        <div className="lp-faixa">
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0 items-center" aria-hidden={k === 1}>
              {FAIXA.map((t, i) => (
                <span key={t} className="flex items-center">
                  <span className={`lp-titulo px-6 text-4xl whitespace-nowrap sm:text-6xl ${i % 2 ? "lp-contorno" : ""}`}>{t}</span>
                  <span className="text-2xl text-[var(--lp-verde)]">✳</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Frase */}
      <section className="mx-auto max-w-6xl px-5 py-28 sm:py-40">
        <p data-palavras className="lp-palavras lp-titulo text-[9vw] leading-[1.05] sm:text-6xl lg:text-7xl" style={{ "--n": palavras.length } as React.CSSProperties}>
          {palavras.map((w, i) => (
            <span key={i} style={{ "--i": i } as React.CSSProperties}>{w} </span>
          ))}
        </p>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="scroll-mt-20 border-t border-[var(--lp-linha)]">
        <div className="mx-auto max-w-7xl px-5 pt-20">
          <p className="font-mono text-xs tracking-wide text-[var(--lp-cinza)] uppercase">Como funciona no dia a dia</p>
          <Historia />
        </div>
      </section>

      {/* Clube */}
      <section id="clube" className="scroll-mt-16 bg-[var(--lp-verde)] text-white">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 py-24 sm:py-32 lg:grid-cols-2 lg:items-center">
          <div data-revela>
            <p className="font-mono text-xs tracking-wide text-white/60 uppercase">Clube de assinatura</p>
            <h2 className="lp-titulo mt-5 text-5xl sm:text-7xl">
              Receita que entra <span className="lp-serifa">todo mês.</span>
            </h2>
            <p className="mt-6 max-w-lg text-lg text-white/75">
              Monte planos como “escova ilimitada” ou “mãos e pés”. O cliente assina pelo celular, cadastra o cartão uma vez e a mensalidade é cobrada sozinha todo mês. Mesmo na semana de agenda fraca, o dinheiro entra.
            </p>
          </div>
          <div data-revela style={atraso(0.15)}><Calculadora /></div>
        </div>
      </section>

      {/* Recursos */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:py-32">
        <div data-revela className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <h2 className="lp-titulo max-w-3xl text-5xl sm:text-7xl">Tudo incluso, <span className="lp-serifa text-[var(--lp-verde)]">do Bairro em diante.</span></h2>
          <p className="max-w-sm text-[var(--lp-cinza)]">Sem módulo extra, sem cobrança por profissional: muda só o número de unidades e de assinantes. O Solo, para quem atende sozinha, não tem clube, comissões, financeiro nem sinal por Pix.</p>
        </div>
        <div className="mt-14 grid border-t border-l border-[var(--lp-linha)] sm:grid-cols-2 lg:grid-cols-4">
          {RECURSOS.map((r, i) => (
            <div key={r.t} data-revela style={atraso((i % 4) * 0.07)} className="lp-recurso border-r border-b border-[var(--lp-linha)] p-6 sm:p-7">
              <p className="font-mono text-xs opacity-60">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-10 text-xl font-semibold tracking-tight">{r.t}</p>
              <p className="lp-recurso-desc mt-2 text-sm text-[var(--lp-cinza)] transition-colors">{r.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como começar */}
      <section className="bg-[var(--lp-suave)]">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:py-32">
          <h2 data-revela className="lp-titulo max-w-3xl text-5xl sm:text-7xl">Você não configura <span className="lp-serifa text-[var(--lp-verde)]">nada sozinho.</span></h2>
          <ol className="mt-14 grid gap-px overflow-hidden rounded-3xl bg-[var(--lp-linha)] md:grid-cols-3">
            {PASSOS.map((p, i) => (
              <li key={p.t} data-revela style={atraso(i * 0.1)} className="bg-white p-8">
                <span className="lp-titulo text-7xl text-[var(--lp-verde)]">{i + 1}</span>
                <p className="mt-6 text-xl font-semibold tracking-tight">{p.t}</p>
                <p className="mt-2 text-[var(--lp-cinza)]">{p.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="mx-auto max-w-7xl scroll-mt-16 px-5 py-24 sm:py-32">
        <h2 data-revela className="lp-titulo text-5xl sm:text-7xl">Planos</h2>
        <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CODIGOS_PLANO.map((c, i) => {
            const p = PLANOS_SISTEMA[c];
            const forte = c === "CIDADE";
            return (
              <div
                key={c}
                data-revela
                style={atraso(i * 0.1)}
                className={`flex flex-col rounded-3xl p-8 ${forte ? "bg-[var(--lp-tinta)] text-white" : "border border-[var(--lp-linha)]"}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xl font-semibold">{p.nome}</p>
                  {forte && <span className="rounded-full bg-white/10 px-3 py-1 text-xs">Para 2 unidades</span>}
                </div>
                <p className="lp-titulo mt-8 text-5xl">
                  {real(p.mensal)}
                  <span className={`ml-1 font-sans text-base font-normal tracking-normal ${forte ? "text-white/60" : "text-[var(--lp-cinza)]"}`}>/mês</span>
                </p>
                <p className={`mt-2 text-sm ${forte ? "text-white/60" : "text-[var(--lp-cinza)]"}`}>
                  ou {real(p.anual)}/ano, {real(p.mensal * 12 - p.anual)} de economia
                </p>
                <ul className={`mt-8 flex-1 space-y-3 border-t pt-6 ${forte ? "border-white/15" : "border-[var(--lp-linha)]"}`}>
                  <li>{p.unidades === null ? "Unidades ilimitadas" : p.unidades === 1 ? "1 unidade" : `${p.unidades} unidades`}</li>
                  {p.recursos.clube ? (
                    <li>{p.assinantes === null ? "Assinantes ilimitados no clube" : `Até ${p.assinantes} assinantes no clube`}</li>
                  ) : (
                    <li className={forte ? "text-white/60" : "text-[var(--lp-cinza)]"}>Sem clube de assinatura, comissões e financeiro</li>
                  )}
                  {p.recursos.clube && <li>Todos os recursos inclusos</li>}
                  <li>{p.profissionais === null ? "Equipe ilimitada" : "1 profissional (autônoma)"}</li>
                  <li className="font-medium">+ Placa de acrílico com QR code (brinde)</li>
                </ul>
                <a
                  href={contato(`Olá! Tenho interesse no plano ${p.nome} do Klareza Beauty.`)}
                  {...alvo}
                  className={`lp-btn mt-8 w-full ${forte ? "bg-white text-[var(--lp-tinta)] hover:bg-white/90" : "lp-btn-linha"}`}
                >
                  Quero o {p.nome} <ArrowRight className="lp-seta size-4" />
                </a>
              </div>
            );
          })}
        </div>
        <div data-revela className="mt-6 flex flex-col gap-4 rounded-3xl bg-[var(--lp-verde-claro)] p-6 sm:flex-row sm:items-center sm:p-8">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[var(--lp-verde)] text-white"><QrCode className="size-7" /></span>
          <div>
            <p className="text-xl font-semibold tracking-tight">Brinde na primeira mensalidade: placa de acrílico com QR code.</p>
            <p className="mt-1 text-[var(--lp-cinza)]">Fica no balcão do salão. O cliente aponta a câmera do celular e já cai na página para agendar.</p>
          </div>
        </div>
      </section>

      {/* Dúvidas */}
      <section id="duvidas" className="scroll-mt-16 border-t border-[var(--lp-linha)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-24 sm:py-32 lg:grid-cols-[0.8fr_1.2fr]">
          <h2 data-revela className="lp-titulo text-5xl sm:text-7xl">Dúvidas</h2>
          <div className="border-t border-[var(--lp-linha)]">
            {PERGUNTAS.map((q) => (
              <details key={q.p} className="group border-b border-[var(--lp-linha)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-lg font-medium sm:text-xl">
                  {q.p}
                  <Plus className="lp-mais size-5 shrink-0" />
                </summary>
                <p className="-mt-2 max-w-2xl pb-6 text-[var(--lp-cinza)]">
                  {q.r}
                  {q.p.includes("dados") && (
                    <>
                      {" "}
                      <Link href="/privacidade" className="text-[var(--lp-tinta)] underline underline-offset-2">Política de Privacidade</Link>
                    </>
                  )}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Chamada final */}
      <section className="bg-[var(--lp-tinta)] text-white">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:py-36">
          <h2 data-revela className="lp-titulo text-[14vw] sm:text-[120px] lg:text-[150px]">
            Bora <span className="lp-serifa text-[#e7a3c3]">conversar?</span>
          </h2>
          <div data-revela style={atraso(0.15)} className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-lg text-white/70">A gente mostra o sistema funcionando com os serviços e os preços do seu salão.</p>
            <a href={demo} {...alvo} className="lp-btn bg-white px-8 py-4 text-base text-[var(--lp-tinta)] hover:bg-[#e7a3c3]">
              Falar no WhatsApp <ArrowUpRight className="size-5" />
            </a>
          </div>
        </div>
        <footer className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 text-sm text-white/60 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Logo claro />
              <p className="mt-3">
                Um produto da {EMPRESA.proprietaria}
                {EMPRESA.cnpj ? ` · CNPJ ${EMPRESA.cnpj}` : ""}
              </p>
              {EMPRESA.email && <p className="mt-1">{EMPRESA.email}</p>}
              {EMPRESA.telefone && <p className="mt-1">WhatsApp ({EMPRESA.telefone.slice(0, 2)}) {EMPRESA.telefone.slice(2, -4)}-{EMPRESA.telefone.slice(-4)} · Curitiba/PR</p>}
            </div>
            <nav className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-3">
              <Link href="/login" className="hover:text-white">Entrar no painel</Link>
              <Link href="/saloes" className="hover:text-white">Sou cliente de um salão</Link>
              <Link href="/privacidade" className="hover:text-white">Política de Privacidade</Link>
              <Link href="/termos" className="hover:text-white">Termos de Uso</Link>
              <Link href="/privacidade#direitos" className="hover:text-white">Seus dados (LGPD)</Link>
            </nav>
          </div>
          <p className="mx-auto max-w-7xl px-5 pb-10 text-xs text-white/40">© {new Date().getFullYear()} {EMPRESA.proprietaria}. {EMPRESA.marca} é uma marca da {EMPRESA.proprietaria}. Imagens do sistema com dados de demonstração.</p>
        </footer>
      </section>

      <AvisoCookies />
    </main>
  );
}
