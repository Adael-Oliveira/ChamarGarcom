// Testes das regras do Firestore (rodam no emulador local):
//   npm run test:rules
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';

const RID = 'r1';
const TOKEN = 'a'.repeat(32);
const TID = 't12';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-chamar-garcom',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => env?.cleanup());

const anon = () => env.unauthenticatedContext().firestore();
const as = (uid, email = `${uid}@gmail.com`) => env.authenticatedContext(uid, { email, email_verified: true }).firestore();
const owner = () => as('dono');
const staff = () => as('garcom');

const GENERAL = { callsEnabled: true, billEnabled: true, cooldownMinutes: 2, menuUrl: null, menuFileName: null, menuPath: null, menuUpdatedAt: null };
const BRAND = { name: 'Cantina', tagline: '', logo: null, primary: '#C2410C', accent: '#FDBA74', style: 'moderno' };

async function seed({ general = {}, active = true, lastCallAt, platform = { ownerUid: 'dono', signupOpen: false } } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    if (platform) await setDoc(doc(db, 'platform/config'), platform);
    await setDoc(doc(db, `restaurants/${RID}`), { name: 'Cantina', ownerUid: 'dono' });
    await setDoc(doc(db, 'admins/dono'), { restaurantId: RID, role: 'owner', email: 'dono@gmail.com', name: 'Dono' });
    await setDoc(doc(db, 'admins/garcom'), { restaurantId: RID, role: 'staff', email: 'garcom@gmail.com', name: 'Garçom' });
    await setDoc(doc(db, 'admins/outro'), { restaurantId: 'r2', role: 'owner', email: 'outro@gmail.com', name: 'Outro' });
    await setDoc(doc(db, `restaurants/${RID}/settings/general`), { ...GENERAL, ...general });
    await setDoc(doc(db, `restaurants/${RID}/settings/brand`), BRAND);
    await setDoc(doc(db, `restaurants/${RID}/tables/${TID}`), { number: 12, token: TOKEN, active });
    await setDoc(doc(db, `tableLinks/${TOKEN}`), { restaurantId: RID, tableId: TID, number: 12, active });
    if (lastCallAt) {
      await setDoc(doc(db, `restaurants/${RID}/calls/old`), { restaurantId: RID, tableId: TID, tableNumber: 12, callId: 'old', token: TOKEN, reason: 'waiter', calledAt: Timestamp.fromDate(lastCallAt), viewedAt: null, status: 'PENDING' });
      await setDoc(doc(db, `restaurants/${RID}/tableState/${TID}`), { lastCallId: 'old', lastCallAt: Timestamp.fromDate(lastCallAt) });
    }
  });
}

function call(db, over = {}, { withState = true } = {}) {
  const id = 'c' + Math.random().toString(36).slice(2);
  const b = writeBatch(db);
  b.set(doc(db, `restaurants/${RID}/calls/${id}`), { restaurantId: RID, tableId: TID, tableNumber: 12, callId: id, token: TOKEN, reason: 'waiter', calledAt: serverTimestamp(), viewedAt: null, status: 'PENDING', ...over });
  if (withState) b.set(doc(db, `restaurants/${RID}/tableState/${TID}`), { lastCallId: id, lastCallAt: serverTimestamp() });
  return { id, commit: () => b.commit() };
}

function onboarding(db, uid, { first, rid = 'novo', email = `${uid}@gmail.com` } = {}) {
  const b = writeBatch(db);
  if (first) b.set(doc(db, 'platform/config'), { ownerUid: uid, signupOpen: false, createdAt: serverTimestamp() });
  b.set(doc(db, `restaurants/${rid}`), { name: 'Novo', ownerUid: uid, createdAt: serverTimestamp() });
  b.set(doc(db, `admins/${uid}`), { restaurantId: rid, role: 'owner', email, name: 'X', createdAt: serverTimestamp() });
  b.set(doc(db, `restaurants/${rid}/settings/general`), { ...GENERAL, updatedAt: serverTimestamp() });
  b.set(doc(db, `restaurants/${rid}/settings/brand`), { ...BRAND, name: 'Novo', updatedAt: serverTimestamp() });
  return b.commit();
}

describe('primeiro acesso e cadastro', () => {
  test('primeira pessoa configura a plataforma e o restaurante pela tela', async () => {
    await env.clearFirestore();
    await assertSucceeds(onboarding(as('ana'), 'ana', { first: true }));
  });
  test('ninguém vira dono da plataforma se ela já existe', async () => {
    await seed();
    await assertFails(onboarding(as('bia'), 'bia', { first: true }));
  });
  test('com cadastros fechados, outra pessoa não cria restaurante', async () => {
    await seed();
    await assertFails(onboarding(as('bia'), 'bia'));
  });
  test('com cadastros abertos, outra pessoa cria o próprio restaurante', async () => {
    await seed({ platform: { ownerUid: 'dono', signupOpen: true } });
    await assertSucceeds(onboarding(as('bia'), 'bia'));
  });
  test('quem já é admin não cria outro restaurante', async () => {
    await seed({ platform: { ownerUid: 'dono', signupOpen: true } });
    await assertFails(onboarding(owner(), 'dono', { rid: 'segundo' }));
  });
  test('ninguém se promove a admin de restaurante existente', async () => {
    await seed();
    await assertFails(setDoc(doc(as('bia'), 'admins/bia'), { restaurantId: RID, role: 'owner', email: 'bia@gmail.com', name: '', createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as('bia'), 'admins/bia'), { restaurantId: RID, role: 'staff', email: 'bia@gmail.com', name: '', createdAt: serverTimestamp() }));
  });
  test('só o dono da plataforma abre os cadastros', async () => {
    await seed();
    await assertSucceeds(updateDoc(doc(owner(), 'platform/config'), { signupOpen: true }));
    await assertFails(updateDoc(doc(staff(), 'platform/config'), { signupOpen: true }));
  });
});

describe('convites', () => {
  beforeEach(() => seed());
  const invite = (db, email = 'bia@gmail.com') => setDoc(doc(db, `invites/${email}`), { restaurantId: RID, role: 'staff', createdBy: db === undefined ? '' : 'dono', createdAt: serverTimestamp() });

  test('responsável convida; equipe não', async () => {
    await assertSucceeds(invite(owner()));
    await assertFails(setDoc(doc(staff(), 'invites/c@gmail.com'), { restaurantId: RID, role: 'staff', createdBy: 'garcom', createdAt: serverTimestamp() }));
  });
  test('convidado aceita e entra como equipe', async () => {
    await invite(owner());
    const db = as('bia', 'bia@gmail.com');
    await assertSucceeds(getDoc(doc(db, 'invites/bia@gmail.com')));
    const b = writeBatch(db);
    b.set(doc(db, 'admins/bia'), { restaurantId: RID, role: 'staff', email: 'bia@gmail.com', name: 'Bia', createdAt: serverTimestamp() });
    b.delete(doc(db, 'invites/bia@gmail.com'));
    await assertSucceeds(b.commit());
  });
  test('convidado como Responsável entra com controle total', async () => {
    await assertSucceeds(setDoc(doc(owner(), 'invites/socio@gmail.com'), { restaurantId: RID, role: 'owner', createdBy: 'dono', createdAt: serverTimestamp() }));
    const db = as('socio', 'socio@gmail.com');
    const b = writeBatch(db);
    b.set(doc(db, 'admins/socio'), { restaurantId: RID, role: 'owner', email: 'socio@gmail.com', name: 'Sócio', createdAt: serverTimestamp() });
    b.delete(doc(db, 'invites/socio@gmail.com'));
    await assertSucceeds(b.commit());
    await assertSucceeds(updateDoc(doc(db, `restaurants/${RID}/settings/brand`), { primary: '#123456', updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(doc(db, 'admins/garcom')));
  });
  test('Responsável convidado não remove o outro Responsável', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'admins/socio'), { restaurantId: RID, role: 'owner', email: 'socio@gmail.com', name: '' }));
    await assertFails(deleteDoc(doc(as('socio', 'socio@gmail.com'), 'admins/dono')));
  });
  test('convite de Equipe não pode ser aceito como Responsável', async () => {
    await invite(owner());
    const db = as('bia', 'bia@gmail.com');
    const b = writeBatch(db);
    b.set(doc(db, 'admins/bia'), { restaurantId: RID, role: 'owner', email: 'bia@gmail.com', name: '', createdAt: serverTimestamp() });
    b.delete(doc(db, 'invites/bia@gmail.com'));
    await assertFails(b.commit());
  });
  test('Equipe não convida ninguém, nem como Responsável', () =>
    assertFails(setDoc(doc(staff(), 'invites/x@gmail.com'), { restaurantId: RID, role: 'owner', createdBy: 'garcom', createdAt: serverTimestamp() })));
  test('qualquer outra conta Google é barrada (cadastros fechados, sem convite)', async () => {
    const db = as('estranho', 'estranho@gmail.com');
    await assertFails(getDocs(collection(db, `restaurants/${RID}/tables`)));
    await assertFails(getDocs(collection(db, `restaurants/${RID}/calls`)));
    await assertFails(updateDoc(doc(db, `restaurants/${RID}/settings/general`), { callsEnabled: false }));
    await assertFails(onboarding(db, 'estranho'));
    await assertFails(setDoc(doc(db, 'admins/estranho'), { restaurantId: RID, role: 'staff', email: 'estranho@gmail.com', name: '', createdAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'platform/config'), { signupOpen: true }));
  });
  test('convite não serve para outro e-mail', async () => {
    await invite(owner());
    const db = as('eve', 'eve@gmail.com');
    await assertFails(getDoc(doc(db, 'invites/bia@gmail.com')));
    const b = writeBatch(db);
    b.set(doc(db, 'admins/eve'), { restaurantId: RID, role: 'staff', email: 'bia@gmail.com', name: '', createdAt: serverTimestamp() });
    b.delete(doc(db, 'invites/bia@gmail.com'));
    await assertFails(b.commit());
  });
  test('aceitar sem consumir o convite é recusado', async () => {
    await invite(owner());
    const db = as('bia', 'bia@gmail.com');
    await assertFails(setDoc(doc(db, 'admins/bia'), { restaurantId: RID, role: 'staff', email: 'bia@gmail.com', name: '', createdAt: serverTimestamp() }));
  });
  test('equipe lista membros e convites do próprio restaurante', async () => {
    await invite(owner());
    await assertSucceeds(getDocs(query(collection(staff(), 'admins'), where('restaurantId', '==', RID))));
    await assertSucceeds(getDocs(query(collection(staff(), 'invites'), where('restaurantId', '==', RID))));
    await assertFails(getDocs(query(collection(as('outro'), 'admins'), where('restaurantId', '==', RID))));
  });
  test('responsável remove equipe; ninguém remove o responsável', async () => {
    await seed({ platform: { ownerUid: 'plataforma', signupOpen: false } }); // dono do restaurante ≠ dono da plataforma
    await assertSucceeds(deleteDoc(doc(owner(), 'admins/garcom')));
    await assertFails(deleteDoc(doc(owner(), 'admins/dono')));
  });
  test('equipe não remove ninguém', () => assertFails(deleteDoc(doc(staff(), 'admins/dono'))));
});

describe('marca e configurações', () => {
  beforeEach(() => seed());
  test('cliente lê marca e configurações públicas', async () => {
    await assertSucceeds(getDoc(doc(anon(), `restaurants/${RID}/settings/brand`)));
    await assertSucceeds(getDoc(doc(anon(), `restaurants/${RID}/settings/general`)));
  });
  test('cliente não altera nada', async () => {
    await assertFails(updateDoc(doc(anon(), `restaurants/${RID}/settings/general`), { callsEnabled: false }));
    await assertFails(updateDoc(doc(anon(), `restaurants/${RID}/settings/brand`), { name: 'X' }));
  });
  test('responsável muda a marca (com logo)', () =>
    assertSucceeds(updateDoc(doc(owner(), `restaurants/${RID}/settings/brand`), { primary: '#0B5B73', logo: 'data:image/webp;base64,AAAA', updatedAt: serverTimestamp() })));
  test('equipe não muda a marca', () => assertFails(updateDoc(doc(staff(), `restaurants/${RID}/settings/brand`), { primary: '#000000' })));
  test('cor inválida, estilo inválido ou logo enorme são recusados', async () => {
    await assertFails(updateDoc(doc(owner(), `restaurants/${RID}/settings/brand`), { primary: 'red' }));
    await assertFails(updateDoc(doc(owner(), `restaurants/${RID}/settings/brand`), { style: 'neon' }));
    await assertFails(updateDoc(doc(owner(), `restaurants/${RID}/settings/brand`), { logo: 'data:image/png;base64,' + 'A'.repeat(260000) }));
    await assertFails(updateDoc(doc(owner(), `restaurants/${RID}/settings/brand`), { logo: 'javascript:alert(1)' }));
  });
  test('equipe muda intervalo e liga/desliga chamadas', () =>
    assertSucceeds(updateDoc(doc(staff(), `restaurants/${RID}/settings/general`), { callsEnabled: false, cooldownMinutes: 5, updatedAt: serverTimestamp() })));
  test('link de cardápio precisa ser https', () => assertFails(updateDoc(doc(owner(), `restaurants/${RID}/settings/general`), { menuUrl: 'javascript:alert(1)' })));
  test('admin de outro restaurante é barrado', async () => {
    await assertFails(updateDoc(doc(as('outro'), `restaurants/${RID}/settings/general`), { callsEnabled: false }));
    await assertFails(getDocs(collection(as('outro'), `restaurants/${RID}/calls`)));
  });
});

describe('cliente na mesa', () => {
  beforeEach(() => seed());
  test('lê a mesa pelo token, mas não lista', async () => {
    await assertSucceeds(getDoc(doc(anon(), `tableLinks/${TOKEN}`)));
    await assertFails(getDocs(collection(anon(), 'tableLinks')));
    await assertFails(getDocs(collection(anon(), `restaurants/${RID}/tables`)));
    await assertFails(getDocs(collection(anon(), `restaurants/${RID}/calls`)));
    await assertFails(getDoc(doc(anon(), `restaurants/${RID}`)));
  });
  test('chama o garçom', async () => {
    const c = call(anon());
    await assertSucceeds(c.commit());
    await assertSucceeds(getDoc(doc(anon(), `restaurants/${RID}/calls/${c.id}`)));
  });
  test('pede a conta', () => assertSucceeds(call(anon(), { reason: 'bill' }).commit()));
  test('pedir a conta com o botão desligado é recusado', async () => {
    await seed({ general: { billEnabled: false } });
    await assertFails(call(anon(), { reason: 'bill' }).commit());
  });
  test('motivo inventado é recusado', () => assertFails(call(anon(), { reason: 'gorjeta' }).commit()));
  test('sem gravar o estado da mesa (pularia o intervalo) é recusado', () => assertFails(call(anon(), {}, { withState: false }).commit()));
  test('token falso, número trocado, status forjado, horário forjado, campo extra: recusados', async () => {
    await assertFails(call(anon(), { token: 'b'.repeat(32) }).commit());
    await assertFails(call(anon(), { tableNumber: 99 }).commit());
    await assertFails(call(anon(), { status: 'VIEWED' }).commit());
    await assertFails(call(anon(), { calledAt: Timestamp.fromDate(new Date(2020, 0, 1)) }).commit());
    await assertFails(call(anon(), { extra: 1 }).commit());
  });
  test('cliente não altera nem apaga chamadas', async () => {
    const c = call(anon());
    await c.commit();
    await assertFails(updateDoc(doc(anon(), `restaurants/${RID}/calls/${c.id}`), { status: 'VIEWED' }));
    await assertFails(deleteDoc(doc(anon(), `restaurants/${RID}/calls/${c.id}`)));
  });
  test('sistema desligado ou mesa desativada: recusado', async () => {
    await seed({ general: { callsEnabled: false } });
    await assertFails(call(anon()).commit());
    await seed({ active: false });
    await assertFails(call(anon()).commit());
  });
});

describe('intervalo entre chamadas (servidor)', () => {
  test('dentro do intervalo: recusado', async () => {
    await seed({ lastCallAt: new Date(Date.now() - 30000) });
    await assertFails(call(anon()).commit());
  });
  test('depois do intervalo: aceito', async () => {
    await seed({ lastCallAt: new Date(Date.now() - 3 * 60000) });
    await assertSucceeds(call(anon()).commit());
  });
  test('duas seguidas: a segunda é recusada', async () => {
    await seed();
    await assertSucceeds(call(anon()).commit());
    await assertFails(call(anon()).commit());
  });
});

describe('equipe atendendo', () => {
  beforeEach(() => seed());
  test('marca Visualizado e o cliente vê', async () => {
    const c = call(anon());
    await c.commit();
    await assertSucceeds(updateDoc(doc(staff(), `restaurants/${RID}/calls/${c.id}`), { status: 'VIEWED', viewedAt: serverTimestamp(), viewedBy: 'garcom' }));
    const snap = await getDoc(doc(anon(), `restaurants/${RID}/calls/${c.id}`));
    if (snap.data().status !== 'VIEWED') throw new Error('cliente não viu a mudança');
  });
  test('não altera dados de origem da chamada', async () => {
    const c = call(anon());
    await c.commit();
    await assertFails(updateDoc(doc(staff(), `restaurants/${RID}/calls/${c.id}`), { tableNumber: 1 }));
    await assertFails(updateDoc(doc(staff(), `restaurants/${RID}/calls/${c.id}`), { status: 'VIEWED', viewedAt: serverTimestamp(), viewedBy: 'dono' }));
  });
  test('cria mesa e link', async () => {
    const db = staff();
    const b = writeBatch(db);
    b.set(doc(db, `restaurants/${RID}/tables/nova`), { number: 5, token: 'c'.repeat(32), active: true, createdAt: serverTimestamp() });
    b.set(doc(db, `tableLinks/${'c'.repeat(32)}`), { restaurantId: RID, tableId: 'nova', number: 5, active: true });
    await assertSucceeds(b.commit());
  });
  test('não cria link para outro restaurante', () =>
    assertFails(setDoc(doc(staff(), `tableLinks/${'d'.repeat(32)}`), { restaurantId: 'r2', tableId: 'x', number: 1, active: true })));
  test('consulta chamadas por data', () =>
    assertSucceeds(getDocs(query(collection(staff(), `restaurants/${RID}/calls`), where('calledAt', '>=', Timestamp.fromDate(new Date(Date.now() - 86400000)))))));
});
