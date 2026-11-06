// Captura cada cartão do painel como peça separada (2x), recortando pelas caixas reais do DOM (px CSS relativos ao <main>).
// Instância LOCAL de demonstração, só leitura.
const { chromium } = require('playwright');
const fs = require('fs'); const BASE = 'http://localhost:3100'; const OUT = 'v2/pecas';
const P = {
  '/painel/configuracoes': { cfg_identidade: [80, 191, 504, 660], cfg_regras: [600, 351, 504, 265], cfg_sinal: [600, 632, 504, 468], cfg_horario: [600, 191, 504, 144] },
  '/painel/unidades': { un_centro: [40, 115, 360, 178], un_norte: [412, 115, 360, 178] },
  '/painel/servicos': { sv_card_ext: [412, 545, 360, 172], sv_card_man: [40, 545, 360, 172], sv_card_esc: [40, 144, 360, 130] },
  'SERV:Extensão': { sv_basico: [80, 118, 666, 300], sv_comissao: [80, 420, 666, 128], sv_cuidados: [80, 596, 666, 160], sv_variacoes: [80, 780, 666, 270], sv_adicionais: [80, 1050, 666, 130], sv_material: [80, 1408, 666, 200], sv_quemfaz: [764, 314, 340, 224] },
  'SERV:Manutenção': { sv_faixas: [80, 1004, 666, 300] },
  '/painel/equipe': { eq_carla: [40, 115, 360, 192], eq_diana: [412, 115, 360, 192], eq_rafaela: [784, 115, 360, 192] },
  'EQUIPE': { eq_comissoes: [600, 118, 440, 190], eq_acesso: [600, 324, 440, 281] },
  '/painel/produtos': { pr_kpis: [40, 115, 1104, 115], pr_tabela: [40, 246, 728, 597] },
  'PRODUTO': { pr_estoque_un: [80, 251, 504, 243], pr_movimentar: [80, 510, 504, 338], pr_transferir: [80, 864, 504, 257], pr_historico: [600, 627, 504, 187] },
  '/painel/vitrine': { vt_qr: [40, 191, 1104, 242], vt_banners: [40, 449, 544, 682], vt_parceiros: [600, 449, 544, 682] },
  '/painel/assinaturas': { cl_kpis: [40, 115, 1104, 115], cl_assinantes: [40, 254, 688, 299], cl_planos: [40, 569, 688, 230], cl_criar: [744, 551, 400, 591] },
  '/painel/pacotes': { pc_manicure: [40, 115, 348, 164], pc_cilios: [400, 115, 348, 164], pc_novo: [764, 115, 380, 439] },
  '/painel': { in_k1: [40, 115, 267, 115], in_k2: [319, 115, 267, 115], in_k3: [598, 115, 267, 115], in_k4: [877, 115, 267, 115], in_grafico: [40, 246, 708, 265], in_proximos: [40, 527, 708, 341], in_avisos: [764, 392, 380, 302], in_caixa: [764, 246, 380, 130], in_aniver: [764, 710, 380, 102] },
  '/painel/agenda': { ag_grade: [40, 115, 1104, 760] },
  '/painel/agenda/bloqueios': { ag_bloq_novo: [144, 142, 380, 472], ag_bloq_lista: [540, 142, 500, 472] },
  '/painel/agenda/novo': { ag_novo: [256, 118, 672, 722] },
  '/painel/lembretes': { lb_amanha: [40, 159, 688, 289], lb_hoje: [40, 463, 688, 358], lb_site: [40, 837, 688, 381], lb_espera: [40, 1234, 688, 175], lb_manut: [40, 1728, 688, 404], lb_textos: [744, 159, 400, 651] },
  'CLIENTE': { fc_alerta: [40, 142, 1104, 48], fc_kpis: [40, 206, 1104, 115], fc_hist: [40, 337, 708, 368], fc_fotos: [40, 1064, 708, 260], fc_formulas: [40, 1339, 708, 352], fc_anamnese: [40, 1707, 708, 619], fc_clube: [764, 1170, 380, 144] },
  'COMANDA': { cm_aviso: [80, 142, 1024, 110], cm_itens: [80, 268, 648, 146], cm_resumo: [744, 268, 360, 327] },
  '/painel/financeiro': { fi_kpis: [40, 115, 1104, 115], fi_contas: [40, 246, 708, 219], fi_lancar: [764, 246, 380, 408] },
  '/painel/relatorios?de=2026-10-08&ate=2026-11-06': { rl_kpis: [40, 115, 1104, 131], rl_grafico: [40, 262, 1104, 265], rl_unidade: [40, 543, 1104, 158], rl_comissoes: [40, 717, 1104, 318], rl_margem: [40, 1051, 1104, 469], rl_servicos: [40, 1536, 357, 378], rl_produtos: [413, 1536, 357, 378], rl_pagamentos: [787, 1536, 357, 378] },
  '/painel/clientes': { ct_kpis: [40, 115, 1104, 93], ct_lista: [40, 224, 1104, 652] },
  '/painel/plano': { pl_solo: [40, 414, 262, 684], pl_bairro: [320, 414, 262, 684], pl_cidade: [600, 414, 262, 684], pl_nacional: [880, 414, 262, 684] },
};
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
  await p.goto(BASE + '/login'); const ok = p.getByRole('button', { name: 'Entendi' }); if (await ok.count()) await ok.first().click();
  await p.fill('input[type=email]', 'dono@flordelotus.com'); await p.fill('input[type=password]', '123456');
  await Promise.all([p.waitForURL(/painel/), p.getByRole('button', { name: 'Entrar' }).click()]);
  const link = async (lista, re, txt) => { await p.goto(BASE + lista); const hs = await p.$$eval('main a', as => as.map(a => [a.getAttribute('href'), a.innerText])); return hs.find(h => re.test(h[0]) && (!txt || txt.test(h[1])))[0]; };
  const meta = {};
  for (const [rota, pecas] of Object.entries(P)) {
    let url = rota;
    if (rota.startsWith('SERV:')) url = await link('/painel/servicos', /\/painel\/servicos\/c/, new RegExp('^' + rota.slice(5)));
    if (rota === 'EQUIPE') url = await link('/painel/equipe', /\/painel\/equipe\/c/, /Carla/);
    if (rota === 'PRODUTO') url = await link('/painel/produtos', /\/painel\/produtos\/c/);
    if (rota === 'CLIENTE') url = await link('/painel/clientes', /\/painel\/clientes\/c/, /Joana/);
    if (rota === 'COMANDA') url = await link('/painel/comandas', /\/painel\/comandas\/c/);
    await p.goto(BASE + url, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready);
    await p.evaluate(() => window.scrollTo(0, 0));
    const m = await p.evaluate(() => { const r = document.querySelector('main').getBoundingClientRect(); return { x: r.x, y: r.y + scrollY }; });
    for (const [nome, [x, y, w, h]] of Object.entries(pecas)) {
      await p.screenshot({ path: `${OUT}/${nome}.png`, fullPage: true, clip: { x: m.x + x, y: m.y + y, width: w, height: h } });
      meta[nome] = { rota: rota.startsWith('/') ? rota : url.replace(/c[a-z0-9]{20,}/, '<id>'), caixa_css: [x, y, w, h], px: [w * 2, h * 2] };
    }
    console.log(rota, Object.keys(pecas).length);
  }
  fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify(meta, null, 1)); await b.close();
})();
