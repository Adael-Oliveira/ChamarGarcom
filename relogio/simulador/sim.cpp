// Simulador das telas do relógio: compila o mesmo acenai-relogio.ino com o
// LVGL real e salva cada tela em PPM 240x240.
#include "Arduino.h"
#include "LilyGoLib.h"
#include "LV_Helper.h"
#include "shared.h"
#include <string>

uint32_t g_fake_millis = 1000;
FakeSerial Serial;
FakeWatch instance;

static Snapshot g_snap;
static uint16_t fb[240 * 240];

void netStart() {}
void netGetSnapshot(Snapshot &o) { memcpy(&o, &g_snap, sizeof(Snapshot)); }
bool netSend(const Command &) { return true; }
int64_t netNowMs(const Snapshot &s) { return s.haveServerTime ? (int64_t)millis() + s.serverOffsetMs : 0; }

static void flush_cb(lv_display_t *d, const lv_area_t *a, uint8_t *px) {
  uint16_t *p = (uint16_t *)px;
  for (int y = a->y1; y <= a->y2; y++)
    for (int x = a->x1; x <= a->x2; x++) fb[y * 240 + x] = *p++;
  lv_display_flush_ready(d);
}
static uint32_t tick_cb() { return g_fake_millis; }
static uint8_t drawbuf[240 * 240 * 2];
void beginLvglHelper(FakeWatch &) {
  lv_init();
  lv_tick_set_cb(tick_cb);
  lv_display_t *d = lv_display_create(240, 240);
  lv_display_set_color_format(d, LV_COLOR_FORMAT_RGB565);
  lv_display_set_flush_cb(d, flush_cb);
  lv_display_set_buffers(d, drawbuf, nullptr, sizeof(drawbuf), LV_DISPLAY_RENDER_MODE_FULL);
}

#include "../acenai-relogio/acenai-relogio.ino"

static void save(const char *name) {
  for (int i = 0; i < 6; i++) { g_fake_millis += 40; loop(); lv_refr_now(NULL); }
  std::string path = std::string("out/") + name + ".ppm";
  FILE *f = fopen(path.c_str(), "wb");
  fprintf(f, "P6 240 240 255\n");
  for (int i = 0; i < 240 * 240; i++) {
    uint16_t c = fb[i];
    uint8_t rgb[3] = {(uint8_t)(((c >> 11) & 31) * 255 / 31), (uint8_t)(((c >> 5) & 63) * 255 / 63), (uint8_t)((c & 31) * 255 / 31)};
    fwrite(rgb, 1, 3, f);
  }
  fclose(f);
}

static void addCall(int table, bool bill, int secsAgo, const char *id) {
  CallItem &c = g_snap.calls[g_snap.nCalls++];
  memset(&c, 0, sizeof c);
  snprintf(c.id, sizeof c.id, "%s", id);
  snprintf(c.path, sizeof c.path, "projects/x/databases/(default)/documents/restaurants/toca/calls/%s", id);
  c.table = table;
  c.bill = bill;
  c.calledAtMs = (int64_t)millis() + g_snap.serverOffsetMs - secsAgo * 1000LL;
}
static void bump() { g_snap.version++; }

int main() {
  const int64_t NOW = 1793061300000LL;  // 26/10/2026 21:35 em Brasília
  memset(&g_snap, 0, sizeof g_snap);
  g_snap.state = NetState::WifiPortal;
  setup();
  save("1-wifi");

  g_snap.state = NetState::Pairing; strcpy(g_snap.pairCode, "482913"); bump(); save("2-codigo");

  g_snap.state = NetState::Ready; g_snap.online = true; g_snap.haveServerTime = true;
  g_snap.serverOffsetMs = NOW - (int64_t)millis();
  strcpy(g_snap.restaurant, "Toca da Tilápia"); strcpy(g_snap.myName, "Relógio do dono");
  bump(); save("3-espera");

  addCall(7, true, 42, "c7"); bump(); save("4-mesa-conta");

  g_snap.nCalls = 0; addCall(4, false, 190, "c4"); addCall(7, true, 42, "c7"); addCall(12, false, 8, "c12"); bump(); save("5-fila");

  strlcpy(selectedId, "c4", sizeof selectedId); userPickedCall = true; showScreen(Scr::Call); save("6-mesa-atrasada");

  g_snap.nCalls = 0; addCall(7, true, 42, "c7"); addCall(12, false, 8, "c12");
  g_snap.ack = AckResult::Ok; g_snap.ackTable = 4; g_snap.ackSeq = 1; bump(); save("7-confirmado");

  g_snap.ack = AckResult::AlreadyTaken; g_snap.ackTable = 7; g_snap.ackSeq = 2; bump(); save("8-ja-atendida");

  g_fake_millis += 5000; showScreen(Scr::Settings); save("9-ajustes");

  cur = Scr::None; g_snap.nCalls = 0; g_snap.online = false; bump(); g_fake_millis += 5000; route(); save("10-sem-conexao");
  return 0;
}
