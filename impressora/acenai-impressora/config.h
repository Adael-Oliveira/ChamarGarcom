// =====================================================================
//  Acenai · Impressora da cozinha (ESP32 + impressora térmica Bluetooth)
//  Configuração. Normalmente não é preciso mudar nada aqui: a rede, a
//  impressora e a largura do papel são escolhidas pelo celular.
// =====================================================================
#pragma once

#define ACENAI_VERSION "1.0.0"

// Projeto do Firebase (os mesmos valores públicos do site acenai.com.br)
#define FIREBASE_API_KEY    "AIzaSyAQwZB04QYBtttFujfPsz7o8P5owV8E60Y"
#define FIREBASE_PROJECT_ID "chamar-garcom-33051"
#define ACENAI_SITE         "https://acenai.com.br/"

// De quantos em quantos segundos confere se chegou pedido novo.
// 5 s ≈ 17 mil leituras por dia, ligado 24 h (o plano gratuito do Firebase
// tem 50 mil por dia para tudo). Com o plano Blaze o custo é de centavos.
#define POLL_SECONDS          5
// Fora do horário de pedidos (nenhum pedido há muito tempo) consulta mais devagar
#define IDLE_POLL_SECONDS     15
#define IDLE_AFTER_MINUTES    30
// Confere o próprio cadastro (se ainda está conectada ao restaurante)
#define ACCESS_CHECK_SECONDS  120
// O código de conexão vale 15 min na central; a impressora troca antes disso
#define PAIR_CODE_SECONDS     (14 * 60)
// Pedido novo mais velho que isso não é impresso (ex.: impressora ficou dias desligada)
#define MAX_ORDER_AGE_HOURS   6

// Rede que a placa cria para configurar pelo celular
#define SETUP_AP_NAME         "Acenai-Impressora"
// Nome da placa no Bluetooth
#define BT_DEVICE_NAME        "Acenai-ESP32"
// PIN padrão das impressoras Bluetooth (quase todas usam 0000 ou 1234)
#define BT_DEFAULT_PIN        "0000"

// LED azul da placa (DevKit ESP32) e botão BOOT
#define LED_PIN               2
#define BUTTON_PIN            0

// Fuso horário de Brasília (sem horário de verão)
#define ACENAI_TZ             "<-03>3"
#define TZ_OFFSET_SECONDS     (-3 * 3600)
