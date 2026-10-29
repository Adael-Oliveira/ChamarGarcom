// =====================================================================
//  Banco de dados: Firebase (Auth + Firestore + Storage)
//
//  admins/{uid}                         → quem acessa a central {restaurantId, role}
//  invites/{email}                      → convites pendentes para a equipe
//  platform/config                      → dono da plataforma e se novos cadastros estão abertos
//  platform/public                      → contatos do dono da plataforma (público)
//  leads/{id}                           → interessados ("Quero uma demonstração")
//  tableLinks/{token}                   → token do QR → mesa (público, só "get")
//  restaurants/{rid}                    → restaurante {name, ownerUid}
//  restaurants/{rid}/settings/general   → chamadas on/off, intervalo, cardápio (público)
//  restaurants/{rid}/settings/brand     → nome, logo, cores, estilo (público)
//  restaurants/{rid}/tables/{id}        → mesas (só admin)
//  restaurants/{rid}/tableState/{id}    → última chamada da mesa (intervalo no servidor)
//  restaurants/{rid}/calls/{id}         → chamadas
// =====================================================================
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { firebaseConfig, useEmulators } from '../env';
import { CALL_STATUS, DEFAULT_BRAND, DEFAULT_SETTINGS, cleanPerms, cleanStaffName, generateToken, normalizeEmail } from '../../shared/model';

const config = useEmulators
  ? { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-chamar-garcom', storageBucket: 'demo-chamar-garcom.appspot.com', appId: 'demo' }
  : firebaseConfig;

const app = initializeApp(config);
const auth = getAuth(app);
let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch {
  db = initializeFirestore(app, {});
}
const emuHost = import.meta.env.VITE_EMULATOR_HOST || window.location.hostname || '127.0.0.1';
if (useEmulators) {
  connectAuthEmulator(auth, `http://${emuHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emuHost, 8080);
}

// Storage só é carregado quando alguém envia um cardápio em PDF.
let storageMod = null;
async function storage() {
  if (!storageMod) {
    const m = await import('firebase/storage');
    const s = m.getStorage(app);
    if (useEmulators) m.connectStorageEmulator(s, emuHost, 9199);
    storageMod = { m, s };
  }
  return storageMod;
}

// ---------------------------------------------------------------- helpers
const P = {
  platform: () => doc(db, 'platform', 'config'),
  contacts: () => doc(db, 'platform', 'public'),
  leads: () => collection(db, 'leads'),
  lead: (id) => doc(db, 'leads', id),
  admin: (uid) => doc(db, 'admins', uid),
  admins: () => collection(db, 'admins'),
  invite: (email) => doc(db, 'invites', email),
  pairing: (code) => doc(db, 'devicePairings', code),
  invites: () => collection(db, 'invites'),
  link: (token) => doc(db, 'tableLinks', token),
  restaurant: (rid) => doc(db, 'restaurants', rid),
  restaurants: () => collection(db, 'restaurants'),
  settings: (rid) => doc(db, 'restaurants', rid, 'settings', 'general'),
  brand: (rid) => doc(db, 'restaurants', rid, 'settings', 'brand'),
  tables: (rid) => collection(db, 'restaurants', rid, 'tables'),
  table: (rid, id) => doc(db, 'restaurants', rid, 'tables', id),
  state: (rid, id) => doc(db, 'restaurants', rid, 'tableState', id),
  calls: (rid) => collection(db, 'restaurants', rid, 'calls'),
  call: (rid, id) => doc(db, 'restaurants', rid, 'calls', id),
};

const toDate = (t) => (t && typeof t.toDate === 'function' ? t.toDate() : t instanceof Date ? t : null);

function inviteDoc(rid, by, role, displayName, perms) {
  const r = role === 'owner' ? 'owner' : 'staff';
  const d = { restaurantId: rid, role: r, createdBy: by, createdAt: serverTimestamp() };
  const n = cleanStaffName(displayName);
  if (n) d.displayName = n;
  if (r === 'staff') d.perms = cleanPerms(perms);
  return d;
}

function normCall(snap) {
  const d = snap.data({ serverTimestamps: 'estimate' });
  return {
    id: snap.id,
    tableId: d.tableId,
    tableNumber: d.tableNumber,
    reason: d.reason || 'waiter',
    status: d.status,
    calledAt: toDate(d.calledAt),
    viewedAt: toDate(d.viewedAt),
    viewedBy: d.viewedBy || null,
    viewedByName: d.viewedByName || null,
    doneAt: toDate(d.doneAt),
    doneBy: d.doneBy || null,
    doneByName: d.doneByName || null,
  };
}

function userOf(u) {
  return u && { uid: u.uid, email: normalizeEmail(u.email), name: u.displayName || '', photo: u.photoURL || null };
}

function friendly(e) {
  const code = e?.code || '';
  if (code === 'permission-denied')
    return Object.assign(new Error('Sua conta não tem acesso a isso. Se acha que é um engano, fale com o suporte da plataforma.'), { code });
  if (code === 'unavailable') return Object.assign(new Error('Sem conexão com o servidor. Verifique a internet.'), { code });
  return e;
}
const wrap = (p) => p.catch((e) => Promise.reject(friendly(e)));

// ---------------------------------------------------------------- api
const api = {
  mode: 'firebase',

  // ---------- autenticação ----------
  onAuth(cb) {
    getRedirectResult(auth).catch(() => {});
    return onAuthStateChanged(auth, (u) => cb(userOf(u)));
  },
  async signIn() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        return signInWithRedirect(auth, provider);
      }
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
      if (e.code === 'auth/unauthorized-domain') {
        throw new Error(`Este endereço (${location.hostname}) não está autorizado no Firebase. Adicione em Authentication → Settings → Authorized domains.`);
      }
      if (e.code === 'auth/configuration-not-found' || e.code === 'auth/operation-not-allowed') {
        throw new Error('O login com Google não está ativado no Firebase (Authentication → Sign-in method → Google).');
      }
      throw e;
    }
  },
  signOut: () => fbSignOut(auth),

  /**
   * Descobre o que mostrar para quem acabou de entrar.
   * O dono da plataforma pode abrir qualquer restaurante para suporte (supportRid).
   */
  async loadProfile(user, { supportRid } = {}) {
    const platform = await getDoc(P.platform()).catch((e) => Promise.reject(friendly(e)));
    const platformOwner = platform.exists() && platform.data().ownerUid === user.uid;
    const adminSnap = await getDoc(P.admin(user.uid)).catch((e) => Promise.reject(friendly(e)));

    if (platformOwner && supportRid && supportRid !== adminSnap.data()?.restaurantId) {
      const r = await getDoc(P.restaurant(supportRid)).catch(() => null);
      if (r?.exists()) {
        return { status: 'ready', admin: { uid: user.uid, email: user.email, name: user.name, restaurantId: supportRid, role: 'owner', platformOwner, support: true } };
      }
    }
    if (adminSnap.exists()) {
      const admin = { uid: user.uid, ...adminSnap.data(), platformOwner };
      if (!platformOwner) {
        const s = await getDoc(P.settings(admin.restaurantId)).catch(() => null);
        if (s?.data()?.suspended) {
          const b = await getDoc(P.brand(admin.restaurantId)).catch(() => null);
          return { status: 'suspended', restaurantName: b?.data()?.name || 'restaurante' };
        }
      }
      return { status: 'ready', admin };
    }
    if (platformOwner) return { status: 'platform' };

    if (user.email) {
      const inv = await getDoc(P.invite(user.email)).catch(() => null);
      if (inv?.exists()) {
        const rid = inv.data().restaurantId;
        const brand = await getDoc(P.brand(rid)).catch(() => null);
        return { status: 'invite', invite: { email: user.email, ...inv.data(), restaurantName: brand?.data()?.name || 'restaurante' } };
      }
    }
    if (!platform.exists()) return { status: 'setup', first: true };
    if (platform.data().signupOpen) return { status: 'setup', first: false };
    return { status: 'denied' };
  },

  /** Cria o restaurante e torna o usuário dono dele (e da plataforma, se for o primeiro). */
  async createRestaurant(user, { name, first }) {
    const rid = doc(P.restaurants()).id;
    const b = writeBatch(db);
    if (first) b.set(P.platform(), { ownerUid: user.uid, signupOpen: false, createdAt: serverTimestamp() });
    b.set(P.restaurant(rid), { name, ownerUid: user.uid, createdAt: serverTimestamp() });
    b.set(P.admin(user.uid), { restaurantId: rid, role: 'owner', email: user.email, name: user.name || '', createdAt: serverTimestamp() });
    b.set(P.settings(rid), { ...DEFAULT_SETTINGS, updatedAt: serverTimestamp() });
    b.set(P.brand(rid), { ...DEFAULT_BRAND, name, updatedAt: serverTimestamp() });
    await wrap(b.commit());
    return rid;
  },

  async acceptInvite(user, invite) {
    const b = writeBatch(db);
    const a = { restaurantId: invite.restaurantId, role: invite.role === 'owner' ? 'owner' : 'staff', email: user.email, name: (user.name || '').slice(0, 120), createdAt: serverTimestamp() };
    if (invite.displayName) a.displayName = invite.displayName;
    if (Array.isArray(invite.perms)) a.perms = invite.perms;
    b.set(P.admin(user.uid), a);
    b.delete(P.invite(user.email));
    await wrap(b.commit());
  },

  /** Acompanha o próprio acesso (some quando a pessoa é removida da equipe). */
  watchMyAccess(uid, cb) {
    return onSnapshot(P.admin(uid), (s) => cb(s.exists() ? s.data() : null), () => cb(null));
  },
  watchPlatform(cb) {
    return onSnapshot(P.platform(), (s) => cb(s.exists() ? s.data() : null), () => cb(null));
  },
  setSignupOpen: (open) => wrap(updateDoc(P.platform(), { signupOpen: !!open })),

  // ---------- configurações e marca (leitura pública) ----------
  watchSettings(rid, cb, onError) {
    return onSnapshot(
      P.settings(rid),
      (s) => cb({ ...DEFAULT_SETTINGS, ...(s.data() || {}), menuUpdatedAt: toDate(s.data()?.menuUpdatedAt), _exists: s.exists() }),
      (e) => onError?.(friendly(e)),
    );
  },
  watchBrand(rid, cb, onError) {
    return onSnapshot(
      P.brand(rid),
      (s) => cb({ ...DEFAULT_BRAND, ...(s.data() || {}) }),
      (e) => onError?.(friendly(e)),
    );
  },
  saveSettings: (rid, patch) => wrap(updateDoc(P.settings(rid), { ...patch, updatedAt: serverTimestamp() })),
  async saveBrand(rid, patch) {
    const b = writeBatch(db);
    b.update(P.brand(rid), { ...patch, updatedAt: serverTimestamp() });
    if (patch.name) b.update(P.restaurant(rid), { name: patch.name });
    await wrap(b.commit());
  },

  // ---------- mesas ----------
  watchTables(rid, cb, onError) {
    return onSnapshot(
      P.tables(rid),
      (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.number - b.number)),
      (e) => onError?.(friendly(e)),
    );
  },
  async createTable(rid, number) {
    const ref = doc(P.tables(rid));
    const token = generateToken();
    const b = writeBatch(db);
    b.set(ref, { number, token, active: true, createdAt: serverTimestamp() });
    b.set(P.link(token), { restaurantId: rid, tableId: ref.id, number, active: true });
    await wrap(b.commit());
  },
  async updateTableNumber(rid, t, number) {
    const b = writeBatch(db);
    b.update(P.table(rid, t.id), { number, updatedAt: serverTimestamp() });
    b.update(P.link(t.token), { number });
    await wrap(b.commit());
  },
  async setTableActive(rid, t, active) {
    const b = writeBatch(db);
    b.update(P.table(rid, t.id), { active, updatedAt: serverTimestamp() });
    b.update(P.link(t.token), { active });
    await wrap(b.commit());
  },
  async regenerateToken(rid, t) {
    const token = generateToken();
    const b = writeBatch(db);
    b.delete(P.link(t.token));
    b.set(P.link(token), { restaurantId: rid, tableId: t.id, number: t.number, active: t.active });
    b.update(P.table(rid, t.id), { token, updatedAt: serverTimestamp() });
    await wrap(b.commit());
  },
  async deleteTable(rid, t) {
    const b = writeBatch(db);
    b.delete(P.table(rid, t.id));
    b.delete(P.link(t.token));
    b.delete(P.state(rid, t.id));
    await wrap(b.commit());
  },

  // ---------- chamadas ----------
  watchCallsSince(rid, since, cb, onError) {
    const q = query(P.calls(rid), where('calledAt', '>=', Timestamp.fromDate(since)), orderBy('calledAt', 'desc'));
    return onSnapshot(
      q,
      (s) => cb(s.docs.map(normCall)),
      (e) => onError?.(friendly(e)),
    );
  },
  async listCalls(rid, start, end) {
    const q = query(
      P.calls(rid),
      where('calledAt', '>=', Timestamp.fromDate(start)),
      where('calledAt', '<', Timestamp.fromDate(end)),
      orderBy('calledAt', 'desc'),
      limit(5000),
    );
    const s = await wrap(getDocs(q));
    return s.docs.map(normCall);
  },
  /** Quem clicou fica registrado no relatório (uid + nome no momento do atendimento). */
  markViewed: (rid, id, who) =>
    wrap(updateDoc(P.call(rid, id), { status: CALL_STATUS.VIEWED, viewedAt: serverTimestamp(), viewedBy: who.uid, viewedByName: cleanStaffName(who.name) })),
  markDone: (rid, id, who) =>
    wrap(updateDoc(P.call(rid, id), { status: CALL_STATUS.DONE, doneAt: serverTimestamp(), doneBy: who.uid, doneByName: cleanStaffName(who.name) })),

  // ---------- cardápio ----------
  async uploadMenu(rid, file, previousPath, onProgress) {
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) throw new Error('Selecione um arquivo PDF.');
    if (file.size > 20 * 1024 * 1024) throw new Error('O PDF deve ter no máximo 20 MB.');
    const { m, s } = await storage();
    const path = `menus/${rid}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_').slice(-80)}`;
    const task = m.uploadBytesResumable(m.ref(s, path), file, { contentType: 'application/pdf', cacheControl: 'public, max-age=300' });
    await new Promise((res, rej) => {
      task.on('state_changed', (x) => onProgress?.(x.totalBytes ? x.bytesTransferred / x.totalBytes : 0), rej, res);
    }).catch((e) => {
      if (e.code === 'storage/unauthorized') throw new Error('O envio de PDF não está disponível. Use a opção de link ou fale com o suporte da plataforma.');
      if (/storage\/(unknown|retry-limit-exceeded|no-default-bucket|bucket-not-found)/.test(e.code))
        throw new Error('O Firebase Storage não está ativado neste projeto. Use a opção de link ou ative o Storage (plano Blaze).');
      throw e;
    });
    const url = await m.getDownloadURL(task.snapshot.ref);
    await api.saveSettings(rid, { menuUrl: url, menuFileName: file.name, menuPath: path, menuUpdatedAt: serverTimestamp() });
    if (previousPath) m.deleteObject(m.ref(s, previousPath)).catch(() => {});
  },
  async setMenuLink(rid, url, previousPath) {
    await api.saveSettings(rid, { menuUrl: url, menuFileName: null, menuPath: null, menuUpdatedAt: serverTimestamp() });
    if (previousPath) storage().then(({ m, s }) => m.deleteObject(m.ref(s, previousPath))).catch(() => {});
  },
  async removeMenu(rid, previousPath) {
    await api.saveSettings(rid, { menuUrl: null, menuFileName: null, menuPath: null, menuUpdatedAt: serverTimestamp() });
    if (previousPath) storage().then(({ m, s }) => m.deleteObject(m.ref(s, previousPath))).catch(() => {});
  },
  resolveMenuUrl: async (settings) => settings.menuUrl || null,

  // ---------- equipe ----------
  watchTeam(rid, cb, onError) {
    let members = [];
    let invites = [];
    const emit = () => cb({ members, invites });
    const u1 = onSnapshot(
      query(P.admins(), where('restaurantId', '==', rid)),
      (s) => {
        members = s.docs.map((d) => ({ uid: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) }));
        emit();
      },
      (e) => onError?.(friendly(e)),
    );
    const u2 = onSnapshot(
      query(P.invites(), where('restaurantId', '==', rid)),
      (s) => {
        invites = s.docs.map((d) => ({ email: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) }));
        emit();
      },
      (e) => onError?.(friendly(e)),
    );
    return () => {
      u1();
      u2();
    };
  },
  async invite(rid, email, by, role = 'staff', { displayName, perms } = {}) {
    const e = normalizeEmail(email);
    const existing = await getDoc(P.invite(e)).catch(() => null);
    if (existing?.exists()) throw new Error('Já existe um convite para este e-mail.');
    const b = writeBatch(db);
    b.set(P.invite(e), inviteDoc(rid, by, role, displayName, perms));
    await wrap(b.commit());
  },
  /** Responsável muda o nome e (para a Equipe) as permissões de um membro. */
  updateMember(uid, member, { displayName, perms }) {
    const patch = { displayName: cleanStaffName(displayName) || deleteField() };
    if (member.role === 'staff') patch.perms = cleanPerms(perms);
    return wrap(updateDoc(P.admin(uid), patch));
  },
  /** Conecta um relógio: o código aparece na tela do aparelho e vale 15 minutos. */
  async pairDevice(rid, code, displayName) {
    const c = String(code || '').replace(/\D/g, '');
    if (c.length !== 6) throw new Error('O código do relógio tem 6 números.');
    const name = cleanStaffName(displayName);
    if (!name) throw new Error('Dê um nome para o relógio. Ex.: Relógio do dono.');
    const snap = await getDoc(P.pairing(c)).catch((e) => Promise.reject(friendly(e)));
    const p = snap.data();
    if (!snap.exists() || !p?.uid) throw new Error('Código não encontrado. Confira o número na tela do relógio.');
    if (Date.now() - toDate(p.createdAt).getTime() > 14 * 60000) throw new Error('Esse código expirou. Reinicie o relógio para gerar outro.');
    const b = writeBatch(db);
    b.set(P.admin(p.uid), { restaurantId: rid, role: 'staff', email: '', name: 'Relógio', displayName: name, perms: [], device: true, pairCode: c, createdAt: serverTimestamp() });
    b.delete(P.pairing(c));
    await wrap(b.commit());
  },
  revokeInvite: (email) => wrap(deleteDoc(P.invite(normalizeEmail(email)))),
  removeMember: (uid) => wrap(deleteDoc(P.admin(uid))),

  // ---------- administração da plataforma (só o dono da plataforma) ----------
  /** Restaurantes clientes, com a equipe e os convites de cada um. */
  watchClients(cb, onError) {
    let restaurants = null;
    let admins = [];
    let invites = [];
    const emit = () => {
      if (!restaurants) return;
      cb(
        restaurants
          .map((r) => ({
            ...r,
            members: admins.filter((a) => a.restaurantId === r.id),
            invites: invites.filter((i) => i.restaurantId === r.id),
          }))
          .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)),
      );
    };
    const fail = (e) => onError?.(friendly(e));
    const u1 = onSnapshot(
      P.restaurants(),
      (s) => {
        restaurants = s.docs.map((d) => ({ id: d.id, ...d.data(), suspended: !!d.data().suspended, createdAt: toDate(d.data().createdAt) }));
        emit();
      },
      fail,
    );
    const u2 = onSnapshot(
      P.admins(),
      (s) => {
        admins = s.docs.map((d) => ({ uid: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) }));
        emit();
      },
      fail,
    );
    const u3 = onSnapshot(
      P.invites(),
      (s) => {
        invites = s.docs.map((d) => ({ email: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) }));
        emit();
      },
      fail,
    );
    return () => {
      u1();
      u2();
      u3();
    };
  },
  /** Cria o restaurante de um cliente e já deixa o convite de Responsável para o e-mail dele. */
  async createClient({ name, ownerEmail, notes = '' }, by) {
    const email = normalizeEmail(ownerEmail);
    const inv = await getDoc(P.invite(email)).catch(() => null);
    if (inv?.exists()) throw new Error('Esse e-mail já tem um convite pendente.');
    const taken = await getDocs(query(P.admins(), where('email', '==', email))).catch(() => null);
    if (taken && !taken.empty) throw new Error('Esse e-mail já tem acesso a um restaurante.');
    const rid = doc(P.restaurants()).id;
    const b = writeBatch(db);
    b.set(P.restaurant(rid), { name, ownerUid: null, ownerEmail: email, createdAt: serverTimestamp(), createdBy: by, suspended: false, notes: notes || '' });
    b.set(P.settings(rid), { ...DEFAULT_SETTINGS, suspended: false, updatedAt: serverTimestamp() });
    b.set(P.brand(rid), { ...DEFAULT_BRAND, name, updatedAt: serverTimestamp() });
    b.set(P.invite(email), { restaurantId: rid, role: 'owner', createdBy: by, createdAt: serverTimestamp() });
    await wrap(b.commit());
    return rid;
  },
  async updateClient(rid, { name, notes }) {
    const b = writeBatch(db);
    const patch = {};
    if (name) patch.name = name;
    if (notes != null) patch.notes = notes;
    b.update(P.restaurant(rid), patch);
    if (name) b.update(P.brand(rid), { name, updatedAt: serverTimestamp() });
    await wrap(b.commit());
  },
  async setSuspended(rid, suspended) {
    const b = writeBatch(db);
    b.update(P.restaurant(rid), { suspended: !!suspended });
    b.update(P.settings(rid), { suspended: !!suspended, updatedAt: serverTimestamp() });
    await wrap(b.commit());
  },

  /** Exclui o restaurante e tudo dele (mesas, QR Codes, chamadas, marca, equipe, convites). */
  async deleteRestaurant(rid, onProgress) {
    const [tables, states, calls, admins, invites, settings] = await wrap(
      Promise.all([
        getDocs(P.tables(rid)),
        getDocs(collection(db, 'restaurants', rid, 'tableState')),
        getDocs(P.calls(rid)),
        getDocs(query(P.admins(), where('restaurantId', '==', rid))),
        getDocs(query(P.invites(), where('restaurantId', '==', rid))),
        getDoc(P.settings(rid)),
      ]),
    );
    const refs = [
      ...calls.docs.map((d) => d.ref),
      ...states.docs.map((d) => d.ref),
      ...tables.docs.map((d) => P.link(d.data().token)),
      ...tables.docs.map((d) => d.ref),
      ...invites.docs.map((d) => d.ref),
      ...admins.docs.map((d) => d.ref),
      P.settings(rid),
      P.brand(rid),
    ];
    // até 450 exclusões por lote; o restaurante sai por último
    for (let i = 0; i < refs.length; i += 450) {
      const b = writeBatch(db);
      refs.slice(i, i + 450).forEach((r) => b.delete(r));
      await wrap(b.commit());
      onProgress?.(Math.min(1, (i + 450) / refs.length));
    }
    await wrap(deleteDoc(P.restaurant(rid)));
    const menuPath = settings.data()?.menuPath;
    if (menuPath) storage().then(({ m, s }) => m.deleteObject(m.ref(s, menuPath))).catch(() => {});
  },

  // ---------- interessados ----------
  /** O id do pedido é o WhatsApp: o mesmo número não cria pedidos repetidos. */
  async createLead(data) {
    const clean = (v, max) => (v ? String(v).trim().slice(0, max) : null);
    const phone = String(data.phone || '').replace(/\D/g, '');
    await setDoc(P.lead(phone), {
      name: clean(data.name, 80),
      restaurant: clean(data.restaurant, 80),
      city: clean(data.city, 80),
      phone,
      email: clean(data.email, 120),
      message: clean(data.message, 600),
      status: 'new',
      createdAt: serverTimestamp(),
    }).catch((e) => {
      // já existe um pedido desse número: para o visitante, está tudo certo
      if (e?.code === 'permission-denied') return;
      throw friendly(e);
    });
  },
  watchLeads(cb, onError) {
    return onSnapshot(
      query(P.leads(), orderBy('createdAt', 'desc'), limit(500)),
      (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }), createdAt: toDate(d.data({ serverTimestamps: 'estimate' }).createdAt) }))),
      (e) => onError?.(friendly(e)),
    );
  },
  setLeadStatus: (id, status) => wrap(updateDoc(P.lead(id), { status })),
  deleteLead: (id) => wrap(deleteDoc(P.lead(id))),

  // ---------- contatos públicos do dono da plataforma ----------
  watchContacts(cb) {
    return onSnapshot(P.contacts(), (s) => cb(s.exists() ? s.data() : null), () => cb(null));
  },
  saveContacts: (data) =>
    wrap(
      setDoc(P.contacts(), {
        name: data.name || '',
        whatsapp: (data.whatsapp || '').replace(/\D/g, '').slice(0, 20),
        email: data.email || '',
        instagram: (data.instagram || '').replace(/^@/, ''),
        message: data.message || '',
        updatedAt: serverTimestamp(),
      }),
    ),

  // ---------- página da mesa (cliente, sem login) ----------
  watchTableLink(token, cb) {
    return onSnapshot(
      P.link(token),
      (s) => cb(null, s.exists() ? s.data() : null),
      (e) => cb(e.code === 'permission-denied' ? null : friendly(e), null),
    );
  },
  watchTableState(rid, tableId, cb) {
    return onSnapshot(
      P.state(rid, tableId),
      { includeMetadataChanges: true },
      (s) => {
        if (!s.exists()) return cb(null);
        const d = s.data({ serverTimestamps: 'estimate' });
        cb({ lastCallId: d.lastCallId, lastCallAt: toDate(d.lastCallAt), confirmed: !s.metadata.hasPendingWrites });
      },
      () => cb(null),
    );
  },
  watchCall(rid, callId, cb) {
    return onSnapshot(
      P.call(rid, callId),
      (s) => cb(s.exists() ? normCall(s) : null),
      () => cb(null),
    );
  },
  /** Cria a chamada + atualiza o estado da mesa (o intervalo é conferido pelas regras). */
  async createCall({ token, link, reason }) {
    const { restaurantId: rid, tableId, number } = link;
    const ref = doc(P.calls(rid));
    const b = writeBatch(db);
    b.set(ref, {
      restaurantId: rid,
      tableId,
      tableNumber: number,
      callId: ref.id,
      token,
      reason,
      calledAt: serverTimestamp(),
      viewedAt: null,
      status: CALL_STATUS.PENDING,
    });
    b.set(P.state(rid, tableId), { lastCallId: ref.id, lastCallAt: serverTimestamp() });
    let timer;
    try {
      await Promise.race([
        b.commit(),
        new Promise((_, rej) => {
          timer = setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'network' })), 15000);
        }),
      ]);
      return { ok: true, callId: ref.id };
    } catch (e) {
      if (e.code === 'network' || e.code === 'unavailable') return { error: 'network' };
      return { error: 'rejected' };
    } finally {
      clearTimeout(timer);
    }
  },
};

export default api;
