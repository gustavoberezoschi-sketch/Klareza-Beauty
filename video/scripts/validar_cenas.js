// Carrega tempos + cenas (v2) e confere ordem dos tempos dentro de cada cena.
const vm = require('vm'), fs = require('fs'); const dir = process.argv[2] || 'v2';
const ctx = {}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(`${dir}/tempos.js`, 'utf8').replace('window.', 'this.'), ctx);
globalThis.TEMPOS = ctx.TEMPOS; const C = require(`../${dir}/cenas.js`);
let prev = -1; const prob = [];
C.S.forEach((s, i) => {
  const fim = C.S[i + 1] ? C.S[i + 1].t : C.DURACAO;
  if (s.t < prev) prob.push(`cena ${i} fora de ordem`); prev = s.t;
  const ts = [];
  (s.subs || []).forEach(([t, x]) => ts.push(['sub', t, x]));
  (s.objs || []).forEach((o) => { ts.push(['obj', o.tE, o.src || o.tipo]); (o.call || []).forEach((c) => ts.push(['call', c[0], c[3]])); (o.telas || []).forEach((c) => ts.push(['tela', c[0], c[1]])); (o.taps || []).forEach((c) => ts.push(['tap', c[0], ''])); (o.itens || []).forEach((c) => ts.push(['item', c[0], c[1]])); });
  (s.notas || []).forEach((n) => ts.push(['nota', n[0], n[2][0]]));
  ts.forEach(([k, t, x]) => { if (t < s.t - 0.01 || t > fim + 0.01) prob.push(`cena ${i} (${(s.titulo || ['fim']).join(' ')}): ${k} "${x}" em ${t.toFixed(2)} fora de [${s.t.toFixed(2)}, ${fim.toFixed(2)}]`); });
});
console.log('cenas', C.S.length, 'duracao', C.DURACAO.toFixed(1)); console.log(prob.length ? prob.join('\n') : 'ok');
fs.writeFileSync(`${dir}/audio_eventos.json`, JSON.stringify({ duracao: C.DURACAO, inicio_levada: C.L0(1), gancho: C.GANCHO.map(g => g[0]), planos: C.S[C.S.length - 2].t, fim: C.S[C.S.length - 1].t, eventos: C.EVENTOS }));
