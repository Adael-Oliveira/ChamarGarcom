import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../lib/api';
import { startOfDay } from '../shared/format';
import { CALL_STATUS } from '../shared/model';

/** Rotas por hash (#/mesas) — funcionam no GitHub Pages sem configuração. */
export function useHashRoute(fallback) {
  const read = () => window.location.hash.replace(/^#\/?/, '').split(/[?/]/)[0] || fallback;
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []); // eslint-disable-line
  return [route, (r) => (window.location.hash = '/' + r)];
}

/** Assina um "watch" da api e devolve {loading, data, error}. */
export function useWatch(subscribe, deps, initial = null) {
  const [state, setState] = useState({ loading: true, data: initial, error: null });
  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    return subscribe(
      (data) => setState({ loading: false, data, error: null }),
      (error) => setState((s) => ({ ...s, loading: false, error })),
    );
  }, deps); // eslint-disable-line
  return state;
}

/** Relógio de tela (só redesenha contadores — não consulta o banco). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Chamadas desde o início do dia (ou últimas 12 h, o que for maior), em tempo real. */
export function useRecentCalls(rid) {
  const [hour, setHour] = useState(() => Math.floor(Date.now() / 3600000));
  useEffect(() => {
    const t = setInterval(() => setHour(Math.floor(Date.now() / 3600000)), 60000);
    return () => clearInterval(t);
  }, []);
  const since = useMemo(() => {
    const today = startOfDay();
    const h12 = new Date(Date.now() - 12 * 3600000);
    return today < h12 ? today : h12;
  }, [hour]); // eslint-disable-line
  return useWatch((ok, err) => api.watchCallsSince(rid, since, ok, err), [rid, since.getTime()], []);
}

/** Som + título da aba quando chega chamada nova. */
export function useNewCallAlert(calls, loading, soundOn, brandName) {
  const seen = useRef(null);
  useEffect(() => {
    if (loading) return;
    const pending = calls.filter((c) => c.status === CALL_STATUS.PENDING);
    if (seen.current === null) {
      seen.current = new Set(calls.map((c) => c.id));
    } else {
      const fresh = pending.filter((c) => !seen.current.has(c.id));
      calls.forEach((c) => seen.current.add(c.id));
      if (fresh.length && soundOn) chime(fresh.some((c) => c.reason === 'bill'));
    }
    document.title = pending.length ? `(${pending.length}) Chamada · ${brandName}` : `Central · ${brandName}`;
  }, [calls, loading, soundOn, brandName]);
}

let ctx;
export function chime(bill = false) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = bill ? [659, 880, 1175] : [880, 1175];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = ctx.currentTime + i * 0.2;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.36);
    });
  } catch {
    /* sem áudio */
  }
}

/** Preferência guardada só neste navegador. */
export function useLocalPref(key, initial) {
  const [v, setV] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });
  const set = (x) => {
    setV(x);
    try {
      localStorage.setItem(key, JSON.stringify(x));
    } catch {
      /* ignora */
    }
  };
  return [v, set];
}
