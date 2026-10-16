import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { TabelaPlanos } from "@/components/TabelaPlanos";
import { Cabecalho, Etiqueta, Secao } from "@/components/ui";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatarDinheiro, linkWhatsApp } from "@/lib/formato";
import { PLANOS_SISTEMA, usoDoPlano, valorDoCiclo } from "@/lib/planosSistema";
import { formatarDataHora, formatarDia } from "@/lib/tempo";

export const metadata: Metadata = { title: "Meu plano" };
export const dynamic = "force-dynamic";

const SITUACAO = {
  EM_DIA: { r: "Em dia", t: "verde" },
  VENCENDO: { r: "Vence em breve", t: "latao" },
  ATRASADA: { r: "Atrasada", t: "vermelho" },
  SUSPENSA: { r: "Suspensa", t: "neutro" },
  SEM_CONTROLE: { r: "Ativo", t: "verde" },
} as const;

function Barra({ rotulo, usado, limite }: { rotulo: string; usado: number; limite: number | null }) {
  const pct = limite ? Math.min(100, (usado / limite) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="font-medium">{rotulo}</span>
        <span className="tabular-nums text-couro-700">{usado} de {limite ?? "ilimitado"}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-fundo">
        <div className={`h-full rounded-full ${pct >= 100 ? "bg-poste-vermelho" : pct >= 80 ? "bg-latao-600" : "bg-latao-500"}`} style={{ width: limite ? `${pct}%` : "6%" }} />
      </div>
    </div>
  );
}

export default async function MeuPlano() {
  const { salaoId } = await exigirGestor();
  const [uso, salao, config, pagamentos] = await Promise.all([
    usoDoPlano(salaoId),
    db.salao.findUniqueOrThrow({ where: { id: salaoId }, select: { nome: true, linkPagamentoSistema: true, asaasAssinaturaSistema: true, cobrancaSistemaCartao: true } }),
    db.configSistema.findUnique({ where: { id: "geral" } }),
    db.pagamentoSistema.findMany({ where: { salaoId }, orderBy: { pagoEm: "desc" }, take: 12 }),
  ]);
  const suporte = config?.whatsappSuporte;
  const sit = SITUACAO[uso.situacao];

  return (
    <div>
      <Cabecalho titulo="Meu plano" descricao="Sua assinatura do Klareza Beauty." />
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Secao titulo={<span className="flex items-center gap-2">Plano {uso.plano.nome} <Etiqueta tom={sit.t}>{sit.r}</Etiqueta></span>}>
          <p className="numero text-3xl">
            {formatarDinheiro(valorDoCiclo(uso.codigo, uso.ciclo))}
            <span className="text-base font-normal text-couro-400">/{uso.ciclo === "ANUAL" ? "ano" : "mês"}</span>
          </p>
          {uso.pagoAte && <p className="mt-1 text-sm text-couro-700">Pago até <strong>{formatarDia(uso.pagoAte)}</strong></p>}
          {salao.asaasAssinaturaSistema && (
            <p className="mt-1 text-xs text-couro-400">
              {salao.cobrancaSistemaCartao
                ? "Débito automático no cartão: a mensalidade é cobrada sozinha e o vencimento renova, sem você precisar pagar todo mês."
                : "Cobrança pelo Asaas: todo mês chega um link para pagar por Pix ou boleto, e o vencimento renova quando o pagamento entra."}
            </p>
          )}
          {salao.linkPagamentoSistema && (
            <a href={salao.linkPagamentoSistema} target="_blank" className="btn-destaque mt-4">
              {!salao.cobrancaSistemaCartao
                ? "Pagar mensalidade (Pix ou boleto)"
                : pagamentos.some((p) => p.asaasPagamentoId)
                  ? "Cobrança no cartão não passou: atualizar cartão"
                  : "Cadastrar cartão e ativar débito automático"}
            </a>
          )}
          {suporte && (
            <a
              href={linkWhatsApp(suporte, `Olá! Sou do ${salao.nome} (plano ${uso.plano.nome}) e quero falar sobre a mensalidade do Klareza Beauty.`)}
              target="_blank"
              className="btn-secundario btn-pequeno mt-4"
            >
              <MessageCircle className="size-3.5 text-emerald-600" /> Falar sobre pagamento
            </a>
          )}
        </Secao>
        <Secao titulo="Uso do plano">
          <div className="space-y-5">
            <Barra rotulo="Unidades ativas" usado={uso.unidades} limite={uso.plano.unidades} />
            <Barra rotulo="Assinantes ativos no clube" usado={uso.assinantes} limite={uso.plano.assinantes} />
            <Barra rotulo="Profissionais ativas" usado={uso.profissionais} limite={uso.plano.profissionais} />
          </div>
        </Secao>
      </div>

      <h2 className="mb-4 font-display text-xl font-bold">Planos</h2>
      <TabelaPlanos
        atual={uso.codigo}
        acao={(c) =>
          c === uso.codigo ? (
            <p className="text-center text-sm font-semibold text-latao-700">Plano atual</p>
          ) : suporte ? (
            <a
              href={linkWhatsApp(suporte, `Olá! Sou do ${salao.nome} e quero mudar do plano ${uso.plano.nome} para o plano ${PLANOS_SISTEMA[c].nome}.`)}
              target="_blank"
              className="btn-primario w-full"
            >
              Mudar para {PLANOS_SISTEMA[c].nome}
            </a>
          ) : null
        }
      />

      {pagamentos.length > 0 && (
        <Secao titulo="Pagamentos" className="mt-6 max-w-2xl">
          <ul className="divide-y divide-black/[0.06] text-sm">
            {pagamentos.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 py-2.5">
                <span>
                  {formatarDataHora(p.pagoEm)}
                  <span className="block text-xs text-couro-400">Cobre até {formatarDia(p.referenteAte)}</span>
                </span>
                <span className="font-semibold tabular-nums">{formatarDinheiro(p.valorCentavos)}</span>
              </li>
            ))}
          </ul>
        </Secao>
      )}
    </div>
  );
}
