"use client";

import { startTransition, useActionState } from "react";
import { Marca } from "@/components/Marca";
import { entrar } from "./actions";

export default function Login() {
  const [erro, acao, enviando] = useActionState(entrar, null);

  // Envia via onSubmit para o React não limpar o e-mail quando a senha está errada.
  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    startTransition(() => acao(dados));
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-couro-900 lg:block">
        <div className="poste absolute top-0 bottom-0 left-16 w-3 opacity-90" aria-hidden />
        <div className="absolute top-12 left-28"><Marca tamanho="md" clara /></div>
        <div className="absolute right-12 bottom-12 left-28 text-white">
          <p className="font-display text-4xl leading-tight font-bold">A agenda, o caixa e os clientes do salão num lugar só.</p>
          <p className="mt-4 text-couro-300">Agendamento online, comandas, comissões, estoque e clube de assinatura.</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={enviar} className="w-full max-w-sm">
          <div className="mb-8"><Marca tamanho="md" /></div>
          <h1 className="titulo">Entrar no painel</h1>
          <p className="mt-1 mb-8 text-sm text-couro-400">Use o e-mail e a senha que o salão recebeu.</p>
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="email">E-mail</label>
              <input className="input" id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div>
              <label className="label" htmlFor="senha">Senha</label>
              <input className="input" id="senha" name="senha" type="password" required autoComplete="current-password" />
            </div>
            {erro && <p className="text-sm text-poste-vermelho">{erro}</p>}
            <button className="btn-primario w-full py-3" disabled={enviando}>
              {enviando ? "Entrando..." : "Entrar"}
            </button>
          </div>
          <p className="mt-8 text-center text-xs text-couro-400">
            <a href="/termos" className="hover:text-tinta">Termos de Uso</a> · <a href="/privacidade" className="hover:text-tinta">Política de Privacidade</a>
            <span className="mt-1 block">Klareza Beauty é propriedade da Rotta Digital</span>
          </p>
        </form>
      </div>
    </main>
  );
}
