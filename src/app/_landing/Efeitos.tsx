"use client";

import { useEffect } from "react";

/**
 * Efeitos de rolagem da landing, sem bibliotecas:
 * - [data-revela]: aparece quando entra na tela
 * - [data-inclina]: recebe --p (0 a 1) enquanto sobe até o topo da tela
 * - [data-paralaxe="0.15"]: recebe --y conforme a distância do centro da tela
 * - [data-palavras]: recebe --p enquanto atravessa a tela
 * - documento: --rolagem (0 a 1) para a barra de progresso
 */
export function Efeitos() {
  useEffect(() => {
    const raiz = document.documentElement;
    const visiveis = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) {
            e.target.classList.add("lp-visivel");
            visiveis.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    document.querySelectorAll("[data-revela]").forEach((el) => visiveis.observe(el));

    const inclina = Array.from(document.querySelectorAll<HTMLElement>("[data-inclina]"));
    const paralaxe = Array.from(document.querySelectorAll<HTMLElement>("[data-paralaxe]"));
    const palavras = Array.from(document.querySelectorAll<HTMLElement>("[data-palavras]"));
    const limita = (v: number) => Math.max(0, Math.min(1, v));

    let pedido = 0;
    const atualizar = () => {
      pedido = 0;
      const h = window.innerHeight;
      raiz.style.setProperty("--rolagem", String(limita(window.scrollY / (raiz.scrollHeight - h || 1))));
      for (const el of inclina) {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--p", limita(1 - (r.top - h * 0.12) / (h * 0.75)).toFixed(3));
      }
      for (const el of paralaxe) {
        const r = el.getBoundingClientRect();
        const fator = Number(el.dataset.paralaxe) || 0.1;
        el.style.setProperty("--y", ((r.top + r.height / 2 - h / 2) * -fator).toFixed(1));
      }
      for (const el of palavras) {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--p", limita((h * 0.85 - r.top) / (r.height + h * 0.35)).toFixed(3));
      }
    };
    const aoRolar = () => {
      if (!pedido) pedido = requestAnimationFrame(atualizar);
    };
    atualizar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);
    return () => {
      visiveis.disconnect();
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
      cancelAnimationFrame(pedido);
    };
  }, []);
  return null;
}
