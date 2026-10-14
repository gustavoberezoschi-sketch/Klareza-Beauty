import { createHash } from "node:crypto";

// Regra de senha (NIST 800-63B): tamanho mínimo, sem senhas óbvias e sem senhas que já vazaram.
// Não exige maiúscula/símbolo: isso leva a senhas previsíveis ("Senha@123"); o que protege é tamanho + não vazada.

const OBVIAS = ["12345678", "123456789", "1234567890", "87654321", "11111111", "00000000", "senha123", "senha1234", "password", "salao", "qwertyui", "abcd1234", "abc12345", "mudar123"];

export const SENHA_MINIMA = 8;

/** Consulta o Have I Been Pwned por k-anonimato (só os 5 primeiros caracteres do hash saem do servidor). */
async function vazada(senha: string) {
  const sha1 = createHash("sha1").update(senha).digest("hex").toUpperCase();
  try {
    const r = await fetch(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, {
      headers: { "Add-Padding": "true", "User-Agent": "Klareza Beauty" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!r.ok) return false;
    const resto = sha1.slice(5);
    return (await r.text()).split("\n").some((l) => l.startsWith(resto) && Number(l.split(":")[1]) > 0);
  } catch {
    return false; // serviço fora do ar não impede o cadastro
  }
}

/** Devolve o motivo de recusa, ou null se a senha serve. */
export async function problemaNaSenha(senha: string, ...dadosPessoais: (string | null | undefined)[]) {
  if (senha.length < SENHA_MINIMA) return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  if (senha.length > 128) return "Senha longa demais.";
  const baixa = senha.toLowerCase();
  if (/^(.)\1+$/.test(senha) || OBVIAS.includes(baixa)) return "Essa senha é fácil demais de adivinhar. Escolha outra.";
  for (const d of dadosPessoais) {
    const limpo = (d ?? "").toLowerCase().replace(/\s+/g, "");
    if (limpo.length >= 4 && baixa.includes(limpo)) return "A senha não pode conter seu nome, e-mail ou telefone.";
  }
  if (await vazada(senha)) return "Essa senha apareceu em vazamentos de dados na internet. Escolha outra.";
  return null;
}
