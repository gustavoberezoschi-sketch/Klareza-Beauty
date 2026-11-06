// Render determinístico: seek(t) por quadro -> JPEG q96 -> ffmpeg (H.264, yuv420p, CRF 16, 30 fps).
// Uso: node scripts/render.mjs --at 1,5.2,10  (quadros avulsos PNG em quadros/)   |  node scripts/render.mjs --out saida/video_sem_audio.mp4
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1]]]) : a), []));
const FMT = args.formato || '9x16'; const URL = 'http://127.0.0.1:8765/v2/film.html?render=1&formato=' + FMT; const [VW, VH] = FMT === '16x9' ? [1920, 1080] : [1080, 1920];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => { console.error('ERRO NA PÁGINA', e.message); process.exit(1); });
await p.goto(URL); await p.evaluate(() => window.ready);
const quadro = p.locator('#quadro');
if (args.at) {
  mkdirSync('v2/quadros', { recursive: true });
  for (const t of args.at.split(',').map(Number)) { await p.evaluate((t) => window.seek(t), t); await quadro.screenshot({ path: `v2/quadros/${FMT}_${t.toFixed(2).padStart(7, '0')}.png` }); }
} else {
  const dur = await p.evaluate(() => window.DURACAO); const F0 = Math.round((+args.de || 0) * 30); const N = args.ate ? Math.round(+args.ate * 30) : Math.round(dur * 30);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', '30', args.out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = F0; f < N; f++) {
    await p.evaluate((t) => window.seek(t), f / 30);
    const buf = await quadro.screenshot({ type: 'jpeg', quality: 96 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 300 === 0) console.log(`quadro ${f}/${N}`);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); console.log('ok', N, 'quadros');
}
await b.close();
