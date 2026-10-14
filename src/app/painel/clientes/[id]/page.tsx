import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarDays, ClipboardList, Crown, Gift, ImageIcon, MessageCircle, ReceiptText, Ticket, Trash2 } from "lucide-react";
import { FormAcao } from "@/components/FormAcao";
import { FotoUpload } from "@/components/FotoUpload";
import { Cabecalho, Etiqueta, Indicador, Secao } from "@/components/ui";
import { PERGUNTAS_SIM_NAO, PERGUNTAS_TEXTO, alertasDaAnamnese, lerAnamnese } from "@/lib/anamnese";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { NOME_FORMA, formatarDinheiro, formatarTelefone, linkWhatsApp } from "@/lib/formato";
import { filialDoPainel } from "@/lib/filial";
import { pacotesDaCliente } from "@/lib/pacotes";
import { enderecoDoSite } from "@/lib/site";
import { diaLocal, formatarDataHora, formatarDia } from "@/lib/tempo";
import { definirSenhaDoApp, salvarCliente } from "../../actions";
import { novaComanda } from "../../comandas/actions";
import { adicionarFoto, excluirFoto, salvarAnamnese } from "../actions";

export const metadata: Metadata = { title: "Cliente" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { r: string; t: "latao" | "azul" | "verde" | "neutro" | "vermelho" }> = {
  AGENDADO: { r: "Agendado", t: "latao" },
  CONFIRMADO: { r: "Confirmado", t: "azul" },
  CONCLUIDO: { r: "Concluído", t: "verde" },
  CANCELADO: { r: "Cancelado", t: "neutro" },
  FALTOU: { r: "Faltou", t: "vermelho" },
};

export default async function Cliente({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirGestor();
  const { salaoId } = sessao;
  const id = (await params).id;
  if (id === "novo") return <FormCliente />;

  const c = await db.cliente.findFirst({
    where: { id, salaoId },
    include: {
      agendamentos: { include: { servico: true, profissional: true }, orderBy: { inicio: "desc" }, take: 30 },
      comandas: { where: { status: "FECHADA" }, include: { itens: true }, orderBy: { fechadaEm: "desc" } },
      assinaturas: { include: { plano: true }, orderBy: { criadoEm: "desc" } },
      salao: { select: { nome: true, slug: true } },
      fotos: { orderBy: { criadoEm: "desc" } },
    },
  });
  if (!c) notFound();
  const pacotes = await pacotesDaCliente(c.id);
  const anamnese = lerAnamnese(c.anamnese);
  const alertas = alertasDaAnamnese(anamnese);
  const site = await enderecoDoSite();
  const ctx = await filialDoPainel(sessao);

  const gasto = c.comandas.reduce((s, x) => s + x.totalCentavos, 0);
  const visitas = c.comandas.length;
  const datas = c.comandas.map((x) => x.fechadaEm!.getTime()).sort((a, b) => a - b);
  const frequencia = datas.length > 1 ? Math.round((datas[datas.length - 1] - datas[0]) / 864e5 / (datas.length - 1)) : null;
  const faltas = c.agendamentos.filter((a) => a.status === "FALTOU").length;
  const ativa = c.assinaturas.find((a) => a.status === "ATIVA");
  const contagem = new Map<string, number>();
  c.comandas.flatMap((x) => x.itens).filter((i) => i.tipo === "SERVICO").forEach((i) => contagem.set(i.descricao, (contagem.get(i.descricao) ?? 0) + 1));
  const preferido = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <div className="mx-auto max-w-6xl">
      <Cabecalho
        voltar={{ href: "/painel/clientes", rotulo: "Clientes" }}
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            {c.nome}
            {ativa && <Etiqueta tom="latao"><Crown className="mr-1 size-3" /> {ativa.plano.nome}</Etiqueta>}
            {alertas.length > 0 && <Etiqueta tom="vermelho"><AlertTriangle className="mr-1 size-3" /> Atenção na ficha</Etiqueta>}
          </span>
        }
        descricao={`${formatarTelefone(c.telefone)} · cliente desde ${formatarDia(diaLocal(c.criadoEm))}`}
        acoes={
          <>
            <a href={linkWhatsApp(c.telefone, `Olá, ${c.nome.split(" ")[0]}! Que tal agendar seu próximo horário no ${c.salao.nome}? ${site}/b/${c.salao.slug}`)} target="_blank" className="btn-secundario">
              <MessageCircle className="size-4 text-emerald-600" /> WhatsApp
            </a>
            <FormAcao acao={novaComanda}>
              <input type="hidden" name="clienteId" value={c.id} />
              <input type="hidden" name="filialId" value={ctx.atual?.id ?? ctx.filiais.find((f) => f.ativo)?.id ?? ""} />
              <button className="btn-secundario"><ReceiptText className="size-4" /> Nova comanda</button>
            </FormAcao>
            <Link href={`/painel/agenda/novo?cliente=${c.id}`} className="btn-destaque"><CalendarDays className="size-4" /> Agendar</Link>
          </>
        }
      />

      {alertas.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-poste-vermelho/30 bg-poste-vermelho/5 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-poste-vermelho" />
          <span><strong>Atenção antes do atendimento:</strong> {alertas.join(" · ")}</span>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Indicador rotulo="Visitas" valor={visitas} />
        <Indicador rotulo="Total gasto" valor={formatarDinheiro(gasto)} destaque />
        <Indicador rotulo="Ticket médio" valor={formatarDinheiro(visitas ? Math.round(gasto / visitas) : 0)} />
        <Indicador rotulo="Volta a cada" valor={frequencia ? `${frequencia} dias` : "—"} detalhe={preferido ? `Costuma fazer: ${preferido}` : undefined} />
        <Indicador rotulo="Cashback" valor={formatarDinheiro(c.saldoCashbackCentavos)} icone={Gift} detalhe={faltas ? `${faltas} falta(s) no histórico` : "Nenhuma falta"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Secao titulo="Histórico de agendamentos">
            {c.agendamentos.length === 0 ? (
              <p className="text-sm text-couro-400">Nenhum agendamento ainda.</p>
            ) : (
              <ul className="divide-y divide-black/[0.06]">
                {c.agendamentos.map((a) => (
                  <li key={a.id}>
                    <Link href={`/painel/agendamentos/${a.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm hover:bg-fundo">
                      <span className="w-32 shrink-0 tabular-nums text-couro-400">{formatarDataHora(a.inicio)}</span>
                      <span className="flex-1 truncate">{a.servico.nome} com {a.profissional.nome}</span>
                      <Etiqueta tom={STATUS[a.status]?.t ?? "neutro"}>{STATUS[a.status]?.r ?? a.status}</Etiqueta>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
          <Secao titulo="Compras">
            {c.comandas.length === 0 ? (
              <p className="text-sm text-couro-400">Nenhuma compra registrada.</p>
            ) : (
              <ul className="divide-y divide-black/[0.06]">
                {c.comandas.slice(0, 20).map((x) => (
                  <li key={x.id}>
                    <Link href={`/painel/comandas/${x.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm hover:bg-fundo">
                      <span className="w-32 shrink-0 tabular-nums text-couro-400">{formatarDataHora(x.fechadaEm!)}</span>
                      <span className="flex-1 truncate">{x.itens.map((i) => i.descricao).join(", ")}</span>
                      <span className="text-couro-400">{NOME_FORMA[x.formaPagamento ?? ""]}</span>
                      <span className="w-20 text-right font-semibold tabular-nums">{formatarDinheiro(x.totalCentavos)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
          <Secao titulo="Antes e depois">
            {c.fotos.length === 0 ? (
              <p className="mb-4 text-sm text-couro-400">Nenhuma foto ainda. As fotos ficam só no painel, o cliente não vê.</p>
            ) : (
              <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {c.fotos.map((f) => (
                  <li key={f.id} className="group relative overflow-hidden rounded-xl border border-black/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.imagem} alt={f.legenda ?? (f.tipo === "DEPOIS" ? "Depois" : "Antes")} className="aspect-square w-full object-cover" />
                    <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-xs">
                      <span className="min-w-0 truncate">
                        <strong>{f.tipo === "DEPOIS" ? "Depois" : "Antes"}</strong> · {formatarDia(diaLocal(f.criadoEm)).slice(0, 5)}
                        {f.legenda && ` · ${f.legenda}`}
                      </span>
                      <form action={excluirFoto}>
                        <input type="hidden" name="id" value={f.id} />
                        <button className="rounded p-1 text-couro-300 hover:text-poste-vermelho" aria-label="Apagar foto"><Trash2 className="size-3.5" /></button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <FormAcao acao={adicionarFoto} limparAoSalvar className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
              <input type="hidden" name="clienteId" value={c.id} />
              <FotoUpload nome="imagem" rotulo="Nova foto" tamanho={900} />
              <div className="grid gap-2">
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <select name="tipo" className="input" aria-label="Antes ou depois">
                    <option value="ANTES">Antes</option>
                    <option value="DEPOIS">Depois</option>
                  </select>
                  <input name="legenda" className="input" placeholder="Legenda (opcional)" maxLength={120} />
                </div>
                <button className="btn-secundario"><ImageIcon className="size-4" /> Guardar foto</button>
              </div>
            </FormAcao>
          </Secao>
          <Secao titulo={<span className="flex items-center gap-2"><ClipboardList className="size-4" /> Ficha de anamnese</span>}>
            <FormAcao acao={salvarAnamnese} className="grid gap-4">
              <input type="hidden" name="clienteId" value={c.id} />
              <div className="grid gap-2">
                {PERGUNTAS_SIM_NAO.map(([campo, pergunta]) => (
                  <fieldset key={campo} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-fundo px-3 py-2 text-sm">
                    <legend className="sr-only">{pergunta}</legend>
                    <span>{pergunta}</span>
                    <span className="flex gap-3">
                      <label className="flex items-center gap-1"><input type="radio" name={campo} value="nao" defaultChecked={!anamnese[campo]} /> Não</label>
                      <label className="flex items-center gap-1"><input type="radio" name={campo} value="sim" defaultChecked={!!anamnese[campo]} /> Sim</label>
                    </span>
                  </fieldset>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {PERGUNTAS_TEXTO.map(([campo, rotulo]) => (
                  <div key={campo}>
                    <label className="label" htmlFor={`an-${campo}`}>{rotulo}</label>
                    <textarea id={`an-${campo}`} name={campo} rows={2} maxLength={500} defaultValue={anamnese[campo] ?? ""} className="input" />
                  </div>
                ))}
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="autorizou" defaultChecked={!!c.anamneseEm} className="mt-0.5" />
                <span>
                  O cliente confirmou essas informações e autorizou o atendimento.
                  {c.anamneseEm && <span className="block text-xs text-couro-400">Confirmado em {formatarDataHora(c.anamneseEm)}</span>}
                </span>
              </label>
              <button className="btn-primario">Salvar ficha</button>
            </FormAcao>
          </Secao>
        </div>
        <div className="space-y-4">
          <Secao titulo="Dados do cliente">
            <FormCampos c={c} />
          </Secao>
          <Secao titulo="Acesso à área do cliente">
            <p className="mb-3 text-sm text-couro-400">
              {c.senhaHash ? "O cliente já tem conta. Se ele esqueceu a senha, defina uma nova:" : "O cliente ainda não criou conta. Você pode criar uma senha para ele:"}
            </p>
            <FormAcao acao={definirSenhaDoApp} limparAoSalvar className="grid grid-cols-[1fr_auto] gap-2">
              <input type="hidden" name="id" value={c.id} />
              <input name="senha" className="input" placeholder="Nova senha" minLength={6} required aria-label="Nova senha do cliente" />
              <button className="btn-secundario">Definir</button>
            </FormAcao>
          </Secao>
          <Secao titulo={<span className="flex items-center gap-2"><Ticket className="size-4" /> Pacotes</span>}>
            {pacotes.length === 0 ? (
              <p className="text-sm text-couro-400">Nenhum pacote. Venda pela comanda, em “Vender pacote”.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {pacotes.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <strong>{p.pacote.nome}</strong>
                      <span className="block text-xs text-couro-400">
                        {p.usadas} de {p.sessoes} sessões usadas{p.validoAte && ` · vale até ${formatarDia(p.validoAte)}`}
                      </span>
                    </span>
                    {p.vencido ? <Etiqueta tom="vermelho">Vencido</Etiqueta> : p.restantes === 0 ? <Etiqueta>Concluído</Etiqueta> : <Etiqueta tom="verde">{p.restantes} restante(s)</Etiqueta>}
                  </li>
                ))}
              </ul>
            )}
          </Secao>
          <Secao titulo="Clube de assinatura">
            {ativa ? (
              <p className="text-sm">
                Plano <strong>{ativa.plano.nome}</strong> · pago até <strong>{formatarDia(ativa.pagoAte)}</strong>
                {ativa.pagoAte < diaLocal() && <Etiqueta tom="vermelho">Atrasado</Etiqueta>}
              </p>
            ) : (
              <p className="text-sm text-couro-400">Não é assinante.</p>
            )}
            <Link href={`/painel/assinaturas?cliente=${c.id}`} className="btn-secundario btn-pequeno mt-3">
              <Crown className="size-3.5" /> {ativa ? "Gerenciar assinatura" : "Assinar um plano"}
            </Link>
          </Secao>
        </div>
      </div>
    </div>
  );
}

type DadosCliente = { id: string; nome: string; telefone: string; email: string | null; nascimento: string | null; observacao: string | null };

function FormCampos({ c }: { c?: DadosCliente }) {
  return (
    <FormAcao acao={salvarCliente} className="grid gap-3">
      {c && <input type="hidden" name="id" value={c.id} />}
      <div><label className="label" htmlFor="nome">Nome</label><input id="nome" name="nome" defaultValue={c?.nome} className="input" required /></div>
      <div><label className="label" htmlFor="telefone">WhatsApp</label><input id="telefone" name="telefone" defaultValue={c ? formatarTelefone(c.telefone) : ""} className="input" inputMode="tel" required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="nascimento">Aniversário</label><input id="nascimento" name="nascimento" type="date" defaultValue={c?.nascimento ?? ""} className="input" /></div>
        <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" defaultValue={c?.email ?? ""} className="input" /></div>
      </div>
      <div><label className="label" htmlFor="observacao">Preferências e observações</label><textarea id="observacao" name="observacao" rows={3} defaultValue={c?.observacao ?? ""} className="input" placeholder="Ex.: prefere esmalte nude, curvatura C nos cílios..." /></div>
      <button className="btn-primario">{c ? "Salvar" : "Cadastrar cliente"}</button>
    </FormAcao>
  );
}

function FormCliente() {
  return (
    <div className="mx-auto max-w-lg">
      <Cabecalho titulo="Novo cliente" voltar={{ href: "/painel/clientes", rotulo: "Clientes" }} />
      <div className="card"><FormCampos /></div>
    </div>
  );
}
