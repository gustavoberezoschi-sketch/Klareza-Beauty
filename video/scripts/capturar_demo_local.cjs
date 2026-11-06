// Capturas 2x da instância LOCAL de demonstração (seed do repositório, dados fictícios).
// Só navegação e leitura: nenhum botão de salvar/enviar/abrir caixa é clicado.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:3100';
const OUT = 'assets/capturas';
const meta = [];
async function dispensarCookies(p) { const b = p.getByRole('button', { name: 'Entendi' }); if (await b.count()) { await b.first().click().catch(()=>{}); } }
async function pronto(p) { await p.waitForLoadState('networkidle'); await p.evaluate(() => document.fonts.ready); await p.evaluate(() => Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; })))); }
async function shot(p, arquivo, seletor, uso, extra = {}) {
  await pronto(p);
  const loc = p.locator(seletor).first();
  const box = await loc.boundingBox();
  const path = `${OUT}/${arquivo}.png`;
  await loc.screenshot({ path });
  const { execSync } = require('child_process');
  const dim = execSync(`python3 -c "from PIL import Image;print(*Image.open('${path}').size)"`).toString().trim().split(' ').map(Number);
  const vp = p.viewportSize();
  meta.push({ arquivo: path, origem: 'instancia local de demonstracao (seed do repositorio, dados ficticios)', url: new URL(p.url()).pathname + new URL(p.url()).search.replace(/editar=[^&]+/, 'editar=<id>'), data: new Date().toISOString(), seletor, viewport: vp, escala: 2, caixa_css: box && { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) }, dimensoes_px: dim, uso, etiqueta: 'Exemplo', ...extra });
  console.log(arquivo, dim.join('x'));
}
async function login(ctx, email) {
  const p = await ctx.newPage();
  await p.goto(BASE + '/login'); await dispensarCookies(p);
  await p.fill('input[type=email]', email); await p.fill('input[type=password]', '123456');
  await Promise.all([p.waitForURL(/painel/), p.getByRole('button', { name: 'Entrar' }).click()]);
  return p;
}
(async () => {
  const b = await chromium.launch();
  // ---------- painel do dono ----------
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const p = await login(ctx, 'dono@flordelotus.com');
  const paginas = [
    ['inicio', '/painel', 'Início: faturamento, próximos atendimentos, avisos, aniversariantes'],
    ['agenda', '/painel/agenda', 'Agenda em grade por profissional, bloqueios'],
    ['agenda_bloqueios', '/painel/agenda/bloqueios', 'Folgas e bloqueios'],
    ['agenda_novo', '/painel/agenda/novo', 'Formulário de agendamento interno (encaixe), não enviado'],
    ['lembretes', '/painel/lembretes', 'Lembretes: amanhã, hoje, site, manutenção, espera, cuidados'],
    ['comandas', '/painel/comandas', 'Comandas fechadas do dia'],
    ['caixa', '/painel/caixa', 'Caixa por unidade'],
    ['clientes', '/painel/clientes', 'Clientes: lista, filtros, cashback'],
    ['assinaturas', '/painel/assinaturas', 'Clube de assinatura'],
    ['pacotes', '/painel/pacotes', 'Pacotes de sessões'],
    ['vitrine', '/painel/vitrine', 'Página do cliente: QR code, banners, parceiros'],
    ['servicos', '/painel/servicos', 'Serviços'],
    ['produtos', '/painel/produtos', 'Produtos e estoque por unidade'],
    ['equipe', '/painel/equipe', 'Equipe e comissões'],
    ['financeiro', '/painel/financeiro', 'Financeiro'],
    ['pagamentos', '/painel/pagamentos', 'Pagamentos online (estado na demo local)'],
    ['unidades', '/painel/unidades', 'Unidades'],
    ['relatorios', '/painel/relatorios?de=2026-10-08&ate=2026-11-06', 'Relatórios 30 dias'],
    ['configuracoes', '/painel/configuracoes', 'Configurações: regras, cashback, sinal, indicação'],
    ['plano', '/painel/plano', 'Meu plano: matriz dos 4 planos'],
  ];
  for (const [n, url, uso] of paginas) {
    await p.goto(BASE + url); await dispensarCookies(p);
    await shot(p, `painel_${n}`, 'main', uso);
  }
  // detalhes (navegação por links observados)
  await p.goto(BASE + '/painel/comandas'); await dispensarCookies(p);
  const com = await p.$$eval('main a[href^="/painel/comandas/c"]', as => as.map(a => a.getAttribute('href')));
  if (com[0]) { await p.goto(BASE + com[0]); await shot(p, 'painel_comanda_detalhe', 'main', 'Comanda fechada (detalhe)'); }
  await p.goto(BASE + '/painel/servicos');
  const servs = await p.$$eval('main a[href^="/painel/servicos/c"]', as => as.map(a => [a.getAttribute('href'), a.innerText.split('\n')[0]]));
  for (const [h, t] of servs) {
    if (/Extens|Manuten|Alongamento/.test(t)) { await p.goto(BASE + h); await shot(p, 'painel_servico_' + t.split(' ')[0].toLowerCase().normalize('NFD').replace(/[^a-z]/g,''), 'main', 'Serviço: ' + t + ' (variações, adicionais, manutenção, material, cuidados)'); }
  }
  await p.goto(BASE + '/painel/clientes');
  const cli = await p.$$eval('main a[href^="/painel/clientes/c"]', as => as.map(a => [a.getAttribute('href'), a.innerText]));
  const joana = cli.find(c => /Joana/.test(c[1])) || cli[0];
  await p.goto(BASE + joana[0]); await shot(p, 'painel_cliente_ficha', 'main', 'Ficha do cliente (fictícia)');
  await p.goto(BASE + '/painel/equipe');
  const eq = await p.$$eval('main a[href^="/painel/equipe/c"]', as => as.map(a => a.getAttribute('href')));
  await p.goto(BASE + eq[0]); await shot(p, 'painel_equipe_detalhe', 'main', 'Profissional: comissões e acesso');
  await p.goto(BASE + '/painel/caixa');
  const cx = await p.$$eval('main a', as => as.map(a => a.getAttribute('href')).filter(h => h && h.includes('caixa')));
  if (cx[0]) { await p.goto(BASE + cx[0]); await shot(p, 'painel_caixa_unidade', 'main', 'Caixa da unidade (só leitura)'); }
  await p.goto(BASE + '/painel/produtos');
  const pr = await p.$$eval('main a[href^="/painel/produtos/c"]', as => as.map(a => a.getAttribute('href')));
  await p.goto(BASE + pr[0]); await shot(p, 'painel_produto_detalhe', 'main', 'Produto: estoque por unidade, entradas, histórico');
  // painel inteiro com menu, para contexto
  await p.goto(BASE + '/painel'); await pronto(p);
  await p.screenshot({ path: `${OUT}/painel_inicio_com_menu.png` }); meta.push({ arquivo: `${OUT}/painel_inicio_com_menu.png`, url: '/painel', viewport: {width:1440,height:1000}, escala: 2, dimensoes_px: [2880,2000], uso: 'Contexto com menu completo', etiqueta: 'Exemplo', origem: 'instancia local de demonstracao' });
  await ctx.close();

  // ---------- login da profissional ----------
  const ctx2 = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const p2 = await login(ctx2, 'carla@flordelotus.com');
  await pronto(p2); await p2.screenshot({ path: `${OUT}/profissional_painel.png` });
  meta.push({ arquivo: `${OUT}/profissional_painel.png`, url: new URL(p2.url()).pathname, viewport: {width:1440,height:1000}, escala: 2, dimensoes_px: [2880,2000], uso: 'Acesso restrito da profissional', etiqueta: 'Exemplo', origem: 'instancia local de demonstracao' });
  await ctx2.close();

  // ---------- celular: página do salão e área do cliente ----------
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const c = await m.newPage();
  await c.goto(BASE + '/b/flor-de-lotus'); await dispensarCookies(c);
  await pronto(c); await c.screenshot({ path: `${OUT}/cel_pagina_salao.png`, fullPage: true });
  meta.push({ arquivo: `${OUT}/cel_pagina_salao.png`, url: '/b/flor-de-lotus', viewport: {width:390,height:844}, escala: 2, uso: 'Página pública do salão', etiqueta: 'Exemplo', origem: 'instancia local de demonstracao' });
  const ag = await c.$$eval('a', as => as.map(a => a.getAttribute('href')).filter(h => h && /agendar/.test(h)));
  fs.writeFileSync('/var/tmp/explore/cel_links.json', JSON.stringify(await c.$$eval('a', as => as.map(a => a.getAttribute('href')))));
  if (ag[0]) { await c.goto(BASE + ag[0]); await dispensarCookies(c); await pronto(c); await c.screenshot({ path: `${OUT}/cel_agendar_inicio.png` }); meta.push({ arquivo: `${OUT}/cel_agendar_inicio.png`, url: ag[0], viewport: {width:390,height:844}, escala: 2, uso: 'Agendamento: etapas', etiqueta: 'Exemplo', origem: 'instancia local de demonstracao' }); }
  fs.writeFileSync('assets/meta_demo_local.json', JSON.stringify(meta, null, 1));
  await b.close();
})();
