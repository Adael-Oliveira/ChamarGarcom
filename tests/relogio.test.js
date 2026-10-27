// Protocolo do relógio (firmware em relogio/): as mesmas requisições REST que o
// T-Watch faz, contra o emulador do Firestore com as regras reais.
//   npm run test:rules
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, writeBatch } from 'firebase/firestore';

const PROJECT = 'demo-acenai-relogio';
const RID = 'toca';
const DOCS = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `http://127.0.0.1:8080/v1/${DOCS}`;
const WATCH = 'relogio-uid-1';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => env?.cleanup());

// token sem assinatura (o emulador aceita) igual ao do login anônimo
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function anonToken(uid) {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now,
    firebase: { sign_in_provider: 'anonymous', identities: {} },
  })}.`;
}
async function rest(method, url, body, uid = WATCH) {
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${anonToken(uid)}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  return { code: r.status, json: text ? JSON.parse(text) : null };
}
const errStatus = (j) => (Array.isArray(j) ? j[0]?.error?.status : j?.error?.status) || '';

// ---- corpos idênticos aos do net.cpp
const pairingBody = (code, uid = WATCH) => ({
  writes: [{
    update: { name: `${DOCS}/devicePairings/${code}`, fields: { uid: { stringValue: uid }, model: { stringValue: 'T-Watch S3' } } },
    updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
    currentDocument: { exists: false },
  }],
});
const queryBody = {
  structuredQuery: {
    from: [{ collectionId: 'calls' }],
    where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'PENDING' } } },
    limit: 16,
  },
};
const ackBody = (path, updateTime, name = 'Relógio do dono', uid = WATCH) => ({
  writes: [{
    update: { name: path, fields: { status: { stringValue: 'VIEWED' }, viewedBy: { stringValue: uid }, viewedByName: { stringValue: name } } },
    updateMask: { fieldPaths: ['status', 'viewedBy', 'viewedByName'] },
    updateTransforms: [{ fieldPath: 'viewedAt', setToServerValue: 'REQUEST_TIME' }],
    currentDocument: { updateTime },
  }],
});

// ---- o que a central faz ao digitar o código (igual ao api.pairDevice)
async function ownerPairs(code) {
  const db = env.authenticatedContext('dono', { email: 'dono@gmail.com', email_verified: true }).firestore();
  const p = (await getDoc(doc(db, `devicePairings/${code}`))).data();
  const b = writeBatch(db);
  b.set(doc(db, `admins/${p.uid}`), { restaurantId: RID, role: 'staff', email: '', name: 'Relógio', displayName: 'Relógio do dono', perms: [], device: true, pairCode: code, createdAt: serverTimestamp() });
  b.delete(doc(db, `devicePairings/${code}`));
  await b.commit();
}

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'platform/config'), { ownerUid: 'plataforma', signupOpen: false });
    await setDoc(doc(db, `restaurants/${RID}`), { name: 'Toca da Tilápia', ownerUid: 'dono' });
    await setDoc(doc(db, 'admins/dono'), { restaurantId: RID, role: 'owner', email: 'dono@gmail.com', name: 'Dono' });
    await setDoc(doc(db, `restaurants/${RID}/settings/general`), { callsEnabled: true, billEnabled: true, cooldownMinutes: 2, menuUrl: null, menuFileName: null, menuPath: null, menuUpdatedAt: null });
    await setDoc(doc(db, `restaurants/${RID}/settings/brand`), { name: 'Toca da Tilápia', tagline: '', logo: null, primary: '#C2410C', accent: '#FDBA74', style: 'moderno' });
    const base = { restaurantId: RID, token: 'x'.repeat(32), viewedAt: null, status: 'PENDING' };
    await setDoc(doc(db, `restaurants/${RID}/calls/c7`), { ...base, tableId: 't7', tableNumber: 7, callId: 'c7', reason: 'bill', calledAt: Timestamp.fromDate(new Date(Date.now() - 42000)) });
    await setDoc(doc(db, `restaurants/${RID}/calls/c4`), { ...base, tableId: 't4', tableNumber: 4, callId: 'c4', reason: 'waiter', calledAt: Timestamp.fromDate(new Date(Date.now() - 190000)) });
    await setDoc(doc(db, `restaurants/${RID}/calls/c2`), { ...base, tableId: 't2', tableNumber: 2, callId: 'c2', reason: 'waiter', status: 'DONE', calledAt: Timestamp.fromDate(new Date(Date.now() - 600000)) });
  });
});

describe('relógio: conectar e atender pelo REST', () => {
  test('fluxo completo: código → central conecta → fila → Visualizado registrado no nome do relógio', async () => {
    // 1. relógio mostra o código
    const c1 = await rest('POST', `${BASE}:commit`, pairingBody('482913'));
    assert.equal(c1.code, 200, JSON.stringify(c1.json));

    // 2. antes de conectar: o próprio cadastro ainda não existe (404, não 403)
    assert.equal((await rest('GET', `${BASE}/admins/${WATCH}`)).code, 404);

    // 3. responsável digita o código na central
    await ownerPairs('482913');

    // 4. relógio descobre o restaurante e o nome
    const me = await rest('GET', `${BASE}/admins/${WATCH}`);
    assert.equal(me.code, 200);
    assert.equal(me.json.fields.restaurantId.stringValue, RID);
    assert.equal(me.json.fields.displayName.stringValue, 'Relógio do dono');
    const brand = await rest('GET', `${BASE}/restaurants/${RID}/settings/brand`);
    assert.equal(brand.json.fields.name.stringValue, 'Toca da Tilápia');

    // 5. fila: só as pendentes, com o que a tela usa
    const q = await rest('POST', `${BASE}/restaurants/${RID}:runQuery`, queryBody);
    assert.equal(q.code, 200, JSON.stringify(q.json));
    const docs = q.json.filter((r) => r.document).map((r) => r.document);
    assert.deepEqual(docs.map((d) => d.fields.tableNumber.integerValue).sort(), ['4', '7']);
    assert.ok(q.json[0].readTime, 'readTime serve de relógio do servidor');
    const mesa7 = docs.find((d) => d.fields.tableNumber.integerValue === '7');
    assert.equal(mesa7.fields.reason.stringValue, 'bill');
    assert.ok(mesa7.fields.calledAt.timestampValue);

    // 6. Visualizado no pulso
    const a = await rest('POST', `${BASE}:commit`, ackBody(mesa7.name, mesa7.updateTime));
    assert.equal(a.code, 200, JSON.stringify(a.json));
    let saved;
    await env.withSecurityRulesDisabled(async (ctx) => {
      saved = (await getDoc(doc(ctx.firestore(), `restaurants/${RID}/calls/c7`))).data();
    });
    assert.equal(saved.status, 'VIEWED');
    assert.equal(saved.viewedBy, WATCH);
    assert.equal(saved.viewedByName, 'Relógio do dono');
    assert.ok(saved.viewedAt instanceof Timestamp);

    // 7. clicar de novo com a versão antiga: recusado como "já atendida"
    const again = await rest('POST', `${BASE}:commit`, ackBody(mesa7.name, mesa7.updateTime));
    assert.notEqual(again.code, 200);
    assert.match(errStatus(again.json), /FAILED_PRECONDITION|ABORTED/);
  });

  test('código repetido é recusado (o relógio sorteia outro)', async () => {
    assert.equal((await rest('POST', `${BASE}:commit`, pairingBody('111111'))).code, 200);
    const dup = await rest('POST', `${BASE}:commit`, pairingBody('111111', 'outro-relogio'));
    assert.ok([400, 403, 409].includes(dup.code), `código ${dup.code}`);
  });

  test('não registra Visualizado no nome de outro aparelho', async () => {
    await rest('POST', `${BASE}:commit`, pairingBody('222222'));
    await ownerPairs('222222');
    const q = await rest('POST', `${BASE}/restaurants/${RID}:runQuery`, queryBody);
    const d = q.json.find((r) => r.document).document;
    const forged = await rest('POST', `${BASE}:commit`, ackBody(d.name, d.updateTime, 'Bia', 'bia'));
    assert.equal(forged.code, 403);
  });

  test('sem conectar, o relógio não vê as chamadas', async () => {
    const q = await rest('POST', `${BASE}/restaurants/${RID}:runQuery`, queryBody);
    assert.equal(q.code, 403);
  });

  test('responsável remove o relógio: fila dá 403 e o cadastro some (404) → volta a mostrar código', async () => {
    await rest('POST', `${BASE}:commit`, pairingBody('333333'));
    await ownerPairs('333333');
    const owner = env.authenticatedContext('dono', { email: 'dono@gmail.com', email_verified: true }).firestore();
    await deleteDoc(doc(owner, `admins/${WATCH}`));
    assert.equal((await rest('POST', `${BASE}/restaurants/${RID}:runQuery`, queryBody)).code, 403);
    assert.equal((await rest('GET', `${BASE}/admins/${WATCH}`)).code, 404);
    // e consegue conectar de novo com outro código
    assert.equal((await rest('POST', `${BASE}:commit`, pairingBody('444444'))).code, 200);
    await ownerPairs('444444');
    assert.equal((await rest('GET', `${BASE}/admins/${WATCH}`)).code, 200);
  });

  test('restaurante pausado: fila dá 403, cadastro existe e settings/general mostra suspended', async () => {
    await rest('POST', `${BASE}:commit`, pairingBody('555555'));
    await ownerPairs('555555');
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `restaurants/${RID}/settings/general`), { suspended: true }, { merge: true }));
    assert.equal((await rest('POST', `${BASE}/restaurants/${RID}:runQuery`, queryBody)).code, 403);
    assert.equal((await rest('GET', `${BASE}/admins/${WATCH}`)).code, 200);
    const g = await rest('GET', `${BASE}/restaurants/${RID}/settings/general`);
    assert.equal(g.json.fields.suspended.booleanValue, true);
  });

  test('o relógio apaga o próprio código quando troca', async () => {
    await rest('POST', `${BASE}:commit`, pairingBody('666666'));
    assert.equal((await rest('DELETE', `${BASE}/devicePairings/666666`)).code, 200);
    // e não apaga o código de outro aparelho (ainda válido)
    await rest('POST', `${BASE}:commit`, pairingBody('777777', 'outro'), 'outro');
    assert.equal((await rest('DELETE', `${BASE}/devicePairings/777777`)).code, 403);
  });
});
