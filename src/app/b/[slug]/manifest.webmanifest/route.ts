import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await db.salao.findUnique({ where: { slug }, select: { nome: true, corDestaque: true, descricao: true } });
  if (!b) return NextResponse.json({ erro: "não encontrada" }, { status: 404 });
  const icone = (t: number, proposito?: string) => ({ src: `/b/${slug}/icone/${t}`, sizes: `${t}x${t}`, type: "image/png", ...(proposito ? { purpose: proposito } : {}) });
  return NextResponse.json(
    {
      id: `/b/${slug}/`,
      name: b.nome,
      short_name: b.nome.length > 14 ? b.nome.replace(/^(salão|salao|studio|estúdio)\s+/i, "").slice(0, 14) : b.nome,
      description: b.descricao ?? `Agende seu horário na ${b.nome}.`,
      start_url: `/b/${slug}/conta?app=1`,
      scope: `/b/${slug}/`,
      display: "standalone",
      orientation: "portrait",
      background_color: "#f6f5f3",
      theme_color: b.corDestaque,
      lang: "pt-BR",
      icons: [icone(192), icone(512), icone(512, "maskable")],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300" } },
  );
}
