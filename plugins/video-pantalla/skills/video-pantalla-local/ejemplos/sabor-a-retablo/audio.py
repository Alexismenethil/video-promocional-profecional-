#!/usr/bin/env python3
"""Banda sonora de 15 s para Sabor a Retablo.

Huayno-pop a 120 BPM en La menor: charango rasgueado (Karplus-Strong), quena
(aditiva + soplo), bombo legüero, chajchas y bajo, más los efectos que marca la
imagen. Todo sale de cues.js, así sonido e imagen comparten un solo reloj.
El final da la vuelta sobre el comienzo: la pieza es un bucle sin costura.
"""
import json
import os
import re
import sys

import numpy as np
from scipy.signal import fftconvolve, lfilter

FS = 48000
ROOT = os.path.dirname(os.path.abspath(__file__))
C = json.loads(re.sub(r"^\s*window\.CUES\s*=\s*|;\s*$", "", open(os.path.join(ROOT, "cues.js")).read().strip()))
D = json.loads(re.sub(r"^\s*window\.DATOS\s*=\s*|;\s*$", "", open(os.path.join(ROOT, "assets", "datos.js")).read().strip()))
DUR = C["dur"]
BEAT = 60.0 / C["bpm"]           # 0.5 s
S16 = BEAT / 4                   # semicorchea
TOTAL = DUR + 4.0                # se renderiza de más y la cola se pliega al inicio
N = int(TOTAL * FS)
rng = np.random.default_rng(2026)

BUSES = ["bombo", "bajo", "charango", "quena", "campanas", "chajchas", "fx", "colchon"]
bus = {b: np.zeros((2, N)) for b in BUSES}


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(b, sig, t0, gain=1.0, pan=0.0):
    """Suma una señal mono (o estéreo) al bus con paneo de potencia constante."""
    i0 = int(round(t0 * FS))
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.vstack([np.cos(a) * sig, np.sin(a) * sig])
    if i0 < 0:
        sig = sig[:, -i0:]
        i0 = 0
    n = min(sig.shape[1], N - i0)
    if n > 0:
        bus[b][:, i0:i0 + n] += gain * sig[:, :n]


# ───────────────────────── filtros ─────────────────────────
def biquad(kind, f0, q=0.707, db=0.0):
    f0 = min(max(f0, 10.0), FS * 0.45)
    A = 10 ** (db / 40)
    w = 2 * np.pi * f0 / FS
    al = np.sin(w) / (2 * q)
    cw = np.cos(w)
    if kind == "lp":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == "hp":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == "bp":
        b = [al, 0, -al]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == "peak":
        b = [1 + al * A, -2 * cw, 1 - al * A]; a = [1 + al / A, -2 * cw, 1 - al / A]
    elif kind == "hs":
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) + (A - 1) * cw + sq), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sq)]
        a = [(A + 1) - (A - 1) * cw + sq, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sq]
    elif kind == "ls":
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) - (A - 1) * cw + sq), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sq)]
        a = [(A + 1) + (A - 1) * cw + sq, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sq]
    b = np.array(b) / a[0]
    a = np.array(a) / a[0]
    return b, a


def filt(x, *specs):
    for s in specs:
        b, a = biquad(*s)
        x = lfilter(b, a, x, axis=-1)
    return x


def barrido(x, f_de, f_a, q=2.0, kind="bp", curva=None, bloque=128):
    """Filtro que se mueve en el tiempo (por bloques, con estado)."""
    n = len(x)
    out = np.zeros(n)
    zi = np.zeros(2)
    for i in range(0, n, bloque):
        u = i / max(1, n - 1)
        if curva is not None:
            u = curva(u)
        f = f_de * (f_a / f_de) ** u
        b, a = biquad(kind, f, q)
        y, zi = lfilter(b, a, x[i:i + bloque], zi=zi)
        out[i:i + bloque] = y
    return out


def env_ar(n, att, rel_tau):
    t = np.arange(n) / FS
    e = np.exp(-t / rel_tau)
    na = max(1, int(att * FS))
    e[:na] *= np.linspace(0, 1, na)
    return e


# ───────────────────────── instrumentos ─────────────────────────
def cuerda(f, dur, vel=1.0, t60=1.7, brillo=0.6):
    """Karplus-Strong con retardo fraccional (pasatodo) para afinar exacto."""
    n = int(dur * FS)
    D = FS / f
    Nd = int(np.floor(D - 0.6))
    d = D - 0.5 - Nd
    c = (1 - d) / (1 + d)
    g = 10 ** (-3 / (t60 * f))
    exc = rng.uniform(-1, 1, Nd + 2)
    p = 0.15 + (1 - brillo) * 0.65
    exc = lfilter([1 - p], [1, -p], exc)
    k = max(1, int(Nd * 0.14))           # posición de la púa
    exc[k:] -= 0.55 * exc[:-k]
    exc -= exc.mean()
    x = np.zeros(n)
    x[:len(exc)] = exc * vel
    b = [1.0, c]
    a = np.zeros(Nd + 3)
    a[0] = 1.0
    a[1] = c
    a[Nd] -= g / 2 * c
    a[Nd + 1] -= g / 2 * (1 + c)
    a[Nd + 2] -= g / 2
    return lfilter(b, a, x)


# Charango: 5 órdenes dobles (sol, do, mi-octava, la, mi), en orden de rasgueo.
ACORDES = {
    "Am":    [69, 69, 72, 72, 76, 64, 69, 69, 76, 76],
    "C":     [67, 67, 72, 72, 76, 64, 72, 72, 76, 76],
    "G":     [67, 67, 74, 74, 79, 67, 71, 71, 79, 79],
    "E7":    [68, 68, 74, 74, 76, 64, 71, 71, 76, 76],
    "F":     [69, 69, 72, 72, 77, 65, 69, 69, 77, 77],
    "A":     [69, 69, 73, 73, 76, 64, 69, 69, 76, 76],
    "Asus2": [69, 69, 76, 76, 76, 64, 71, 71, 76, 76],
    "D":     [69, 69, 74, 74, 78, 66, 69, 69, 78, 78],
}
DETUNE = [-3, 3, -2, 2, 0, 1, -3, 3, -2, 2]   # centésimas: el coro natural de las cuerdas dobles


def rasgueo(acorde, t0, vel=0.8, abajo=True, lapso=0.022, dur=1.4, brillo=0.62):
    notas = ACORDES[acorde]
    orden = range(10) if abajo else range(9, -1, -1)
    for k, i in enumerate(orden):
        m = notas[i]
        f = hz(m) * 2 ** (DETUNE[i] / 1200)
        v = vel * rng.uniform(0.82, 1.0) * (1.0 if abajo else 0.8)
        s = cuerda(f, dur, v, t60=1.5 + rng.uniform(-0.2, 0.2), brillo=brillo)
        add("charango", s, t0 + k * lapso / 10 + rng.normal(0, 0.0015), 0.11, pan=-0.52 + 0.58 * (i / 9))


def arpegio(notas, t0, paso, vel=0.4, dur=1.6):
    for k, m in enumerate(notas):
        s = cuerda(hz(m), dur, vel * rng.uniform(0.85, 1.0), t60=1.9, brillo=0.5)
        add("charango", s, t0 + k * paso, 0.16, pan=-0.3 + 0.38 * np.sin(1.7 * k))


def quena(t0, dur, m, vel=0.8, vibrato=1.0):
    f0 = hz(m)
    rel = 0.1
    n = int((dur + rel) * FS)
    t = np.arange(n) / FS
    cents = -32 * np.exp(-t / 0.028)
    prof = 16 * vibrato * np.clip((t - 0.1) / 0.3, 0, 1)
    cents = cents + prof * np.sin(2 * np.pi * 5.3 * t + rng.uniform(0, 6.28))
    deriva = lfilter([0.002], [1, -0.998], rng.normal(0, 1, n)) * 3
    f = f0 * 2 ** ((cents + deriva) / 1200)
    ph = 2 * np.pi * np.cumsum(f) / FS
    tono = np.sin(ph) + 0.2 * np.sin(2 * ph + 0.4) + 0.085 * np.sin(3 * ph + 1.1) + 0.03 * np.sin(4 * ph)
    ruido = rng.normal(0, 1, n)
    soplo = filt(ruido, ("bp", min(2.3 * f0, 6500), 0.9)) * 0.55 + filt(ruido, ("hp", 5200)) * 0.05
    att = 0.035
    env = np.ones(n)
    na = int(att * FS)
    env[:na] = np.linspace(0, 1, na) ** 1.5
    env *= 1 + 0.06 * np.sin(np.pi * np.clip(t / max(dur, 0.05), 0, 1))
    nr = int(rel * FS)
    ns = n - nr
    env[ns:] *= np.linspace(1, 0, nr) ** 2
    turb = 1 + 0.05 * lfilter([0.02], [1, -0.98], rng.normal(0, 1, n))
    chiff = filt(ruido, ("bp", 3 * f0, 1.5)) * np.exp(-t / 0.018) * 0.9
    s = (0.78 * tono * turb + 0.22 * soplo) * env + chiff * 0.35
    add("quena", s, t0, 0.2 * vel, pan=0.22)


def campana(t0, m, vel=0.6, pan=0.0, dec=1.1):
    f = hz(m)
    n = int(2.4 * FS)
    t = np.arange(n) / FS
    I = 2.0 * np.exp(-t / 0.22)
    s = np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * 3.5 * t)) * np.exp(-t / dec)
    s += 0.22 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.3)
    s *= np.minimum(1, t / 0.002)
    add("campanas", s, t0, 0.1 * vel, pan=pan)


def bombo(t0, vel=0.8):
    n = int(0.6 * FS)
    t = np.arange(n) / FS
    f = 50 + 75 * np.exp(-t / 0.03)
    cuerpo = np.sin(2 * np.pi * np.cumsum(f) / FS) * np.exp(-t / 0.24)
    parche = filt(rng.normal(0, 1, n), ("lp", 900), ("hp", 90)) * np.exp(-t / 0.018) * 0.5
    add("bombo", (cuerpo + parche) * np.minimum(1, t / 0.0015), t0, 0.62 * vel)


def aro(t0, vel=0.6):
    n = int(0.12 * FS)
    t = np.arange(n) / FS
    s = filt(rng.normal(0, 1, n), ("bp", 2300, 2.2)) * np.exp(-t / 0.012)
    s += 0.5 * np.sin(2 * np.pi * 820 * t) * np.exp(-t / 0.022)
    add("bombo", s, t0, 0.24 * vel, pan=0.1)


def golpe(t0, vel=0.8):
    n = int(0.45 * FS)
    t = np.arange(n) / FS
    f = 46 + 110 * np.exp(-t / 0.025)
    s = np.sin(2 * np.pi * np.cumsum(f) / FS) * np.exp(-t / 0.2)
    s += filt(rng.normal(0, 1, n), ("hp", 3000)) * np.exp(-t / 0.004) * 0.25
    add("bombo", s, t0, 0.55 * vel)


def palma(t0, vel=0.6):
    n = int(0.22 * FS)
    t = np.arange(n) / FS
    ruido = filt(rng.normal(0, 1, n), ("bp", 1250, 0.9))
    e = np.zeros(n)
    for d in (0.0, 0.009, 0.018):
        i = int(d * FS)
        e[i:] += np.exp(-(t[: n - i]) / 0.005)
    i = int(0.024 * FS)
    e[i:] += 0.8 * np.exp(-(t[: n - i]) / 0.06)
    add("bombo", ruido * e, t0, 0.22 * vel, pan=-0.05)


def chajcha(t0, vel=0.4, largo=0.07, pan=0.4):
    n = int((largo + 0.03) * FS)
    s = np.zeros(n)
    k = int(10 + 18 * vel)
    for _ in range(k):
        i = int(min(rng.exponential(largo / 3.5), largo) * FS)
        L = 90
        if i + L < n:
            s[i:i + L] += rng.normal(0, 1, L) * np.exp(-np.arange(L) / 16) * rng.uniform(0.3, 1)
    s = filt(s, ("hp", 3800), ("peak", 7000, 1.0, 4))
    add("chajchas", s, t0, 0.2 * vel, pan=pan)


def bajo(t0, m, dur, vel=0.8):
    f = hz(m)
    n = int((dur + 0.08) * FS)
    t = np.arange(n) / FS
    ph = 2 * np.pi * f * t
    s = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
    s = np.tanh(1.4 * s) / np.tanh(1.4)
    e = np.minimum(1, t / 0.004) * (0.55 + 0.45 * np.exp(-t / 0.12))
    nr = int(0.06 * FS)
    ns = int(dur * FS)
    e[ns:ns + nr] *= np.linspace(1, 0, min(nr, n - ns))
    e[ns + nr:] = 0
    s = filt(s * e, ("lp", 900))
    add("bajo", s, t0, 0.3 * vel)


def plop(t0, m, vel=0.8, pan=0.0):
    """El sonido de una bola que cae: una burbuja afinada."""
    f = hz(m)
    n = int(0.3 * FS)
    t = np.arange(n) / FS
    fi = f * (0.52 + 0.48 * (1 - np.exp(-t / 0.011))) * (1 + 0.05 * t)
    ph = 2 * np.pi * np.cumsum(fi) / FS
    s = (np.sin(ph) + 0.25 * np.sin(2 * ph) * np.exp(-t / 0.03)) * np.exp(-t / 0.085) * np.minimum(1, t / 0.0015)
    s += filt(rng.normal(0, 1, n), ("hp", 2500)) * np.exp(-t / 0.0025) * 0.25
    add("fx", s, t0, 0.2 * vel, pan=pan)


def madera(t0, vel=1.0, tono=1.0, pan=0.0):
    """Golpe de madera por síntesis modal: la puerta del retablo."""
    n = int(0.5 * FS)
    t = np.arange(n) / FS
    s = np.zeros(n)
    for f, dec, amp in [(168, 0.14, 1.0), (331, 0.1, 0.75), (566, 0.07, 0.6), (829, 0.05, 0.45),
                        (1236, 0.04, 0.32), (1851, 0.03, 0.22), (2710, 0.018, 0.14)]:
        s += amp * np.sin(2 * np.pi * f * tono * t + rng.uniform(0, 6.28)) * np.exp(-t / dec)
    s += filt(rng.normal(0, 1, n), ("bp", 1600, 1.2)) * np.exp(-t / 0.004) * 1.2
    f = 55 + 60 * np.exp(-t / 0.02)
    s += 0.9 * np.sin(2 * np.pi * np.cumsum(f) / FS) * np.exp(-t / 0.09)
    add("fx", s * np.minimum(1, t / 0.0008), t0, 0.26 * vel, pan=pan)


def soplido(t0, dur, f_de, f_a, vel=0.5, pan_de=0.0, pan_a=0.0, q=1.6, forma=None):
    """Whoosh: ruido filtrado que se mueve en frecuencia y en el estéreo."""
    n = int(dur * FS)
    u = np.linspace(0, 1, n)
    x = rng.normal(0, 1, n)
    s = barrido(x, f_de, f_a, q=q)
    e = np.sin(np.pi * u) ** 2 if forma is None else forma(u)
    s = s * e
    p = pan_de + (pan_a - pan_de) * u
    a = (p + 1) * np.pi / 4
    add("fx", np.vstack([np.cos(a) * s, np.sin(a) * s]), t0, 0.35 * vel)


def destello(t0, m, vel=0.3, pan=0.0):
    n = int(0.5 * FS)
    t = np.arange(n) / FS
    s = np.sin(2 * np.pi * hz(m) * t) * np.exp(-t / 0.12) * np.minimum(1, t / 0.001)
    add("campanas", s, t0, 0.06 * vel, pan=pan)


def colchon(t0, dur, notas, vel=0.5, ataque=0.35, suelta=0.6, corte=1600):
    n = int((dur + suelta) * FS)
    t = np.arange(n) / FS
    lados = []
    for lado in range(2):                      # cada canal con sus propias fases: un colchón ancho
        s = np.zeros(n)
        for m in notas:
            for dt in (-7, 0, 7):
                f = hz(m) * 2 ** ((dt + (lado - 0.5) * 4) / 1200)
                ph = (f * t + rng.uniform(0, 1)) % 1.0
                s += 2 * ph - 1
        s /= 3 * len(notas)
        lados.append(filt(s, ("lp", corte, 0.6), ("lp", corte * 1.4, 0.6), ("hp", 120)))
    e = np.minimum(1, t / ataque)
    ns = int(dur * FS)
    e[ns:] *= np.exp(-(t[ns:] - dur) / (suelta / 3))
    add("colchon", np.vstack(lados) * e * 0.7, t0, 0.16 * vel)


def chispas(t0, dur, n=10, vel=0.5, ancho=0.8, semilla=0):
    """Destellos sin afinación de escala: brillan sin chocar con ninguna tonalidad."""
    r = np.random.default_rng(900 + semilla)
    for k in range(n):
        f = r.uniform(3200, 7800)
        m = int(0.35 * FS)
        t = np.arange(m) / FS
        x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 1.51 * t) * np.exp(-t / 0.03)
        x *= np.exp(-t / r.uniform(0.05, 0.12)) * np.minimum(1, t / 0.0008)
        add("fx", x, t0 + dur * (k / n) ** 0.8 + r.uniform(0, 0.03), 0.05 * vel * r.uniform(0.5, 1), pan=r.uniform(-ancho, ancho))


def papel(t0, dur, n=36, vel=0.5):
    """Pétalos de papel: aleteos cortos y secos que se van espaciando."""
    r = np.random.default_rng(77)
    for k in range(n):
        m = int(0.05 * FS)
        t = np.arange(m) / FS
        x = filt(r.normal(0, 1, m), ("bp", r.uniform(1400, 4200), 1.4))
        e = np.exp(-t / 0.006) + 0.6 * np.exp(-np.maximum(t - 0.012, 0) / 0.005) * (t > 0.012)
        add("fx", x * e, t0 + dur * (k / n) ** 1.6, 0.05 * vel * r.uniform(0.4, 1), pan=r.uniform(-0.8, 0.8))


def siseo(t0, dur, vel=0.4):
    """El vapor de la taza: un soplo aireado que respira."""
    m = int(dur * FS)
    u = np.linspace(0, 1, m)
    x = filt(rng.normal(0, 1, m), ("bp", 4800, 1.1), ("lp", 8000))
    e = np.sin(np.pi * u) ** 1.5 * (0.7 + 0.3 * np.sin(2 * np.pi * 1.3 * u * dur))
    add("fx", x * e, t0, 0.02 * vel, pan=0.35)


# ───────────────────────── partitura ─────────────────────────
ACORDE_EN = ["Asus2", "Asus2", "F", "F", "G", "E7", "Am", "Am", "C", "C", "G", "G", "Am", "E7",
             "Am", "Am", "C", "C", "G", "G", "Am", "F", "G", "E7", "A", "A", "A", "D", "A", "A"]
RAIZ = {"Am": (45, 40), "C": (48, 43), "G": (43, 38), "E7": (40, 47), "F": (41, 48), "A": (45, 40), "D": (38, 45), "Asus2": (45, 40)}

def tb(beat, paso=0):
    return beat * BEAT + paso * S16

# — introducción: el retablo se centra y se abre —
arpegio([69, 76, 71, 76, 81, 76, 71, 76], 0.0, S16, vel=0.62)
bajo(0.0, 45, 0.95, 0.4)
for k in range(4):
    chajcha(tb(k // 2, 2 * (k % 2) + 0), 0.18)
soplido(0.08, 0.6, 500, 2400, vel=0.25, pan_de=0.3, pan_a=-0.1)
madera(0.97, 0.22, tono=2.2, pan=0.0)                         # el pestillo
soplido(C["puertaIzq"], 0.55, 300, 1200, vel=0.4, pan_de=-0.1, pan_a=-0.7, q=1.2)
soplido(C["puertaDer"], 0.55, 300, 1200, vel=0.4, pan_de=0.1, pan_a=0.7, q=1.2)
rasgueo("F", 1.0, 0.55, lapso=0.07)
bajo(1.0, 29, 0.95, 0.6)
bombo(1.0, 0.45)
for k, m in enumerate([77, 81, 84, 89, 93, 96]):                 # la luz: campanas en Fa
    campana(1.02 + k * 0.07, m, 0.7 - k * 0.06, pan=-0.5 + k * 0.2)
for k, m in enumerate([77, 79, 81, 84, 86, 89, 91, 93]):        # los pétalos: glissando de charango
    arpegio([m], C["estallido"] + 0.05 + k * 0.035, 0.0, vel=0.28, dur=1.0)
rasgueo("F", 1.5, 0.35, abajo=False, lapso=0.05)
chajcha(1.5, 0.25)

colchon(0.0, 1.0, [57, 64, 69, 71], 0.55, ataque=0.05)
colchon(1.0, 1.0, [53, 60, 65, 69], 0.75)
colchon(2.0, 0.5, [55, 62, 67, 71], 0.8, ataque=0.1)
colchon(2.5, 0.5, [52, 59, 64, 68], 0.9, ataque=0.1, corte=2400)

# — empuje hacia la hornacina: subida —
rasgueo("G", 2.0, 0.5)
rasgueo("G", 2.25, 0.3, abajo=False)
rasgueo("E7", 2.5, 0.55)
rasgueo("E7", 2.75, 0.45, abajo=False, lapso=0.015)
rasgueo("E7", 2.875, 0.6, lapso=0.015)
bajo(2.0, 31, 0.48, 0.6)
bajo(2.5, 28, 0.48, 0.7)
for k in range(16):                                            # redoble del bombo
    u = k / 15
    bombo(2.0 + k * S16, 0.12 + 0.55 * u ** 1.6)
    chajcha(2.0 + k * S16, 0.15 + 0.4 * u, largo=0.05, pan=0.35 - 0.7 * (k % 2))
n = int(1.0 * FS)
u = np.linspace(0, 1, n)
sube = barrido(rng.normal(0, 1, n), 350, 7500, q=2.5, curva=lambda x: x ** 1.3) * u ** 2.2
add("fx", sube, C["empuje"][0] + 0.1, 0.14, pan=0.0)
fsw = 220 * (4.0 ** u)
tono = np.sin(2 * np.pi * np.cumsum(fsw) / FS) * u ** 2 * (0.6 + 0.4 * np.sin(2 * np.pi * (6 + 18 * u) * u))
add("fx", tono, C["empuje"][0], 0.05)
quena(2.25, 0.25, 76, 0.55)
quena(2.5, 0.25, 79, 0.6)
quena(2.75, 0.22, 83, 0.7)

# — impacto: caemos en el café —
golpe(3.0, 1.1)
bombo(3.0, 1.0)
n = int(1.6 * FS)
t = np.arange(n) / FS
boom = np.sin(2 * np.pi * np.cumsum(42 + 48 * np.exp(-t / 0.08)) / FS) * np.exp(-t / 0.38)
add("fx", boom, 3.0, 0.32)
crash = filt(rng.normal(0, 1, n), ("hp", 900)) * np.exp(-t / 0.45) * np.minimum(1, t / 0.002)
add("fx", np.vstack([crash, filt(rng.normal(0, 1, n), ("hp", 900)) * np.exp(-t / 0.45)]), 3.0, 0.045)

# — el groove: café, crepes, helados —
for beat in range(6, 21):
    ac = ACORDE_EN[beat]
    t0 = tb(beat)
    h = lambda: rng.normal(0, 0.004)
    rasgueo(ac, t0 + h(), 0.78)
    rasgueo(ac, tb(beat, 2) + h(), 0.4, abajo=False, lapso=0.016)
    rasgueo(ac, tb(beat, 3) + h(), 0.55, lapso=0.016)
    r, q5 = RAIZ[ac]
    bajo(t0, r, 0.3, 0.9)
    bajo(tb(beat, 3), q5, 0.1, 0.65)
    fuerte = beat % 2 == 0
    bombo(t0, 0.85 if fuerte else 0.7)
    if fuerte:
        bombo(tb(beat, 3), 0.4)
    else:
        aro(tb(beat, 2), 0.55)
    golpe(t0, 0.55 if fuerte else 0.4)
    for p in (0, 2):
        chajcha(tb(beat, p), 0.3 if p == 0 else 0.45, pan=0.4 if p == 0 else -0.35)
    if beat >= 14 and not fuerte:
        palma(t0, 0.7)
    if beat >= 14:
        chajcha(tb(beat, 1), 0.2, largo=0.04, pan=0.55)
        chajcha(tb(beat, 3), 0.2, largo=0.04, pan=-0.55)

# melodía de la quena
MELODIA = [
    (3.00, .25, 76), (3.25, .125, 76), (3.375, .125, 74), (3.50, .25, 72), (3.75, .125, 74), (3.875, .125, 76),
    (4.00, .25, 79), (4.25, .125, 76), (4.375, .125, 74), (4.50, .45, 76),
    (5.00, .25, 74), (5.25, .125, 74), (5.375, .125, 72), (5.50, .25, 71), (5.75, .125, 72), (5.875, .125, 74),
    (6.00, .25, 76), (6.25, .125, 74), (6.375, .125, 72), (6.50, .25, 71), (6.75, .25, 76),
    (7.00, .45, 81),
    (8.75, .125, 79), (8.875, .125, 81), (9.00, .25, 84), (9.25, .125, 81), (9.375, .125, 79),
    (9.50, .25, 76), (9.75, .25, 79), (10.00, .45, 81),
]
for t0, d, m in MELODIA:
    quena(t0, d, m, 0.95 if d >= 0.25 else 0.8, vibrato=1.0 if d > 0.3 else 0.4)

# transiciones
soplido(C["latigo"][0] - 0.05, 0.55, 400, 5500, vel=0.75, pan_de=0.8, pan_a=-0.8, q=1.3)
soplido(C["iris"][0], 0.45, 250, 3800, vel=0.5, pan_de=0.0, pan_a=0.0, q=3.0, forma=lambda u: np.sin(np.pi * u ** 0.7) ** 2)

# las bolas cantan la melodía al caer
NOTAS = [69, 72, 76, 81, 79, 76, 79, 84, 88, 91, 93, 96]
nb = len(D["sabores"])
arriba = nb // 2 if nb > 5 else 0
abajo = nb - arriba
paso_x = min(322, 1760 / max(abajo, 1))
for orden in range(nb):                                       # cae primero la fila de abajo
    fila, c = (abajo, orden) if orden < abajo else (arriba, orden - abajo)
    x = (c - (fila - 1) / 2) * paso_x
    plop(C["bolaPrimera"] + orden * C["bolaPaso"], NOTAS[orden % len(NOTAS)], 0.9, pan=0.8 * x / 960)
for k in range(7):
    destello(8.8 + k * 0.23 + rng.uniform(0, 0.08), [93, 95, 97, 100, 102][k % 5], 0.6, pan=rng.uniform(-0.7, 0.7))

chispas(C["puertaIzq"] + 0.05, 0.55, n=12, vel=0.9, semilla=1)          # la luz de la hornacina
papel(C["estallido"], 0.95, n=40, vel=0.9)                              # los pétalos
siseo(C["empuje"][1] + 0.15, 1.55, vel=0.45)                              # vapor del café
for tt in (C["cafeTexto"] + 0.08, 5.14, 7.08):                          # entra cada título
    soplido(tt, 0.34, 700, 3200, vel=0.16, q=1.2, forma=lambda u: np.sin(np.pi * u) ** 2 * (1 - 0.5 * u))
soplido(5.28, 0.3, 1200, 400, vel=0.14, q=1.0)                          # sube la cinta de nombres

# — quiebre: salimos de la hornacina y se cierran las puertas —
rasgueo("F", 10.5, 0.5, lapso=0.05)
rasgueo("G", 11.0, 0.42, lapso=0.05)
rasgueo("E7", 11.5, 0.45, lapso=0.05)
bajo(10.5, 41, 0.48, 0.7)
bajo(11.0, 43, 0.48, 0.65)
bajo(11.5, 40, 0.48, 0.7)
bombo(10.5, 0.6)
bombo(11.0, 0.45)
bombo(11.5, 0.4)
quena(10.5, 1.0, 76, 0.75, vibrato=1.2)
soplido(C["retroceso"][0], 0.9, 4000, 300, vel=0.45, pan_de=0.0, pan_a=0.0, q=1.1,
        forma=lambda u: (1 - u) ** 1.5 * np.minimum(1, u * 12))
soplido(C["cierre"][0], 0.5, 300, 1600, vel=0.55, pan_de=-0.5, pan_a=0.5, q=1.1,
        forma=lambda u: u ** 2.5)

colchon(10.5, 0.5, [53, 60, 65, 69], 0.55, ataque=0.15)
colchon(11.0, 0.5, [55, 62, 67, 71], 0.55, ataque=0.1)
colchon(11.5, 0.5, [52, 59, 64, 68], 0.6, ataque=0.1)

# — portazo y firma —
T = C["cierre"][1]
madera(T, 1.0)
madera(T + 0.09, 0.28, tono=1.15)
bombo(T, 1.0)
golpe(T, 0.9)
rasgueo("A", T, 1.0, lapso=0.03, dur=2.4)
bajo(T, 33, 0.35, 0.9)
bajo(T + 0.25, 45, 1.6, 0.7)
chajcha(T, 0.8, largo=0.2)
for k in range(1, 14):                                          # trémolo que se apaga
    rasgueo("A", T + k * S16 / 2, 0.5 * (1 - k / 14) ** 1.3 + 0.05, abajo=k % 2 == 0, lapso=0.012, dur=1.2)
for k, m in enumerate([81, 85, 88, 93, 97]):                     # la flor gira: campanas en La mayor
    campana(C["flor"] + k * S16 / 2, m, 0.7, pan=-0.4 + 0.2 * k)
for t0, d, m in [(12.5, .25, 76), (12.75, .25, 78), (13.0, .45, 81), (13.5, .25, 78), (13.75, .25, 76), (14.0, .85, 81)]:
    quena(t0, d, m, 0.7, vibrato=1.0 if d > 0.3 else 0.4)
colchon(12.0, 1.5, [57, 64, 69, 73], 0.7, ataque=0.02)
colchon(13.5, 0.5, [50, 57, 62, 66], 0.55, ataque=0.08)
colchon(14.0, 0.7, [57, 64, 69, 73], 0.5, ataque=0.08, suelta=0.9)
rasgueo("D", 13.5, 0.4, lapso=0.06, dur=1.6)
bajo(13.5, 38, 0.45, 0.6)
rasgueo("A", 14.0, 0.42, lapso=0.07, dur=2.6)
bajo(14.0, 45, 0.95, 0.55)
bombo(13.5, 0.3)
bombo(14.0, 0.35)
for k in range(8):
    chajcha(12.5 + k * BEAT / 2, 0.14 * (1 - k / 9), pan=0.4 if k % 2 else -0.3)
n = int(0.8 * FS)
u = np.linspace(0, 1, n)
brillo = filt(rng.normal(0, 1, n), ("hp", 7000)) * np.sin(np.pi * u) ** 2
add("fx", brillo, C["brillo"][0], 0.02, pan=0.2)
campana(C["brillo"][0] + 0.4, 100, 0.35, pan=0.3, dec=0.8)
chispas(C["flor"], 0.7, n=14, vel=1.0, semilla=2)                         # la flor gira
soplido(C["flor"] - 0.05, 0.5, 500, 2600, vel=0.25, pan_de=0.5, pan_a=0.3, q=1.4)
chispas(C["brillo"][0] + 0.15, 0.6, n=7, vel=0.6, ancho=0.4, semilla=3)   # brillo sobre el nombre

# ───────────────────────── mezcla ─────────────────────────
def ir_sala(rt60=1.5, largo=2.6, pre=0.014):
    n = int(largo * FS)
    t = np.arange(n) / FS
    out = np.zeros((2, n))
    for ch in range(2):
        x = rng.normal(0, 1, n)
        lo = filt(x, ("lp", 450)) * 10 ** (-3 * t / (rt60 * 1.15))
        mi = filt(x, ("hp", 450), ("lp", 4000)) * 10 ** (-3 * t / rt60)
        hi = filt(x, ("hp", 4000)) * 10 ** (-3 * t / (rt60 * 0.45))
        r = lo + mi + hi
        r *= np.minimum(1, t / 0.006)
        i = int(pre * FS)
        out[ch, i:] = r[: n - i]
    return out / np.sqrt(np.sum(out ** 2) / 2)


IR = ir_sala()
ENVIO = {"bombo": 0.07, "bajo": 0.0, "charango": 0.2, "quena": 0.34, "campanas": 0.5, "chajchas": 0.16, "fx": 0.18, "colchon": 0.3}
NIVEL = {"bombo": 0.56, "bajo": 0.9, "charango": 2.9, "quena": 1.0, "campanas": 1.0, "chajchas": 2.6, "fx": 0.95, "colchon": 1.6}

# ecualización por bus
bus["charango"] = filt(bus["charango"], ("hp", 160), ("peak", 2600, 0.9, 2.5), ("hs", 7000, 0.7, -2))
bus["quena"] = filt(bus["quena"], ("hp", 220), ("peak", 1800, 1.0, 1.5))
bus["bajo"] = filt(bus["bajo"], ("hp", 32))
bus["bombo"] = filt(bus["bombo"], ("hp", 28), ("peak", 70, 1.0, 2))

if os.environ.get("DIAG"):
    tramos = [(0, 1), (1, 2), (2, 3), (3, 7), (7, 10.5), (10.5, 12), (12, 15)]
    print("bus        " + "".join(f"{a:>5}-{b:<5}" for a, b in tramos))
    for bn in BUSES:
        fila = []
        for a0, b0 in tramos:
            x = NIVEL[bn] * bus[bn][:, int(a0 * FS):int(b0 * FS)]
            r = np.sqrt(np.mean(x ** 2) + 1e-12)
            fila.append(f"{20 * np.log10(r):>11.1f}")
        print(f"{bn:<10} " + "".join(fila))
def mezclar(incluir):
    seco = sum(NIVEL[b] * bus[b] for b in incluir)
    envio = sum(ENVIO[b] * NIVEL[b] * bus[b] for b in incluir)
    humedo = np.vstack([fftconvolve(envio[0], IR[0])[:N], fftconvolve(envio[1], IR[1])[:N]])
    m = filt(seco + 0.27 * humedo, ("hp", 36), ("hp", 36))
    # Plegado del bucle: lo que suena después de t = 15 s vuelve a entrar en t = 0.
    nd = int(DUR * FS)
    p = m[:, :nd].copy()
    cola = m[:, nd:]
    p[:, : cola.shape[1]] += cola
    return p


# Compresión suave de bus y limitador con anticipación.
def compresor(x, umbral_db=-16, ratio=2.0, ataque=0.01, suelta=0.15):
    nivel = np.sqrt(np.maximum(filt(np.mean(x ** 2, axis=0), ("lp", 30)), 0) + 1e-12)
    db = 20 * np.log10(nivel)
    sobre = np.maximum(0, db - umbral_db)
    red = -sobre * (1 - 1 / ratio)
    g = 10 ** (red / 20)
    a_at = np.exp(-1 / (ataque * FS)); a_su = np.exp(-1 / (suelta * FS))
    out = np.empty_like(g); v = 1.0
    for i in range(len(g)):
        a = a_at if g[i] < v else a_su
        v = a * v + (1 - a) * g[i]
        out[i] = v
    return x * out


def limitador(x, techo_db=-1.2, anticipo=0.004, suelta=0.08):
    techo = 10 ** (techo_db / 20)
    pico = np.max(np.abs(x), axis=0)
    la = int(anticipo * FS)
    # máximo en ventana deslizante hacia adelante
    from scipy.ndimage import maximum_filter1d
    pico = maximum_filter1d(pico, size=2 * la + 1)
    g = np.minimum(1, techo / np.maximum(pico, 1e-9))
    a = np.exp(-1 / (suelta * FS))
    out = np.empty_like(g); v = 1.0
    for i in range(len(g)):
        v = g[i] if g[i] < v else a * v + (1 - a) * g[i]
        out[i] = v
    return x * out


def lufs(x):
    k1 = lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585], x, axis=-1)
    k = lfilter([1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621], k1, axis=-1)
    blk, hop = int(0.4 * FS), int(0.1 * FS)
    ms = np.array([np.sum(np.mean(k[:, i:i + blk] ** 2, axis=1)) for i in range(0, k.shape[1] - blk, hop)])
    lk = -0.691 + 10 * np.log10(ms + 1e-15)
    ms = ms[lk > -70]
    rel = -0.691 + 10 * np.log10(np.mean(ms)) - 10
    ms = ms[(-0.691 + 10 * np.log10(ms)) > rel]
    return -0.691 + 10 * np.log10(np.mean(ms))


def pico_real(x):
    from scipy.signal import resample_poly
    return 20 * np.log10(np.max(np.abs(resample_poly(x, 4, 1, axis=-1))) + 1e-12)


def masterizar(p, ref, g):
    """Compresión y limitador sobre dos vueltas: el estado al empezar es el del final."""
    n = p.shape[1]
    return limitador(compresor(np.tile(p / ref * 0.7, 2)) * g, techo_db=-2.0)[:, n:]


def escribir(nombre, x):
    import wave
    os.makedirs(os.path.join(ROOT, "audio"), exist_ok=True)
    pcm = (np.clip(x, -1, 1).T * 32767).astype("<i2")
    with wave.open(os.path.join(ROOT, "audio", nombre), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(FS)
        w.writeframes(pcm.tobytes())
    print(f"{nombre:<12} LUFS {lufs(x):6.2f} · pico real {pico_real(x):6.2f} dBTP")


OBJETIVO = -16.0
completa = mezclar(BUSES)
ref = np.max(np.abs(completa))
g = 1.0
for _ in range(6):
    prueba = masterizar(completa, ref, g)
    L = lufs(prueba)
    if abs(L - OBJETIVO) < 0.15:
        break
    g *= 10 ** ((OBJETIVO - L) / 20)
escribir("pista.wav", prueba)
# Los efectos solos, con la misma ganancia: quedan donde estaban en la mezcla.
# Solos van un poco más arriba (pico real ≈ −1.5 dBTP) para no perderse bajo otra música.
efectos = masterizar(mezclar(["fx"]), ref, g)
efectos = limitador(efectos * 10 ** ((-1.6 - pico_real(efectos)) / 20), techo_db=-2.0)
escribir("efectos.wav", efectos)
