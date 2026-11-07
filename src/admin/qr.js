import QRCode from 'qrcode';
import { tableUrl } from '../lib/env';
import { brandVars, initials, sanitizeBrand } from '../lib/theme/brand';

function loadImage(src) {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Mão acenando da marca Acenai (mesmos traços do favicon), em unidades de 0 a 64.
const HAND = [
  ['M12.5 31 L12.5 38 A11.5 11.5 0 0 0 33.5 44 L38 36.5', 4.6],
  ['M19 33 L24.5 21.5', 4.6],
  ['M25.5 36 L31 25', 4.6],
  ['M32 38.5 L36.5 30', 4.6],
  ['M40 16.5 A9 9 0 0 1 47.5 25', 4],
  ['M43 8.5 A17 17 0 0 1 56 22', 4],
];

/**
 * Desenha o QR Code personalizado: pontos arredondados, cantos escuros (a câmera precisa
 * deles escuros para achar o código) e um selo no centro com a mão do Acenai e o número
 * da mesa. Usa correção de erro H (até 30%); o selo cobre ~5% do código.
 */
export function drawBrandedQr(x, text, number, ox, oy, S) {
  const q = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const N = q.modules.size;
  const D = q.modules.data;
  const m = S / (N + 2);
  const o = m;
  const ink = '#15171c';
  x.save();
  x.fillStyle = '#ffffff';
  x.fillRect(ox, oy, S, S);
  const eye = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= N - 7) || (r >= N - 7 && c < 7);
  const hole = Math.round((N * 0.23) / 2) * 2 + 1;
  const h0 = (N - hole) / 2;
  x.fillStyle = ink;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      if (!D[r * N + c] || eye(r, c)) continue;
      if (r >= h0 && r < h0 + hole && c >= h0 && c < h0 + hole) continue;
      roundRect(x, ox + o + c * m + m * 0.04, oy + o + r * m + m * 0.04, m * 0.92, m * 0.92, m * 0.24);
      x.fill();
    }
  for (const [r, c] of [
    [0, 0],
    [0, N - 7],
    [N - 7, 0],
  ]) {
    const X = ox + o + c * m;
    const Y = oy + o + r * m;
    x.fillStyle = ink;
    roundRect(x, X, Y, 7 * m, 7 * m, 2.3 * m);
    x.fill();
    x.fillStyle = '#ffffff';
    roundRect(x, X + m, Y + m, 5 * m, 5 * m, 1.6 * m);
    x.fill();
    x.fillStyle = ink;
    roundRect(x, X + 2 * m, Y + 2 * m, 3 * m, 3 * m, 1.1 * m);
    x.fill();
  }
  // selo: fundo escuro, mão laranja, número claro
  const bs = hole * m;
  const bx = ox + o + h0 * m;
  const by = oy + o + h0 * m;
  x.fillStyle = '#ffffff';
  roundRect(x, bx - m * 0.3, by - m * 0.3, bs + m * 0.6, bs + m * 0.6, bs * 0.26);
  x.fill();
  x.fillStyle = ink;
  roundRect(x, bx + m * 0.2, by + m * 0.2, bs - m * 0.4, bs - m * 0.4, bs * 0.24);
  x.fill();
  const hs = bs * 0.5;
  x.save();
  x.translate(bx + (bs - hs) / 2 - bs * 0.02, by + bs * 0.06);
  x.scale(hs / 64, hs / 64);
  x.translate(1.5, 1);
  const g = x.createLinearGradient(0, 0, 64, 64);
  g.addColorStop(0, '#ffc21a');
  g.addColorStop(1, '#ff8a00');
  x.strokeStyle = g;
  x.lineCap = 'round';
  for (const [d, w] of HAND) {
    x.lineWidth = w;
    x.stroke(new Path2D(d));
  }
  x.restore();
  const label = String(number ?? '');
  const size = bs * (label.length > 2 ? 0.27 : label.length > 1 ? 0.33 : 0.36);
  x.fillStyle = '#fbf8f2';
  x.textAlign = 'center';
  x.textBaseline = 'alphabetic';
  x.font = `800 ${size}px "Bricolage Grotesque Variable", system-ui, sans-serif`;
  x.fillText(label, bx + bs / 2, by + bs * 0.88);
  x.restore();
}

/** Cartão de mesa pronto para imprimir, com a marca do restaurante. */
export async function tableCardPng(table, brandIn) {
  const brand = sanitizeBrand(brandIn);
  const v = brandVars(brand);
  await document.fonts?.ready;
  const display = v['--brand-display'];
  const body = v['--brand-font'];

  const W = 720;
  const H = 1000;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');

  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, W, H);

  // faixa da marca
  x.fillStyle = brand.primary;
  x.fillRect(0, 0, W, 300);
  x.fillStyle = brand.accent;
  x.fillRect(0, 300, W, 10);

  // logo ou iniciais
  const L = 92;
  const lx = 48;
  const ly = 44;
  x.save();
  roundRect(x, lx, ly, L, L, 26);
  x.clip();
  if (brand.logo) {
    x.fillStyle = '#fff';
    x.fillRect(lx, ly, L, L);
    const img = await loadImage(brand.logo);
    if (img) {
      const s = Math.min(L / img.width, L / img.height);
      x.drawImage(img, lx + (L - img.width * s) / 2, ly + (L - img.height * s) / 2, img.width * s, img.height * s);
    }
  } else {
    x.fillStyle = v['--brand-deep'];
    x.fillRect(lx, ly, L, L);
    x.fillStyle = v['--brand-ink'];
    x.font = `700 40px ${display}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(initials(brand.name), lx + L / 2, ly + L / 2 + 2);
  }
  x.restore();

  x.textBaseline = 'alphabetic';
  x.textAlign = 'left';
  x.fillStyle = v['--brand-ink'];
  x.font = `650 36px ${display}`;
  x.fillText(brand.name.slice(0, 26), 48, 222);
  if (brand.tagline) {
    x.globalAlpha = 0.8;
    x.font = `500 22px ${body}`;
    x.fillText(brand.tagline.slice(0, 44), 48, 258);
    x.globalAlpha = 1;
  }

  x.textAlign = 'right';
  x.font = `600 24px ${body}`;
  x.globalAlpha = 0.85;
  x.fillText('Mesa', W - 48, 82);
  x.globalAlpha = 1;
  x.font = `800 130px ${display}`;
  x.fillText(String(table.number), W - 44, 196);

  // QR com a marca Acenai e o número da mesa no centro
  await document.fonts?.load('800 40px "Bricolage Grotesque Variable"').catch(() => {});
  drawBrandedQr(x, tableUrl(table.token), table.number, (W - 470) / 2, 360, 470);

  x.textAlign = 'center';
  x.fillStyle = '#14161b';
  x.font = `700 36px ${display}`;
  x.fillText('Aponte a câmera para', W / 2, 900);
  x.fillText('chamar o garçom', W / 2, 944);
  x.fillStyle = '#6b7280';
  x.font = `500 20px ${body}`;
  x.fillText('Também dá para pedir a conta e ver o cardápio', W / 2, 980);

  return c.toDataURL('image/png');
}

export function download(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Folha A4 com os cartões das mesas (2 por linha) e abre a impressão. */
export async function printSheet(tables, brand) {
  const win = window.open('', '_blank');
  if (!win) throw new Error('O navegador bloqueou a janela de impressão. Permita pop-ups para este site.');
  win.document.write('<p style="font-family:sans-serif;padding:24px">Gerando QR Codes…</p>');
  const cards = [];
  for (const t of tables) cards.push({ n: t.number, png: await tableCardPng(t, brand) });
  win.document.open();
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>QR Codes das mesas</title>
<style>@page{size:A4;margin:10mm}body{margin:0}.g{display:grid;grid-template-columns:1fr 1fr;gap:8mm}
.c{break-inside:avoid;border:1px dashed #bbb;padding:2mm}img{width:100%;display:block}</style></head><body>
<div class="g">${cards.map((c) => `<div class="c"><img alt="Mesa ${c.n}" src="${c.png}"></div>`).join('')}</div>
<script>onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`);
  win.document.close();
}
