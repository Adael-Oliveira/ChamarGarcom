// =====================================================================
//  Acenai · Relógio de atendimento
//  LilyGO T-Watch S3 (ESP32-S3) · Arduino-ESP32 3.3+ · LilyGoLib · LVGL 9
//
//  O relógio recebe as chamadas das mesas (vibra e apita) e o Visualizado
//  é feito no pulso: fica registrado no relatório quem atendeu, quando e
//  em qual mesa, igual à central no computador.
//
//  Passo a passo para gravar: veja LEIA-ME.md
// =====================================================================
#include <LilyGoLib.h>
#include <LV_Helper.h>
#include <Preferences.h>
#include "config.h"
#include "shared.h"
#include "boot_logo.h"

LV_FONT_DECLARE(acn_16);
LV_FONT_DECLARE(acn_20);
LV_FONT_DECLARE(acn_28);
LV_FONT_DECLARE(acn_num_56);
LV_FONT_DECLARE(acn_num_92);
LV_FONT_DECLARE(acn_logo_44);

// ---------------------------------------------------------------- cores
#define C_BLACK      0x0B0B0B
#define C_TEXT       0xF1EFE8
#define C_MUTED      0xB4B2A9
#define C_DIM        0x888780
#define C_CARD       0x2C2C2A
struct Tone { uint32_t bg, strong, text, muted; };
static const Tone T_WAIT  = {0x412402, 0xEF9F27, 0xFAEEDA, 0xFAC775};  // chamou o garçom
static const Tone T_BILL  = {0x042C53, 0x378ADD, 0xE6F1FB, 0xB5D4F4};  // pediu a conta (azul, como na central)
static const Tone T_LATE  = {0x501313, 0xE24B4A, 0xFCEBEB, 0xF7C1C1};  // esperando demais
static const Tone T_OK    = {0x173404, 0x639922, 0xEAF3DE, 0xC0DD97};
static const Tone T_GRAY  = {0x2C2C2A, 0x5F5E5A, 0xF1EFE8, 0xB4B2A9};

#define BRIGHT_FULL  200
#define BRIGHT_DIM   40

// ---------------------------------------------------------------- estado da tela
enum class Scr { None, Message, Idle, Call, Queue, Done, Settings };
static Scr cur = Scr::None;
static Snapshot S;                // cópia do estado da rede
static uint32_t shownVersion = 0xFFFFFFFF;
static char selectedId[40] = "";  // chamada aberta na tela "Mesa"
static char ackPendingId[40] = ""; // Visualizado enviado, esperando resposta
static bool userPickedCall = false;
static uint32_t doneUntil = 0, lastAckSeq = 0, lastRemind = 0, lastTick = 0;
static bool asleep = false, dimmed = false, keyClicked = false;
static char seenIds[MAX_CALLS][40];
static int nSeen = 0;
static bool soundOn = true, vibeOn = true;
static int confirmWhat = 0;       // 1 = trocar Wi-Fi, 2 = desconectar
static Preferences uiPrefs;

static lv_obj_t *bootScr = nullptr;
static lv_obj_t *scrMsg, *scrIdle, *scrCall, *scrQueue, *scrDone, *scrSet, *wakeLayer;
// mensagem
static lv_obj_t *msgTitle, *msgBig, *msgBody, *msgBtn;
// espera
static lv_obj_t *idleWifi, *idleBatt, *idleClock, *idleDate, *idleStatus, *idleStatusLbl, *idleFoot;
// mesa
static lv_obj_t *callTop, *callElapsed, *callMesa, *callNum, *callReason, *callBtn, *callBtnLbl;
// fila
static lv_obj_t *queueTitle, *queueClock, *queueRows[4], *queueNum[4], *queueReason[4], *queueTime[4], *queueHint;
// confirmado
static lv_obj_t *doneCircle, *doneIcon, *doneTitle, *doneSub;
// ajustes
static lv_obj_t *setSound, *setVibe, *setWifi, *setUnpair, *setInfo;

// ---------------------------------------------------------------- utilidades de tela
static lv_obj_t *newScreen(uint32_t bg) {
  lv_obj_t *s = lv_obj_create(NULL);
  lv_obj_set_style_bg_color(s, lv_color_hex(bg), 0);
  lv_obj_set_style_bg_opa(s, LV_OPA_COVER, 0);
  lv_obj_remove_flag(s, LV_OBJ_FLAG_SCROLLABLE);
  return s;
}
static lv_obj_t *newLabel(lv_obj_t *parent, const lv_font_t *font, uint32_t color, const char *text = "") {
  lv_obj_t *l = lv_label_create(parent);
  lv_obj_set_style_text_font(l, font, 0);
  lv_obj_set_style_text_color(l, lv_color_hex(color), 0);
  lv_label_set_text(l, text);
  return l;
}
static void setBg(lv_obj_t *o, uint32_t c) { lv_obj_set_style_bg_color(o, lv_color_hex(c), 0); }
static void setColor(lv_obj_t *o, uint32_t c) { lv_obj_set_style_text_color(o, lv_color_hex(c), 0); }
static lv_obj_t *newBox(lv_obj_t *parent, uint32_t bg, int w, int h, int radius = 10) {
  lv_obj_t *b = lv_obj_create(parent);
  lv_obj_set_size(b, w, h);
  lv_obj_set_style_bg_color(b, lv_color_hex(bg), 0);
  lv_obj_set_style_bg_opa(b, LV_OPA_COVER, 0);
  lv_obj_set_style_border_width(b, 0, 0);
  lv_obj_set_style_radius(b, radius, 0);
  lv_obj_set_style_pad_all(b, 0, 0);
  lv_obj_remove_flag(b, LV_OBJ_FLAG_SCROLLABLE);
  return b;
}
static lv_obj_t *newButton(lv_obj_t *parent, uint32_t bg, uint32_t fg, const lv_font_t *font, const char *text, lv_obj_t **lblOut = nullptr) {
  lv_obj_t *b = lv_button_create(parent);
  lv_obj_set_style_bg_color(b, lv_color_hex(bg), 0);
  lv_obj_set_style_shadow_width(b, 0, 0);
  lv_obj_set_style_radius(b, 10, 0);
  lv_obj_t *l = newLabel(b, font, fg, text);
  lv_obj_center(l);
  if (lblOut) *lblOut = l;
  return b;
}

static const Tone &toneOf(const CallItem &c, int64_t now) {
  if (now && now - c.calledAtMs > LATE_AFTER_MINUTES * 60000LL) return T_LATE;
  return c.bill ? T_BILL : T_WAIT;
}
static void fmtElapsed(char *out, size_t n, int64_t ms) {
  if (ms < 0) ms = 0;
  long s = ms / 1000;
  if (s >= 3600) snprintf(out, n, "%ldh%02ld", s / 3600, (s % 3600) / 60);
  else snprintf(out, n, "%ld:%02ld", s / 60, s % 60);
}
static bool localTime(struct tm &t) {
  int64_t now = netNowMs(S);
  if (!now) return false;
  time_t secs = (time_t)(now / 1000) - 3 * 3600;  // Brasília
  gmtime_r(&secs, &t);
  return true;
}
static int findCall(const char *id) {
  for (int i = 0; i < S.nCalls; i++) if (strcmp(S.calls[i].id, id) == 0) return i;
  return -1;
}

// ---------------------------------------------------------------- som e vibração
static int16_t beepBuf[22050 / 8];  // 125 ms a 22,05 kHz
static AudioOutputIf *audioOut = nullptr;

static void initSound() {
  audioOut = instance.getAudioOutput();
  if (!audioOut) return;
  audioOut->open(16, 1, 22050);
  audioOut->setVolume(90);
  const int n = sizeof(beepBuf) / sizeof(beepBuf[0]);
  for (int i = 0; i < n; i++) {
    float env = i < 200 ? i / 200.0f : (i > n - 400 ? (n - i) / 400.0f : 1.0f);  // sem estalo
    beepBuf[i] = (int16_t)(16000 * env * sinf(2 * PI * 1760.0f * i / 22050.0f));
  }
}
static void beep(int times) {
  if (!soundOn || !audioOut) return;
  for (int i = 0; i < times; i++) audioOut->write((const uint8_t *)beepBuf, sizeof(beepBuf));
}
static void buzz(int times) {
  if (!vibeOn) return;
  uint8_t slot = 0;
  for (int i = 0; i < times && slot < 7; i++) {
    instance.drv.setWaveform(slot++, 47);                       // vibração forte
    if (i < times - 1 && slot < 7) instance.drv.setWaveform(slot++, 0x80 | 18);  // pausa de 180 ms
  }
  instance.drv.setWaveform(slot, 0);
  instance.drv.run();
}

// ---------------------------------------------------------------- tela acesa/apagada
static void wake() {
  asleep = false;
  dimmed = false;
  lv_obj_add_flag(wakeLayer, LV_OBJ_FLAG_HIDDEN);
  instance.setBrightness(BRIGHT_FULL);
  lv_display_trigger_activity(NULL);
}
static void screenOff() {
  asleep = true;
  lv_obj_remove_flag(wakeLayer, LV_OBJ_FLAG_HIDDEN);  // o primeiro toque só acende a tela
  instance.setBrightness(0);
}

// ---------------------------------------------------------------- telas: construção
static void sendCmd(CmdType t, const CallItem *c = nullptr) {
  Command cmd = {};
  cmd.type = t;
  if (c) {
    strlcpy(cmd.path, c->path, sizeof(cmd.path));
    strlcpy(cmd.updateTime, c->updateTime, sizeof(cmd.updateTime));
    cmd.table = c->table;
  }
  netSend(cmd);
}

static void showScreen(Scr s);
static void route();

static void onLongPressIdle(lv_event_t *) { confirmWhat = 0; showScreen(Scr::Settings); }

static void buildMessage() {
  scrMsg = newScreen(C_BLACK);
  msgTitle = newLabel(scrMsg, &acn_20, C_TEXT);
  lv_obj_set_width(msgTitle, 220);
  lv_obj_set_style_text_align(msgTitle, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_align(msgTitle, LV_ALIGN_TOP_MID, 0, 12);
  msgBig = newLabel(scrMsg, &acn_num_56, 0xEF9F27);
  lv_obj_align(msgBig, LV_ALIGN_TOP_MID, 0, 50);
  msgBody = newLabel(scrMsg, &acn_16, C_MUTED);
  lv_label_set_long_mode(msgBody, LV_LABEL_LONG_WRAP);
  lv_obj_set_width(msgBody, 216);
  lv_obj_set_style_text_align(msgBody, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_align(msgBody, LV_ALIGN_TOP_MID, 0, 128);
  msgBtn = newButton(scrMsg, C_CARD, C_TEXT, &acn_16, "Ajustes");
  lv_obj_set_size(msgBtn, 120, 34);
  lv_obj_align(msgBtn, LV_ALIGN_BOTTOM_MID, 0, -8);
  lv_obj_add_event_cb(msgBtn, [](lv_event_t *) { confirmWhat = 0; showScreen(Scr::Settings); }, LV_EVENT_CLICKED, NULL);
}

static void buildIdle() {
  scrIdle = newScreen(C_BLACK);
  idleWifi = newLabel(scrIdle, &lv_font_montserrat_16, 0x97C459, LV_SYMBOL_WIFI);
  lv_obj_align(idleWifi, LV_ALIGN_TOP_LEFT, 12, 8);
  idleBatt = newLabel(scrIdle, &acn_16, C_MUTED, "");
  lv_obj_align(idleBatt, LV_ALIGN_TOP_RIGHT, -12, 8);
  idleClock = newLabel(scrIdle, &acn_num_56, C_TEXT, "--:--");
  lv_obj_align(idleClock, LV_ALIGN_TOP_MID, 0, 40);
  idleDate = newLabel(scrIdle, &acn_16, C_MUTED, "");
  lv_obj_align(idleDate, LV_ALIGN_TOP_MID, 0, 104);
  idleStatus = newBox(scrIdle, T_OK.bg, 212, 40);
  lv_obj_align(idleStatus, LV_ALIGN_TOP_MID, 0, 140);
  idleStatusLbl = newLabel(idleStatus, &acn_16, T_OK.muted, "Nenhuma chamada");
  lv_obj_center(idleStatusLbl);
  idleFoot = newLabel(scrIdle, &acn_16, C_DIM, "");
  lv_label_set_long_mode(idleFoot, LV_LABEL_LONG_DOT);
  lv_obj_set_size(idleFoot, 216, 20);
  lv_obj_set_style_text_align(idleFoot, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_align(idleFoot, LV_ALIGN_BOTTOM_MID, 0, -12);
  lv_obj_add_event_cb(scrIdle, onLongPressIdle, LV_EVENT_LONG_PRESSED, NULL);
}

static void onAck(lv_event_t *) {
  int i = findCall(selectedId);
  if (i < 0) { route(); return; }
  if (strcmp(ackPendingId, selectedId) == 0) return;  // já enviado
  strlcpy(ackPendingId, selectedId, sizeof ackPendingId);
  lv_obj_add_state(callBtn, LV_STATE_DISABLED);
  lv_label_set_text(callBtnLbl, "Enviando…");
  sendCmd(CmdType::Ack, &S.calls[i]);
}
static void onCallGesture(lv_event_t *) {
  if (S.nCalls < 2) return;
  lv_dir_t dir = lv_indev_get_gesture_dir(lv_indev_active());
  int i = findCall(selectedId);
  if (i < 0) i = 0;
  if (dir == LV_DIR_LEFT) i = (i + 1) % S.nCalls;
  else if (dir == LV_DIR_RIGHT) i = (i + S.nCalls - 1) % S.nCalls;
  else return;
  strlcpy(selectedId, S.calls[i].id, sizeof(selectedId));
  userPickedCall = true;
  showScreen(Scr::Call);
}

static void buildCall() {
  scrCall = newScreen(T_WAIT.bg);
  callTop = newLabel(scrCall, &acn_16, T_WAIT.muted, "Nova chamada");
  lv_obj_align(callTop, LV_ALIGN_TOP_LEFT, 12, 8);
  callElapsed = newLabel(scrCall, &acn_16, T_WAIT.muted, "0:00");
  lv_obj_align(callElapsed, LV_ALIGN_TOP_RIGHT, -12, 8);
  callMesa = newLabel(scrCall, &acn_16, T_WAIT.muted, "Mesa");
  lv_obj_align(callMesa, LV_ALIGN_TOP_MID, 0, 30);
  callNum = newLabel(scrCall, &acn_num_92, T_WAIT.text, "0");
  lv_obj_align(callNum, LV_ALIGN_TOP_MID, 0, 58);
  callReason = newLabel(scrCall, &acn_20, T_WAIT.text, "Chamou o garçom");
  lv_obj_align(callReason, LV_ALIGN_TOP_MID, 0, 152);
  callBtn = newButton(scrCall, T_WAIT.strong, T_WAIT.bg, &acn_20, "Visualizado", &callBtnLbl);
  lv_obj_set_size(callBtn, 224, 50);
  lv_obj_align(callBtn, LV_ALIGN_BOTTOM_MID, 0, -8);
  lv_obj_add_event_cb(callBtn, onAck, LV_EVENT_CLICKED, NULL);
  lv_obj_add_event_cb(scrCall, onCallGesture, LV_EVENT_GESTURE, NULL);
  lv_obj_add_event_cb(callTop, [](lv_event_t *) { if (S.nCalls > 1) { userPickedCall = false; showScreen(Scr::Queue); } }, LV_EVENT_CLICKED, NULL);
  lv_obj_add_flag(callTop, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_ext_click_area(callTop, 12);
}

static void onQueueRow(lv_event_t *e) {
  int i = (int)(intptr_t)lv_event_get_user_data(e);
  if (i >= S.nCalls) return;
  strlcpy(selectedId, S.calls[i].id, sizeof(selectedId));
  userPickedCall = true;
  showScreen(Scr::Call);
}

static void buildQueue() {
  scrQueue = newScreen(C_BLACK);
  queueTitle = newLabel(scrQueue, &acn_16, C_MUTED, "Fila");
  lv_obj_align(queueTitle, LV_ALIGN_TOP_LEFT, 12, 8);
  queueClock = newLabel(scrQueue, &acn_16, C_MUTED, "");
  lv_obj_align(queueClock, LV_ALIGN_TOP_RIGHT, -12, 8);
  for (int i = 0; i < 4; i++) {
    lv_obj_t *r = lv_button_create(scrQueue);
    lv_obj_set_size(r, 224, 42);
    lv_obj_align(r, LV_ALIGN_TOP_MID, 0, 34 + i * 47);
    lv_obj_set_style_radius(r, 9, 0);
    lv_obj_set_style_shadow_width(r, 0, 0);
    lv_obj_set_style_pad_hor(r, 10, 0);
    lv_obj_add_event_cb(r, onQueueRow, LV_EVENT_CLICKED, (void *)(intptr_t)i);
    queueNum[i] = newLabel(r, &acn_28, C_TEXT, "");
    lv_obj_align(queueNum[i], LV_ALIGN_LEFT_MID, 0, 0);
    queueReason[i] = newLabel(r, &acn_16, C_TEXT, "");
    lv_obj_align(queueReason[i], LV_ALIGN_LEFT_MID, 58, 1);
    queueTime[i] = newLabel(r, &acn_16, C_TEXT, "");
    lv_obj_align(queueTime[i], LV_ALIGN_RIGHT_MID, 0, 1);
    queueRows[i] = r;
  }
  queueHint = newLabel(scrQueue, &acn_16, C_DIM, "Toque para atender");
  lv_obj_align(queueHint, LV_ALIGN_BOTTOM_MID, 0, -6);
}

static void buildDone() {
  scrDone = newScreen(T_OK.bg);
  doneCircle = newBox(scrDone, T_OK.strong, 56, 56, LV_RADIUS_CIRCLE);
  lv_obj_align(doneCircle, LV_ALIGN_TOP_MID, 0, 34);
  doneIcon = newLabel(doneCircle, &lv_font_montserrat_28, T_OK.bg, LV_SYMBOL_OK);
  lv_obj_center(doneIcon);
  doneTitle = newLabel(scrDone, &acn_20, T_OK.text, "");
  lv_obj_set_width(doneTitle, 224);
  lv_obj_set_style_text_align(doneTitle, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_align(doneTitle, LV_ALIGN_TOP_MID, 0, 108);
  doneSub = newLabel(scrDone, &acn_16, T_OK.muted, "");
  lv_label_set_long_mode(doneSub, LV_LABEL_LONG_WRAP);
  lv_obj_set_width(doneSub, 216);
  lv_obj_set_style_text_align(doneSub, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_align(doneSub, LV_ALIGN_TOP_MID, 0, 142);
}

static void refreshSettingsLabels() {
  lv_label_set_text(lv_obj_get_child(setSound, 0), soundOn ? "Som: ligado" : "Som: desligado");
  lv_label_set_text(lv_obj_get_child(setVibe, 0), vibeOn ? "Vibração: ligada" : "Vibração: desligada");
  lv_label_set_text(lv_obj_get_child(setWifi, 0), confirmWhat == 1 ? "Toque de novo p/ confirmar" : "Trocar Wi-Fi");
  lv_label_set_text(lv_obj_get_child(setUnpair, 0), confirmWhat == 2 ? "Toque de novo p/ confirmar" : "Desconectar relógio");
  setBg(setUnpair, confirmWhat == 2 ? 0xA32D2D : C_CARD);
  setBg(setWifi, confirmWhat == 1 ? 0x854F0B : C_CARD);
  char info[140];
  snprintf(info, sizeof info, "%s%s%s · %d%%%s · v" ACENAI_VERSION, S.myName[0] ? S.myName : "Relógio", S.restaurant[0] ? " · " : "", S.restaurant,
           (int)lroundf(instance.getBatteryPercent()), instance.isCharging() ? " carregando" : "");
  lv_label_set_text(setInfo, info);
}

static void buildSettings() {
  scrSet = newScreen(C_BLACK);
  lv_obj_add_flag(scrSet, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_flex_flow(scrSet, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_flex_align(scrSet, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
  lv_obj_set_style_pad_all(scrSet, 8, 0);
  lv_obj_set_style_pad_row(scrSet, 6, 0);
  auto item = [](const char *t) {
    lv_obj_t *b = newButton(scrSet, C_CARD, C_TEXT, &acn_16, t);
    lv_obj_set_size(b, 224, 38);
    return b;
  };
  setSound = item("");
  lv_obj_add_event_cb(setSound, [](lv_event_t *) {
    soundOn = !soundOn; uiPrefs.putBool("sound", soundOn); confirmWhat = 0; refreshSettingsLabels(); beep(1);
  }, LV_EVENT_CLICKED, NULL);
  setVibe = item("");
  lv_obj_add_event_cb(setVibe, [](lv_event_t *) {
    vibeOn = !vibeOn; uiPrefs.putBool("vibe", vibeOn); confirmWhat = 0; refreshSettingsLabels(); buzz(1);
  }, LV_EVENT_CLICKED, NULL);
  setWifi = item("");
  lv_obj_add_event_cb(setWifi, [](lv_event_t *) {
    if (confirmWhat == 1) { sendCmd(CmdType::WifiReset); return; }
    confirmWhat = 1; refreshSettingsLabels();
  }, LV_EVENT_CLICKED, NULL);
  setUnpair = item("");
  lv_obj_add_event_cb(setUnpair, [](lv_event_t *) {
    if (confirmWhat == 2) { sendCmd(CmdType::Unpair); confirmWhat = 0; showScreen(Scr::Message); return; }
    confirmWhat = 2; refreshSettingsLabels();
  }, LV_EVENT_CLICKED, NULL);
  lv_obj_t *back = item("Voltar");
  setBg(back, 0x5F5E5A);
  lv_obj_add_event_cb(back, [](lv_event_t *) { confirmWhat = 0; cur = Scr::None; route(); }, LV_EVENT_CLICKED, NULL);
  setInfo = newLabel(scrSet, &acn_16, C_DIM, "");
  lv_label_set_long_mode(setInfo, LV_LABEL_LONG_WRAP);
  lv_obj_set_width(setInfo, 220);
  lv_obj_set_style_text_align(setInfo, LV_TEXT_ALIGN_CENTER, 0);
}

static void buildWakeLayer() {
  wakeLayer = lv_obj_create(lv_layer_top());
  lv_obj_set_size(wakeLayer, LV_PCT(100), LV_PCT(100));
  lv_obj_set_style_bg_opa(wakeLayer, LV_OPA_TRANSP, 0);
  lv_obj_set_style_border_width(wakeLayer, 0, 0);
  lv_obj_add_flag(wakeLayer, (lv_obj_flag_t)(LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_HIDDEN));
  lv_obj_add_event_cb(wakeLayer, [](lv_event_t *) { wake(); }, LV_EVENT_PRESSED, NULL);
}

// ---------------------------------------------------------------- telas: atualização
static void fillMessage() {
  const char *title = "", *big = "", *body = S.message;
  char code[10];
  bool btn = false;
  switch (S.state) {
    case NetState::Boot: title = "Acenai"; body = "Ligando…"; break;
    case NetState::WifiPortal:
      title = "Configurar Wi-Fi";
      body = "No celular, entre na rede " SETUP_AP_NAME ". A página abre sozinha (ou acesse 192.168.4.1).";
      break;
    case NetState::WifiConnecting:
      title = strncmp(body, "Erro C", 6) == 0 ? "Tire uma foto" : "Conectando ao Wi-Fi";
      if (!body[0]) body = "Aguarde um instante.";
      btn = true;
      break;
    case NetState::SigningIn: title = "Entrando no Acenai"; if (!body[0]) body = "Aguarde um instante."; btn = true; break;
    case NetState::Pairing:
      title = "Conectar relógio";
      if (S.pairCode[0]) { snprintf(code, sizeof code, "%.3s %.3s", S.pairCode, S.pairCode + 3); big = code; }
      if (!body[0]) body = "Na central: Equipe > Relógio de atendimento.";
      btn = true;
      break;
    case NetState::Paused: title = "Acesso pausado"; btn = true; break;
    case NetState::NoAccess: title = "Relógio desconectado"; btn = true; break;
    case NetState::Error: title = "Não foi possível entrar"; btn = true; break;
    default: break;
  }
  lv_label_set_text(msgTitle, title);
  lv_label_set_text(msgBig, big);
  lv_label_set_text(msgBody, body);
  lv_obj_align(msgBody, LV_ALIGN_TOP_MID, 0, big[0] ? 118 : 56);
  if (btn) lv_obj_remove_flag(msgBtn, LV_OBJ_FLAG_HIDDEN); else lv_obj_add_flag(msgBtn, LV_OBJ_FLAG_HIDDEN);
}

static void fillIdle() {
  static const char *dias[] = {"dom", "seg", "ter", "qua", "qui", "sex", "sáb"};
  static const char *meses[] = {"jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"};
  struct tm t;
  if (localTime(t)) {
    lv_label_set_text_fmt(idleClock, "%02d:%02d", t.tm_hour, t.tm_min);
    lv_label_set_text_fmt(idleDate, "%s, %d %s", dias[t.tm_wday], t.tm_mday, meses[t.tm_mon]);
  }
  setColor(idleWifi, S.online ? 0x97C459 : 0xE24B4A);
  lv_label_set_text_fmt(idleBatt, "%d%%%s", (int)lroundf(instance.getBatteryPercent()), instance.isCharging() ? " +" : "");
  if (!S.online) {
    setBg(idleStatus, T_LATE.bg);
    setColor(idleStatusLbl, T_LATE.muted);
    lv_label_set_text(idleStatusLbl, "Sem conexão. Tentando…");
  } else {
    setBg(idleStatus, T_OK.bg);
    setColor(idleStatusLbl, T_OK.muted);
    lv_label_set_text(idleStatusLbl, "Nenhuma chamada");
  }
  lv_label_set_text(idleFoot, S.restaurant[0] ? S.restaurant : S.myName);
}

static void fillCall() {
  int i = findCall(selectedId);
  if (i < 0) return;
  const CallItem &c = S.calls[i];
  int64_t now = netNowMs(S);
  const Tone &k = toneOf(c, now);
  setBg(scrCall, k.bg);
  for (lv_obj_t *l : {callTop, callElapsed, callMesa}) setColor(l, k.muted);
  setColor(callNum, k.text);
  setColor(callReason, k.text);
  setBg(callBtn, k.strong);
  setColor(callBtnLbl, k.bg == T_LATE.bg || k.bg == T_BILL.bg ? 0xFFFFFF : k.bg);
  if (S.nCalls > 1) lv_label_set_text_fmt(callTop, "Fila · %d de %d", i + 1, S.nCalls);
  else lv_label_set_text(callTop, "Nova chamada");
  char el[16];
  fmtElapsed(el, sizeof el, now ? now - c.calledAtMs : 0);
  lv_label_set_text(callElapsed, el);
  lv_label_set_text_fmt(callNum, "%d", c.table);
  lv_label_set_text(callReason, c.bill ? "Pediu a conta" : "Chamou o garçom");
  if (!lv_obj_has_state(callBtn, LV_STATE_DISABLED)) lv_label_set_text(callBtnLbl, "Visualizado");
}

static void fillQueue() {
  int64_t now = netNowMs(S);
  lv_label_set_text_fmt(queueTitle, "Fila · %d mesas", S.nCalls);
  struct tm t;
  if (localTime(t)) lv_label_set_text_fmt(queueClock, "%02d:%02d", t.tm_hour, t.tm_min);
  int shown = S.nCalls > 4 ? 3 : S.nCalls;
  for (int i = 0; i < 4; i++) {
    lv_obj_t *r = queueRows[i];
    if (i < shown) {
      const CallItem &c = S.calls[i];
      const Tone &k = toneOf(c, now);
      lv_obj_remove_flag(r, LV_OBJ_FLAG_HIDDEN);
      setBg(r, k.bg);
      lv_label_set_text_fmt(queueNum[i], "%d", c.table);
      lv_label_set_text(queueReason[i], c.bill ? "Conta" : "Garçom");
      char el[16];
      fmtElapsed(el, sizeof el, now ? now - c.calledAtMs : 0);
      lv_label_set_text(queueTime[i], el);
      setColor(queueNum[i], k.text);
      setColor(queueReason[i], k.muted);
      setColor(queueTime[i], k.muted);
    } else if (i == 3 && S.nCalls > 4) {
      lv_obj_remove_flag(r, LV_OBJ_FLAG_HIDDEN);
      setBg(r, C_CARD);
      lv_label_set_text_fmt(queueNum[i], "+%d", S.nCalls - 3);
      lv_label_set_text(queueReason[i], "mesas");
      lv_label_set_text(queueTime[i], "");
      setColor(queueNum[i], C_TEXT);
      setColor(queueReason[i], C_MUTED);
    } else {
      lv_obj_add_flag(r, LV_OBJ_FLAG_HIDDEN);
    }
  }
}

static void fillDone() {
  struct tm t;
  char hhmm[8] = "";
  if (localTime(t)) snprintf(hhmm, sizeof hhmm, "%02d:%02d", t.tm_hour, t.tm_min);
  const Tone &k = S.ack == AckResult::Ok ? T_OK : T_GRAY;
  setBg(scrDone, k.bg);
  setBg(doneCircle, S.ack == AckResult::Failed ? T_LATE.strong : k.strong);
  setColor(doneTitle, k.text);
  setColor(doneSub, k.muted);
  if (S.ack == AckResult::Ok) {
    lv_label_set_text(doneIcon, LV_SYMBOL_OK);
    lv_label_set_text_fmt(doneTitle, "Mesa %d a caminho", S.ackTable);
    lv_label_set_text_fmt(doneSub, "Registrado no nome de %s · %s", S.myName, hhmm);
  } else if (S.ack == AckResult::AlreadyTaken) {
    lv_label_set_text(doneIcon, LV_SYMBOL_OK);
    lv_label_set_text_fmt(doneTitle, "Mesa %d já atendida", S.ackTable);
    lv_label_set_text(doneSub, "Outra pessoa da equipe clicou antes.");
  } else {
    lv_label_set_text(doneIcon, LV_SYMBOL_CLOSE);
    lv_label_set_text(doneTitle, "Não confirmou");
    lv_label_set_text(doneSub, "Sem conexão. Tente de novo em instantes.");
  }
}

static void showScreen(Scr s) {
  lv_obj_t *target = nullptr;
  switch (s) {
    case Scr::Message: fillMessage(); target = scrMsg; break;
    case Scr::Idle: fillIdle(); target = scrIdle; break;
    case Scr::Call:
      if (strcmp(ackPendingId, selectedId) != 0) lv_obj_remove_state(callBtn, LV_STATE_DISABLED);
      fillCall();
      target = scrCall;
      break;
    case Scr::Queue: fillQueue(); target = scrQueue; break;
    case Scr::Done: fillDone(); target = scrDone; break;
    case Scr::Settings: refreshSettingsLabels(); target = scrSet; break;
    default: return;
  }
  if (lv_screen_active() != target) lv_screen_load(target);
  cur = s;
}

/** Decide a tela de acordo com o estado da rede e as chamadas. */
static void route() {
  if (cur == Scr::Settings) return;
  if (doneUntil && millis() < doneUntil) { if (cur != Scr::Done) showScreen(Scr::Done); return; }
  doneUntil = 0;
  if (S.state != NetState::Ready) { showScreen(Scr::Message); return; }
  if (S.nCalls == 0) { selectedId[0] = 0; userPickedCall = false; showScreen(Scr::Idle); return; }
  if (S.nCalls == 1) { strlcpy(selectedId, S.calls[0].id, sizeof selectedId); showScreen(Scr::Call); return; }
  if (userPickedCall && findCall(selectedId) >= 0) { showScreen(Scr::Call); return; }
  userPickedCall = false;
  showScreen(Scr::Queue);
}

// ---------------------------------------------------------------- novidades da rede
static void onData() {
  // chamada nova? (id que ainda não tinha aparecido)
  bool fresh = false;
  char ids[MAX_CALLS][40];
  for (int i = 0; i < S.nCalls; i++) {
    bool known = false;
    for (int j = 0; j < nSeen; j++) if (strcmp(seenIds[j], S.calls[i].id) == 0) { known = true; break; }
    if (!known) fresh = true;
    strlcpy(ids[i], S.calls[i].id, 40);
  }
  memcpy(seenIds, ids, sizeof(ids[0]) * S.nCalls);
  nSeen = S.nCalls;

  // resultado do Visualizado feito aqui
  if (S.ackSeq != lastAckSeq) {
    lastAckSeq = S.ackSeq;
    ackPendingId[0] = 0;
    if (S.ack != AckResult::None) {
      doneUntil = millis() + (S.ack == AckResult::Ok ? 2500 : 3500);
      if (S.ack == AckResult::Ok) buzz(1);
      userPickedCall = false;
      showScreen(Scr::Done);
    }
  }

  if (fresh) {
    wake();
    if (cur == Scr::Settings) cur = Scr::None;  // a chamada tem prioridade
    route();
    buzz(3);
    beep(2);
    lastRemind = millis();
    return;
  }
  if (cur != Scr::Settings) route();
}

static void tick() {
  // relógio, cronômetros e bateria a cada segundo
  if (cur == Scr::Idle) fillIdle();
  else if (cur == Scr::Call) fillCall();
  else if (cur == Scr::Queue) fillQueue();
  else if (cur == Scr::Message && S.state == NetState::Pairing) fillMessage();
  if (doneUntil && millis() >= doneUntil) route();

  // lembra enquanto houver mesa esperando (como o som em loop da central)
  if (S.state == NetState::Ready && S.nCalls > 0 && millis() - lastRemind > REMIND_SECONDS * 1000UL) {
    lastRemind = millis();
    if (asleep || dimmed) { wake(); route(); }
    buzz(2);
    beep(1);
  }

  // economia de bateria
  uint32_t idle = lv_display_get_inactive_time(NULL);
  bool needsScreen = S.state != NetState::Ready || cur == Scr::Settings || cur == Scr::Done;
  if (!asleep && !needsScreen) {
    if (S.nCalls == 0 && idle > SCREEN_OFF_SECONDS * 1000UL) screenOff();
    else if (S.nCalls > 0 && !dimmed && idle > DIM_AFTER_SECONDS * 1000UL) { dimmed = true; instance.setBrightness(BRIGHT_DIM); }
  }
  if (dimmed && idle < 1000) { dimmed = false; instance.setBrightness(BRIGHT_FULL); }
}

// ---------------------------------------------------------------- botão lateral
static void onPower(const DeviceEvent &event, void *) {
  if (event.type != POWER_EVENT) return;
  if (instance.getPMUEventType(event) == PMU_EVENT_KEY_CLICKED) keyClicked = true;
}
static void handleKey() {
  if (!keyClicked) return;
  keyClicked = false;
  if (asleep || dimmed) { wake(); route(); return; }
  if (cur == Scr::Settings) { confirmWhat = 0; cur = Scr::None; route(); return; }
  if (cur == Scr::Call && S.nCalls > 1) { userPickedCall = false; showScreen(Scr::Queue); return; }
  if (cur == Scr::Idle) { screenOff(); return; }
}

// ---------------------------------------------------------------- setup / loop
// ---------------------------------------------------------------- abertura (logo animada)
//  A mão se desenha traço por traço, o sinal pulsa (com uma vibrada), sobe a marca,
//  entram "Acenai" e "acenai.com.br" e uma barrinha corre enquanto o Wi-Fi conecta.
static float clampf(float x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
static float linf(float t, float a, float b) { return clampf((t - a) / (b - a)); }
static float easeOut(float x) { return 1 - powf(1 - x, 3); }
static float easeInOut(float x) { return x < .5f ? 4 * x * x * x : 1 - powf(-2 * x + 2, 3) / 2; }
static float mixf(float a, float b, float k) { return a + (b - a) * k; }

static void chimeTask(void *) {
  const int sr = 22050, n = sr * 55 / 100;  // 0,55 s: duas notas (lá e mi)
  int16_t *buf = (int16_t *)heap_caps_malloc(n * 2, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  if (!buf) buf = (int16_t *)malloc(n * 2);
  if (buf && audioOut) {
    for (int i = 0; i < n; i++) {
      float t = (float)i / sr, v = 0;
      float a1 = t, a2 = t - .17f;
      if (a1 >= 0) v += expf(-a1 * 6) * fminf(1, a1 * 200) * (sinf(2 * PI * 880 * a1) + .3f * sinf(2 * PI * 1760 * a1));
      if (a2 >= 0) v += expf(-a2 * 5) * fminf(1, a2 * 200) * (sinf(2 * PI * 1318.5f * a2) + .3f * sinf(2 * PI * 2637 * a2));
      float fade = i > n - 600 ? (n - i) / 600.0f : 1;  // sem estalo no fim
      buf[i] = (int16_t)(7000 * v * fade);
    }
    audioOut->write((const uint8_t *)buf, n * 2);
  }
  free(buf);
  vTaskDelete(NULL);
}

static void runBootAnimation() {
  lv_obj_t *scr = newScreen(0x0B0C0F);

  lv_obj_t *glow = lv_obj_create(scr);  // brilho laranja atrás da mão
  lv_obj_set_size(glow, 16, 16);
  lv_obj_set_style_radius(glow, LV_RADIUS_CIRCLE, 0);
  lv_obj_set_style_bg_color(glow, lv_color_hex(0xFF9A10), 0);
  lv_obj_set_style_bg_opa(glow, LV_OPA_TRANSP, 0);
  lv_obj_set_style_border_width(glow, 0, 0);
  lv_obj_set_style_shadow_color(glow, lv_color_hex(0xFF9A10), 0);
  lv_obj_set_style_shadow_width(glow, 130, 0);
  lv_obj_set_style_shadow_spread(glow, 26, 0);
  lv_obj_set_style_shadow_opa(glow, LV_OPA_TRANSP, 0);
  lv_obj_remove_flag(glow, LV_OBJ_FLAG_SCROLLABLE);

  static lv_point_precise_t pts[BOOT_N_STROKES][48];
  lv_obj_t *ln[BOOT_N_STROKES];
  for (int i = 0; i < BOOT_N_STROKES; i++) {
    ln[i] = lv_line_create(scr);
    lv_obj_set_pos(ln[i], 0, 0);
    lv_obj_set_style_line_color(ln[i], lv_color_hex(BOOT_STROKES[i].color), 0);
    lv_obj_set_style_line_rounded(ln[i], true, 0);
    lv_obj_add_flag(ln[i], LV_OBJ_FLAG_HIDDEN);
  }

  lv_obj_t *word = lv_obj_create(scr);  // "Acen" branco + "ai" laranja
  lv_obj_set_size(word, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
  lv_obj_set_style_bg_opa(word, LV_OPA_TRANSP, 0);
  lv_obj_set_style_border_width(word, 0, 0);
  lv_obj_set_style_pad_all(word, 0, 0);
  lv_obj_set_flex_flow(word, LV_FLEX_FLOW_ROW);
  lv_obj_set_style_pad_column(word, 0, 0);
  lv_obj_remove_flag(word, LV_OBJ_FLAG_SCROLLABLE);
  newLabel(word, &acn_logo_44, 0xFBF8F2, "Acen");
  newLabel(word, &acn_logo_44, 0xFFB020, "ai");
  lv_obj_align(word, LV_ALIGN_TOP_MID, 0, 146);

  lv_obj_t *site = newLabel(scr, &acn_16, 0x8B909A, "acenai.com.br");
  lv_obj_align(site, LV_ALIGN_TOP_MID, 0, 196);

  lv_obj_t *track = newBox(scr, 0x22252B, 100, 4, 2);
  lv_obj_align(track, LV_ALIGN_TOP_MID, 0, 224);
  lv_obj_t *runner = newBox(track, 0xFF9A10, 40, 4, 2);

  lv_obj_set_style_opa(word, LV_OPA_TRANSP, 0);
  lv_obj_set_style_opa(site, LV_OPA_TRANSP, 0);
  lv_obj_set_style_opa(track, LV_OPA_TRANSP, 0);

  instance.setBrightness(0);
  lv_screen_load(scr);
  lv_timer_handler();

  const uint32_t t0 = millis();
  bool buzzed = false, chimed = false;
  int lastBright = -1;
  for (;;) {
    float t = (millis() - t0) / 1000.0f;
    if (t > 4.6f) break;

    int br = (int)(BRIGHT_FULL * easeOut(linf(t, .1f, .55f)));
    if (br != lastBright) { instance.setBrightness(br); lastBright = br; }

    // marca: grande no centro → sobe e diminui para dar lugar ao nome
    float up = easeInOut(linf(t, 2.3f, 2.95f));
    float pop = 1 + .06f * sinf(linf(t, 1.95f, 2.25f) * PI);
    float pulse = (t > 1.9f && t < 3.1f) ? sinf((t - 1.9f) / 1.2f * PI * 2) * .5f + .5f : 0;
    float S_ = mixf(2.6f, 1.75f, up) * pop;
    float cy = mixf(120, 78, up);
    float ox = 120 - 32 * S_, oy = cy - 32 * S_;

    for (int i = 0; i < BOOT_N_STROKES; i++) {
      const BootStroke &b = BOOT_STROKES[i];
      float k = i < 4 ? easeInOut(linf(t, .55f + i * .16f, 1.05f + i * .16f))
                      : easeOut(linf(t, 1.45f + (i - 4) * .18f, 1.8f + (i - 4) * .18f));
      if (k <= 0) continue;
      float m = k * (b.n - 1);
      int full = (int)m;
      int cnt = 0;
      for (int j = 0; j <= full && j < b.n; j++, cnt++) {
        pts[i][cnt].x = ox + b.xy[j * 2] * S_;
        pts[i][cnt].y = oy + b.xy[j * 2 + 1] * S_;
      }
      if (full < b.n - 1) {  // ponta do traço, entre dois pontos
        float f = m - full;
        pts[i][cnt].x = ox + mixf(b.xy[full * 2], b.xy[full * 2 + 2], f) * S_;
        pts[i][cnt].y = oy + mixf(b.xy[full * 2 + 1], b.xy[full * 2 + 3], f) * S_;
        cnt++;
      }
      if (cnt < 2) continue;
      lv_obj_set_style_line_width(ln[i], (int32_t)lroundf(b.width * S_), 0);
      if (i >= 4) lv_obj_set_style_line_opa(ln[i], (lv_opa_t)(255 * (1 - .55f * pulse)), 0);
      lv_line_set_points(ln[i], pts[i], cnt);
      lv_obj_remove_flag(ln[i], LV_OBJ_FLAG_HIDDEN);
    }

    lv_obj_set_pos(glow, 120 - 8, (int)cy - 8);
    lv_opa_t go = (lv_opa_t)(95 * easeOut(linf(t, 1.3f, 2.0f)) * (1 + .25f * pulse));
    lv_obj_set_style_shadow_opa(glow, go, 0);
    lv_obj_set_style_bg_opa(glow, go, 0);

    float w = easeOut(linf(t, 2.65f, 3.2f));
    lv_obj_set_style_opa(word, (lv_opa_t)(255 * w), 0);
    lv_obj_set_style_translate_y(word, (int32_t)((1 - w) * 14), 0);
    float st = easeOut(linf(t, 3.05f, 3.5f));
    lv_obj_set_style_opa(site, (lv_opa_t)(255 * st), 0);
    lv_obj_set_style_translate_y(site, (int32_t)((1 - st) * 8), 0);
    lv_obj_set_style_opa(track, (lv_opa_t)(255 * linf(t, 3.5f, 3.8f)), 0);
    float ph = fmodf(fmaxf(0, t - 3.5f) / 1.1f, 1);
    lv_obj_set_x(runner, (int32_t)(-40 + ph * 140));

    if (!buzzed && t > 1.95f) {  // uma vibrada curta quando o sinal aparece
      buzzed = true;
      if (vibeOn) { instance.drv.setWaveform(0, 1); instance.drv.setWaveform(1, 0); instance.drv.run(); }
    }
    if (!chimed && t > 2.65f) {  // som curto quando entra o nome
      chimed = true;
      if (soundOn && audioOut) xTaskCreate(chimeTask, "chime", 4096, NULL, 1, NULL);
    }

    instance.loop();
    lv_timer_handler();
#ifdef BOOT_FRAME_HOOK
    BOOT_FRAME_HOOK();  // só no simulador do PC
#endif
    delay(8);
  }
  bootScr = scr;
}

void setup() {
  Serial.begin(115200);
  netInstallPanic();
  instance.begin();
  beginLvglHelper(instance);
  instance.setBrightness(0);          // acende na abertura
  instance.enablePowerEvent(PowerEvent::IRQ_PEKEY_CLICKED, true);
  instance.onEvent(POWER_EVENT, onPower);

  uiPrefs.begin("acenai-ui", false);
  soundOn = uiPrefs.getBool("sound", true);
  vibeOn = uiPrefs.getBool("vibe", true);
  initSound();

  buildMessage();
  buildIdle();
  buildCall();
  buildQueue();
  buildDone();
  buildSettings();
  buildWakeLayer();

  netStart();                // o Wi-Fi já vai conectando durante a abertura
  runBootAnimation();
  netGetSnapshot(S);
  showScreen(Scr::Message);
  if (bootScr) { lv_obj_delete(bootScr); bootScr = nullptr; }
  Serial.println("Acenai relógio " ACENAI_VERSION);
}

void loop() {
  instance.loop();
  static uint32_t lastPull = 0;
  if (millis() - lastPull > 150) {
    lastPull = millis();
    netGetSnapshot(S);
    if (S.version != shownVersion) { shownVersion = S.version; onData(); }
  }
  handleKey();
  if (millis() - lastTick > 1000) { lastTick = millis(); tick(); }
  lv_timer_handler();
  delay(5);
}
