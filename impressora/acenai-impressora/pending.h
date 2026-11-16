// Pedido esperando para ser impresso (fica num arquivo próprio por causa do Arduino)
#pragma once
#include <Arduino.h>

struct Pending {
  String path, id, updateTime;
  int64_t createdMs;
  int printCount;
};
