// =====================================================================
//  Rede: Wi-Fi, login no Firebase (anônimo), conexão ao restaurante por
//  código e consulta das chamadas pelo REST do Firestore.
//  Roda numa tarefa própria (núcleo 0) para a tela nunca travar.
// =====================================================================
#include "shared.h"
#include "config.h"
#include "certs.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <time.h>

#define FS_DOCS   "projects/" FIREBASE_PROJECT_ID "/databases/(default)/documents"
#define FS_BASE   "https://firestore.googleapis.com/v1/" FS_DOCS

static SemaphoreHandle_t mtx;
static QueueHandle_t cmdQ;
static Snapshot snap;                 // protegido por mtx
static Preferences prefs;

static String ssid, pass, uid, idToken, refreshToken, rid, myName;
static uint32_t tokenExpiresMs = 0;
static WiFiClientSecure tls;
static String lastHost;

// ---------------------------------------------------------------- estado
#define LOCKED(code) do { xSemaphoreTake(mtx, portMAX_DELAY); code; snap.version++; xSemaphoreGive(mtx); } while (0)

static void setState(NetState s, const char *msg = "") {
  LOCKED(snap.state = s; strlcpy(snap.message, msg ? msg : "", sizeof(snap.message)));
}
static void setOnline(bool on) {
  xSemaphoreTake(mtx, portMAX_DELAY);
  if (snap.online != on) { snap.online = on; snap.version++; }
  xSemaphoreGive(mtx);
}

void netGetSnapshot(Snapshot &out) {
  xSemaphoreTake(mtx, portMAX_DELAY);
  memcpy(&out, &snap, sizeof(Snapshot));
  xSemaphoreGive(mtx);
}
bool netSend(const Command &c) { return xQueueSend(cmdQ, &c, 0) == pdTRUE; }

int64_t netNowMs(const Snapshot &s) {
  if (s.haveServerTime) return (int64_t)millis() + s.serverOffsetMs;
  time_t t = time(nullptr);
  return t > 1700000000 ? (int64_t)t * 1000 : 0;
}

// ---------------------------------------------------------------- utilidades
static int64_t daysFromCivil(int y, unsigned m, unsigned d) {
  y -= m <= 2;
  const int era = (y >= 0 ? y : y - 399) / 400;
  const unsigned yoe = (unsigned)(y - era * 400);
  const unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  const unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return era * 146097LL + (int64_t)doe - 719468;
}
// "2026-10-27T01:46:46.123456Z" → epoch em ms
static int64_t parseIsoMs(const char *s) {
  if (!s) return 0;
  int Y, M, D, h, m, sec;
  if (sscanf(s, "%d-%d-%dT%d:%d:%d", &Y, &M, &D, &h, &m, &sec) != 6) return 0;
  int ms = 0, digits = 0;
  const char *dot = strchr(s, '.');
  if (dot) for (const char *p = dot + 1; *p >= '0' && *p <= '9'; p++) if (digits < 3) { ms = ms * 10 + (*p - '0'); digits++; }
  while (digits < 3) { ms *= 10; digits++; }
  return (daysFromCivil(Y, M, D) * 86400LL + h * 3600 + m * 60 + sec) * 1000LL + ms;
}

static String hostOf(const String &url) {
  int a = url.indexOf("://") + 3, b = url.indexOf('/', a);
  return url.substring(a, b < 0 ? url.length() : b);
}

/** Requisição HTTPS. Reaproveita a conexão segura quando o servidor é o mesmo (economiza bateria). */
static int request(const char *method, const String &url, const String &body, String &out, bool withAuth,
                   const char *ctype = "application/json") {
  String host = hostOf(url);
  if (host != lastHost) { tls.stop(); lastHost = host; }
  HTTPClient http;
  http.setReuse(true);
  http.setConnectTimeout(8000);
  http.setTimeout(12000);
  if (!http.begin(tls, url)) { tls.stop(); lastHost = ""; return -1; }
  http.addHeader("Referer", ACENAI_SITE);
  if (strcmp(method, "GET") != 0 && strcmp(method, "DELETE") != 0) http.addHeader("Content-Type", ctype);
  if (withAuth && idToken.length()) http.addHeader("Authorization", "Bearer " + idToken);
  int code = http.sendRequest(method, body);
  out = code > 0 ? http.getString() : String();
  http.end();
  if (code <= 0) { tls.stop(); lastHost = ""; }
  return code;
}

static String jsonErrorStatus(const String &body) {
  JsonDocument d;
  if (deserializeJson(d, body)) return "";
  if (d.is<JsonArray>()) return d[0]["error"]["status"] | "";
  const char *st = d["error"]["status"] | "";
  if (*st) return st;
  return d["error"]["message"] | "";
}

// ---------------------------------------------------------------- login (anônimo)
static void saveAuth() {
  prefs.putString("uid", uid);
  prefs.putString("rt", refreshToken);
}

static bool signUp() {
  String out;
  int code = request("POST", "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" FIREBASE_API_KEY,
                     "{\"returnSecureToken\":true}", out, false);
  if (code != 200) {
    String err = jsonErrorStatus(out);
    Serial.printf("[auth] signUp %d %s\n", code, err.c_str());
    if (err.indexOf("ADMIN_ONLY") >= 0 || err.indexOf("OPERATION_NOT_ALLOWED") >= 0)
      setState(NetState::Error, "O login anônimo está desligado no Firebase. Avise o suporte do Acenai.");
    return false;
  }
  JsonDocument d;
  deserializeJson(d, out);
  idToken = d["idToken"] | "";
  refreshToken = d["refreshToken"] | "";
  uid = d["localId"] | "";
  tokenExpiresMs = millis() + (uint32_t)atoi(d["expiresIn"] | "3600") * 1000UL;
  rid = "";  // conta nova: precisa conectar ao restaurante de novo
  prefs.remove("rid");
  saveAuth();
  Serial.printf("[auth] nova conta do relógio %s\n", uid.c_str());
  return idToken.length() > 0;
}

static bool refresh() {
  String out;
  int code = request("POST", "https://securetoken.googleapis.com/v1/token?key=" FIREBASE_API_KEY,
                     "grant_type=refresh_token&refresh_token=" + refreshToken, out, false,
                     "application/x-www-form-urlencoded");
  if (code == 200) {
    JsonDocument d;
    deserializeJson(d, out);
    idToken = d["id_token"] | "";
    refreshToken = d["refresh_token"] | refreshToken.c_str();
    uid = d["user_id"] | uid.c_str();
    tokenExpiresMs = millis() + (uint32_t)atoi(d["expires_in"] | "3600") * 1000UL;
    saveAuth();
    return idToken.length() > 0;
  }
  Serial.printf("[auth] refresh %d %s\n", code, jsonErrorStatus(out).c_str());
  if (code == 400) refreshToken = "";  // sessão inválida: cria outra conta
  return false;
}

static bool ensureToken(bool force = false) {
  if (!force && idToken.length() && (int32_t)(tokenExpiresMs - millis()) > 120000) return true;
  if (refreshToken.length() && refresh()) return true;
  if (refreshToken.length()) return false;  // falha de rede: tenta de novo depois
  return signUp();
}

// ---------------------------------------------------------------- Firestore
static String fsStr(JsonVariantConst fields, const char *k) { return fields[k]["stringValue"] | ""; }

static int fsGet(const String &path, JsonDocument &d) {
  String out;
  int code = request("GET", String(FS_BASE "/") + path, "", out, true);
  if (code == 401 && ensureToken(true)) code = request("GET", String(FS_BASE "/") + path, "", out, true);
  if (code == 200) deserializeJson(d, out);
  return code;
}

static int fsCommit(JsonDocument &body, String &out) {
  String b;
  serializeJson(body, b);
  int code = request("POST", FS_BASE ":commit", b, out, true);
  if (code == 401 && ensureToken(true)) code = request("POST", FS_BASE ":commit", b, out, true);
  return code;
}

static void loadBrand() {
  JsonDocument d;
  if (fsGet("restaurants/" + rid + "/settings/brand", d) == 200) {
    String n = fsStr(d["fields"], "name");
    LOCKED(strlcpy(snap.restaurant, n.c_str(), sizeof(snap.restaurant)));
  }
}

static void applyMember(JsonVariantConst fields) {
  String n = fsStr(fields, "displayName");
  if (!n.length()) n = fsStr(fields, "name");
  if (!n.length()) n = "Relógio";
  myName = n;
  LOCKED(strlcpy(snap.myName, n.c_str(), sizeof(snap.myName)));
}

// ----- conexão ao restaurante: o relógio mostra um código; o responsável digita na central
static char pairCode[8] = "";
static uint32_t pairStarted = 0;

static void dropPairCode() {
  if (!pairCode[0]) return;
  String out;
  request("DELETE", String(FS_BASE "/devicePairings/") + pairCode, "", out, true);
  pairCode[0] = 0;
}

static bool newPairCode() {
  for (int attempt = 0; attempt < 6; attempt++) {
    char code[8];
    snprintf(code, sizeof(code), "%06lu", (unsigned long)(100000 + esp_random() % 900000));
    JsonDocument b;
    JsonObject w = b["writes"].add<JsonObject>();
    w["update"]["name"] = String(FS_DOCS "/devicePairings/") + code;
    w["update"]["fields"]["uid"]["stringValue"] = uid;
    w["update"]["fields"]["model"]["stringValue"] = "T-Watch S3";
    JsonObject t = w["updateTransforms"].add<JsonObject>();
    t["fieldPath"] = "createdAt";
    t["setToServerValue"] = "REQUEST_TIME";
    w["currentDocument"]["exists"] = false;
    String out;
    int rc = fsCommit(b, out);
    if (rc == 200) {
      strlcpy(pairCode, code, sizeof(pairCode));
      pairStarted = millis();
      LOCKED(strlcpy(snap.pairCode, code, sizeof(snap.pairCode)); snap.pairStartedMs = pairStarted);
      Serial.printf("[pair] código %s\n", code);
      return true;
    }
    Serial.printf("[pair] código %s recusado (%d) %s\n", code, rc, jsonErrorStatus(out).c_str());
    if (rc != 400 && rc != 409 && rc != 403) return false;  // erro de rede: tenta depois
  }
  return false;
}

/** Um passo do pareamento. Retorna true quando o relógio foi conectado. */
static bool pairingStep() {
  if (!pairCode[0] || millis() - pairStarted > PAIR_CODE_SECONDS * 1000UL) {
    dropPairCode();
    if (!newPairCode()) return false;
    xSemaphoreTake(mtx, portMAX_DELAY);
    bool keepMsg = snap.state == NetState::Pairing;
    xSemaphoreGive(mtx);
    if (!keepMsg) setState(NetState::Pairing, "");
  }
  JsonDocument d;
  int code = fsGet("admins/" + uid, d);
  if (code != 200) return false;
  rid = fsStr(d["fields"], "restaurantId");
  if (!rid.length()) return false;
  prefs.putString("rid", rid);
  pairCode[0] = 0;  // o responsável já apagou o código ao conectar
  LOCKED(snap.pairCode[0] = 0);
  applyMember(d["fields"]);
  loadBrand();
  setState(NetState::Ready, "");
  Serial.printf("[pair] conectado ao restaurante %s como %s\n", rid.c_str(), myName.c_str());
  return true;
}

/** Confere se ainda faz parte da equipe (e atualiza o nome). */
static void checkAccess() {
  JsonDocument d;
  int code = fsGet("admins/" + uid, d);
  if (code == 404) {
    Serial.println("[acesso] relógio removido da equipe");
    rid = "";
    prefs.remove("rid");
    LOCKED(snap.nCalls = 0; snap.restaurant[0] = 0);
    setState(NetState::Pairing, "Este relógio foi desconectado. Para conectar de novo, use o código abaixo.");
    return;
  }
  if (code != 200) return;
  String r = fsStr(d["fields"], "restaurantId");
  if (r != rid) { rid = r; prefs.putString("rid", rid); loadBrand(); }
  applyMember(d["fields"]);
  JsonDocument g;
  if (fsGet("restaurants/" + rid + "/settings/general", g) == 200) {
    bool paused = g["fields"]["suspended"]["booleanValue"] | false;
    xSemaphoreTake(mtx, portMAX_DELAY);
    NetState cur = snap.state;
    xSemaphoreGive(mtx);
    if (paused && cur != NetState::Paused) setState(NetState::Paused, "A central do restaurante está pausada. Fale com o suporte do Acenai.");
    if (!paused && cur == NetState::Paused) setState(NetState::Ready, "");
  }
}

// ----- chamadas pendentes
static String queryBody;

static bool poll() {
  if (!queryBody.length()) {
    JsonDocument q;
    JsonObject sq = q["structuredQuery"].to<JsonObject>();
    sq["from"][0]["collectionId"] = "calls";
    sq["where"]["fieldFilter"]["field"]["fieldPath"] = "status";
    sq["where"]["fieldFilter"]["op"] = "EQUAL";
    sq["where"]["fieldFilter"]["value"]["stringValue"] = "PENDING";
    sq["limit"] = MAX_CALLS;
    serializeJson(q, queryBody);
  }
  String url = String(FS_BASE "/restaurants/") + rid + ":runQuery";
  String out;
  int code = request("POST", url, queryBody, out, true);
  if (code == 401 && ensureToken(true)) code = request("POST", url, queryBody, out, true);
  if (code == 403) { checkAccess(); setOnline(true); return false; }
  if (code != 200) { setOnline(false); Serial.printf("[poll] %d\n", code); return false; }

  JsonDocument filter;
  filter[0]["readTime"] = true;
  filter[0]["document"]["name"] = true;
  filter[0]["document"]["updateTime"] = true;
  filter[0]["document"]["fields"]["tableNumber"] = true;
  filter[0]["document"]["fields"]["reason"] = true;
  filter[0]["document"]["fields"]["calledAt"] = true;
  JsonDocument d;
  if (deserializeJson(d, out, DeserializationOption::Filter(filter))) { setOnline(false); return false; }

  static CallItem list[MAX_CALLS];
  int n = 0;
  int64_t readMs = 0;
  for (JsonVariantConst row : d.as<JsonArrayConst>()) {
    if (!readMs) readMs = parseIsoMs(row["readTime"] | "");
    JsonVariantConst doc = row["document"];
    if (doc.isNull() || n >= MAX_CALLS) continue;
    CallItem &c = list[n];
    String name = doc["name"] | "";
    strlcpy(c.path, name.c_str(), sizeof(c.path));
    strlcpy(c.id, name.substring(name.lastIndexOf('/') + 1).c_str(), sizeof(c.id));
    strlcpy(c.updateTime, doc["updateTime"] | "", sizeof(c.updateTime));
    JsonVariantConst f = doc["fields"];
    c.table = atoi(f["tableNumber"]["integerValue"] | "0");
    c.bill = strcmp(f["reason"]["stringValue"] | "waiter", "bill") == 0;
    c.calledAtMs = parseIsoMs(f["calledAt"]["timestampValue"] | "");
    n++;
  }
  // mais antiga primeiro (igual à fila da central)
  for (int i = 1; i < n; i++) {
    CallItem tmp = list[i];
    int j = i - 1;
    while (j >= 0 && list[j].calledAtMs > tmp.calledAtMs) { list[j + 1] = list[j]; j--; }
    list[j + 1] = tmp;
  }

  xSemaphoreTake(mtx, portMAX_DELAY);
  bool changed = n != snap.nCalls || !snap.online;
  for (int i = 0; !changed && i < n; i++)
    changed = strcmp(list[i].id, snap.calls[i].id) != 0 || strcmp(list[i].updateTime, snap.calls[i].updateTime) != 0;
  if (readMs) { snap.serverOffsetMs = readMs - (int64_t)millis(); snap.haveServerTime = true; }
  snap.online = true;
  if (changed) {
    memcpy(snap.calls, list, sizeof(CallItem) * n);
    snap.nCalls = n;
    snap.version++;
  }
  xSemaphoreGive(mtx);
  return true;
}

// ----- Visualizado no relógio: grava quem atendeu (uid + nome) e a hora do servidor
static void ack(const Command &c) {
  JsonDocument b;
  JsonObject w = b["writes"].add<JsonObject>();
  w["update"]["name"] = c.path;
  JsonObject f = w["update"]["fields"].to<JsonObject>();
  f["status"]["stringValue"] = "VIEWED";
  f["viewedBy"]["stringValue"] = uid;
  f["viewedByName"]["stringValue"] = myName.substring(0, 40);
  JsonArray mask = w["updateMask"]["fieldPaths"].to<JsonArray>();
  mask.add("status");
  mask.add("viewedBy");
  mask.add("viewedByName");
  JsonObject t = w["updateTransforms"].add<JsonObject>();
  t["fieldPath"] = "viewedAt";
  t["setToServerValue"] = "REQUEST_TIME";
  // só grava se ninguém mexeu na chamada desde a última consulta
  if (c.updateTime[0]) w["currentDocument"]["updateTime"] = c.updateTime;
  else w["currentDocument"]["exists"] = true;

  String out;
  int code = fsCommit(b, out);
  String err = code == 200 ? "" : jsonErrorStatus(out);
  AckResult r = code == 200 ? AckResult::Ok
              : (code == 409 || code == 404 || err.indexOf("FAILED_PRECONDITION") >= 0 || err.indexOf("NOT_FOUND") >= 0) ? AckResult::AlreadyTaken
              : AckResult::Failed;
  Serial.printf("[ack] mesa %d → %d %s\n", c.table, code, err.c_str());
  LOCKED(snap.ack = r; snap.ackTable = c.table; snap.ackSeq++);
}

// ---------------------------------------------------------------- Wi-Fi pelo celular
static String htmlEscape(const String &s) {
  String o;
  for (char ch : s) {
    if (ch == '&') o += "&amp;"; else if (ch == '<') o += "&lt;"; else if (ch == '>') o += "&gt;";
    else if (ch == '"') o += "&quot;"; else o += ch;
  }
  return o;
}

[[noreturn]] static void runPortal() {
  setState(NetState::WifiPortal, "");
  WiFi.disconnect(true);
  WiFi.mode(WIFI_AP_STA);
  int n = WiFi.scanNetworks();
  String options;
  String seen = "\n";
  for (int i = 0; i < n && i < 20; i++) {
    String s = WiFi.SSID(i);
    if (!s.length() || seen.indexOf("\n" + s + "\n") >= 0) continue;
    seen += s + "\n";
    options += "<option value=\"" + htmlEscape(s) + "\">" + htmlEscape(s) + " (" + String(WiFi.RSSI(i)) + " dBm)</option>";
  }
  WiFi.scanDelete();
  WiFi.softAP(SETUP_AP_NAME);
  DNSServer dns;
  dns.start(53, "*", WiFi.softAPIP());
  WebServer server(80);
  bool saved = false;

  const String head = F("<!doctype html><html lang=pt-BR><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
                        "<title>Relógio Acenai</title><style>body{font-family:system-ui,sans-serif;max-width:420px;margin:24px auto;padding:0 16px;color:#16171b}"
                        "h1{font-size:1.4rem}label{display:block;margin:14px 0 6px;font-weight:600}select,input,button{width:100%;font-size:1rem;padding:12px;border-radius:10px;border:1px solid #ccc;box-sizing:border-box}"
                        "button{background:#ff9a0a;border:0;font-weight:700;margin-top:18px}small{color:#666}</style>");

  server.on("/", HTTP_GET, [&]() {
    server.send(200, "text/html; charset=utf-8",
                head + "<h1>Wi-Fi do relógio</h1><p>Escolha a rede do restaurante. O relógio usa essa rede para receber as chamadas das mesas.</p>"
                       "<form method=post action=/salvar><label>Rede</label><select name=s>" + options +
                       "</select><label>Ou digite o nome da rede</label><input name=o placeholder='Só se não estiver na lista'>"
                       "<label>Senha</label><input name=p type=password autocomplete=off>"
                       "<button>Salvar e conectar</button></form><p><small>Acenai · versão " ACENAI_VERSION "</small></p>");
  });
  server.on("/salvar", HTTP_POST, [&]() {
    String s = server.arg("o");
    s.trim();
    if (!s.length()) s = server.arg("s");
    prefs.putString("ssid", s);
    prefs.putString("pass", server.arg("p"));
    server.send(200, "text/html; charset=utf-8",
                head + "<h1>Pronto!</h1><p>O relógio vai reiniciar e conectar em <b>" + htmlEscape(s) +
                       "</b>. Pode voltar o celular para o Wi-Fi normal.</p>");
    saved = true;
  });
  server.onNotFound([&]() {  // abre a página sozinho quando o celular conecta
    server.sendHeader("Location", "http://" + WiFi.softAPIP().toString() + "/", true);
    server.send(302, "text/plain", "");
  });
  server.begin();
  uint32_t savedAt = 0;
  for (;;) {
    dns.processNextRequest();
    server.handleClient();
    if (saved && !savedAt) savedAt = millis();
    if (savedAt && millis() - savedAt > 1500) ESP.restart();
    vTaskDelay(pdMS_TO_TICKS(5));
  }
}

// ---------------------------------------------------------------- tarefa principal
static void handleCommand(const Command &c) {
  switch (c.type) {
    case CmdType::Ack:
      ack(c);
      poll();
      break;
    case CmdType::Unpair:
      // conta nova: o responsável remove o relógio antigo em Equipe
      dropPairCode();
      prefs.remove("rid");
      prefs.remove("rt");
      prefs.remove("uid");
      rid = refreshToken = idToken = uid = "";
      LOCKED(snap.nCalls = 0; snap.restaurant[0] = 0; snap.myName[0] = 0);
      setState(NetState::SigningIn, "");
      break;
    case CmdType::WifiReset:
      prefs.remove("ssid");
      prefs.remove("pass");
      delay(300);
      ESP.restart();
      break;
    case CmdType::PollNow:
      break;
  }
}

static void netTask(void *) {
  prefs.begin("acenai", false);
  ssid = prefs.getString("ssid", "");
  pass = prefs.getString("pass", "");
  uid = prefs.getString("uid", "");
  refreshToken = prefs.getString("rt", "");
  rid = prefs.getString("rid", "");

  if (!ssid.length()) runPortal();

  setState(NetState::WifiConnecting, "");
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(ssid.c_str(), pass.c_str());
  WiFi.setSleep(true);  // economia de energia entre as consultas
  configTzTime(ACENAI_TZ, "pool.ntp.org", "time.google.com");
  tls.setCACert(GOOGLE_ROOT_CAS);

  uint32_t lastPoll = 0, lastAccess = 0, wifiLostAt = millis();
  bool pollNow = true;
  for (;;) {
    Command c;
    if (WiFi.status() != WL_CONNECTED) {
      setOnline(false);
      xSemaphoreTake(mtx, portMAX_DELAY);
      NetState cur = snap.state;
      xSemaphoreGive(mtx);
      if (cur == NetState::Boot || cur == NetState::WifiConnecting) {
        char msg[96];
        snprintf(msg, sizeof msg, "%s", millis() - wifiLostAt > 30000 ? "Não conectou. Confira o Wi-Fi ou troque a rede nos ajustes." : "");
        setState(NetState::WifiConnecting, msg);
      }
      if (xQueueReceive(cmdQ, &c, pdMS_TO_TICKS(1000)) == pdTRUE && c.type == CmdType::WifiReset) handleCommand(c);
      continue;
    }
    wifiLostAt = millis();

    if (!ensureToken()) {
      xSemaphoreTake(mtx, portMAX_DELAY);
      NetState cur = snap.state;
      xSemaphoreGive(mtx);
      if (cur != NetState::Error) setState(NetState::SigningIn, "");
      if (xQueueReceive(cmdQ, &c, pdMS_TO_TICKS(5000)) == pdTRUE) handleCommand(c);
      continue;
    }

    if (!rid.length()) {
      xSemaphoreTake(mtx, portMAX_DELAY);
      bool showing = snap.state == NetState::Pairing;
      xSemaphoreGive(mtx);
      if (!showing && !pairCode[0]) setState(NetState::Pairing, "");
      if (pairingStep()) { pollNow = true; lastAccess = millis(); }
      if (xQueueReceive(cmdQ, &c, pdMS_TO_TICKS(3000)) == pdTRUE) handleCommand(c);
      continue;
    }

    xSemaphoreTake(mtx, portMAX_DELAY);
    NetState cur = snap.state;
    xSemaphoreGive(mtx);
    if (cur != NetState::Ready && cur != NetState::Paused) {
      setState(NetState::Ready, "");
      if (!snap.restaurant[0]) loadBrand();
      checkAccess();
      lastAccess = millis();
    }

    if (millis() - lastAccess > ACCESS_CHECK_SECONDS * 1000UL) { checkAccess(); lastAccess = millis(); }
    if (pollNow || millis() - lastPoll > POLL_SECONDS * 1000UL) {
      poll();
      lastPoll = millis();
      pollNow = false;
    }
    if (xQueueReceive(cmdQ, &c, pdMS_TO_TICKS(200)) == pdTRUE) {
      handleCommand(c);
      if (c.type == CmdType::PollNow) pollNow = true;
      if (c.type == CmdType::Ack) lastPoll = millis();
    }
  }
}

void netStart() {
  mtx = xSemaphoreCreateMutex();
  cmdQ = xQueueCreate(6, sizeof(Command));
  memset(&snap, 0, sizeof(snap));
  snap.state = NetState::Boot;
  // TLS precisa de pilha grande; fica no núcleo 0, a tela no núcleo 1
  xTaskCreatePinnedToCore(netTask, "acenai-net", 16384, nullptr, 1, nullptr, 0);
}
