import { RegistrarApp } from "@/components/AppDoSalao";
import { checkinAutomatico } from "@/lib/agenda";
import { Menu } from "@/components/Menu";
import { exigirSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { filialDoPainel } from "@/lib/filial";
import { linkWhatsApp } from "@/lib/formato";
import { recursosDoSalao, situacaoDaSalao } from "@/lib/planosSistema";
import { formatarDia } from "@/lib/tempo";
import Link from "next/link";
import { sair } from "../login/actions";
import { trocarFilial } from "./unidades/actions";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao();
  // horário que já passou vira atendido sozinho (o profissional só marca quando o cliente faltou)
  await checkinAutomatico(sessao.salaoId);
  const salao = await db.salao.findUnique({
    where: { id: sessao.salaoId },
    select: { nome: true, logo: true, suspensa: true, pagoAte: true, cobrancaSistemaCartao: true, asaasAssinaturaSistema: true, linkPagamentoSistema: true },
  });
  const suporte = (await db.configSistema.findUnique({ where: { id: "geral" } }))?.whatsappSuporte ?? null;
  const situacao = salao ? situacaoDaSalao(salao) : "EM_DIA";

  if (situacao === "SUSPENSA") {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-md text-center">
          <p className="font-display text-2xl font-bold">Acesso suspenso</p>
          <p className="mt-2 text-couro-700">
            O acesso do {salao?.nome} ao Klareza Beauty está suspenso por falta de pagamento. Os dados estão guardados e voltam assim que a
            mensalidade for regularizada.
          </p>
          {suporte && (
            <a href={linkWhatsApp(suporte, `Olá! Sou do ${salao?.nome} e quero regularizar a mensalidade do Klareza Beauty.`)} target="_blank" className="btn-destaque mt-5">
              Falar com o Klareza Beauty
            </a>
          )}
          <form action={sair} className="mt-3">
            <button className="text-sm text-couro-400 underline">Sair</button>
          </form>
        </div>
      </main>
    );
  }
  const { filiais, atual } = await filialDoPainel(sessao);
  const recursos = await recursosDoSalao(sessao.salaoId);

  return (
    <div className="min-h-screen">
      <RegistrarApp />
      <Menu
        salao={salao?.nome ?? ""}
        logo={salao?.logo ?? null}
        usuario={sessao.nome}
        papel={sessao.papel}
        recursos={{ clube: recursos.clube, financeiro: recursos.financeiro, equipe: recursos.equipe, pagamentos: recursos.clube || recursos.sinal }}
        sair={sair}
        filiais={filiais.filter((f) => f.ativo).map((f) => ({ id: f.id, nome: f.nome }))}
        filialAtual={atual}
        trocarFilial={trocarFilial}
      />
      <main className="px-4 py-6 sm:px-6 lg:ml-64 lg:px-10 lg:py-8">
        {/* no débito automático (cartão já cadastrado) não precisa lembrar do vencimento: só se atrasar */}
        {(situacao === "ATRASADA" || (situacao === "VENCENDO" && !(salao?.cobrancaSistemaCartao && salao.asaasAssinaturaSistema && !salao.linkPagamentoSistema))) &&
          sessao.papel !== "PROFISSIONAL" && (
          <div className={`mx-auto mb-5 flex max-w-[1400px] flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3 text-sm ${situacao === "ATRASADA" ? "bg-poste-vermelho/10 text-poste-vermelho" : "bg-latao-100 text-latao-700"}`}>
            <span>
              {situacao === "ATRASADA" ? "A mensalidade do Klareza Beauty venceu em " : "A mensalidade do Klareza Beauty vence em "}
              <strong>{formatarDia(salao!.pagoAte!)}</strong>.
            </span>
            <Link href="/painel/plano" className="font-semibold underline">Ver meu plano</Link>
          </div>
        )}
        <div className="mx-auto max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
