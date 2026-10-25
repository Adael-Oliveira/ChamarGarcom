// Regras da administração da plataforma (dono da plataforma, clientes, interessados)
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-plataforma', // projeto separado: os arquivos de teste rodam em paralelo
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => env?.cleanup());

const anon = () => env.unauthenticatedContext().firestore();
const as = (uid, email = `${uid}@gmail.com`) => env.authenticatedContext(uid, { email, email_verified: true }).firestore();
const adael = () => as('adael'); // dono da plataforma
const cliente = () => as('cliente'); // responsável do restaurante r1
const garcom = () => as('garcom');
const estranho = () => as('estranho');

const GENERAL = { callsEnabled: true, billEnabled: true, cooldownMinutes: 2, menuUrl: null, menuFileName: null, menuPath: null, menuUpdatedAt: null };
const BRAND = { name: 'Cantina', tagline: '', logo: null, primary: '#C2410C', accent: '#FDBA74', style: 'moderno' };
const TOKEN = 'b'.repeat(32);

async function seed({ suspended = false } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'platform/config'), { ownerUid: 'adael', signupOpen: false });
    await setDoc(doc(db, 'restaurants/r0'), { name: 'Do Adael', ownerUid: 'adael' });
    await setDoc(doc(db, 'admins/adael'), { restaurantId: 'r0', role: 'owner', email: 'adael@gmail.com', name: 'Adael' });
    await setDoc(doc(db, 'restaurants/r1'), { name: 'Cantina', ownerUid: 'cliente', suspended });
    await setDoc(doc(db, 'restaurants/r1/settings/general'), { ...GENERAL, suspended });
    await setDoc(doc(db, 'restaurants/r1/settings/brand'), BRAND);
    await setDoc(doc(db, 'restaurants/r1/tables/t1'), { number: 1, token: TOKEN, active: true });
    await setDoc(doc(db, `tableLinks/${TOKEN}`), { restaurantId: 'r1', tableId: 't1', number: 1, active: true });
    await setDoc(doc(db, 'admins/cliente'), { restaurantId: 'r1', role: 'owner', email: 'cliente@gmail.com', name: 'Cliente' });
    await setDoc(doc(db, 'admins/garcom'), { restaurantId: 'r1', role: 'staff', email: 'garcom@gmail.com', name: 'Garçom' });
    await setDoc(doc(db, 'leads/l1'), { name: 'Zé', restaurant: 'Bar do Zé', phone: '11999990000', status: 'new' });
  });
}

function newClient(db, { rid = 'r9', email = 'novo@gmail.com', by = 'adael', suspended = false } = {}) {
  const b = writeBatch(db);
  b.set(doc(db, `restaurants/${rid}`), { name: 'Pizzaria', ownerUid: null, ownerEmail: email, createdAt: serverTimestamp(), createdBy: by, suspended, notes: '' });
  b.set(doc(db, `restaurants/${rid}/settings/general`), { ...GENERAL, suspended, updatedAt: serverTimestamp() });
  b.set(doc(db, `restaurants/${rid}/settings/brand`), { ...BRAND, name: 'Pizzaria', updatedAt: serverTimestamp() });
  b.set(doc(db, `invites/${email}`), { restaurantId: rid, role: 'owner', createdBy: by, createdAt: serverTimestamp() });
  return b.commit();
}

const addLead = (db, d) => setDoc(doc(db, `leads/${d.phone}`), d);
const lead = (over = {}) => ({ name: 'Maria', restaurant: 'Café da Maria', city: 'Osasco', phone: '11988887777', email: 'maria@gmail.com', message: 'Tenho 10 mesas', status: 'new', createdAt: serverTimestamp(), ...over });

describe('dono da plataforma', () => {
  beforeEach(() => seed());
  test('lista todos os restaurantes; ninguém mais lista', async () => {
    await assertSucceeds(getDocs(collection(adael(), 'restaurants')));
    await assertFails(getDocs(collection(cliente(), 'restaurants')));
    await assertFails(getDocs(collection(estranho(), 'restaurants')));
  });
  test('cria o restaurante de um cliente já com o convite de Responsável', async () => {
    await assertSucceeds(newClient(adael()));
    const db = as('novo', 'novo@gmail.com');
    const b = writeBatch(db);
    b.set(doc(db, 'admins/novo'), { restaurantId: 'r9', role: 'owner', email: 'novo@gmail.com', name: 'Novo', createdAt: serverTimestamp() });
    b.delete(doc(db, 'invites/novo@gmail.com'));
    await assertSucceeds(b.commit());
    await assertSucceeds(getDoc(doc(db, 'restaurants/r9')));
  });
  test('cliente e estranho não criam restaurantes de clientes', async () => {
    await assertFails(newClient(cliente(), { by: 'cliente' }));
    await assertFails(newClient(estranho(), { by: 'estranho' }));
  });
  test('acessa qualquer restaurante para suporte', async () => {
    const db = adael();
    await assertSucceeds(getDoc(doc(db, 'restaurants/r1')));
    await assertSucceeds(getDocs(collection(db, 'restaurants/r1/tables')));
    await assertSucceeds(getDocs(collection(db, 'restaurants/r1/calls')));
    await assertSucceeds(getDocs(query(collection(db, 'admins'), where('restaurantId', '==', 'r1'))));
    await assertSucceeds(updateDoc(doc(db, 'restaurants/r1/settings/brand'), { tagline: 'Suporte' }));
  });
  test('convida o responsável de um restaurante existente', async () => {
    await assertSucceeds(setDoc(doc(adael(), 'invites/socio@gmail.com'), { restaurantId: 'r1', role: 'owner', createdBy: 'adael', createdAt: serverTimestamp() }));
  });
  test('remove qualquer pessoa da equipe', async () => {
    await assertSucceeds(deleteDoc(doc(adael(), 'admins/cliente')));
  });
  test('exclui um restaurante inteiro (inclusive o dele); cliente não exclui', async () => {
    await assertFails(deleteDoc(doc(cliente(), 'restaurants/r1')));
    await assertFails(deleteDoc(doc(cliente(), 'restaurants/r1/settings/general')));
    const db = adael();
    const b = writeBatch(db);
    b.delete(doc(db, 'restaurants/r1/tables/t1'));
    b.delete(doc(db, `tableLinks/${TOKEN}`));
    b.delete(doc(db, 'admins/cliente'));
    b.delete(doc(db, 'admins/garcom'));
    b.delete(doc(db, 'restaurants/r1/settings/general'));
    b.delete(doc(db, 'restaurants/r1/settings/brand'));
    b.delete(doc(db, 'restaurants/r1'));
    await assertSucceeds(b.commit());
    const b2 = writeBatch(db);
    b2.delete(doc(db, 'admins/adael'));
    b2.delete(doc(db, 'restaurants/r0'));
    await assertSucceeds(b2.commit());
    // continua dono da plataforma
    await assertSucceeds(getDocs(collection(db, 'restaurants')));
  });
  test('responsável não remove outro responsável', async () => {
    await assertFails(deleteDoc(doc(cliente(), 'admins/adael')));
  });
});

describe('suspensão', () => {
  test('dono da plataforma suspende; o cliente não consegue se reativar', async () => {
    await seed();
    const db = adael();
    const b = writeBatch(db);
    b.update(doc(db, 'restaurants/r1'), { suspended: true });
    b.update(doc(db, 'restaurants/r1/settings/general'), { suspended: true });
    await assertSucceeds(b.commit());
    await assertFails(updateDoc(doc(cliente(), 'restaurants/r1/settings/general'), { suspended: false }));
  });
  test('cliente não suspende/reativa nem mexe no próprio cadastro além do nome', async () => {
    await seed();
    await assertFails(updateDoc(doc(cliente(), 'restaurants/r1/settings/general'), { suspended: true }));
    await assertFails(updateDoc(doc(cliente(), 'restaurants/r1'), { suspended: true }));
    await assertSucceeds(updateDoc(doc(cliente(), 'restaurants/r1/settings/general'), { cooldownMinutes: 3 }));
  });
  test('restaurante suspenso: equipe perde o acesso, dono da plataforma mantém', async () => {
    await seed({ suspended: true });
    await assertFails(getDocs(collection(cliente(), 'restaurants/r1/tables')));
    await assertFails(getDocs(collection(garcom(), 'restaurants/r1/calls')));
    await assertSucceeds(getDoc(doc(cliente(), 'admins/cliente'))); // vê o próprio cadastro (tela "suspenso")
    await assertSucceeds(getDocs(collection(adael(), 'restaurants/r1/tables')));
  });
  test('restaurante suspenso não recebe chamadas', async () => {
    await seed({ suspended: true });
    const db = anon();
    const b = writeBatch(db);
    b.set(doc(db, 'restaurants/r1/calls/c1'), { restaurantId: 'r1', tableId: 't1', tableNumber: 1, callId: 'c1', token: TOKEN, reason: 'waiter', calledAt: serverTimestamp(), viewedAt: null, status: 'PENDING' });
    b.set(doc(db, 'restaurants/r1/tableState/t1'), { lastCallId: 'c1', lastCallAt: serverTimestamp() });
    await assertFails(b.commit());
  });
});

describe('interessados ("Quero minha ferramenta")', () => {
  beforeEach(() => seed());
  test('qualquer visitante deixa o contato', async () => {
    await assertSucceeds(addLead(anon(), lead()));
    await assertSucceeds(addLead(estranho(), lead({ phone: '11977776666', email: null, city: null, message: null })));
  });
  test('formulário inválido é recusado', async () => {
    await assertFails(addLead(anon(), lead({ phone: '123' })));
    await assertFails(addLead(anon(), lead({ name: '' })));
    await assertSucceeds(addLead(anon(), lead({ phone: '11955554444', restaurant: null })));
    await assertFails(addLead(anon(), lead({ status: 'client' })));
    await assertFails(addLead(anon(), lead({ message: 'x'.repeat(700) })));
    await assertFails(addLead(anon(), lead({ extra: 1 })));
  });
  test('o mesmo WhatsApp não envia de novo nem sobrescreve; id precisa ser o número', async () => {
    await assertSucceeds(addLead(anon(), lead()));
    await assertFails(addLead(anon(), lead({ name: 'Outro' })));
    await assertFails(setDoc(doc(anon(), 'leads/qualquer'), lead()));
  });
  test('só o dono da plataforma lê e atualiza os interessados', async () => {
    await assertSucceeds(getDocs(collection(adael(), 'leads')));
    await assertSucceeds(updateDoc(doc(adael(), 'leads/l1'), { status: 'contacted' }));
    await assertFails(getDocs(collection(cliente(), 'leads')));
    await assertFails(getDoc(doc(anon(), 'leads/l1')));
    await assertFails(updateDoc(doc(cliente(), 'leads/l1'), { status: 'contacted' }));
  });
});

describe('contatos públicos da plataforma', () => {
  beforeEach(() => seed());
  const contacts = { name: 'Adael', whatsapp: '5511999999999', email: 'adael@gmail.com', instagram: '', message: 'Fale comigo', updatedAt: serverTimestamp() };
  test('dono da plataforma publica; qualquer um lê', async () => {
    await assertSucceeds(setDoc(doc(adael(), 'platform/public'), contacts));
    await assertSucceeds(getDoc(doc(anon(), 'platform/public')));
  });
  test('ninguém mais altera os contatos', async () => {
    await assertFails(setDoc(doc(cliente(), 'platform/public'), contacts));
    await assertFails(setDoc(doc(estranho(), 'platform/public'), contacts));
  });
});
