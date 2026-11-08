# Kit de conteúdo do Instagram (@acenai.br)

Ferramentas para produzir Reels, posts e stories do Acenai. Não faz parte do site (não é publicado).

- `engine.html` + `defs.js`: motor de animação dos Reels (1080x1920, 30 fps). Cada Reel é uma lista de cenas em `defs.js` (objeto `R`).
- `node rend.cjs r1` renderiza `out/r1.v.mp4` e `out/r1.json` (efeitos sonoros). `node rend.cjs r1 --frames 1,4` gera prévias JPG.
- `python mix.py r1 112 0` gera trilha própria (`music.py`, sem direitos autorais) + efeitos e grava `out/r1.a.wav`; depois `ffmpeg -i out/r1.v.mp4 -i out/r1.a.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest out/r1.mp4`.
- `statics.js` + `stat.cjs`: posts de feed (1080x1350) e stories (1080x1920) em `out/*.jpg`.
- `plan.py`: calendário e legendas de uma semana (no máximo 5 hashtags por post).
- `assets/`: telas reais da plataforma em modo demonstração (mesa 5, Bistrô do Porto), plaquinha QR, telas do relógio.

Requisitos: `npm ci` na raiz (fontes @fontsource-variable), Playwright com Chromium, ffmpeg, Python com numpy e soundfile.

Hospedagem para o Metricool: copiar as mídias para `public/instagram/semN/` e publicar; ficam em `https://acenai.com.br/instagram/semN/...`.
