import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { FORMA_ASAAS, cobrancaNoAsaas } from "@/lib/asaas";
import { tokenConfere } from "@/lib/cripto";
import { db } from "@/lib/db";
import { quitarExtrasDaCobranca } from "@/lib/extrasFatura";
import { sinalPago } from "@/lib/sinal";
import { somarMeses } from "@/lib/tempo";

// Avisos do Asaas (conta principal e subcontas). Responde 200 para tudo que não é
// erro de autenticação, para o Asaas não travar a fila de envios.

type Pagamento = {
  id: string;
  subscription?: string | null;
  value: number;
  netValue?: number;
  billingType?: string;
  dueDate: string;
  invoiceUrl?: string;
};

const PAGO = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);
const NOVA_COBRANCA = new Set(["PAYMENT_CREATED", "PAYMENT_OVERDUE"]);
// cobrança no cartão que não passou: o cliente precisa atualizar o cartão pelo link
const COBRANCA_COM_PROBLEMA = new Set(["PAYMENT_OVERDUE", "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED"]);

const maior = (a: string | null, b: string) => (a && a > b ? a : b);
const STATUS_PAGO = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

/**
 * O corpo do webhook não é a fonte da verdade: quem tiver o token poderia forjar "pago" com qualquer valor
 * ou trocar o link de pagamento por um site falso. Por isso a cobrança é sempre buscada de novo no Asaas,
 * na conta certa, e só o que o Asaas devolve é usado.
 */
async function confirmar(payment: Pagamento, apiKeyCifrada: string | null, assinaturaEsperada: string | null) {
  let real;
  try {
    real = await cobrancaNoAsaas(payment.id, apiKeyCifrada);
  } catch (e) {
    // Asaas fora do ar: 503 para ele reenviar depois. Cobrança inexistente (forjada): ignora com 200.
    const temporario = !(e instanceof Error) || /falar com o Asaas|instabilidade/.test(e.message);
    if (temporario) return { resposta: NextResponse.json({ erro: "não foi possível conferir no Asaas" }, { status: 503 }) };
    return { resposta: NextResponse.json({ ok: true, ignorado: "cobrança não existe no Asaas" }) };
  }
  // não confere (forjado ou de outra conta): responde 200 para não travar a fila de envios do Asaas
  if ((real.subscription ?? null) !== assinaturaEsperada) return { resposta: NextResponse.json({ ok: true, ignorado: "cobrança não confere com o Asaas" }) };
  return { real: real as Pagamento & { status: string } };
}

export async function POST(req: Request) {
  if (!tokenConfere(req.headers.get("asaas-access-token"))) return NextResponse.json({ erro: "token inválido" }, { status: 401 });

  let corpo: { event?: string; payment?: Pagamento };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: true, ignorado: "corpo inválido" });
  }
  const { event } = corpo;
  let payment = corpo.payment;
  if (!event || !payment?.id) return NextResponse.json({ ok: true, ignorado: "sem cobrança" });

  // Sinal do agendamento online (Pix na subconta do salão)
  if (!payment.subscription) {
    const comSinal = await db.agendamento.findUnique({ where: { sinalAsaasId: payment.id }, include: { salao: { select: { asaasApiKey: true } } } });
    if (comSinal) {
      const conferida = await confirmar(payment, comSinal.salao.asaasApiKey, null);
      if (!conferida.real) return conferida.resposta;
      if (PAGO.has(event) && STATUS_PAGO.has(conferida.real.status)) await sinalPago(comSinal.id);
      revalidatePath("/painel", "layout");
      revalidatePath("/b", "layout");
      return NextResponse.json({ ok: true, tipo: "sinal" });
    }
  }

  // Cobrança avulsa de extras (quando não havia mensalidade em aberto para somar)
  if (!payment.subscription) {
    const extra = await db.extraFatura.findFirst({ where: { asaasPagamentoId: payment.id }, include: { salao: { select: { asaasApiKey: true } } } });
    if (!extra) return NextResponse.json({ ok: true, ignorado: "cobrança desconhecida" });
    const conferida = await confirmar(payment, extra.salao.asaasApiKey, null);
    if (!conferida.real) return conferida.resposta;
    const real = conferida.real;
    if (PAGO.has(event) && STATUS_PAGO.has(real.status)) await quitarExtrasDaCobranca(real.id);
    revalidatePath("/painel", "layout");
    return NextResponse.json({ ok: true, tipo: "extra" });
  }

  // 1) Mensalidade do clube de um salão (subconta)
  const assinatura = await db.assinatura.findUnique({ where: { asaasId: payment.subscription }, include: { salao: { select: { asaasApiKey: true } } } });
  if (assinatura) {
    const conferida = await confirmar(payment, assinatura.salao.asaasApiKey, assinatura.asaasId);
    if (!conferida.real) return conferida.resposta;
    const real = conferida.real;
    payment = real;
    // Clube no cartão: as mensalidades são debitadas sozinhas. O link só serve para cadastrar o cartão
    // (assinatura aguardando o 1º pagamento) ou para trocar um cartão recusado.
    const precisaDoCliente = assinatura.status === "AGUARDANDO" || COBRANCA_COM_PROBLEMA.has(event);
    if ((NOVA_COBRANCA.has(event) || COBRANCA_COM_PROBLEMA.has(event)) && payment.invoiceUrl && precisaDoCliente) {
      await db.assinatura.update({ where: { id: assinatura.id }, data: { linkPagamento: payment.invoiceUrl } });
    }
    if (PAGO.has(event) && STATUS_PAGO.has(real.status) && !(await db.pagamentoAssinatura.findUnique({ where: { asaasPagamentoId: payment.id } }))) {
      // extras que vieram nesta cobrança já contam como venda na comanda: aqui fica só a mensalidade
      const extras = await quitarExtrasDaCobranca(payment.id);
      const valor = Math.round(payment.value * 100);
      const liquido = payment.netValue !== undefined ? Math.round(payment.netValue * 100) : null;
      await db.$transaction([
        db.pagamentoAssinatura.create({
          data: {
            assinaturaId: assinatura.id,
            valorCentavos: Math.max(0, valor - extras),
            formaPagamento: FORMA_ASAAS[payment.billingType ?? ""] ?? "PIX",
            asaasPagamentoId: payment.id,
            valorLiquidoCentavos: liquido === null ? null : Math.max(0, Math.round(liquido * (1 - extras / Math.max(1, valor)))),
          },
        }),
        db.assinatura.update({
          where: { id: assinatura.id },
          data: {
            status: assinatura.status === "CANCELADA" ? "CANCELADA" : "ATIVA",
            pagoAte: maior(assinatura.pagoAte, somarMeses(payment.dueDate, 1)),
            linkPagamento: null,
          },
        }),
      ]);
    }
    revalidatePath("/painel", "layout");
    revalidatePath("/b", "layout");
    return NextResponse.json({ ok: true, tipo: "clube" });
  }

  // 2) Mensalidade do Klareza Beauty paga por um salão (conta principal)
  const salao = await db.salao.findUnique({ where: { asaasAssinaturaSistema: payment.subscription } });
  if (salao) {
    const conferida = await confirmar(payment, null, salao.asaasAssinaturaSistema);
    if (!conferida.real) return conferida.resposta;
    const real = conferida.real;
    payment = real;
    // No cartão, o link só aparece para cadastrar o cartão (antes do 1º pagamento) ou trocar um cartão recusado.
    const jaPagouNoAsaas = salao.cobrancaSistemaCartao && (await db.pagamentoSistema.count({ where: { salaoId: salao.id, asaasPagamentoId: { not: null } } })) > 0;
    const mostrarLink = !salao.cobrancaSistemaCartao || !jaPagouNoAsaas || COBRANCA_COM_PROBLEMA.has(event);
    if ((NOVA_COBRANCA.has(event) || COBRANCA_COM_PROBLEMA.has(event)) && payment.invoiceUrl && mostrarLink) {
      await db.salao.update({ where: { id: salao.id }, data: { linkPagamentoSistema: payment.invoiceUrl } });
    }
    if (PAGO.has(event) && STATUS_PAGO.has(real.status) && !(await db.pagamentoSistema.findUnique({ where: { asaasPagamentoId: payment.id } }))) {
      const ate = maior(salao.pagoAte, somarMeses(payment.dueDate, salao.ciclo === "ANUAL" ? 12 : 1));
      await db.$transaction([
        db.pagamentoSistema.create({
          data: {
            salaoId: salao.id,
            plano: salao.plano,
            ciclo: salao.ciclo,
            valorCentavos: Math.round(payment.value * 100),
            referenteAte: ate,
            observacao: "Pago pelo Asaas",
            asaasPagamentoId: payment.id,
          },
        }),
        db.salao.update({ where: { id: salao.id }, data: { pagoAte: ate, suspensa: false, linkPagamentoSistema: null } }),
      ]);
    }
    revalidatePath("/painel", "layout");
    revalidatePath("/admin");
    return NextResponse.json({ ok: true, tipo: "sistema" });
  }

  return NextResponse.json({ ok: true, ignorado: "assinatura desconhecida" });
}
