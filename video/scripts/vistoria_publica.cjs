// Vistoria de leitura do site público. Não clica em nada que grave dados.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const out = {};
  for (const path of ['/', '/planos', '/termos', '/privacidade', '/saloes', '/login']) {
    await p.goto('https://klareza-beauty.vercel.app' + path, { waitUntil: 'networkidle' });
    // abre FAQ (<details>) sem enviar nada
    await p.$$eval('details', ds => ds.forEach(d => d.open = true)).catch(() => {});
    out[path] = {
      title: await p.title(),
      text: await p.evaluate(() => document.body.innerText),
      links: await p.$$eval('a', as => [...new Set(as.map(a => a.getAttribute('href')))]),
    };
  }
  await p.goto('https://klareza-beauty.vercel.app/', { waitUntil: 'networkidle' });
  out.css = await p.evaluate(() => {
    const r = getComputedStyle(document.documentElement);
    const vars = {};
    for (const n of ['--lp-tinta','--lp-verde','--lp-verde-escuro','--lp-verde-claro','--lp-suave','--lp-cinza','--lp-linha','--color-verde-claro']) vars[n] = r.getPropertyValue(n).trim();
    const h1 = document.querySelector('h1'); const cs = h1 && getComputedStyle(h1);
    const em = h1 && h1.querySelector('em,i,span'); const ce = em && getComputedStyle(em);
    return { vars, h1: cs && { font: cs.fontFamily, w: cs.fontWeight, size: cs.fontSize, ls: cs.letterSpacing, text: h1.innerText },
      em: ce && { font: ce.fontFamily, style: ce.fontStyle, color: ce.color, text: em.innerText },
      body: getComputedStyle(document.body).fontFamily,
      fonts: [...document.fonts].filter(f=>f.status==='loaded').map(f => f.family + ' ' + f.style + ' ' + f.weight),
      imgs: [...document.images].map(i => i.currentSrc || i.src),
      fontUrls: [...document.styleSheets].flatMap(s => { try { return [...s.cssRules].filter(r => r.type === 5).map(r => r.cssText.slice(0, 300)); } catch { return []; } }) };
  });
  fs.writeFileSync('vistoria_raw.json', JSON.stringify(out, null, 1));
  await b.close();
})();
