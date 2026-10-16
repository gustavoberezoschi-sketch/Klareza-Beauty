"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { statusDoSinal } from "../../actions";

/** Pix do sinal pendente: QR Code, "copia e cola" e atualização sozinha quando o pagamento cai. */
export function PixDoSinal({ slug, token, pix, qrCode, link }: { slug: string; token: string; pix: string | null; qrCode: string | null; link: string | null }) {
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    const t = setInterval(() => statusDoSinal(slug, token).then((r) => (r?.pago || r?.status !== "AGUARDANDO_SINAL") && router.refresh()), 5000);
    return () => clearInterval(t);
  }, [slug, token, router]);
  return (
    <div className="mt-4 text-center">
      {qrCode && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`data:image/png;base64,${qrCode}`} alt="QR Code do Pix" className="mx-auto size-52 rounded-xl border border-black/10" />
      )}
      {pix && (
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(pix).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2500); })}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor)] py-3 font-semibold text-[var(--cor-texto)]"
        >
          {copiado ? <Check className="size-4" /> : <Copy className="size-4" />} {copiado ? "Copiado!" : "Copiar código Pix"}
        </button>
      )}
      {link && <a href={link} target="_blank" className="mt-2 inline-block text-sm font-semibold underline">Abrir a cobrança no navegador</a>}
    </div>
  );
}
