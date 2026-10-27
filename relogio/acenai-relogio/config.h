// =====================================================================
//  Acenai · Relógio de atendimento (LilyGO T-Watch S3)
//  Configuração. Normalmente não é preciso mudar nada aqui.
// =====================================================================
#pragma once

#define ACENAI_VERSION "1.0.0"

// Projeto do Firebase (os mesmos valores públicos do site acenai.com.br)
#define FIREBASE_API_KEY    "AIzaSyAQwZB04QYBtttFujfPsz7o8P5owV8E60Y"
#define FIREBASE_PROJECT_ID "chamar-garcom-33051"
// Enviado como "Referer" (caso a chave do Firebase aceite só o site)
#define ACENAI_SITE         "https://acenai.com.br/"

// De quantos em quantos segundos o relógio confere se alguma mesa chamou.
// 5 s ≈ 720 leituras por hora no Firebase (o plano gratuito tem 50 mil por dia).
#define POLL_SECONDS          5
// Repete vibração/som enquanto houver mesa esperando (como o som da central)
#define REMIND_SECONDS        20
// Mesa esperando há mais que isso fica vermelha (igual à central)
#define LATE_AFTER_MINUTES    3
// Tela apaga sozinha depois de tantos segundos sem mesa chamando
#define SCREEN_OFF_SECONDS    15
// Com mesa chamando, a tela fica acesa e diminui o brilho depois disso
#define DIM_AFTER_SECONDS     40
// Confere o próprio cadastro (nome, se ainda está conectado) a cada…
#define ACCESS_CHECK_SECONDS  60
// O código de conexão vale 15 min na central; o relógio troca antes disso
#define PAIR_CODE_SECONDS     (14 * 60)

// Rede que o relógio cria para configurar o Wi-Fi pelo celular
#define SETUP_AP_NAME         "Acenai-Relogio"

// Fuso horário de Brasília (sem horário de verão)
#define ACENAI_TZ             "<-03>3"
