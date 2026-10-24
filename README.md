# Chamar Garçom

Plataforma de chamada de garçom por QR Code, para qualquer restaurante.

- **Cliente:** aponta a câmera para o QR Code da mesa e toca em **Chamar garçom** ou **Pedir a conta**. Não precisa de aplicativo, cadastro ou Wi-Fi do restaurante.
- **Equipe:** a chamada entra na fila da central com som e cronômetro. Um clique em **Visualizado** avisa o cliente na hora.
- **Cada restaurante com a sua cara:** logo, nome, frase, cores e estilo configurados pela própria central, sem mexer em código.

Tecnologia: React + Vite (site estático no GitHub Pages) e Firebase (login Google, banco Firestore em tempo real e, opcionalmente, Storage para o cardápio em PDF).

---

## Sumário

1. [Experimentar agora (modo demonstração)](#1-experimentar-agora-modo-demonstração)
2. [Publicar no GitHub Pages](#2-publicar-no-github-pages)
3. [Ligar o Firebase](#3-ligar-o-firebase)
4. [Primeiro acesso](#4-primeiro-acesso)
5. [Uso no dia a dia](#5-uso-no-dia-a-dia)
6. [Rodar no computador](#6-rodar-no-computador)
7. [Como funciona por dentro](#7-como-funciona-por-dentro)
8. [Problemas comuns](#8-problemas-comuns)

---

## 1. Experimentar agora (modo demonstração)

Enquanto o Firebase não está configurado, o site funciona em **modo demonstração**: tudo opera normalmente, mas os dados ficam só no navegador de quem está usando. Aparece uma faixa amarela avisando.

| Página | Endereço |
|---|---|
| Início | `https://adael-oliveira.github.io/ChamarGarcom/` |
| Central do restaurante | `https://adael-oliveira.github.io/ChamarGarcom/admin/` |
| Testar como cliente (3 celulares lado a lado) | `https://adael-oliveira.github.io/ChamarGarcom/teste.html` |
| Página de uma mesa | `https://adael-oliveira.github.io/ChamarGarcom/mesa.html?id=TOKEN` |

Na demonstração já existe um restaurante de exemplo (“Bistrô do Porto”) com 8 mesas, algumas chamadas e histórico para os relatórios. Para voltar ao início: **Configurações → Recomeçar a demonstração**.

## 2. Publicar no GitHub Pages

O repositório já tem o workflow `.github/workflows/deploy.yml`, que gera e publica o site a cada `push` na branch `main`.

Uma única vez:

1. No GitHub, abra o repositório → **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **GitHub Actions**.
3. Vá em **Actions**, abra “Publicar no GitHub Pages” e clique em **Run workflow** (ou faça qualquer commit).

Em 1–2 minutos o site está em `https://adael-oliveira.github.io/ChamarGarcom/`.

> O endereço usa o nome do repositório. Se mudar o nome, o workflow se ajusta sozinho, mas os QR Codes já impressos apontam para o endereço antigo.

## 3. Ligar o Firebase

Leva uns 15 minutos. Tudo funciona no plano gratuito (Spark), exceto o envio de PDF do cardápio (veja o passo 3.6).

### 3.1 Criar o projeto

1. Acesse <https://console.firebase.google.com> → **Adicionar projeto** (ex.: `chamar-garcom`). O Google Analytics é opcional.
2. Na página do projeto, clique no ícone **Web `</>`**, dê um apelido (ex.: `site`) e **não** marque Firebase Hosting.
3. Aparece um bloco `firebaseConfig`. Deixe a página aberta; você vai copiar esses valores.

### 3.2 Colar a configuração no projeto

Abra o arquivo **`src/config/firebase.config.js`** no GitHub (ícone de lápis para editar) e preencha:

```js
export default {
  apiKey: 'AIza...',
  authDomain: 'chamar-garcom.firebaseapp.com',
  projectId: 'chamar-garcom',
  storageBucket: 'chamar-garcom.firebasestorage.app',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abc123',
};
```

Clique em **Commit changes**. O site é publicado de novo sozinho, agora usando o Firebase.

> Esses valores são **públicos por natureza**: vão para o navegador de qualquer jeito. Quem protege os dados são as regras de segurança (passo 3.5). Não há senha nem chave privada no projeto.
>
> Prefere não deixar no código? Cadastre os mesmos valores como *secrets* do repositório (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`) em **Settings → Secrets and variables → Actions**. Eles têm prioridade sobre o arquivo.

### 3.3 Ativar o login com Google

1. **Build → Authentication → Vamos começar**.
2. Aba **Sign-in method → Google → Ativar**, escolha o e-mail de suporte e salve.
3. Aba **Settings → Authorized domains → Add domain**: `adael-oliveira.github.io`.

### 3.4 Criar o banco (Firestore)

1. **Build → Firestore Database → Criar banco de dados**.
2. Local: **`southamerica-east1 (São Paulo)`**. Não dá para mudar depois.
3. Modo: **produção**.

Não precisa criar nada dentro. O app cria tudo, inclusive o primeiro administrador.

### 3.5 Publicar as regras de segurança

1. **Firestore Database → Regras**: apague tudo, cole o conteúdo do arquivo [`firestore.rules`](firestore.rules) e clique em **Publicar**.

Sem este passo nada funciona (aparece “Sem permissão”). Sempre que o arquivo mudar, publique de novo.

Pela linha de comando, se preferir: `cp .firebaserc.example .firebaserc` (coloque o ID do projeto), `npx firebase login` e `npm run deploy:rules`.

### 3.6 (Opcional) Cardápio em PDF no Storage

Desde fevereiro de 2026 o Cloud Storage do Firebase exige o **plano Blaze** (cartão cadastrado; um cardápio fica dentro da cota gratuita). Sem ele, use a opção **“Ou usar um link”** na tela Cardápio (Google Drive, Dropbox, Instagram, site), que funciona no plano gratuito.

Para ativar: **Build → Storage → Vamos começar**, depois **Storage → Regras**: cole [`storage.rules`](storage.rules) e publique. O console pede permissão para o Storage consultar o Firestore: aceite.

> O **logo** do restaurante não usa o Storage: ele é reduzido no navegador e salvo no próprio Firestore. Funciona no plano gratuito.

## 4. Primeiro acesso

1. Abra `https://adael-oliveira.github.io/ChamarGarcom/admin/` e entre com Google.
2. Como é a primeira conta, aparece **“Vamos configurar a plataforma”**. Digite o nome do restaurante e clique em **Criar restaurante**. Você vira o responsável pelo restaurante e dono da plataforma.
3. Pronto: não é preciso criar nada à mão no console do Firebase.

Depois disso, quem entrar com uma conta Google sem acesso vê a propaganda **“Quer o Chamar Garçom no seu restaurante?”**, com os seus contatos e o formulário **Quero minha ferramenta**. Nada do restaurante fica visível para essa pessoa.

## 4.1 Administração da plataforma (só o dono)

Endereço: `https://adael-oliveira.github.io/ChamarGarcom/plataforma/` (ou **Plataforma** no menu da central). Qualquer outra conta vê “Área restrita”.

| Tela | Para que serve |
|---|---|
| **Clientes** | Todos os restaurantes. **Liberar novo cliente**: nome + e-mail Google do dono → cria o restaurante e o convite de **Responsável**, e copia a mensagem para mandar no WhatsApp. **Abrir central** entra no restaurante em **modo suporte** (faixa azul). **Detalhes**: equipe, convites, editar, convidar responsável, **Pausar acesso** / **Reativar**. |
| **Interessados** | Pedidos do formulário “Quero minha ferramenta” (site e tela de quem entra sem acesso), em tempo real. Situação (Novo, Em contato, Virou cliente, Arquivado), botão de WhatsApp e **Liberar como cliente** já preenchido. |
| **Contatos e cadastros** | WhatsApp, e-mail e Instagram mostrados no site e para quem entra sem acesso. E o cadastro aberto de novos restaurantes (deixe **Fechado**: só entra quem você liberar). |

Restaurante **pausado**: a equipe vê “Acesso pausado” com os seus contatos e as mesas não recebem chamadas. Nada é apagado; **Reativar** volta tudo.

## 5. Uso no dia a dia

| Tela | Para que serve |
|---|---|
| **Painel** | Fila de chamadas (mais antiga primeiro, com cronômetro; fica vermelha depois de 3 min) e o mapa das mesas. Liga/desliga as chamadas. |
| **Mesas** | Criar (uma ou várias), ativar/desativar, editar, gerar novo link (invalida um QR fotografado), excluir. QR Code com a marca do restaurante em PNG e folha A4 para imprimir. **Testar como cliente** abre 3 celulares simulados. |
| **Cardápio** | PDF (Storage) ou link. Aparece no botão “Ver cardápio” da mesa. |
| **Personalizar** | Logo, nome, frase, cores (6 combinações prontas ou cor livre) e estilo (Moderno, Clássico, Leve), com pré-visualização ao vivo do celular do cliente. Só o responsável. |
| **Relatórios** | Hoje, ontem, 7 dias, 30 dias ou datas escolhidas. Tempo médio, mais rápido, mais demorado. Exporta CSV para Excel. |
| **Equipe** | Convida pessoas pelo e-mail da conta Google. A pessoa entra em `/admin/` e aceita o convite. Só o responsável. |
| **Configurações** | Chamadas on/off, botão “Pedir a conta”, intervalo entre chamadas, som, tema claro/escuro. |

## 6. Rodar no computador

Requer Node.js 20.19+ (recomendado 22).

```bash
npm install
npm run dev          # http://localhost:5173  (modo demonstração se o Firebase estiver vazio)
npm run build        # gera dist/
npm run preview      # testa o build
```

**Testar pelo celular na mesma rede Wi-Fi:** crie `.env.local` com `VITE_PUBLIC_APP_URL=http://IP-DO-PC:5173/` (o `npm run dev` mostra o IP em *Network*), reinicie e gere o QR de novo.

**Emuladores do Firebase (sem tocar no projeto real, requer Java 11+):**

```bash
npm run emulators                         # terminal 1
VITE_USE_EMULATORS=true npm run dev       # terminal 2
```

**Testes das regras de segurança:** `npm run test:rules` (60 verificações: cadastro, convites, marca, cliente, intervalo no servidor, equipe, administração da plataforma, pausa, interessados).

## 7. Como funciona por dentro

```
index.html / admin/ / plataforma/ / mesa.html / teste.html / 404.html   ← páginas
src/
├── config/firebase.config.js   ← cole aqui a configuração do Firebase
├── lib/
│   ├── env.js                  ← decide Firebase × demonstração, URLs
│   ├── api/firebase.js         ← todo acesso ao Firebase
│   ├── api/demo.js             ← mesma interface, dados no navegador
│   └── theme/                  ← marca → cores com contraste garantido; logo reduzido
├── shared/                     ← modelo de dados, formatação, componentes
├── client/TableView.jsx        ← tela da mesa (usada no site e na pré-visualização)
├── admin/                      ← central: login, cadastro, convite e as 7 telas
├── platform/                   ← administração da plataforma: clientes, interessados, contatos
├── landing/                    ← página inicial e 404
└── test/                       ← simulador de celulares
firestore.rules · storage.rules · tests/rules.test.js · tests/platform.test.js
```

**Dados no Firestore**

```
platform/config                         dono da plataforma, cadastros abertos?
platform/public                         seus contatos (público)
leads/{id}                              interessados (qualquer um cria; só você lê)
admins/{uid}                            restaurantId, role (owner | staff)
invites/{email}                         convites pendentes
tableLinks/{token}                      token do QR → mesa  (público: só leitura por token)
restaurants/{rid}                       nome, dono, pausado?, observações
  settings/general                      chamadas, conta, intervalo, cardápio  (público)
  settings/brand                        nome, frase, logo, cores, estilo      (público)
  tables/{id}                           mesas                                 (só equipe)
  tableState/{id}                       última chamada da mesa (intervalo)
  calls/{id}                            chamadas: motivo, horários, status
```

**Segurança (resumo):** o cliente não faz login e só consegue ler a mesa pelo token, ler a marca, criar uma chamada válida e acompanhar a própria chamada. Não lista mesas nem chamadas. O **intervalo entre chamadas é conferido no servidor** (a chamada só é aceita junto com a atualização de `tableState`, e a regra recusa antes do tempo), então burlar o cronômetro do navegador não adianta. A equipe só enxerga o próprio restaurante; marca e equipe só o responsável altera; ninguém se promove a administrador. O dono da plataforma enxerga todos (suporte), e só ele pausa/reativa um restaurante.

**Preparado para:** ESP32 com matriz LED (ouvir `calls` com `status == "PENDING"` usando uma conta de serviço/dispositivo), servidor de licenças (campo no `restaurants/{rid}` conferido nas regras), cardápio digital e pedidos (novas coleções sob `restaurants/{rid}`).

## 8. Problemas comuns

| O que aparece | Causa | Solução |
|---|---|---|
| Faixa “Modo demonstração” no site publicado | `firebase.config.js` vazio ou commit não publicado | Preencha o arquivo (3.2) e confira em **Actions** se o deploy terminou |
| “Este endereço não está autorizado no Firebase” | Domínio fora da lista | Authentication → Settings → Authorized domains (3.3) |
| “O login com Google não está ativado” | Provedor desligado | Authentication → Sign-in method → Google |
| “Sem permissão” em qualquer tela | Regras não publicadas | Passo 3.5 |
| “Esta conta ainda não tem acesso” | Conta sem convite | O responsável convida pela tela Equipe usando exatamente esse e-mail |
| Cliente: “Mesa não encontrada” | Link antigo (novo link gerado ou mesa excluída) | Imprima o QR atual |
| Cliente: “Não foi possível chamar agora” | Intervalo ainda correndo no servidor, chamadas desligadas ou mesa desativada | Aguarde; confira Configurações |
| Envio de PDF falha | Storage não ativado (exige Blaze) | Use a opção de link ou ative o Storage (3.6) |
| Som não toca | Navegador bloqueia áudio antes de um clique | Clique uma vez em qualquer lugar da central; teste em Configurações |
| Site em branco / 404 nos arquivos | Pages não está em “GitHub Actions” | Passo 2 |
