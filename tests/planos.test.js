// Planos: limite de mesas e cardápio só no Avançado (rodam no emulador local):
//   npm run test:rules
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteField, doc, increment, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

const RID = 'r1';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-chamar-garcom-planos',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => env?.cleanup());

const as = (uid) => env.authenticatedContext(uid, { email: `${uid}@gmail.com`, email_verified: true }).firestore();
const dono = () => as('dono');
const plataforma = () => as('plataforma');
const GENERAL = { callsEnabled: true, billEnabled: true, cooldownMinutes: 2, menuUrl: null, menuFileName: null, menuPath: null, menuUpdatedAt: null };

async function seed(restaurant, nTables = 0) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'platform/config'), { ownerUid: 'plataforma', signupOpen: false });
    await setDoc(doc(db, `restaurants/${RID}`), { name: 'Cantina', ownerUid: 'dono', ...restaurant });
    await setDoc(doc(db, 'admins/dono'), { restaurantId: RID, role: 'owner', email: 'dono@gmail.com', name: 'Dono' });
    await setDoc(doc(db, 'admins/bia'), { restaurantId: RID, role: 'staff', email: 'bia@gmail.com', name: 'Bia', perms: [] });
    await setDoc(doc(db, `restaurants/${RID}/settings/general`), GENERAL);
    for (let i = 1; i <= nTables; i++) await setDoc(doc(db, `restaurants/${RID}/tables/t${i}`), { number: i, token: `${'k'.repeat(30)}${String(i).padStart(2, '0')}`, active: true });
  });
}

/** Cria a mesa como o app faz: mesa + link + (com plano) contador no mesmo lote. */
function createTable(db, id, number, counted = true) {
  const token = `${'n'.repeat(30)}${String(number).padStart(2, '0')}`;
  const b = writeBatch(db);
  b.set(doc(db, `restaurants/${RID}/tables/${id}`), { number, token, active: true });
  b.set(doc(db, `tableLinks/${token}`), { restaurantId: RID, tableId: id, number, active: true });
  if (counted) b.update(doc(db, `restaurants/${RID}`), { tableCount: increment(1), tableOp: id });
  return b.commit();
}
function deleteTable(db, id, counted = true) {
  const b = writeBatch(db);
  b.delete(doc(db, `restaurants/${RID}/tables/${id}`));
  if (counted) b.update(doc(db, `restaurants/${RID}`), { tableCount: increment(-1), tableOp: id });
  return b.commit();
}

describe('limite de mesas', () => {
  beforeEach(() => seed({ plan: 'essencial', tableCount: 9 }, 9));
  test('cria a 10ª mesa no Essencial', async () => {
    await assertSucceeds(createTable(dono(), 'novo', 10));
  });
  test('não cria a 11ª mesa no Essencial', async () => {
    await createTable(dono(), 'novo', 10);
    await assertFails(createTable(dono(), 'outra', 11));
  });
  test('não dá para criar mesa sem contar', async () => {
    await assertFails(createTable(dono(), 'novo', 10, false));
  });
  test('não dá para mexer no contador à toa', async () => {
    await assertFails(updateDoc(doc(dono(), `restaurants/${RID}`), { tableCount: 0, tableOp: 't1' }));
    await assertFails(updateDoc(doc(dono(), `restaurants/${RID}`), { tableCount: increment(-1), tableOp: 't1' }));
  });
  test('responsável não muda o próprio plano', async () => {
    await assertFails(updateDoc(doc(dono(), `restaurants/${RID}`), { plan: 'avancado' }));
    await assertFails(updateDoc(doc(dono(), `restaurants/${RID}`), { plan: deleteField() }));
  });
  test('excluir mesa libera vaga', async () => {
    await createTable(dono(), 'novo', 10);
    await assertSucceeds(deleteTable(dono(), 't1'));
    await assertSucceeds(createTable(dono(), 'outra', 11));
  });
  test('excluir mesa sem descontar é recusado', async () => {
    await assertFails(deleteTable(dono(), 't1', false));
  });
  test('quem não tem permissão de mesas não cria', async () => {
    await assertFails(createTable(as('bia'), 'novo', 10));
  });
  test('dono da plataforma muda o plano e acerta o contador', async () => {
    await assertSucceeds(updateDoc(doc(plataforma(), `restaurants/${RID}`), { plan: 'profissional', tableCount: 9 }));
    await assertFails(updateDoc(doc(plataforma(), `restaurants/${RID}`), { plan: 'ouro' }));
  });
});

describe('restaurante sem plano (clientes antigos)', () => {
  beforeEach(() => seed({}, 70));
  test('cria mesas sem limite e sem contador', async () => {
    await assertSucceeds(createTable(dono(), 'novo', 71, false));
    await assertSucceeds(deleteTable(dono(), 't1', false));
  });
  test('cardápio liberado', async () => {
    await assertSucceeds(updateDoc(doc(dono(), `restaurants/${RID}/settings/general`), { menuUrl: 'https://exemplo.com/menu.pdf' }));
  });
});

describe('cardápio só no Avançado', () => {
  test('Profissional não salva cardápio', async () => {
    await seed({ plan: 'profissional', tableCount: 0 });
    await assertFails(updateDoc(doc(dono(), `restaurants/${RID}/settings/general`), { menuUrl: 'https://exemplo.com/menu.pdf' }));
  });
  test('Avançado salva cardápio', async () => {
    await seed({ plan: 'avancado', tableCount: 0 });
    await assertSucceeds(updateDoc(doc(dono(), `restaurants/${RID}/settings/general`), { menuUrl: 'https://exemplo.com/menu.pdf' }));
  });
  test('ao rebaixar o plano, dá para remover o cardápio', async () => {
    await seed({ plan: 'essencial', tableCount: 0 });
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), `restaurants/${RID}/settings/general`), { menuUrl: 'https://exemplo.com/menu.pdf' }));
    await assertSucceeds(updateDoc(doc(dono(), `restaurants/${RID}/settings/general`), { menuUrl: null, menuFileName: null, menuPath: null }));
  });
  test('dono da plataforma rebaixa o plano e tira o cardápio no mesmo lote', async () => {
    await seed({ plan: 'avancado', tableCount: 0 });
    const db = plataforma();
    const b = writeBatch(db);
    b.update(doc(db, `restaurants/${RID}`), { plan: 'essencial', tableCount: 0 });
    b.update(doc(db, `restaurants/${RID}/settings/general`), { menuUrl: null, menuFileName: null, menuPath: null });
    await assertSucceeds(b.commit());
  });
});
