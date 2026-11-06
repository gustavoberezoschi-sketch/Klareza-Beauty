// Etapa de horário + área do cliente (instância LOCAL de demo). Não confirma agendamento.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:3100', OUT = 'assets/capturas';
const meta = JSON.parse(fs.readFileSync('assets/meta_demo_local.json'));
(async () => {
  const b = await chromium.launch();
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const c = await m.newPage();
  const snap = async (n, uso, full=false) => { await c.waitForTimeout(500); await c.evaluate(() => document.fonts.ready); await c.screenshot({ path: `${OUT}/${n}.png`, fullPage: full }); meta.push({ arquivo: `${OUT}/${n}.png`, url: new URL(c.url()).pathname, viewport: { width: 390, height: 844 }, escala: 2, uso, etiqueta: 'Exemplo', origem: 'instancia local de demonstracao (seed, dados ficticios)', data: new Date().toISOString() }); console.log(n); };
  await c.goto(BASE + '/b/flor-de-lotus/agendar', { waitUntil: 'networkidle' });
  const ok = c.getByRole('button', { name: 'Entendi' }); if (await ok.count()) await ok.first().click();
  await c.getByText('Centro', { exact: true }).first().click();
  await c.getByText('Carla Mendes').first().click();
  await c.getByText('Manicure', { exact: true }).first().click();
  await c.getByRole('button', { name: 'Continuar' }).first().click();
  await c.waitForTimeout(1500); await snap('cel_agendar_5_horario', 'Etapa horário (sem confirmar)');
  const h = c.getByRole('button', { name: /^\d\d:\d\d$/ }); if (await h.count()) { await h.nth(2).click(); await snap('cel_agendar_6_horario_escolhido', 'Horário escolhido, sem confirmar'); }
  // área do cliente (conta de demonstração do seed)
  await c.goto(BASE + '/b/flor-de-lotus/entrar', { waitUntil: 'networkidle' });
  await c.locator('input').first().fill('11987654321'); await c.locator('input[type=password]').fill('123456');
  await c.getByRole('button', { name: /Entrar/ }).last().click(); await c.waitForLoadState('networkidle'); await c.waitForTimeout(1000);
  await snap('cel_conta_inicio', 'Área do cliente: início');
  const links = await c.$$eval('a', as => [...new Set(as.map(a => a.getAttribute('href')))].filter(h => h && h.startsWith('/b/flor-de-lotus/')));
  fs.writeFileSync('/var/tmp/explore/conta_links.json', JSON.stringify(links));
  for (const l of links) { if (/sair|entrar|agendar$/.test(l)) continue; await c.goto(BASE + l, { waitUntil: 'networkidle' }); await snap('cel_conta_' + l.split('/').filter(Boolean).slice(2).join('_').replace(/[^a-z_]/g,''), 'Área do cliente: ' + l); }
  fs.writeFileSync('assets/meta_demo_local.json', JSON.stringify(meta, null, 1));
  await b.close();
})();
