"use client";

import { useEffect, useRef, useState } from "react";

/** Banners que passam sozinhos; também dá para arrastar no celular. */
export function Carrossel({ banners }: { banners: { id: string; imagem: string; link: string | null }[] }) {
  const [atual, setAtual] = useState(0);
  const trilho = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (banners.length < 2) return;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzir) return;
    const t = setInterval(() => setAtual((i) => (i + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  useEffect(() => {
    const el = trilho.current;
    el?.scrollTo({ left: el.clientWidth * atual, behavior: "smooth" });
  }, [atual]);

  if (banners.length === 0) return null;
  return (
    <div className="relative">
      <div
        ref={trilho}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl [scrollbar-width:none]"
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== atual) setAtual(i);
        }}
      >
        {banners.map((b) => {
          // eslint-disable-next-line @next/next/no-img-element
          const img = <img src={b.imagem} alt="" className="aspect-[2.6/1] w-full object-cover" />;
          return (
            <div key={b.id} className="w-full shrink-0 snap-center">
              {b.link ? <a href={b.link} target="_blank" rel="noopener">{img}</a> : img}
            </div>
          );
        })}
      </div>
      {banners.length > 1 && (
        <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id}
              onClick={() => setAtual(i)}
              aria-label={`Banner ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === atual ? "w-6 bg-[var(--cor)]" : "w-1.5 bg-white/70"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
