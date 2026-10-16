"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Eraser } from "lucide-react";
import { salvarFichaPeloCliente } from "./actions";

type Pergunta = readonly [string, string];

export function Ficha({
  slug,
  token,
  simNao,
  textos,
  termo,
  nomeInicial,
}: {
  slug: string;
  token: string;
  simNao: readonly Pergunta[];
  textos: readonly Pergunta[];
  termo: string;
  nomeInicial: string;
}) {
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [nome, setNome] = useState(nomeInicial);
  const [aceite, setAceite] = useState(false);
  const [assinou, setAssinou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, iniciar] = useTransition();
  const canvas = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);

  // quadro de assinatura (dedo ou mouse)
  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    const escala = window.devicePixelRatio || 1;
    c.width = c.clientWidth * escala;
    c.height = c.clientHeight * escala;
    ctx.scale(escala, escala);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a1216";
    const ponto = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const comecar = (e: PointerEvent) => {
      desenhando.current = true;
      c.setPointerCapture(e.pointerId);
      const [x, y] = ponto(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const mover = (e: PointerEvent) => {
      if (!desenhando.current) return;
      const [x, y] = ponto(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      setAssinou(true);
    };
    const parar = () => (desenhando.current = false);
    c.addEventListener("pointerdown", comecar);
    c.addEventListener("pointermove", mover);
    c.addEventListener("pointerup", parar);
    c.addEventListener("pointerleave", parar);
    return () => {
      c.removeEventListener("pointerdown", comecar);
      c.removeEventListener("pointermove", mover);
      c.removeEventListener("pointerup", parar);
      c.removeEventListener("pointerleave", parar);
    };
  }, []);

  function limpar() {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setAssinou(false);
  }

  function enviar() {
    setErro(null);
    if (!assinou) return setErro("Assine no quadro antes de enviar.");
    const assinatura = canvas.current!.toDataURL("image/png");
    iniciar(async () => {
      const r = await salvarFichaPeloCliente(slug, token, { respostas, nome, assinatura, aceite });
      if (r.ok) setEnviado(true);
      else setErro(r.erro ?? "Não foi possível enviar.");
    });
  }

  if (enviado)
    return (
      <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--cor)] text-[var(--cor-texto)]"><Check className="size-7" strokeWidth={3} /></span>
        <h1 className="mt-4 font-display text-2xl font-bold">Ficha enviada</h1>
        <p className="mt-2 text-couro-700">Obrigado! A profissional já vai ver suas respostas antes do atendimento.</p>
        <Link href={`/b/${slug}/agendamento/${token}`} className="btn-secundario mt-5 w-full">Voltar ao meu agendamento</Link>
      </div>
    );

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="space-y-2">
          {simNao.map(([campo, pergunta]) => (
            <fieldset key={campo} className="rounded-2xl bg-fundo px-3 py-2.5">
              <legend className="sr-only">{pergunta}</legend>
              <p className="text-sm font-medium">{pergunta}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[["nao", "Não"], ["sim", "Sim"]].map(([v, rotulo]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRespostas((r) => ({ ...r, [campo]: v }))}
                    aria-pressed={respostas[campo] === v}
                    className={`rounded-xl border py-2 text-sm font-semibold ${respostas[campo] === v ? "border-[var(--cor)] bg-[var(--cor)] text-[var(--cor-texto)]" : "border-black/10 bg-white"}`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {textos.map(([campo, rotulo]) => (
            <div key={campo}>
              <label className="label" htmlFor={`f-${campo}`}>{rotulo}</label>
              <textarea id={`f-${campo}`} rows={2} maxLength={500} className="input" value={respostas[campo] ?? ""} onChange={(e) => setRespostas((r) => ({ ...r, [campo]: e.target.value }))} placeholder="Deixe em branco se não tiver" />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="font-display font-bold">Termo de consentimento</p>
        <p className="mt-2 text-sm text-couro-700">{termo}</p>
        <div className="mt-4">
          <label className="label" htmlFor="f-nome">Seu nome completo</label>
          <input id="f-nome" className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <span className="label">Sua assinatura</span>
            <button type="button" onClick={limpar} className="flex items-center gap-1 text-xs font-semibold text-couro-400"><Eraser className="size-3.5" /> Limpar</button>
          </div>
          <canvas ref={canvas} className="h-40 w-full touch-none rounded-2xl border-2 border-dashed border-black/15 bg-white" aria-label="Quadro para assinar com o dedo" />
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5" />
          <span>Li e concordo com o termo acima.</span>
        </label>
      </section>

      {erro && <p className="rounded-xl bg-poste-vermelho/10 p-3 text-sm text-poste-vermelho">{erro}</p>}
      <button onClick={enviar} disabled={enviando} className="w-full rounded-2xl bg-[var(--cor)] py-3.5 font-bold text-[var(--cor-texto)] disabled:opacity-50">
        {enviando ? "Enviando..." : "Enviar ficha"}
      </button>
    </div>
  );
}
