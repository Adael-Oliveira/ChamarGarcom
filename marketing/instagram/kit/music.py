# Trilha leve gerada em código: pad + arpejo dedilhado + batida suave, ~104 bpm.
import numpy as np, soundfile as sf, sys
SR = 44100; T = float(sys.argv[1]); BPM = float(sys.argv[2]); TR = int(sys.argv[3]); beat = 60 / BPM
n = int(SR * T); out = np.zeros((n, 2))
def note(f): return 440 * 2 ** ((f + TR - 69) / 12)
CH = [[53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62], [57, 60, 64, 67]]  # Fmaj7 G7sus Em7 Am7
t = np.arange(n) / SR
rng = np.random.default_rng(3)
def add(sig, start, pan=0.0, g=1.0):
    i = int(start * SR); j = min(n, i + len(sig))
    if i >= n: return
    s = sig[:j - i] * g
    out[i:j, 0] += s * (1 - pan) ; out[i:j, 1] += s * (1 + pan)
bar = 4 * beat
for b in range(int(T / bar) + 1):
    ch = CH[b % 4]; st = b * bar
    # pad
    L = int(bar * SR) + SR // 2; tt = np.arange(L) / SR
    env = np.minimum(1, tt / .35) * np.exp(-tt * .25)
    pad = sum(np.sin(2 * np.pi * note(m) * tt + .3 * np.sin(2 * np.pi * .5 * tt)) + .25 * np.sin(2 * np.pi * 2 * note(m) * tt) for m in ch) * env * .045
    add(pad, st)
    # baixo
    L2 = int(beat * 2 * SR); tb = np.arange(L2) / SR
    for k in range(2): add(np.sin(2 * np.pi * note(ch[0] - 12) * tb) * np.exp(-tb * 2.2) * .16, st + k * 2 * beat)
    # arpejo (colcheias)
    for k in range(8):
        m = ch[[0, 1, 2, 3, 2, 1, 2, 3][k]] + 12; L3 = int(.5 * SR); ta = np.arange(L3) / SR
        pl = (np.sin(2 * np.pi * note(m) * ta) + .4 * np.sin(2 * np.pi * 2 * note(m) * ta) + .15 * np.sin(2 * np.pi * 3 * note(m) * ta)) * np.exp(-ta * 9) * .06
        add(pl, st + k * beat / 2, pan=.35 if k % 2 else -.35)
    # batida
    for k in range(4):
        L4 = int(.25 * SR); tk = np.arange(L4) / SR
        kick = np.sin(2 * np.pi * (55 + 90 * np.exp(-tk * 30)) * tk) * np.exp(-tk * 14) * .32
        add(kick, st + k * beat)
        hat = rng.standard_normal(int(.05 * SR)) * np.exp(-np.arange(int(.05 * SR)) / SR * 90) * .03
        add(np.diff(hat, prepend=0), st + k * beat + beat / 2, pan=.2)
        if k in (1, 3):
            sn = rng.standard_normal(int(.18 * SR)) * np.exp(-np.arange(int(.18 * SR)) / SR * 22) * .045
            add(sn, st + k * beat)
# fade in/out
fi = int(.05 * SR); fo = int(1.2 * SR)
out[:fi] *= np.linspace(0, 1, fi)[:, None]; out[-fo:] *= np.linspace(1, 0, fo)[:, None]
out /= np.abs(out).max() / .7
sf.write(sys.argv[4], out, SR)
