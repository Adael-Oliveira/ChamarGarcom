// Redimensiona o logo no navegador antes de salvar.
// O resultado (data URL) é pequeno o bastante para ficar no Firestore,
// então o logo funciona mesmo sem o Firebase Storage (plano Blaze).
import { MAX_LOGO_CHARS } from '../../shared/model';

export async function fileToLogo(file, maxSide = 320) {
  if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(file.type)) {
    throw new Error('Envie uma imagem PNG, JPG, WEBP ou SVG.');
  }
  if (file.size > 8 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 8 MB.');

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Não foi possível ler esta imagem.'));
      i.src = url;
    });
    const w = img.naturalWidth || maxSide;
    const h = img.naturalHeight || maxSide;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // WebP mantém transparência e é pequeno; PNG como reserva.
    let out = canvas.toDataURL('image/webp', 0.9);
    if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/png');
    if (out.length > MAX_LOGO_CHARS) out = canvas.toDataURL('image/webp', 0.7);
    if (out.length > MAX_LOGO_CHARS) throw new Error('O logo ficou grande demais. Tente uma imagem mais simples.');
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Foto de item do cardápio: corta no formato 4:3, reduz e comprime (WebP ou JPEG)
 * até caber no Firestore. Fica em torno de 30–80 KB.
 */
export async function fileToMenuPhoto(file, maxChars = 190000) {
  if (!/^image\/(png|jpe?g|webp|heic|heif|gif)$/.test(file.type)) throw new Error('Envie uma foto JPG, PNG ou WEBP.');
  if (file.size > 15 * 1024 * 1024) throw new Error('A foto deve ter no máximo 15 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Não foi possível ler esta foto. Tente uma foto JPG.'));
      i.src = url;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    // recorte central 4:3
    let sw = w;
    let sh = Math.round((w * 3) / 4);
    if (sh > h) {
      sh = h;
      sw = Math.round((h * 4) / 3);
    }
    const sx = Math.round((w - sw) / 2);
    const sy = Math.round((h - sh) / 2);
    for (const [W, q] of [[640, 0.78], [560, 0.7], [480, 0.62], [400, 0.55]]) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(W, sw);
      canvas.height = Math.round((canvas.width * 3) / 4);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      let out = canvas.toDataURL('image/webp', q);
      if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', q);
      if (out.length <= maxChars) return out;
    }
    throw new Error('A foto ficou grande demais. Tente outra foto.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
