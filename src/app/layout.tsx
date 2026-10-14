import type { Metadata, Viewport } from "next";
import { Figtree, Geist } from "next/font/google";
import { headers } from "next/headers";
import { AvisoCookies } from "@/components/AvisoCookies";
import "./globals.css";

const titulo = Geist({ subsets: ["latin"], variable: "--fonte-titulo", display: "swap" });
const texto = Figtree({ subsets: ["latin"], variable: "--fonte-texto", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Klareza Beauty", template: "%s · Klareza Beauty" },
  description: "Klareza Beauty: agendamento online e gestão completa para salões",
  applicationName: "Klareza Beauty",
  appleWebApp: { capable: true, title: "Klareza Beauty", statusBarStyle: "default" },
  icons: { apple: "/icone/180" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f0f0e" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Lê o nonce da CSP (middleware): deixa todas as páginas dinâmicas, para cada resposta ter o seu nonce.
  await headers();
  return (
    <html lang="pt-BR" className={`${titulo.variable} ${texto.variable}`}>
      <body className="min-h-screen">
        {children}
        <AvisoCookies />
      </body>
    </html>
  );
}
