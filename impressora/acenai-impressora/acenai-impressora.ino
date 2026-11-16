// =====================================================================
//  Acenai · Impressora da cozinha
//  ESP32 (clássico, WROOM-32) + impressora térmica Bluetooth (ESC/POS)
//
//  1. Na primeira vez, cria a rede "Acenai-Impressora": pelo celular você
//     escolhe o Wi-Fi do restaurante e a impressora Bluetooth.
//  2. Imprime um código de 6 números. O responsável digita o código na
//     central (Pedidos → Impressora da cozinha).
//  3. A cada poucos segundos confere os pedidos novos do cardápio e
//     imprime a comanda. A central mostra "Comanda impressa".
//
//  Botão BOOT: toque = imprime um teste (ou o código, se ainda não conectou)
//              segurar 5 s = apaga Wi-Fi e impressora e volta à configuração
//
//  Placa: "ESP32 Dev Module" · Partition Scheme: "Huge APP (3MB No OTA)"
//  Precisa do ESP32 clássico: ESP32-S2/S3/C3 não têm Bluetooth clássico.
// =====================================================================
#include "config.h"
#include "certs.h"
#include "escpos.h"
#include "pending.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <BluetoothSerial.h>
#include <time.h>
#include <esp_system.h>

#if !defined(CONFIG_BT_ENABLED) || !defined(CONFIG_BLUEDROID_ENABLED) || !defined(CONFIG_BT_SPP_ENABLED)
#error "Esta placa não tem Bluetooth clássico (SPP). Use um ESP32 clássico (ESP32-WROOM-32 / ESP32 Dev Module)."
#endif

// TLS precisa de pilha maior que a padrão do loop()
SET_LOOP_TASK_STACK_SIZE(16 * 1024);

#define FS_DOCS "projects/" FIREBASE_PROJECT_ID "/databases/(default)/documents"
#define FS_BASE "https://firestore.googleapis.com/v1/" FS_DOCS

static Preferences prefs;
static BluetoothSerial bt;
static EscPos pos;
static WiFiClientSecure tls;
static String lastHost;

// configuração (salva na memória da placa)
static String ssid, pass, prnMac, prnName, prnPin;
static int paperCols = 32;
static bool printAccents = false;

// login e restaurante
static String uid, idToken, refreshToken, rid, myName, restaurantName;
static uint32_t tokenExpiresMs = 0;

// ---------------------------------------------------------------- LED e botão (tarefa própria)
enum LedMode : uint8_t { LED_OFF, LED_PORTAL, LED_CONNECTING, LED_PAIRING, LED_NO_PRINTER, LED_READY, LED_ERROR };
static volatile LedMode ledMode = LED_CONNECTING;
static volatile bool btnShort = false, btnLong = false;
static volatile uint32_t blinkUntil = 0;  // pisca rápido ao imprimir

static void uiTask(void *) {
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  uint32_t downAt = 0;
  bool wasDown = false, longFired = false;
  for (;;) {
    uint32_t now = millis();
    bool down = digitalRead(BUTTON_PIN) == LOW;
    if (down && !wasDown) { downAt = now; longFired = false; }
    if (down && !longFired && now - downAt > 5000) { btnLong = true; longFired = true; }
    if (!down && wasDown && !longFired && now - downAt > 40) btnShort = true;
    wasDown = down;

    bool on;
    if ((int32_t)(blinkUntil - now) > 0) on = (now / 60) % 2;
    else if (down && now - downAt > 1000) on = (now / 50) % 2;  // segurando: pisca bem rápido
    else switch (ledMode) {
      case LED_PORTAL:     on = (now / 150) % 2; break;                        // pisca rápido
      case LED_CONNECTING: on = (now / 600) % 2; break;                        // pisca devagar
      case LED_PAIRING:    on = (now % 2000) < 1000; break;                    // 1 s aceso, 1 s apagado
      case LED_NO_PRINTER: { uint32_t t = now % 2000; on = t < 120 || (t > 300 && t < 420); break; }  // 2 piscadas
      case LED_READY:      on = true; break;                                   // aceso direto
      case LED_ERROR:      { uint32_t t = now % 1500; on = t < 80 || (t > 200 && t < 280) || (t > 400 && t < 480); break; }
      default:             on = false;
    }
    digitalWrite(LED_PIN, on);
    vTaskDelay(pdMS_TO_TICKS(20));
  }
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
static int64_t parseIsoMs(const char *s) {
  if (!s) return 0;
  int Y, M, D, h, m, sec;
  if (sscanf(s, "%d-%d-%dT%d:%d:%d", &Y, &M, &D, &h, &m, &sec) != 6) return 0;
  return (daysFromCivil(Y, M, D) * 86400LL + h * 3600 + m * 60 + sec) * 1000LL;
}
static String hhmm(int64_t epochMs) {
  if (epochMs <= 0) return "";
  time_t t = (time_t)(epochMs / 1000) + TZ_OFFSET_SECONDS;
  struct tm tmv;
  gmtime_r(&t, &tmv);
  char b[8];
  snprintf(b, sizeof b, "%02d:%02d", tmv.tm_hour, tmv.tm_min);
  return b;
}
static String orderCode(const String &id) {
  String a;
  for (char c : id) if (isalnum((unsigned char)c)) a += (char)toupper((unsigned char)c);
  return "#" + (a.length() > 4 ? a.substring(a.length() - 4) : a);
}
static String hostOf(const String &url) {
  int a = url.indexOf("://") + 3, b = url.indexOf('/', a);
  return url.substring(a, b < 0 ? url.length() : b);
}
static String htmlEscape(const String &s) {
  String o;
  for (char ch : s) {
    if (ch == '&') o += "&amp;"; else if (ch == '<') o += "&lt;"; else if (ch == '>') o += "&gt;";
    else if (ch == '"') o += "&quot;"; else o += ch;
  }
  return o;
}
static bool parseMac(const String &s, uint8_t out[6]) {
  unsigned v[6];
  if (sscanf(s.c_str(), "%x:%x:%x:%x:%x:%x", &v[0], &v[1], &v[2], &v[3], &v[4], &v[5]) != 6) return false;
  for (int i = 0; i < 6; i++) out[i] = (uint8_t)v[i];
  return true;
}

// ---------------------------------------------------------------- HTTPS
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
  int size = code > 0 ? http.getSize() : -1;
  if (size > 60000) {
    Serial.printf("[http] resposta de %d bytes ignorada\n", size);
    http.end(); tls.stop(); lastHost = "";
    out = String();
    return -2;
  }
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

// ---------------------------------------------------------------- login anônimo
static bool authBlocked = false;
static bool signUp() {
  String out;
  int code = request("POST", "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" FIREBASE_API_KEY,
                     "{\"returnSecureToken\":true}", out, false);
  if (code != 200) {
    String err = jsonErrorStatus(out);
    Serial.printf("[auth] signUp %d %s\n", code, err.c_str());
    if (err.indexOf("ADMIN_ONLY") >= 0 || err.indexOf("OPERATION_NOT_ALLOWED") >= 0) authBlocked = true;
    return false;
  }
  JsonDocument d;
  deserializeJson(d, out);
  idToken = d["idToken"] | "";
  refreshToken = d["refreshToken"] | "";
  uid = d["localId"] | "";
  tokenExpiresMs = millis() + (uint32_t)atoi(d["expiresIn"] | "3600") * 1000UL;
  rid = "";
  prefs.remove("rid");
  prefs.putString("uid", uid);
  prefs.putString("rt", refreshToken);
  Serial.printf("[auth] nova conta %s\n", uid.c_str());
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
    prefs.putString("uid", uid);
    prefs.putString("rt", refreshToken);
    return idToken.length() > 0;
  }
  Serial.printf("[auth] refresh %d %s\n", code, jsonErrorStatus(out).c_str());
  if (code == 400) refreshToken = "";
  return false;
}
static bool ensureToken(bool force = false) {
  if (!force && idToken.length() && (int32_t)(tokenExpiresMs - millis()) > 120000) return true;
  if (refreshToken.length() && refresh()) return true;
  if (refreshToken.length()) return false;
  return signUp();
}

// ---------------------------------------------------------------- Firestore
static String fsStr(JsonVariantConst f, const char *k) { return f[k]["stringValue"] | ""; }
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

// ---------------------------------------------------------------- impressora Bluetooth
static uint32_t lastBtTry = 0;
static bool btOn = false;

static bool printerReady() { return btOn && bt.connected(); }

static bool connectPrinter(bool force = false) {
  if (printerReady()) return true;
  if (!force && lastBtTry && millis() - lastBtTry < 20000) return false;
  lastBtTry = millis();
  if (!btOn) {
    btOn = bt.begin(BT_DEVICE_NAME, true);  // true = a placa conecta na impressora
    if (!btOn) { Serial.println("[bt] não iniciou"); return false; }
  }
  if (prnPin.length()) bt.setPin(prnPin.c_str(), prnPin.length());
  uint8_t mac[6];
  bool ok;
  Serial.printf("[bt] conectando em %s %s\n", prnName.c_str(), prnMac.c_str());
  if (parseMac(prnMac, mac)) ok = bt.connect(mac);
  else ok = bt.connect(prnName);
  Serial.printf("[bt] %s\n", ok ? "conectada" : "não conectou");
  if (ok) pos.begin(&bt, paperCols, printAccents);
  return ok;
}

static void finishTicket() {
  pos.feed(4);
  pos.cut();
  bt.flush();
  blinkUntil = millis() + 800;
}

static void printHeader() {
  pos.init();
  pos.align(1);
  pos.bold(true);
  pos.line("ACENAI");
  pos.bold(false);
}

static char pairCode[8] = "";
static uint32_t pairStarted = 0;
static bool codePrintPending = false;

static void printPairCode() {
  if (!pairCode[0] || !printerReady()) { codePrintPending = true; return; }
  codePrintPending = false;
  printHeader();
  pos.line("Impressora da cozinha");
  pos.line();
  pos.line("Codigo para conectar:");
  pos.size(2, 2);
  pos.bold(true);
  pos.line(String(pairCode).substring(0, 3) + " " + String(pairCode).substring(3));
  pos.bold(false);
  pos.size(1, 1);
  pos.line();
  pos.align(0);
  pos.wrap("Na central do Acenai, abra Pedidos e digite este codigo em \"Impressora da cozinha\".", paperCols);
  pos.wrap("Vale por 15 minutos. Depois disso aperte o botao BOOT da placa para imprimir outro.", paperCols);
  finishTicket();
}

static void printNotice(const String &title, const String &body) {
  if (!printerReady()) return;
  printHeader();
  pos.size(1, 2);
  pos.bold(true);
  pos.line(title);
  pos.bold(false);
  pos.size(1, 1);
  pos.align(0);
  pos.line();
  pos.wrap(body, paperCols);
  finishTicket();
}

static void printTest() {
  if (!printerReady()) return;
  printHeader();
  pos.line("Teste de impressao");
  pos.align(0);
  pos.rule();
  pos.line("Restaurante: " + (restaurantName.length() ? restaurantName : String("(nao conectada)")));
  pos.line("Nome: " + (myName.length() ? myName : String("-")));
  pos.line("Wi-Fi: " + ssid);
  pos.line("Papel: " + String(paperCols) + " colunas");
  pos.line("Versao: " ACENAI_VERSION);
  pos.rule();
  pos.line(printAccents ? "Acentos: ligados" : "Acentos: removidos");
  pos.line("Exemplo: Feijão, maçã, açaí, Pão");
  pos.size(2, 2);
  pos.line("MESA 12");
  pos.size(1, 1);
  finishTicket();
}

// ---------------------------------------------------------------- conexão ao restaurante
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
    w["update"]["fields"]["model"]["stringValue"] = "ESP32 impressora";
    JsonObject t = w["updateTransforms"].add<JsonObject>();
    t["fieldPath"] = "createdAt";
    t["setToServerValue"] = "REQUEST_TIME";
    w["currentDocument"]["exists"] = false;
    String out;
    int rc = fsCommit(b, out);
    if (rc == 200) {
      strlcpy(pairCode, code, sizeof(pairCode));
      pairStarted = millis();
      Serial.printf("[pair] código %s\n", code);
      return true;
    }
    Serial.printf("[pair] código recusado (%d) %s\n", rc, jsonErrorStatus(out).c_str());
    if (rc != 400 && rc != 409 && rc != 403) return false;
  }
  return false;
}

static void loadBrand() {
  JsonDocument d;
  if (fsGet("restaurants/" + rid + "/settings/brand?mask.fieldPaths=name", d) == 200) restaurantName = fsStr(d["fields"], "name");
}

static void applyMember(JsonVariantConst f) {
  String n = fsStr(f, "displayName");
  if (!n.length()) n = fsStr(f, "name");
  myName = n.length() ? n : "Impressora";
}

static bool firstCode = true;
/** Um passo do pareamento. Retorna true quando a impressora foi conectada ao restaurante. */
static bool pairingStep() {
  if (!pairCode[0] || millis() - pairStarted > PAIR_CODE_SECONDS * 1000UL) {
    dropPairCode();
    if (!newPairCode()) return false;
    if (firstCode) { firstCode = false; printPairCode(); }  // os próximos só pelo botão (economiza papel)
  }
  JsonDocument d;
  int code = fsGet("admins/" + uid + "?mask.fieldPaths=restaurantId&mask.fieldPaths=displayName&mask.fieldPaths=name", d);
  if (code != 200) return false;
  rid = fsStr(d["fields"], "restaurantId");
  if (!rid.length()) return false;
  prefs.putString("rid", rid);
  pairCode[0] = 0;
  codePrintPending = false;
  applyMember(d["fields"]);
  loadBrand();
  Serial.printf("[pair] conectada ao restaurante %s como %s\n", rid.c_str(), myName.c_str());
  printNotice("Conectada!", "Esta impressora agora faz parte de " + (restaurantName.length() ? restaurantName : String("seu restaurante")) +
                                ". As comandas dos pedidos feitos pelo cardapio saem aqui.");
  return true;
}

static bool paused = false;
static void checkAccess() {
  JsonDocument d;
  int code = fsGet("admins/" + uid + "?mask.fieldPaths=restaurantId&mask.fieldPaths=displayName&mask.fieldPaths=name", d);
  if (code == 404) {
    Serial.println("[acesso] impressora removida da equipe");
    rid = "";
    prefs.remove("rid");
    firstCode = true;
    printNotice("Desconectada", "Esta impressora foi removida do restaurante. Para conectar de novo, use o codigo que sai a seguir.");
    return;
  }
  if (code != 200) return;
  String r = fsStr(d["fields"], "restaurantId");
  if (r != rid) { rid = r; prefs.putString("rid", rid); loadBrand(); }
  applyMember(d["fields"]);
  JsonDocument g;
  if (fsGet("restaurants/" + rid + "/settings/general?mask.fieldPaths=suspended", g) == 200)
    paused = g["fields"]["suspended"]["booleanValue"] | false;
}

// ---------------------------------------------------------------- pedidos

static String queryBody;
static bool simpleQuery = false;  // se o Firestore pedir índice, consulta só printed == false
static uint32_t lastOrderSeenMs = 0;

/** Marca o pedido como impresso. Falha se outra impressora (ou a central) mexeu nele antes. */
static bool claim(const Pending &p, bool printed) {
  JsonDocument b;
  JsonObject w = b["writes"].add<JsonObject>();
  w["update"]["name"] = p.path;
  JsonObject f = w["update"]["fields"].to<JsonObject>();
  f["printed"]["booleanValue"] = printed;
  JsonArray mask = w["updateMask"]["fieldPaths"].to<JsonArray>();
  mask.add("printed");
  if (printed) {
    f["printCount"]["integerValue"] = String(p.printCount + 1);
    mask.add("printCount");
    JsonObject t = w["updateTransforms"].add<JsonObject>();
    t["fieldPath"] = "printedAt";
    t["setToServerValue"] = "REQUEST_TIME";
    w["currentDocument"]["updateTime"] = p.updateTime;
  } else {
    w["currentDocument"]["exists"] = true;
  }
  String out;
  int code = fsCommit(b, out);
  if (code != 200) Serial.printf("[pedido] marcar %s → %d %s\n", p.id.c_str(), code, jsonErrorStatus(out).c_str());
  return code == 200;
}

/** Lê o pedido completo e imprime a comanda. */
static bool printOrder(const Pending &p) {
  JsonDocument d;
  String rel = p.path.substring(p.path.indexOf("/documents/") + 11);
  if (fsGet(rel, d) != 200) return false;
  JsonVariantConst f = d["fields"];
  int table = atoi(f["tableNumber"]["integerValue"] | "0");
  String note = fsStr(f, "note");
  bool reprint = p.printCount > 0;

  pos.init();
  pos.beep();
  pos.align(1);
  if (restaurantName.length()) pos.line(restaurantName);
  pos.size(2, 2);
  pos.bold(true);
  pos.line("MESA " + String(table));
  pos.size(1, 1);
  pos.line("Pedido " + orderCode(p.id) + "  " + hhmm(p.createdMs));
  pos.bold(false);
  if (reprint) pos.line("*** REIMPRESSAO ***");
  pos.align(0);
  pos.rule();

  int count = 0;
  for (JsonVariantConst v : f["items"]["arrayValue"]["values"].as<JsonArrayConst>()) {
    JsonVariantConst it = v["mapValue"]["fields"];
    int qty = atoi(it["qty"]["integerValue"] | "1");
    String name = fsStr(it, "name");
    String opt = fsStr(it, "opt");
    String obs = fsStr(it, "obs");
    count += qty;
    pos.size(1, 2);
    pos.bold(true);
    pos.wrap(String(qty) + "x " + name, paperCols, 3);
    pos.bold(false);
    pos.size(1, 1);
    if (opt.length()) pos.wrap("   > " + opt, paperCols, 5);
    if (obs.length()) pos.wrap("   Obs: " + obs, paperCols, 8);
  }
  pos.rule();
  if (note.length()) {
    pos.bold(true);
    pos.line("OBSERVACAO DO PEDIDO:");
    pos.bold(false);
    pos.wrap(note, paperCols);
    pos.rule();
  }
  pos.line(String(count) + (count == 1 ? " item" : " itens") + "  -  impresso " + hhmm((int64_t)time(nullptr) * 1000));
  finishTicket();
  Serial.printf("[pedido] mesa %d %s impresso (%d itens)\n", table, orderCode(p.id).c_str(), count);
  return true;
}

/** Procura pedidos para imprimir. Retorna false se a consulta falhou. */
static bool poll() {
  if (!queryBody.length() && simpleQuery) {
    JsonDocument q;
    JsonObject sq = q["structuredQuery"].to<JsonObject>();
    sq["from"][0]["collectionId"] = "orders";
    JsonObject a = sq["where"]["fieldFilter"].to<JsonObject>();
    a["field"]["fieldPath"] = "printed";
    a["op"] = "EQUAL";
    a["value"]["booleanValue"] = false;
    sq["limit"] = 30;
    serializeJson(q, queryBody);
  }
  if (!queryBody.length()) {
    JsonDocument q;
    JsonObject sq = q["structuredQuery"].to<JsonObject>();
    sq["from"][0]["collectionId"] = "orders";
    JsonObject cf = sq["where"]["compositeFilter"].to<JsonObject>();
    cf["op"] = "AND";
    JsonObject a = cf["filters"].add<JsonObject>()["fieldFilter"].to<JsonObject>();
    a["field"]["fieldPath"] = "printed";
    a["op"] = "EQUAL";
    a["value"]["booleanValue"] = false;
    JsonObject s = cf["filters"].add<JsonObject>()["fieldFilter"].to<JsonObject>();
    s["field"]["fieldPath"] = "status";
    s["op"] = "IN";
    JsonArray vals = s["value"]["arrayValue"]["values"].to<JsonArray>();
    vals.add<JsonObject>()["stringValue"] = "NEW";
    vals.add<JsonObject>()["stringValue"] = "PREPARING";
    vals.add<JsonObject>()["stringValue"] = "READY";
    sq["limit"] = 10;
    serializeJson(q, queryBody);
  }
  String url = String(FS_BASE "/restaurants/") + rid + ":runQuery";
  String out;
  int code = request("POST", url, queryBody, out, true);
  if (code == 401 && ensureToken(true)) code = request("POST", url, queryBody, out, true);
  if (code == 403) { checkAccess(); return true; }
  if (code == 400 && !simpleQuery && jsonErrorStatus(out).indexOf("FAILED_PRECONDITION") >= 0) {
    Serial.println("[poll] o Firestore pediu um índice: usando a consulta simples");
    simpleQuery = true;
    queryBody = "";
    return false;
  }
  if (code != 200) { Serial.printf("[poll] %d %s\n", code, jsonErrorStatus(out).c_str()); return false; }

  JsonDocument filter;
  filter[0]["readTime"] = true;
  filter[0]["document"]["name"] = true;
  filter[0]["document"]["updateTime"] = true;
  filter[0]["document"]["fields"]["status"] = true;
  filter[0]["document"]["fields"]["createdAt"] = true;
  filter[0]["document"]["fields"]["printCount"] = true;
  JsonDocument d;
  if (deserializeJson(d, out, DeserializationOption::Filter(filter))) return false;

  static Pending list[30];
  int n = 0;
  int64_t nowMs = 0;
  for (JsonVariantConst row : d.as<JsonArrayConst>()) {
    if (!nowMs) nowMs = parseIsoMs(row["readTime"] | "");
    JsonVariantConst doc = row["document"];
    if (doc.isNull() || n >= 30) continue;
    JsonVariantConst f = doc["fields"];
    Pending &p = list[n];
    p.path = doc["name"] | "";
    p.id = p.path.substring(p.path.lastIndexOf('/') + 1);
    p.updateTime = doc["updateTime"] | "";
    p.createdMs = parseIsoMs(f["createdAt"]["timestampValue"] | "");
    p.printCount = atoi(f["printCount"]["integerValue"] | "0");
    String st = f["status"]["stringValue"] | "";
    if (st != "NEW" && st != "PREPARING" && st != "READY") continue;
    // pedido em andamento só sai de novo quando alguém clicou em "Reimprimir"
    if (st != "NEW" && p.printCount == 0) continue;
    // pedido esquecido de muitas horas atrás não sai do nada na cozinha
    if (p.printCount == 0 && nowMs && p.createdMs && nowMs - p.createdMs > MAX_ORDER_AGE_HOURS * 3600000LL) continue;
    n++;
  }
  if (nowMs > 1700000000000LL && time(nullptr) < 1700000000) {  // acerta o relógio pela hora do servidor
    struct timeval tv = {(time_t)(nowMs / 1000), 0};
    settimeofday(&tv, nullptr);
  }
  // mais antigo primeiro
  for (int i = 1; i < n; i++) {
    Pending tmp = list[i];
    int j = i - 1;
    while (j >= 0 && list[j].createdMs > tmp.createdMs) { list[j + 1] = list[j]; j--; }
    list[j + 1] = tmp;
  }
  if (n) lastOrderSeenMs = millis();

  for (int i = 0; i < n; i++) {
    if (!connectPrinter(true)) {
      Serial.println("[pedido] impressora desligada: o pedido espera");
      return true;
    }
    if (!claim(list[i], true)) continue;          // outra impressora pegou, ou mudou: vê na próxima
    bool ok = printOrder(list[i]);
    if (!ok || !printerReady()) claim(list[i], false);  // não saiu: volta para a fila
  }
  return true;
}

// ---------------------------------------------------------------- configuração pelo celular
static void runPortal() {
  ledMode = LED_PORTAL;
  Serial.println("[portal] procurando redes e impressoras...");
  // impressoras Bluetooth por perto (ligue a impressora antes)
  String prnOptions;
  if (bt.begin(BT_DEVICE_NAME, true)) {
    BTScanResults *r = bt.discover(8000);
    for (int i = 0; r && i < r->getCount() && i < 20; i++) {
      BTAdvertisedDevice *dev = r->getDevice(i);
      String mac = dev->getAddress().toString().c_str();
      String name = dev->haveName() ? String(dev->getName().c_str()) : String("(sem nome)");
      prnOptions += "<option value=\"" + htmlEscape(mac + "|" + name) + "\"" + (mac == prnMac ? " selected" : "") + ">" + htmlEscape(name) + " · " + mac + "</option>";
    }
    bt.end();
  }
  WiFi.disconnect(true);
  WiFi.mode(WIFI_AP_STA);
  int n = WiFi.scanNetworks();
  String netOptions, seen = "\n";
  for (int i = 0; i < n && i < 20; i++) {
    String s = WiFi.SSID(i);
    if (!s.length() || seen.indexOf("\n" + s + "\n") >= 0) continue;
    seen += s + "\n";
    netOptions += "<option value=\"" + htmlEscape(s) + "\"" + (s == ssid ? " selected" : "") + ">" + htmlEscape(s) + " (" + String(WiFi.RSSI(i)) + " dBm)</option>";
  }
  WiFi.scanDelete();

  if (!prnOptions.length()) prnOptions = "<option value=''>Nenhuma encontrada: ligue a impressora e toque em Procurar de novo</option>";

  WiFi.softAP(SETUP_AP_NAME);
  DNSServer dns;
  dns.start(53, "*", WiFi.softAPIP());
  WebServer server(80);
  bool saved = false, rescan = false;

  const String head = F("<!doctype html><html lang=pt-BR><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
                        "<title>Impressora Acenai</title><style>body{font-family:system-ui,sans-serif;max-width:440px;margin:24px auto;padding:0 16px;color:#16171b}"
                        "h1{font-size:1.4rem}h2{font-size:1.05rem;margin-top:26px}label{display:block;margin:14px 0 6px;font-weight:600}"
                        "select,input,button{width:100%;font-size:1rem;padding:12px;border-radius:10px;border:1px solid #ccc;box-sizing:border-box}"
                        ".row{display:flex;gap:10px}.row>*{flex:1}.chk{display:flex;gap:10px;align-items:center;font-weight:400}.chk input{width:auto}"
                        "button{background:#ff9a0a;border:0;font-weight:700;margin-top:18px}.sec{background:#eee}small{color:#666}</style>");

  server.on("/", HTTP_GET, [&]() {
    String p = head + "<h1>Impressora da cozinha</h1>"
               "<p>Escolha o Wi-Fi do restaurante e a impressora Bluetooth. Deixe a impressora ligada e perto da placa.</p>"
               "<form method=post action=/salvar>"
               "<h2>1. Wi-Fi</h2><label>Rede</label><select name=s>" + netOptions + "</select>"
               "<label>Ou digite o nome da rede</label><input name=o placeholder='Só se não estiver na lista'>"
               "<label>Senha</label><input name=p type=password autocomplete=off>"
               "<h2>2. Impressora</h2><label>Impressoras encontradas</label><select name=b>" + prnOptions + "</select>"
               "<label>Ou digite o endereço (MAC)</label><input name=m placeholder='Ex.: 66:22:B3:4C:1A:09' value=''>"
               "<div class=row><div><label>PIN</label><input name=pin value='" + htmlEscape(prnPin.length() ? prnPin : String(BT_DEFAULT_PIN)) + "' inputmode=numeric></div>"
               "<div><label>Papel</label><select name=c><option value=32" + (paperCols == 32 ? " selected" : "") + ">58 mm</option>"
               "<option value=48" + (paperCols == 48 ? " selected" : "") + ">80 mm</option></select></div></div>"
               "<label class=chk><input type=checkbox name=a value=1" + (printAccents ? " checked" : "") + "> Imprimir acentos (desligue se sair letra estranha)</label>"
               "<button>Salvar e conectar</button></form>"
               "<form method=post action=/procurar><button class=sec>Procurar impressoras de novo</button></form>"
               "<p><small>Acenai · impressora da cozinha · versão " ACENAI_VERSION "</small></p>";
    server.send(200, "text/html; charset=utf-8", p);
  });
  server.on("/procurar", HTTP_POST, [&]() {
    server.send(200, "text/html; charset=utf-8", head + "<h1>Procurando...</h1><p>Em uns 20 segundos, conecte de novo na rede <b>" SETUP_AP_NAME "</b>.</p>");
    rescan = true;
  });
  server.on("/salvar", HTTP_POST, [&]() {
    String s = server.arg("o");
    s.trim();
    if (!s.length()) s = server.arg("s");
    String b = server.arg("b"), m = server.arg("m"), name;
    m.trim();
    if (m.length()) name = "";
    else { int bar = b.indexOf('|'); m = bar > 0 ? b.substring(0, bar) : ""; name = bar > 0 ? b.substring(bar + 1) : ""; }
    uint8_t mac[6];
    if (!s.length() || !parseMac(m, mac)) {
      server.send(200, "text/html; charset=utf-8", head + "<h1>Falta escolher</h1><p>Escolha a rede Wi-Fi e uma impressora (ou digite o endereço dela).</p><p><a href=/>Voltar</a></p>");
      return;
    }
    prefs.putString("ssid", s);
    prefs.putString("pass", server.arg("p"));
    prefs.putString("pmac", m);
    prefs.putString("pname", name);
    prefs.putString("ppin", server.arg("pin"));
    prefs.putInt("cols", server.arg("c").toInt() == 48 ? 48 : 32);
    prefs.putBool("acc", server.arg("a") == "1");
    server.send(200, "text/html; charset=utf-8",
                head + "<h1>Pronto!</h1><p>A placa vai reiniciar, conectar em <b>" + htmlEscape(s) +
                       "</b> e imprimir um código. Pode voltar o celular para o Wi-Fi normal.</p>");
    saved = true;
  });
  server.onNotFound([&]() {
    server.sendHeader("Location", "http://" + WiFi.softAPIP().toString() + "/", true);
    server.send(302, "text/plain", "");
  });
  server.begin();
  Serial.println("[portal] conecte o celular na rede " SETUP_AP_NAME);
  uint32_t doneAt = 0;
  for (;;) {
    dns.processNextRequest();
    server.handleClient();
    if ((saved || rescan) && !doneAt) doneAt = millis();
    if (doneAt && millis() - doneAt > 1500) {
      if (rescan) prefs.putBool("portal", true);  // volta direto para a configuração
      ESP.restart();
    }
    vTaskDelay(pdMS_TO_TICKS(5));
  }
}

static void factoryReset() {
  Serial.println("[botao] apagando Wi-Fi e impressora");
  prefs.remove("ssid");
  prefs.remove("pass");
  prefs.remove("pmac");
  prefs.remove("pname");
  delay(300);
  ESP.restart();
}

// ---------------------------------------------------------------- programa
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\nAcenai · impressora da cozinha " ACENAI_VERSION);
  xTaskCreatePinnedToCore(uiTask, "acenai-ui", 2048, nullptr, 1, nullptr, 1);

  prefs.begin("acenai", false);
  ssid = prefs.getString("ssid", "");
  pass = prefs.getString("pass", "");
  prnMac = prefs.getString("pmac", "");
  prnName = prefs.getString("pname", "");
  prnPin = prefs.getString("ppin", BT_DEFAULT_PIN);
  paperCols = prefs.getInt("cols", 32);
  printAccents = prefs.getBool("acc", false);
  uid = prefs.getString("uid", "");
  refreshToken = prefs.getString("rt", "");
  rid = prefs.getString("rid", "");

  bool forcePortal = prefs.getBool("portal", false);
  if (forcePortal) prefs.remove("portal");
  if (!ssid.length() || !prnMac.length() || forcePortal) runPortal();

  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(true);  // necessário para Wi-Fi e Bluetooth funcionarem juntos
  WiFi.setAutoReconnect(true);
  WiFi.begin(ssid.c_str(), pass.c_str());
  configTzTime(ACENAI_TZ, "pool.ntp.org", "time.google.com");
  tls.setCACert(GOOGLE_ROOT_CAS);
  connectPrinter(true);
}

void loop() {
  static uint32_t lastPoll = 0, lastAccess = 0, wifiDownAt = 0;
  static bool wasPaired = false;

  if (btnLong) { btnLong = false; factoryReset(); }

  // Wi-Fi
  if (WiFi.status() != WL_CONNECTED) {
    ledMode = LED_CONNECTING;
    if (!wifiDownAt) wifiDownAt = millis();
    if (millis() - wifiDownAt > 30000) {  // não voltou sozinho: tenta de novo
      Serial.println("[wifi] tentando de novo");
      WiFi.disconnect();
      WiFi.begin(ssid.c_str(), pass.c_str());
      wifiDownAt = millis();
      tls.stop();
      lastHost = "";
    }
    if (btnShort) { btnShort = false; connectPrinter(true); printTest(); }
    delay(500);
    return;
  }
  wifiDownAt = 0;

  // impressora (tenta reconectar a cada 20 s)
  connectPrinter();
  if (codePrintPending && printerReady()) printPairCode();

  if (!ensureToken()) {
    ledMode = LED_ERROR;
    if (authBlocked) Serial.println("[auth] login anônimo desligado no Firebase: avise o suporte do Acenai");
    delay(authBlocked ? 30000 : 5000);
    return;
  }

  // ainda não conectada ao restaurante: mostra o código
  if (!rid.length()) {
    ledMode = LED_PAIRING;
    wasPaired = false;
    if (btnShort) { btnShort = false; connectPrinter(true); printPairCode(); }
    if (pairingStep()) { lastAccess = millis(); lastPoll = 0; wasPaired = true; }
    delay(3000);
    return;
  }
  if (!wasPaired) {
    wasPaired = true;
    loadBrand();
    checkAccess();
    lastAccess = millis();
    if (!rid.length()) return;
  }

  ledMode = printerReady() ? (paused ? LED_ERROR : LED_READY) : LED_NO_PRINTER;
  if (btnShort) { btnShort = false; connectPrinter(true); printTest(); }

  if (millis() - lastAccess > ACCESS_CHECK_SECONDS * 1000UL) {
    checkAccess();
    lastAccess = millis();
    if (!rid.length()) return;
  }
  bool idle = !lastOrderSeenMs || millis() - lastOrderSeenMs > IDLE_AFTER_MINUTES * 60000UL;
  uint32_t every = (idle ? IDLE_POLL_SECONDS : POLL_SECONDS) * 1000UL;
  if (!paused && (!lastPoll || millis() - lastPoll > every)) {
    poll();
    lastPoll = millis();
  }
  delay(100);
}
