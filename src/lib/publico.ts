import { assinaturaVigente, usosDoPlanoNoMes } from "./comandas";
import { db } from "./db";
import { corDoTexto } from "./formato";
import { diaDaSemana, diaLocal, somarDias } from "./tempo";

/** Variáveis de cor da marca para as páginas do cliente. */
export function estiloDaMarca(cor: string) {
  return { "--cor": cor, "--cor-texto": corDoTexto(cor) } as React.CSSProperties;
}

/** Plano vigente do cliente, com os serviços cobertos e quantos usos ainda restam no mês. */
export async function planoDoCliente(clienteId: string) {
  const a = await assinaturaVigente(clienteId);
  if (!a) return null;
  const usados = await usosDoPlanoNoMes(clienteId);
  return {
    nome: a.plano.nome,
    servicoIds: a.plano.servicos.map((s) => s.id),
    restantes: a.plano.usosPorMes === null ? null : Math.max(0, a.plano.usosPorMes - usados),
    usados,
    limite: a.plano.usosPorMes,
    pagoAte: a.pagoAte,
    precoCentavos: a.plano.precoCentavos,
    descricao: a.plano.descricao,
  };
}

/** Unidades ativas com os dias em que dá para agendar (até a antecedência máxima). */
export function diasAbertos(horarios: { diaSemana: number }[], antecedenciaDias: number) {
  const abertos = new Set(horarios.map((h) => h.diaSemana));
  const hoje = diaLocal();
  return Array.from({ length: antecedenciaDias + 1 }, (_, i) => somarDias(hoje, i)).filter((d) => abertos.has(diaDaSemana(d)));
}

/** Dados para montar o agendamento online. */
export async function dadosDoAgendamento(slug: string) {
  const b = await db.salao.findUnique({
    where: { slug },
    include: {
      filiais: { where: { ativo: true }, include: { horarios: true }, orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }] },
      servicos: { where: { ativo: true, exibirOnline: true }, include: { profissionais: { select: { id: true } } }, orderBy: [{ categoria: "asc" }, { precoCentavos: "asc" }] },
      profissionais: { where: { ativo: true, filial: { ativo: true } }, orderBy: [{ destaque: "desc" }, { nome: "asc" }] },
    },
  });
  if (!b) return null;
  const filiais = (b.suspensa ? [] : b.filiais)
    .map((f) => ({ id: f.id, nome: f.nome, endereco: f.endereco, dias: diasAbertos(f.horarios, b.antecedenciaDias) }))
    .filter((f) => f.dias.length > 0 && b.profissionais.some((x) => x.filialId === f.id));
  return {
    salao: b,
    filiais,
    servicos: b.servicos.map((s) => ({
      id: s.id,
      nome: s.nome,
      categoria: s.categoria,
      descricao: s.descricao,
      foto: s.foto,
      precoCentavos: s.precoCentavos,
      duracaoMin: s.duracaoMin,
      profissionalIds: s.profissionais.map((x) => x.id),
    })),
    profissionais: b.profissionais.map((x) => ({ id: x.id, nome: x.nome, foto: x.foto, destaque: x.destaque, bio: x.bio, filialId: x.filialId })),
  };
}
