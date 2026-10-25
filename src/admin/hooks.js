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

// ============================================================ alertas de chamada
// Som em loop enquanto houver mesa esperando + notificação do sistema (Windows/Mac/Android).
// O loop é um áudio repetido pelo próprio navegador (não depende de timers), então continua
// tocando com a aba em segundo plano ou com a janela minimizada.

let ctx;
function audio() {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}
/** Desenha o "plim" num trecho de áudio (com silêncio no fim, para repetir). */
function chimeBuffer(bill, seconds) {
  const c = audio();
  const sr = c.sampleRate;
  const buf = c.createBuffer(1, Math.floor(sr * seconds), sr);
  const d = buf.getChannelData(0);
  const notes = bill ? [659, 880, 1175] : [880, 1175];
  notes.forEach((f, i) => {
    const t0 = Math.floor(i * 0.2 * sr);
    const len = Math.floor(0.45 * sr);
    for (let k = 0; k < len && t0 + k < d.length; k++) {
      const t = k / sr;
      const env = Math.min(1, t / 0.01) * Math.exp(-t * 7);
      d[t0 + k] += 0.32 * env * (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 2 * t));
    }
  });
  return buf;
}
/** Toca o som uma vez (botão "Testar"). */
export function chime(bill = false) {
  try {
    const c = audio();
    c.resume?.();
    const src = c.createBufferSource();
    src.buffer = chimeBuffer(bill, 1);
    src.connect(c.destination);
    src.start();
  } catch {
    /* sem áudio */
  }
}
let loop = null; // { src, bill }
function startLoop(bill) {
  try {
    if (loop && loop.bill === bill) return;
    stopLoop();
    const c = audio();
    const src = c.createBufferSource();
    src.buffer = chimeBuffer(bill, 3.5); // repete a cada 3,5 s
    src.loop = true;
    src.connect(c.destination);
    src.start();
    loop = { src, bill };
  } catch {
    /* sem áudio */
  }
}
function stopLoop() {
  try {
    loop?.src.stop();
  } catch {
    /* já parado */
  }
  loop = null;
}

/** Som e notificações já liberados neste navegador? (o navegador exige um clique antes) */
export function alertStatus() {
  const notif = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  const sound = ctx ? ctx.state : 'suspended';
  return { notif, sound };
}
/** Libera o som e pede permissão de notificação (precisa ser chamado num clique). */
export async function enableAlerts() {
  try {
    await audio().resume();
  } catch {
    /* ignora */
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      /* ignora */
    }
  }
  return alertStatus();
}
// qualquer clique na central já libera o som
if (typeof window !== 'undefined') {
  const unlock = () => {
    try {
      audio().resume();
    } catch {
      /* ignora */
    }
  };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
}

const ICON = `${import.meta.env.BASE_URL}favicon.svg`;
const shown = new Map(); // callId → Notification

/** Som em loop até a chamada ser visualizada + notificação no computador + título da aba. */
export function useNewCallAlert(calls, loading, soundOn, brandName, notifyOn = true) {
  const seen = useRef(null);
  useEffect(() => {
    if (loading) return;
    const pending = calls.filter((c) => c.status === CALL_STATUS.PENDING);
    if (seen.current === null) {
      seen.current = new Set(calls.map((c) => c.id));
    } else {
      const fresh = pending.filter((c) => !seen.current.has(c.id));
      calls.forEach((c) => seen.current.add(c.id));
      if (notifyOn && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        fresh.forEach((c) => {
          try {
            const n = new Notification(`Mesa ${c.tableNumber} · ${c.reason === 'bill' ? 'Pediu a conta' : 'Chamou o garçom'}`, {
              body: `${brandName} · toque para abrir a central`,
              icon: ICON,
              tag: `chamada-${c.id}`,
              requireInteraction: true,
            });
            n.onclick = () => {
              window.focus();
              n.close();
            };
            shown.set(c.id, n);
          } catch {
            /* sem notificação */
          }
        });
      }
    }
    // fecha a notificação de quem já foi atendido
    const pendingIds = new Set(pending.map((c) => c.id));
    shown.forEach((n, id) => {
      if (!pendingIds.has(id)) {
        n.close();
        shown.delete(id);
      }
    });
    // som repetindo enquanto houver mesa esperando
    if (soundOn && pending.length) startLoop(pending.some((c) => c.reason === 'bill'));
    else stopLoop();
    document.title = pending.length ? `(${pending.length}) Chamada · ${brandName}` : `Central · ${brandName}`;
  }, [calls, loading, soundOn, brandName, notifyOn]);
  useEffect(() => () => stopLoop(), []);
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
