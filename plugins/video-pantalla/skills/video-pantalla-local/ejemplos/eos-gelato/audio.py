#!/usr/bin/env python3
"""Banda sonora de 15 s para EOS Gelato.

House suave a 128 BPM en Fa mayor —ocho compases justos, así el bucle cierra en
el tiempo fuerte—: piano eléctrico (FM), kalimba, silbido, bajo y percusión
ligera, más los efectos que marca la imagen. Todo sale de cues.js: imagen y
sonido comparten un solo reloj. La cola del final vuelve a entrar al comienzo.

Escribe audio/pista.wav (música + efectos) y audio/efectos.wav (solo efectos).
"""
import json
import os
import re

import numpy as np
from scipy.signal import fftconvolve, lfilter

FS = 48000
ROOT = os.path.dirname(os.path.abspath(__file__))
C = json.loads(re.sub(r"^[^=]*=\s*|;\s*$", "", "".join(
    l for l in open(os.path.join(ROOT, "cues.js")).read().splitlines() if not l.strip().startswith("//")).strip()))
DUR = C["dur"]
BEAT = 60.0 / C["bpm"]            # 0.46875 s
S16 = BEAT / 4
COMPAS = 4 * BEAT                 # 1.875 s
TOTAL = DUR + 4.0                 # se genera de más y la cola se pliega al inicio
N = int(TOTAL * FS)
rng = np.random.default_rng(128)

BUSES = ["bombo", "perc", "bajo", "piano", "kalimba", "silbido", "colchon", "fx"]
bus = {b: np.zeros((2, N)) for b in BUSES}


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tb(compas, pulso=0.0):
    return compas * COMPAS + pulso * BEAT


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


def fase(f):
    return 2 * np.pi * np.cumsum(f) / FS


# ───────────────────────── instrumentos ─────────────────────────
def piano(t0, m, dur, vel=0.7, pan=0.0):
    """Piano eléctrico por FM: la púa (índice que cae) y la campanita del ataque (14:1)."""
    f = hz(m)
    n = int((dur + 0.5) * FS)
    t = np.arange(n) / FS
    lados = []
    for d in (-3.5, 3.5):                        # dos voces apenas desafinadas: ancho natural
        ff = f * 2 ** (d / 1200)
        I1 = (0.9 + 1.1 * vel) * np.exp(-t / 0.55)
        I2 = 0.85 * vel * np.exp(-t / 0.018)
        s = np.sin(2 * np.pi * ff * t + I1 * np.sin(2 * np.pi * ff * t) + I2 * np.sin(2 * np.pi * 14 * ff * t))
        lados.append(s)
    s = np.vstack(lados)
    tau = 1.5 * (1.15 - (m - 48) / 60)
    e = np.minimum(1, t / 0.002) * np.exp(-t / tau)
    ns = int(dur * FS)
    e[ns:] *= np.exp(-(t[ns:] - dur) / 0.07)
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.2 * (t + t0) + np.array([[0], [np.pi]]))
    a = (pan + 1) * np.pi / 4
    s = s * e * trem * np.array([[np.cos(a) * 1.41], [np.sin(a) * 1.41]]) * 0.5
    add("piano", s, t0, 0.12 * vel)


def acorde_piano(t0, notas, dur, vel=0.7):
    for k, m in enumerate(notas):
        piano(t0 + k * 0.006, m, dur, vel * (0.92 + 0.08 * k / len(notas)), pan=-0.25 + 0.5 * k / max(1, len(notas) - 1))


def kalimba(t0, m, vel=0.6, pan=0.0):
    f = hz(m)
    n = int(1.4 * FS)
    t = np.arange(n) / FS
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.55)
    for r, amp, dec in [(5.93, 0.26, 0.05), (13.3, 0.09, 0.018)]:
        if f * r < 17000:
            s += amp * np.sin(2 * np.pi * f * r * t) * np.exp(-t / dec)
    s += filt(rng.normal(0, 1, n), ("hp", 2500)) * np.exp(-t / 0.002) * 0.3
    s *= np.minimum(1, t / 0.0008)
    add("kalimba", s, t0, 0.1 * vel, pan=pan)


def silbido(t0, dur, m, vel=0.8, de=None):
    """Silbido: seno casi puro, un pelo de aire y vibrato que llega tarde."""
    f0 = hz(m)
    rel = 0.07
    n = int((dur + rel) * FS)
    t = np.arange(n) / FS
    cents = (hz(de) / f0 - 1) * 1731 * np.exp(-t / 0.035) if de else -38 * np.exp(-t / 0.03)
    vib = 11 * np.clip((t - 0.12) / 0.25, 0, 1) * np.sin(2 * np.pi * 5.6 * t + rng.uniform(0, 6.28))
    deriva = lfilter([0.002], [1, -0.998], rng.normal(0, 1, n)) * 2.5
    f = f0 * 2 ** ((cents + vib + deriva) / 1200)
    ph = fase(f)
    tono = np.sin(ph) + 0.05 * np.sin(2 * ph) + 0.015 * np.sin(3 * ph)
    aire = filt(rng.normal(0, 1, n), ("bp", min(f0, 7000), 6.0)) * 0.35 + filt(rng.normal(0, 1, n), ("hp", 6500)) * 0.03
    e = np.ones(n)
    na = int(0.022 * FS)
    e[:na] = np.linspace(0, 1, na) ** 1.6
    nr = int(rel * FS)
    e[n - nr:] *= np.linspace(1, 0, nr) ** 2
    add("silbido", (tono * 0.9 + aire * 0.25) * e, t0, 0.13 * vel, pan=0.12)


def bombo(t0, vel=0.9):
    n = int(0.55 * FS)
    t = np.arange(n) / FS
    f = 46 + 105 * np.exp(-t / 0.03)
    cuerpo = np.sin(fase(f)) * np.exp(-t / 0.27)
    click = filt(rng.normal(0, 1, n), ("hp", 2600)) * np.exp(-t / 0.0028) * 0.3
    add("bombo", (cuerpo + click) * np.minimum(1, t / 0.0012), t0, 0.62 * vel)


def palmas(t0, vel=0.6, pan=0.0):
    n = int(0.28 * FS)
    t = np.arange(n) / FS
    ruido = filt(rng.normal(0, 1, n), ("bp", 1150, 0.8), ("peak", 2400, 1.0, 3))
    e = np.zeros(n)
    for d in (0.0, 0.008, 0.017):
        i = int(d * FS)
        e[i:] += np.exp(-(t[: n - i]) / 0.0045)
    i = int(0.023 * FS)
    e[i:] += 0.85 * np.exp(-(t[: n - i]) / 0.075)
    add("perc", ruido * e, t0, 0.2 * vel, pan=pan)


def plato(t0, vel=0.5, abierto=False, pan=0.25):
    """Charles: parciales metálicos (a lo 808) por un pasaaltos."""
    n = int((0.32 if abierto else 0.07) * FS)
    t = np.arange(n) / FS
    s = sum(np.sign(np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28))) for f in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0))
    s = filt(s + 0.8 * rng.normal(0, 1, n), ("hp", 7200), ("peak", 10000, 1.2, 3))
    s *= np.exp(-t / (0.1 if abierto else 0.016)) * np.minimum(1, t / 0.0005)
    add("perc", s, t0, 0.028 * vel, pan=pan)


def maraca(t0, vel=0.4, largo=0.06, pan=-0.35):
    n = int((largo + 0.03) * FS)
    s = np.zeros(n)
    for _ in range(int(10 + 16 * vel)):
        i = int(min(rng.exponential(largo / 3.2), largo) * FS)
        L = 80
        if i + L < n:
            s[i:i + L] += rng.normal(0, 1, L) * np.exp(-np.arange(L) / 14) * rng.uniform(0.3, 1)
    s = filt(s, ("hp", 4200), ("peak", 7500, 1.0, 3))
    add("perc", s, t0, 0.16 * vel, pan=pan)


def bajo(t0, m, dur, vel=0.8):
    """Bajo pulsado: diente de sierra limitado en banda con filtro que se cierra, y su sub."""
    f = hz(m)
    n = int((dur + 0.06) * FS)
    t = np.arange(n) / FS
    ph = 2 * np.pi * f * t
    saw = sum(np.sin(k * ph) / k for k in range(1, 14) if k * f < 9000)
    s = barrido(saw, 1500 * (0.6 + 0.4 * vel), 260, q=0.9, kind="lp", curva=lambda u: 1 - np.exp(-u * n / FS / 0.07) if n else u)
    s = 0.55 * s + 0.75 * np.sin(ph)
    e = np.minimum(1, t / 0.003) * (0.7 + 0.3 * np.exp(-t / 0.09))
    ns = int(dur * FS)
    e[ns:] *= np.linspace(1, 0, n - ns) ** 2
    add("bajo", np.tanh(1.2 * s * e) / np.tanh(1.2), t0, 0.26 * vel)


def colchon(t0, dur, notas, vel=0.5, ataque=0.4, suelta=0.8, corte=1500):
    n = int((dur + suelta) * FS)
    t = np.arange(n) / FS
    lados = []
    for lado in range(2):                      # cada canal con sus fases: un colchón ancho
        s = np.zeros(n)
        for m in notas:
            for dt in (-8, 0, 8):
                f = hz(m) * 2 ** ((dt + (lado - 0.5) * 5) / 1200)
                ph = (f * t + rng.uniform(0, 1)) % 1.0
                s += 2 * ph - 1
        s /= 3 * len(notas)
        lados.append(filt(s, ("lp", corte, 0.6), ("lp", corte * 1.4, 0.6), ("hp", 140)))
    e = np.minimum(1, t / ataque)
    ns = int(dur * FS)
    e[ns:] *= np.exp(-(t[ns:] - dur) / (suelta / 3))
    add("colchon", np.vstack(lados) * e * 0.7, t0, 0.15 * vel)


def campana(t0, m, vel=0.6, pan=0.0, dec=1.0, bus_="fx"):
    f = hz(m)
    n = int(2.2 * FS)
    t = np.arange(n) / FS
    I = 1.8 * np.exp(-t / 0.2)
    s = np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * 3.5 * t)) * np.exp(-t / dec)
    s += 0.2 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.28)
    s *= np.minimum(1, t / 0.002)
    add(bus_, s, t0, 0.07 * vel, pan=pan)


# ───────────────────────── efectos ─────────────────────────
def soplido(t0, dur, f_de, f_a, vel=0.5, pan_de=0.0, pan_a=0.0, q=1.6, forma=None):
    """Whoosh: ruido filtrado que se mueve en frecuencia y en el estéreo."""
    n = int(dur * FS)
    u = np.linspace(0, 1, n)
    s = barrido(rng.normal(0, 1, n), f_de, f_a, q=q)
    s = s * (np.sin(np.pi * u) ** 2 if forma is None else forma(u))
    p = pan_de + (pan_a - pan_de) * u
    a = (p + 1) * np.pi / 4
    add("fx", np.vstack([np.cos(a) * s, np.sin(a) * s]), t0, 0.35 * vel)


def gelatina(t0, f0, f1, vel=0.8, pan=0.0, dur=0.6):
    """El logo que crece o se asienta: un «boing» blando, tono que viaja y tiembla."""
    n = int(dur * FS)
    t = np.arange(n) / FS
    u = t / dur
    base = f0 * (f1 / f0) ** (1 - (1 - u) ** 3)
    tiembla = 1 + 0.16 * np.exp(-t / 0.16) * np.sin(2 * np.pi * 11 * t)
    ph = fase(base * tiembla)
    s = (np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph)) * np.exp(-t / (dur / 3.2)) * np.minimum(1, t / 0.004)
    golpe = np.sin(fase(60 + 70 * np.exp(-t / 0.03))) * np.exp(-t / 0.1)
    add("fx", filt(s, ("lp", 2400)) * 0.9 + golpe * 0.55, t0, 0.2 * vel, pan=pan)


def burbuja(t0, f, vel=0.5, pan=0.0, sube=True):
    """Una burbuja que revienta: el tono sube rápido y se apaga (así suena el agua)."""
    n = int(0.12 * FS)
    t = np.arange(n) / FS
    fi = f * (1 + (0.9 if sube else -0.35) * (1 - np.exp(-t / 0.018)))
    s = np.sin(fase(fi)) * np.exp(-t / 0.035) * np.minimum(1, t / 0.0015)
    add("fx", s, t0, 0.07 * vel, pan=pan)


def llenado(t0, dur, f_de, f_a, vel=0.8, pan=0.0, semilla=0, baja=False):
    """Algo que se llena (o se vacía): burbujas cada vez más agudas (o más graves) y un gorgoteo."""
    r = np.random.default_rng(300 + semilla)
    k = 0
    tt = 0.0
    while tt < dur:
        u = tt / dur
        f = f_de * (f_a / f_de) ** u
        burbuja(t0 + tt, f * r.uniform(0.94, 1.06), vel * r.uniform(0.55, 1.0), pan=pan + r.uniform(-0.15, 0.15), sube=not baja)
        tt += r.uniform(0.035, 0.075)
        k += 1
    n = int(dur * FS)
    u = np.linspace(0, 1, n)
    gorgoteo = barrido(r.normal(0, 1, n), f_de * 0.5, f_a * 0.5, q=5.0) * np.sin(np.pi * u) ** 1.5
    add("fx", gorgoteo, t0, 0.05 * vel, pan=pan)


def bloop(t0, vel=0.8, pan=0.0):
    """La O que se cierra: una succión corta que remata en un pop."""
    n = int(0.22 * FS)
    t = np.arange(n) / FS
    f = 180 + 520 * (t / 0.22) ** 2
    s = np.sin(fase(f)) * np.sin(np.pi * np.minimum(1, t / 0.22)) ** 1.2
    pop = filt(rng.normal(0, 1, n), ("bp", 1400, 1.5)) * np.exp(-np.maximum(t - 0.18, 0) / 0.006) * (t > 0.18)
    add("fx", s * 0.8 + pop * 0.8, t0, 0.2 * vel, pan=pan)


def impacto(t0, vel=1.0, cola=0.4):
    n = int(1.6 * FS)
    t = np.arange(n) / FS
    boom = np.sin(fase(40 + 55 * np.exp(-t / 0.07))) * np.exp(-t / cola)
    add("fx", boom, t0, 0.3 * vel)
    for lado, p in ((0, -0.4), (1, 0.4)):
        crash = filt(rng.normal(0, 1, n), ("hp", 1500), ("peak", 6000, 0.8, 3)) * np.exp(-t / 0.5) * np.minimum(1, t / 0.002)
        add("fx", crash, t0, 0.03 * vel, pan=p)


def subida(t0, dur, vel=0.5, f_de=300, f_a=7000):
    """Rizo de ruido que sube hacia un golpe."""
    n = int(dur * FS)
    u = np.linspace(0, 1, n)
    s = barrido(rng.normal(0, 1, n), f_de, f_a, q=2.4, curva=lambda x: x ** 1.4) * u ** 2.4
    add("fx", s, t0, 0.13 * vel)


def tic(t0, vel=0.6, tono=1.0, pan=0.0):
    """Clic de madera chica: el carrusel que encaja."""
    n = int(0.12 * FS)
    t = np.arange(n) / FS
    s = np.zeros(n)
    for f, dec, amp in [(1850, 0.02, 1.0), (3120, 0.012, 0.6), (4700, 0.008, 0.4)]:
        s += amp * np.sin(2 * np.pi * f * tono * t) * np.exp(-t / dec)
    s += filt(rng.normal(0, 1, n), ("bp", 3000, 1.2)) * np.exp(-t / 0.002)
    add("fx", s * np.minimum(1, t / 0.0005), t0, 0.07 * vel, pan=pan)


def pop(t0, m, vel=0.8, pan=0.0):
    """Un arco que aparece: burbuja afinada, redonda."""
    f = hz(m)
    n = int(0.3 * FS)
    t = np.arange(n) / FS
    fi = f * (0.55 + 0.45 * (1 - np.exp(-t / 0.012)))
    ph = fase(fi)
    s = (np.sin(ph) + 0.22 * np.sin(2 * ph) * np.exp(-t / 0.03)) * np.exp(-t / 0.09) * np.minimum(1, t / 0.0015)
    s += filt(rng.normal(0, 1, n), ("hp", 2600)) * np.exp(-t / 0.0022) * 0.2
    add("fx", s, t0, 0.17 * vel, pan=pan)


def jarabe(t0, dur, vel=0.8):
    """El jarabe que cae: un chorro espeso que baja de tono, gotas y el golpe al cubrir."""
    n = int(dur * FS)
    u = np.linspace(0, 1, n)
    chorro = barrido(rng.normal(0, 1, n), 900, 260, q=3.2, curva=lambda x: x ** 0.8)
    chorro *= np.sin(np.pi * np.minimum(1, u * 1.1)) ** 1.2
    espeso = np.sin(fase(160 * (1 - 0.45 * u) * (1 + 0.08 * np.sin(2 * np.pi * 7 * u * dur)))) * np.sin(np.pi * u) ** 2
    add("fx", chorro, t0, 0.2 * vel, pan=-0.1)
    add("fx", filt(espeso, ("lp", 900)), t0, 0.08 * vel)
    r = np.random.default_rng(55)
    for k in range(14):                       # gotas gordas: plop grave, pegajoso
        tt = t0 + dur * (0.15 + 0.8 * r.uniform() ** 0.8)
        burbuja(tt, r.uniform(380, 720), vel * r.uniform(0.5, 1), pan=r.uniform(-0.8, 0.8))
    m = int(0.5 * FS)
    t = np.arange(m) / FS
    splat = filt(rng.normal(0, 1, m), ("lp", 1600), ("hp", 120)) * np.exp(-t / 0.09) * np.minimum(1, t / 0.004)
    add("fx", splat, t0 + dur - 0.06, 0.16 * vel)


def chispas(t0, dur, n=10, vel=0.5, ancho=0.8, semilla=0):
    """Destellos sin afinación de escala: brillan sin chocar con la tonalidad."""
    r = np.random.default_rng(900 + semilla)
    for k in range(n):
        f = r.uniform(3200, 7800)
        m = int(0.35 * FS)
        t = np.arange(m) / FS
        x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 1.51 * t) * np.exp(-t / 0.03)
        x *= np.exp(-t / r.uniform(0.05, 0.12)) * np.minimum(1, t / 0.0008)
        add("fx", x, t0 + dur * (k / n) ** 0.8 + r.uniform(0, 0.03), 0.045 * vel * r.uniform(0.5, 1), pan=r.uniform(-ancho, ancho))


def hilo(t0, vel=0.5):
    """El filete que se dibuja: un roce metálico finito que se abre a los lados."""
    n = int(0.55 * FS)
    u = np.linspace(0, 1, n)
    s = barrido(rng.normal(0, 1, n), 3500, 9000, q=4.0) * np.sin(np.pi * u) ** 2 * (1 - u)
    for lado, p in ((0, -0.6), (1, 0.6)):
        add("fx", s, t0, 0.06 * vel, pan=p)
    campana(t0 + 0.18, 101, 0.25, pan=0.0, dec=0.5)


# ───────────────────────── partitura ─────────────────────────
F9 = [57, 60, 64, 67]          # Fa maj9 (La Do Mi Sol)
DM9 = [60, 64, 65, 69]         # Re m9 (Do Mi Fa La)
BB9 = [62, 65, 69, 72]         # Si♭ maj9 (Re Fa La Do)
C9 = [58, 62, 64, 67]          # Do 9 (Si♭ Re Mi Sol)
C69 = [57, 62, 64, 67]         # Do 6/9
ARMONIA = [("F", F9, 41), ("Dm", DM9, 38), ("Bb", BB9, 34), ("C", C9, 36),
           ("F", F9, 41), ("Dm", DM9, 38), ("Bb", BB9, 34), ("F", F9, 41)]

# — la calma: firma y letras que se llenan (compás 8 y 1) —
ARP_F = [77, 81, 84, 88, 91, 88, 84, 81]
for c in (0, 7):
    for k, m in enumerate(ARP_F):
        kalimba(tb(c, k * 0.5), m, 0.55 if k % 2 == 0 else 0.4, pan=-0.35 + 0.1 * k)
    colchon(tb(c), COMPAS, [53, 57, 60, 64, 67], 0.9 if c == 7 else 0.7, ataque=0.3)
    acorde_piano(tb(c), F9, 1.6, 0.42)
    for k in range(8):
        maraca(tb(c, k * 0.5 + 0.5), 0.2 if k % 2 else 0.12, pan=0.3)
bajo(tb(0), 29, 0.9, 0.55)
bajo(tb(7, 2), 41, 0.6, 0.4)
# el compás 7 prepara el regreso: kalimba en eco, más quieta
subida(tb(0, 1.9), 2.1 * BEAT, vel=0.9)
for k in range(8):                                    # redoble de palmas hacia la caída
    palmas(tb(0, 2 + k * 0.25), 0.2 + 0.5 * (k / 7) ** 1.5, pan=0.1 * (-1) ** k)

# — el groove: compases 2 a 7 —
STAB = [(0.0, 0.2), (1.5, 0.16), (2.5, 0.16), (3.0, 0.3)]   # «uno», «y» del dos, «y» del tres, cuatro
for c in range(1, 7):
    nombre, voz, raiz = ARMONIA[c]
    if c == 6:                                          # Si♭ que se va a Do
        voces = [(0, BB9, 34), (2, C9, 36)]
    elif c == 3:
        voces = [(0, C69, 36), (2, C9, 36)]
    else:
        voces = [(0, voz, raiz)]
    for pulso in range(4):
        bombo(tb(c, pulso), 0.95 if pulso == 0 else 0.8)
        plato(tb(c, pulso + 0.5), 0.9, abierto=True, pan=0.22)
        for s16 in (0.25, 0.75):
            plato(tb(c, pulso + s16), 0.45, pan=-0.2)
        for s16 in range(4):
            maraca(tb(c, pulso + s16 * 0.25), 0.35 if s16 % 2 else 0.2, largo=0.045)
    palmas(tb(c, 1), 0.85)
    palmas(tb(c, 3), 0.85)
    for inicio, v, r in voces:
        for p, d in STAB:
            if inicio <= p < inicio + (4 if len(voces) == 1 else 2):
                acorde_piano(tb(c, p), v, d, 0.72 if p == 0 else 0.58)
        # bajo de casa: la raíz abajo en el uno, y a contratiempo con saltos de octava
        for p in (0.0, 0.5, 1.5, 2.5, 3.5):
            if inicio <= p < inicio + (4 if len(voces) == 1 else 2):
                m = r if p == 0 else (r + 12 if p in (1.5, 3.5) else r)
                bajo(tb(c, p), m, 0.32 if p == 0 else 0.2, 0.95 if p == 0 else 0.75)
    colchon(tb(c), COMPAS, [m - 12 for m in voz] + [voz[-1]], 0.35, ataque=0.2)

# kalimba que acompaña a las bebidas
for k, m in enumerate([81, 84, 88, 84, 89, 88, 84, 81] * 2):
    kalimba(tb(4, k * 0.25 + 0.0), m, 0.32, pan=0.45 - 0.1 * (k % 8))

# el silbido: el tema
MELODIA = [
    (2, 0.0, 0.5, 84), (2, 0.5, 0.5, 86), (2, 1.0, 0.95, 89), (2, 2.0, 0.5, 86), (2, 2.5, 0.5, 84), (2, 3.0, 0.95, 81),
    (3, 0.0, 0.5, 79), (3, 0.5, 0.5, 81), (3, 1.0, 0.95, 84), (3, 2.0, 0.5, 81), (3, 2.5, 0.5, 79), (3, 3.0, 0.9, 76),
    (5, 0.0, 0.5, 81), (5, 0.5, 0.5, 84), (5, 1.0, 0.95, 86), (5, 2.0, 0.5, 84), (5, 2.5, 0.5, 81), (5, 3.0, 0.95, 77),
    (6, 0.0, 0.95, 86), (6, 1.0, 0.5, 84), (6, 1.5, 0.5, 81), (6, 2.0, 1.9, 79),
    (7, 0.0, 1.6, 81),
]
prev = None
for c, p, d, m in MELODIA:
    silbido(tb(c, p), d * BEAT, m, 0.9 if d >= 0.9 else 0.75, de=prev if prev and abs(prev - m) <= 3 else None)
    prev = m

# ───────────────────────── efectos, al compás de la imagen ─────────────────────────
soplido(C["rotuloSale"][0], 0.34, 2600, 700, vel=0.16, q=1.2)                       # la firma se retira
gelatina(C["crece"][0], 150, 330, vel=0.9)                                          # el logo crece
for k, (L, f0, f1) in enumerate([("E", 330, 700), ("O", 400, 860), ("S", 480, 1050)]):
    a, b = C["llenado"][L]
    llenado(a, b - a, f0, f1, vel=0.75, pan=(-0.55, 0.0, 0.55)[k], semilla=k)       # gelato que sube en cada letra
bloop(C["cierraO"][1] - 0.2, 0.9)                                                   # la O se cierra
# el zoom: golpe en el tiempo fuerte, soplo que acelera y la luz del amanecer
impacto(C["zoom"][0], 1.0)
soplido(C["zoom"][0], C["zoom"][1] - C["zoom"][0] + 0.25, 280, 5200, vel=0.85, q=1.3,
        forma=lambda u: np.sin(np.pi * np.minimum(1, u * 1.05)) ** 1.6)
for k, m in enumerate([77, 81, 84, 89, 93, 96]):
    campana(C["zoom"][1] - 0.18 + k * 0.055, m, 0.6 - k * 0.05, pan=0.2 + 0.1 * k)
chispas(C["zoom"][1] - 0.1, 0.5, n=9, vel=0.8, semilla=1)
def pajarito(t0, vel=0.5, pan=0.3, f=4200, notas=2):
    """El amanecer: un pío corto, dos o tres veces."""
    for k in range(notas):
        n = int(0.09 * FS)
        t = np.arange(n) / FS
        fi = f * (1 + 0.28 * np.sin(np.pi * t / 0.09) - 0.12 * t / 0.09) * (1 + 0.04 * np.sin(2 * np.pi * 60 * t))
        s = np.sin(fase(fi)) * np.sin(np.pi * t / 0.09) ** 2
        add("fx", s, t0 + k * 0.12, 0.022 * vel, pan=pan)


pajarito(C["zoom"][1] + 0.12, 0.8, pan=0.55, f=4300, notas=2)
pajarito(C["zoom"][1] + 0.62, 0.6, pan=-0.45, f=3700, notas=3)
pajarito(C["zoom"][1] + 1.25, 0.5, pan=0.4, f=4500, notas=2)
for k in range(2):                                                                  # entran las palabras
    soplido(C["heroeTexto"][0] + k * 0.13, 0.32, 800, 3000, vel=0.13, q=1.2, forma=lambda u: np.sin(np.pi * u) ** 2 * (1 - 0.5 * u))
# la foto se encoge en su arco y aterriza
soplido(C["encoge"][0], C["encoge"][1] - C["encoge"][0], 4200, 420, vel=0.55, pan_de=0.0, pan_a=-0.3, q=1.2,
        forma=lambda u: (1 - u) ** 1.3 * np.minimum(1, u * 10))
pop(C["encoge"][1] - 0.02, 72, 0.9, pan=-0.35)
soplido(C["vitrinaTitulo"], 0.36, 700, 3000, vel=0.14, q=1.2, forma=lambda u: np.sin(np.pi * u) ** 2 * (1 - 0.5 * u))
for k, t0 in enumerate(C["vitrinaEntra"]):                                          # entran los arcos
    pop(t0 + 0.02, [77, 81, 84][k], 0.85, pan=-0.05 + 0.25 * (k + 1))
for k, t0 in enumerate(C["vitrinaPasos"]):                                          # la vitrina corre un lugar
    soplido(t0 - 0.02, 0.36, 500, 2200, vel=0.3, pan_de=0.5, pan_a=-0.5, q=1.4)
    tic(t0 + 0.3, 0.55, tono=1.0 + 0.04 * k, pan=0.2)
# el jarabe de frambuesa
subida(C["goteo"][0] - 0.9, 0.9, vel=0.8)
impacto(C["goteo"][0], 0.75, cola=0.3)
jarabe(C["goteo"][0], C["goteo"][1] - C["goteo"][0], vel=0.9)
# el carrusel entra girando y encaja
soplido(C["carrusel"][0], C["carrusel"][1] - C["carrusel"][0], 350, 2600, vel=0.5, pan_de=-0.8, pan_a=0.6, q=1.2,
        forma=lambda u: np.sin(np.pi * u ** 0.6) ** 2)
tic(C["carrusel"][1] - 0.02, 0.8, tono=0.9)
soplido(C["bebidasTitulo"], 0.36, 700, 3000, vel=0.14, q=1.2, forma=lambda u: np.sin(np.pi * u) ** 2 * (1 - 0.5 * u))
for k, t0 in enumerate(C["carruselPasos"]):
    soplido(t0 - 0.03, 0.34, 600, 2400, vel=0.28, pan_de=0.6, pan_a=-0.6, q=1.5)
    tic(t0 + 0.2, 0.6, tono=0.95 + 0.05 * (k % 3), pan=0.0)
# salimos por la S: succión que se apaga y asienta
subida(C["salida"][0] - 0.7, 0.7, vel=0.6, f_de=500, f_a=5000)
soplido(C["salida"][0], 0.85, 5200, 260, vel=0.8, q=1.2, forma=lambda u: (1 - u) ** 1.6 * np.minimum(1, u * 14))
impacto(C["salida"][0] + 0.02, 0.45, cola=0.25)
for k, L in enumerate("EOS"):                                                        # las letras se vacían
    a, b = C["drenaje"][L]
    llenado(a, b - a, (900, 1000, 1100)[k], (320, 360, 400)[k], vel=0.55, pan=(-0.55, 0.0, 0.55)[k], semilla=10 + k, baja=True)
gelatina(C["asienta"][0], 360, 150, vel=0.75)                                       # el logo se asienta
hilo(C["firma"][0], 0.9)                                                            # se dibuja el filete
soplido(C["firma"][0] + 0.12, 0.4, 900, 2800, vel=0.14, q=1.2, forma=lambda u: np.sin(np.pi * u) ** 2 * (1 - 0.5 * u))
# el brillo que barre el logo
n = int(0.8 * FS)
u = np.linspace(0, 1, n)
add("fx", filt(rng.normal(0, 1, n), ("hp", 7000)) * np.sin(np.pi * u) ** 2, C["brillo"][0], 0.018, pan=0.2)
campana(C["brillo"][0] + 0.35, 101, 0.35, pan=0.3, dec=0.8)
chispas(C["brillo"][0] + 0.1, 0.6, n=8, vel=0.6, ancho=0.5, semilla=3)


# ───────────────────────── mezcla ─────────────────────────
def ir_sala(rt60=1.4, largo=2.4, pre=0.012):
    n = int(largo * FS)
    t = np.arange(n) / FS
    out = np.zeros((2, n))
    for ch in range(2):
        x = rng.normal(0, 1, n)
        lo = filt(x, ("lp", 450)) * 10 ** (-3 * t / (rt60 * 1.1))
        mi = filt(x, ("hp", 450), ("lp", 4000)) * 10 ** (-3 * t / rt60)
        hi = filt(x, ("hp", 4000)) * 10 ** (-3 * t / (rt60 * 0.45))
        r = (lo + mi + hi) * np.minimum(1, t / 0.006)
        i = int(pre * FS)
        out[ch, i:] = r[: n - i]
    return out / np.sqrt(np.sum(out ** 2) / 2)


IR = ir_sala()
ENVIO = {"bombo": 0.04, "perc": 0.12, "bajo": 0.0, "piano": 0.22, "kalimba": 0.35, "silbido": 0.38, "colchon": 0.3, "fx": 0.16}
NIVEL = {"bombo": 0.55, "perc": 2.6, "bajo": 0.85, "piano": 1.4, "kalimba": 1.0, "silbido": 1.0, "colchon": 1.2, "fx": 1.0}

bus["piano"] = filt(bus["piano"], ("hp", 150), ("peak", 900, 0.8, 1.5), ("hs", 6000, 0.7, -2))
bus["silbido"] = filt(bus["silbido"], ("hp", 300))
bus["bajo"] = filt(bus["bajo"], ("hp", 30))
bus["bombo"] = filt(bus["bombo"], ("hp", 28), ("peak", 62, 1.0, 2))
bus["kalimba"] = filt(bus["kalimba"], ("hp", 250))

if os.environ.get("DIAG"):
    tramos = [(0, 1.875), (1.875, 3.75), (3.75, 7.5), (7.5, 11.25), (11.25, 13.125), (13.125, 15)]
    print("bus        " + "".join(f"{a:>6.2f}-{b:<6.2f}" for a, b in tramos))
    for bn in BUSES:
        fila = []
        for a0, b0 in tramos:
            x = NIVEL[bn] * bus[bn][:, int(a0 * FS):int(b0 * FS)]
            fila.append(f"{20 * np.log10(np.sqrt(np.mean(x ** 2) + 1e-12)):>13.1f}")
        print(f"{bn:<10} " + "".join(fila))


def mezclar(incluir):
    seco = sum(NIVEL[b] * bus[b] for b in incluir)
    envio = sum(ENVIO[b] * NIVEL[b] * bus[b] for b in incluir)
    humedo = np.vstack([fftconvolve(envio[0], IR[0])[:N], fftconvolve(envio[1], IR[1])[:N]])
    m = filt(seco + 0.27 * humedo, ("hp", 32), ("hp", 32))
    # Plegado del bucle: lo que suena después de t = 15 s vuelve a entrar en t = 0.
    nd = int(DUR * FS)
    p = m[:, :nd].copy()
    cola = m[:, nd:]
    p[:, : cola.shape[1]] += cola
    return p


def compresor(x, umbral_db=-16, ratio=2.0, ataque=0.01, suelta=0.15):
    nivel = np.sqrt(np.maximum(filt(np.mean(x ** 2, axis=0), ("lp", 30)), 0) + 1e-12)
    db = 20 * np.log10(nivel)
    red = -np.maximum(0, db - umbral_db) * (1 - 1 / ratio)
    g = 10 ** (red / 20)
    a_at = np.exp(-1 / (ataque * FS)); a_su = np.exp(-1 / (suelta * FS))
    out = np.empty_like(g); v = 1.0
    for i in range(len(g)):
        a = a_at if g[i] < v else a_su
        v = a * v + (1 - a) * g[i]
        out[i] = v
    return x * out


def limitador(x, techo_db=-2.0, anticipo=0.004, suelta=0.08):
    from scipy.ndimage import maximum_filter1d
    techo = 10 ** (techo_db / 20)
    la = int(anticipo * FS)
    pico = maximum_filter1d(np.max(np.abs(x), axis=0), size=2 * la + 1)
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
# Los efectos solos, con la misma ganancia; un poco más arriba para no perderse bajo otra música.
efectos = masterizar(mezclar(["fx"]), ref, g)
efectos = limitador(efectos * 10 ** ((-1.6 - pico_real(efectos)) / 20), techo_db=-2.0)
escribir("efectos.wav", efectos)
