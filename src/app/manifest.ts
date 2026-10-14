import type { MetadataRoute } from "next";

/** App do painel: dono, gerente e profissionais instalam o Klareza Beauty no celular. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/painel",
    name: "Klareza Beauty",
    short_name: "Klareza Beauty",
    description: "Agenda, comandas, caixa e clube de assinatura do seu salão.",
    start_url: "/painel",
    scope: "/",
    display: "standalone",
    background_color: "#f7f4f3",
    theme_color: "#0f0f0e",
    lang: "pt-BR",
    icons: [
      { src: "/icone/192", sizes: "192x192", type: "image/png" },
      { src: "/icone/512", sizes: "512x512", type: "image/png" },
      { src: "/icone/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
