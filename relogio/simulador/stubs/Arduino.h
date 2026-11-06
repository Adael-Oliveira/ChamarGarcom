// Substitutos mínimos do Arduino para rodar as telas do relógio no PC.
#pragma once
#include <cstdint>
#include <cstring>
#include <cstdio>
#include <cmath>
#include <ctime>
#include <initializer_list>
#ifndef PI
#define PI 3.14159265358979f
#endif
extern uint32_t g_fake_millis;
inline uint32_t millis() { return g_fake_millis; }
inline void delay(uint32_t ms) { g_fake_millis += ms; }
struct FakeSerial {
  void begin(int) {}
  template <typename... A> void printf(const char *f, A... a) { (void)f; }
  void println(const char *) {}
};
extern FakeSerial Serial;
#include <cstdlib>
#define MALLOC_CAP_SPIRAM 1
#define MALLOC_CAP_8BIT 2
inline void *heap_caps_malloc(size_t n, int) { return malloc(n); }
typedef void (*TaskFunction_t)(void *);
inline int xTaskCreate(TaskFunction_t, const char *, int, void *, int, void *) { return 1; }  // sem som no simulador
inline void vTaskDelete(void *) {}
