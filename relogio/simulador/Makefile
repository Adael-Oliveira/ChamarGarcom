# Simulador das telas do relógio (Linux/macOS, gcc).
# Gera out/*.ppm (240x240) a partir do mesmo acenai-relogio.ino.
#   make LVGL=~/Arduino/libraries/lvgl && ./sim
LVGL ?= $(HOME)/Arduino/libraries/lvgl
R = ../acenai-relogio
CFLAGS = -O1 -w -DLV_CONF_INCLUDE_SIMPLE -I stubs -I $(LVGL) -I $(LVGL)/src
SRCS = $(shell find $(LVGL)/src -name '*.c')
OBJS = $(patsubst $(LVGL)/%.c,obj/%.o,$(SRCS))
FONTS = $(wildcard $(R)/acn_*.c)
FOBJS = $(patsubst $(R)/%.c,obj/fonts/%.o,$(FONTS))
sim: $(OBJS) $(FOBJS) sim.cpp $(R)/acenai-relogio.ino $(R)/shared.h $(R)/config.h
	mkdir -p out
	g++ -std=gnu++17 -O1 -w -DLV_CONF_INCLUDE_SIMPLE -I stubs -I $(LVGL) -I $(LVGL)/src -I $(R) sim.cpp $(OBJS) $(FOBJS) -o sim -lm
obj/%.o: $(LVGL)/%.c
	@mkdir -p $(dir $@); gcc $(CFLAGS) -c $< -o $@
obj/fonts/%.o: $(R)/%.c
	@mkdir -p $(dir $@); gcc $(CFLAGS) -c $< -o $@
