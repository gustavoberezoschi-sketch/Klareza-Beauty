import { NextResponse } from "next/server";
import { tokenSaqueConfere } from "@/lib/cripto";
import { validarSaque } from "@/lib/saques";

export const dynamic = "force-dynamic";

// Validação de saque do Asaas (Integrações > Mecanismos de segurança): uns segundos depois de
// criada uma transferência, o Asaas pergunta aqui se ela é legítima. Sem APPROVED, ela é cancelada.
// Assim, mesmo com a chave de uma subconta vazada, ninguém saca sem passar pelo Klareza Beauty.
export async function POST(req: Request) {
  if (!tokenSaqueConfere(req.headers.get("asaas-access-token"))) return NextResponse.json({ erro: "token inválido" }, { status: 401 });
  const corpo = await req.json().catch(() => null);
  const t = corpo?.transfer ?? corpo;
  if (!t || typeof t !== "object") return NextResponse.json({ status: "REFUSED", refuseReason: "Pedido inválido." });
  const r = await validarSaque(t);
  return NextResponse.json(r.aprovado ? { status: "APPROVED" } : { status: "REFUSED", refuseReason: r.motivo });
}
