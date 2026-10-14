"use client";

import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";

/**
 * Campo de foto: o navegador reduz a imagem (para não pesar o banco) e guarda
 * o resultado num campo escondido com o nome informado.
 */
export function FotoUpload({
  nome,
  inicial,
  tamanho = 400,
  formato = "quadrado",
  rotulo = "Foto",
}: {
  nome: string;
  inicial?: string | null;
  tamanho?: number;
  formato?: "quadrado" | "largo" | "redondo";
  rotulo?: string;
}) {
  const [valor, setValor] = useState(inicial ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const largo = formato === "largo";

  function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) return setErro("Escolha um arquivo de imagem.");
    setErro(null);
    const img = new Image();
    img.onload = () => {
      const largura = largo ? tamanho * 2 : tamanho;
      const altura = largo ? Math.round(tamanho * 0.75) : tamanho;
      const canvas = document.createElement("canvas");
      canvas.width = largura;
      canvas.height = altura;
      const escala = Math.max(largura / img.width, altura / img.height);
      const w = img.width * escala;
      const h = img.height * escala;
      canvas.getContext("2d")!.drawImage(img, (largura - w) / 2, (altura - h) / 2, w, h);
      setValor(canvas.toDataURL("image/jpeg", 0.82));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(arquivo);
  }

  const forma = formato === "redondo" ? "rounded-full size-24" : largo ? "rounded-xl h-28 w-full max-w-sm" : "rounded-xl size-24";

  return (
    <div>
      <span className="label">{rotulo}</span>
      <input type="hidden" name={nome} value={valor} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className={`relative grid shrink-0 place-items-center overflow-hidden border border-dashed border-black/15 bg-fundo text-couro-400 hover:border-latao-500 hover:text-latao-600 ${forma}`}
        >
          {valor ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={valor} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <ImagePlus className="size-6" aria-hidden />
          )}
          <span className="sr-only">Escolher imagem</span>
        </button>
        {valor && (
          <button type="button" onClick={() => setValor("")} className="btn-secundario btn-pequeno">
            <X className="size-3.5" /> Remover
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => escolher(e.target.files?.[0])} />
      {erro && <p className="mt-1 text-xs text-poste-vermelho">{erro}</p>}
    </div>
  );
}
