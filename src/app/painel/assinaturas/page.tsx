import type { Metadata } from "next";
import Link from "next/link";
import { Crown } from "lucide-react";
import { FormAcao } from "@/components/FormAcao";
import { Cabecalho, Etiqueta, Indicador, Secao, Vazio } from "@/components/ui";
import { exigirGestor } from "@/lib/auth";
import { cobraOnline } from "@/lib/clubeOnline";
import { usosDoPlanoNoMes } from "@/lib/comandas";
import { db } from "@/lib/db";
import { FORMAS_PAGAMENTO, formatarDinheiro, formatarTelefone, linkWhatsApp } from "@/lib/formato";
import { encerrarCanceladasVencidas } from "@/lib/planosSistema";
import { diaLocal, formatarDia } from "@/lib/tempo";
import { alternarPlano, cancelarAssinatura, novaAssinatura, pagarMensalidade, salvarPlano } from "./actions";

export const metadata: Metadata = { title: "Clube de assinatura" };
export const dynamic = "force-dynamic";

export default async function Assinaturas({ searchParams }: { searchParams: Promise<{ cliente?: string; editar?: string }> }) {
  const { salaoId } = await exigirGestor();
  const p = await searchParams;
  const hoje = diaLocal();
  await encerrarCanceladasVencidas(salaoId);
  const [planos, assinaturas, clientes, servicos, salao] = await Promise.all([
    db.plano.findMany({ where: { salaoId }, include: { servicos: true, _count: { select: { assinaturas: { where: { status: "ATIVA" } } } } }, orderBy: [{ ativo: "desc" }, { precoCentavos: "asc" }] }),
    db.assinatura.findMany({ where: { salaoId, status: { in: ["ATIVA", "AGUARDANDO"] } }, include: { cliente: true, plano: true, extras: { where: { status: "PENDENTE" }, select: { valorCentavos: true } } }, orderBy: [{ status: "asc" }, { pagoAte: "asc" }] }),
    db.cliente.findMany({ where: { salaoId }, orderBy: { nome: "asc" }, select: { id: true, nome: true, telefone: true } }),
    db.servico.findMany({ where: { salaoId, ativo: true }, orderBy: [{ categoria: "asc" }, { nome: "asc" }] }),
    db.salao.findUniqueOrThrow({ where: { id: salaoId }, select: { nome: true, asaasApiKey: true, asaasStatus: true, cobrancaOnlineClube: true } }),
  ]);
  const usos = new Map(await Promise.all(assinaturas.map(async (a) => [a.id, await usosDoPlanoNoMes(a.clienteId)] as const)));
  const editar = planos.find((x) => x.id === p.editar);
  const online = cobraOnline(salao);
  const ativas = assinaturas.filter((a) => a.status === "ATIVA");
  const recorrente = ativas.filter((a) => !a.canceladaEm).reduce((s, a) => s + a.plano.precoCentavos, 0);
  const atrasadas = ativas.filter((a) => a.pagoAte < hoje);
  const ativos = planos.filter((x) => x.ativo);

  return (
    <div>
      <Cabecalho titulo="Clube de assinatura" descricao="Planos mensais: o cliente paga todo mês e usa os serviços inclusos sem cobrança na comanda." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Indicador rotulo="Assinantes ativos" valor={ativas.length} icone={Crown} destaque detalhe={assinaturas.length > ativas.length ? `${assinaturas.length - ativas.length} aguardando o 1º pagamento` : undefined} />
        <Indicador rotulo="Receita recorrente / mês" valor={formatarDinheiro(recorrente)} />
        <Indicador rotulo="Mensalidades atrasadas" valor={atrasadas.length} detalhe={atrasadas.length ? formatarDinheiro(atrasadas.reduce((s, a) => s + a.plano.precoCentavos, 0)) + " em aberto" : "Tudo em dia"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <Secao titulo="Assinantes">
            {assinaturas.length === 0 ? (
              <Vazio icone={Crown} titulo="Nenhum assinante ainda" texto="Crie um plano e cadastre o primeiro assinante ao lado." />
            ) : (
              <ul className="divide-y divide-black/[0.06]">
                {assinaturas.map((a) => {
                  const aguardando = a.status === "AGUARDANDO";
                  const atrasada = !aguardando && a.pagoAte < hoje;
                  const cancelada = !!a.canceladaEm;
                  const usado = usos.get(a.id) ?? 0;
                  const mensagemLink = a.linkPagamento
                    ? aguardando
                      ? `Oi, ${a.cliente.nome.split(" ")[0]}! Segue o link para cadastrar seu cartão e ativar o ${a.plano.nome} no ${salao.nome} (${formatarDinheiro(a.plano.precoCentavos)}/mês). Depois disso a mensalidade é debitada sozinha todo mês: ${a.linkPagamento}`
                      : `Oi, ${a.cliente.nome.split(" ")[0]}! A mensalidade do ${a.plano.nome} no ${salao.nome} não foi aprovada no seu cartão. Atualize o cartão por aqui: ${a.linkPagamento}`
                    : null;
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/painel/clientes/${a.clienteId}`} className="font-semibold hover:text-latao-700">{a.cliente.nome}</Link>
                        <p className="text-sm text-couro-400">
                          {a.plano.nome} · {formatarDinheiro(a.plano.precoCentavos)}/mês · usou {usado}
                          {a.plano.usosPorMes ? ` de ${a.plano.usosPorMes}` : ""} este mês
                        </p>
                      </div>
                      {a.asaasId && !cancelada && <Etiqueta tom="azul">Cartão · automático</Etiqueta>}
                      {cancelada && <Etiqueta tom="neutro">Cancelou pelo app · vale até {formatarDia(a.pagoAte)}</Etiqueta>}
                      {a.extras.length > 0 && (
                        <Etiqueta tom="latao">+ {formatarDinheiro(a.extras.reduce((t, e) => t + e.valorCentavos, 0))} em extras na fatura</Etiqueta>
                      )}
                      {aguardando ? (
                        <Etiqueta tom="latao">Aguardando 1º pagamento</Etiqueta>
                      ) : atrasada ? (
                        <Etiqueta tom="vermelho">Venceu {formatarDia(a.pagoAte)}</Etiqueta>
                      ) : (
                        <Etiqueta tom="verde">Pago até {formatarDia(a.pagoAte)}</Etiqueta>
                      )}
                      {mensagemLink && (
                        <a href={linkWhatsApp(a.cliente.telefone, mensagemLink)} target="_blank" className="btn btn-pequeno bg-[#25d366] text-white hover:bg-[#1fb457]">
                          Enviar link de pagamento
                        </a>
                      )}
                      {!a.asaasId && (
                      <form action={pagarMensalidade} className="flex gap-1">
                        <input type="hidden" name="id" value={a.id} />
                        <select name="formaPagamento" className="input w-auto py-1.5 text-xs" aria-label="Forma de pagamento" defaultValue="PIX">
                          {Object.entries(FORMAS_PAGAMENTO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                        </select>
                        <button className="btn-secundario btn-pequeno">Receber mês</button>
                      </form>
                      )}
                      {atrasada && !a.asaasId && (
                        <a
                          href={linkWhatsApp(a.cliente.telefone, `Oi, ${a.cliente.nome.split(" ")[0]}! A mensalidade do seu plano ${a.plano.nome} no ${salao.nome} (${formatarDinheiro(a.plano.precoCentavos)}) venceu em ${formatarDia(a.pagoAte)}. Pode acertar na sua próxima visita ou via Pix. Valeu!`)}
                          target="_blank"
                          className="btn-secundario btn-pequeno"
                        >
                          Cobrar
                        </a>
                      )}
                      <FormAcao acao={cancelarAssinatura} className="flex flex-col items-end">
                        <input type="hidden" name="id" value={a.id} />
                        <button className="text-xs font-medium text-couro-400 hover:text-poste-vermelho">Cancelar</button>
                      </FormAcao>
                    </li>
                  );
                })}
              </ul>
            )}
          </Secao>

          <Secao titulo="Planos">
            {planos.length === 0 ? (
              <p className="text-sm text-couro-400">Nenhum plano criado. Use o formulário para criar o primeiro (ex.: "Corte ilimitado").</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {planos.map((pl) => (
                  <div key={pl.id} className={`rounded-2xl border border-black/[0.08] p-4 ${pl.ativo ? "" : "opacity-50"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display text-lg font-bold">{pl.nome}</p>
                      <p className="numero text-lg">{formatarDinheiro(pl.precoCentavos)}<span className="text-xs font-normal text-couro-400">/mês</span></p>
                    </div>
                    <p className="mt-1 text-sm text-couro-700">{pl.servicos.map((s) => s.nome).join(", ")}</p>
                    <p className="mt-1 text-xs text-couro-400">
                      {pl.usosPorMes ? `${pl.usosPorMes} uso(s) por mês` : "Uso ilimitado"} · {pl._count.assinaturas} assinante(s){!pl.exibirOnline && " · não aparece no site"}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Link href={`/painel/assinaturas?editar=${pl.id}`} className="btn-secundario btn-pequeno">Editar</Link>
                      <form action={alternarPlano}>
                        <input type="hidden" name="id" value={pl.id} />
                        <button className="btn-secundario btn-pequeno">{pl.ativo ? "Desativar" : "Reativar"}</button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Secao>
        </div>

        <div className="space-y-4">
          {ativos.length > 0 && (
            <Secao titulo="Novo assinante">
              <FormAcao acao={novaAssinatura} limparAoSalvar className="grid gap-3">
                <select name="clienteId" className="input" defaultValue={p.cliente ?? ""} required aria-label="Cliente">
                  <option value="" disabled>Escolha o cliente</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome} · {formatarTelefone(c.telefone)}</option>)}
                </select>
                <select name="planoId" className="input" required aria-label="Plano">
                  {ativos.map((pl) => <option key={pl.id} value={pl.id}>{pl.nome} · {formatarDinheiro(pl.precoCentavos)}/mês</option>)}
                </select>
                <select name="formaPagamento" className="input" defaultValue={online ? "ONLINE" : "PIX"} aria-label="Forma de pagamento da 1ª mensalidade">
                  {online && <option value="ONLINE">Cobrar no cartão do cliente todo mês (automático)</option>}
                  {Object.entries(FORMAS_PAGAMENTO).map(([v, r]) => <option key={v} value={v}>1ª mensalidade em {r} (no balcão)</option>)}
                </select>
                {online && <input name="cpf" className="input" placeholder="CPF do cliente (para cobrança online)" inputMode="numeric" aria-label="CPF do cliente" />}
                <button className="btn-destaque"><Crown className="size-4" /> Assinar</button>
              </FormAcao>
            </Secao>
          )}

          <Secao titulo={editar ? `Editar plano: ${editar.nome}` : "Criar plano"} acoes={editar && <Link href="/painel/assinaturas" className="text-sm text-couro-400 hover:text-tinta">Cancelar edição</Link>}>
            <FormAcao key={editar?.id ?? "novo"} acao={salvarPlano} className="grid gap-3">
              {editar && <input type="hidden" name="id" value={editar.id} />}
              <input name="nome" defaultValue={editar?.nome} className="input" placeholder="Nome (ex.: Clube do corte)" required aria-label="Nome do plano" />
              <textarea name="descricao" defaultValue={editar?.descricao ?? ""} rows={2} className="input" placeholder="Descrição para o cliente" aria-label="Descrição" />
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label" htmlFor="preco">Mensalidade</label><input id="preco" name="preco" defaultValue={editar ? (editar.precoCentavos / 100).toFixed(2).replace(".", ",") : ""} className="input" placeholder="99,90" inputMode="decimal" required /></div>
                <div><label className="label" htmlFor="usos">Usos por mês</label><input id="usos" name="usos" type="number" min={1} defaultValue={editar?.usosPorMes ?? ""} className="input" placeholder="Ilimitado" /></div>
              </div>
              <fieldset>
                <legend className="label">Serviços inclusos</legend>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-black/10 p-2">
                  {servicos.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 rounded-lg p-1 text-sm hover:bg-fundo">
                      <input type="checkbox" name="servicos" value={s.id} defaultChecked={editar?.servicos.some((x) => x.id === s.id)} />
                      {s.nome} <span className="text-couro-400">· {formatarDinheiro(s.precoCentavos)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="exibirOnline" defaultChecked={editar?.exibirOnline ?? true} /> Mostrar na página de agendamento</label>
              <button className="btn-primario">{editar ? "Salvar plano" : "Criar plano"}</button>
            </FormAcao>
          </Secao>
        </div>
      </div>
    </div>
  );
}
