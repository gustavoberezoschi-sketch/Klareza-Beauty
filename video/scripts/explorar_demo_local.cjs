// Exploração (somente leitura) da instância LOCAL de demonstração. Não grava nada.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:3100';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/login');
  await p.fill('input[name=email], input[type=email]', 'dono@flordelotus.com');
  await p.fill('input[type=password]', '123456');
  await Promise.all([p.waitForURL(/painel/), p.getByRole('button', { name: 'Entrar' }).click()]);
  const links = await p.$$eval('nav a, aside a', as => [...new Set(as.map(a => a.getAttribute('href')))].filter(h => h && h.startsWith('/painel')));
  const out = { links, pages: {} };
  for (const l of links) {
    await p.goto(BASE + l, { waitUntil: 'networkidle' });
    const name = l.replace(/\//g, '_');
    await p.screenshot({ path: `/var/tmp/explore/${name}.png`, fullPage: true });
    out.pages[l] = { url: p.url(), h: await p.evaluate(() => document.body.scrollHeight), text: (await p.evaluate(() => document.querySelector('main')?.innerText || document.body.innerText)).slice(0, 2500),
      sublinks: await p.$$eval('main a', as => [...new Set(as.map(a => a.getAttribute('href')))]) };
  }
  fs.writeFileSync('/var/tmp/explore/out.json', JSON.stringify(out, null, 1));
  await b.close();
})();
