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
  roundRect(x, 0, W, 300, 0);
  x.fill();
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

  // QR
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, tableUrl(table.token), { width: 470, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#14161b', light: '#ffffff' } });
  x.drawImage(qr, (W - 470) / 2, 360);

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
