// Substituto do LilyGoLib para o simulador (sem hardware).
#pragma once
#include "Arduino.h"
#include "lvgl.h"
#define POWER_EVENT 1
#define PMU_EVENT_KEY_CLICKED 7
struct DeviceEvent { int type; int code; };
namespace PowerEvent { enum : uint32_t { IRQ_PEKEY_CLICKED = 1 }; }
struct AudioOutputIf {
  bool open(int, int, int) { return true; }
  void setVolume(int) {}
  int write(const uint8_t *, size_t n) { return (int)n; }
};
struct FakeDrv { void setWaveform(uint8_t, uint8_t) {} void run() {} };
struct FakeWatch {
  FakeDrv drv;
  AudioOutputIf audio;
  int brightness = 0;
  void begin() {}
  void loop() {}
  void setBrightness(int b) { brightness = b; }
  void enablePowerEvent(uint32_t, bool) {}
  void onEvent(int, void (*)(const DeviceEvent &, void *)) {}
  int getPMUEventType(const DeviceEvent &e) { return e.code; }
  int getBatteryPercent() { return 78; }
  bool isCharging() { return false; }
  AudioOutputIf *getAudioOutput() { return &audio; }
};
extern FakeWatch instance;
