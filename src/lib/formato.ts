export function formatarDinheiro(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Converte "35", "35,50" ou "35.50" em centavos. Retorna null se inválido. */
export function lerDinheiro(texto: string): number | null {
  const limpo = texto.replace(/[R$\s.]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  return Math.round(Number(limpo) * 100);
}

export function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

export function formatarTelefone(digitos: string): string {
  if (digitos.length === 11) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  if (digitos.length === 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return digitos;
}

export function linkWhatsApp(digitos: string, mensagem?: string): string {
  const numero = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${numero}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ""}`;
}

export const FORMAS_PAGAMENTO: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
  CARTAO_DEBITO: "Cartão de débito",
  CARTAO_CREDITO: "Cartão de crédito",
};

export const NOME_FORMA: Record<string, string> = { ...FORMAS_PAGAMENTO, BOLETO: "Boleto", SEM_COBRANCA: "Sem cobrança (plano)", FATURA: "Na fatura do clube" };

/** Cor de texto legível (escura ou branca) sobre um fundo hexadecimal. */
export function corDoTexto(hex: string): string {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminancia = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminancia > 0.179 ? "#14100e" : "#ffffff";
}
