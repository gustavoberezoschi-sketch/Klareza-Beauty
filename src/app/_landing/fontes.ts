import { Geist, Instrument_Serif } from "next/font/google";

const titulo = Geist({ subsets: ["latin"], variable: "--lp-fonte-titulo", display: "swap" });
const serifa = Instrument_Serif({ subsets: ["latin"], weight: "400", style: "italic", variable: "--lp-fonte-serifa", display: "swap" });

/** Classes das fontes da landing (aplicar no elemento raiz da página). */
export const fontesLanding = `${titulo.variable} ${serifa.variable}`;
