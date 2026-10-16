import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { FormAcao } from "@/components/FormAcao";
import { FotoUpload } from "@/components/FotoUpload";
import { Cabecalho, Secao } from "@/components/ui";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { TERMO_PADRAO } from "@/lib/anamnese";
import { formatarDinheiro, formatarTelefone } from "@/lib/formato";
import { sinalAtivo } from "@/lib/sinal";
import { enderecoDoSite } from "@/lib/site";
import { alterarMinhaSenha, salvarConfiguracoes } from "../actions";

export const metadata: Metadata = { title: "Configurações" };

export default async function Configuracoes() {
  const { salaoId } = await exigirGestor();
  const b = await db.salao.findUniqueOrThrow({ where: { id: salaoId } });
  const link = `${await enderecoDoSite()}/b/${b.slug}`;

  return (
    <div className="mx-auto max-w-5xl">
      <Cabecalho
        titulo="Configurações"
        descricao="Como o salão aparece para os clientes e as regras de agendamento."
        acoes={<Link href={`/b/${b.slug}`} target="_blank" className="btn-secundario"><ExternalLink className="size-4" /> Ver minha página</Link>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-couro-900 px-5 py-4 text-sm text-couro-300">
        <span>Link de agendamento:</span>
        <code className="rounded-lg bg-white/10 px-2.5 py-1 text-verde-claro">{link}</code>
        <span className="text-xs">Coloque na bio do Instagram, no WhatsApp Business e no Google.</span>
      </div>

      <FormAcao acao={salvarConfiguracoes} className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Identidade">
          <div className="grid gap-4">
            <div className="grid grid-cols-[auto_1fr] items-start gap-4">
              <FotoUpload nome="logo" inicial={b.logo} rotulo="Logo" tamanho={240} />
              <FotoUpload nome="capa" inicial={b.capa} rotulo="Foto de capa" formato="largo" tamanho={480} />
            </div>
            <div><label className="label" htmlFor="nome">Nome do salão</label><input id="nome" name="nome" defaultValue={b.nome} className="input" required /></div>
            <div><label className="label" htmlFor="descricao">Apresentação</label><textarea id="descricao" name="descricao" defaultValue={b.descricao ?? ""} rows={3} className="input" placeholder="Ex.: Estúdio de cílios e unhas no centro, com café e atendimento sem pressa." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="telefone">WhatsApp</label><input id="telefone" name="telefone" defaultValue={b.telefone ? formatarTelefone(b.telefone) : ""} className="input" inputMode="tel" /></div>
              <div><label className="label" htmlFor="instagram">Instagram</label><input id="instagram" name="instagram" defaultValue={b.instagram ? `@${b.instagram}` : ""} className="input" placeholder="@seusalao" /></div>
            </div>
            <div><label className="label" htmlFor="endereco">Endereço</label><input id="endereco" name="endereco" defaultValue={b.endereco ?? ""} className="input" /></div>
            <div className="flex items-center gap-3">
              <input id="cor" name="cor" type="color" defaultValue={b.corDestaque} className="h-10 w-14 cursor-pointer rounded-lg border border-black/10 bg-white p-1" />
              <label htmlFor="cor" className="text-sm">
                <span className="font-semibold">Cor da página de agendamento</span>
                <span className="block text-xs text-couro-400">Use a cor principal da sua marca.</span>
              </label>
            </div>
          </div>
        </Secao>

        <div className="space-y-4">
          <Secao titulo="Horário de funcionamento">
            <p className="text-sm text-couro-400">Os horários ficam em cada unidade.</p>
            <Link href="/painel/unidades" className="btn-secundario btn-pequeno mt-3">Editar horários das unidades</Link>
          </Secao>

          <Secao titulo="Regras">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="intervalo">Horários a cada</label>
                <select id="intervalo" name="intervalo" className="input" defaultValue={b.intervaloMin}>
                  {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutos</option>)}
                </select>
              </div>
              <div><label className="label" htmlFor="antecedencia">Agendar até (dias à frente)</label><input id="antecedencia" name="antecedencia" type="number" min={1} max={90} className="input" defaultValue={b.antecedenciaDias} /></div>
              <div><label className="label" htmlFor="cancelamento">Cliente cancela até (horas antes)</label><input id="cancelamento" name="cancelamento" type="number" min={0} max={72} className="input" defaultValue={b.cancelamentoHoras} /></div>
              <div>
                <label className="label" htmlFor="cashback">Cashback (%)</label>
                <input id="cashback" name="cashback" type="number" min={0} max={50} className="input" defaultValue={b.cashbackPct} />
                <p className="mt-1 text-xs text-couro-400">Parte do valor pago que vira crédito para a próxima visita. 0 = desligado.</p>
              </div>
            </div>
          </Secao>
          <Secao titulo="Sinal, indicação e pós-atendimento">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="sinal">Sinal no agendamento online (%)</label>
                <input id="sinal" name="sinal" type="number" min={0} max={100} className="input" defaultValue={b.sinalPct} />
                <p className="mt-1 text-xs text-couro-400">
                  {b.asaasApiKey && b.asaasStatus === "APPROVED"
                    ? sinalAtivo(b)
                      ? "Ligado: o cliente paga por Pix para garantir o horário. 0 = desligado."
                      : "O cliente paga essa parte por Pix para garantir o horário. 0 = desligado."
                    : "Precisa da conta de recebimento aprovada em Pagamentos online."}
                </p>
              </div>
              <div>
                <label className="label" htmlFor="indicacao">Crédito por indicação (R$)</label>
                <input id="indicacao" name="indicacao" className="input" inputMode="decimal" defaultValue={b.indicacaoCreditoCentavos ? (b.indicacaoCreditoCentavos / 100).toFixed(2).replace(".", ",") : ""} placeholder="0,00" />
                <p className="mt-1 text-xs text-couro-400">
                  {b.indicacaoCreditoCentavos ? `Quem indica e a amiga ganham ${formatarDinheiro(b.indicacaoCreditoCentavos)} cada.` : "Vazio = desligado. As duas ganham o crédito no 1º atendimento pago da amiga."}
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="avaliacao">Link para avaliar o salão (Google)</label>
                <input id="avaliacao" name="avaliacao" type="url" className="input" defaultValue={b.linkAvaliacao ?? ""} placeholder="https://g.page/r/..." />
                <p className="mt-1 text-xs text-couro-400">Vai junto com os cuidados pós-atendimento.</p>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="termo">Termo da ficha de pré-atendimento</label>
                <textarea id="termo" name="termo" rows={4} className="input" defaultValue={b.termoConsentimento ?? ""} placeholder={TERMO_PADRAO} />
                <p className="mt-1 text-xs text-couro-400">O cliente assina pelo celular antes de vir. Vazio = texto padrão. Use {"{salão}"} para o nome do salão.</p>
              </div>
            </div>
          </Secao>
          <button className="btn-destaque w-full py-3">Salvar configurações</button>
        </div>
      </FormAcao>

      <Secao titulo="Minha senha" className="mt-4 max-w-xl">
        <FormAcao acao={alterarMinhaSenha} limparAoSalvar className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div><label className="label" htmlFor="atual">Senha atual</label><input id="atual" name="atual" type="password" className="input" required autoComplete="current-password" /></div>
          <div><label className="label" htmlFor="nova">Nova senha</label><input id="nova" name="nova" type="password" className="input" required minLength={6} autoComplete="new-password" /></div>
          <button className="btn-secundario">Alterar</button>
        </FormAcao>
      </Secao>
    </div>
  );
}
