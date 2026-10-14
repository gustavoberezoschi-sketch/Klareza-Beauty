/**
 * Símbolo do Klareza Beauty: um K em que os dois braços são pétalas, com um brilho ao lado.
 * Só formas, sem fonte: escala de favicon a outdoor.
 */
export const SIMBOLO_FORMAS = {
  haste: { x: 120, y: 106, width: 70, height: 300, rx: 35 },
  petalaDeCima: "M196 252 Q337.5 236.4 392 104 Q253.5 123.6 196 252 Z",
  petalaDeBaixo: "M196 262 Q334.5 281.9 384 412 Q245.5 390.1 196 262 Z",
  brilho: "M418 222 Q418 256 452 256 Q418 256 418 290 Q418 256 384 256 Q418 256 418 222 Z",
};

export function Simbolo({ tamanho = 512, fundo = true, cor = "#ffffff", id = "s" }: { tamanho?: number; fundo?: boolean; cor?: string; id?: string }) {
  const f = SIMBOLO_FORMAS;
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Klareza Beauty">
      {fundo && (
        <>
          <defs>
            <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#c4588a" />
              <stop offset="1" stopColor="#5e2140" />
            </linearGradient>
          </defs>
          <rect width="512" height="512" rx="118" fill={`url(#${id}-g)`} />
        </>
      )}
      <g transform="translate(-18 0)">
        <rect {...f.haste} fill={cor} />
        <path d={f.petalaDeCima} fill={cor} />
        <path d={f.petalaDeBaixo} fill={cor} />
        <path d={f.brilho} fill={cor} />
      </g>
    </svg>
  );
}
