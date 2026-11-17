// Cardápio digital e pedidos (regras do Firestore, no emulador):
//   npm run test:rules
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';

const RID = 'r1';
const TOKEN = 'b'.repeat(32);
const TID = 't5';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-acenai-pedidos',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => env?.cleanup());

const anon = () => env.unauthenticatedContext().firestore();
const as = (uid) => env.authenticatedContext(uid, { email: `${uid}@gmail.com`, email_verified: true }).firestore();
const owner = () => as('dono');
const staff = () => as('garcom'); // Equipe sem a permissão de cardápio
const cozinha = () => as('cozinheiro'); // Equipe com a permissão de cardápio
const printer = () => as('impressora'); // impressora conectada (aparelho)

const GENERAL = { callsEnabled: true, billEnabled: true, cooldownMinutes: 2, menuUrl: null, menuFileName: null, menuPath: null, menuUpdatedAt: null };
const MENU = { categories: [{ id: 'c1', name: 'Pratos', items: [{ id: 'i1', name: 'Moqueca', desc: '', price: 12900, available: true, img: null, opts: null, tag: null }] }] };
const LINE = { id: 'i1', name: 'Moqueca', price: 12900, qty: 1, opt: null, obs: 'sem coentro' };

// mesmo cálculo do servidor (horário de Brasília)
const today = () => {
  const t = new Date(Date.now() - 3 * 3600000);
  return t.getUTCFullYear() * 10000 + (t.getUTCMonth() + 1) * 100 + t.getUTCDate();
};

async function seed({ general = {}, active = true, lastOrderAgoSec, seq } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'platform/config'), { ownerUid: 'plataforma', signupOpen: false });
    await setDoc(doc(db, `restaurants/${RID}`), { name: 'Bistrô', ownerUid: 'dono', plan: 'essencial', tableCount: 1 });
    await setDoc(doc(db, 'admins/dono'), { restaurantId: RID, role: 'owner', email: 'dono@gmail.com', name: 'Dono' });
    await setDoc(doc(db, 'admins/garcom'), { restaurantId: RID, role: 'staff', email: 'garcom@gmail.com', name: 'Garçom', perms: [] });
    await setDoc(doc(db, 'admins/cozinheiro'), { restaurantId: RID, role: 'staff', email: 'c@gmail.com', name: 'Cozinha', perms: ['cardapio'] });
    await setDoc(doc(db, 'admins/impressora'), { restaurantId: RID, role: 'staff', email: '', name: 'Impressora', displayName: 'Cozinha', perms: [], device: true, kind: 'printer' });
    await setDoc(doc(db, 'admins/outro'), { restaurantId: 'r2', role: 'owner', email: 'outro@gmail.com', name: 'Outro' });
    await setDoc(doc(db, `restaurants/${RID}/settings/general`), { ...GENERAL, ordersEnabled: true, ordersApproval: false, ...general });
    await setDoc(doc(db, `restaurants/${RID}/settings/menu`), MENU);
    await setDoc(doc(db, `restaurants/${RID}/tables/${TID}`), { number: 5, token: TOKEN, active });
    await setDoc(doc(db, `tableLinks/${TOKEN}`), { restaurantId: RID, tableId: TID, number: 5, active });
    if (lastOrderAgoSec != null) {
      const at = Timestamp.fromMillis(Date.now() - lastOrderAgoSec * 1000);
      await setDoc(doc(db, `restaurants/${RID}/orders/antigo`), { restaurantId: RID, tableId: TID, tableNumber: 5, orderId: 'antigo', token: TOKEN, items: [LINE], total: 12900, status: 'NEW', createdAt: at, printed: false, printCount: 0 });
      await setDoc(doc(db, `restaurants/${RID}/orderState/${TID}`), { lastOrderId: 'antigo', lastOrderAt: at });
      await setDoc(doc(db, `restaurants/${RID}/orderSeq/today`), { day: today(), n: 1, lastOrderId: 'antigo' });
    }
    if (seq) await setDoc(doc(db, `restaurants/${RID}/orderSeq/today`), { lastOrderId: 'x', ...seq });
  });
}

/** O mesmo lote que o api.createOrder grava (pedido + estado da mesa + número do dia). */
function order(db, over = {}, { withState = true, n = 1, day = today(), withSeq = true, seqN } = {}) {
  const id = 'o' + Math.random().toString(36).slice(2);
  const b = writeBatch(db);
  b.set(doc(db, `restaurants/${RID}/orders/${id}`), {
    restaurantId: RID, tableId: TID, tableNumber: 5, orderId: id, number: n, token: TOKEN, items: [LINE], total: 12900, note: null,
    status: 'NEW', createdAt: serverTimestamp(), printed: false, printCount: 0, ...over,
  });
  if (withState) b.set(doc(db, `restaurants/${RID}/orderState/${TID}`), { lastOrderId: id, lastOrderAt: serverTimestamp() });
  if (withSeq) b.set(doc(db, `restaurants/${RID}/orderSeq/today`), { day, n: seqN ?? n, lastOrderId: id });
  return { id, commit: () => b.commit() };
}

describe('cardápio', () => {
  test('cliente sem login lê o cardápio e as fotos', async () => {
    await seed();
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `restaurants/${RID}/menuImages/f1`), { data: 'data:image/webp;base64,AAAA' }));
    await assertSucceeds(getDoc(doc(anon(), `restaurants/${RID}/settings/menu`)));
    await assertSucceeds(getDoc(doc(anon(), `restaurants/${RID}/menuImages/f1`)));
    await assertFails(getDocs(collection(anon(), `restaurants/${RID}/menuImages`)));
  });
  test('responsável e equipe com permissão de cardápio editam; o resto não', async () => {
    await seed();
    await assertSucceeds(setDoc(doc(owner(), `restaurants/${RID}/settings/menu`), { ...MENU, updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(cozinha(), `restaurants/${RID}/settings/menu`), { ...MENU, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(staff(), `restaurants/${RID}/settings/menu`), MENU));
    await assertFails(setDoc(doc(anon(), `restaurants/${RID}/settings/menu`), MENU));
    await assertFails(setDoc(doc(as('outro'), `restaurants/${RID}/settings/menu`), MENU));
  });
  test('cardápio vale em qualquer plano (aqui: Essencial)', async () => {
    await seed();
    await assertSucceeds(updateDoc(doc(owner(), `restaurants/${RID}/settings/general`), { ordersEnabled: true, ordersApproval: true }));
  });
  test('campo estranho no cardápio é recusado', async () => {
    await seed();
    await assertFails(setDoc(doc(owner(), `restaurants/${RID}/settings/menu`), { ...MENU, hack: true }));
  });
  test('foto: só imagem em data URL e até ~150 KB', async () => {
    await seed();
    await assertSucceeds(setDoc(doc(owner(), `restaurants/${RID}/menuImages/f2`), { data: 'data:image/webp;base64,' + 'A'.repeat(1000) }));
    await assertFails(setDoc(doc(owner(), `restaurants/${RID}/menuImages/f3`), { data: 'https://exemplo.com/x.png' }));
    await assertFails(setDoc(doc(owner(), `restaurants/${RID}/menuImages/f4`), { data: 'data:image/webp;base64,' + 'A'.repeat(210000) }));
    await assertFails(setDoc(doc(staff(), `restaurants/${RID}/menuImages/f5`), { data: 'data:image/webp;base64,AAAA' }));
  });
  test('equipe sem permissão de cardápio não liga os pedidos', async () => {
    await seed();
    await assertFails(updateDoc(doc(staff(), `restaurants/${RID}/settings/general`), { ordersEnabled: false }));
  });
});

describe('cliente faz o pedido', () => {
  test('pedido com o estado da mesa no mesmo lote', async () => {
    await seed();
    await assertSucceeds(order(anon()).commit());
  });
  test('sem gravar o estado da mesa é recusado', async () => {
    await seed();
    await assertFails(order(anon(), {}, { withState: false }).commit());
  });
  test('pedidos desligados, mesa desativada ou restaurante suspenso: recusado', async () => {
    await seed({ general: { ordersEnabled: false } });
    await assertFails(order(anon()).commit());
    await seed({ active: false });
    await assertFails(order(anon()).commit());
    await seed({ general: { suspended: true } });
    await assertFails(order(anon()).commit());
  });
  test('com aprovação do caixa, o pedido entra como aguardando', async () => {
    await seed({ general: { ordersApproval: true } });
    await assertFails(order(anon()).commit());
    await assertSucceeds(order(anon(), { status: 'WAITING' }).commit());
  });
  test('token falso, mesa trocada, status forjado, impresso, sacola vazia ou campo extra: recusados', async () => {
    await seed();
    await assertFails(order(anon(), { token: 'c'.repeat(32) }).commit());
    await assertFails(order(anon(), { tableNumber: 9 }).commit());
    await assertFails(order(anon(), { status: 'READY' }).commit());
    await assertFails(order(anon(), { printed: true }).commit());
    await assertFails(order(anon(), { items: [] }).commit());
    await assertFails(order(anon(), { total: -5 }).commit());
    await assertFails(order(anon(), { closed: true }).commit());
    await assertFails(order(anon(), { createdAt: Timestamp.fromMillis(Date.now() - 3600000) }).commit());
  });
  test('menos de 20 s depois do último pedido da mesa: recusado; depois: aceito', async () => {
    await seed({ lastOrderAgoSec: 5 });
    await assertFails(order(anon()).commit());
    await seed({ lastOrderAgoSec: 30 });
    await assertSucceeds(order(anon(), {}, { n: 2 }).commit());
  });
  test('cliente acompanha o próprio pedido pelo ID, mas não lista nem altera', async () => {
    await seed();
    const o = order(anon());
    await o.commit();
    await assertSucceeds(getDoc(doc(anon(), `restaurants/${RID}/orders/${o.id}`)));
    await assertFails(getDocs(collection(anon(), `restaurants/${RID}/orders`)));
    await assertFails(updateDoc(doc(anon(), `restaurants/${RID}/orders/${o.id}`), { status: 'CANCELED' }));
    await assertFails(deleteDoc(doc(anon(), `restaurants/${RID}/orders/${o.id}`)));
  });
});

describe('número do pedido (recomeça todo dia)', () => {
  test('primeiro pedido do dia é o nº 1; o seguinte, nº 2', async () => {
    await seed();
    await assertSucceeds(order(anon()).commit());
    await assertSucceeds(getDoc(doc(anon(), `restaurants/${RID}/orderSeq/today`)));
    await seed({ seq: { day: today(), n: 1 } });
    await assertSucceeds(order(anon(), {}, { n: 2 }).commit());
  });
  test('pular, repetir ou voltar o número: recusado', async () => {
    await seed({ seq: { day: today(), n: 7 } });
    await assertFails(order(anon(), {}, { n: 9 }).commit());
    await assertFails(order(anon(), {}, { n: 7 }).commit());
    await assertFails(order(anon(), {}, { n: 1 }).commit());
    await assertSucceeds(order(anon(), {}, { n: 8 }).commit());
  });
  test('dia virou: volta para o nº 1 (o dia é o do servidor, não o do celular)', async () => {
    await seed({ seq: { day: 20200101, n: 40 } });
    await assertFails(order(anon(), {}, { n: 41, day: 20200101 }).commit());
    await assertFails(order(anon(), {}, { n: 1, day: 20200102 }).commit());
    await assertSucceeds(order(anon(), {}, { n: 1 }).commit());
  });
  test('sem gravar a sequência, ou número diferente nela: recusado', async () => {
    await seed();
    await assertFails(order(anon(), {}, { withSeq: false }).commit());
    await assertFails(order(anon(), {}, { n: 1, seqN: 2 }).commit());
    await assertFails(order(anon(), { number: '1' }).commit());
  });
  test('ninguém mexe na sequência sem criar o pedido junto', async () => {
    await seed({ seq: { day: today(), n: 3 } });
    await assertFails(setDoc(doc(anon(), `restaurants/${RID}/orderSeq/today`), { day: today(), n: 4, lastOrderId: 'nao-existe' }));
    await assertFails(setDoc(doc(owner(), `restaurants/${RID}/orderSeq/today`), { day: today(), n: 1, lastOrderId: 'x' }));
    await assertFails(deleteDoc(doc(owner(), `restaurants/${RID}/orderSeq/today`)));
  });
});

describe('central e impressora', () => {
  test('equipe lista e muda o status; registra quem mudou', async () => {
    await seed();
    const o = order(anon());
    await o.commit();
    await assertSucceeds(getDocs(collection(staff(), `restaurants/${RID}/orders`)));
    await assertSucceeds(updateDoc(doc(staff(), `restaurants/${RID}/orders/${o.id}`), { status: 'PREPARING', statusAt: serverTimestamp(), statusBy: 'garcom', statusByName: 'Garçom' }));
    await assertFails(updateDoc(doc(staff(), `restaurants/${RID}/orders/${o.id}`), { statusBy: 'outra-pessoa' }));
    await assertFails(updateDoc(doc(staff(), `restaurants/${RID}/orders/${o.id}`), { status: 'PAGO' }));
    await assertFails(updateDoc(doc(staff(), `restaurants/${RID}/orders/${o.id}`), { total: 1 }));
    await assertFails(updateDoc(doc(staff(), `restaurants/${RID}/orders/${o.id}`), { items: [] }));
  });
  test('impressora marca como impresso; central pede reimpressão', async () => {
    await seed();
    const o = order(anon());
    await o.commit();
    const ref = (db) => doc(db, `restaurants/${RID}/orders/${o.id}`);
    await assertSucceeds(updateDoc(ref(printer()), { printed: true, printedAt: serverTimestamp(), printCount: 1 }));
    await assertSucceeds(updateDoc(ref(owner()), { printed: false }));
    await assertFails(updateDoc(ref(printer()), { printedAt: Timestamp.fromMillis(0) }));
  });
  test('fechar a conta da mesa (pedidos + chamadas abertas da mesa, no mesmo lote)', async () => {
    await seed();
    const o = order(anon());
    await o.commit();
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), `restaurants/${RID}/calls/c1`), { restaurantId: RID, tableId: TID, tableNumber: 5, callId: 'c1', token: TOKEN, reason: 'bill', calledAt: Timestamp.now(), viewedAt: null, status: 'PENDING' }),
    );
    const db = staff();
    const b = writeBatch(db);
    b.update(doc(db, `restaurants/${RID}/orders/${o.id}`), { closed: true, closedAt: serverTimestamp() });
    b.update(doc(db, `restaurants/${RID}/calls/c1`), { status: 'DONE', doneAt: serverTimestamp(), doneBy: 'garcom', doneByName: 'Garçom' });
    // libera a mesa: zera os intervalos de chamada e de pedido (equipe sem permissão de mesas também pode)
    b.delete(doc(db, `restaurants/${RID}/tableState/${TID}`));
    b.delete(doc(db, `restaurants/${RID}/orderState/${TID}`));
    await assertSucceeds(b.commit());
    await assertFails(deleteDoc(doc(anon(), `restaurants/${RID}/tableState/${TID}`)));
    await assertFails(deleteDoc(doc(as('outro'), `restaurants/${RID}/orderState/${TID}`)));
  });
  test('admin de outro restaurante não vê nem mexe', async () => {
    await seed();
    const o = order(anon());
    await o.commit();
    await assertFails(getDocs(collection(as('outro'), `restaurants/${RID}/orders`)));
    await assertFails(updateDoc(doc(as('outro'), `restaurants/${RID}/orders/${o.id}`), { status: 'CANCELED' }));
  });
  test('impressora é conectada com o mesmo código de 6 números do relógio', async () => {
    await seed();
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'devicePairings/123456'), { uid: 'nova-imp', model: 'ESP32 Impressora', createdAt: Timestamp.now() }));
    const db = owner();
    const b = writeBatch(db);
    b.set(doc(db, 'admins/nova-imp'), { restaurantId: RID, role: 'staff', email: '', name: 'Impressora', displayName: 'Cozinha', perms: [], device: true, kind: 'printer', pairCode: '123456', createdAt: serverTimestamp() });
    b.delete(doc(db, 'devicePairings/123456'));
    await assertSucceeds(b.commit());
  });
  test('tipo de aparelho inventado é recusado', async () => {
    await seed();
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'devicePairings/654321'), { uid: 'x-imp', model: 'x', createdAt: Timestamp.now() }));
    const db = owner();
    const b = writeBatch(db);
    b.set(doc(db, 'admins/x-imp'), { restaurantId: RID, role: 'staff', email: '', name: 'X', displayName: 'X', perms: [], device: true, kind: 'torradeira', pairCode: '654321', createdAt: serverTimestamp() });
    b.delete(doc(db, 'devicePairings/654321'));
    await assertFails(b.commit());
  });
});
