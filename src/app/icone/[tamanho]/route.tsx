import { ImageResponse } from "next/og";

const TAMANHOS = new Set([180, 192, 512]);

/** Ícone do app do painel (Klareza Beauty): quadrado preto com o K branco. */
export async function GET(_: Request, { params }: { params: Promise<{ tamanho: string }> }) {
  const n = Number((await params).tamanho);
  const t = TAMANHOS.has(n) ? n : 192;
  return new ImageResponse(
    (
      <div style={{ width: t, height: t, display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f0e", color: "#ffffff", fontSize: t * 0.56, fontWeight: 800 }}>
        K
      </div>
    ),
    { width: t, height: t, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
