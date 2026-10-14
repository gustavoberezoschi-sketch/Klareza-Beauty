/**
 * Símbolo do Klareza Beauty: um K em que as duas pernas são as lâminas de uma tesoura aberta,
 * presas num pino (o "parafuso" da tesoura). Só formas, sem fonte: escala de favicon a outdoor.
 */
export function Simbolo({ tamanho = 512, fundo = true, cor = "#ffffff", id = "s" }: { tamanho?: number; fundo?: boolean; cor?: string; id?: string }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Klareza Beauty">
      {fundo && (
        <>
          <defs>
            <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#23a06a" />
              <stop offset="1" stopColor="#0d4029" />
            </linearGradient>
          </defs>
          <rect width="512" height="512" rx="118" fill={`url(#${id}-g)`} />
        </>
      )}
      {/* haste do K */}
      <rect x="126" y="106" width="66" height="300" rx="33" fill={cor} />
      {/* lâmina de cima: costas retas, fio afinando até a ponta */}
      <path d="M192 236 L380 104 C392 96 408 104 404 120 L238 288 Z" fill={cor} />
      {/* lâmina de baixo até a argola da tesoura */}
      <path d="M226 276 L320 356" stroke={cor} strokeWidth="54" strokeLinecap="round" />
      <circle cx="358" cy="386" r="50" fill="none" stroke={cor} strokeWidth="30" />
      {/* pino da tesoura, encostado na haste */}
      <circle cx="216" cy="262" r="27" fill={cor} />
      <circle cx="216" cy="262" r="10" fill={fundo ? "#145c3c" : "#0b0b0a"} />
    </svg>
  );
}
