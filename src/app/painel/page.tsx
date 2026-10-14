import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Cake,
  MessageCircle,
  CalendarDays,
  CircleDollarSign,
  Crown,
  Package,
  ReceiptText,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { GraficoBarras } from "@/components/GraficoBarras";
import { Avatar, Cabecalho, Etiqueta, Indicador, Secao, Vazio } from "@/components/ui";
import { exigirSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { estoquePorProduto } from "@/lib/estoque";
import { filialDoPainel, naFilial } from "@/lib/filial";
import { formatarDinheiro, linkWhatsApp } from "@/lib/formato";
import { criarDataHora, diaLocal, formatarDia, horaLocal, inicioEFimDoDia, limitesDoMes, somarDias, somarMeses } from "@/lib/tempo";

export const metadata: Metadata = { title: "Início" };
export const dynamic = "force-dynamic";

export default async function Inicio() {
  const sessao = await exigirSessao();
  if (sessao.papel === "PROFISSIONAL") redirect("/painel/agenda");
  const { salaoId } = sessao;
  const ctx = await filialDoPainel(sessao);
  const filtro = naFilial(ctx);
  const ativas = ctx.filiais.filter((f) => f.ativo);
  const hoje = diaLocal();
  const { inicio: iniHoje, fim: fimHoje } = inicioEFimDoDia(hoje);
  const mes = limitesDoMes(hoje);
  const mesPassado = limitesDoMes(somarMeses(hoje, -1));
  const iniGrafico = somarDias(hoje, -13);
  const ate = (dia: string) => criarDataHora(somarDias(dia, 1), "00:00");
  const de = (dia: string) => criarDataHora(dia, "00:00");

  const [agendamentosHoje, comandasPeriodo, abertas, caixas, produtos, contas, assinaturasVencidas, clientes, salao] =
    await Promise.all([
      db.agendamento.findMany({
        where: { salaoId, ...filtro, inicio: { gte: iniHoje, lt: fimHoje }, status: { not: "CANCELADO" } },
        include: { cliente: true, servico: true, profissional: true },
        orderBy: { inicio: "asc" },
      }),
      db.comanda.findMany({
        where: { salaoId, ...filtro, status: "FECHADA", fechadaEm: { gte: de(mesPassado.inicio < iniGrafico ? mesPassado.inicio : iniGrafico), lt: fimHoje } },
        select: { totalCentavos: true, fechadaEm: true },
      }),
      db.comanda.count({ where: { salaoId, ...filtro, status: "ABERTA" } }),
      db.caixa.findMany({ where: { salaoId, ...filtro, fechadoEm: null }, include: { filial: true } }),
      db.produto.findMany({ where: { salaoId, ativo: true }, select: { id: true, nome: true } }),
      db.contaPagar.findMany({ where: { salaoId, pagoEm: null, vencimento: { lte: somarDias(hoje, 7) } }, orderBy: { vencimento: "asc" } }),
      db.assinatura.count({ where: { salaoId, status: "ATIVA", pagoAte: { lt: hoje } } }),
      db.cliente.findMany({ where: { salaoId, nascimento: { not: null } }, select: { id: true, nome: true, telefone: true, nascimento: true } }),
      db.salao.findUniqueOrThrow({ where: { id: salaoId }, select: { nome: true, slug: true } }),
    ]);
  const amanhaIni = criarDataHora(somarDias(hoje, 1), "00:00");
  const semLembrete = await db.agendamento.findMany({
    where: { salaoId, ...filtro, status: { in: ["AGENDADO", "CONFIRMADO"] }, lembreteEnviadoEm: null, inicio: { gte: amanhaIni, lt: criarDataHora(somarDias(hoje, 2), "00:00") } },
    select: { id: true, grupo: true },
  });
  const lembretesAmanha = new Set(semLembrete.map((a) => a.grupo ?? a.id)).size;

  const somaEntre = (ini: string, fim: string) =>
    comandasPeriodo.filter((c) => c.fechadaEm && c.fechadaEm >= de(ini) && c.fechadaEm < ate(fim)).reduce((s, c) => s + c.totalCentavos, 0);
  const contaEntre = (ini: string, fim: string) => comandasPeriodo.filter((c) => c.fechadaEm && c.fechadaEm >= de(ini) && c.fechadaEm < ate(fim)).length;
  const fatHoje = somaEntre(hoje, hoje);
  const fatMes = somaEntre(mes.inicio, hoje);
  const diaEquivalente = somarDias(mesPassado.inicio, Number(hoje.slice(8)) - 1);
  const fatMesPassadoAteHoje = somaEntre(mesPassado.inicio, diaEquivalente < mesPassado.fim ? diaEquivalente : mesPassado.fim);
  const variacao = fatMesPassadoAteHoje ? Math.round(((fatMes - fatMesPassadoAteHoje) / fatMesPassadoAteHoje) * 100) : null;
  const atendimentosMes = contaEntre(mes.inicio, hoje);

  const grafico = Array.from({ length: 14 }, (_, i) => {
    const d = somarDias(iniGrafico, i);
    return { rotulo: d.slice(8), detalhe: formatarDia(d), valor: somaEntre(d, d) };
  });

  const agora = new Date();
  const proximos = agendamentosHoje.filter((a) => a.fim > agora && (a.status === "AGENDADO" || a.status === "CONFIRMADO"));
  const estoque = await estoquePorProduto(salaoId, ctx.atual?.id ?? null);
  const estoqueBaixo = produtos.filter((p) => estoque(p.id).baixo);
  const semana = Array.from({ length: 7 }, (_, i) => somarDias(hoje, i).slice(5));
  const aniversariantes = clientes.filter((c) => c.nascimento && semana.includes(c.nascimento.slice(5)));
  const hora = Number(horaLocal(agora).slice(0, 2));
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div>
      <Cabecalho
        titulo={`${saudacao}, ${sessao.nome.split(" ")[0]}`}
        descricao={`Resumo ${ctx.atual && ativas.length > 1 ? `da unidade ${ctx.atual.nome}` : ativas.length > 1 ? "de todas as unidades" : `do ${salao.nome}`} hoje`}
        acoes={
          <>
            <Link href="/painel/comandas/nova" className="btn-secundario">
              <ReceiptText className="size-4" /> Nova venda
            </Link>
            <Link href="/painel/agenda/novo" className="btn-destaque">
              <CalendarDays className="size-4" /> Agendar
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Faturado hoje" valor={formatarDinheiro(fatHoje)} icone={CircleDollarSign} destaque detalhe={`${contaEntre(hoje, hoje)} venda(s) fechada(s)`} />
        <Indicador rotulo="Atendimentos hoje" valor={agendamentosHoje.length} icone={CalendarDays} detalhe={`${proximos.length} ainda por vir`} />
        <Indicador
          rotulo="Faturado no mês"
          valor={formatarDinheiro(fatMes)}
          icone={TrendingUp}
          detalhe={variacao === null ? "Sem comparação com o mês passado" : `${variacao >= 0 ? "▲" : "▼"} ${Math.abs(variacao)}% vs. mesmo período do mês passado`}
        />
        <Indicador rotulo="Ticket médio do mês" valor={formatarDinheiro(atendimentosMes ? Math.round(fatMes / atendimentosMes) : 0)} icone={ReceiptText} detalhe={`${atendimentosMes} venda(s) no mês`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Secao titulo="Faturamento dos últimos 14 dias" acoes={<Link href="/painel/relatorios" className="text-sm font-semibold text-latao-700 hover:underline">Relatórios</Link>}>
            <GraficoBarras dados={grafico} titulo="Faturamento por dia nos últimos 14 dias" />
          </Secao>

          <Secao titulo="Próximos atendimentos de hoje" acoes={<Link href="/painel/agenda" className="text-sm font-semibold text-latao-700 hover:underline">Ver agenda</Link>}>
            {proximos.length === 0 ? (
              <Vazio icone={CalendarDays} titulo="Nenhum atendimento pela frente hoje" texto={`Divulgue seu link de agendamento: /b/${salao.slug}`} />
            ) : (
              <ul className="divide-y divide-black/[0.06]">
                {proximos.slice(0, 8).map((a) => (
                  <li key={a.id}>
                    <Link href={`/painel/agendamentos/${a.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-fundo">
                      <span className="numero w-14 text-lg">{horaLocal(a.inicio)}</span>
                      <Avatar nome={a.profissional.nome} foto={a.profissional.foto} tamanho={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{a.cliente.nome}</span>
                        <span className="block truncate text-sm text-couro-400">{a.servico.nome} com {a.profissional.nome}</span>
                      </span>
                      {a.status === "CONFIRMADO" ? <Etiqueta tom="azul">Confirmado</Etiqueta> : <Etiqueta tom="latao">Agendado</Etiqueta>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </div>

        <div className="space-y-4">
          <Secao titulo="Caixa">
            {ctx.atual ? (
              caixas[0] ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-couro-700">
                    <Etiqueta tom="verde">Aberto</Etiqueta> desde {horaLocal(caixas[0].abertoEm)}
                  </p>
                  <Link href="/painel/caixa" className="btn-secundario btn-pequeno">Ver caixa</Link>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-couro-400">O caixa de hoje ainda não foi aberto.</p>
                  <Link href="/painel/caixa" className="btn-primario btn-pequeno"><Wallet className="size-3.5" /> Abrir caixa</Link>
                </div>
              )
            ) : (
              <ul className="space-y-2 text-sm">
                {ativas.map((f) => {
                  const cx = caixas.find((c) => c.filialId === f.id);
                  return (
                    <li key={f.id} className="flex items-center justify-between gap-2">
                      <span className="font-medium">{f.nome}</span>
                      {cx ? <Etiqueta tom="verde">Aberto desde {horaLocal(cx.abertoEm)}</Etiqueta> : <Etiqueta>Fechado</Etiqueta>}
                    </li>
                  );
                })}
              </ul>
            )}
            {abertas > 0 && (
              <Link href="/painel/comandas" className="mt-3 flex items-center justify-between rounded-xl bg-latao-50 px-3 py-2.5 text-sm font-medium text-latao-700">
                {abertas} comanda(s) aberta(s) aguardando pagamento <ArrowRight className="size-4" />
              </Link>
            )}
          </Secao>

          <Secao titulo="Avisos">
            <ul className="space-y-2.5 text-sm">
              {lembretesAmanha > 0 && (
                <Aviso href="/painel/lembretes" icone={MessageCircle} texto={`${lembretesAmanha} cliente(s) de amanhã ainda sem lembrete no WhatsApp`} />
              )}
              {estoqueBaixo.length > 0 && (
                <Aviso href="/painel/produtos" icone={Package} texto={`${estoqueBaixo.length} produto(s) com estoque baixo: ${estoqueBaixo.slice(0, 3).map((p) => p.nome).join(", ")}`} />
              )}
              {contas.map((c) => (
                <Aviso
                  key={c.id}
                  href="/painel/financeiro"
                  icone={TriangleAlert}
                  alerta={c.vencimento < hoje}
                  texto={`${c.descricao}: ${formatarDinheiro(c.valorCentavos)} ${c.vencimento < hoje ? "venceu" : "vence"} em ${formatarDia(c.vencimento)}`}
                />
              ))}
              {assinaturasVencidas > 0 && (
                <Aviso href="/painel/assinaturas" icone={Crown} alerta texto={`${assinaturasVencidas} assinatura(s) com mensalidade atrasada`} />
              )}
              {lembretesAmanha === 0 && estoqueBaixo.length === 0 && contas.length === 0 && assinaturasVencidas === 0 && (
                <li className="text-couro-400">Tudo em dia por aqui.</li>
              )}
            </ul>
          </Secao>

          <Secao titulo="Aniversariantes da semana">
            {aniversariantes.length === 0 ? (
              <p className="text-sm text-couro-400">Nenhum aniversário nos próximos 7 dias.</p>
            ) : (
              <ul className="space-y-2">
                {aniversariantes.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/painel/clientes/${c.id}`} className="flex items-center gap-2 font-medium hover:underline">
                      <Cake className="size-4 text-latao-600" /> {c.nome}
                      <span className="text-couro-400">{formatarDia(`2000-${c.nascimento!.slice(5)}`).slice(0, 5)}</span>
                    </Link>
                    <a
                      href={linkWhatsApp(c.telefone, `Feliz aniversário, ${c.nome.split(" ")[0]}! 🎉 A equipe do ${salao.nome} te deseja um ótimo dia. Passa aqui pra ficar na régua!`)}
                      target="_blank"
                      className="text-xs font-semibold text-emerald-700 hover:underline"
                    >
                      Parabenizar
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </div>
      </div>
    </div>
  );
}

function Aviso({ href, icone: Icone, texto, alerta }: { href: string; icone: typeof Package; texto: string; alerta?: boolean }) {
  return (
    <li>
      <Link href={href} className="flex items-start gap-2.5 rounded-xl p-1 hover:bg-fundo">
        <Icone className={`mt-0.5 size-4 shrink-0 ${alerta ? "text-poste-vermelho" : "text-latao-600"}`} />
        <span>{texto}</span>
      </Link>
    </li>
  );
}
