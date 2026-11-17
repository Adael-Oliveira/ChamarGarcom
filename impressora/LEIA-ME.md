# Acenai · Impressora da cozinha (ESP32 + impressora térmica Bluetooth)

Quando o cliente faz um pedido pelo cardápio da mesa, a comanda sai sozinha na cozinha. A central mostra **Comanda impressa às 15:35** no card do pedido.

A comanda traz a **mesa em letra grande**, o número do pedido no dia (ex.: Pedido 12), a hora, os itens com quantidade, a opção escolhida (sabor, ponto…), a observação de cada item e a observação do pedido. Não traz preços: é para a cozinha.

> O relógio de atendimento continua sendo só para as chamadas de garçom. A impressora é um aparelho separado.

---

## O que comprar

| Peça | Observação |
|---|---|
| **ESP32 DevKit clássico** (ESP32-WROOM-32, "ESP32 Dev Module", 30 ou 38 pinos) | Precisa ser o ESP32 **clássico**. ESP32-S2, S3 e C3 **não** têm o Bluetooth que essas impressoras usam |
| **Impressora térmica Bluetooth** 58 mm ou 80 mm (ESC/POS) | As mini impressoras portáteis de 58 mm e as de balcão com Bluetooth funcionam. Evite as que só funcionam com aplicativo próprio (as "de etiqueta/foto" tipo gatinho) |
| Fonte USB 5 V e cabo USB de dados | A placa fica ligada o tempo todo, perto da impressora |

## 1. Gravar o programa na placa (pelo navegador)

1. Ligue a placa no computador pelo cabo USB.
2. Abra **https://espressif.github.io/esptool-js/** no Chrome ou no Edge.
3. Clique em **Connect** e escolha a porta (geralmente "CP210x" ou "CH340").
   - Se não aparecer porta nenhuma, instale o driver da placa (CP210x ou CH340, conforme o chip escrito perto do USB).
4. Em **Flash Address** deixe `0x0` e escolha o arquivo **`acenai-impressora-v1.0.1.bin`**.
5. Clique em **Program** e espere chegar a 100%.
   - Se ficar parado em "Connecting…", segure o botão **BOOT** da placa até começar.
6. Clique em **Disconnect** e aperte o botão **EN** (ou RST) da placa para reiniciar.

## 2. Configurar o Wi-Fi e a impressora (pelo celular)

1. **Ligue a impressora** e deixe perto da placa. Na primeira vez a placa procura as impressoras por uns 10 segundos.
2. O LED azul da placa pisca rápido. No celular, entre na rede Wi-Fi **Acenai-Impressora**. A página abre sozinha; se não abrir, acesse `192.168.4.1`.
3. Escolha a **rede do restaurante** (precisa ser 2,4 GHz) e digite a senha.
4. Escolha a **impressora** na lista. Se ela não aparecer, toque em **Procurar impressoras de novo**, ou digite o endereço (MAC) que aparece no autoteste da impressora.
5. Confira o **PIN** (quase sempre `0000`; algumas usam `1234`) e o **papel** (58 mm ou 80 mm).
6. Toque em **Salvar e conectar**. A placa reinicia.

## 3. Conectar ao restaurante

1. A impressora imprime um **código de 6 números**.
2. Na central do Acenai, a pessoa Responsável abre **Pedidos → Impressora da cozinha**, digita o código e um nome (ex.: *Cozinha*) e clica em **Conectar impressora**.
3. Em poucos segundos sai o papel **Conectada!**. Pronto: os próximos pedidos saem nela.

O código vale 15 minutos. Se passar disso, dê um toque no botão **BOOT** da placa para imprimir um código novo.

## 4. No dia a dia

| Situação | O que acontece |
|---|---|
| Cliente fez um pedido | A comanda sai em até 5 segundos (até 15 s se não houve pedido nos últimos 30 min) |
| "O caixa confirma cada pedido" ligado | A comanda só sai depois que alguém aprova o pedido na central |
| Clicou em **Reimprimir** na central | A comanda sai de novo, com **REIMPRESSÃO** em cima |
| Impressora desligada ou sem papel | O pedido espera. A placa tenta reconectar a cada 20 s e imprime quando a impressora voltar |
| Pedido de mais de 6 horas que nunca saiu | Não é impresso de repente (ex.: placa ficou desligada desde ontem) |
| Duas impressoras conectadas | Cada pedido sai em **uma** só (a primeira que pegar) |
| Responsável removeu a impressora em **Equipe** | Sai o aviso "Desconectada" e um código novo |

### LED azul da placa

| LED | Significa |
|---|---|
| Aceso direto | Tudo certo: Wi-Fi, restaurante e impressora conectados |
| Duas piscadas, pausa | Conectada ao restaurante, mas **a impressora não está conectada** (desligada, longe ou sem bateria) |
| Pisca devagar | Conectando no Wi-Fi |
| 1 s aceso, 1 s apagado | Esperando o código ser digitado na central |
| Pisca rápido | Modo de configuração (rede **Acenai-Impressora**) |
| Três piscadas, pausa | Erro de login no Firebase, ou restaurante pausado pela plataforma |

### Botão BOOT

- **Um toque:** imprime um teste (restaurante, Wi-Fi, papel e exemplo de acentos). Se ainda não conectou ao restaurante, imprime o código.
- **Segurar 5 segundos:** apaga o Wi-Fi e a impressora escolhidos e volta à configuração pelo celular. A conexão com o restaurante continua.

## Acentos

Por padrão a comanda sai **sem acentos** ("Feijao", "Pao"), porque cada impressora tem um jeito de imprimir acentos e algumas imprimem letras estranhas. Para tentar com acentos, segure o BOOT 5 s, marque **Imprimir acentos** na configuração e faça o teste (um toque no BOOT). Se sair errado, desmarque.

## Custo do Firebase

A placa consulta os pedidos a cada 5 segundos. Ligada 24 horas, são cerca de **17 mil leituras por dia**. O plano gratuito do Firebase tem 50 mil por dia para **tudo** (central, relógio, mesas). Com a impressora e um relógio ligados o dia todo, o plano gratuito fica apertado. O plano **Blaze** (pago por uso) custa poucos centavos por dia nesse volume.

## Para quem vai compilar

- Arduino IDE 2 ou `arduino-cli`, com **esp32 by Espressif 3.x** e a biblioteca **ArduinoJson 7**.
- Placa: **ESP32 Dev Module**. Partition Scheme: **Huge APP (3MB No OTA)** (Bluetooth + Wi-Fi + HTTPS não cabem no esquema padrão).

```sh
arduino-cli compile --fqbn esp32:esp32:esp32:PartitionScheme=huge_app --output-dir build acenai-impressora
# build/acenai-impressora.ino.merged.bin → gravar em 0x0
```

- A troca de dados com o Firestore (código, consulta, marcar impressa) é testada no emulador em `tests/impressora.test.js` com as mesmas requisições do firmware.
- `config.h` tem o intervalo de consulta, o tempo máximo de um pedido para ainda imprimir e os pinos do LED e do botão.
