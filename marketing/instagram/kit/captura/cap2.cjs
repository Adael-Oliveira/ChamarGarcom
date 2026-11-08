const { chromium } = require('playwright');
const K = 'chamar-garcom:demo:v3', U = 'http://localhost:4177';
const hide = (p) => p.addStyleTag({ content: '.demo-banner{display:none!important}' });
const BR = [['carvao', 'Boteco da Esquina', 'Petiscos e chope gelado', '#1F2937', '#FBBF24', 'moderno', 12], ['anil', 'Sushi Anil', 'Culinária japonesa', '#3730A3', '#A5B4FC', 'leve', 4], ['brasa', 'Brasa Grill', 'Churrasco na brasa', '#C2410C', '#FDBA74', 'moderno', 3]];
const edit = (p, fn, arg) => p.evaluate(([K, f, a]) => { const d = JSON.parse(localStorage.getItem(K)); new Function('d', 'a', f)(d, a); localStorage.setItem(K, JSON.stringify(d)); }, [K, fn, arg]);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
  await p.goto(U + '/admin/'); await p.waitForTimeout(1200); const bt = p.getByText('Entrar na demonstração'); if (await bt.count()) { await bt.click(); await p.waitForTimeout(1000); }
  for (const [id, ...a] of BR) {
    await p.goto(U + '/admin/'); await p.waitForTimeout(400);
    const tok = await p.evaluate(([K, a]) => { const d = JSON.parse(localStorage.getItem(K)); const [name, tag, pri, acc, style, mesa] = a; Object.assign(d.brand.demo, { name, tagline: tag, primary: pri, accent: acc, style }); d.restaurants.demo.name = name;
      const t = d.tables.demo.find((x) => x.id === 'm3'); t.number = mesa; d.tableLinks[t.token].number = mesa; d.calls.demo = d.calls.demo.filter((c) => c.tableId !== 'm3'); delete d.tableState.demo.m3; localStorage.setItem(K, JSON.stringify(d)); return t.token; }, [K, a]);
    await p.goto(U + '/mesa.html?id=' + tok); await p.waitForTimeout(1500); await hide(p); await p.screenshot({ path: `c-${id}-menu.jpg`, type: 'jpeg', quality: 90 });
    await p.getByRole('button', { name: /Chamar garçom/ }).first().click(); await p.waitForTimeout(1200); await hide(p); await p.screenshot({ path: `c-${id}-chamou.jpg`, type: 'jpeg', quality: 90 });
  }
  await ctx.close(); await b.close(); console.log('ok');
})();
