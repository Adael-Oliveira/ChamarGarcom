const { chromium } = require('playwright');
const K = 'chamar-garcom:demo:v3', U = 'http://localhost:4177';
const hide = (p) => p.addStyleTag({ content: '.demo-banner{display:none!important}' });
const BR = [
  ['brasa', 'Brasa Grill', 'Churrasco na brasa', '#C2410C', '#FDBA74', 'moderno', 3],
  ['vinho', 'Cantina Bella', 'Massas da casa', '#7A1F3D', '#F9A8D4', 'classico', 6],
  ['horta', 'Empório Verde', 'Natural e caseiro', '#2F6B3B', '#D9F99D', 'leve', 2],
  ['carvao', 'Boteco da Esquina', 'Petiscos e chope gelado', '#1F2937', '#FBBF24', 'moderno', 12],
  ['anil', 'Sushi Anil', 'Culinária japonesa', '#3730A3', '#A5B4FC', 'leve', 4],
];
async function login(p) { await p.goto(U + '/admin/'); await p.waitForTimeout(1200); const b = p.getByText('Entrar na demonstração'); if (await b.count()) { await b.click(); await p.waitForTimeout(1200); } }
const edit = (p, fn, arg) => p.evaluate(([K, f, a]) => { const d = JSON.parse(localStorage.getItem(K)); new Function('d', 'a', f)(d, a); localStorage.setItem(K, JSON.stringify(d)); }, [K, fn, arg]);
(async () => {
  const b = await chromium.launch();
  // DESKTOP
  let ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 }); let p = await ctx.newPage();
  await login(p);
  await edit(p, `const now=Date.now();for(const c of d.calls.demo){if(c.status==='pending')c.calledAt=now-(c.tableNumber===4?95000:20000)}`);
  for (const pg of ['painel', 'mesas', 'cardapio', 'personalizar', 'configuracoes', 'relatorios', 'equipe']) {
    await p.goto(U + '/admin/#/' + pg); await p.waitForTimeout(1800); await hide(p); await p.screenshot({ path: `d-${pg}.jpg`, type: 'jpeg', quality: 90 });
  }
  await p.goto(U + '/admin/#/painel'); await p.waitForTimeout(1200);
  const dk = p.getByRole('button', { name: /Escuro/ }); if (await dk.count()) { await dk.first().click(); await p.waitForTimeout(700); await hide(p); await p.screenshot({ path: 'd-painel-escuro.jpg', type: 'jpeg', quality: 90 }); await p.getByRole('button', { name: /Claro/ }).first().click(); }
  await ctx.close();
  // MOBILE
  ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); p = await ctx.newPage();
  await login(p);
  await p.goto(U + '/admin/#/painel'); await p.waitForTimeout(1800); await hide(p); await p.screenshot({ path: 'm-painel-garcom.jpg', type: 'jpeg', quality: 90 });
  const tok = await p.evaluate((K) => { const d = JSON.parse(localStorage.getItem(K)); return d.tables.demo.map((t) => [t.number, t.token]); }, K);
  const T = Object.fromEntries(tok);
  // conta pedida (Bistrô, mesa 6)
  await edit(p, `for(const c of d.calls.demo)if(c.tableNumber===6)c.calledAt-=3600000`);
  await p.goto(U + '/mesa.html?id=' + T[6]); await p.waitForTimeout(1500); await hide(p);
  await p.screenshot({ path: 'c-bistro-6-menu.jpg', type: 'jpeg', quality: 90 });
  const conta = p.getByText('Pedir a conta'); if (await conta.count()) { await conta.first().click(); await p.waitForTimeout(1200); const ok = p.getByRole('button', { name: /Confirmar|Sim|Pedir/ }); await p.screenshot({ path: 'c-bistro-6-conta.jpg', type: 'jpeg', quality: 90 }); }
  // marcas
  for (const [id, name, tag, pri, acc, style, mesa] of BR) {
    await p.goto(U + '/admin/'); await p.waitForTimeout(500);
    await edit(p, `const [name,tag,pri,acc,style,mesa]=a;Object.assign(d.brand.demo,{name,tagline:tag,primary:pri,accent:acc,style});d.restaurants.demo.name=name;const t=d.tables.demo.find(x=>x.number===3);t.number=mesa;d.tableLinks[t.token].number=mesa;for(const c of d.calls.demo)if(c.tableId===t.id)c.calledAt-=7200000;`, [name, tag, pri, acc, style, mesa]);
    await p.goto(U + '/mesa.html?id=' + T[3]); await p.waitForTimeout(1500); await hide(p);
    await p.screenshot({ path: `c-${id}-menu.jpg`, type: 'jpeg', quality: 90 });
    const ch = p.getByText('Chamar garçom'); if (await ch.count()) { await ch.first().click(); await p.waitForTimeout(1200); await hide(p); await p.screenshot({ path: `c-${id}-chamou.jpg`, type: 'jpeg', quality: 90 }); }
    await p.goto(U + '/admin/'); await p.waitForTimeout(400);
    await edit(p, `const t=d.tables.demo.find(x=>x.token===a);t.number=3;d.tableLinks[t.token].number=3;d.calls.demo=d.calls.demo.filter(c=>!(c.tableId===t.id&&Date.now()-c.calledAt<600000))`, T[3]);
  }
  await ctx.close(); await b.close(); console.log('ok');
})();
