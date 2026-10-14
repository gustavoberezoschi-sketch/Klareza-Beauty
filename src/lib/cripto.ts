import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { limparVariavel } from "./env";

// Criptografia de segredos guardados no banco (ex.: chave da subconta do Asaas),
// com chave derivada do AUTH_SECRET.
//
// Troca do AUTH_SECRET: coloque o valor antigo em AUTH_SECRET_ANTERIOR e o novo em AUTH_SECRET.
// O sistema continua lendo o que foi cifrado com o antigo, o cron recifra tudo com o novo,
// e os webhooks do Asaas configurados com o token antigo continuam aceitos.
function segredoAtual() {
  const segredo = limparVariavel(process.env.AUTH_SECRET);
  if (!segredo) throw new Error("Defina AUTH_SECRET");
  return segredo;
}
const segredoAnterior = () => limparVariavel(process.env.AUTH_SECRET_ANTERIOR) ?? null;
const derivarChave = (segredo: string) => createHash("sha256").update(`cofre:${segredo}`).digest();

function chave() {
  return derivarChave(segredoAtual());
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), dados.toString("base64")].join(":");
}

function decifrarCom(k: Buffer, cifrado: string): string {
  const [versao, iv, tag, dados] = cifrado.split(":");
  if (versao !== "v1") throw new Error("Formato de segredo desconhecido");
  const d = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(dados, "base64")), d.final()]).toString("utf8");
}

export function decifrar(cifrado: string): string {
  try {
    return decifrarCom(chave(), cifrado);
  } catch (e) {
    const antigo = segredoAnterior();
    if (!antigo) throw e;
    return decifrarCom(derivarChave(antigo), cifrado);
  }
}

/** Se o valor ainda está cifrado com o AUTH_SECRET antigo, devolve ele cifrado com o atual; senão, null. */
export function recifrarSeAntigo(cifrado: string): string | null {
  try {
    decifrarCom(chave(), cifrado);
    return null;
  } catch {
    return cifrar(decifrar(cifrado));
  }
}

/** Token que o Asaas envia no webhook (derivado do AUTH_SECRET, não precisa configurar). */
export function tokenWebhookAsaas(segredo = limparVariavel(process.env.AUTH_SECRET) ?? "") {
  return createHmac("sha256", segredo).update("asaas-webhook").digest("hex");
}

function igualSeguro(recebido: string, esperado: string) {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function tokenConfere(recebido: string | null) {
  if (!recebido) return false;
  const antigo = segredoAnterior();
  return igualSeguro(recebido, tokenWebhookAsaas()) || (!!antigo && igualSeguro(recebido, tokenWebhookAsaas(antigo)));
}

/** Token que o Asaas envia ao pedir a validação de um saque (Integrações > Mecanismos de segurança). */
export function tokenSaqueAsaas(segredo = limparVariavel(process.env.AUTH_SECRET) ?? "") {
  return createHmac("sha256", segredo).update("asaas-saque").digest("hex");
}

export function tokenSaqueConfere(recebido: string | null) {
  if (!recebido) return false;
  const antigo = segredoAnterior();
  return igualSeguro(recebido.trim(), tokenSaqueAsaas()) || (!!antigo && igualSeguro(recebido.trim(), tokenSaqueAsaas(antigo)));
}
