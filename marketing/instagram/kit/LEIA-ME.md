# Kit de conteúdo do Instagram (@acenai.br)

Ferramentas para produzir Reels, posts e stories do Acenai. Não faz parte do site (não é publicado).

## Como usar
- `engine.html` + `defs.js`: motor de animação dos Reels (1080x1920, 30 fps). Cada Reel é uma lista de cenas em `defs.js` (objeto `R`).
- `node rend.cjs r1` renderiza `out/r1.v.mp4` e `out/r1.json` (efeitos sonoros). `node rend.cjs r1 --frames 1,4` gera prévias JPG (`chk-*.jpg`). **Sempre olhe as prévias antes de renderizar.**
- `python mix.py r1 112 0` (args: id, bpm, transposição) gera trilha própria (`music.py`, sem direitos autorais) + efeitos e grava `out/r1.a.wav`; depois `ffmpeg -i out/r1.v.mp4 -i out/r1.a.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest out/r1.mp4`. Varie bpm (96–124) e transposição (-5..+5) a cada vídeo.
- `statics.js` + `stat.cjs`: posts de feed (1080x1350) e stories (1080x1920) em `out/*.jpg`.
- `plan.py`: calendário e legendas da semana 1 (modelo). No máximo 5 hashtags por post.
- Qualquer arquivo de `assets/` pode ser usado em `defs.js`/`statics.js` escrevendo a string `'ASSET:nome-do-arquivo.ext'` (vira imagem embutida). `phone()`, `watch()` e `tablet()` aceitam essas strings.

Requisitos: `npm ci` na raiz (fontes @fontsource-variable), Playwright com Chromium, ffmpeg, Python com numpy e soundfile.
Hospedagem para o Metricool: copiar as mídias para `public/instagram/semN/` e publicar; ficam em `https://acenai.com.br/instagram/semN/...`.

## Tipos de cena disponíveis (engine.html / defs.js)
Atributos de animação: `data-in` (entra subindo), `data-pop` (estoura), `data-out`, `data-show`/`data-hide` (troca de tela), `data-zoom="a,b"` (zoom lento), `data-slide="x0,y0,x1,y1,t0,t1"` (desliza), `data-buzz="t0,t1"` (vibra), `data-tap` (toque), `data-ring` (anel pulsando), `data-timer="t0,t1,v0,v1"` (cronômetro), `data-punch` (soco de zoom), `data-type="t0,t1"` (máquina de escrever), `data-strike` (risca o texto; use class `strike`), `data-grow="t0,t1"` + `data-h` (barra crescendo), `data-flash` (flash branco de transição).
Componentes: `phone()`, `tablet()`, `watch()`, `plaque()`, `H()` título, `S()` subtítulo, `pill()`, `tap()`, `ring()`, `notif()` (notificação do celular), `bubble()` (balão de conversa), `bars()` (gráfico de barras), `flash()`, `END` (cena final com chamada para demonstração). Fundos: `bg:'dark'|'light'|'orange'`.

## Catálogo de telas (assets/)
- Cliente no celular (Bistrô do Porto, mesa 5): `m-1-menu.png` (botão Chamar garçom), `m-2-chamando.png` (solicitação enviada), `m-3-caminho.png` (garçom a caminho). Mesa 6: `c-bistro-6-menu.jpg`, `c-bistro-6-conta.jpg` (pedido de conta enviado).
- Outras marcas (cliente): Brasa Grill mesa 3 (`c-brasa-menu/chamou/caminho.jpg`, `m-cor-Brasa.png`), Boteco da Esquina mesa 12 (`c-carvao-menu/chamou/caminho.jpg`), Sushi Anil mesa 4 (`c-anil-menu/chamou/caminho.jpg`), Empório Verde (`c-horta-caminho.jpg`, `m-cor-Horta.png`), Cantina Bella (`c-vinho-caminho.jpg`, `m-cor-Vinho.png`).
- Central no computador (Bistrô do Porto): `d-painel.jpg`, `d-mesas.jpg` (lista de mesas e QR), `d-cardapio.jpg`, `d-personalizar.jpg` (cores, logo e prévia), `d-configuracoes.jpg`, `d-relatorios.jpg`, `d-equipe.jpg` (com convite e oferta do relógio); antigas: `a-painel-nova.jpg`, `a-relatorios.jpg`, `a-equipe.jpg`.
- Central no celular do garçom: `m-painel-garcom.jpg`.
- Relógio (tela 240x240, use dentro de `watch()`): `w-a-espera.png` (espera), `w-b-chamada.png`/`w-b2-chamada.png` (mesa 5 chamando), `w-c-caminho.png` (mesa 5 a caminho), `w-d-conta12.png` (mesa 12 pediu a conta), `w-e-fila.png` (fila com 3 mesas), `w-f-atrasada.png` (mesa 8 atrasada, vermelho), `w-g-caminho12.png`; moldura `frame.png`.
- Plaquinhas QR: `plaquinha-5.png`, `plaquinha-7.png`.
Para capturar telas novas: build de demonstração (config Firebase vazia → `npx vite build --outDir <tmp>`; `npx vite preview --outDir <tmp> --port 4177`) e os scripts em `captura/` (dados de demonstração em localStorage `chamar-garcom:demo:v3`).

## Já usados (não repetir o mesmo roteiro)
Semana 1: r1 pediu a conta e ninguém viu · r2 relógio no pulso · r3 3 toques · r4 sem app/cadastro/senha · r5 suas cores · r6 POV dono · r7 quanto tempo espera · r8 a plaquinha. Feed: situações do dono, oferta do relógio, quanto custa, perguntas frequentes.
Prontos e ainda não publicados: r9 sábado lotado (fila e atraso no relógio), r10 "Ô, moço!" (balões de conversa + notificação).

## Banco de ideias de roteiro
Garçom no celular (sem relógio) · antes x depois (gritar "garçom!" x um toque) · "mesa esquecida" no canto do salão · checklist para o fim de semana · tour de 10 s pela central · personalizar em 3 cliques (cores/logo/estilo) · gerar e imprimir QR Codes das mesas · desativar uma mesa · relatório do dia (atendidas, tempo médio) · quem atendeu mais rápido (equipe) · alerta sonoro no caixa · pedido de conta com aviso diferente · intervalo entre chamadas (evita chamar várias vezes) · dúvida da semana respondida em 10 s · mito x verdade · "você sabia?" · bastidores da instalação (com vídeo real) · enquete em story · contagem regressiva para o sábado.
