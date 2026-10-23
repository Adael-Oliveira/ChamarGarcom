// Modelo de dados compartilhado pelos dois "bancos" (Firebase e demonstração).

export const CALL_STATUS = { PENDING: 'PENDING', VIEWED: 'VIEWED', DONE: 'DONE' };
export const CALL_REASON = { WAITER: 'waiter', BILL: 'bill' };

export const REASON_LABEL = {
  waiter: 'Chamou o garçom',
  bill: 'Pediu a conta',
};

export const STATUS_LABEL = {
  PENDING: 'Aguardando',
  VIEWED: 'Garçom a caminho',
  DONE: 'Concluída',
};

export const DEFAULT_SETTINGS = {
  callsEnabled: true,
  billEnabled: true,
  cooldownMinutes: 2,
  menuUrl: null,
  menuFileName: null,
  menuPath: null,
  menuUpdatedAt: null,
};

export const BRAND_STYLES = {
  moderno: { label: 'Moderno', font: "'Onest Variable', system-ui, sans-serif", display: "'Bricolage Grotesque Variable', 'Onest Variable', system-ui, sans-serif", radius: 22 },
  classico: { label: 'Clássico', font: "'Onest Variable', system-ui, sans-serif", display: "'Fraunces Variable', Georgia, serif", radius: 14 },
  leve: { label: 'Leve', font: "'Nunito Variable', system-ui, sans-serif", display: "'Nunito Variable', system-ui, sans-serif", radius: 30 },
};

export const BRAND_PRESETS = [
  { id: 'brasa', label: 'Brasa', primary: '#C2410C', accent: '#FDBA74' },
  { id: 'oceano', label: 'Oceano', primary: '#0B5B73', accent: '#5EEAD4' },
  { id: 'horta', label: 'Horta', primary: '#2F6B3B', accent: '#D9F99D' },
  { id: 'vinho', label: 'Vinho', primary: '#7A1F3D', accent: '#F9A8D4' },
  { id: 'carvao', label: 'Carvão', primary: '#1F2937', accent: '#FBBF24' },
  { id: 'anil', label: 'Anil', primary: '#3730A3', accent: '#A5B4FC' },
];

export const DEFAULT_BRAND = {
  name: 'Meu Restaurante',
  tagline: '',
  logo: null, // data URL (PNG/WebP pequeno) — fica no próprio Firestore, sem precisar do Storage
  primary: '#C2410C',
  accent: '#FDBA74',
  style: 'moderno',
};

/** Depois de quanto tempo um "garçom a caminho" volta a aparecer como livre. */
export const VIEWED_DISPLAY_MINUTES = 10;
/** A partir de quantos minutos uma chamada pendente fica "atrasada" (vermelho). */
export const LATE_AFTER_MINUTES = 3;

export const HEX = /^#[0-9a-fA-F]{6}$/;
export const MAX_LOGO_CHARS = 240000;

/** Token aleatório e impossível de adivinhar (128 bits). */
export function generateToken() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function normalizeEmail(e) {
  return String(e || '').trim().toLowerCase();
}

export function summarize(calls) {
  const times = calls.filter((c) => c.viewedAt && c.calledAt).map((c) => c.viewedAt - c.calledAt);
  return {
    total: calls.length,
    attended: times.length,
    pending: calls.filter((c) => c.status === CALL_STATUS.PENDING).length,
    bills: calls.filter((c) => c.reason === CALL_REASON.BILL).length,
    avgMs: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
    minMs: times.length ? Math.min(...times) : null,
    maxMs: times.length ? Math.max(...times) : null,
  };
}
