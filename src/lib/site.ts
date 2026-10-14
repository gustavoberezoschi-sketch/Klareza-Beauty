import { headers } from "next/headers";

/** Endereço do site (ex.: https://sistema-salão-gilt.vercel.app), a partir da requisição atual. */
export async function enderecoDoSite(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}
