"use client";

import Link from "next/link";
import { useState } from "react";
import { FormAcao } from "@/components/FormAcao";
import { criarConta, entrar } from "../conta/actions";

export function Acesso({ slug, abaInicial }: { slug: string; abaInicial: "entrar" | "criar" }) {
  const [aba, setAba] = useState(abaInicial);
  const botao = "w-full rounded-2xl bg-[var(--cor)] py-3.5 font-bold text-[var(--cor-texto)] shadow-sm disabled:opacity-50";
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="mb-5 grid grid-cols-2 rounded-2xl bg-fundo p-1" role="tablist">
        {(["entrar", "criar"] as const).map((a) => (
          <button key={a} role="tab" aria-selected={aba === a} onClick={() => setAba(a)} className={`rounded-xl py-2 text-sm font-semibold transition ${aba === a ? "bg-white shadow-sm" : "text-couro-400"}`}>
            {a === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>
      {aba === "entrar" ? (
        <FormAcao key="entrar" acao={entrar.bind(null, slug)} className="space-y-3">
          <div><label className="label" htmlFor="tel-login">WhatsApp com DDD</label><input id="tel-login" name="telefone" className="input" inputMode="tel" autoComplete="tel" required /></div>
          <div><label className="label" htmlFor="senha-login">Senha</label><input id="senha-login" name="senha" type="password" className="input" autoComplete="current-password" required /></div>
          <button className={botao}>Entrar</button>
          <p className="text-center text-xs text-couro-400">Esqueceu a senha? Peça para o salão redefinir pelo WhatsApp.</p>
        </FormAcao>
      ) : (
        <FormAcao key="criar" acao={criarConta.bind(null, slug)} className="space-y-3">
          <div><label className="label" htmlFor="nome-conta">Seu nome</label><input id="nome-conta" name="nome" className="input" autoComplete="name" required /></div>
          <div><label className="label" htmlFor="tel-conta">WhatsApp com DDD</label><input id="tel-conta" name="telefone" className="input" inputMode="tel" autoComplete="tel" required /></div>
          <div><label className="label" htmlFor="senha-conta">Crie uma senha</label><input id="senha-conta" name="senha" type="password" className="input" autoComplete="new-password" minLength={8} required /><span className="mt-1 block text-xs text-couro-400">Mínimo de 8 caracteres.</span></div>
          <label className="flex items-start gap-2 text-xs text-couro-700">
            <input type="checkbox" name="aceite" required className="mt-0.5" />
            <span>
              Li e aceito os <Link href="/termos" target="_blank" className="underline">Termos de Uso</Link> e a{" "}
              <Link href="/privacidade" target="_blank" className="underline">Política de Privacidade</Link>.
            </span>
          </label>
          <button className={botao}>Criar conta</button>
          <p className="text-center text-xs text-couro-400">Já foi atendido aqui? Peça no balcão para liberarem seu acesso: seu histórico vem junto.</p>
        </FormAcao>
      )}
    </div>
  );
}
