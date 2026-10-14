import { ErroAsaas, buscarCobranca, cancelarAssinaturaAsaas, cobrancasPendentes, criarAssinatura, criarCliente, excluirCobranca, linkDaPrimeiraCobranca } from "./asaas";
import { lancarNaFatura } from "./extrasFatura";
import { db } from "./db";
import { garantirVagaDeAssinante } from "./planosSistema";
import { diaLocal, somarDias } from "./tempo";

export class ErroClube extends Error {}

/** O salão pode cobrar o clube online (subconta aprovada e cobrança ligada)? */
export function cobraOnline(b: { asaasApiKey: string | null; asaasStatus: string | null; cobrancaOnlineClube: boolean }) {
  return !!b.asaasApiKey && b.asaasStatus === "APPROVED" && b.cobrancaOnlineClube;
}

export function cpfValido(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(cpf[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
}

/**
 * Cria a assinatura do clube com cobrança recorrente no Asaas (subconta do salão).
 * A assinatura é no cartão de crédito: o cliente informa o cartão no link da 1ª cobrança e as
 * próximas mensalidades são debitadas sozinhas, sem ele precisar aprovar nada.
 * Fica "AGUARDANDO" até o primeiro pagamento chegar pelo webhook.
 */
export async function assinarClubeOnline(p: { salaoId: string; clienteId: string; planoId: string; cpf: string }) {
  const [b, cliente, plano, config] = await Promise.all([
    db.salao.findUniqueOrThrow({ where: { id: p.salaoId } }),
    db.cliente.findFirst({ where: { id: p.clienteId, salaoId: p.salaoId } }),
    db.plano.findFirst({ where: { id: p.planoId, salaoId: p.salaoId, ativo: true } }),
    db.configSistema.findUnique({ where: { id: "geral" } }),
  ]);
  if (!cobraOnline(b)) throw new ErroClube("A cobrança online do clube não está ligada nesta salão.");
  if (!cliente) throw new ErroClube("Cliente não encontrado.");
  if (!plano) throw new ErroClube("Plano não encontrado.");
  if (!cpfValido(p.cpf)) throw new ErroClube("CPF inválido.");
  const existente = await db.assinatura.findFirst({ where: { clienteId: cliente.id, status: { in: ["ATIVA", "AGUARDANDO"] } } });
  if (existente?.status === "ATIVA") throw new ErroClube(`${cliente.nome} já tem uma assinatura ativa.`);
  if (existente?.status === "AGUARDANDO" && existente.linkPagamento) return { assinaturaId: existente.id, link: existente.linkPagamento };
  // clique duplo / duas abas: a primeira ainda está criando no Asaas
  if (existente?.status === "AGUARDANDO" && existente.criadoEm > new Date(Date.now() - 2 * 60_000))
    throw new ErroClube("A assinatura já está sendo criada. Aguarde alguns segundos e atualize a página.");
  await garantirVagaDeAssinante(p.salaoId);

  const chave = b.asaasApiKey!;
  let asaasClienteId = cliente.asaasClienteId;
  if (!asaasClienteId || cliente.cpf !== p.cpf) {
    asaasClienteId = (await criarCliente({ name: cliente.nome, cpfCnpj: p.cpf, mobilePhone: cliente.telefone, email: cliente.email ?? undefined, externalReference: cliente.id }, chave)).id;
    await db.cliente.update({ where: { id: cliente.id }, data: { cpf: p.cpf, asaasClienteId } });
  }

  const local = await db.assinatura.create({
    data: { salaoId: b.id, clienteId: cliente.id, planoId: plano.id, status: "AGUARDANDO", pagoAte: somarDias(diaLocal(), -1) },
  });
  try {
    const taxa = config?.taxaPlataformaPct ?? 0;
    const split = taxa > 0 && config?.asaasWalletId ? [{ walletId: config.asaasWalletId, percentualValue: taxa }] : undefined;
    const asaas = await criarAssinatura(
      {
        customer: asaasClienteId,
        value: plano.precoCentavos / 100,
        nextDueDate: diaLocal(),
        cycle: "MONTHLY",
        description: `${plano.nome} · ${b.nome}`,
        externalReference: local.id,
        split,
        billingType: "CREDIT_CARD",
      },
      chave,
    );
    const link = await linkDaPrimeiraCobranca(asaas.id, chave);
    await db.assinatura.update({ where: { id: local.id }, data: { asaasId: asaas.id, linkPagamento: link } });
    return { assinaturaId: local.id, link };
  } catch (e) {
    await db.assinatura.delete({ where: { id: local.id } });
    throw e;
  }
}

/**
 * Cancela a cobrança recorrente no Asaas.
 * Pelo salão: encerra na hora. Pelo cliente: para de cobrar, mas o plano vale até o fim do período já pago.
 * Extras que estavam na próxima mensalidade viram uma cobrança avulsa.
 */
export async function cancelarAssinaturaDoClube(salaoId: string, assinaturaId: string, opcoes: { peloCliente?: boolean } = {}) {
  const a = await db.assinatura.findFirst({ where: { id: assinaturaId, salaoId }, include: { salao: true } });
  if (!a) return;
  const extrasPendentes = await db.extraFatura.findMany({ where: { assinaturaId: a.id, status: "PENDENTE", asaasPagamentoId: { not: null } } });
  const chave = a.salao.asaasApiKey;
  if (a.asaasId && chave) {
    try {
      await cancelarAssinaturaAsaas(a.asaasId, chave);
    } catch (e) {
      if (!(e instanceof ErroAsaas)) throw e;
      throw new ErroClube(`Não foi possível cancelar a cobrança no Asaas: ${e.message}`);
    }
    // garante que nenhuma mensalidade em aberto continue valendo depois do cancelamento
    const pendentes = await cobrancasPendentes(a.asaasId, chave).catch(() => []);
    for (const c of pendentes) await excluirCobranca(c.id, chave).catch(() => null);
  }
  const continuaAteOFim = opcoes.peloCliente && a.status === "ATIVA" && a.pagoAte >= diaLocal();
  await db.assinatura.update({
    where: { id: a.id },
    data: continuaAteOFim ? { canceladaEm: new Date(), linkPagamento: null } : { status: "CANCELADA", canceladaEm: a.canceladaEm ?? new Date(), linkPagamento: null },
  });
  // extras que estavam na mensalidade (que não existe mais) vão para uma cobrança avulsa
  for (const e of extrasPendentes) {
    try {
      const cobranca = chave && e.asaasPagamentoId ? await buscarCobranca(e.asaasPagamentoId, chave).catch(() => null) : null;
      if (cobranca && !cobranca.subscription && cobranca.status === "PENDING") continue; // já era avulsa
      await db.extraFatura.update({ where: { id: e.id }, data: { asaasPagamentoId: null, vencimento: null } });
      await lancarNaFatura(e.id);
    } catch {
      // fica "não lançado" na comanda, com o botão para tentar de novo
    }
  }
}
