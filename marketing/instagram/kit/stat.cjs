const { chromium } = require('playwright'); const fs = require('fs');
const V = 'assets/', R = __dirname + '/../../../node_modules/@fontsource-variable';
const d64 = (p, m) => `data:${m};base64,` + fs.readFileSync(p).toString('base64');
const A = { FONT_B: d64(R + '/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2', 'font/woff2'), FONT_O: d64(R + '/onest/files/onest-latin-wght-normal.woff2', 'font/woff2'),
 IMG_m1: d64(V + 'm-1-menu.png', 'image/png'), IMG_m3: d64(V + 'm-3-caminho.png', 'image/png'), IMG_painel: d64(V + 'a-painel-nova.jpg', 'image/jpeg'), IMG_wframe: d64('assets/frame.png', 'image/png'), IMG_w2: d64(V + 'w-b-chamada.png', 'image/png') };
let js = fs.readFileSync('statics.js', 'utf8').replace(/'ASSET:([^']+)'/g, (m, n) => "'" + d64('assets/' + n, n.endsWith('.png') ? 'image/png' : 'image/jpeg') + "'"); for (const k of Object.keys(A).filter(k=>k.startsWith('IMG'))) js = js.split("'" + k + "'").join("'" + A[k] + "'");
let html = fs.readFileSync('statics.head.html', 'utf8').replace('FONT_B', A.FONT_B).replace('FONT_O', A.FONT_O) + '<script>' + js + '</script></body></html>';
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  fs.mkdirSync('out', { recursive: true });
  for (const id of await p.$$eval('body>div', (d) => d.map((x) => x.id))) await (await p.$('#' + id)).screenshot({ path: `out/${id}.jpg`, type: 'jpeg', quality: 93 });
  await b.close(); })();
