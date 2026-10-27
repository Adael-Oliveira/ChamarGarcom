// Permissões da equipe e registro de quem atendeu (rodam no emulador local):
//   npm run test:rules
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';

const RID = 'r1';
const TOKEN = 'b'.repeat(32);
const TID = 't5';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-chamar-garcom-team',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => env?.cleanup());

const as = (uid, email = `${uid}@gmail.com`) => env.authenticatedContext(uid, { email, email_verified: true }).firestore();
const owner = () => as('dono');
const bia = () => as('bia'); // só atendimento
const rafa = () => as('rafa'); // atendimento + mesas
const antigo = () => as('antigo'); // cadastro anterior às permissões

const GENERAL = { callsEnabled: true, billEnabled: true, cooldownMinutes: 2, menuUrl: null, menuFileName: null, menuPath: null, menuUpdatedAt: null };

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'platform/config'), { ownerUid: 'plataforma', signupOpen: false });
    await setDoc(doc(db, `restaurants/${RID}`), { name: 'Cantina', ownerUid: 'dono' });
    await setDoc(doc(db, 'admins/dono'), { restaurantId: RID, role: 'owner', email: 'dono@gmail.com', name: 'Dono' });
    await setDoc(doc(db, 'admins/bia'), { restaurantId: RID, role: 'staff', email: 'bia@gmail.com', name: 'Beatriz S.', displayName: 'Bia', perms: [] });
    await setDoc(doc(db, 'admins/rafa'), { restaurantId: RID, role: 'staff', email: 'rafa@gmail.com', name: 'Rafael', perms: ['mesas'] });
    await setDoc(doc(db, 'admins/antigo'), { restaurantId: RID, role: 'staff', email: 'antigo@gmail.com', name: 'Antigo' });
    await setDoc(doc(db, 'admins/outro'), { restaurantId: 'r2', role: 'owner', email: 'outro@gmail.com', name: 'Outro' });
    await setDoc(doc(db, `restaurants/${RID}/settings/general`), GENERAL);
    await setDoc(doc(db, `restaurants/${RID}/tables/${TID}`), { number: 5, token: TOKEN, active: true });
    await setDoc(doc(db, `tableLinks/${TOKEN}`), { restaurantId: RID, tableId: TID, number: 5, active: true });
    await setDoc(doc(db, `restaurants/${RID}/calls/c1`), {
      restaurantId: RID, tableId: TID, tableNumber: 5, callId: 'c1', token: TOKEN, reason: 'waiter',
      calledAt: Timestamp.fromDate(new Date(Date.now() - 60000)), viewedAt: null, status: 'PENDING',
    });
  });
});

const callRef = (db) => doc(db, `restaurants/${RID}/calls/c1`);
const viewedAs = (db, uid, name) => updateDoc(callRef(db), { status: 'VIEWED', viewedAt: serverTimestamp(), viewedBy: uid, viewedByName: name });

describe('quem atendeu fica registrado', () => {
  test('atendente grava o próprio nome ao clicar em Visualizado', async () => {
    await assertSucceeds(viewedAs(bia(), 'bia', 'Bia'));
  });
  test('não dá para registrar o atendimento no nome de outra pessoa', async () => {
    await assertFails(viewedAs(bia(), 'rafa', 'Rafael'));
  });
  test('nome muito longo é recusado', async () => {
    await assertFails(viewedAs(bia(), 'bia', 'x'.repeat(41)));
  });
  test('liberar a mesa também registra quem liberou', async () => {
    await viewedAs(bia(), 'bia', 'Bia');
    await assertSucceeds(updateDoc(callRef(rafa()), { status: 'DONE', doneAt: serverTimestamp(), doneBy: 'rafa', doneByName: 'Rafael' }));
    await assertFails(updateDoc(callRef(bia()), { doneBy: 'dono', doneByName: 'Dono' }));
  });
  test('outro restaurante não registra atendimento aqui', async () => {
    await assertFails(viewedAs(as('outro'), 'outro', 'Outro'));
  });
});

describe('permissões da equipe', () => {
  test('só atendimento: não mexe em mesas, cardápio nem configurações', async () => {
    await assertFails(updateDoc(doc(bia(), `restaurants/${RID}/tables/${TID}`), { number: 5, token: TOKEN, active: false }));
    await assertFails(deleteDoc(doc(bia(), `restaurants/${RID}/tables/${TID}`)));
    await assertFails(updateDoc(doc(bia(), `tableLinks/${TOKEN}`), { restaurantId: RID, tableId: TID, number: 5, active: false }));
    await assertFails(updateDoc(doc(bia(), `restaurants/${RID}/settings/general`), { callsEnabled: false }));
    await assertFails(updateDoc(doc(bia(), `restaurants/${RID}/settings/general`), { menuUrl: 'https://exemplo.com/menu.pdf' }));
  });
  test('com permissão de mesas: cadastra mesa, mas não muda as configurações', async () => {
    const t = 'c'.repeat(32);
    const db = rafa();
    const b = writeBatch(db);
    b.set(doc(db, `restaurants/${RID}/tables/t9`), { number: 9, token: t, active: true, createdAt: serverTimestamp() });
    b.set(doc(db, `tableLinks/${t}`), { restaurantId: RID, tableId: 't9', number: 9, active: true });
    await assertSucceeds(b.commit());
    await assertFails(updateDoc(doc(rafa(), `restaurants/${RID}/settings/general`), { callsEnabled: false }));
  });
  test('cadastro antigo (sem lista) continua podendo tudo que podia', async () => {
    await assertSucceeds(updateDoc(doc(antigo(), `restaurants/${RID}/settings/general`), { callsEnabled: false }));
    await assertSucceeds(updateDoc(doc(antigo(), `restaurants/${RID}/settings/general`), { menuUrl: 'https://exemplo.com/menu.pdf' }));
  });
  test('responsável muda nome e permissões de quem é Equipe', async () => {
    await assertSucceeds(updateDoc(doc(owner(), 'admins/bia'), { displayName: 'Bia Souza', perms: ['relatorios', 'config'] }));
    await assertSucceeds(updateDoc(doc(bia(), `restaurants/${RID}/settings/general`), { callsEnabled: false }));
  });
  test('permissão desconhecida é recusada', async () => {
    await assertFails(updateDoc(doc(owner(), 'admins/bia'), { perms: ['equipe'] }));
  });
  test('responsável não dá permissões a outro responsável (já tem tudo), mas muda o nome', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'admins/socio'), { restaurantId: RID, role: 'owner', email: 'socio@gmail.com', name: 'Sócio' }));
    await assertFails(updateDoc(doc(owner(), 'admins/socio'), { perms: [] }));
    await assertSucceeds(updateDoc(doc(owner(), 'admins/socio'), { displayName: 'Carlos' }));
  });
  test('funcionário não muda as próprias permissões nem o papel', async () => {
    await assertFails(updateDoc(doc(bia(), 'admins/bia'), { perms: ['mesas', 'cardapio', 'relatorios', 'config'] }));
    await assertFails(updateDoc(doc(bia(), 'admins/bia'), { displayName: 'Chefe' }));
    await assertFails(updateDoc(doc(owner(), 'admins/bia'), { role: 'owner' }));
    await assertFails(updateDoc(doc(owner(), 'admins/bia'), { restaurantId: 'r2' }));
  });
  test('responsável de outro restaurante não mexe na equipe daqui', async () => {
    await assertFails(updateDoc(doc(as('outro'), 'admins/bia'), { perms: ['config'] }));
  });
});

describe('convite com nome e permissões', () => {
  const inviteAs = (db, data) => setDoc(doc(db, 'invites/lia@gmail.com'), { restaurantId: RID, role: 'staff', createdBy: 'dono', createdAt: serverTimestamp(), ...data });
  const accept = (data) => {
    const db = as('lia', 'lia@gmail.com');
    const b = writeBatch(db);
    b.set(doc(db, 'admins/lia'), { restaurantId: RID, role: 'staff', email: 'lia@gmail.com', name: 'Lia', createdAt: serverTimestamp(), ...data });
    b.delete(doc(db, 'invites/lia@gmail.com'));
    return b.commit();
  };

  test('responsável convida com nome e só atendimento', async () => {
    await assertSucceeds(inviteAs(owner(), { displayName: 'Lia', perms: [] }));
  });
  test('convite de Responsável não leva lista de permissões', async () => {
    await assertFails(setDoc(doc(owner(), 'invites/lia@gmail.com'), { restaurantId: RID, role: 'owner', perms: [], createdBy: 'dono', createdAt: serverTimestamp() }));
  });
  test('ao aceitar, nome e permissões têm que ser os do convite', async () => {
    await inviteAs(owner(), { displayName: 'Lia', perms: ['mesas'] });
    await assertFails(accept({ displayName: 'Lia', perms: ['mesas', 'config'] }));
    await assertFails(accept({ displayName: 'Lia' })); // sem a lista = acesso antigo completo
    await assertFails(accept({ displayName: 'Gerente', perms: ['mesas'] }));
    await assertSucceeds(accept({ displayName: 'Lia', perms: ['mesas'] }));
  });
});

describe('relógio de atendimento (pareamento por código)', () => {
  const watch = (uid = 'relogio1') => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  const showCode = (db, code = '123456', uid = 'relogio1') => setDoc(doc(db, `devicePairings/${code}`), { uid, model: 'T-Watch S3', createdAt: serverTimestamp() });
  const pair = (db, { code = '123456', uid = 'relogio1', ...over } = {}) => {
    const b = writeBatch(db);
    b.set(doc(db, `admins/${uid}`), { restaurantId: RID, role: 'staff', email: '', name: 'Relógio', displayName: 'Relógio do dono', perms: [], device: true, pairCode: code, createdAt: serverTimestamp(), ...over });
    b.delete(doc(db, `devicePairings/${code}`));
    return b.commit();
  };

  test('relógio mostra código; responsável conecta; relógio atende e registra no nome dele', async () => {
    await assertSucceeds(showCode(watch()));
    await assertSucceeds(pair(owner()));
    const w = watch();
    await assertSucceeds(updateDoc(callRef(w), { status: 'VIEWED', viewedAt: serverTimestamp(), viewedBy: 'relogio1', viewedByName: 'Relógio do dono' }));
  });
  test('relógio não mexe em mesas nem configurações', async () => {
    await showCode(watch());
    await pair(owner());
    await assertFails(updateDoc(doc(watch(), `restaurants/${RID}/settings/general`), { callsEnabled: false }));
    await assertFails(updateDoc(doc(watch(), `restaurants/${RID}/tables/${TID}`), { number: 5, token: TOKEN, active: false }));
  });
  test('código não pode ser de outro aparelho nem ser reaproveitado', async () => {
    await assertFails(setDoc(doc(watch(), 'devicePairings/123456'), { uid: 'outro', createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(watch(), 'devicePairings/12a456'), { uid: 'relogio1', createdAt: serverTimestamp() }));
    await showCode(watch());
    await assertFails(showCode(watch('relogio2'), '123456', 'relogio2')); // já existe
  });
  test('só o responsável conecta; equipe e outro restaurante não', async () => {
    await showCode(watch());
    await assertFails(pair(bia()));
    await assertFails(pair(as('outro')));
  });
  test('conectado tem que ser o aparelho do código, só atendimento, e consumir o código', async () => {
    await showCode(watch());
    await assertFails(pair(owner(), { uid: 'relogio2' }));
    await assertFails(pair(owner(), { perms: ['config'] }));
    await assertFails(pair(owner(), { role: 'owner' }));
    const db = owner();
    await assertFails(setDoc(doc(db, 'admins/relogio1'), { restaurantId: RID, role: 'staff', email: '', name: 'Relógio', displayName: 'X', perms: [], device: true, pairCode: '123456', createdAt: serverTimestamp() }));
  });
  test('código expirado (mais de 15 min) não conecta', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'devicePairings/123456'), { uid: 'relogio1', createdAt: Timestamp.fromDate(new Date(Date.now() - 16 * 60000)) }));
    await assertFails(pair(owner()));
  });
  test('ninguém se cadastra sozinho como relógio', async () => {
    await showCode(watch());
    await assertFails(setDoc(doc(watch(), 'admins/relogio1'), { restaurantId: RID, role: 'staff', email: '', name: 'Relógio', displayName: 'X', perms: [], device: true, pairCode: '123456', createdAt: serverTimestamp() }));
  });
  test('responsável remove o relógio e ele perde o acesso', async () => {
    await showCode(watch());
    await pair(owner());
    await assertSucceeds(deleteDoc(doc(owner(), 'admins/relogio1')));
    await assertFails(updateDoc(callRef(watch()), { status: 'VIEWED', viewedAt: serverTimestamp(), viewedBy: 'relogio1', viewedByName: 'Relógio' }));
  });
});
