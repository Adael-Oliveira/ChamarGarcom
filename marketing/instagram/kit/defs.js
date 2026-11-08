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
const notif=(title,body,top,t)=>`<div class="notif" style="top:${top}px" data-slide="0,-500,0,0,${t},${t+.45}"><div class="ic">${hand(70)}</div><div><b>${title}</b>${body}</div></div>`;
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
