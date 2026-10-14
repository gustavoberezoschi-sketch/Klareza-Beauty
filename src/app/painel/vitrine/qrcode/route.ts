import QRCode from "qrcode";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { enderecoDoSite } from "@/lib/site";

/** QR code do link de agendamento do salão, em alta resolução para impressão (placa, adesivo, cartão). */
export async function GET(req: Request) {
  const { salaoId } = await exigirGestor();
  const b = await db.salao.findUniqueOrThrow({ where: { id: salaoId }, select: { slug: true } });
  const link = `${await enderecoDoSite()}/b/${b.slug}`;
  const formato = new URL(req.url).searchParams.get("formato") === "svg" ? "svg" : "png";
  const opcoes = { errorCorrectionLevel: "H" as const, margin: 2, color: { dark: "#000000", light: "#ffffff" } };
  if (formato === "svg") {
    const svg = await QRCode.toString(link, { ...opcoes, type: "svg" });
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Content-Disposition": `attachment; filename="qrcode-${b.slug}.svg"` } });
  }
  const png = await QRCode.toBuffer(link, { ...opcoes, type: "png", width: 2000 });
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="qrcode-${b.slug}.png"` } });
}
