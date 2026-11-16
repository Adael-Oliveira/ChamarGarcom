// =====================================================================
//  Comandos ESC/POS (padrão das impressoras térmicas de 58 e 80 mm)
//  e conversão do texto (UTF-8) para a página de código da impressora.
// =====================================================================
#pragma once
#include <Arduino.h>

class EscPos {
 public:
  Stream *out = nullptr;
  int cols = 32;          // 58 mm = 32 colunas; 80 mm = 48 colunas
  bool accents = false;   // true = imprime acentos (página CP850); false = remove

  void begin(Stream *s, int columns, bool withAccents) {
    out = s;
    cols = columns;
    accents = withAccents;
  }
  void raw(uint8_t b) { if (out) out->write(b); }
  void raw(const uint8_t *b, size_t n) { if (out) out->write(b, n); }

  void init() {
    const uint8_t c[] = {0x1B, 0x40};  // ESC @
    raw(c, 2);
    if (accents) { const uint8_t t[] = {0x1B, 0x74, 2}; raw(t, 3); }  // ESC t 2 = CP850
  }
  void align(uint8_t a) { const uint8_t c[] = {0x1B, 0x61, a}; raw(c, 3); }  // 0 esq, 1 centro, 2 dir
  void bold(bool on) { const uint8_t c[] = {0x1B, 0x45, (uint8_t)on}; raw(c, 3); }
  // tamanho: 1 = normal, 2 = dobro (largura e altura)
  void size(uint8_t w, uint8_t h) { const uint8_t c[] = {0x1D, 0x21, (uint8_t)(((w - 1) << 4) | (h - 1))}; raw(c, 3); }
  void feed(uint8_t n) { const uint8_t c[] = {0x1B, 0x64, n}; raw(c, 3); }
  void cut() { const uint8_t c[] = {0x1D, 0x56, 0x42, 0x00}; raw(c, 4); }  // corta (se a impressora tiver guilhotina)
  void beep() { const uint8_t c[] = {0x1B, 0x42, 2, 2}; raw(c, 4); }       // bipe (só em algumas)

  void text(const String &s) {
    String t = convert(s);
    raw((const uint8_t *)t.c_str(), t.length());
  }
  void line(const String &s = "") { text(s); raw('\n'); }
  void rule(char ch = '-') { String r; for (int i = 0; i < cols; i++) r += ch; line(r); }

  /** Texto que quebra em várias linhas sem cortar palavras. `indent` = recuo das linhas seguintes. */
  void wrap(const String &s, int width, int indent = 0) {
    String t = convert(s), cur;
    int start = 0;
    bool first = true;
    while (start < (int)t.length()) {
      int avail = width - (first ? 0 : indent);
      if (avail < 4) avail = 4;
      int end = start + avail;
      if (end >= (int)t.length()) end = t.length();
      else {
        int sp = t.lastIndexOf(' ', end);
        if (sp > start) end = sp;
      }
      String piece = t.substring(start, end);
      piece.trim();
      if (!first) for (int i = 0; i < indent; i++) raw(' ');
      raw((const uint8_t *)piece.c_str(), piece.length());
      raw('\n');
      start = end;
      while (start < (int)t.length() && t[start] == ' ') start++;
      first = false;
    }
  }

  /** Converte UTF-8 para CP850 (com acentos) ou para ASCII (sem acentos). */
  String convert(const String &in) const {
    String o;
    o.reserve(in.length());
    const uint8_t *p = (const uint8_t *)in.c_str();
    while (*p) {
      uint32_t cp;
      if (*p < 0x80) cp = *p++;
      else if ((*p & 0xE0) == 0xC0 && p[1]) { cp = ((p[0] & 0x1F) << 6) | (p[1] & 0x3F); p += 2; }
      else if ((*p & 0xF0) == 0xE0 && p[1] && p[2]) { cp = ((p[0] & 0x0F) << 12) | ((p[1] & 0x3F) << 6) | (p[2] & 0x3F); p += 3; }
      else if ((*p & 0xF8) == 0xF0 && p[1] && p[2] && p[3]) { p += 4; cp = '?'; }  // emoji etc.
      else { p++; continue; }
      if (cp == '\r' || cp == '\t') cp = ' ';
      if (cp < 0x80) { o += (char)cp; continue; }
      if (accents) {
        uint8_t c = cp850(cp);
        if (c) { o += (char)c; continue; }
      }
      o += ascii(cp);
    }
    return o;
  }

 private:
  static uint8_t cp850(uint32_t c) {
    switch (c) {
      case 0xE1: return 0xA0; case 0xE0: return 0x85; case 0xE2: return 0x83; case 0xE3: return 0xC6;
      case 0xE9: return 0x82; case 0xE8: return 0x8A; case 0xEA: return 0x88;
      case 0xED: return 0xA1; case 0xF3: return 0xA2; case 0xF4: return 0x93; case 0xF5: return 0xE4;
      case 0xFA: return 0xA3; case 0xFC: return 0x81; case 0xE7: return 0x87; case 0xF1: return 0xA4;
      case 0xC1: return 0xB5; case 0xC0: return 0xB7; case 0xC2: return 0xB6; case 0xC3: return 0xC7;
      case 0xC9: return 0x90; case 0xCA: return 0xD2; case 0xCD: return 0xD6;
      case 0xD3: return 0xE0; case 0xD4: return 0xE2; case 0xD5: return 0xE5;
      case 0xDA: return 0xE9; case 0xC7: return 0x80; case 0xD1: return 0xA5;
      case 0xBA: return 0xA7; case 0xAA: return 0xA6; case 0xB0: return 0xF8;
      default: return 0;
    }
  }
  static const char *ascii(uint32_t c) {
    switch (c) {
      case 0xE1: case 0xE0: case 0xE2: case 0xE3: case 0xE4: return "a";
      case 0xC1: case 0xC0: case 0xC2: case 0xC3: case 0xC4: return "A";
      case 0xE9: case 0xE8: case 0xEA: case 0xEB: return "e";
      case 0xC9: case 0xC8: case 0xCA: case 0xCB: return "E";
      case 0xED: case 0xEC: case 0xEE: case 0xEF: return "i";
      case 0xCD: case 0xCC: case 0xCE: case 0xCF: return "I";
      case 0xF3: case 0xF2: case 0xF4: case 0xF5: case 0xF6: return "o";
      case 0xD3: case 0xD2: case 0xD4: case 0xD5: case 0xD6: return "O";
      case 0xFA: case 0xF9: case 0xFB: case 0xFC: return "u";
      case 0xDA: case 0xD9: case 0xDB: case 0xDC: return "U";
      case 0xE7: return "c"; case 0xC7: return "C";
      case 0xF1: return "n"; case 0xD1: return "N";
      case 0xBA: return "o"; case 0xAA: return "a"; case 0xB0: return "o";
      case 0x2013: case 0x2014: return "-";
      case 0x2018: case 0x2019: return "'";
      case 0x201C: case 0x201D: return "\"";
      case 0x2026: return "...";
      case 0x00D7: return "x";
      case 0x00A0: return " ";
      default: return "?";
    }
  }
};
