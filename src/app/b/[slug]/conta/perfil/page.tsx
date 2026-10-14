import type { Metadata } from "next";
import { FormAcao } from "@/components/FormAcao";
import { exigirCliente } from "@/lib/clienteAuth";
import { formatarTelefone } from "@/lib/formato";
import { salvarPerfil, trocarSenha } from "../actions";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function Perfil({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await exigirCliente(slug);
  const botao = "w-full rounded-2xl bg-[var(--cor)] py-3 font-bold text-[var(--cor-texto)] disabled:opacity-50";
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Perfil</h1>
      <FormAcao acao={salvarPerfil.bind(null, slug)} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <div><label className="label" htmlFor="nome">Nome</label><input id="nome" name="nome" defaultValue={c.nome} className="input" required /></div>
        <div><label className="label" htmlFor="tel">WhatsApp</label><input id="tel" value={formatarTelefone(c.telefone)} className="input bg-fundo" disabled /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="nascimento">Aniversário</label><input id="nascimento" name="nascimento" type="date" defaultValue={c.nascimento ?? ""} className="input" /></div>
          <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" defaultValue={c.email ?? ""} className="input" /></div>
        </div>
        <button className={botao}>Salvar</button>
      </FormAcao>
      <FormAcao acao={trocarSenha.bind(null, slug)} limparAoSalvar className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Alterar senha</h2>
        <input name="atual" type="password" className="input" placeholder="Senha atual" autoComplete="current-password" required aria-label="Senha atual" />
        <input name="nova" type="password" className="input" placeholder="Nova senha" autoComplete="new-password" minLength={6} required aria-label="Nova senha" />
        <button className={botao}>Alterar senha</button>
      </FormAcao>
    </div>
  );
}
