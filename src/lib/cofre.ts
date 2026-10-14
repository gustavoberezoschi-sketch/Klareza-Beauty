import { recifrarSeAntigo } from "./cripto";
import { db } from "./db";

/** Depois de trocar o AUTH_SECRET: recifra com o segredo novo tudo que ainda está com o antigo. */
export async function recifrarSegredosAntigos() {
  if (!process.env.AUTH_SECRET_ANTERIOR) return 0;
  let n = 0;
  for (const b of await db.salao.findMany({ where: { asaasApiKey: { not: null } }, select: { id: true, asaasApiKey: true } })) {
    const novo = recifrarSeAntigo(b.asaasApiKey!);
    if (novo) n += (await db.salao.update({ where: { id: b.id }, data: { asaasApiKey: novo } })) ? 1 : 0;
  }
  const c = await db.configSistema.findUnique({ where: { id: "geral" } });
  const vapid = c?.vapidPrivada ? recifrarSeAntigo(c.vapidPrivada) : null;
  if (vapid) n += (await db.configSistema.update({ where: { id: "geral" }, data: { vapidPrivada: vapid } })) ? 1 : 0;
  return n;
}
