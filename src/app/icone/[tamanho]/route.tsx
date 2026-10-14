import { ImageResponse } from "next/og";
import { SIMBOLO_FORMAS as f } from "@/app/marca/Simbolo";

const TAMANHOS = new Set([180, 192, 512]);

/** Ícone do app do painel (Klareza Beauty): o símbolo K-pétala sobre o degradê vinho rosé. */
export async function GET(_: Request, { params }: { params: Promise<{ tamanho: string }> }) {
  const n = Number((await params).tamanho);
  const t = TAMANHOS.has(n) ? n : 192;
  return new ImageResponse(
    (
      <div style={{ width: t, height: t, display: "flex", background: "linear-gradient(135deg, #c4588a, #5e2140)" }}>
        <svg width={t} height={t} viewBox="0 0 512 512">
          <g transform="translate(-18 0)" fill="#ffffff">
            <rect x={f.haste.x} y={f.haste.y} width={f.haste.width} height={f.haste.height} rx={f.haste.rx} />
            <path d={f.petalaDeCima} />
            <path d={f.petalaDeBaixo} />
            <path d={f.brilho} />
          </g>
        </svg>
      </div>
    ),
    { width: t, height: t, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
