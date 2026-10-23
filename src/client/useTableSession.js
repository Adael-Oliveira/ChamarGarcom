import { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { CALL_STATUS, VIEWED_DISPLAY_MINUTES } from '../shared/model';

/** Toda a lógica da página da mesa, em tempo real (sem polling). */
export function useTableSession(token) {
  const [link, setLink] = useState({ loading: true, data: null, error: null });
  const [settings, setSettings] = useState(null);
  const [brand, setBrand] = useState(null);
  const [state, setState] = useState(null);
  const [call, setCall] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [lastReason, setLastReason] = useState('waiter');
  const [offset, setOffset] = useState(0); // relógio do servidor − relógio do celular
  const pending = useRef(null);

  useEffect(() => {
    if (!token) return setLink({ loading: false, data: null, error: 'missing' });
    return api.watchTableLink(token, (err, data) =>
      setLink({ loading: false, data, error: err ? 'network' : data ? null : 'not-found' }),
    );
  }, [token]);

  const rid = link.data?.restaurantId;
  const tableId = link.data?.tableId;

  useEffect(() => {
    if (!rid) return;
    const a = api.watchSettings(rid, setSettings, () => setSettings({ callsEnabled: false, billEnabled: false }));
    const b = api.watchBrand(rid, setBrand, () => setBrand({}));
    return () => {
      a();
      b();
    };
  }, [rid]);

  useEffect(() => {
    if (!rid || !tableId) return;
    return api.watchTableState(rid, tableId, (s) => {
      if (s && s.confirmed && pending.current && pending.current.callId === s.lastCallId && s.lastCallAt) {
        setOffset(s.lastCallAt.getTime() - pending.current.at);
        pending.current = null;
      }
      setState(s);
    });
  }, [rid, tableId]);

  const callId = state?.lastCallId;
  useEffect(() => {
    if (!rid || !callId) return setCall(null);
    return api.watchCall(rid, callId, setCall);
  }, [rid, callId]);

  // vibra quando o caixa clica em "Visualizado"
  const prev = useRef(null);
  useEffect(() => {
    if (prev.current === CALL_STATUS.PENDING && call?.status === CALL_STATUS.VIEWED) navigator.vibrate?.([120, 80, 120]);
    prev.current = call?.status ?? null;
  }, [call?.status]);

  async function callWaiter(reason) {
    if (!link.data || sending) return;
    setError(null);
    setLastReason(reason);
    setSending(true);
    pending.current = { at: Date.now() };
    const r = await api.createCall({ token, link: link.data, reason });
    setSending(false);
    if (r.ok) {
      pending.current = { ...pending.current, callId: r.callId };
      navigator.vibrate?.(60);
    } else {
      pending.current = null;
      setError(r.error);
    }
  }

  return { link, settings, brand, state, call, sending, error, lastReason, offset, callWaiter };
}

export function phaseOf({ sending, call, now }) {
  if (sending) return 'sending';
  if (!call) return 'idle';
  if (call.status === CALL_STATUS.PENDING) return 'pending';
  if (call.status === CALL_STATUS.VIEWED && call.viewedAt && now - call.viewedAt.getTime() < VIEWED_DISPLAY_MINUTES * 60000) return 'viewed';
  return 'idle';
}
