# Acenai · Relógio de atendimento (LilyGO T-Watch S3)

O relógio vibra e apita quando uma mesa chama. Ele mostra a mesa, o motivo e há quanto tempo o cliente espera. Um toque em **Visualizado** registra o atendimento no nome do relógio, igual à central no computador: o relatório mostra quem atendeu, quando e qual mesa.

---

## 1. Gravar o programa no relógio (pelo navegador, sem instalar nada)

Você precisa do Google Chrome ou do Edge no computador e de um **cabo USB de dados**. Cabo só de carga não funciona.

1. Ligue o relógio no computador pelo cabo USB.
2. Abra **https://espressif.github.io/esptool-js/** no Chrome.
3. Em **Baudrate**, deixe `921600` e clique em **Connect**. Escolha a porta que aparecer (geralmente "USB JTAG/serial debug unit" ou "COM…").
4. Em **Flash Address**, deixe `0x0`. Em **Choose a file**, selecione o arquivo `acenai-relogio-v1.0.0.bin`.
5. Clique em **Program** e espere chegar a 100%.
6. Clique em **Disconnect** e reinicie o relógio. Para reiniciar, segure o botão lateral até desligar e depois aperte de novo.

**Se a porta não aparecer ou a gravação falhar:** coloque o relógio em modo de gravação.
1. Abra a tampa traseira.
2. Segure o botão **BOOT** e aperte o botão lateral por 1 segundo.
3. Solte o BOOT e tente de novo a partir do passo 3.

**Para atualizar uma versão nova sem perder o Wi-Fi e a conexão com o restaurante:** use o arquivo `…-atualizacao.bin` com **Flash Address** `0x10000`. O arquivo completo (`0x0`) apaga as configurações salvas e serve para a primeira gravação.

## 2. Primeira vez: Wi-Fi do restaurante

1. Ao ligar, o relógio mostra **Configurar Wi-Fi**.
2. No celular, entre na rede Wi-Fi **Acenai-Relogio**. A página de configuração abre sozinha. Se não abrir, acesse `192.168.4.1` no navegador.
3. Escolha a rede do restaurante, digite a senha e toque em **Salvar e conectar**.
4. O relógio reinicia e conecta.

Para trocar a rede depois: segure o dedo na tela de espera para abrir os **Ajustes**. Toque em **Trocar Wi-Fi** e confirme tocando de novo. Se o relógio estiver sem conexão, use o botão **Ajustes** que aparece na tela.

## 3. Conectar ao restaurante

1. Depois do Wi-Fi, o relógio mostra **Conectar ao restaurante** com um código de 6 números.
2. No computador ou tablet, a pessoa Responsável abre a central do Acenai em **Equipe → Relógio de atendimento**.
3. Ela digita o código e o nome que vai aparecer nos relatórios (ex.: *Relógio do dono*) e clica em **Conectar relógio**.
4. Em poucos segundos o relógio mostra a hora e **Nenhuma mesa chamando**. Pronto.

O código vale 15 minutos. Depois disso o relógio troca de código sozinho.

## 4. No dia a dia

| Situação | O que o relógio faz |
|---|---|
| Mesa chamou | Acende, vibra 3 vezes e apita. Âmbar = garçom, azul = conta, vermelho = esperando há mais de 3 min |
| Ninguém clicou em Visualizado | Lembra a cada 20 segundos, como o som da central |
| Várias mesas | Mostra a fila (a mais antiga primeiro). Toque na mesa para abrir |
| Na tela da mesa | Deslize para o lado para ver a próxima. Toque em "Fila" no alto para voltar |
| Toque em **Visualizado** | Tela verde "Mesa 7 a caminho". A chamada sai da fila do caixa e entra no relatório |
| Alguém atendeu antes pelo caixa | Aparece "Mesa 7 já atendida" |
| Sem mesa chamando | A tela apaga sozinha em 15 segundos. Toque na tela ou aperte o botão lateral para ver a hora |
| Botão lateral | Acende a tela. Na tela da mesa, volta para a fila |
| Segurar o dedo na tela de espera | Abre **Ajustes**: som, vibração, trocar Wi-Fi, desconectar |

**Bateria:** o Wi-Fi fica ligado o tempo todo para as chamadas chegarem na hora. Conte com algumas horas de uso, não um dia inteiro. Deixe um carregador por perto durante o expediente.

**Para desconectar um relógio** (perdeu, trocou de pessoa): na central, em **Equipe**, clique em **Remover** no relógio. Na hora ele volta a mostrar um código.

---

## 5. Para programadores: compilar pela Arduino IDE

Use este caminho só se quiser alterar o código.

1. **Placa:** Arduino IDE 2 com **esp32 by Espressif 3.3.0 ou mais novo**. URL de placas: `https://espressif.github.io/arduino-esp32/package_esp32_index.json`.
2. **Bibliotecas:**
   - [LilyGoLib](https://github.com/Xinyuan-LilyGO/LilyGoLib), em Sketch → Incluir biblioteca → Adicionar .ZIP.
   - As pastas de [LilyGoLib-ThirdParty](https://github.com/Xinyuan-LilyGO/LilyGoLib-ThirdParty), copiadas uma a uma para `Documentos/Arduino/libraries`. Elas incluem LVGL 9 e SensorLib.
   - **ArduinoJson 7**, pelo Gerenciador de Bibliotecas.
3. **Ferramentas:**
   - Placa **LilyGo T-Watch-S3**
   - USB CDC On Boot **Enabled**
   - Partition Scheme **16M Flash (3MB APP/9.9MB FATFS)**
   - Board Revision **Radio-SX1262**
4. Abra `acenai-relogio/acenai-relogio.ino` e clique em **Carregar**.

Ajustes como intervalo de consulta, tempo de tela e lembrete ficam em `config.h`.

### Como funciona

- **Login:** o relógio entra no Firebase com login anônimo e fica com uma conta própria.
- **Conexão ao restaurante:** o código de 6 números é gravado em `devicePairings/{código}`. Quando a pessoa Responsável digita o código, a central cria o cadastro do relógio na equipe, só com o atendimento das mesas, e apaga o código.
- **Chamadas:** a cada 5 segundos o relógio consulta as chamadas `PENDING` do restaurante pelo REST do Firestore.
- **Visualizado:** grava `status`, `viewedAt` (hora do servidor), `viewedBy` e `viewedByName`, com a mesma regra de segurança da central. Só grava se a chamada não mudou desde a última consulta, então não sobrescreve quem atendeu antes.
- **Testes do protocolo:** `tests/relogio.test.js`, no repositório do site.

### Simulador das telas

`simulador/` compila o mesmo `acenai-relogio.ino` no computador, com o LVGL de verdade, e gera as telas em imagens de 240×240. Assim dá para ajustar o layout sem gravar no relógio. Use `make LVGL=~/Arduino/libraries/lvgl && ./sim` e veja as imagens em `out/`. O arquivo `telas.png` mostra o resultado atual.

As fontes `acn_*.c` foram geradas a partir da Montserrat (SIL Open Font License) com acentos do português.
