import bcrypt from "bcryptjs";
import { problemaNaSenha } from "./senha";
import { db } from "./db";

export function gerarSlug(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export class ErroCadastro extends Error {}

/** Cria um salão cliente com o login do dono e horário padrão (seg a sáb, 9h às 19h). */
export async function criarSalao(dados: {
  nome: string;
  slug?: string;
  dono: string;
  email: string;
  senha: string;
  plano?: string;
  ciclo?: string;
  pagoAte?: string | null;
}) {
  const nome = dados.nome.trim();
  const slug = gerarSlug(dados.slug?.trim() || nome);
  const dono = dados.dono.trim();
  const email = dados.email.trim().toLowerCase();

  if (!nome || !slug || !dono || !email) throw new ErroCadastro("Preencha todos os campos.");
  const problema = await problemaNaSenha(dados.senha, dados.email);
  if (problema) throw new ErroCadastro(problema);
  if (await db.salao.findUnique({ where: { slug } })) throw new ErroCadastro(`O link /b/${slug} já está em uso.`);
  if (await db.usuario.findUnique({ where: { email } })) throw new ErroCadastro(`O e-mail ${email} já está em uso.`);

  return db.salao.create({
    data: {
      nome,
      slug,
      plano: dados.plano ?? "BAIRRO",
      ciclo: dados.ciclo ?? "MENSAL",
      pagoAte: dados.pagoAte ?? null,
      filiais: {
        create: {
          nome: "Unidade principal",
          horarios: { create: [1, 2, 3, 4, 5, 6].map((diaSemana) => ({ diaSemana, abre: "09:00", fecha: "19:00" })) },
        },
      },
      usuarios: { create: { nome: dono, email, senhaHash: await bcrypt.hash(dados.senha, 10) } },
    },
  });
}

export async function redefinirSenha(email: string, senha: string) {
  const problema = await problemaNaSenha(senha, email);
  if (problema) throw new ErroCadastro(problema);
  const usuario = await db.usuario.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!usuario) throw new ErroCadastro("Nenhum login com esse e-mail.");
  await db.usuario.update({ where: { id: usuario.id }, data: { senhaHash: await bcrypt.hash(senha, 10) } });
}
