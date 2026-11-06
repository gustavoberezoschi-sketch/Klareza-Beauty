// Medições (somente leitura) para a versão 2 + captura da ficha de pré-atendimento da cliente (sem enviar).
const { chromium } = require('playwright');
const fs = require('fs'); const BASE = 'http://localhost:3100';
(async () => {
  const b = await chromium.launch(); const out = {};
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } }); const p = await ctx.newPage();
  await p.goto(BASE + '/login'); const ok = p.getByRole('button', { name: 'Entendi' }); if (await ok.count()) await ok.first().click();
  await p.fill('input[type=email]', 'dono@flordelotus.com'); await p.fill('input[type=password]', '123456');
  await Promise.all([p.waitForURL(/painel/), p.getByRole('button', { name: 'Entrar' }).click()]);
  const rotulos = () => p.evaluate(() => { const m = document.querySelector('main').getBoundingClientRect();
    return [...document.querySelectorAll('main label, main legend, main h2, main h3, main p.text-xs, main summary')].map(e => { const q = e.getBoundingClientRect(); return [e.innerText.replace(/\s+/g, ' ').slice(0, 60), Math.round(q.x - m.x), Math.round(q.y - m.y + scrollY), Math.round(q.width), Math.round(q.height)]; }); });
  await p.goto(BASE + '/painel/servicos'); const sv = await p.$$eval('main a[href^="/painel/servicos/c"]', as => as.map(a => [a.getAttribute('href'), a.innerText.split('\n')[0]]));
  for (const [h, t] of sv) if (/Extens|Manuten/.test(t)) { await p.goto(BASE + h, { waitUntil: 'networkidle' }); out['serv_' + t.split(' ')[0]] = await rotulos(); }
  await p.goto(BASE + '/painel/configuracoes', { waitUntil: 'networkidle' }); out.config = await rotulos();
  await ctx.close();
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const c = await m.newPage();
  await c.goto(BASE + '/b/flor-de-lotus', { waitUntil: 'networkidle' });
  out.pagina = await c.evaluate(() => [...document.querySelectorAll('h1,h2,h3')].map(e => [e.innerText.slice(0, 40), Math.round(e.getBoundingClientRect().y + scrollY)]));
  await c.goto(BASE + '/b/flor-de-lotus/entrar', { waitUntil: 'networkidle' }); const ok2 = c.getByRole('button', { name: 'Entendi' }); if (await ok2.count()) await ok2.first().click();
  await c.locator('input').first().fill('11987654321'); await c.locator('input[type=password]').fill('123456');
  await c.getByRole('button', { name: /Entrar/ }).last().click(); await c.waitForLoadState('networkidle');
  await c.goto(BASE + '/b/flor-de-lotus/conta/perfil', { waitUntil: 'networkidle' }); out.perfil = (await c.evaluate(() => document.body.innerText)).slice(0, 800);
  await c.goto(BASE + '/b/flor-de-lotus/conta', { waitUntil: 'networkidle' });
  const ag = '/b/flor-de-lotus/agendamento/a056f531-e9bf-4807-aedb-2e820998f175';
  await c.goto(BASE + ag, { waitUntil: 'networkidle' });
  const fichaHref = await c.$$eval('a', as => as.map(a => [a.getAttribute('href'), a.innerText]).filter(x => /Ficha|ficha/.test(x[1])));
  out.fichaHref = fichaHref;
  if (fichaHref[0]) {
    await c.goto(BASE + fichaHref[0][0], { waitUntil: 'networkidle' }); await c.waitForTimeout(500);
    await c.screenshot({ path: 'assets/capturas/cel_ficha_preatendimento.png', fullPage: true });
    out.ficha = await c.evaluate(() => [...document.querySelectorAll('h1,h2,h3,legend,label,canvas,button')].map(e => [e.tagName, e.innerText.slice(0, 50), Math.round(e.getBoundingClientRect().y + scrollY), Math.round(e.getBoundingClientRect().height)]));
  }
  fs.writeFileSync('/var/tmp/medir_v2.json', JSON.stringify(out, null, 0)); await b.close();
})();
