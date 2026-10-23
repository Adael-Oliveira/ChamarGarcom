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
