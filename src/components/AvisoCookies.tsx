"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CHAVE = "aviso-cookies-v1";

/**
 * Aviso de cookies (LGPD). O sistema só usa cookies essenciais (login) e armazenamento local de preferências;
 * não há cookies de publicidade nem de rastreamento, então não há o que recusar: é um aviso, não um pedido de consentimento.
 */
export function AvisoCookies() {
  const [mostrar, setMostrar] = useState(false);
  useEffect(() => {
    try {
      setMostrar(!localStorage.getItem(CHAVE));
    } catch {
      setMostrar(false);
    }
  }, []);
  if (!mostrar) return null;
  const ok = () => {
    try {
      localStorage.setItem(CHAVE, new Date().toISOString());
    } catch {}
    setMostrar(false);
  };
  return (
    <div role="region" aria-label="Aviso de cookies" className="fixed inset-x-3 top-3 z-[60] mx-auto max-w-xl rounded-2xl bg-couro-900 p-4 text-sm text-white shadow-xl sm:flex sm:items-center sm:gap-4">
      <p className="text-white/85">
        Usamos apenas cookies essenciais, para manter você conectado com segurança. Nada de publicidade ou rastreamento.{" "}
        <Link href="/privacidade" className="underline">Política de Privacidade</Link>
      </p>
      <button onClick={ok} className="mt-3 w-full shrink-0 rounded-xl bg-white px-4 py-2 font-semibold text-tinta sm:mt-0 sm:w-auto">Entendi</button>
    </div>
  );
}
