// Mede (somente leitura) as caixas dos cartões de cada tela capturada, relativas ao <main>, em px CSS.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:3100';
const PAGS = { inicio: '/painel', agenda: '/painel/agenda', agenda_bloqueios: '/painel/agenda/bloqueios', agenda_novo: '/painel/agenda/novo',
  lembretes: '/painel/lembretes', comandas: '/painel/comandas', caixa: '/painel/caixa', clientes: '/painel/clientes', assinaturas: '/painel/assinaturas',
  pacotes: '/painel/pacotes', vitrine: '/painel/vitrine', servicos: '/painel/servicos', produtos: '/painel/produtos', equipe: '/painel/equipe',
  financeiro: '/painel/financeiro', unidades: '/painel/unidades', relatorios: '/painel/relatorios?de=2026-10-08&ate=2026-11-06', configuracoes: '/painel/configuracoes', plano: '/painel/plano' };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } }); const p = await ctx.newPage();
  await p.goto(BASE + '/login'); const ok = p.getByRole('button', { name: 'Entendi' }); if (await ok.count()) await ok.first().click();
  await p.fill('input[type=email]', 'dono@flordelotus.com'); await p.fill('input[type=password]', '123456');
  await Promise.all([p.waitForURL(/painel/), p.getByRole('button', { name: 'Entrar' }).click()]);
  const medir = () => p.evaluate(() => {
    const m = document.querySelector('main').getBoundingClientRect();
    const r = e => { const q = e.getBoundingClientRect(); return [Math.round(q.x - m.x), Math.round(q.y - m.y + scrollY), Math.round(q.width), Math.round(q.height)]; };
    const cards = [...document.querySelectorAll('main section, main .card, main [class*="rounded-2xl"], main [class*="rounded-xl"], main h1, main h2, main h3, main table, main form')]
      .filter(e => e.getBoundingClientRect().width > 120 && e.getBoundingClientRect().height > 30)
      .map(e => ({ tag: e.tagName, txt: e.innerText.replace(/\s+/g, ' ').slice(0, 70), box: r(e) }));
    return { main: [Math.round(m.width), Math.round(document.querySelector('main').scrollHeight)], cards };
  });
  const out = {};
  for (const [k, u] of Object.entries(PAGS)) { await p.goto(BASE + u, { waitUntil: 'networkidle' }); out[k] = await medir(); }
  for (const [k, sel, re] of [['comanda_detalhe', '/painel/comandas', /\/painel\/comandas\/c/], ['cliente_ficha', '/painel/clientes', /\/painel\/clientes\/c/], ['equipe_detalhe', '/painel/equipe', /\/painel\/equipe\/c/], ['produto_detalhe', '/painel/produtos', /\/painel\/produtos\/c/]]) {
    await p.goto(BASE + sel); const hs = await p.$$eval('main a', (as) => as.map(a => [a.getAttribute('href'), a.innerText]));
    const h = (k === 'cliente_ficha' ? hs.find(x => /Joana/.test(x[1]) && /clientes\/c/.test(x[0])) : hs.find(x => re.test(x[0])));
    await p.goto(BASE + h[0], { waitUntil: 'networkidle' }); out[k] = await medir();
  }
  await p.goto(BASE + '/painel/servicos'); const sv = await p.$$eval('main a[href^="/painel/servicos/c"]', as => as.map(a => [a.getAttribute('href'), a.innerText]));
  for (const [h, t] of sv) if (/Extens|Manuten|Alongamento/.test(t)) { await p.goto(BASE + h, { waitUntil: 'networkidle' }); out['servico_' + t.split(' ')[0].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')] = await medir(); }
  fs.writeFileSync('assets/caixas_dom.json', JSON.stringify(out, null, 0));
  await b.close();
})();
