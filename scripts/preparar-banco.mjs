// Roda durante a build (na Vercel): confere as variáveis de ambiente, corrige
// erros comuns de digitação e cria/atualiza as tabelas do banco.
// Se algo estiver errado, explica em português o que ajustar.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

// Na Vercel as variáveis já vêm prontas; no computador, lê o arquivo .env.
if (existsSync(".env")) process.loadEnvFile(".env");

function limpar(valor) {
  if (!valor) return valor;
  let v = valor.trim().replace(/^[A-Z_]+\s*=\s*/, "").trim();
  while (/^(["'`]).*\1$/s.test(v)) v = v.slice(1, -1).trim();
  return v || undefined;
}

function falhar(mensagem) {
  console.error("\n" + "=".repeat(70));
  console.error("❌ ERRO NA CONFIGURAÇÃO DO KLAREZA BEAUTY");
  console.error(mensagem);
  console.error("Ajuste em: Vercel → seu projeto → Settings → Environment Variables");
  console.error("Depois: Deployments → ⋯ (na última linha) → Redeploy");
  console.error("=".repeat(70) + "\n");
  process.exit(1);
}

const urlValida = (u) => /^postgres(ql)?:\/\/.+@.+/.test(u ?? "");

let databaseUrl = limpar(process.env.DATABASE_URL);
let directUrl = limpar(process.env.DIRECT_URL);

if (!databaseUrl && !directUrl)
  falhar("As variáveis DATABASE_URL e DIRECT_URL não foram cadastradas.\nCopie-as do Supabase (Connect → ORMs → Prisma).");
if (!databaseUrl) {
  console.warn("⚠️  DATABASE_URL não cadastrada; usando DIRECT_URL no lugar.");
  databaseUrl = directUrl;
}
if (!directUrl) {
  // A conexão direta é a mesma do pooler, na porta 5432 e sem pgbouncer.
  directUrl = databaseUrl.replace(":6543/", ":5432/").replace(/[?&]pgbouncer=true/, "");
  console.warn("⚠️  DIRECT_URL não cadastrada; derivada da DATABASE_URL (porta 5432).");
}
for (const [nome, valor] of [["DATABASE_URL", databaseUrl], ["DIRECT_URL", directUrl]]) {
  if (!urlValida(valor))
    falhar(`A variável ${nome} não parece um endereço do banco.\nEla deve começar com postgresql:// (sem aspas). Valor começa com: "${String(valor).slice(0, 15)}..."`);
  if (/\[YOUR-PASSWORD\]|SUA_SENHA/.test(valor))
    falhar(`A variável ${nome} ainda tem o texto [YOUR-PASSWORD]. Troque pela senha do banco do Supabase.`);
}
if (!limpar(process.env.AUTH_SECRET))
  falhar("A variável AUTH_SECRET não foi cadastrada.\nUse um texto aleatório longo (ex.: gere em https://generate-secret.vercel.app/32).");
if (!limpar(process.env.ADMIN_SENHA))
  console.warn("⚠️  ADMIN_SENHA não cadastrada: a área /admin ficará bloqueada até você cadastrá-la.");

console.log("✅ Variáveis de ambiente conferidas. Criando/atualizando as tabelas do banco...");
const resultado = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: directUrl },
  encoding: "utf8",
});
process.stdout.write(resultado.stdout ?? "");
process.stderr.write(resultado.stderr ?? "");

if (resultado.status !== 0) {
  const saida = `${resultado.stdout}\n${resultado.stderr}`;
  if (/P1000|authentication failed|password authentication/i.test(saida))
    falhar("O banco recusou a senha. Confira se a senha dentro de DATABASE_URL e DIRECT_URL é a\nmesma do Supabase (Project Settings → Database). Se a senha tiver @ # / ? ou %,\nredefina para uma só com letras e números.");
  if (/P1001|Can't reach|ENOTFOUND|timed out/i.test(saida))
    falhar("Não foi possível conectar ao banco. Confira o endereço em DIRECT_URL (deve terminar\nem :5432/postgres) e se o projeto no Supabase não está pausado.");
  if (/Tenant or user not found/i.test(saida))
    falhar("O Supabase não reconheceu o usuário. O usuário deve ser postgres.<id-do-projeto>,\nexatamente como aparece em Connect → ORMs → Prisma.");
  falhar("Falha ao criar as tabelas do banco. Veja a mensagem logo acima.");
}
console.log("✅ Banco pronto.");
