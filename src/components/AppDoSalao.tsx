"use client";

import { Bell, BellOff, Check, Download, Share, SquarePlus, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function ehIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function instalado() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
const ler = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const gravar = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

async function registrarSW() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => null);
}

/** Convite para instalar o app do salão: botão no Android/Chrome, passo a passo no iPhone. */
export function InstalarApp({ slug, nome }: { slug: string; nome: string }) {
  const chave = `app-dispensado:${slug}`;
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [modo, setModo] = useState<"nada" | "android" | "ios">("nada");

  useEffect(() => {
    registrarSW();
    if (instalado() || ler(chave)) return;
    if (ehIos()) setModo("ios");
    const aoOferecer = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
      setModo("android");
    };
    window.addEventListener("beforeinstallprompt", aoOferecer);
    return () => window.removeEventListener("beforeinstallprompt", aoOferecer);
  }, [chave]);

  if (modo === "nada") return null;
  const fechar = () => {
    gravar(chave, "1");
    setModo("nada");
  };
  return (
    <div className="relative rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm" role="region" aria-label="Instalar o app">
      <button onClick={fechar} aria-label="Agora não" className="absolute top-3 right-3 text-couro-400 hover:text-tinta"><X className="size-4" /></button>
      <p className="flex items-center gap-2 pr-6 font-semibold"><Download className="size-5 text-[var(--cor)]" /> Instale o app do {nome}</p>
      {modo === "android" ? (
        <>
          <p className="mt-1 text-sm text-couro-700">Fica na tela inicial do celular, abre direto na sua conta e avisa dos seus horários.</p>
          <button
            onClick={async () => {
              if (!evento) return;
              await evento.prompt();
              const { outcome } = await evento.userChoice;
              if (outcome === "accepted") setModo("nada");
            }}
            className="mt-3 w-full rounded-xl bg-[var(--cor)] py-2.5 font-semibold text-[var(--cor-texto)]"
          >
            Instalar app
          </button>
        </>
      ) : (
        <ol className="mt-2 space-y-1.5 text-sm text-couro-700">
          <li className="flex items-center gap-2">1. Toque em <Share className="size-4 text-[#0a84ff]" /> <strong>Compartilhar</strong>, na barra do Safari</li>
          <li className="flex items-center gap-2">2. Escolha <SquarePlus className="size-4" /> <strong>Adicionar à Tela de Início</strong></li>
          <li>3. Toque em <strong>Adicionar</strong>. Pronto, o app aparece no seu celular.</li>
        </ol>
      )}
    </div>
  );
}

function chaveParaBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(padded);
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

type Inscricao = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Liga ou desliga os lembretes no celular (notificações do app). */
export function LembretesNoCelular({
  chavePublica,
  salvar,
  remover,
}: {
  chavePublica: string;
  salvar: (i: Inscricao) => Promise<{ erro?: string } | void>;
  remover: (endpoint: string) => Promise<void>;
}) {
  const [estado, setEstado] = useState<"carregando" | "indisponivel" | "instalar" | "bloqueado" | "desligado" | "ligado">("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // no iPhone as notificações só existem com o app instalado na tela de início
        return setEstado(ehIos() && !instalado() ? "instalar" : "indisponivel");
      }
      if (Notification.permission === "denied") return setEstado("bloqueado");
      const reg = await registrarSW();
      const atual = await reg?.pushManager.getSubscription();
      setEstado(atual && Notification.permission === "granted" ? "ligado" : "desligado");
    })();
  }, []);

  const ligar = () =>
    iniciar(async () => {
      setErro(null);
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") return setEstado(permissao === "denied" ? "bloqueado" : "desligado");
      const reg = (await registrarSW()) ?? (await navigator.serviceWorker.ready);
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chavePublica) }));
      const r = await salvar(sub.toJSON() as Inscricao);
      if (r && r.erro) return setErro(r.erro);
      setEstado("ligado");
    });

  const desligar = () =>
    iniciar(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await remover(sub.endpoint);
        await sub.unsubscribe();
      }
      setEstado("desligado");
    });

  if (estado === "carregando" || estado === "indisponivel") return null;
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="flex items-center gap-2 font-semibold">
        {estado === "ligado" ? <Check className="size-5 text-emerald-600" /> : <Bell className="size-5 text-[var(--cor)]" />}
        {estado === "ligado" ? "Lembretes no celular ativados" : "Receba lembretes no celular"}
      </p>
      <p className="mt-1 text-sm text-couro-700">
        {estado === "ligado"
          ? "Avisamos aqui um dia antes de cada horário."
          : estado === "instalar"
            ? "No iPhone, instale o app (passo acima) e abra por ele para ativar os lembretes."
            : estado === "bloqueado"
              ? "As notificações estão bloqueadas. Libere nas configurações do navegador para este site."
              : "Um aviso no dia anterior ao seu horário, com o link para confirmar ou remarcar."}
      </p>
      {erro && <p className="mt-2 text-sm text-poste-vermelho">{erro}</p>}
      {estado === "desligado" && (
        <button onClick={ligar} disabled={pendente} className="mt-3 w-full rounded-xl bg-[var(--cor)] py-2.5 font-semibold text-[var(--cor-texto)] disabled:opacity-60">
          {pendente ? "Ativando..." : "Ativar lembretes"}
        </button>
      )}
      {estado === "ligado" && (
        <button onClick={desligar} disabled={pendente} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-couro-400 hover:text-tinta">
          <BellOff className="size-4" /> Desativar
        </button>
      )}
    </div>
  );
}

/** Só registra o service worker (deixa o painel instalável como app). */
export function RegistrarApp() {
  useEffect(() => {
    registrarSW();
  }, []);
  return null;
}
