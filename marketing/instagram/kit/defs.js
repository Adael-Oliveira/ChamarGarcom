const I={m1:'IMG_m1',m2:'IMG_m2',m3:'IMG_m3',pl:'IMG_plaque',pa:'IMG_painel',eq:'IMG_equipe',re:'IMG_rel',c1:'IMG_c1',c2:'IMG_c2',c3:'IMG_c3',wf:'IMG_wframe',w1:'IMG_w1',w2:'IMG_w2',w3:'IMG_w3',w4:'IMG_w4'};
const tap=(x,y,t)=>`<div class="tap" style="left:${x}%;top:${y}%" data-tap="${t}"></div>`;
const tapA=(x,y,t)=>`<div class="tap" style="left:${x}px;top:${y}px" data-tap="${t}"></div>`;
const phone=(imgs,x,y,a='data-in=".1"',inner='')=>`<div class="phone" style="left:${x}px;top:${y}px" ${a}><div class="scr">${imgs.map(([s,sh])=>`<img src="${I[s]||s}" ${sh!==undefined?`data-show="${sh}"`:''}>`).join('')}${inner}</div></div>`;
const tablet=(img,x,y,z='1,1.6',orig='30% 62%',a='data-in=".1"')=>`<div class="tablet" style="left:${x}px;top:${y}px" ${a}><div class="scr"><img src="${I[img]||img}" style="transform-origin:${orig}" data-zoom="${z}"></div></div>`;
const watch=(scr,x,y,a='data-in=".1"')=>`<div class="watch" style="left:${x}px;top:${y}px" ${a}><img class="fr" src="${I.wf}"><div class="ws">${scr.map(([s,sh])=>`<img src="${I[s]||s}" ${sh!==undefined?`data-show="${sh}"`:''}>`).join('')}</div></div>`;
const plaque=(x,y,w,a)=>`<div class="card" style="left:${x}px;top:${y}px;width:${w}px" ${a}><img src="${I.pl}"></div>`;
const H=(txt,top,cls='',a='data-in="0"')=>`<div class="hl ${cls}" style="top:${top}px" ${a}>${txt}</div>`;
const S=(txt,top,cls='',a='data-in=".3"')=>`<div class="sub ${cls}" style="top:${top}px" ${a}>${txt}</div>`;
const pill=(txt,left,top,t,cls='')=>`<div class="pill ${cls}" style="left:${left}px;top:${top}px" data-pop="${t}">${txt}</div>`;
// Helpers extras: notificação, balão de conversa, barras, flash
const notif=(title,body,top,t)=>`<div class="notif" style="top:${top}px" data-show="${t}" data-slide="0,-500,0,0,${t},${t+.45}"><div class="ic">${hand(70)}</div><div><b>${title}</b>${body}</div></div>`;
const bubble=(txt,side,top,t)=>`<div class="bubble ${side}" style="top:${top}px" data-pop="${t}">${txt}</div>`;
const bars=(items,left,top,t0)=>`<div class="bars" style="left:${left}px;top:${top}px;height:500px">${items.map(([lab,val,h],k)=>`<div class="bar" data-h="${h}" data-grow="${t0+k*.25},${t0+k*.25+.6}" style="height:0"><span>${val}</span><i>${lab}</i></div>`).join('')}</div>`;
const flash=(t=0)=>`<div class="flash" data-flash="${t}"></div>`;
const A_={wfila:'ASSET:w-e-fila.png',watras:'ASSET:w-f-atrasada.png',wconta12:'ASSET:w-d-conta12.png',wcam12:'ASSET:w-g-caminho12.png',dpainel:'ASSET:d-painel.jpg',bmenu:'ASSET:c-carvao-menu.jpg',bchamou:'ASSET:c-carvao-chamou.jpg',bcaminho:'ASSET:c-carvao-caminho.jpg',mgarcom:'ASSET:m-painel-garcom.jpg'};
const END={d:2.6,html:`<div class="glow" style="left:90px;top:300px;width:900px;height:900px"></div><div class="abs" style="left:390px;top:470px" data-pop="0">${hand(300)}</div>
<div class="hl c xl" style="top:820px" data-in=".2">Acen<span class="o">ai</span></div>${S('Chamada de garçom pelo QR Code',1000,'c','data-in=".35"')}
<div class="cta" style="top:1150px" data-base="translateX(-50%)" data-in=".5">Peça sua demonstração</div>${S('👆 link na bio',1310,'c','data-in=".7"')}`};
const WS={left:426,top:1034,size:221};
const ring=(t)=>`<div class="ring" style="left:${WS.left-26}px;top:${WS.top-26}px;width:${WS.size+52}px;height:${WS.size+52}px" data-ring="${t}"></div>`;
const R={
r1:[
 {d:2.6,html:brand()+H('Pediu a conta…',330)+H('<span class="o">…e ninguém viu?</span> 🙋',560,'','data-in=".8"')+`<div class="hl c" style="top:880px;font-size:260px;color:#ffb020" data-timer="0,2.6,3,95" data-in="0">0:03</div>`+S('esperando o garçom olhar pra mesa',1170,'c','data-in="1.2"')},
 {d:3.2,bg:'light',html:brand()+H('No Acenai, é<br>um <span class="o">toque</span>:',230,'s')+phone([['m1'],['m2',1.7]],260,600,'data-in=".1"',tap(27,92,1.2))},
 {d:2.6,html:brand()+H('Chega na hora<br>no <span class="o">caixa</span> 🔔',230,'s')+tablet('pa',40,720)+pill('🔔 Nova chamada!',300,1440,1.0,'w')},
 {d:2.4,bg:'light',html:brand()+H('Sem levantar<br>a <span class="o">mão</span>. ✋',230,'s')+phone([['m3']],260,600)},
 END],
r2:[
 {d:2.6,html:brand()+H('E se a chamada<br>vibrasse no <span class="o">pulso</span>?',240,'c s')+watch([['w1']],260,760)},
 {d:3.0,html:brand()+H('<span class="o">Mesa 5</span> chamando ⌚',240,'c s')+`<div class="abs" style="left:0;top:0;width:1080px;height:1920px" data-buzz="0.2,1.8">${watch([['w2'],['w3',1.0]],260,760,'')}</div>`+ring(.1)+ring(.55)},
 {d:2.6,html:brand()+H('Um toque:<br><span class="o">visualizado</span> ✓',240,'c s')+watch([['w3'],['w4',1.0]],260,760,'')+tapA(536,1144,.7)},
 {d:2.4,bg:'light',html:brand()+H('E o cliente já vê:<br><span class="o">garçom a caminho</span>',230,'s')+phone([['m3']],260,600)},
 {d:3.0,html:`<div class="glow" style="left:90px;top:300px;width:900px;height:900px"></div>`+brand()+H('Relógio Acenai ⌚',300,'c s')+S('Opcional · entregue instalado e funcionando',430,'c')+H('<span class="o">R$ 597</span>',640,'c xl','data-pop=".4"')+S('ou 3x de R$ 199 sem juros',840,'c','data-in=".8"')+`<div class="cta" style="top:1040px" data-base="translateX(-50%)" data-in="1.1">Quero o relógio</div>`+S('👆 link na bio',1200,'c','data-in="1.3"')}],
r3:[
 {d:2.2,html:brand()+H('Do QR Code<br>ao garçom em<br><span class="o">3 toques</span> 👆',600,'c','data-pop="0"')},
 {d:2.6,bg:'light',html:`<div class="wood"></div>`+brand()+`<div class="num" style="left:70px;top:220px" data-pop="0">1</div>`+`<div class="hl s" style="top:228px;left:210px" data-in=".1">Aponta a câmera</div>`+plaque(300,600,480,'data-in=".2" data-base="rotate(-3deg)"')+tapA(540,1000,1.4)},
 {d:2.6,bg:'light',html:brand()+`<div class="num" style="left:70px;top:220px" data-pop="0">2</div>`+`<div class="hl s" style="top:228px;left:210px" data-in=".1">Toca em chamar</div>`+phone([['m1'],['m2',1.5]],260,560,'data-in=".1"',tap(50,47,1.1))},
 {d:2.8,html:brand()+`<div class="num" style="left:70px;top:220px" data-pop="0">3</div>`+`<div class="hl s" style="top:228px;left:210px" data-in=".1">A equipe toca em<br><span class="o">Visualizado</span></div>`+tablet('pa',40,740,'1,1.7','30% 62%')+tapA(330,1160,1.4)+pill('✓ Garçom a caminho',260,1480,1.7)},
 {d:2.2,bg:'light',html:brand()+H('Pronto. ✅',230,'s')+phone([['m3']],260,520)},
 END],
r4:[
 {d:3.0,html:brand()+H('Baixar app? <span class="x">✕</span>',420)+H('Fazer cadastro? <span class="x">✕</span>',600,'','data-in=".9"')+H('Criar senha? <span class="x">✕</span>',780,'','data-in="1.8"')+S('Pro seu cliente, nada disso.',1020,'','data-in="2.3"')},
 {d:2.8,bg:'light',html:`<div class="wood"></div>`+brand()+H('Só apontar<br>a <span class="o">câmera</span> 📷',230,'s')+plaque(300,640,480,'data-in=".2" data-base="rotate(-3deg)"')+tapA(540,1040,1.5)},
 {d:2.8,bg:'light',html:brand()+H('E abre direto<br>no <span class="o">navegador</span> ✓',230,'s')+phone([['m1'],['m2',1.8]],260,600,'data-in=".1"',tap(50,47,1.4))},
 END],
r5:[
 {d:2.4,html:brand()+H('Seu nome.',360,'c')+H('Seu logo.',500,'c','data-in=".5"')+H('<span class="o">Suas cores.</span>',640,'c','data-in="1.0"')},
 {d:3.6,html:brand()+H('O Acenai fica com<br>a <span class="o">cara da sua casa</span> 🎨',230,'c s')+phone([['c1'],['c2',.9],['c3',1.8],['m1',2.7]],260,600)+`<i data-pop=".9"></i><i data-pop="1.8"></i><i data-pop="2.7"></i>`},
 {d:2.8,bg:'light',html:brand()+H('Cada restaurante,<br><span class="o">do seu jeito.</span>',230,'c s')+phone([['c1']],-40,700,'data-in=".1" data-base="scale(.62) rotate(-8deg)"')+phone([['c3']],560,700,'data-in=".3" data-base="scale(.62) rotate(8deg)"')+phone([['c2']],260,640,'data-in=".5" data-base="scale(.68)"')},
 END],
r6:[
 {d:2.4,html:brand()+H('<span class="o">POV:</span>',320)+H('você é o dono e vê<br>o salão inteiro<br>de um lugar só 👀',470,'s','data-in=".4"')},
 {d:3.4,html:brand()+tablet('pa',40,300,'1,1.25','30% 50%')+pill('✓ Quem chamou',70,1080,.6)+pill('⏱️ Há quanto tempo',70,1200,1.2)+pill('🔔 Com alerta sonoro',70,1320,1.8)},
 {d:3.0,bg:'light',html:brand()+H('Relatórios de<br><span class="o">tempo de atendimento</span> 📊',230,'s')+tablet('re',40,620,'1,1.2','50% 30%')},
 {d:2.6,bg:'light',html:brand()+H('E a equipe com<br><span class="o">permissões</span> 👥',230,'s')+tablet('eq',40,620,'1,1.15','50% 40%')},
 END],
r7:[
 {d:3.2,html:brand()+H('Quanto tempo o seu<br>cliente espera…',260,'c s')+`<div class="hl c" style="top:560px;font-size:280px;color:#ffb020" data-timer="0,3.2,0,118" data-in="0">0:00</div>`+S('…só pra chamar o garçom?',900,'c','data-in=".6"')+`<div class="abs" style="left:420px;top:1060px" data-pop=".3"><div data-buzz=".5,3.2">${hand(240)}</div></div>`},
 {d:3.0,bg:'light',html:brand()+H('Com o Acenai:<br><span class="o">1 toque.</span>',230,'s')+phone([['m1'],['m2',1.4]],260,600,'data-in=".1"',tap(50,47,1.0))},
 {d:2.6,html:brand()+H('E a equipe vê<br><span class="o">na hora.</span> 🔔',230,'c s')+tablet('pa',40,700)},
 {d:2.2,bg:'light',html:brand()+H('Garçom<br><span class="o">a caminho</span> ✓',230,'s')+phone([['m3']],260,600)},
 END],
r8:[
 {d:3.0,bg:'light',html:`<div class="wood"></div>`+brand()+H('A plaquinha que<br><span class="o">chama o garçom</span>',230,'s')+plaque(300,640,480,'data-slide="0,-900,0,0,0,.7" data-base="rotate(-3deg)"')},
 {d:2.8,bg:'light',html:brand()+H('Logo e número da mesa<br><span class="o">dentro do QR</span>',230,'s')+`<div class="card" style="left:90px;top:560px;width:900px;transform-origin:50% 60%" data-zoom="1,1.25"><img src="${I.pl}"></div>`},
 {d:2.6,bg:'light',html:brand()+H('Aponta, toca,<br><span class="o">pronto</span> 👋',230,'s')+phone([['m1'],['m2',1.4]],260,600,'data-in=".1"',tap(50,47,1.0))},
 {d:2.8,html:`<div class="glow" style="left:90px;top:200px;width:900px;height:900px"></div>`+brand()+H('Planos a partir de',330,'c s')+H('<span class="o">R$ 99,90</span>',470,'c xl','data-pop=".3"')+S('por mês',650,'c')+S('A gente cuida da implantação 🤝',800,'c','data-in=".9"')},
 END],
r9:[
 {d:2.6,html:brand()+H('Sábado à noite.',380)+H('Casa <span class="o">cheia</span>. 🔥',520,'','data-in=".7"')+S('Três mesas chamando ao mesmo tempo…',720,'','data-in="1.3"')},
 {d:3.0,html:flash()+brand()+H('No relógio, a fila<br>em <span class="o">ordem de chegada</span>',240,'c s')+watch([[A_.wfila]],260,760)},
 {d:2.8,html:brand()+H('Demorou?<br>Fica <span class="x">vermelho</span>. ⏰',240,'c s')+`<div class="abs" style="left:0;top:0;width:1080px;height:1920px" data-buzz="0.3,1.8">${watch([[A_.watras]],260,760,'')}</div>`+ring(.2)},
 {d:2.6,bg:'light',html:brand()+H('E no caixa,<br>tudo no <span class="o">painel</span>',230,'s')+tablet(A_.dpainel,40,700,'1,1.5','30% 60%')},
 END],
r10:[
 {d:3.2,html:brand()+bubble('Ô, moço!','l',420,0)+bubble('Garçom!!','l',580,.7)+bubble('Por favooor… 🙋','l',740,1.4)+S('Soa familiar? 😅',1000,'c','data-in="2.1"')},
 {d:3.0,bg:'light',html:brand()+notif('Acenai · Mesa 12','Chamou o garçom',220,1.5)+phone([[A_.bmenu],[A_.bchamou,1.3]],260,600,'data-in=".1"',tap(50,47,.9))},
 {d:2.6,html:brand()+H('O garçom vê no<br><span class="o">celular</span> ou no relógio',230,'c s')+phone([[A_.mgarcom]],260,620)},
 {d:2.4,bg:'light',html:brand()+H('Sem gritar.<br><span class="o">Garçom a caminho</span> ✓',230,'s')+phone([[A_.bcaminho]],260,600)},
 END]};
// ===== Semana 2: salão ilustrado, karaokê, notebook, carimbo, divisão =====
const SK=['#f2c9a0','#c98b5e','#8a5636','#e8b48a'];
const face=(open)=>`<circle cx="84" cy="74" r="5" fill="#222"/><circle cx="116" cy="74" r="5" fill="#222"/>`+(open?`<ellipse cx="100" cy="98" rx="11" ry="13" fill="#7a2a1a"/>`:`<path d="M88 96 Q100 104 112 96" stroke="#222" stroke-width="4" fill="none" stroke-linecap="round"/>`);
// pessoa sentada (atrás da mesa). o = {x, shirt, skin, hair, wave:t, open}
const person=(o)=>{const sk=SK[o.skin||0];return `<div class="ppl" style="left:${o.x}px">
${o.wave!==undefined?`<div class="arm" style="background:${o.shirt}" data-wave="${o.wave}"><div style="position:absolute;left:2px;top:-30px;width:36px;height:40px;border-radius:50%;background:${sk}"></div></div>`:''}
<svg width="200" height="300" viewBox="0 0 200 300"><rect x="35" y="140" width="130" height="170" rx="55" fill="${o.shirt}"/><rect x="88" y="112" width="24" height="34" fill="${sk}"/>
<circle cx="100" cy="80" r="50" fill="${sk}"/><path d="M50 78 Q52 22 100 24 Q150 22 150 78 Q140 46 100 44 Q62 46 50 78Z" fill="${o.hair||'#2b1d14'}"/>${face(o.open)}</svg></div>`};
// garçom em pé; back=true de costas
const waiter=(x,top,back,attrs='')=>`<div class="waiter" style="left:${x}px;top:${top}px" ${attrs}><svg width="200" height="460" viewBox="0 0 200 460">
<rect x="62" y="300" width="30" height="150" rx="12" fill="#1a1a1a"/><rect x="108" y="300" width="30" height="150" rx="12" fill="#1a1a1a"/>
<rect x="40" y="130" width="120" height="190" rx="40" fill="#fff"/><rect x="52" y="160" width="96" height="170" rx="20" fill="#15171c"/>
<rect x="22" y="140" width="28" height="140" rx="14" fill="#fff"/><rect x="150" y="140" width="28" height="140" rx="14" fill="#fff"/>
<circle cx="100" cy="80" r="50" fill="#e8b48a"/>${back?`<path d="M50 84 Q48 24 100 26 Q152 24 150 84 Q150 120 100 122 Q50 120 50 84Z" fill="#2b1d14"/>`:`<path d="M50 70 Q54 22 100 24 Q146 22 150 70 Q130 46 100 46 Q70 46 50 70Z" fill="#2b1d14"/>${face(false)}<path d="M86 132 L100 142 L114 132" fill="#ffb020"/>`}</svg></div>`;
// salão: top = posição vertical; ppl = pessoas; extra = html adicional dentro do salão
const salao=(top,ppl,extra='',name='Brasa Grill',a='')=>`<div class="salao" style="top:${top}px" ${a}><div class="wall"></div>
<div class="win" style="left:60px"></div><div class="win" style="left:870px"></div><div class="lamp" style="left:250px"><i></i><b></b></div><div class="lamp" style="left:740px"><i></i><b></b></div>
<div class="sign" style="left:430px">${name}</div><div class="floor"></div>
${ppl.map(person).join('')}${[0,1,2].map(k=>`<div class="tbl" style="left:${50+k*360}px"><span class="tn">${[1,2,3][k]}</span></div>`).join('')}${extra}</div>`;
const bub2=(txt,x,y,t,a='')=>`<div class="bub2" style="left:${x}px;top:${y}px" data-pop="${t}" ${a}>${txt}</div>`;
// legenda karaokê: palavras acendem de t0 a t1; *palavra* = destaque laranja
const kara=(txt,top,t0,t1,size)=>`<div class="kara" style="top:${top}px;${size?`font-size:${size}px`:''}" data-kara="${t0},${t1}">${txt.split(' ').map(w=>w.startsWith('*')?`<span class="k">${w.replace(/\*/g,'')}</span>`:`<span>${w}</span>`).join(' ')}</div>`;
const laptop=(img,x,y,z='1,1.3',orig='30% 40%',a='data-in=".1"')=>`<div class="laptop" style="left:${x}px;top:${y}px" ${a}><div class="lid"><div class="scr"><img src="${img}" style="transform-origin:${orig}" data-zoom="${z}"></div></div><div class="base"></div></div>`;
const laptopSeq=(imgs,x,y,a='data-in=".1"')=>`<div class="laptop" style="left:${x}px;top:${y}px" ${a}><div class="lid"><div class="scr">${imgs.map(([s,sh])=>`<img src="${s}" ${sh!==undefined?`data-show="${sh}"`:''}>`).join('')}</div></div><div class="base"></div></div>`;
const stamp=(txt,cls,left,top,t,rot=-8)=>`<div class="stamp ${cls}" style="left:${left}px;top:${top}px" data-stamp="${t}" data-base="rotate(${rot}deg)">${txt}</div>`;
const lab=(txt,cls,left,top,t=0)=>`<div class="lab ${cls}" style="left:${left}px;top:${top}px" data-pop="${t}">${txt}</div>`;
const B2={brasaM:'ASSET:c-brasa-menu.jpg',brasaC:'ASSET:c-brasa-chamou.jpg',brasaW:'ASSET:c-brasa-caminho.jpg',anilM:'ASSET:c-anil-menu.jpg',anilC:'ASSET:c-anil-chamou.jpg',anilW:'ASSET:c-anil-caminho.jpg',
 b6m:'ASSET:c-bistro-6-menu.jpg',b6c:'ASSET:c-bistro-6-conta.jpg',horta:'ASSET:c-horta-caminho.jpg',vinho:'ASSET:c-vinho-caminho.jpg',garcom:'ASSET:m-painel-garcom.jpg',
 dpainel:'ASSET:d-painel.jpg',dmesas:'ASSET:d-mesas.jpg',dpers:'ASSET:d-personalizar.jpg',drel:'ASSET:d-relatorios.jpg',deq:'ASSET:d-equipe.jpg',dcard:'ASSET:d-cardapio.jpg',
 wconta:'ASSET:w-d-conta12.png',wcam12:'ASSET:w-g-caminho12.png'};
const P0={x:65,shirt:'#3b82f6',skin:3,hair:'#5a3a22'},P1={x:425,shirt:'#22a35a',skin:2,hair:'#1a1a1a'},P2={x:785,shirt:'#e0457b',skin:0,hair:'#7a4a22'};
const END2=(bg,cta='Peça sua demonstração')=>({d:2.6,bg,html:END.html.replace('Peça sua demonstração',cta)});
Object.assign(R,{
// n1: a mesa do canto (salão ilustrado + legenda karaokê; narração em N1_DUR)
n1:[
 {d:3.6,bg:'night',html:brand()+kara('Sabe aquela mesa lá do *canto*, que chama, chama… e *ninguém* vê?',230,0,3.0)+salao(720,[P0,P1,{...P2,wave:.2,open:1}],
   waiter(260,330,true,'data-slide="0,0,-330,0,0,3.4" data-walk="0,3.4"')+bub2('Moço!',700,170,.6)+bub2('Ei, aqui!!',640,80,1.8))},
 {d:3.0,bg:'night',html:brand()+kara('Com o *Acenai*, ela chama pelo *QR* *Code* da mesa.',230,0,2.2)+phone([[B2.brasaM],[B2.brasaC,1.9]],260,560,'data-in=".1"',tap(50,47,1.6))},
 {d:3.2,bg:'night',html:brand()+kara('O garçom recebe o *aviso* e vai direto na *mesa* *certa*.',230,0,2.4)+notif('Acenai · Mesa 3','Chamou o garçom',500,.2)+salao(720,[P0,P1,P2],
   waiter(80,330,false,'data-slide="0,0,560,0,.6,2.8" data-walk=".6,2.8"'))},
 {d:2.0,bg:'night',html:brand()+kara('*Garçom* *a* *caminho!* ✓',230,0,.9)+phone([[B2.brasaW]],260,480)},
 {...END2('night')}],
// n2: antes x depois (tela dividida)
n2:[
 {d:2.2,bg:'navy',html:brand()+lab('Antes','a',150,620,0)+lab('Depois','d',650,620,.5)+H('Chamar o garçom:<br><span class="o">antes x depois</span>',780,'c s','data-in=".2"')+`<div class="vline" style="top:600px;height:120px"></div>`},
 {d:3.6,bg:'navy',html:brand()+lab('Antes','a',100,240)+lab('Depois','d',640,240,.1)+`<div class="vline"></div>`+
   `<div class="abs" style="left:0;top:330px;width:540px;height:1500px;overflow:hidden"><div class="abs" style="left:-270px;top:0;transform:scale(1)">${salao(140,[{...P1,x:385+0,wave:.1,open:1}],bub2('Garçom!!',380,0,.4)+bub2('Ô, moço!',360,-90,1.4),'Sushi Anil')}</div>`+
   `<div class="sub c" style="left:20px;right:20px;top:1080px">Acenando e<br>esperando alguém ver</div><div class="abs" style="left:0;right:0;top:1260px;text-align:center;font:800 120px/1 B;color:#ff5a4f" data-timer="0,3.6,4,170">0:04</div></div>`+
   `<div class="phone" style="left:620px;top:360px;transform-origin:0 0" data-base="scale(.68)" data-in=".2"><div class="scr"><img src="${B2.anilM}"><img src="${B2.anilC}" data-show="1.6"></div></div>`+tapA(810,740,1.3)+
   `<div class="sub c" style="left:560px;right:20px;top:1240px" data-in="1.8">Um toque<br>no QR Code ✓</div>`},
 {d:3.2,bg:'navy',html:brand()+lab('Antes','a',100,240)+lab('Depois','d',640,240)+`<div class="vline"></div>`+
   `<div class="abs" style="left:40px;top:420px;width:460px;font:800 300px/1 B;text-align:center" data-pop=".1">🧾</div><div class="sub c" style="left:20px;right:560px;top:800px" data-in=".3">Pediu a conta…<br><span class="x" style="font-weight:800">e pediu de novo</span></div>`+
   `<div class="phone" style="left:620px;top:360px;transform-origin:0 0" data-base="scale(.68)" data-in=".2"><div class="scr"><img src="${B2.b6m}"><img src="${B2.b6c}" data-show="1.5"></div></div>`+tapA(681,1120,1.2)+
   `<div class="sub c" style="left:560px;right:20px;top:1240px" data-in="1.7">Botão<br>“Pedir a conta” ✓</div>`},
 {d:2.6,bg:'navy',html:brand()+lab('Depois','d',400,240)+H('O cliente <span class="o">vê</span><br>que já vem alguém',360,'c s','data-in=".1"')+phone([[B2.anilW]],260,640)},
 {...END2('navy')}],
// n3: mito x verdade
n3:[
 {d:2.2,bg:'green',html:brand()+H('Mito<br>ou<br><span class="o">verdade?</span>',560,'c xl','data-punch="0"')+`<div class="abs" style="left:0;right:0;top:1180px;text-align:center;font-size:200px" data-pop=".8">🤔</div>`},
 {d:3.4,bg:'green',html:brand()+`<div class="hl s" style="top:260px" data-in="0"><span class="strike" data-strike="1.0">“O Acenai substitui<br>o garçom.”</span></div>`+stamp('Mito','mito',520,480,.8)+
   S('Ele <b style="color:#7ee2a8">ajuda o garçom</b> a chegar na mesa certa, na hora certa.',700,'','data-in="1.4"')+`<div class="phone" style="left:300px;top:900px;transform-origin:0 0" data-base="scale(.8)" data-in="1.6"><div class="scr"><img src="${B2.horta}"></div></div>`},
 {d:3.4,bg:'green',html:brand()+`<div class="hl s" style="top:260px" data-in="0"><span class="strike" data-strike="1.0">“Precisa de<br>equipamento caro.”</span></div>`+stamp('Mito','mito',520,480,.8)+
   S('A central abre no <b style="color:#7ee2a8">navegador</b>: computador, tablet ou celular.',700,'','data-in="1.4"')+laptop(B2.dpainel,40,1000,'1,1.15','30% 40%','data-in="1.6" data-base="scale(.78)"')+
   `<div class="phone" style="left:760px;top:1060px;transform-origin:0 0" data-base="scale(.48)" data-in="1.9"><div class="scr"><img src="${B2.garcom}"></div></div>`},
 {d:3.0,bg:'green',html:brand()+H('“Dá pra pedir a<br>conta pelo QR.”',260,'s')+stamp('Verdade','verdade',420,480,.6,6)+phone([[B2.b6c]],260,700,'data-in="1.0"')},
 {...END2('green')}],
// n4: tour de 10 segundos pela central
n4:[
 {d:2.0,bg:'slate',html:brand()+H('Tour de <span class="o">10 segundos</span><br>pela central',520,'c','data-pop="0"')+S('do Acenai ⏱️',800,'c','data-in=".4"')+`<div class="cnt" style="top:96px" data-pop=".6">10</div>`},
 {d:10.0,bg:'slate',html:brand()+`<div class="cnt" style="top:96px" data-count="0,10,10,0">10</div>`+
   laptopSeq([[B2.dpainel],[B2.dmesas,2],[B2.dpers,4],[B2.drel,6],[B2.deq,8]],40,680)+
   ['Painel: fila em <span class="o">ordem de chegada</span>','Mesas e <span class="o">QR Codes</span> prontos','<span class="o">Suas cores</span> e seu logo','<span class="o">Relatórios</span> do atendimento','<span class="o">Equipe</span> com acessos'].map((t,k)=>`<div class="hl s c" style="top:400px" data-show="${k*2}" data-hide="${k*2+2}">${t}</div>`).join('')+
   [0,2,4,6,8].map(t=>`<div class="flash" data-flash="${t}" style="opacity:0"></div>`).join('').replace('data-flash="0"','data-flash="-1"')+
   ['🔔 Alerta sonoro no caixa','🖨️ Imprima as plaquinhas','🎨 Prévia na hora','📊 Tempo de resposta','👥 Garçom, caixa, gerente'].map((t,k)=>`<div class="pill" style="left:50%;top:1480px" data-base="translateX(-50%)" data-show="${k*2+.5}" data-hide="${k*2+2}">${t}</div>`).join('')},
 {...END2('slate')}],
// n5: POV o celular do garçom avisa
n5:[
 {d:3.0,bg:'wine',html:brand()+H('<span class="o">POV:</span> o celular<br>do garçom avisa 📱',230,'c s','data-in="0"')+`<div class="bigclock" style="top:520px" data-in=".1">21:40</div>`+S('sábado',760,'c','data-in=".1"')+
   notif('Acenai · Mesa 4','Chamou o garçom',920,.5).replace('data-slide="0,-500,0,0','data-buzz="0.5,1.0" data-slide="-1100,0,0,0')+notif('Acenai · Mesa 7','Pediu a conta',1100,1.3).replace('data-slide="0,-500,0,0','data-slide="1100,0,0,0')},
 {d:3.2,bg:'wine',html:brand()+H('Fila em ordem<br>de <span class="o">chegada</span>',230,'c s')+phone([[B2.garcom]],260,560,'data-in=".1"',tap(50,73.5,2.0))+pill('Mesa 4 primeiro ✓',300,450,2.3,'w')},
 {d:2.8,bg:'wine',html:brand()+H('E a mesa 4 já vê:<br><span class="o">garçom a caminho</span>',230,'c s')+phone([[B2.anilW]],260,560)},
 {d:2.2,bg:'wine',html:brand()+H('Sem relógio?',600,'c','data-punch="0"')+H('<span class="o">Funciona no celular.</span>',760,'c s','data-in=".5"')+S('O relógio é opcional ⌚',980,'c','data-in="1.0"')},
 {...END2('wine')}],
// n6: lista — 3 jeitos de pedir a conta
n6:[
 {d:3.4,bg:'orange',html:brand()+H('3 jeitos de<br>pedir a conta:',240,'s')+
   `<div class="li" style="top:560px" data-in=".4"><span class="strike" data-strike="2.4">1. Acenar até alguém ver 🙋</span></div>`+
   `<div class="li" style="top:720px" data-in=".9"><span class="strike" data-strike="2.7">2. Assinar no ar ✍️</span></div>`+
   `<div class="li" style="top:880px" data-in="1.4">3. <span style="color:#fff">Um toque no QR</span> 📱</div>`+`<div class="abs" style="left:380px;top:1120px" data-pop="3.0">${hand(320)}</div>`},
 {d:3.0,bg:'light',html:brand()+H('Toca em<br><span class="o">“Pedir a conta”</span>',230,'s')+phone([[B2.b6m],[B2.b6c,1.5]],260,600,'data-in=".1"',tap(16,92.6,1.2))},
 {d:3.0,bg:'dark',html:brand()+H('No relógio, a conta<br>chega <span class="o">em azul</span> 🧾',240,'c s')+`<div class="abs" style="left:0;top:0;width:1080px;height:1920px" data-buzz="0.2,1.6">${watch([[B2.wconta],[B2.wcam12,1.9]],260,760,'')}</div>`+ring(.1)+tapA(536,1144,1.6)},
 {d:2.4,bg:'light',html:brand()+H('E no caixa, aparece<br>na <span class="o">fila do painel</span>',230,'s')+laptop(B2.dpainel,40,700,'1,1.6','30% 62%')},
 {...END2('dark')}]
});
