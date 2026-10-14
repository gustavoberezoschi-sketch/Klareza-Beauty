// Ficha de anamnese do cliente (guardada como JSON em Cliente.anamnese).

export const PERGUNTAS_SIM_NAO = [
  ["gestante", "Está gestante ou amamentando?"],
  ["lentes", "Usa lentes de contato?"],
  ["sensibilidade", "Tem olhos sensíveis, conjuntivite ou blefarite recente?"],
  ["pele", "Tem alguma condição de pele (dermatite, psoríase, micose)?"],
  ["diabetes", "Tem diabetes ou problema de circulação?"],
] as const;

export const PERGUNTAS_TEXTO = [
  ["alergias", "Alergias (cola, esmalte, látex, henna, medicamentos...)"],
  ["medicamentos", "Medicamentos em uso"],
  ["procedimentos", "Procedimentos recentes (químicas, cílios, peeling...)"],
  ["observacoes", "Outras observações"],
] as const;

export type Anamnese = Partial<Record<(typeof PERGUNTAS_SIM_NAO)[number][0], boolean> & Record<(typeof PERGUNTAS_TEXTO)[number][0], string>>;

export function lerAnamnese(valor: unknown): Anamnese {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Anamnese) : {};
}

/** Pontos de atenção para mostrar em destaque (alergias e respostas "sim"). */
export function alertasDaAnamnese(a: Anamnese): string[] {
  const alertas: string[] = [];
  if (a.alergias) alertas.push(`Alergia: ${a.alergias}`);
  if (a.gestante) alertas.push("Gestante ou amamentando");
  if (a.sensibilidade) alertas.push("Olhos sensíveis");
  if (a.pele) alertas.push("Condição de pele");
  if (a.diabetes) alertas.push("Diabetes ou circulação");
  return alertas;
}
