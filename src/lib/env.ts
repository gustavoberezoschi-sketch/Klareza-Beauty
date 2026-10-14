/**
 * Limpa valores de variáveis de ambiente colados com aspas, espaços ou com o
 * próprio nome na frente (ex.: `DATABASE_URL="postgresql://..."`).
 */
export function limparVariavel(valor: string | undefined): string | undefined {
  if (!valor) return valor;
  let v = valor.trim().replace(/^[A-Z_]+\s*=\s*/, "").trim();
  while (/^(["'`]).*\1$/s.test(v)) v = v.slice(1, -1).trim();
  return v || undefined;
}
