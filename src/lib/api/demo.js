// =====================================================================
//  Banco de dados: DEMONSTRAÇÃO (sem Firebase)
//
//  Mesma interface do firebase.js, mas os dados ficam no navegador
//  (localStorage + IndexedDB). Abas e janelas do mesmo navegador
//  conversam em tempo real. Serve para experimentar a plataforma no
//  GitHub Pages antes de configurar o Firebase.
// =====================================================================
import { CALL_STATUS, DEFAULT_BRAND, DEFAULT_SETTINGS, generateToken, normalizeEmail } from '../../shared/model';

const KEY = 'chamar-garcom:demo:v2';
const SESSION = 'chamar-garcom:demo:user';
const RID = 'demo';
const DEMO_USER = { uid: 'demo-dono', email: 'voce@exemplo.com', name: 'Você (demonstração)', photo: null };

function safe(storageName) {
  try {
    const s = window[storageName];
    s.setItem('__t', '1');
    s.removeItem('__t');
    return s;
  } catch {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  }
}
const LS = safe('localStorage');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const MIN = 60000;

// ---------------------------------------------------------------- dados de exemplo
function seed() {
  const now = Date.now();
  const tables = [];
  const tableLinks = {};
  for (let n = 1; n <= 8; n++) {
    const id = 'm' + n;
    const token = generateToken();
    tables.push({ id, number: n, token, active: n !== 8, createdAt: now });
    tableLinks[token] = { restaurantId: RID, tableId: id, number: n, active: n !== 8 };
  }
  const calls = [];
  const tableState = {};
  const add = (tableNumber, minutesAgo, viewedAfterSec, reason = 'waiter', status) => {
    const calledAt = now - minutesAgo * MIN;
    const c = {
      id: uid() + calls.length,
      tableId: 'm' + tableNumber,
      tableNumber,
      reason,
      calledAt,
      viewedAt: viewedAfterSec != null ? calledAt + viewedAfterSec * 1000 : null,
      doneAt: null,
      status: status || (viewedAfterSec != null ? CALL_STATUS.DONE : CALL_STATUS.PENDING),
    };
    calls.push(c);
    const st = tableState[c.tableId];
    if (!st || st.lastCallAt < calledAt) tableState[c.tableId] = { lastCallId: c.id, lastCallAt: calledAt };
  };
  // histórico (ontem e dias anteriores) para os relatórios não começarem vazios
  [[3, 1500, 48], [5, 1470, 95], [1, 1440, 30, 'bill'], [2, 2900, 62], [6, 2880, 140], [4, 4300, 41, 'bill'], [7, 4320, 77]].forEach((a) => add(...a));
  // hoje
  [[2, 190, 35], [5, 150, 58, 'bill'], [1, 95, 72], [6, 60, 40]].forEach((a) => add(...a));
  add(3, 4, 30, 'waiter', CALL_STATUS.VIEWED); // garçom a caminho
  add(4, 1.5); // aguardando
  add(7, 0.4, null, 'bill'); // pediu a conta agora

  return {
    platform: { ownerUid: DEMO_USER.uid, signupOpen: false },
    admins: { [DEMO_USER.uid]: { restaurantId: RID, role: 'owner', email: DEMO_USER.email, name: DEMO_USER.name, createdAt: now } },
    invites: { 'garcom@exemplo.com': { restaurantId: RID, role: 'staff', createdBy: DEMO_USER.uid, createdAt: now - 3 * 3600000 } },
    tableLinks,
    restaurants: { [RID]: { name: 'Bistrô do Porto', ownerUid: DEMO_USER.uid } },
    settings: { [RID]: { ...DEFAULT_SETTINGS } },
    brand: {
      [RID]: { ...DEFAULT_BRAND, name: 'Bistrô do Porto', tagline: 'Cozinha de mar, mesa de casa', primary: '#0B5B73', accent: '#5EEAD4', style: 'classico' },
    },
    tables: { [RID]: tables },
    tableState: { [RID]: tableState },
    calls: { [RID]: calls },
  };
}

// ---------------------------------------------------------------- armazenamento + tempo real
function load() {
  try {
    const raw = JSON.parse(LS.getItem(KEY));
    if (raw && raw.restaurants) return raw;
  } catch {
    /* ignora */
  }
  const s = seed();
  LS.setItem(KEY, JSON.stringify(s));
  return s;
}
let db = load();
const subs = new Set();
const notify = () => subs.forEach((fn) => fn());

let channel = null;
try {
  channel = new BroadcastChannel('chamar-garcom-demo');
  channel.onmessage = () => {
    db = load();
    notify();
  };
} catch {
  /* navegador antigo: usa só o evento storage */
}
window.addEventListener('storage', (e) => {
  if (e.key === KEY || e.key === null) {
    db = load();
    notify();
  }
});

function commit(mutate) {
  db = load();
  const out = mutate(db);
  LS.setItem(KEY, JSON.stringify(db));
  notify();
  channel?.postMessage('changed');
  return out;
}

/** Cria uma assinatura: chama `fn(db)` agora e a cada mudança. */
function watch(fn) {
  const run = () => fn(db);
  subs.add(run);
  queueMicrotask(run);
  return () => subs.delete(run);
}

const D = (ms) => (ms ? new Date(ms) : null);
const outCall = (c) => ({ ...c, calledAt: D(c.calledAt), viewedAt: D(c.viewedAt), doneAt: D(c.doneAt) });
const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- cardápio PDF (IndexedDB)
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('chamar-garcom-demo', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbPut(key, val) {
  const base = await idb();
  await new Promise((res, rej) => {
    const tx = base.transaction('files', 'readwrite');
    tx.objectStore('files').put(val, key);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}
async function idbGet(key) {
  const base = await idb();
  return new Promise((res, rej) => {
    const r = base.transaction('files').objectStore('files').get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

// ---------------------------------------------------------------- api
const authSubs = new Set();
const currentUser = () => (LS.getItem(SESSION) ? DEMO_USER : null);

const api = {
  mode: 'demo',

  onAuth(cb) {
    authSubs.add(cb);
    queueMicrotask(() => cb(currentUser()));
    return () => authSubs.delete(cb);
  },
  async signIn() {
    LS.setItem(SESSION, '1');
    authSubs.forEach((cb) => cb(DEMO_USER));
  },
  async signOut() {
    LS.removeItem(SESSION);
    authSubs.forEach((cb) => cb(null));
  },
  async loadProfile(user) {
    await delay(80);
    const a = db.admins[user.uid];
    return a ? { status: 'ready', admin: { uid: user.uid, ...a } } : { status: 'denied' };
  },
  async createRestaurant() {
    return RID;
  },
  async acceptInvite() {},

  /** Só na demonstração: links das primeiras mesas ativas (para o simulador). */
  demoTokens: (n = 3) => (db.tables[RID] || []).filter((t) => t.active).slice(0, n).map((t) => t.token),

  /** Volta tudo ao exemplo inicial. */
  resetDemo() {
    LS.removeItem(KEY);
    db = load();
    notify();
    channel?.postMessage('changed');
  },

  watchPlatform: (cb) => watch((d) => cb(d.platform)),
  setSignupOpen: async (open) => commit((d) => (d.platform.signupOpen = !!open)),

  watchSettings: (rid, cb) => watch((d) => cb({ ...DEFAULT_SETTINGS, ...(d.settings[rid] || {}), menuUpdatedAt: D(d.settings[rid]?.menuUpdatedAt), _exists: !!d.settings[rid] })),
  watchBrand: (rid, cb) => watch((d) => cb({ ...DEFAULT_BRAND, ...(d.brand[rid] || {}) })),
  saveSettings: async (rid, patch) => commit((d) => Object.assign(d.settings[rid], patch)),
  saveBrand: async (rid, patch) =>
    commit((d) => {
      Object.assign(d.brand[rid], patch);
      if (patch.name) d.restaurants[rid].name = patch.name;
    }),

  watchTables: (rid, cb) => watch((d) => cb([...(d.tables[rid] || [])].sort((a, b) => a.number - b.number))),
  async createTable(rid, number) {
    commit((d) => {
      if (d.tables[rid].some((t) => t.number === number)) throw new Error(`A mesa ${number} já existe.`);
      const id = uid();
      const token = generateToken();
      d.tables[rid].push({ id, number, token, active: true, createdAt: Date.now() });
      d.tableLinks[token] = { restaurantId: rid, tableId: id, number, active: true };
    });
  },
  async updateTableNumber(rid, t, number) {
    commit((d) => {
      const x = d.tables[rid].find((y) => y.id === t.id);
      x.number = number;
      if (d.tableLinks[x.token]) d.tableLinks[x.token].number = number;
    });
  },
  async setTableActive(rid, t, active) {
    commit((d) => {
      const x = d.tables[rid].find((y) => y.id === t.id);
      x.active = active;
      if (d.tableLinks[x.token]) d.tableLinks[x.token].active = active;
    });
  },
  async regenerateToken(rid, t) {
    commit((d) => {
      const x = d.tables[rid].find((y) => y.id === t.id);
      delete d.tableLinks[x.token];
      x.token = generateToken();
      d.tableLinks[x.token] = { restaurantId: rid, tableId: x.id, number: x.number, active: x.active };
    });
  },
  async deleteTable(rid, t) {
    commit((d) => {
      d.tables[rid] = d.tables[rid].filter((y) => y.id !== t.id);
      delete d.tableLinks[t.token];
      delete d.tableState[rid][t.id];
    });
  },

  watchCallsSince: (rid, since, cb) =>
    watch((d) => cb((d.calls[rid] || []).filter((c) => c.calledAt >= since.getTime()).sort((a, b) => b.calledAt - a.calledAt).map(outCall))),
  async listCalls(rid, start, end) {
    await delay(150);
    return (db.calls[rid] || [])
      .filter((c) => c.calledAt >= start.getTime() && c.calledAt < end.getTime())
      .sort((a, b) => b.calledAt - a.calledAt)
      .map(outCall);
  },
  markViewed: async (rid, id) =>
    commit((d) => {
      const c = d.calls[rid].find((x) => x.id === id);
      if (c && c.status === CALL_STATUS.PENDING) Object.assign(c, { status: CALL_STATUS.VIEWED, viewedAt: Date.now() });
    }),
  markDone: async (rid, id) =>
    commit((d) => {
      const c = d.calls[rid].find((x) => x.id === id);
      if (c) Object.assign(c, { status: CALL_STATUS.DONE, doneAt: Date.now() });
    }),

  async uploadMenu(rid, file, _prev, onProgress) {
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) throw new Error('Selecione um arquivo PDF.');
    onProgress?.(0.3);
    await idbPut('menu:' + rid, file);
    onProgress?.(1);
    commit((d) => Object.assign(d.settings[rid], { menuUrl: 'idb:menu', menuFileName: file.name, menuPath: null, menuUpdatedAt: Date.now() }));
  },
  setMenuLink: async (rid, url) => commit((d) => Object.assign(d.settings[rid], { menuUrl: url, menuFileName: null, menuPath: null, menuUpdatedAt: Date.now() })),
  removeMenu: async (rid) => commit((d) => Object.assign(d.settings[rid], { menuUrl: null, menuFileName: null, menuPath: null, menuUpdatedAt: Date.now() })),
  async resolveMenuUrl(settings, rid = RID) {
    if (!settings.menuUrl) return null;
    if (settings.menuUrl !== 'idb:menu') return settings.menuUrl;
    const blob = await idbGet('menu:' + rid).catch(() => null);
    return blob ? URL.createObjectURL(blob) : null;
  },

  watchTeam: (rid, cb) =>
    watch((d) =>
      cb({
        members: Object.entries(d.admins)
          .filter(([, a]) => a.restaurantId === rid)
          .map(([u, a]) => ({ uid: u, ...a, createdAt: D(a.createdAt) })),
        invites: Object.entries(d.invites)
          .filter(([, i]) => i.restaurantId === rid)
          .map(([email, i]) => ({ email, ...i, createdAt: D(i.createdAt) })),
      }),
    ),
  async invite(rid, email, by, role = 'staff') {
    const e = normalizeEmail(email);
    commit((d) => {
      if (d.invites[e]) throw new Error('Já existe um convite para este e-mail.');
      d.invites[e] = { restaurantId: rid, role: role === 'owner' ? 'owner' : 'staff', createdBy: by, createdAt: Date.now() };
    });
  },
  revokeInvite: async (email) => commit((d) => delete d.invites[normalizeEmail(email)]),
  removeMember: async (u) => commit((d) => delete d.admins[u]),

  watchTableLink: (token, cb) => watch((d) => cb(null, d.tableLinks[token] || null)),
  watchTableState: (rid, tableId, cb) =>
    watch((d) => {
      const s = d.tableState[rid]?.[tableId];
      cb(s ? { lastCallId: s.lastCallId, lastCallAt: D(s.lastCallAt), confirmed: true } : null);
    }),
  watchCall: (rid, callId, cb) =>
    watch((d) => {
      const c = (d.calls[rid] || []).find((x) => x.id === callId);
      cb(c ? outCall(c) : null);
    }),
  /** Mesmas verificações que as regras do Firestore fazem no servidor. */
  async createCall({ token, reason }) {
    await delay(250);
    return commit((d) => {
      const link = d.tableLinks[token];
      if (!link || !link.active) return { error: 'rejected' };
      const rid = link.restaurantId;
      const s = d.settings[rid];
      if (!s.callsEnabled || (reason === 'bill' && !s.billEnabled)) return { error: 'rejected' };
      const st = d.tableState[rid][link.tableId];
      const now = Date.now();
      if (st && now < st.lastCallAt + s.cooldownMinutes * MIN) return { error: 'rejected' };
      const c = { id: uid(), tableId: link.tableId, tableNumber: link.number, reason, calledAt: now, viewedAt: null, doneAt: null, status: CALL_STATUS.PENDING };
      d.calls[rid].push(c);
      d.tableState[rid][link.tableId] = { lastCallId: c.id, lastCallAt: now };
      return { ok: true, callId: c.id };
    });
  },
};

export default api;
