// Transforma a marca do restaurante (cores + estilo) em variáveis CSS.
// Garante contraste: o texto sobre a cor principal vira branco ou escuro
// automaticamente, conforme a luminância.
import { BRAND_STYLES, DEFAULT_BRAND, HEX } from '../../shared/model';

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}
function luminance(hex) {
  const c = hexToRgb(hex).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
export function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
}
/** Melhor cor de texto (branco ou quase-preto) sobre `bg`. */
export function inkOn(bg) {
  return contrast(bg, '#ffffff') >= contrast(bg, '#14161b') ? '#ffffff' : '#14161b';
}
/** Escurece a cor até ter contraste ≥ 4.5 com o branco (para texto/links em fundo claro). */
export function readableOnWhite(hex) {
  let c = hex;
  for (let i = 0; i < 12 && contrast(c, '#ffffff') < 4.5; i++) c = mix(c, '#000000', 0.12);
  return c;
}

export function sanitizeBrand(b = {}) {
  const out = { ...DEFAULT_BRAND, ...b };
  if (!HEX.test(out.primary)) out.primary = DEFAULT_BRAND.primary;
  if (!HEX.test(out.accent)) out.accent = DEFAULT_BRAND.accent;
  if (!BRAND_STYLES[out.style]) out.style = 'moderno';
  return out;
}

/** Variáveis CSS da marca (aplicadas no :root ou num elemento de pré-visualização). */
export function brandVars(brand) {
  const b = sanitizeBrand(brand);
  const s = BRAND_STYLES[b.style];
  return {
    '--brand': b.primary,
    '--brand-ink': inkOn(b.primary),
    '--brand-deep': mix(b.primary, '#000000', 0.32),
    '--brand-soft': mix(b.primary, '#ffffff', 0.9),
    '--brand-softer': mix(b.primary, '#ffffff', 0.95),
    '--brand-text': readableOnWhite(b.primary),
    '--accent': b.accent,
    '--accent-ink': inkOn(b.accent),
    '--brand-font': s.font,
    '--brand-display': s.display,
    '--brand-radius': `${s.radius}px`,
  };
}

const ROOT_KEYS = ['--brand', '--brand-ink', '--brand-deep', '--accent', '--accent-ink', '--brand-font', '--brand-display', '--brand-radius'];

/** Aplica a marca no documento. Tons suaves e texto ficam a cargo do CSS (claro/escuro). */
export function applyBrand(brand, el = document.documentElement) {
  const all = brandVars(brand);
  const vars = Object.fromEntries(ROOT_KEYS.map((k) => [k, all[k]]));
  vars['--brand-readable'] = all['--brand-text'];
  Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && el === document.documentElement) meta.setAttribute('content', all['--brand-deep']);
}

/** Iniciais para quando não há logo: "Bistrô do Porto" → "BP". */
export function initials(name = '') {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(d[aeo]s?|e|the|of)$/i.test(w));
  return (words[0]?.[0] || '?').toUpperCase() + (words[1]?.[0] || '').toUpperCase();
}
