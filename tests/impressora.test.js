// Protocolo da impressora da cozinha (firmware em impressora/): as mesmas
// requisições REST que o ESP32 faz, contra o emulador com as regras reais.
//   npm run test:rules
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';

const PROJECT = 'demo-acenai-impressora';
const RID = 'toca';
const DOCS = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `http://127.0.0.1:8080/v1/${DOCS}`;
const PRN = 'impressora-uid-1';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => env?.cleanup());

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function anonToken(uid) {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now,
    firebase: { sign_in_provider: 'anonymous', identities: {} },
  })}.`;
}
async function rest(method, url, body, uid = PRN) {
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${anonToken(uid)}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  return { code: r.status, json: text ? JSON.parse(text) : null };
}

// ---- corpos idênticos aos do acenai-impressora.ino
const pairingBody = (code) => ({
  writes: [{
    update: { name: `${DOCS}/devicePairings/${code}`, fields: { uid: { stringValue: PRN }, model: { stringValue: 'ESP32 impressora' } } },
    updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
    currentDocument: { exists: false },
  }],
});
const queryBody = {
  structuredQuery: {
    from: [{ collectionId: 'orders' }],
    where: { compositeFilter: { op: 'AND', filters: [
      { fieldFilter: { field: { fieldPath: 'printed' }, op: 'EQUAL', value: { booleanValue: false } } },
      { fieldFilter: { field: { fieldPath: 'status' }, op: 'IN', value: { arrayValue: { values: [{ stringValue: 'NEW' }, { stringValue: 'PREPARING' }, { stringValue: 'READY' }] } } } },
    ] } },
    limit: 10,
  },
};
const claimBody = (path, updateTime, printCount) => ({
  writes: [{
    update: { name: path, fields: { printed: { booleanValue: true }, printCount: { integerValue: String(printCount + 1) } } },
    updateMask: { fieldPaths: ['printed', 'printCount'] },
    updateTransforms: [{ fieldPath: 'printedAt', setToServerValue: 'REQUEST_TIME' }],
    currentDocument: { updateTime },
  }],
});
const unclaimBody = (path) => ({
  writes: [{
    update: { name: path, fields: { printed: { booleanValue: false } } },
    updateMask: { fieldPaths: ['printed'] },
    currentDocument: { exists: true },
  }],
});

// o mesmo filtro do firmware: pedido novo, ou reimpressão de pedido em andamento
const toPrint = (rows) =>
  rows.filter((r) => r.document).map((r) => r.document).filter((d) => {
    const st = d.fields.status.stringValue;
    const pc = Number(d.fields.printCount?.integerValue || 0);
    return st === 'NEW' || pc > 0;
  });

async function ownerPairs(code) {
  const db = env.authenticatedContext('dono', { email: 'dono@gmail.com', email_verified: true }).firestore();
  const p = (await getDoc(doc(db, `devicePairings/${code}`))).data();
  const b = writeBatch(db);
  b.set(doc(db, `admins/${p.uid}`), { restaurantId: RID, role: 'staff', email: '', name: 'Impressora', displayName: 'Cozinha', perms: [], device: true, kind: 'printer', pairCode: code, createdAt: serverTimestamp() });
  b.delete(doc(db, `devicePairings/${code}`));
  await b.commit();
}

const order = (id, table, status, extra = {}) => ({
  restaurantId: RID, tableId: `t${table}`, tableNumber: table, orderId: id, token: 'x'.repeat(32),
  items: [
    { id: 'i1', name: 'Risoto de camarão', price: 7900, qty: 2, opt: null, obs: 'sem cebola' },
    { id: 'i2', name: 'Suco natural', price: 1200, qty: 1, opt: 'Laranja', obs: null },
  ],
  total: 17000, note: 'Trazer junto', status, createdAt: Timestamp.fromDate(new Date(Date.now() - 60000)), printed: false, printCount: 0, ...extra,
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'platform/config'), { ownerUid: 'plataforma', signupOpen: false });
    await setDoc(doc(db, `restaurants/${RID}`), { name: 'Toca da Tilápia', ownerUid: 'dono' });
    await setDoc(doc(db, 'admins/dono'), { restaurantId: RID, role: 'owner', email: 'dono@gmail.com', name: 'Dono' });
    await setDoc(doc(db, `restaurants/${RID}/settings/general`), { callsEnabled: true, billEnabled: true, cooldownMinutes: 2, ordersEnabled: true, ordersApproval: false });
    await setDoc(doc(db, `restaurants/${RID}/settings/brand`), { name: 'Toca da Tilápia', tagline: '', logo: null, primary: '#C2410C', accent: '#FDBA74', style: 'moderno' });
    await setDoc(doc(db, `restaurants/${RID}/orders/o1`), order('o1', 6, 'NEW'));
    await setDoc(doc(db, `restaurants/${RID}/orders/o2`), order('o2', 2, 'PREPARING'));                       // sem impressora antes: não sai
    await setDoc(doc(db, `restaurants/${RID}/orders/o3`), order('o3', 3, 'PREPARING', { printCount: 1 }));    // Reimprimir
    await setDoc(doc(db, `restaurants/${RID}/orders/o4`), order('o4', 4, 'WAITING'));                         // esperando o caixa aprovar
    await setDoc(doc(db, `restaurants/${RID}/orders/o5`), order('o5', 5, 'CANCELED'));
    await setDoc(doc(db, `restaurants/${RID}/orders/o6`), order('o6', 1, 'NEW', { printed: true, printCount: 1 }));
  });
});

describe('impressora: conectar e imprimir pelo REST', () => {
  test('fluxo completo: código → central conecta → consulta → marca impressa', async () => {
    assert.equal((await rest('POST', `${BASE}:commit`, pairingBody('482913'))).code, 200);
    // antes de conectar, não vê pedidos
    assert.equal((await rest('POST', `${BASE}/restaurants/${RID}:runQuery`, queryBody)).code, 403);
    await ownerPairs('482913');
    const me = await rest('GET', `${BASE}/admins/${PRN}?mask.fieldPaths=restaurantId&mask.fieldPaths=displayName&mask.fieldPaths=name`);
    assert.equal(me.json.fields.restaurantId.stringValue, RID);
    assert.equal(me.json.fields.displayName.stringValue, 'Cozinha');

    const q = await rest('POST', `${BASE}/restaurants/${RID}:runQuery`, queryBody);
    assert.equal(q.code, 200);
    const docs = toPrint(q.json);
    assert.deepEqual(docs.map((d) => d.name.split('/').pop()).sort(), ['o1', 'o3']);

    const o1 = docs.find((d) => d.name.endsWith('/o1'));
    assert.equal((await rest('POST', `${BASE}:commit`, claimBody(o1.name, o1.updateTime, 0))).code, 200);
    // pedido completo (para imprimir)
    const full = await rest('GET', `${BASE}/restaurants/${RID}/orders/o1`);
    assert.equal(full.json.fields.tableNumber.integerValue, '6');
    assert.equal(full.json.fields.items.arrayValue.values[0].mapValue.fields.name.stringValue, 'Risoto de camarão');
    assert.equal(full.json.fields.printed.booleanValue, true);
    assert.equal(full.json.fields.printCount.integerValue, '1');
    assert.ok(full.json.fields.printedAt.timestampValue);

    // na próxima consulta o o1 já não aparece
    const q2 = await rest('POST', `${BASE}/restaurants/${RID}:runQuery`, queryBody);
    assert.deepEqual(toPrint(q2.json).map((d) => d.name.split('/').pop()), ['o3']);
  });

  test('duas impressoras: só uma pega o pedido (a outra recebe erro de versão)', async () => {
    await rest('POST', `${BASE}:commit`, pairingBody('111222'));
    await ownerPairs('111222');
    const q = await rest('POST', `${BASE}/restaurants/${RID}:runQuery`, queryBody);
    const o1 = toPrint(q.json).find((d) => d.name.endsWith('/o1'));
    assert.equal((await rest('POST', `${BASE}:commit`, claimBody(o1.name, o1.updateTime, 0))).code, 200);
    const second = await rest('POST', `${BASE}:commit`, claimBody(o1.name, o1.updateTime, 0));
    assert.notEqual(second.code, 200);
  });

  test('não saiu no papel: volta para a fila; Reimprimir da central também', async () => {
    await rest('POST', `${BASE}:commit`, pairingBody('333444'));
    await ownerPairs('333444');
    const q = await rest('POST', `${BASE}/restaurants/${RID}:runQuery`, queryBody);
    const o1 = toPrint(q.json).find((d) => d.name.endsWith('/o1'));
    await rest('POST', `${BASE}:commit`, claimBody(o1.name, o1.updateTime, 0));
    assert.equal((await rest('POST', `${BASE}:commit`, unclaimBody(o1.name))).code, 200);
    const q2 = await rest('POST', `${BASE}/restaurants/${RID}:runQuery`, queryBody);
    assert.ok(toPrint(q2.json).some((d) => d.name.endsWith('/o1')));

    // central: Reimprimir (api.reprintOrder) num pedido entregue para a cozinha (PREPARING)
    const db = env.authenticatedContext('dono', { email: 'dono@gmail.com', email_verified: true }).firestore();
    await updateDoc(doc(db, `restaurants/${RID}/orders/o6`), { status: 'PREPARING' });
    await updateDoc(doc(db, `restaurants/${RID}/orders/o6`), { printed: false });
    const q3 = await rest('POST', `${BASE}/restaurants/${RID}:runQuery`, queryBody);
    assert.ok(toPrint(q3.json).some((d) => d.name.endsWith('/o6')));
  });

  test('a impressora não muda o pedido além de impresso (status, itens, total)', async () => {
    await rest('POST', `${BASE}:commit`, pairingBody('555666'));
    await ownerPairs('555666');
    const path = `${DOCS}/restaurants/${RID}/orders/o1`;
    const bad = {
      writes: [{
        update: { name: path, fields: { total: { integerValue: '1' } } },
        updateMask: { fieldPaths: ['total'] },
      }],
    };
    assert.equal((await rest('POST', `${BASE}:commit`, bad)).code, 403);
  });

  test('impressora removida: consulta dá 403 e o cadastro some (404) → volta a imprimir código', async () => {
    await rest('POST', `${BASE}:commit`, pairingBody('777888'));
    await ownerPairs('777888');
    const db = env.authenticatedContext('dono', { email: 'dono@gmail.com', email_verified: true }).firestore();
    const b = writeBatch(db);
    b.delete(doc(db, `admins/${PRN}`));
    await b.commit();
    assert.equal((await rest('POST', `${BASE}/restaurants/${RID}:runQuery`, queryBody)).code, 403);
    assert.equal((await rest('GET', `${BASE}/admins/${PRN}`)).code, 404);
  });
});
