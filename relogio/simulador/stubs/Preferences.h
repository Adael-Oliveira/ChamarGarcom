#pragma once
struct Preferences {
  bool begin(const char *, bool) { return true; }
  bool getBool(const char *, bool d) { return d; }
  void putBool(const char *, bool) {}
};
