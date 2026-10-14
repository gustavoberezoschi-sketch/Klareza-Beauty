import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { corDoTexto } from "@/lib/formato";

const TAMANHOS = new Set([180, 192, 512]);

/** Ícone do app do salão: o logo dela, ou a inicial sobre a cor da marca. */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string; tamanho: string }> }) {
  const { slug, tamanho } = await params;
  const t = TAMANHOS.has(Number(tamanho)) ? Number(tamanho) : 192;
  const b = await db.salao.findUnique({ where: { slug }, select: { nome: true, logo: true, corDestaque: true } });
  const cor = b?.corDestaque ?? "#0f0f0e";
  const inicial = (b?.nome.replace(/^(salão|salao|studio|estúdio)\s+/i, "") ?? "K").trim()[0]?.toUpperCase() ?? "K";
  return new ImageResponse(
    b?.logo ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={b.logo} width={t} height={t} style={{ width: t, height: t, objectFit: "cover" }} alt="" />
    ) : (
      <div style={{ width: t, height: t, display: "flex", alignItems: "center", justifyContent: "center", background: cor, color: corDoTexto(cor), fontSize: t * 0.52, fontWeight: 800 }}>
        {inicial}
      </div>
    ),
    { width: t, height: t, headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
