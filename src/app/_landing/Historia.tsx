"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";

type Passo = { titulo: string; texto: string; img: string; alt: string; celular?: boolean };

const PASSOS: Passo[] = [
  { titulo: "O cliente agenda sozinho.", texto: "Pelo link na bio do Instagram ou no WhatsApp, ele escolhe a unidade, o profissional, os serviços e o horário. Sem baixar aplicativo e sem você parar o atendimento para responder.", img: "/landing/cel-agendar.webp", alt: "Tela de agendamento no celular do cliente", celular: true },
  { titulo: "A agenda se organiza.", texto: "Cada profissional com a sua coluna, almoço e folgas bloqueados, nenhum horário marcado duas vezes. O que entra pelo site aparece na hora.", img: "/landing/agenda.webp", alt: "Agenda da equipe no painel" },
  { titulo: "Lembrete com um toque.", texto: "A lista de quem vem amanhã já está pronta. Um toque e o WhatsApp abre com a mensagem e o link para o cliente confirmar.", img: "/landing/lembretes.webp", alt: "Tela de lembretes por WhatsApp" },
  { titulo: "O clube cobra todo mês.", texto: "O cliente cadastra o cartão uma vez e a mensalidade é debitada sozinha todo mês. Ele acompanha o plano pelo celular e cancela quando quiser.", img: "/landing/cel-plano.webp", alt: "Plano do cliente no celular", celular: true },
  { titulo: "E você enxerga o resultado.", texto: "Faturamento, ticket médio, comissões, faltas e desempenho por unidade e por profissional, sem planilha.", img: "/landing/relatorios.webp", alt: "Relatórios do painel" },
];

function Imagem({ p }: { p: Passo }) {
  return p.celular ? (
    <div className="lp-celular mx-auto w-[240px] sm:w-[270px]">
      <img src={p.img} alt={p.alt} width={585} height={1266} loading="lazy" className="block w-full" />
    </div>
  ) : (
    <div className="lp-janela w-full">
      <div className="lp-janela-barra"><i /><i /><i /></div>
      <img src={p.img} alt={p.alt} width={1600} height={1000} loading="lazy" className="block w-full" />
    </div>
  );
}

export function Historia() {
  const [ativo, setAtivo] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) if (e.isIntersecting) setAtivo(Number((e.target as HTMLElement).dataset.indice));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
      <div>
        {PASSOS.map((p, i) => (
          <div
            key={p.titulo}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-indice={i}
            className={`lp-passo flex flex-col justify-center py-10 lg:min-h-[78vh] lg:py-0 ${i === ativo ? "lp-ativo" : ""}`}
          >
            <p className="font-mono text-xs text-[var(--lp-cinza)]">0{i + 1} / 0{PASSOS.length}</p>
            <h3 className="lp-titulo mt-3 text-4xl sm:text-5xl">{p.titulo}</h3>
            <p className="mt-4 max-w-md text-lg text-[var(--lp-cinza)]">{p.texto}</p>
            <div className="mt-8 lg:hidden"><Imagem p={p} /></div>
          </div>
        ))}
      </div>
      <div className="hidden lg:block">
        <div className="sticky top-[11vh] h-[78vh]">
          <div className="relative h-full">
            {PASSOS.map((p, i) => (
              <div key={p.titulo} className={`lp-tela ${i === ativo ? "lp-ativa" : ""}`} aria-hidden={i !== ativo}>
                <Imagem p={p} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
