A="#acenai #restaurante #donoderestaurante #atendimento #qrcode"
B="#acenai #gastronomia #bar #garcom #tecnologiapararestaurantes"
C="#acenai #restaurantes #foodservice #atendimentoaocliente #empreendedorismo"
L="\n\n"
P=[
("s1","2026-11-09T08:30:00","STORY",["s1.jpg"],""),
("r1","2026-11-09T10:00:00","REEL",["r1.mp4"],"Pediu a conta… e ninguém viu? 🙋"+L+"Com o Acenai, o cliente pede pelo QR Code da mesa e a chamada chega na hora no caixa, com som e cronômetro."+L+"Sem levantar a mão. Sem esperar o garçom olhar."+L+"👉 Peça sua demonstração pelo link na bio"+L+A),
("f1","2026-11-09T12:30:00","POST",["f1-1.jpg","f1-2.jpg","f1-3.jpg","f1-4.jpg","f1-5.jpg"],"Qual dessas já aconteceu no seu restaurante? 😅"+L+"🙋 O cliente acenando e o garçom de costas\n🧾 Pediu a conta duas vezes\n🏃 Garçom correndo sem saber qual mesa chamou"+L+"Com o Acenai, o cliente chama pelo QR Code, o caixa vê qual mesa e há quanto tempo, e o garçom vai direto na mesa certa."+L+"Conta pra gente nos comentários 👇"+L+C),
("r2","2026-11-09T18:30:00","REEL",["r2.mp4"],"E se a chamada vibrasse no pulso do garçom? ⌚"+L+"Com o relógio Acenai, o garçom sente na hora qual mesa chamou. Um toque em \"visualizado\" e o cliente já vê: garçom a caminho."+L+"Opcional · R$ 597 ou 3x de R$ 199 sem juros · entregue instalado e funcionando."+L+"👉 Saiba mais pelo link na bio"+L+B),
("s2","2026-11-11T09:00:00","STORY",["s2.jpg"],""),
("r3","2026-11-11T11:00:00","REEL",["r3.mp4"],"Do QR Code ao garçom em 3 toques 👆"+L+"1️⃣ O cliente aponta a câmera\n2️⃣ Toca em \"Chamar garçom\"\n3️⃣ A equipe toca em \"Visualizado\""+L+"Pronto: o cliente já sabe que o garçom está a caminho. ✅"+L+"👉 Link na bio para ver funcionando"+L+A),
("f2","2026-11-11T13:00:00","POST",["f2.jpg"],"A chamada no pulso do garçom ⌚"+L+"O relógio Acenai vibra quando uma mesa chama. Um toque e o cliente já vê que o garçom está a caminho."+L+"💰 R$ 597 por relógio, ou 3x de R$ 199 sem juros\n🔧 Entregue instalado e funcionando"+L+"É opcional: o Acenai funciona completo sem ele."+L+"👉 Saiba mais pelo link na bio"+L+B),
("r4","2026-11-11T19:00:00","REEL",["r4.mp4"],"Baixar app? ❌ Fazer cadastro? ❌ Criar senha? ❌"+L+"Pro seu cliente, chamar o garçom com o Acenai é só apontar a câmera para o QR Code da mesa. Abre direto no navegador."+L+"Quanto menos atrito, mais gente usa. 😉"+L+"👉 Peça sua demonstração pelo link na bio"+L+C),
("s3","2026-11-13T08:00:00","STORY",["s3.jpg"],""),
("r5","2026-11-13T10:30:00","REEL",["r5.mp4"],"Seu nome. Seu logo. Suas cores. 🎨"+L+"No Acenai, a página da mesa fica com a cara do seu restaurante. O cliente vê a sua marca."+L+"👉 Quer ver com a sua marca? Link na bio"+L+B),
("f3","2026-11-13T17:00:00","POST",["f3-1.jpg","f3-2.jpg","f3-3.jpg"],"Quanto custa o Acenai? 💰"+L+"• Essencial: R$ 99,90/mês (até 10 mesas)\n• Profissional: R$ 149,90/mês (até 30 mesas)\n• Avançado: R$ 249,90/mês (até 60 mesas + cardápio)"+L+"Implantação: R$ 297, pagamento único. A gente cuida de tudo."+L+"👉 Peça sua demonstração pelo link na bio"+L+A),
("r6","2026-11-13T20:00:00","REEL",["r6.mp4"],"POV: você é o dono e vê o salão inteiro de um lugar só 👀"+L+"✓ Quem chamou e há quanto tempo\n🔔 Alerta sonoro no caixa\n📊 Relatórios de tempo de atendimento\n👥 Equipe com permissões"+L+"👉 Peça sua demonstração pelo link na bio"+L+A),
("s4","2026-11-15T10:00:00","STORY",["s4.jpg"],""),
("r7","2026-11-15T11:30:00","REEL",["r7.mp4"],"Quanto tempo o seu cliente espera só pra chamar o garçom? ⏱️"+L+"Com o Acenai é 1 toque no QR Code da mesa, e a equipe vê na hora."+L+"Comenta aqui: qual foi a maior espera que você já viu num restaurante? 👇"+L+C),
("f4","2026-11-15T16:00:00","POST",["f4-1.jpg","f4-2.jpg","f4-3.jpg","f4-4.jpg"],"Perguntas que todo mundo faz sobre o Acenai 🤔"+L+"Arrasta pro lado e confere as respostas. Ficou alguma dúvida? Comenta aqui que a gente responde! 👇"+L+C),
("r8","2026-11-15T18:00:00","REEL",["r8.mp4"],"A plaquinha que chama o garçom 👋"+L+"Cada mesa ganha um QR Code com a logo do Acenai e o número da mesa. O cliente aponta, toca e pronto."+L+"Planos a partir de R$ 99,90/mês, e a gente cuida da implantação."+L+"👉 Link na bio"+L+B),
]
import json;json.dump(P,open('plan.json','w'),ensure_ascii=False)
for p in P: assert p[4].count('#')<=5,p[0]
print(len(P))
