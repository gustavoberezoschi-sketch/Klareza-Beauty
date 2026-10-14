import type { Metadata, Viewport } from "next";
import { db } from "@/lib/db";

// Cada salão vira um app instalável com o próprio nome, logo e cor.

async function marca(slug: string) {
  return db.salao.findUnique({ where: { slug }, select: { nome: true, corDestaque: true } });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const b = await marca(slug);
  if (!b) return {};
  return {
    manifest: `/b/${slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: b.nome, statusBarStyle: "default" },
    icons: { apple: `/b/${slug}/icone/180` },
  };
}

export async function generateViewport({ params }: { params: Promise<{ slug: string }> }): Promise<Viewport> {
  const b = await marca((await params).slug);
  return { themeColor: b?.corDestaque ?? "#0f0f0e" };
}

export default function LayoutSalao({ children }: { children: React.ReactNode }) {
  return children;
}
