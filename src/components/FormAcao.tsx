"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import type { Resultado } from "@/app/painel/actions";

type Props = {
  acao: (estado: Resultado, form: FormData) => Promise<Resultado>;
  children: React.ReactNode;
  className?: string;
  /** Limpa o formulário depois de salvar com sucesso (útil para "novo item"). */
  limparAoSalvar?: boolean;
};

/**
 * Formulário que mostra a mensagem de erro/sucesso devolvida pela server action.
 * Envia via onSubmit para que o React não apague o que foi digitado quando há erro.
 */
export function FormAcao({ acao, children, className, limparAoSalvar }: Props) {
  const [estado, executar, enviando] = useActionState(acao, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok && limparAoSalvar) ref.current?.reset();
  }, [estado, limparAoSalvar]);

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    startTransition(() => executar(dados));
  }

  return (
    <form ref={ref} onSubmit={enviar} className={className}>
      <fieldset disabled={enviando} className="contents">
        {children}
      </fieldset>
      {estado?.erro && <p className="col-span-full text-sm text-rose-700">{estado.erro}</p>}
      {estado?.ok && <p className="col-span-full text-sm text-emerald-700">{estado.ok}</p>}
    </form>
  );
}
