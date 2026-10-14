"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CHAVE = "klareza-aviso-cookies";

/** Aviso de cookies: o site usa só cookies essenciais (login), sem rastreamento. */
export function AvisoCookies() {
  const [mostrar, setMostrar] = useState(false);
  useEffect(() => {
    try {
      setMostrar(!localStorage.getItem(CHAVE));
    } catch {
      setMostrar(true);
    }
  }, []);
  if (!mostrar) return null;
  const fechar = () => {
    try {
      localStorage.setItem(CHAVE, "1");
    } catch {}
    setMostrar(false);
  };
  return (
    <div role="region" aria-label="Aviso de cookies" className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-[#e7e6e1] bg-white p-3 text-xs text-[#0f0f0e] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.35)] sm:p-4 sm:text-sm">
      <p className="flex-1 text-[#6b6b66]">
        Usamos só cookies essenciais, para o login funcionar. Nada de rastreamento.{" "}
        <Link href="/privacidade#cookies" className="font-medium text-[#0f0f0e] underline underline-offset-2">Saiba mais</Link>
      </p>
      <button onClick={fechar} className="shrink-0 rounded-full bg-[#0f0f0e] px-4 py-2 font-semibold text-white">Entendi</button>
    </div>
  );
}
