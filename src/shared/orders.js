// Cardápio digital e pedidos: modelo compartilhado (cliente, central e os dois bancos).
// Preços sempre em centavos (inteiros) para não ter erro de arredondamento.

export const ORDER_STATUS = {
  WAITING: 'WAITING', // aguardando o caixa aprovar (quando a aprovação está ligada)
  NEW: 'NEW', // enviado para a cozinha
  PREPARING: 'PREPARING',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
  CANCELED: 'CANCELED',
};

/** Rótulos para o cliente. */
export const ORDER_LABEL_CLIENT = {
  WAITING: 'Aguardando confirmação',
  NEW: 'Recebido',
  PREPARING: 'Em preparo',
  READY: 'Pronto',
  DELIVERED: 'Entregue',
  CANCELED: 'Cancelado',
};
/** Rótulos para a central. */
export const ORDER_LABEL = {
  WAITING: 'Aprovar',
  NEW: 'Novo',
  PREPARING: 'Em preparo',
  READY: 'Pronto',
  DELIVERED: 'Entregue',
  CANCELED: 'Cancelado',
};

/** Etapas que o cliente acompanha. */
export const CLIENT_STEPS = ['NEW', 'PREPARING', 'READY'];
export const ACTIVE_ORDER = new Set(['WAITING', 'NEW', 'PREPARING', 'READY']);

export const MAX_ORDER_LINES = 40;
export const MAX_QTY = 50;
export const ORDER_COOLDOWN_SEC = 20;
export const MAX_IMAGE_CHARS = 190000;

export const EMPTY_MENU = { categories: [] };

export function brl(cents) {
  const v = (Number(cents) || 0) / 100;
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
/** "12,90" | "12.9" | "R$ 1.234,50" → centavos (ou null se inválido). */
export function parsePrice(text) {
  let t = String(text ?? '').replace(/[^\d.,]/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
  const v = Math.round(parseFloat(t) * 100);
  return Number.isFinite(v) && v >= 0 && v <= 10000000 ? v : null;
}
export const priceInput = (cents) => (cents == null ? '' : (cents / 100).toFixed(2).replace('.', ','));

export function newId(prefix = '') {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return prefix + Array.from(b, (x) => x.toString(36).padStart(2, '0')).join('').slice(0, 10);
}

const str = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Deixa o cardápio num formato conhecido (o que vem do banco pode estar incompleto). */
export function sanitizeMenu(m) {
  const cats = Array.isArray(m?.categories) ? m.categories : [];
  return {
    categories: cats.slice(0, 40).map((c) => ({
      id: str(c.id, 20) || newId('c'),
      name: str(c.name, 40) || 'Sem nome',
      items: (Array.isArray(c.items) ? c.items : []).slice(0, 80).map((i) => ({
        id: str(i.id, 20) || newId('i'),
        name: str(i.name, 60) || 'Item',
        desc: String(i.desc ?? '').trim().slice(0, 200),
        price: Number.isInteger(i.price) && i.price >= 0 ? i.price : 0,
        available: i.available !== false,
        img: i.img ? str(i.img, 40) : null,
        tag: i.tag ? str(i.tag, 20) : null,
        opts:
          i.opts && Array.isArray(i.opts.choices) && i.opts.choices.filter(Boolean).length
            ? { title: str(i.opts.title, 40) || 'Escolha', choices: i.opts.choices.map((x) => str(x, 40)).filter(Boolean).slice(0, 12) }
            : null,
      })),
    })),
  };
}

export const menuItemCount = (menu) => (menu?.categories || []).reduce((a, c) => a + c.items.length, 0);
export const menuHasItems = (menu) => (menu?.categories || []).some((c) => c.items.some((i) => i.available));

/** Linha do pedido (o que vai para o banco e para a comanda). */
export function orderLine(item, qty, opt, obs) {
  return {
    id: item.id,
    name: item.name,
    price: item.price,
    qty: Math.max(1, Math.min(MAX_QTY, qty | 0)),
    opt: opt || null,
    obs: str(obs, 80) || null,
  };
}
export const linesTotal = (lines) => lines.reduce((a, l) => a + l.price * l.qty, 0);
export const linesCount = (lines) => lines.reduce((a, l) => a + l.qty, 0);
export const sameLine = (a, b) => a.id === b.id && (a.opt || null) === (b.opt || null) && (a.obs || null) === (b.obs || null);

/** Código curto do pedido para falar e conferir ("#K7Q2"). */
/**
 * Como o pedido é chamado: número do dia (nº 1, nº 2…, recomeça todo dia).
 * Pedidos antigos, sem número, usam as 4 últimas letras do identificador.
 */
export const orderCode = (o) =>
  o && typeof o === 'object' && Number.isInteger(o.number)
    ? `nº ${o.number}`
    : '#' + String((o && typeof o === 'object' ? o.id : o) || '').replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase();

/** Dia no horário de Brasília como número (20261117): a numeração dos pedidos recomeça a cada dia. */
export const dayKey = (d = new Date()) => {
  const t = new Date(d.getTime() - 3 * 3600000);
  return t.getUTCFullYear() * 10000 + (t.getUTCMonth() + 1) * 100 + t.getUTCDate();
};

/** Contas abertas por mesa: soma dos pedidos que entram na conta. */
export function openBills(orders) {
  const m = new Map();
  for (const o of orders.filter(countsInBill)) {
    const b = m.get(o.tableId) || { tableId: o.tableId, tableNumber: o.tableNumber, orders: [], total: 0 };
    b.orders.push(o);
    b.total += o.total;
    m.set(o.tableId, b);
  }
  return [...m.values()].sort((a, b) => a.tableNumber - b.tableNumber);
}

/** Pedidos que somam na conta da mesa (não cancelados e ainda não fechados). */
export const countsInBill = (o) => o.status !== ORDER_STATUS.CANCELED && o.status !== ORDER_STATUS.WAITING && !o.closed;

/**
 * A impressora da cozinha imprime este pedido? Mesma regra do firmware:
 * pedido novo ainda não impresso, ou um "Reimprimir" de pedido em andamento.
 */
export const needsPrint = (o) =>
  !o.printed &&
  (o.status === ORDER_STATUS.NEW ||
    ((o.printCount || 0) > 0 && (o.status === ORDER_STATUS.PREPARING || o.status === ORDER_STATUS.READY)));
