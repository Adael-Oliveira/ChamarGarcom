// Estado dividido entre a tarefa de rede (núcleo 0) e a tela (núcleo 1).
// A tela só lê uma cópia (snapshot) e manda pedidos pela fila de comandos.
#pragma once
#include <Arduino.h>

#define MAX_CALLS 16

struct CallItem {
  char path[200];       // caminho completo do documento no Firestore
  char id[40];
  int table;
  bool bill;            // true = pediu a conta
  int64_t calledAtMs;   // horário da chamada (epoch, ms)
  char updateTime[40];  // para o Visualizado não sobrescrever quem já atendeu
};

enum class NetState : uint8_t {
  Boot,          // ligando
  WifiPortal,    // esperando configurar o Wi-Fi pelo celular
  WifiConnecting,
  SigningIn,     // entrando no Firebase
  Pairing,       // mostrando o código para conectar ao restaurante
  Ready,         // conectado e recebendo chamadas
  NoAccess,      // foi removido da equipe
  Paused,        // restaurante pausado pela plataforma
  Error,         // erro de configuração (ex.: login anônimo desligado)
};

enum class AckResult : uint8_t { None, Ok, AlreadyTaken, Failed };

struct Snapshot {
  NetState state;
  bool online;            // última consulta deu certo
  uint32_t version;       // muda sempre que algo muda
  CallItem calls[MAX_CALLS];
  int nCalls;
  int64_t serverOffsetMs; // horário do servidor = millis() + offset
  bool haveServerTime;
  char pairCode[8];
  uint32_t pairStartedMs;
  char restaurant[64];
  char myName[48];
  char message[96];       // texto de erro/ajuda para a tela
  // resultado do último Visualizado feito no relógio
  AckResult ack;
  int ackTable;
  uint32_t ackSeq;
};

enum class CmdType : uint8_t { Ack, Unpair, WifiReset, PollNow };

struct Command {
  CmdType type;
  char path[200];
  char updateTime[40];
  int table;
};

// net.cpp
void netStart();
void netGetSnapshot(Snapshot &out);
bool netSend(const Command &c);
int64_t netNowMs(const Snapshot &s);  // horário atual (epoch ms), pelo servidor ou NTP
