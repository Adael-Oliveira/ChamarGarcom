// node rend.cjs r1 [--frames t1,t2] 
const { chromium } = require('playwright'); const fs = require('fs'); const { spawn } = require('child_process');
const V = 'assets/', R = __dirname + '/../../../node_modules/@fontsource-variable';
const d64 = (p, m) => `data:${m};base64,` + fs.readFileSync(p).toString('base64');
const A = { FONT_B: d64(R + '/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2', 'font/woff2'), FONT_O: d64(R + '/onest/files/onest-latin-wght-normal.woff2', 'font/woff2'),
 IMG_m1: d64(V + 'm-1-menu.png', 'image/png'), IMG_m2: d64(V + 'm-2-chamando.png', 'image/png'), IMG_m3: d64(V + 'm-3-caminho.png', 'image/png'), IMG_plaque: d64(V + 'plaquinha-5.png', 'image/png'),
 IMG_painel: d64(V + 'a-painel-nova.jpg', 'image/jpeg'), IMG_equipe: d64(V + 'a-equipe.jpg', 'image/jpeg'), IMG_rel: d64(V + 'a-relatorios.jpg', 'image/jpeg'),
 IMG_c1: d64(V + 'm-cor-Brasa.png', 'image/png'), IMG_c2: d64(V + 'm-cor-Vinho.png', 'image/png'), IMG_c3: d64(V + 'm-cor-Horta.png', 'image/png'),
 IMG_wframe: d64('assets/frame.png', 'image/png'), IMG_w1: d64(V + 'w-a-espera.png', 'image/png'), IMG_w2: d64(V + 'w-b-chamada.png', 'image/png'), IMG_w3: d64(V + 'w-b2-chamada.png', 'image/png'), IMG_w4: d64(V + 'w-c-caminho.png', 'image/png') };
let defs = fs.readFileSync('defs.js', 'utf8'); for (const [k, v] of Object.entries(A)) defs = defs.split("'" + k + "'").join("'" + v + "'");
let html = fs.readFileSync('engine.html', 'utf8').replace('FONT_B', A.FONT_B).replace('FONT_O', A.FONT_O).replace('REELDEFS', () => defs);
const id = process.argv[2], fr = process.argv[3] === '--frames' ? process.argv[4].split(',').map(Number) : null;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.setContent(html); await p.evaluate(() => document.fonts.ready);
  const T = await p.evaluate((id) => setShots(R[id]), id); const sfx = await p.evaluate(() => sfx());
  if (fr) { for (const t of fr) { await p.evaluate((t) => render(t), t); await p.waitForTimeout(50); await p.screenshot({ path: `chk-${id}-${t}.jpg`, type: 'jpeg', quality: 80 }); } await b.close(); return; }
  fs.writeFileSync(`out/${id}.json`, JSON.stringify({ T, sfx }));
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', `out/${id}.v.tmp.mp4`]);
  const N = Math.round(T * 30);
  for (let i = 0; i < N; i++) { await p.evaluate((t) => render(t), i / 30); const buf = await p.screenshot({ type: 'jpeg', quality: 92 }); if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r)); }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); fs.renameSync(`out/${id}.v.tmp.mp4`, `out/${id}.v.mp4`);
  await b.close(); console.log(id, T, sfx.length);
})();
