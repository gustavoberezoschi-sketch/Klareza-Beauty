import { ArrowDownToLine, KeyRound, Wallet } from "lucide-react";
import { FormAcao } from "@/components/FormAcao";
import { Etiqueta, Secao } from "@/components/ui";
import { aReceberDaSubconta, saldoDaSubconta } from "@/lib/asaas";
import { db } from "@/lib/db";
import { formatarDinheiro } from "@/lib/formato";
import { STATUS_SAQUE, TIPOS_CHAVE, atualizarSaques, mascararChave } from "@/lib/saques";
import { formatarDataHora } from "@/lib/tempo";
import { mudarSaqueAutomatico, pedirSaque, salvarChavePix } from "./actions";

type Salao = { id: string; asaasApiKey: string | null; saqueChavePix: string | null; saqueTipoChave: string | null; saqueAutomatico: string };

const AUTOMATICO: Record<string, string> = { NAO: "Não, eu saco quando quiser", DIARIO: "Todo dia (fim da tarde)", SEMANAL: "Toda segunda-feira" };

/** Saldo da conta de recebimento e saque por Pix para a conta do dono. */
export async function SaldoESaque({ b, dono }: { b: Salao; dono: boolean }) {
  await atualizarSaques(b.id);
  let saldo: number | null = null;
  let aReceber = 0;
  let erro: string | null = null;
  try {
    [saldo, aReceber] = await Promise.all([saldoDaSubconta(b.asaasApiKey!), aReceberDaSubconta(b.asaasApiKey!).catch(() => 0)]);
  } catch (e) {
    erro = e instanceof Error ? e.message : "Não foi possível consultar o saldo.";
  }
  const saques = await db.saque.findMany({ where: { salaoId: b.id }, orderBy: { criadoEm: "desc" }, take: 10 });
  const centavos = (v: number) => Math.round(v * 100);

  const formChave = (
    <FormAcao acao={salvarChavePix} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="tipo">Tipo da chave Pix</label>
        <select id="tipo" name="tipo" className="input" defaultValue={b.saqueTipoChave ?? "CPF"}>
          {Object.entries(TIPOS_CHAVE).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="chave">Chave Pix</label>
        <input id="chave" name="chave" className="input" required autoComplete="off" />
      </div>
      <div>
        <label className="label" htmlFor="automatico">Sacar automaticamente?</label>
        <select id="automatico" name="automatico" className="input" defaultValue={b.saqueAutomatico}>
          {Object.entries(AUTOMATICO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="senha-saque">Sua senha do painel</label>
        <input id="senha-saque" name="senha" type="password" className="input" required autoComplete="current-password" />
      </div>
      <p className="text-xs text-couro-400 sm:col-span-2">A chave precisa estar no nome do titular da conta de recebimento (mesmo CPF ou CNPJ).</p>
      <button className="btn-primario sm:col-span-2">Salvar chave Pix</button>
    </FormAcao>
  );

  return (
    <Secao titulo={<span className="flex items-center gap-2"><Wallet className="size-5 text-latao-600" /> Saldo e saque</span>}>
      {erro ? (
        <p className="text-sm text-poste-vermelho">{erro}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-couro-900 p-4 text-white">
            <p className="text-xs font-semibold tracking-wide text-white/60 uppercase">Disponível para saque</p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums">{formatarDinheiro(centavos(saldo ?? 0))}</p>
          </div>
          <div className="rounded-2xl border border-black/[0.06] p-4">
            <p className="text-xs font-semibold tracking-wide text-couro-400 uppercase">A liberar</p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums text-couro-700">{formatarDinheiro(centavos(aReceber))}</p>
            <p className="text-xs text-couro-400">Pagamentos no cartão caem no saldo alguns dias depois.</p>
          </div>
        </div>
      )}

      {!dono ? (
        <p className="mt-4 text-sm text-couro-400">Só o dono do salão pode fazer saques.</p>
      ) : !b.saqueChavePix ? (
        <div className="mt-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4" /> Para onde vai o dinheiro</p>
          {formChave}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <FormAcao acao={pedirSaque} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="label" htmlFor="valor">Valor do saque</label>
              <input id="valor" name="valor" className="input" inputMode="decimal" placeholder={`Vazio = tudo (${formatarDinheiro(centavos(saldo ?? 0))})`} />
            </div>
            <button className="btn-destaque" disabled={!saldo || saldo < 1}>
              <ArrowDownToLine className="size-4" /> Sacar por Pix
            </button>
            <p className="text-xs text-couro-400 sm:col-span-2">
              Vai para a chave {TIPOS_CHAVE[b.saqueTipoChave as keyof typeof TIPOS_CHAVE] ?? ""} {mascararChave(b.saqueTipoChave ?? "", b.saqueChavePix)}. Pelo Pix cai em segundos.
            </p>
          </FormAcao>

          <FormAcao acao={mudarSaqueAutomatico} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="label" htmlFor="auto">Saque automático</label>
              <select id="auto" name="automatico" className="input" defaultValue={b.saqueAutomatico}>
                {Object.entries(AUTOMATICO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </div>
            <button className="btn-secundario">Salvar</button>
            <p className="text-xs text-couro-400 sm:col-span-2">Saca todo o saldo disponível (a partir de R$ 10,00) sem você precisar entrar aqui.</p>
          </FormAcao>

          <details className="rounded-xl border border-black/[0.06] p-3">
            <summary className="cursor-pointer text-sm font-medium">Trocar chave Pix</summary>
            <div className="mt-3">{formChave}</div>
          </details>
        </div>
      )}

      {saques.length > 0 && (
        <div className="mt-5 border-t border-black/[0.06] pt-4">
          <p className="mb-2 text-sm font-semibold">Últimos saques</p>
          <ul className="divide-y divide-black/[0.06] text-sm">
            {saques.map((s) => {
              const st = STATUS_SAQUE[s.status] ?? STATUS_SAQUE.PENDING;
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span>
                    <span className="flex items-center gap-2 font-semibold tabular-nums">{formatarDinheiro(s.valorCentavos)} <Etiqueta tom={st.t}>{st.r}</Etiqueta></span>
                    <span className="block text-xs text-couro-400">
                      {formatarDataHora(s.criadoEm)} · {s.automatico ? "automático" : s.pedidoPor ?? ""}
                      {s.taxaCentavos ? ` · taxa ${formatarDinheiro(s.taxaCentavos)}` : ""}
                    </span>
                    {s.erro && <span className="block text-xs text-poste-vermelho">{s.erro}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Secao>
  );
}
