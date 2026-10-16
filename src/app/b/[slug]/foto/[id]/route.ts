import { db } from "@/lib/db";

/** Foto de antes/depois autorizada para a galeria, servida como imagem (a página não carrega o base64). */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const foto = await db.fotoCliente.findFirst({ where: { id, publica: true, salao: { slug, suspensa: false } }, select: { imagem: true } });
  const m = foto?.imagem.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return new Response("Não encontrada", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
