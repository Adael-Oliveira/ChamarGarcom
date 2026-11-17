import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../lib/api';
import { ACTIVE_ORDER, EMPTY_MENU, ORDER_COOLDOWN_SEC, ORDER_STATUS, linesCount, linesTotal, menuHasItems } from '../shared/orders';

const HOURS_KEPT = 12;
function store(kind) {
  try {
    const s = window[kind];
    s.setItem('__t', '1');
    s.removeItem('__t');
    return s;
  } catch {
    const m = new Map();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  }
}
const LS = store('localStorage');
const SS = store('sessionStorage');
const read = (s, k, fb) => {
  try {
    return JSON.parse(s.getItem(k)) ?? fb;
  } catch {
    return fb;
  }
};

/**
 * Cardápio digital da mesa: cardápio ao vivo, sacola (guardada nesta aba) e os
 * pedidos feitos por este celular (guardados por 12 h, acompanhados em tempo real).
 */
export function useOrdering(token, link, settings) {
  const rid = link?.restaurantId;
  const enabled = !!settings?.ordersEnabled && !settings?.suspended;
  const [menu, setMenu] = useState(EMPTY_MENU);
  const [cart, setCartState] = useState(() => read(SS, `cg:sacola:${token}`, []));
  const [mine, setMine] = useState(() => read(LS, `cg:pedidos:${token}`, []).filter((x) => Date.now() - x.at < HOURS_KEPT * 3600000));
  const [orders, setOrders] = useState({});
  const lastSent = useRef(mine.length ? Math.max(...mine.map((x) => x.at)) : 0);

  useEffect(() => {
    if (!rid || !enabled) return;
    return api.watchMenu(rid, setMenu, () => setMenu(EMPTY_MENU));
  }, [rid, enabled]);

  const setCart = (c) => {
    setCartState(c);
    try {
      SS.setItem(`cg:sacola:${token}`, JSON.stringify(c));
    } catch {
      /* ignora */
    }
  };

  const ids = mine.map((x) => x.id).join(',');
  useEffect(() => {
    if (!rid || !ids) return;
    const subs = ids.split(',').map((id) => api.watchOrder(rid, id, (o) => setOrders((m) => ({ ...m, [id]: o }))));
    return () => subs.forEach((u) => u());
  }, [rid, ids]);

  const list = useMemo(
    () =>
      mine
        .map((x) => orders[x.id])
        .filter(Boolean)
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)),
    [mine, orders],
  );
  const live = list.find((o) => ACTIVE_ORDER.has(o.status)) || null;

  // conta fechada na central: os pedidos saem deste celular e a mesa fica livre
  const [billClosed, setBillClosed] = useState(false);
  useEffect(() => {
    if (!mine.length || !mine.every((x) => orders[x.id])) return;
    const open = mine.filter((x) => !orders[x.id].closed);
    if (open.length === mine.length) return;
    setMine(open);
    try {
      if (open.length) LS.setItem(`cg:pedidos:${token}`, JSON.stringify(open));
      else LS.removeItem(`cg:pedidos:${token}`);
    } catch {
      /* ignora */
    }
    if (!open.length) {
      setBillClosed(true);
      setCart([]);
      lastSent.current = 0;
    }
  }, [orders]); // eslint-disable-line
  useEffect(() => {
    if (!billClosed) return;
    const t = setTimeout(() => setBillClosed(false), 15 * 60000);
    return () => clearTimeout(t);
  }, [billClosed]);

  // vibra quando o pedido fica pronto
  const prevLive = useRef(null);
  useEffect(() => {
    if (prevLive.current && live && prevLive.current.id === live.id && prevLive.current.status !== 'READY' && live.status === 'READY') navigator.vibrate?.([120, 80, 120]);
    prevLive.current = live;
  }, [live?.id, live?.status]); // eslint-disable-line

  async function send(note) {
    if (!cart.length) return { message: 'Sua sacola está vazia.' };
    const wait = Math.ceil((lastSent.current + ORDER_COOLDOWN_SEC * 1000 - Date.now()) / 1000);
    if (wait > 0) return { message: `Aguarde ${wait} s para enviar outro pedido.` };
    const r = await api.createOrder({ token, link, items: cart, total: linesTotal(cart), note: String(note || '').trim().slice(0, 200), approval: !!settings.ordersApproval });
    if (!r.ok) {
      if (r.error === 'network') return { message: 'Sem conexão com a internet. Verifique o sinal e tente de novo.' };
      if (r.error === 'cooldown') return { message: `Aguarde alguns segundos para enviar outro pedido.` };
      return { message: 'Não foi possível enviar agora. Aguarde alguns segundos e tente de novo, ou chame o garçom.' };
    }
    lastSent.current = Date.now();
    setBillClosed(false);
    const next = [...mine, { id: r.orderId, at: Date.now() }];
    setMine(next);
    try {
      LS.setItem(`cg:pedidos:${token}`, JSON.stringify(next));
    } catch {
      /* ignora */
    }
    setCart([]);
    navigator.vibrate?.(60);
    return { ok: true, orderId: r.orderId };
  }

  return {
    enabled: enabled && menuHasItems(menu),
    menu,
    cart,
    setCart,
    orders: list,
    live: live && { id: live.id, number: live.number, status: live.status, count: linesCount(live.items) },
    send,
    billClosed,
  };
}
export { ORDER_STATUS };
