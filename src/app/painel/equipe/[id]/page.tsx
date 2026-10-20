import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormAcao } from "@/components/FormAcao";
import { FotoUpload } from "@/components/FotoUpload";
import { Cabecalho, Secao } from "@/components/ui";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { filialDoPainel } from "@/lib/filial";
import { usoDoPlano } from "@/lib/planosSistema";
import { formatarTelefone } from "@/lib/formato";
import { alternarProfissional, salvarProfissional } from "../../actions";

export const metadata: Metadata = { title: "Profissional" };
export const dynamic = "force-dynamic";

export default async function Profissional({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirGestor();
  const { salaoId } = sessao;
  const id = (await params).id;
  const { filiais, atual } = await filialDoPainel(sessao);
  const uso = await usoDoPlano(salaoId);
  const b = id === "novo" ? null : await db.profissional.findFirst({ where: { id, salaoId }, include: { usuario: true } });
  if (id !== "novo" && !b) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <Cabecalho
        titulo={b ? b.nome : uso.plano.profissionais !== null ? "Meu perfil" : "Novo profissional"}
        voltar={{ href: "/painel/equipe", rotulo: uso.plano.profissionais !== null ? "Meu perfil" : "Equipe" }}
        acoes={
          b && (
            <form action={alternarProfissional}>
              <input type="hidden" name="id" value={b.id} />
              <button className={b.ativo ? "btn-perigo" : "btn-secundario"}>{b.ativo ? "Desativar" : "Reativar"}</button>
            </form>
          )
        }
      />
      <FormAcao acao={salvarProfissional} className="grid gap-4 lg:grid-cols-2">
        {b && <input type="hidden" name="id" value={b.id} />}
        <Secao titulo="Dados">
          <div className="grid gap-4">
            <FotoUpload nome="foto" inicial={b?.foto} formato="redondo" rotulo="Foto (aparece para o cliente)" tamanho={240} />
            <div><label className="label" htmlFor="nome">Nome</label><input id="nome" name="nome" defaultValue={b?.nome} className="input" required /></div>
            {filiais.length > 1 ? (
              <div>
                <label className="label" htmlFor="filialId">Unidade</label>
                <select id="filialId" name="filialId" defaultValue={b?.filialId ?? atual?.id ?? filiais[0].id} className="input">
                  {filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}{f.ativo ? "" : " (inativa)"}</option>)}
                </select>
              </div>
            ) : (
              <input type="hidden" name="filialId" value={b?.filialId ?? filiais[0]?.id} />
            )}
            <div><label className="label" htmlFor="telefone">WhatsApp</label><input id="telefone" name="telefone" defaultValue={b?.telefone ? formatarTelefone(b.telefone) : ""} className="input" inputMode="tel" /></div>
            <div><label className="label" htmlFor="bio">Apresentação curta</label><input id="bio" name="bio" defaultValue={b?.bio ?? ""} className="input" placeholder="Ex.: especialista em cílios fio a fio e volume russo" /></div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="destaque" defaultChecked={b?.destaque} className="mt-0.5" />
              <span><span className="font-medium">Destaque</span><span className="block text-xs text-couro-400">Mostra o selo "Destaque" e coloca primeiro na lista do cliente.</span></span>
            </label>
          </div>
        </Secao>
        <div className="space-y-4">
          {uso.plano.recursos.comissoes && (
          <Secao titulo="Comissões">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label" htmlFor="comissao">Serviços (%)</label><input id="comissao" name="comissao" type="number" min={0} max={100} defaultValue={b?.comissaoPct ?? 50} className="input" required /></div>
                <div><label className="label" htmlFor="comissaoProduto">Produtos (%)</label><input id="comissaoProduto" name="comissaoProduto" type="number" min={0} max={100} defaultValue={b?.comissaoProdutoPct ?? 10} className="input" required /></div>
                <div><label className="label" htmlFor="comissaoAuxiliar">Como auxiliar (%)</label><input id="comissaoAuxiliar" name="comissaoAuxiliar" type="number" min={0} max={100} defaultValue={b?.comissaoAuxiliarPct ?? 10} className="input" required /></div>
              </div>
              <p className="mt-2 text-xs text-couro-400">Um serviço com comissão específica usa a dele no lugar desta. “Como auxiliar” é o que ela ganha ao ajudar no serviço de outra profissional.</p>
            </Secao>
          )}
          {!uso.plano.recursos.comissoes && (
            <>
              <input type="hidden" name="comissao" value={b?.comissaoPct ?? 0} />
              <input type="hidden" name="comissaoProduto" value={b?.comissaoProdutoPct ?? 0} />
              <input type="hidden" name="comissaoAuxiliar" value={b?.comissaoAuxiliarPct ?? 0} />
            </>
          )}
          {uso.plano.profissionais === null && (
          <Secao titulo="Acesso ao sistema">
              <p className="mb-3 text-sm text-couro-400">
                Com acesso, o profissional entra em <strong>/login</strong> e vê só a própria agenda, as comandas dele e as comissões.
              </p>
              <div className="grid gap-3">
                <div><label className="label" htmlFor="email">E-mail de login</label><input id="email" name="email" type="email" defaultValue={b?.usuario?.email ?? ""} className="input" placeholder="Deixe vazio para não dar acesso" /></div>
                <div><label className="label" htmlFor="senha">{b?.usuario ? "Nova senha (deixe vazio para manter)" : "Senha"}</label><input id="senha" name="senha" type="text" className="input" minLength={6} autoComplete="new-password" /></div>
              </div>
            </Secao>
          )}
          <button className="btn-destaque w-full py-3">{b ? "Salvar alterações" : uso.plano.profissionais !== null ? "Criar meu perfil" : "Cadastrar profissional"}</button>
        </div>
      </FormAcao>
    </div>
  );
}
