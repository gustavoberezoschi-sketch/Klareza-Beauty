import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Crown, MessageCircle, Package, Sparkles, Ticket, Trash2 } from "lucide-react";
import { FormAcao } from "@/components/FormAcao";
import { Cabecalho, Etiqueta, Secao } from "@/components/ui";
import { alertasDaAnamnese, lerAnamnese } from "@/lib/anamnese";
import { exigirSessao } from "@/lib/auth";
import { assinaturaVigente, subtotalDosItens } from "@/lib/comandas";
import { db } from "@/lib/db";
import { estoquePorProduto } from "@/lib/estoque";
import { pacotesDaCliente } from "@/lib/pacotes";
import { agendamentoDoSinal } from "@/lib/sinal";
import { FORMAS_PAGAMENTO, NOME_FORMA, formatarDinheiro, linkWhatsApp } from "@/lib/formato";
import { formatarDataHora } from "@/lib/tempo";
import { estornarComanda, estornarFechada, excluirItem, finalizarComanda, incluirPacote, incluirProduto, incluirServico, relancarExtra } from "../actions";

export const metadata: Metadata = { title: "Comanda" };
export const dynamic = "force-dynamic";

export default async function Comanda({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirSessao();
  const comanda = await db.comanda.findFirst({
    where: { id: (await params).id, salaoId: sessao.salaoId, ...(sessao.profissionalId ? { profissionalId: sessao.profissionalId } : {}) },
    include: { cliente: true, profissional: true, itens: { include: { profissional: true, auxiliar: true }, orderBy: { id: "asc" } }, salao: true, agendamento: true },
  });
  if (!comanda) notFound();

  const aberta = comanda.status === "ABERTA";
  const extra = await db.extraFatura.findUnique({ where: { comandaId: comanda.id } });
  const [servicos, produtos, profissionais, assinatura, pacotes, pacotesCliente] = await Promise.all([
    db.servico.findMany({
      where: { salaoId: sessao.salaoId, ativo: true },
      include: { opcoes: { where: { ativo: true }, orderBy: [{ ordem: "asc" }, { precoCentavos: "asc" }] } },
      orderBy: [{ categoria: "asc" }, { nome: "asc" }],
    }),
    // material de uso interno (preço zero) não aparece para venda
    db.produto.findMany({ where: { salaoId: sessao.salaoId, ativo: true, precoCentavos: { gt: 0 } }, orderBy: { nome: "asc" } }),
    db.profissional.findMany({ where: { salaoId: sessao.salaoId, filialId: comanda.filialId, ativo: true }, orderBy: { nome: "asc" } }),
    comanda.clienteId ? assinaturaVigente(comanda.clienteId) : null,
    db.pacote.findMany({ where: { salaoId: sessao.salaoId, ativo: true }, orderBy: { nome: "asc" } }),
    comanda.clienteId ? pacotesDaCliente(comanda.clienteId) : [],
  ]);
  const comSaldo = pacotesCliente.filter((p) => p.disponivel);
  const alertas = comanda.cliente ? alertasDaAnamnese(lerAnamnese(comanda.cliente.anamnese)) : [];
  const estoque = await estoquePorProduto(sessao.salaoId, comanda.filialId);
  const subtotal = subtotalDosItens(comanda.itens);
  const bruto = comanda.itens.reduce((s, i) => s + i.quantidade * i.precoUnitCentavos, 0);
  const saldo = comanda.cliente?.saldoCashbackCentavos ?? 0;
  // sinal pago no agendamento online e ainda não usado: abate ao fechar
  const comSinal = comanda.agendamento ? await agendamentoDoSinal(db, comanda.agendamento) : null;
  const sinalDisponivel = aberta && comSinal?.sinalPagoEm && !comSinal.sinalDestino ? (comSinal.sinalCentavos ?? 0) : 0;

  const recibo = [
    `*${comanda.salao.nome}* · Comanda #${comanda.numero}`,
    ...comanda.itens.map((i) => `${i.quantidade}x ${i.descricao}: ${i.cobertoPorPlano ? "incluso no plano" : i.pacoteClienteId ? "sessão do pacote" : formatarDinheiro(i.quantidade * i.precoUnitCentavos)}`),
    comanda.descontoCentavos ? `Desconto: -${formatarDinheiro(comanda.descontoCentavos)}` : "",
    comanda.sinalCentavos ? `Sinal pago (Pix): -${formatarDinheiro(comanda.sinalCentavos)}` : "",
    comanda.cashbackUsadoCentavos ? `Cashback usado: -${formatarDinheiro(comanda.cashbackUsadoCentavos)}` : "",
    `*Total: ${formatarDinheiro(comanda.totalCentavos)}* (${NOME_FORMA[comanda.formaPagamento ?? ""] ?? ""})`,
    comanda.cashbackGeradoCentavos ? `Você ganhou ${formatarDinheiro(comanda.cashbackGeradoCentavos)} de cashback para a próxima visita!` : "",
    "Obrigado pela preferência! ✨",
  ].filter(Boolean).join("\n");

  const podeFatura = !!assinatura?.asaasId && !assinatura.canceladaEm && comanda.salao.cobrancaOnlineClube && !!comanda.salao.asaasApiKey;

  return (
    <div className="mx-auto max-w-5xl">
      <Cabecalho
        voltar={{ href: "/painel/comandas", rotulo: "Comandas" }}
        titulo={
          <span className="flex items-center gap-3">
            Comanda #{comanda.numero}
            {aberta ? <Etiqueta tom="latao">Aberta</Etiqueta> : comanda.status === "FECHADA" ? <Etiqueta tom="verde">Paga</Etiqueta> : <Etiqueta tom="neutro">Cancelada</Etiqueta>}
          </span>
        }
        descricao={`${comanda.cliente?.nome ?? "Cliente avulso"}${comanda.profissional ? ` · ${comanda.profissional.nome}` : ""} · aberta em ${formatarDataHora(comanda.abertaEm)}`}
      />

      {assinatura && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-latao-500/30 bg-latao-50 px-4 py-3 text-sm">
          <Crown className="size-5 text-latao-600" />
          <span>
            <strong>{comanda.cliente?.nome}</strong> é assinante do plano <strong>{assinatura.plano.nome}</strong>. Serviços inclusos entram sem cobrança.
          </span>
        </div>
      )}

      {alertas.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-poste-vermelho/30 bg-poste-vermelho/5 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-poste-vermelho" />
          <span><strong>Ficha do cliente:</strong> {alertas.join(" · ")}</span>
        </div>
      )}

      {comSaldo.length > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-black/10 bg-fundo px-4 py-3 text-sm">
          <Ticket className="size-5 text-latao-600" />
          <span>
            Pacotes do cliente:{" "}
            {comSaldo.map((p, n) => (
              <span key={p.id}>
                {n > 0 && " · "}
                <strong>{p.pacote.nome}</strong> ({p.restantes} de {p.sessoes} sessões)
              </span>
            ))}
            . O serviço do pacote entra sem cobrança.
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Secao titulo="Itens">
            {comanda.itens.length === 0 ? (
              <p className="text-sm text-couro-400">Nenhum item ainda. Adicione serviços ou produtos abaixo.</p>
            ) : (
              <ul className="divide-y divide-black/[0.06]">
                {comanda.itens.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-fundo text-couro-700">
                      {i.tipo === "SERVICO" ? <Sparkles className="size-4" /> : i.tipo === "PACOTE" ? <Ticket className="size-4" /> : <Package className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {i.quantidade > 1 && `${i.quantidade}× `}{i.descricao}
                      </p>
                      <p className="text-xs text-couro-400">
                        {i.tipo === "PACOTE"
                          ? "Sessões liberadas ao fechar a comanda"
                          : <>
                              {i.profissional?.nome ?? "Sem profissional"} · comissão {i.comissaoPct}%
                              {i.auxiliar && ` · auxiliar ${i.auxiliar.nome} (${i.comissaoAuxiliarPct}%)`}
                            </>}
                      </p>
                    </div>
                    {i.cobertoPorPlano ? (
                      <Etiqueta tom="latao">Incluso no plano</Etiqueta>
                    ) : i.pacoteClienteId ? (
                      <Etiqueta tom="azul">Sessão do pacote</Etiqueta>
                    ) : (
                      <span className="font-semibold tabular-nums">{formatarDinheiro(i.quantidade * i.precoUnitCentavos)}</span>
                    )}
                    {aberta && (
                      <form action={excluirItem}>
                        <input type="hidden" name="comandaId" value={comanda.id} />
                        <input type="hidden" name="itemId" value={i.id} />
                        <button className="rounded-lg p-1.5 text-couro-300 hover:bg-poste-vermelho/10 hover:text-poste-vermelho" aria-label={`Remover ${i.descricao}`}>
                          <Trash2 className="size-4" />
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Secao>

          {aberta && (
            <div className="grid gap-4 md:grid-cols-2">
              <Secao titulo="Adicionar serviço">
                <FormAcao acao={incluirServico} className="grid gap-3">
                  <input type="hidden" name="comandaId" value={comanda.id} />
                  <select name="servicoId" className="input" required aria-label="Serviço">
                    {servicos.map((s) => {
                      const variacoes = s.opcoes.filter((o) => o.tipo === "VARIACAO");
                      const adicionais = s.opcoes.filter((o) => o.tipo === "ADICIONAL");
                      return variacoes.length || adicionais.length ? (
                        <optgroup key={s.id} label={s.nome}>
                          {variacoes.length === 0 && <option value={`s:${s.id}`}>{s.nome} · {formatarDinheiro(s.precoCentavos)}</option>}
                          {variacoes.map((v) => <option key={v.id} value={`v:${s.id}:${v.id}`}>{s.nome} · {v.nome} · {formatarDinheiro(v.precoCentavos)}</option>)}
                          {adicionais.map((a) => <option key={a.id} value={`a:${s.id}:${a.id}`}>+ {a.nome} (adicional) · {formatarDinheiro(a.precoCentavos)}</option>)}
                        </optgroup>
                      ) : (
                        <option key={s.id} value={`s:${s.id}`}>{s.nome} · {formatarDinheiro(s.precoCentavos)}</option>
                      );
                    })}
                  </select>
                  {!sessao.profissionalId && (
                    <select name="profissionalId" className="input" defaultValue={comanda.profissionalId ?? ""} aria-label="Profissional">
                      <option value="">Sem profissional</option>
                      {profissionais.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
                    </select>
                  )}
                  {profissionais.length > 1 && (
                    <select name="auxiliarId" className="input" defaultValue="" aria-label="Auxiliar">
                      <option value="">Sem auxiliar</option>
                      {profissionais.map((b) => <option key={b.id} value={b.id}>Auxiliar: {b.nome} ({b.comissaoAuxiliarPct}%)</option>)}
                    </select>
                  )}
                  <button className="btn-secundario"><Sparkles className="size-4" /> Adicionar serviço</button>
                </FormAcao>
              </Secao>
              <Secao titulo="Adicionar produto">
                {produtos.length === 0 ? (
                  <p className="text-sm text-couro-400">
                    Nenhum produto cadastrado. <Link href="/painel/produtos" className="font-semibold text-latao-700 underline">Cadastrar produtos</Link>
                  </p>
                ) : (
                  <FormAcao acao={incluirProduto} className="grid gap-3">
                    <input type="hidden" name="comandaId" value={comanda.id} />
                    <div className="grid grid-cols-[1fr_80px] gap-2">
                      <select name="produtoId" className="input" required aria-label="Produto">
                        {produtos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome} · {formatarDinheiro(p.precoCentavos)} ({estoque(p.id).quantidade} em estoque)
                          </option>
                        ))}
                      </select>
                      <input name="quantidade" type="number" min={1} defaultValue={1} className="input" aria-label="Quantidade" />
                    </div>
                    {!sessao.profissionalId && (
                      <select name="profissionalId" className="input" defaultValue={comanda.profissionalId ?? ""} aria-label="Quem vendeu">
                        <option value="">Venda do balcão (sem comissão)</option>
                        {profissionais.map((b) => <option key={b.id} value={b.id}>Vendido por {b.nome}</option>)}
                      </select>
                    )}
                    <button className="btn-secundario"><Package className="size-4" /> Adicionar produto</button>
                  </FormAcao>
                )}
              </Secao>
              {pacotes.length > 0 && (
                <Secao titulo="Vender pacote">
                  {comanda.clienteId ? (
                    <FormAcao acao={incluirPacote} className="grid gap-3">
                      <input type="hidden" name="comandaId" value={comanda.id} />
                      <select name="pacoteId" className="input" required aria-label="Pacote">
                        {pacotes.map((p) => <option key={p.id} value={p.id}>{p.nome} · {p.sessoes} sessões · {formatarDinheiro(p.precoCentavos)}</option>)}
                      </select>
                      <button className="btn-secundario"><Ticket className="size-4" /> Adicionar pacote</button>
                    </FormAcao>
                  ) : (
                    <p className="text-sm text-couro-400">Para vender um pacote, abra a comanda com o cliente escolhido.</p>
                  )}
                </Secao>
              )}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          {aberta ? (
            <Secao titulo="Pagamento">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-couro-400">Itens</dt><dd className="tabular-nums">{formatarDinheiro(bruto)}</dd></div>
                {bruto !== subtotal && (
                  <div className="flex justify-between"><dt className="text-couro-400">Plano e pacotes</dt><dd className="tabular-nums">-{formatarDinheiro(bruto - subtotal)}</dd></div>
                )}
                {sinalDisponivel > 0 && (
                  <div className="flex justify-between"><dt className="text-couro-400">Sinal pago (Pix)</dt><dd className="tabular-nums">-{formatarDinheiro(Math.min(sinalDisponivel, subtotal))}</dd></div>
                )}
                <div className="flex justify-between border-t border-black/[0.06] pt-2 text-base font-semibold"><dt>A cobrar</dt><dd className="numero">{formatarDinheiro(Math.max(0, subtotal - sinalDisponivel))}</dd></div>
                {sinalDisponivel > subtotal && <p className="text-xs text-couro-400">A sobra do sinal ({formatarDinheiro(sinalDisponivel - subtotal)}) vira crédito do cliente.</p>}
              </dl>
              <FormAcao acao={finalizarComanda} className="mt-4 grid gap-4">
                <input type="hidden" name="comandaId" value={comanda.id} />
                <div>
                  <label className="label" htmlFor="desconto">Desconto (R$)</label>
                  <input id="desconto" name="desconto" className="input" placeholder="0,00" inputMode="decimal" />
                </div>
                {saldo > 0 && (
                  <label className="flex items-center gap-2 rounded-xl bg-latao-50 p-3 text-sm">
                    <input type="checkbox" name="usarCashback" defaultChecked /> Usar cashback do cliente ({formatarDinheiro(saldo)})
                  </label>
                )}
                <fieldset>
                  <legend className="label">Forma de pagamento</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(FORMAS_PAGAMENTO).map(([valor, rotulo], i) => (
                      <label key={valor} className="cursor-pointer">
                        <input type="radio" name="formaPagamento" value={valor} defaultChecked={i === 1} className="peer sr-only" />
                        <span className="block rounded-xl border border-black/10 px-3 py-2.5 text-center text-sm font-medium transition peer-checked:border-couro-900 peer-checked:bg-couro-900 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-latao-500">
                          {rotulo}
                        </span>
                      </label>
                    ))}
                  </div>
                  {podeFatura && (
                    <label className="mt-2 block cursor-pointer">
                      <input type="radio" name="formaPagamento" value="FATURA" className="peer sr-only" />
                      <span className="flex items-center justify-center gap-2 rounded-xl border border-latao-500/40 bg-latao-50 px-3 py-2.5 text-center text-sm font-medium text-latao-700 transition peer-checked:border-latao-500 peer-checked:bg-latao-500 peer-checked:text-white">
                        <Crown className="size-4" /> Lançar na fatura do clube
                      </span>
                    </label>
                  )}
                  {podeFatura && <p className="mt-1.5 text-xs text-couro-400">O valor entra na próxima mensalidade do cliente, sem pagar agora.</p>}
                </fieldset>
                <button className="btn-destaque py-3 text-base">Receber e fechar</button>
              </FormAcao>
            </Secao>
          ) : (
            <Secao titulo="Resumo">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-couro-400">Itens</dt><dd className="tabular-nums">{formatarDinheiro(bruto)}</dd></div>
                {bruto !== subtotal && <div className="flex justify-between"><dt className="text-couro-400">Plano e pacotes</dt><dd>-{formatarDinheiro(bruto - subtotal)}</dd></div>}
                {comanda.descontoCentavos > 0 && <div className="flex justify-between"><dt className="text-couro-400">Desconto</dt><dd>-{formatarDinheiro(comanda.descontoCentavos)}</dd></div>}
                {comanda.sinalCentavos > 0 && <div className="flex justify-between"><dt className="text-couro-400">Sinal pago (Pix)</dt><dd>-{formatarDinheiro(comanda.sinalCentavos)}</dd></div>}
                {comanda.cashbackUsadoCentavos > 0 && <div className="flex justify-between"><dt className="text-couro-400">Cashback usado</dt><dd>-{formatarDinheiro(comanda.cashbackUsadoCentavos)}</dd></div>}
                <div className="flex justify-between border-t border-black/[0.06] pt-2 text-base font-semibold"><dt>Total pago</dt><dd className="numero">{formatarDinheiro(comanda.totalCentavos)}</dd></div>
                <div className="flex justify-between"><dt className="text-couro-400">Pagamento</dt><dd>{NOME_FORMA[comanda.formaPagamento ?? ""] ?? "—"}</dd></div>
                {extra && (
                  <div className="flex justify-between">
                    <dt className="text-couro-400">Fatura</dt>
                    <dd>
                      {extra.status === "PAGO" ? (
                        <Etiqueta tom="verde">Pago</Etiqueta>
                      ) : extra.status === "CANCELADO" ? (
                        <Etiqueta tom="neutro">Retirado</Etiqueta>
                      ) : extra.asaasPagamentoId ? (
                        <Etiqueta tom="latao">Vence {extra.vencimento?.split("-").reverse().join("/")}</Etiqueta>
                      ) : (
                        <Etiqueta tom="vermelho">Não lançado</Etiqueta>
                      )}
                    </dd>
                  </div>
                )}
                {comanda.cashbackGeradoCentavos > 0 && <div className="flex justify-between"><dt className="text-couro-400">Cashback gerado</dt><dd className="text-emerald-700">+{formatarDinheiro(comanda.cashbackGeradoCentavos)}</dd></div>}
                {comanda.fechadaEm && <div className="flex justify-between"><dt className="text-couro-400">Fechada em</dt><dd>{formatarDataHora(comanda.fechadaEm)}</dd></div>}
              </dl>
              {comanda.status === "FECHADA" && (
                <div className="mt-4 grid gap-2">
                  {comanda.cliente && (
                    <a href={linkWhatsApp(comanda.cliente.telefone, recibo)} target="_blank" className="btn-secundario">
                      <MessageCircle className="size-4 text-emerald-600" /> Enviar recibo por WhatsApp
                    </a>
                  )}
                  {extra?.status === "PENDENTE" && !extra.asaasPagamentoId && (
                    <FormAcao acao={relancarExtra} className="grid gap-1">
                      <input type="hidden" name="comandaId" value={comanda.id} />
                      {extra.erro && <p className="text-xs text-poste-vermelho">{extra.erro}</p>}
                      <button className="btn-secundario w-full"><Crown className="size-4" /> Lançar na fatura</button>
                    </FormAcao>
                  )}
                  {!sessao.profissionalId && (
                    <FormAcao acao={estornarFechada} className="grid gap-1">
                      <input type="hidden" name="comandaId" value={comanda.id} />
                      <button className="btn-perigo w-full">Cancelar e estornar</button>
                    </FormAcao>
                  )}
                </div>
              )}
            </Secao>
          )}
          {aberta && !sessao.profissionalId && (
            <form action={estornarComanda} className="mt-3 text-center">
              <input type="hidden" name="comandaId" value={comanda.id} />
              <button className="text-sm font-medium text-couro-400 hover:text-poste-vermelho">Descartar comanda</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
