// Fluxo de agendamento no celular (instância LOCAL de demo). Seleciona opções, NUNCA clica em Confirmar.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:3100', OUT = 'assets/capturas';
const meta = JSON.parse(fs.readFileSync('assets/meta_demo_local.json'));
const add = (arquivo, url, uso) => meta.push({ arquivo, url, viewport: { width: 390, height: 844 }, escala: 2, dimensoes_px: [780, 1688], uso, etiqueta: 'Exemplo', origem: 'instancia local de demonstracao (seed, dados ficticios)', data: new Date().toISOString() });
(async () => {
  const b = await chromium.launch();
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const c = await m.newPage();
  const snap = async (n, uso) => { await c.waitForTimeout(400); await c.evaluate(() => document.fonts.ready); await c.screenshot({ path: `${OUT}/${n}.png` }); add(`${OUT}/${n}.png`, new URL(c.url()).pathname, uso); console.log(n); };
  await c.goto(BASE + '/b/flor-de-lotus/agendar', { waitUntil: 'networkidle' });
  const ok = c.getByRole('button', { name: 'Entendi' }); if (await ok.count()) await ok.first().click();
  await c.getByText('Centro', { exact: true }).first().click(); await snap('cel_agendar_1_profissional', 'Etapa profissional');
  await c.getByText('Carla Mendes').first().click(); await snap('cel_agendar_2_servicos', 'Etapa serviços');
  await c.getByText('Extensão de cílios').first().click(); await snap('cel_agendar_3_variacao', 'Variações/adicionais');
  const v = c.getByText('Volume russo'); if (await v.count()) { await v.first().click(); await snap('cel_agendar_4_escolhido', 'Variação escolhida, total no rodapé'); }
  fs.writeFileSync('/var/tmp/explore/agendar_text.txt', await c.evaluate(() => document.body.innerText));
  await b.close();
  fs.writeFileSync('assets/meta_demo_local.json', JSON.stringify(meta, null, 1));
})();
