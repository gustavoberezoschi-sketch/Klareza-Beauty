import type { Metadata } from "next";
import { CircleCheck, Clock, ExternalLink, Landmark, ShieldCheck } from "lucide-react";
import { FormAcao } from "@/components/FormAcao";
import { Cabecalho, Etiqueta, Secao } from "@/components/ui";
import { type GrupoDocumento, TAXAS_ASAAS, asaasConfigurado, ambienteAsaas, documentosDaSubconta, emSandbox, liquidoEstimado } from "@/lib/asaas";
import { exigirGestor } from "@/lib/auth";
import { exigirPagamentosOnline } from "@/lib/planosSistema";
import { db } from "@/lib/db";
import { NOME_FORMA, formatarDinheiro } from "@/lib/formato";
import { formatarDataHora } from "@/lib/tempo";
import { SaldoESaque } from "./Saque";
import { alternarCobrancaClube, aprovarNoTeste, atualizarStatusConta, criarContaRecebimento } from "./actions";

export const metadata: Metadata = { title: "Pagamentos online" };
export const maxDuration = 60; // a criação da conta no Asaas pode levar quase um minuto
export const dynamic = "force-dynamic";

const STATUS: Record<string, { r: string; t: "verde" | "latao" | "vermelho" | "neutro" }> = {
  APPROVED: { r: "Aprovada", t: "verde" },
  PENDING: { r: "Aguardando documentos", t: "latao" },
  AWAITING_APPROVAL: { r: "Em análise pelo Asaas", t: "latao" },
  REJECTED: { r: "Recusada", t: "vermelho" },
};

export default async function Pagamentos() {
  const { salaoId, papel } = await exigirGestor();
  await exigirPagamentosOnline(salaoId);
  const b = await db.salao.findUniqueOrThrow({ where: { id: salaoId } });
  const pagamentos = await db.pagamentoAssinatura.findMany({
    where: { asaasPagamentoId: { not: null }, assinatura: { salaoId } },
    include: { assinatura: { include: { cliente: true, plano: true } } },
    orderBy: { pagoEm: "desc" },
    take: 20,
  });

  let documentos: GrupoDocumento[] = [];
  let erroDocs: string | null = null;
  if (b.asaasApiKey && b.asaasStatus !== "APPROVED") {
    try {
      documentos = await documentosDaSubconta(b.asaasApiKey);
    } catch (e) {
      erroDocs = e instanceof Error ? e.message : "Não foi possível consultar os documentos.";
    }
  }
  const st = STATUS[b.asaasStatus ?? "PENDING"] ?? STATUS.PENDING;
  const [config, planos] = await Promise.all([
    db.configSistema.findUnique({ where: { id: "geral" } }),
    db.plano.findMany({ where: { salaoId, ativo: true }, orderBy: { precoCentavos: "asc" }, take: 3 }),
  ]);
  const taxaPlataforma = config?.taxaPlataformaPct ?? 0;
  const taxas = (
    <Secao titulo="Taxas por pagamento">
      <ul className="space-y-1.5 text-sm">
        {Object.values(TAXAS_ASAAS).map((t) => (
          <li key={t.rotulo} className="flex justify-between gap-2">
            <span>{t.rotulo}</span>
            <span className="font-semibold tabular-nums">{t.pct.toString().replace(".", ",")}% + {formatarDinheiro(t.fixoCentavos)}</span>
          </li>
        ))}
        {taxaPlataforma > 0 && (
          <li className="flex justify-between gap-2"><span>Taxa Klareza Beauty</span><span className="font-semibold tabular-nums">{taxaPlataforma}%</span></li>
        )}
      </ul>
      {planos.length > 0 && (
        <div className="mt-4 border-t border-black/[0.06] pt-3 text-xs text-couro-400">
          <p className="mb-1 font-semibold text-couro-700">Quanto sobra de cada mensalidade</p>
          {planos.map((p) => {
            const plat = Math.round((p.precoCentavos * taxaPlataforma) / 100);
            return (
              <p key={p.id}>
                {p.nome} ({formatarDinheiro(p.precoCentavos)}): Pix {formatarDinheiro(liquidoEstimado(p.precoCentavos, "PIX") - plat)} · cartão{" "}
                {formatarDinheiro(liquidoEstimado(p.precoCentavos, "CREDIT_CARD") - plat)}
              </p>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-xs text-couro-400">Taxas iniciais do Asaas; confira os valores atuais na sua conta.</p>
    </Secao>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <Cabecalho
        titulo="Pagamentos online"
        descricao="O cliente cadastra o cartão uma vez e a mensalidade do clube é debitada automaticamente todo mês. O dinheiro cai na conta do salão."
      />

      {!asaasConfigurado() ? (
        <Secao titulo="Ainda não disponível">
          <p className="text-sm text-couro-700">Os pagamentos online ainda não foram liberados no Klareza Beauty. Fale com o suporte.</p>
        </Secao>
      ) : !b.asaasContaId ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Secao titulo="Abrir conta de recebimento">
            <FormAcao acao={criarContaRecebimento} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className="label" htmlFor="nome">Nome completo ou razão social</label><input id="nome" name="nome" className="input" defaultValue={b.nome} required /></div>
              <div><label className="label" htmlFor="cpfCnpj">CPF ou CNPJ</label><input id="cpfCnpj" name="cpfCnpj" className="input" inputMode="numeric" required /></div>
              <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" className="input" required /></div>
              <div><label className="label" htmlFor="celular">Celular</label><input id="celular" name="celular" className="input" inputMode="tel" required /></div>
              <div><label className="label" htmlFor="faturamento">Faturamento mensal aproximado</label><input id="faturamento" name="faturamento" className="input" placeholder="15.000,00" inputMode="decimal" required /></div>
              <div><label className="label" htmlFor="nascimento">Data de nascimento (se CPF)</label><input id="nascimento" name="nascimento" type="date" className="input" /></div>
              <div>
                <label className="label" htmlFor="tipoEmpresa">Tipo de empresa (se CNPJ)</label>
                <select id="tipoEmpresa" name="tipoEmpresa" className="input" defaultValue="MEI">
                  <option value="MEI">MEI</option>
                  <option value="LIMITED">Limitada (LTDA)</option>
                  <option value="INDIVIDUAL">Individual (EI)</option>
                  <option value="ASSOCIATION">Associação</option>
                </select>
              </div>
              <div><label className="label" htmlFor="cep">CEP</label><input id="cep" name="cep" className="input" inputMode="numeric" required /></div>
              <div><label className="label" htmlFor="bairro">Bairro</label><input id="bairro" name="bairro" className="input" required /></div>
              <div><label className="label" htmlFor="endereco">Endereço</label><input id="endereco" name="endereco" className="input" required /></div>
              <div><label className="label" htmlFor="numero">Número</label><input id="numero" name="numero" className="input" required /></div>
              <button className="btn-destaque sm:col-span-2">Criar conta de recebimento</button>
            </FormAcao>
          </Secao>
          <div className="space-y-4">
            <Secao titulo="Como funciona">
              <ol className="space-y-3 text-sm text-couro-700">
                <li><strong>1.</strong> Preencha os dados: abrimos uma conta no Asaas em nome do salão.</li>
                <li><strong>2.</strong> Envie os documentos pedidos (foto do documento e selfie, pelo celular).</li>
                <li><strong>3.</strong> Com a conta aprovada, ligue a cobrança online do clube.</li>
                <li><strong>4.</strong> O cliente cadastra o cartão uma vez e a mensalidade é debitada sozinha todo mês, até ele cancelar.</li>
              </ol>
            </Secao>
            {taxas}
            <p className="flex items-start gap-2 text-xs text-couro-400"><ShieldCheck className="size-4 shrink-0" /> Pagamentos processados pelo Asaas, instituição de pagamento autorizada pelo Banco Central. Ambiente: {ambienteAsaas()}.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Secao titulo={<span className="flex items-center gap-2"><Landmark className="size-5 text-latao-600" /> Conta de recebimento <Etiqueta tom={st.t}>{st.r}</Etiqueta></span>}>
            {b.asaasStatus === "APPROVED" ? (
              <p className="text-sm text-couro-700">Tudo certo: a conta está aprovada e pode receber pagamentos. O dinheiro fica na conta do salão e você saca por Pix logo abaixo.</p>
            ) : (
              <>
                <p className="text-sm text-couro-700">Envie os documentos abaixo. A análise do Asaas costuma levar até 2 dias úteis.</p>
                {erroDocs && <p className="mt-2 text-sm text-poste-vermelho">{erroDocs}</p>}
                <ul className="mt-3 space-y-2">
                  {documentos.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/[0.06] p-3 text-sm">
                      <span className="flex items-center gap-2">
                        {d.status === "APPROVED" ? <CircleCheck className="size-4 text-emerald-600" /> : <Clock className="size-4 text-latao-600" />}
                        <span>
                          <span className="font-medium">{d.title}</span>
                          {d.description && <span className="block text-xs text-couro-400">{d.description}</span>}
                        </span>
                      </span>
                      {d.onboardingUrl && d.status !== "APPROVED" && (
                        <a href={d.onboardingUrl} target="_blank" rel="noopener" className="btn-primario btn-pequeno"><ExternalLink className="size-3.5" /> Enviar</a>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-4 flex flex-wrap items-start gap-2">
              <FormAcao acao={atualizarStatusConta}>
                <button className="btn-secundario btn-pequeno">Atualizar status</button>
              </FormAcao>
              {emSandbox() && b.asaasStatus !== "APPROVED" && (
                <FormAcao acao={aprovarNoTeste}>
                  <button className="btn-secundario btn-pequeno border-dashed">Aprovar conta (só no teste)</button>
                </FormAcao>
              )}
            </div>
          </Secao>

          {b.asaasStatus === "APPROVED" && <SaldoESaque b={b} dono={papel === "DONO"} />}

          <Secao titulo="Cobrança online do clube de assinatura">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-xl text-sm text-couro-700">
                Com isso ligado, o cliente assina o clube pela área dele e paga online, e no painel você pode gerar a cobrança automática para quem assina no balcão.
              </p>
              <form action={alternarCobrancaClube}>
                <input type="hidden" name="ligar" value={b.cobrancaOnlineClube ? "0" : "1"} />
                <button disabled={b.asaasStatus !== "APPROVED"} className={b.cobrancaOnlineClube ? "btn-secundario" : "btn-destaque"}>
                  {b.cobrancaOnlineClube ? "Desligar cobrança online" : "Ligar cobrança online"}
                </button>
              </form>
            </div>
            {b.asaasStatus !== "APPROVED" && <p className="mt-2 text-xs text-couro-400">Disponível depois que a conta for aprovada.</p>}
          </Secao>

          {taxas}

          <Secao titulo="Pagamentos recebidos online">
            {pagamentos.length === 0 ? (
              <p className="text-sm text-couro-400">Nenhum pagamento online ainda.</p>
            ) : (
              <ul className="divide-y divide-black/[0.06] text-sm">
                {pagamentos.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3 py-2.5">
                    <span>
                      {p.assinatura.cliente.nome} · {p.assinatura.plano.nome}
                      <span className="block text-xs text-couro-400">{formatarDataHora(p.pagoEm)} · {NOME_FORMA[p.formaPagamento] ?? p.formaPagamento}</span>
                    </span>
                    <span className="text-right">
                      <span className="block font-semibold tabular-nums">{formatarDinheiro(p.valorCentavos)}</span>
                      {p.valorLiquidoCentavos !== null && <span className="text-xs text-couro-400">líquido {formatarDinheiro(p.valorLiquidoCentavos)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </div>
      )}
    </div>
  );
}
