// Lê o embed público do perfil (sem login) para checar temas já publicados.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 540, height: 1400 } });
  await p.goto('https://www.instagram.com/rotta_digitaloficial/embed/', { waitUntil: 'networkidle' }).catch(()=>{});
  await p.waitForTimeout(3000);
  console.log((await p.evaluate(() => document.body.innerText)).slice(0, 1500));
  console.log(JSON.stringify(await p.$$eval('a', as => [...new Set(as.map(a => a.href).filter(h => /\/(p|reel)\//.test(h)))])));
  await p.screenshot({ path: '/tmp/claude-0/-home-user-Klareza-Beauty/995cbe12-b5e2-5c90-adb2-73be2dc423dd/scratchpad/ig.png' });
  await b.close();
})();
