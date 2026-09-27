"""Estudio de sonido sintético para videos de pantalla: instrumentos, efectos, mezcla y master.

Todo se genera con numpy/scipy (sin muestras ni licencias). La partitura de cada video
es un script corto que importa esta librería, lee el reloj de `cues.js` y coloca notas y
efectos en segundos. Ver `ejemplo_partitura.py`.

    from audiolib import Estudio, leer_cues
    C = leer_cues("cues.js")
    e = Estudio(dur=C["dur"], bpm=C["bpm"])
    e.bombo_house(e.tb(1, 0))            # compás 1, pulso 0
    e.soplido(C["zoom"][0], 0.8, 280, 5200, vel=0.8)
    e.exportar("audio")                  # audio/pista.wav (todo) y audio/efectos.wav (bus fx)

Convenciones
- Tiempos en segundos; notas en MIDI (69 = La 440). `pan` de -1 (izq.) a 1 (der.).
- Cada método escribe en un bus. `fx` es el bus de efectos: sale solo en efectos.wav.
- Lo que suena después de `dur` vuelve a entrar al comienzo (el bucle no tiene costura).
- Compresión y limitador se calculan sobre dos vueltas seguidas: el estado al empezar
  es el del final, así el bucle no «respira» en el corte.
"""
import json
import os
import re
import wave

import numpy as np
from scipy.signal import fftconvolve, lfilter, resample_poly
from scipy.ndimage import maximum_filter1d

FS = 48000


# ───────────────────────── utilidades ─────────────────────────
def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def leer_cues(ruta="cues.js"):
    """Lee `window.CUES = {...};` (ignora comentarios //) y devuelve el dict."""
    texto = "\n".join(l for l in open(ruta, encoding="utf-8").read().splitlines() if not l.strip().startswith("//"))
    texto = re.sub(r"^[^=]*=\s*", "", texto.strip())
    return json.loads(re.sub(r";\s*$", "", texto))


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
    else:
        raise ValueError(kind)
    b = np.array(b) / a[0]
    a = np.array(a) / a[0]
    return b, a


def filt(x, *specs):
    """filt(x, ("hp", 120), ("peak", 2600, 0.9, 2.5), ("lp", 8000))"""
    for s in specs:
        b, a = biquad(*s)
        x = lfilter(b, a, x, axis=-1)
    return x


def barrido(x, f_de, f_a, q=2.0, kind="bp", curva=None, bloque=128):
    """Filtro que se mueve en el tiempo (por bloques, con estado): la base de los whooshes."""
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
    """Fase acumulada de una frecuencia que cambia en el tiempo (array en Hz)."""
    return 2 * np.pi * np.cumsum(f) / FS


def lufs(x):
    """Sonoridad integrada ITU-R BS.1770 (con compuertas absoluta y relativa)."""
    k1 = lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585], x, axis=-1)
    k = lfilter([1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621], k1, axis=-1)
    blk, hop = int(0.4 * FS), int(0.1 * FS)
    ms = np.array([np.sum(np.mean(k[:, i:i + blk] ** 2, axis=1)) for i in range(0, k.shape[1] - blk, hop)])
    ms = ms[-0.691 + 10 * np.log10(ms + 1e-15) > -70]
    rel = -0.691 + 10 * np.log10(np.mean(ms)) - 10
    ms = ms[(-0.691 + 10 * np.log10(ms)) > rel]
    return -0.691 + 10 * np.log10(np.mean(ms))


def pico_real(x):
    """Pico real (dBTP) con sobremuestreo x4."""
    return 20 * np.log10(np.max(np.abs(resample_poly(x, 4, 1, axis=-1))) + 1e-12)


def compresor(x, umbral_db=-16, ratio=2.0, ataque=0.01, suelta=0.15):
    nivel = np.sqrt(np.maximum(filt(np.mean(x ** 2, axis=0), ("lp", 30)), 0) + 1e-12)   # max(…,0): el pasabajos oscila bajo cero
    db = 20 * np.log10(nivel)
    g = 10 ** (-np.maximum(0, db - umbral_db) * (1 - 1 / ratio) / 20)
    a_at, a_su = np.exp(-1 / (ataque * FS)), np.exp(-1 / (suelta * FS))
    out = np.empty_like(g); v = 1.0
    for i in range(len(g)):
        a = a_at if g[i] < v else a_su
        v = a * v + (1 - a) * g[i]
        out[i] = v
    return x * out


def limitador(x, techo_db=-2.0, anticipo=0.004, suelta=0.08):
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


def escribir_wav(ruta, x):
    os.makedirs(os.path.dirname(ruta) or ".", exist_ok=True)
    pcm = (np.clip(x, -1, 1).T * 32767).astype("<i2")
    with wave.open(ruta, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(FS)
        w.writeframes(pcm.tobytes())


def leer_wav(ruta):
    w = wave.open(ruta)
    x = np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, w.getnchannels()).T / 32768.0
    return x


# Charango: 5 órdenes dobles (sol, do, mi-octava, la, mi), en orden de rasgueo.
CHARANGO = {
    "Am":    [69, 69, 72, 72, 76, 64, 69, 69, 76, 76],
    "C":     [67, 67, 72, 72, 76, 64, 72, 72, 76, 76],
    "G":     [67, 67, 74, 74, 79, 67, 71, 71, 79, 79],
    "E7":    [68, 68, 74, 74, 76, 64, 71, 71, 76, 76],
    "F":     [69, 69, 72, 72, 77, 65, 69, 69, 77, 77],
    "A":     [69, 69, 73, 73, 76, 64, 69, 69, 76, 76],
    "Asus2": [69, 69, 76, 76, 76, 64, 71, 71, 76, 76],
    "D":     [69, 69, 74, 74, 78, 66, 69, 69, 78, 78],
}
DETUNE_CHARANGO = [-3, 3, -2, 2, 0, 1, -3, 3, -2, 2]   # centésimas: el coro natural de las cuerdas dobles


class Estudio:
    """Una sesión de 'dur' segundos con buses estéreo. Se genera de más y la cola se pliega al inicio."""

    NIVEL = {"bombo": 0.55, "perc": 2.6, "bajo": 0.85, "armonia": 1.4, "cuerdas": 2.9, "melodia": 1.0,
             "kalimba": 1.0, "colchon": 1.2, "campanas": 1.0, "fx": 1.0}
    ENVIO = {"bombo": 0.04, "perc": 0.12, "bajo": 0.0, "armonia": 0.22, "cuerdas": 0.2, "melodia": 0.36,
             "kalimba": 0.35, "colchon": 0.3, "campanas": 0.5, "fx": 0.16}

    def __init__(self, dur=15.0, bpm=120, compas=4, cola=4.0, semilla=1):
        self.dur, self.bpm = dur, bpm
        self.pulso = 60.0 / bpm
        self.compas = compas * self.pulso
        self.N = int((dur + cola) * FS)
        self.rng = np.random.default_rng(semilla)
        self.bus = {}
        self.nivel = dict(self.NIVEL)
        self.envio = dict(self.ENVIO)
        self.eq = {}
        self._ir = None
        self._ecualizado = False

    # ── tiempo ──
    def tb(self, compas, pulso=0.0):
        """Segundos del compás n (desde 0), más `pulso` pulsos."""
        return compas * self.compas + pulso * self.pulso

    # ── mezcla básica ──
    def add(self, b, sig, t0, gain=1.0, pan=0.0):
        """Suma una señal mono (paneo de potencia constante) o estéreo (2×n) al bus b."""
        if b not in self.bus:
            self.bus[b] = np.zeros((2, self.N))
        i0 = int(round(t0 * FS))
        if sig.ndim == 1:
            a = (pan + 1) * np.pi / 4
            sig = np.vstack([np.cos(a) * sig, np.sin(a) * sig])
        if i0 < 0:
            sig = sig[:, -i0:]
            i0 = 0
        n = min(sig.shape[1], self.N - i0)
        if n > 0:
            self.bus[b][:, i0:i0 + n] += gain * sig[:, :n]

    def ruido(self, n):
        return self.rng.normal(0, 1, n)

    # ═════════════════ instrumentos ═════════════════
    def cuerda(self, f, dur, vel=1.0, t60=1.7, brillo=0.6):
        """Karplus-Strong con retardo fraccional (pasatodo) para afinar exacto. Devuelve la señal."""
        n = int(dur * FS)
        D = FS / f
        Nd = int(np.floor(D - 0.6))
        d = D - 0.5 - Nd
        c = (1 - d) / (1 + d)
        g = 10 ** (-3 / (t60 * f))
        exc = self.rng.uniform(-1, 1, Nd + 2)
        p = 0.15 + (1 - brillo) * 0.65
        exc = lfilter([1 - p], [1, -p], exc)
        k = max(1, int(Nd * 0.14))                  # posición de la púa
        exc[k:] -= 0.55 * exc[:-k]
        exc -= exc.mean()
        x = np.zeros(n)
        x[:len(exc)] = exc * vel
        a = np.zeros(Nd + 3)
        a[0] = 1.0; a[1] = c
        a[Nd] -= g / 2 * c; a[Nd + 1] -= g / 2 * (1 + c); a[Nd + 2] -= g / 2
        return lfilter([1.0, c], a, x)

    def rasgueo(self, notas, t0, vel=0.8, abajo=True, lapso=0.022, dur=1.4, brillo=0.62, bus="cuerdas", detune=None):
        """Rasguea una lista de cuerdas (MIDI, en orden físico). Para charango: CHARANGO['Am']."""
        detune = detune or (DETUNE_CHARANGO if len(notas) == 10 else [0] * len(notas))
        orden = range(len(notas)) if abajo else range(len(notas) - 1, -1, -1)
        for k, i in enumerate(orden):
            f = hz(notas[i]) * 2 ** (detune[i] / 1200)
            v = vel * self.rng.uniform(0.82, 1.0) * (1.0 if abajo else 0.8)
            s = self.cuerda(f, dur, v, t60=1.5 + self.rng.uniform(-0.2, 0.2), brillo=brillo)
            self.add(bus, s, t0 + k * lapso / len(notas) + self.rng.normal(0, 0.0015), 0.11,
                     pan=-0.52 + 0.58 * (i / max(1, len(notas) - 1)))

    def arpegio(self, notas, t0, paso, vel=0.4, dur=1.6, bus="cuerdas"):
        for k, m in enumerate(notas):
            s = self.cuerda(hz(m), dur, vel * self.rng.uniform(0.85, 1.0), t60=1.9, brillo=0.5)
            self.add(bus, s, t0 + k * paso, 0.16, pan=-0.3 + 0.38 * np.sin(1.7 * k))

    def quena(self, t0, dur, m, vel=0.8, vibrato=1.0, bus="melodia", pan=0.22):
        """Flauta andina: aditiva + soplo + ataque «chiff»."""
        f0 = hz(m); rel = 0.1
        n = int((dur + rel) * FS)
        t = np.arange(n) / FS
        cents = -32 * np.exp(-t / 0.028)
        cents = cents + 16 * vibrato * np.clip((t - 0.1) / 0.3, 0, 1) * np.sin(2 * np.pi * 5.3 * t + self.rng.uniform(0, 6.28))
        deriva = lfilter([0.002], [1, -0.998], self.ruido(n)) * 3
        ph = fase(f0 * 2 ** ((cents + deriva) / 1200))
        tono = np.sin(ph) + 0.2 * np.sin(2 * ph + 0.4) + 0.085 * np.sin(3 * ph + 1.1) + 0.03 * np.sin(4 * ph)
        r = self.ruido(n)
        soplo = filt(r, ("bp", min(2.3 * f0, 6500), 0.9)) * 0.55 + filt(r, ("hp", 5200)) * 0.05
        env = np.ones(n)
        na = int(0.035 * FS)
        env[:na] = np.linspace(0, 1, na) ** 1.5
        env *= 1 + 0.06 * np.sin(np.pi * np.clip(t / max(dur, 0.05), 0, 1))
        nr = int(rel * FS)
        env[n - nr:] *= np.linspace(1, 0, nr) ** 2
        turb = 1 + 0.05 * lfilter([0.02], [1, -0.98], self.ruido(n))
        chiff = filt(r, ("bp", 3 * f0, 1.5)) * np.exp(-t / 0.018) * 0.9
        self.add(bus, (0.78 * tono * turb + 0.22 * soplo) * env + chiff * 0.35, t0, 0.2 * vel, pan=pan)

    def silbido(self, t0, dur, m, vel=0.8, de=None, bus="melodia", pan=0.12):
        """Silbido: seno casi puro, aire y vibrato tardío. `de` = nota anterior para deslizar."""
        f0 = hz(m); rel = 0.07
        n = int((dur + rel) * FS)
        t = np.arange(n) / FS
        cents = (hz(de) / f0 - 1) * 1731 * np.exp(-t / 0.035) if de else -38 * np.exp(-t / 0.03)
        vib = 11 * np.clip((t - 0.12) / 0.25, 0, 1) * np.sin(2 * np.pi * 5.6 * t + self.rng.uniform(0, 6.28))
        deriva = lfilter([0.002], [1, -0.998], self.ruido(n)) * 2.5
        ph = fase(f0 * 2 ** ((cents + vib + deriva) / 1200))
        tono = np.sin(ph) + 0.05 * np.sin(2 * ph) + 0.015 * np.sin(3 * ph)
        aire = filt(self.ruido(n), ("bp", min(f0, 7000), 6.0)) * 0.35 + filt(self.ruido(n), ("hp", 6500)) * 0.03
        e = np.ones(n)
        na = int(0.022 * FS)
        e[:na] = np.linspace(0, 1, na) ** 1.6
        nr = int(rel * FS)
        e[n - nr:] *= np.linspace(1, 0, nr) ** 2
        self.add(bus, (tono * 0.9 + aire * 0.25) * e, t0, 0.13 * vel, pan=pan)

    def piano(self, t0, m, dur, vel=0.7, pan=0.0, bus="armonia"):
        """Piano eléctrico por FM: la púa (índice que cae) y la campanita del ataque (14:1)."""
        f = hz(m)
        n = int((dur + 0.5) * FS)
        t = np.arange(n) / FS
        lados = []
        for d in (-3.5, 3.5):                       # dos voces apenas desafinadas: ancho natural
            ff = f * 2 ** (d / 1200)
            I1 = (0.9 + 1.1 * vel) * np.exp(-t / 0.55)
            I2 = 0.85 * vel * np.exp(-t / 0.018)
            lados.append(np.sin(2 * np.pi * ff * t + I1 * np.sin(2 * np.pi * ff * t) + I2 * np.sin(2 * np.pi * 14 * ff * t)))
        s = np.vstack(lados)
        e = np.minimum(1, t / 0.002) * np.exp(-t / (1.5 * (1.15 - (m - 48) / 60)))
        ns = int(dur * FS)
        e[ns:] *= np.exp(-(t[ns:] - dur) / 0.07)
        trem = 1 + 0.12 * np.sin(2 * np.pi * 4.2 * (t + t0) + np.array([[0], [np.pi]]))
        a = (pan + 1) * np.pi / 4
        self.add(bus, s * e * trem * np.array([[np.cos(a) * 1.41], [np.sin(a) * 1.41]]) * 0.5, t0, 0.12 * vel)

    def acorde_piano(self, t0, notas, dur, vel=0.7, bus="armonia"):
        for k, m in enumerate(notas):
            self.piano(t0 + k * 0.006, m, dur, vel * (0.92 + 0.08 * k / len(notas)),
                       pan=-0.25 + 0.5 * k / max(1, len(notas) - 1), bus=bus)

    def kalimba(self, t0, m, vel=0.6, pan=0.0, bus="kalimba"):
        f = hz(m)
        n = int(1.4 * FS)
        t = np.arange(n) / FS
        s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.55)
        for r, amp, dec in [(5.93, 0.26, 0.05), (13.3, 0.09, 0.018)]:
            if f * r < 17000:
                s += amp * np.sin(2 * np.pi * f * r * t) * np.exp(-t / dec)
        s += filt(self.ruido(n), ("hp", 2500)) * np.exp(-t / 0.002) * 0.3
        self.add(bus, s * np.minimum(1, t / 0.0008), t0, 0.1 * vel, pan=pan)

    def campana(self, t0, m, vel=0.6, pan=0.0, dec=1.0, bus="campanas"):
        f = hz(m)
        n = int(2.2 * FS)
        t = np.arange(n) / FS
        I = 1.8 * np.exp(-t / 0.2)
        s = np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * 3.5 * t)) * np.exp(-t / dec)
        s += 0.2 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.28)
        self.add(bus, s * np.minimum(1, t / 0.002), t0, 0.07 * vel, pan=pan)

    def colchon(self, t0, dur, notas, vel=0.5, ataque=0.4, suelta=0.8, corte=1500, bus="colchon"):
        """Pad de sierras desafinadas, cada canal con sus fases (ancho)."""
        n = int((dur + suelta) * FS)
        t = np.arange(n) / FS
        lados = []
        for lado in range(2):
            s = np.zeros(n)
            for m in notas:
                for dt in (-8, 0, 8):
                    f = hz(m) * 2 ** ((dt + (lado - 0.5) * 5) / 1200)
                    s += 2 * ((f * t + self.rng.uniform(0, 1)) % 1.0) - 1
            s /= 3 * len(notas)
            lados.append(filt(s, ("lp", corte, 0.6), ("lp", corte * 1.4, 0.6), ("hp", 140)))
        e = np.minimum(1, t / ataque)
        ns = int(dur * FS)
        e[ns:] *= np.exp(-(t[ns:] - dur) / (suelta / 3))
        self.add(bus, np.vstack(lados) * e * 0.7, t0, 0.15 * vel)

    def bajo_pulsado(self, t0, m, dur, vel=0.8, bus="bajo"):
        """Bajo de house: sierra limitada en banda con filtro que se cierra, más su sub."""
        f = hz(m)
        n = int((dur + 0.06) * FS)
        t = np.arange(n) / FS
        ph = 2 * np.pi * f * t
        saw = sum(np.sin(k * ph) / k for k in range(1, 14) if k * f < 9000)
        s = barrido(saw, 1500 * (0.6 + 0.4 * vel), 260, q=0.9, kind="lp", curva=lambda u: 1 - np.exp(-u * n / FS / 0.07))
        s = 0.55 * s + 0.75 * np.sin(ph)
        e = np.minimum(1, t / 0.003) * (0.7 + 0.3 * np.exp(-t / 0.09))
        ns = int(dur * FS)
        e[ns:] *= np.linspace(1, 0, n - ns) ** 2
        self.add(bus, np.tanh(1.2 * s * e) / np.tanh(1.2), t0, 0.26 * vel)

    def bajo_redondo(self, t0, m, dur, vel=0.8, bus="bajo"):
        """Bajo cálido de pocas armónicas (para música acústica o andina)."""
        f = hz(m)
        n = int((dur + 0.08) * FS)
        t = np.arange(n) / FS
        ph = 2 * np.pi * f * t
        s = np.tanh(1.4 * (np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph))) / np.tanh(1.4)
        e = np.minimum(1, t / 0.004) * (0.55 + 0.45 * np.exp(-t / 0.12))
        ns = int(dur * FS); nr = int(0.06 * FS)
        e[ns:ns + nr] *= np.linspace(1, 0, min(nr, n - ns))
        e[ns + nr:] = 0
        self.add(bus, filt(s * e, ("lp", 900)), t0, 0.3 * vel)

    def bombo_house(self, t0, vel=0.9, bus="bombo"):
        n = int(0.55 * FS)
        t = np.arange(n) / FS
        cuerpo = np.sin(fase(46 + 105 * np.exp(-t / 0.03))) * np.exp(-t / 0.27)
        click = filt(self.ruido(n), ("hp", 2600)) * np.exp(-t / 0.0028) * 0.3
        self.add(bus, (cuerpo + click) * np.minimum(1, t / 0.0012), t0, 0.62 * vel)

    def bombo_leguero(self, t0, vel=0.8, bus="bombo"):
        """Bombo andino: cuerpo grave con parche."""
        n = int(0.6 * FS)
        t = np.arange(n) / FS
        cuerpo = np.sin(fase(50 + 75 * np.exp(-t / 0.03))) * np.exp(-t / 0.24)
        parche = filt(self.ruido(n), ("lp", 900), ("hp", 90)) * np.exp(-t / 0.018) * 0.5
        self.add(bus, (cuerpo + parche) * np.minimum(1, t / 0.0015), t0, 0.62 * vel)

    def aro(self, t0, vel=0.6, bus="bombo"):
        n = int(0.12 * FS)
        t = np.arange(n) / FS
        s = filt(self.ruido(n), ("bp", 2300, 2.2)) * np.exp(-t / 0.012) + 0.5 * np.sin(2 * np.pi * 820 * t) * np.exp(-t / 0.022)
        self.add(bus, s, t0, 0.24 * vel, pan=0.1)

    def golpe(self, t0, vel=0.8, bus="bombo"):
        n = int(0.45 * FS)
        t = np.arange(n) / FS
        s = np.sin(fase(46 + 110 * np.exp(-t / 0.025))) * np.exp(-t / 0.2)
        s += filt(self.ruido(n), ("hp", 3000)) * np.exp(-t / 0.004) * 0.25
        self.add(bus, s, t0, 0.55 * vel)

    def palmas(self, t0, vel=0.6, pan=0.0, bus="perc"):
        n = int(0.28 * FS)
        t = np.arange(n) / FS
        r = filt(self.ruido(n), ("bp", 1150, 0.8), ("peak", 2400, 1.0, 3))
        e = np.zeros(n)
        for d in (0.0, 0.008, 0.017):
            i = int(d * FS)
            e[i:] += np.exp(-(t[: n - i]) / 0.0045)
        i = int(0.023 * FS)
        e[i:] += 0.85 * np.exp(-(t[: n - i]) / 0.075)
        self.add(bus, r * e, t0, 0.2 * vel, pan=pan)

    def plato(self, t0, vel=0.5, abierto=False, pan=0.25, bus="perc"):
        """Charles: parciales metálicos (a lo 808) por un pasaaltos."""
        n = int((0.32 if abierto else 0.07) * FS)
        t = np.arange(n) / FS
        s = sum(np.sign(np.sin(2 * np.pi * f * t + self.rng.uniform(0, 6.28))) for f in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0))
        s = filt(s + 0.8 * self.ruido(n), ("hp", 7200), ("peak", 10000, 1.2, 3))
        s *= np.exp(-t / (0.1 if abierto else 0.016)) * np.minimum(1, t / 0.0005)
        self.add(bus, s, t0, 0.028 * vel, pan=pan)

    def maraca(self, t0, vel=0.4, largo=0.06, pan=-0.35, bus="perc", corte=4200):
        """Maraca / chajchas: granitos de ruido agudo (corte más bajo = semillas más secas)."""
        n = int((largo + 0.03) * FS)
        s = np.zeros(n)
        for _ in range(int(10 + 16 * vel)):
            i = int(min(self.rng.exponential(largo / 3.2), largo) * FS)
            L = 80
            if i + L < n:
                s[i:i + L] += self.ruido(L) * np.exp(-np.arange(L) / 14) * self.rng.uniform(0.3, 1)
        self.add(bus, filt(s, ("hp", corte), ("peak", 7500, 1.0, 3)), t0, 0.16 * vel, pan=pan)

    # ═════════════════ efectos (bus fx) ═════════════════
    def soplido(self, t0, dur, f_de, f_a, vel=0.5, pan_de=0.0, pan_a=0.0, q=1.6, forma=None):
        """Whoosh: ruido filtrado que viaja en frecuencia y en el estéreo. `forma(u)` = envolvente."""
        n = int(dur * FS)
        u = np.linspace(0, 1, n)
        s = barrido(self.ruido(n), f_de, f_a, q=q)
        s = s * (np.sin(np.pi * u) ** 2 if forma is None else forma(u))
        a = (pan_de + (pan_a - pan_de) * u + 1) * np.pi / 4
        self.add("fx", np.vstack([np.cos(a) * s, np.sin(a) * s]), t0, 0.35 * vel)

    def subida(self, t0, dur, vel=0.5, f_de=300, f_a=7000):
        """Riser: rizo de ruido que sube hacia un golpe."""
        n = int(dur * FS)
        u = np.linspace(0, 1, n)
        self.add("fx", barrido(self.ruido(n), f_de, f_a, q=2.4, curva=lambda x: x ** 1.4) * u ** 2.4, t0, 0.13 * vel)

    def impacto(self, t0, vel=1.0, cola=0.4):
        """Golpe grave con platillo abierto: cae la música o llega una escena."""
        n = int(1.6 * FS)
        t = np.arange(n) / FS
        self.add("fx", np.sin(fase(40 + 55 * np.exp(-t / 0.07))) * np.exp(-t / cola), t0, 0.3 * vel)
        for p in (-0.4, 0.4):
            crash = filt(self.ruido(n), ("hp", 1500), ("peak", 6000, 0.8, 3)) * np.exp(-t / 0.5) * np.minimum(1, t / 0.002)
            self.add("fx", crash, t0, 0.03 * vel, pan=p)

    def gelatina(self, t0, f0, f1, vel=0.8, pan=0.0, dur=0.6):
        """«Boing» blando: el tono viaja de f0 a f1 y tiembla. Algo que crece o se asienta."""
        n = int(dur * FS)
        t = np.arange(n) / FS
        base = f0 * (f1 / f0) ** (1 - (1 - t / dur) ** 3)
        ph = fase(base * (1 + 0.16 * np.exp(-t / 0.16) * np.sin(2 * np.pi * 11 * t)))
        s = (np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph)) * np.exp(-t / (dur / 3.2)) * np.minimum(1, t / 0.004)
        golpe = np.sin(fase(60 + 70 * np.exp(-t / 0.03))) * np.exp(-t / 0.1)
        self.add("fx", filt(s, ("lp", 2400)) * 0.9 + golpe * 0.55, t0, 0.2 * vel, pan=pan)

    def burbuja(self, t0, f, vel=0.5, pan=0.0, sube=True):
        """Burbuja que revienta: el tono sube rápido y se apaga (así suena el agua)."""
        n = int(0.12 * FS)
        t = np.arange(n) / FS
        fi = f * (1 + (0.9 if sube else -0.35) * (1 - np.exp(-t / 0.018)))
        self.add("fx", np.sin(fase(fi)) * np.exp(-t / 0.035) * np.minimum(1, t / 0.0015), t0, 0.07 * vel, pan=pan)

    def llenado(self, t0, dur, f_de, f_a, vel=0.8, pan=0.0, semilla=0, baja=False):
        """Algo que se llena (burbujas cada vez más agudas) o se vacía (baja=True)."""
        r = np.random.default_rng(300 + semilla)
        tt = 0.0
        while tt < dur:
            f = f_de * (f_a / f_de) ** (tt / dur)
            self.burbuja(t0 + tt, f * r.uniform(0.94, 1.06), vel * r.uniform(0.55, 1.0), pan=pan + r.uniform(-0.15, 0.15), sube=not baja)
            tt += r.uniform(0.035, 0.075)
        n = int(dur * FS)
        u = np.linspace(0, 1, n)
        self.add("fx", barrido(r.normal(0, 1, n), f_de * 0.5, f_a * 0.5, q=5.0) * np.sin(np.pi * u) ** 1.5, t0, 0.05 * vel, pan=pan)

    def bloop(self, t0, vel=0.8, pan=0.0):
        """Succión corta que remata en un pop: un hueco que se cierra."""
        n = int(0.22 * FS)
        t = np.arange(n) / FS
        s = np.sin(fase(180 + 520 * (t / 0.22) ** 2)) * np.sin(np.pi * np.minimum(1, t / 0.22)) ** 1.2
        pop = filt(self.ruido(n), ("bp", 1400, 1.5)) * np.exp(-np.maximum(t - 0.18, 0) / 0.006) * (t > 0.18)
        self.add("fx", s * 0.8 + pop * 0.8, t0, 0.2 * vel, pan=pan)

    def pop(self, t0, m, vel=0.8, pan=0.0):
        """Algo que aparece o cae (un arco, una bola): burbuja afinada, redonda."""
        f = hz(m)
        n = int(0.3 * FS)
        t = np.arange(n) / FS
        ph = fase(f * (0.55 + 0.45 * (1 - np.exp(-t / 0.012))))
        s = (np.sin(ph) + 0.22 * np.sin(2 * ph) * np.exp(-t / 0.03)) * np.exp(-t / 0.09) * np.minimum(1, t / 0.0015)
        s += filt(self.ruido(n), ("hp", 2600)) * np.exp(-t / 0.0022) * 0.2
        self.add("fx", s, t0, 0.17 * vel, pan=pan)

    def tic(self, t0, vel=0.6, tono=1.0, pan=0.0):
        """Clic de madera chica: algo que encaja (un carrusel, una ficha)."""
        n = int(0.12 * FS)
        t = np.arange(n) / FS
        s = sum(amp * np.sin(2 * np.pi * f * tono * t) * np.exp(-t / dec) for f, dec, amp in [(1850, 0.02, 1.0), (3120, 0.012, 0.6), (4700, 0.008, 0.4)])
        s += filt(self.ruido(n), ("bp", 3000, 1.2)) * np.exp(-t / 0.002)
        self.add("fx", s * np.minimum(1, t / 0.0005), t0, 0.07 * vel, pan=pan)

    def madera(self, t0, vel=1.0, tono=1.0, pan=0.0):
        """Golpe de madera por síntesis modal: una puerta que se cierra, un portazo."""
        n = int(0.5 * FS)
        t = np.arange(n) / FS
        s = np.zeros(n)
        for f, dec, amp in [(168, 0.14, 1.0), (331, 0.1, 0.75), (566, 0.07, 0.6), (829, 0.05, 0.45),
                            (1236, 0.04, 0.32), (1851, 0.03, 0.22), (2710, 0.018, 0.14)]:
            s += amp * np.sin(2 * np.pi * f * tono * t + self.rng.uniform(0, 6.28)) * np.exp(-t / dec)
        s += filt(self.ruido(n), ("bp", 1600, 1.2)) * np.exp(-t / 0.004) * 1.2
        s += 0.9 * np.sin(fase(55 + 60 * np.exp(-t / 0.02))) * np.exp(-t / 0.09)
        self.add("fx", s * np.minimum(1, t / 0.0008), t0, 0.26 * vel, pan=pan)

    def jarabe(self, t0, dur, vel=0.8, semilla=55):
        """Jarabe o salsa que cae: chorro espeso que baja de tono, gotas gordas y el golpe al cubrir."""
        n = int(dur * FS)
        u = np.linspace(0, 1, n)
        chorro = barrido(self.ruido(n), 900, 260, q=3.2, curva=lambda x: x ** 0.8) * np.sin(np.pi * np.minimum(1, u * 1.1)) ** 1.2
        espeso = np.sin(fase(160 * (1 - 0.45 * u) * (1 + 0.08 * np.sin(2 * np.pi * 7 * u * dur)))) * np.sin(np.pi * u) ** 2
        self.add("fx", chorro, t0, 0.2 * vel, pan=-0.1)
        self.add("fx", filt(espeso, ("lp", 900)), t0, 0.08 * vel)
        r = np.random.default_rng(semilla)
        for _ in range(14):
            self.burbuja(t0 + dur * (0.15 + 0.8 * r.uniform() ** 0.8), r.uniform(380, 720), vel * r.uniform(0.5, 1), pan=r.uniform(-0.8, 0.8))
        m = int(0.5 * FS)
        t = np.arange(m) / FS
        splat = filt(self.ruido(m), ("lp", 1600), ("hp", 120)) * np.exp(-t / 0.09) * np.minimum(1, t / 0.004)
        self.add("fx", splat, t0 + dur - 0.06, 0.16 * vel)

    def chispas(self, t0, dur, n=10, vel=0.5, ancho=0.8, semilla=0):
        """Destellos sin afinación de escala: brillan sin chocar con ninguna tonalidad."""
        r = np.random.default_rng(900 + semilla)
        for k in range(n):
            f = r.uniform(3200, 7800)
            m = int(0.35 * FS)
            t = np.arange(m) / FS
            x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 1.51 * t) * np.exp(-t / 0.03)
            x *= np.exp(-t / r.uniform(0.05, 0.12)) * np.minimum(1, t / 0.0008)
            self.add("fx", x, t0 + dur * (k / n) ** 0.8 + r.uniform(0, 0.03), 0.045 * vel * r.uniform(0.5, 1), pan=r.uniform(-ancho, ancho))

    def destello(self, t0, m, vel=0.3, pan=0.0):
        """Tintineo afinado muy corto (brillo sobre algo que aparece)."""
        n = int(0.5 * FS)
        t = np.arange(n) / FS
        self.add("fx", np.sin(2 * np.pi * hz(m) * t) * np.exp(-t / 0.12) * np.minimum(1, t / 0.001), t0, 0.06 * vel, pan=pan)

    def hilo(self, t0, vel=0.5):
        """Roce metálico finito que se abre a los lados: un filete o una línea que se dibuja."""
        n = int(0.55 * FS)
        u = np.linspace(0, 1, n)
        s = barrido(self.ruido(n), 3500, 9000, q=4.0) * np.sin(np.pi * u) ** 2 * (1 - u)
        for p in (-0.6, 0.6):
            self.add("fx", s, t0, 0.06 * vel, pan=p)
        n2 = int(1.2 * FS)
        t = np.arange(n2) / FS
        f = hz(101)
        b = np.sin(2 * np.pi * f * t + 1.8 * np.exp(-t / 0.2) * np.sin(2 * np.pi * f * 3.5 * t)) * np.exp(-t / 0.5)
        self.add("fx", b * np.minimum(1, t / 0.002), t0 + 0.18, 0.07 * 0.25)

    def pajarito(self, t0, vel=0.5, pan=0.3, f=4200, notas=2):
        """Pío corto, dos o tres veces: amanecer, jardín, frescura."""
        for k in range(notas):
            n = int(0.09 * FS)
            t = np.arange(n) / FS
            fi = f * (1 + 0.28 * np.sin(np.pi * t / 0.09) - 0.12 * t / 0.09) * (1 + 0.04 * np.sin(2 * np.pi * 60 * t))
            self.add("fx", np.sin(fase(fi)) * np.sin(np.pi * t / 0.09) ** 2, t0 + k * 0.12, 0.022 * vel, pan=pan)

    def papel(self, t0, dur, n=36, vel=0.5, semilla=77):
        """Aleteos cortos y secos que se van espaciando: pétalos, papel picado, hojas."""
        r = np.random.default_rng(semilla)
        for k in range(n):
            m = int(0.05 * FS)
            t = np.arange(m) / FS
            x = filt(r.normal(0, 1, m), ("bp", r.uniform(1400, 4200), 1.4))
            e = np.exp(-t / 0.006) + 0.6 * np.exp(-np.maximum(t - 0.012, 0) / 0.005) * (t > 0.012)
            self.add("fx", x * e, t0 + dur * (k / n) ** 1.6, 0.05 * vel * r.uniform(0.4, 1), pan=r.uniform(-0.8, 0.8))

    def siseo(self, t0, dur, vel=0.4, pan=0.35):
        """Vapor de una taza: soplo aireado que respira (mantenerlo muy bajo)."""
        m = int(dur * FS)
        u = np.linspace(0, 1, m)
        x = filt(self.ruido(m), ("bp", 4800, 1.1), ("lp", 8000))
        e = np.sin(np.pi * u) ** 1.5 * (0.7 + 0.3 * np.sin(2 * np.pi * 1.3 * u * dur))
        self.add("fx", x * e, t0, 0.02 * vel, pan=pan)

    def brillo(self, t0, vel=1.0):
        """El brillo que barre un logo: siseo agudo, campanita y chispas."""
        n = int(0.8 * FS)
        u = np.linspace(0, 1, n)
        self.add("fx", filt(self.ruido(n), ("hp", 7000)) * np.sin(np.pi * u) ** 2, t0, 0.018 * vel, pan=0.2)
        n2 = int(1.6 * FS)
        t = np.arange(n2) / FS
        f = hz(101)
        b = np.sin(2 * np.pi * f * t + 1.8 * np.exp(-t / 0.2) * np.sin(2 * np.pi * f * 3.5 * t)) * np.exp(-t / 0.8)
        self.add("fx", b * np.minimum(1, t / 0.002), t0 + 0.35, 0.07 * 0.35 * vel, pan=0.3)
        self.chispas(t0 + 0.1, 0.6, n=8, vel=0.6 * vel, ancho=0.5, semilla=3)

    # ═════════════════ mezcla y master ═════════════════
    def ir_sala(self, rt60=1.4, largo=2.4, pre=0.012):
        n = int(largo * FS)
        t = np.arange(n) / FS
        out = np.zeros((2, n))
        for ch in range(2):
            x = self.ruido(n)
            lo = filt(x, ("lp", 450)) * 10 ** (-3 * t / (rt60 * 1.1))
            mi = filt(x, ("hp", 450), ("lp", 4000)) * 10 ** (-3 * t / rt60)
            hi = filt(x, ("hp", 4000)) * 10 ** (-3 * t / (rt60 * 0.45))
            i = int(pre * FS)
            out[ch, i:] = ((lo + mi + hi) * np.minimum(1, t / 0.006))[: n - i]
        return out / np.sqrt(np.sum(out ** 2) / 2)

    def diag(self, tramos):
        """Imprime el RMS (dBFS) de cada bus por tramo: para balancear sin poder escuchar."""
        print("bus        " + "".join(f"{a:>6.2f}-{b:<6.2f}" for a, b in tramos))
        for bn in sorted(self.bus):
            fila = ""
            for a0, b0 in tramos:
                x = self.nivel.get(bn, 1.0) * self.bus[bn][:, int(a0 * FS):int(b0 * FS)]
                fila += f"{20 * np.log10(np.sqrt(np.mean(x ** 2) + 1e-12)):>13.1f}"
            print(f"{bn:<10} {fila}")

    def mezclar(self, incluir, ir=None, humedad=0.27):
        if ir is None:
            if getattr(self, "_ir", None) is None:
                self._ir = self.ir_sala()
            ir = self._ir
        seco = sum(self.nivel.get(b, 1.0) * self.bus[b] for b in incluir if b in self.bus)
        envio = sum(self.envio.get(b, 0.2) * self.nivel.get(b, 1.0) * self.bus[b] for b in incluir if b in self.bus)
        humedo = np.vstack([fftconvolve(envio[0], ir[0])[:self.N], fftconvolve(envio[1], ir[1])[:self.N]])
        m = filt(seco + humedad * humedo, ("hp", 32), ("hp", 32))
        # Plegado del bucle: lo que suena después de dur vuelve a entrar al comienzo.
        nd = int(self.dur * FS)
        p = m[:, :nd].copy()
        cola = m[:, nd:]
        p[:, : cola.shape[1]] += cola
        return p

    @staticmethod
    def masterizar(p, ref, g, techo_db=-2.0):
        """Compresión y limitador sobre dos vueltas: el estado al empezar es el del final."""
        n = p.shape[1]
        return limitador(compresor(np.tile(p / ref * 0.7, 2)) * g, techo_db=techo_db)[:, n:]

    def ecualizar(self):
        """EQ de bus por defecto; se puede reemplazar en self.eq[bus] = [("hp", 150), …]. Se aplica una sola vez."""
        if self._ecualizado:
            return
        self._ecualizado = True
        base = {"armonia": [("hp", 150), ("peak", 900, 0.8, 1.5), ("hs", 6000, 0.7, -2)],
                "cuerdas": [("hp", 160), ("peak", 2600, 0.9, 2.5), ("hs", 7000, 0.7, -2)],
                "melodia": [("hp", 260)], "bajo": [("hp", 30)], "bombo": [("hp", 28), ("peak", 62, 1.0, 2)],
                "kalimba": [("hp", 250)]}
        base.update(self.eq)
        for b, specs in base.items():
            if b in self.bus and specs:
                self.bus[b] = filt(self.bus[b], *specs)

    def exportar(self, carpeta="audio", objetivo=-16.0, pico_efectos=-1.6, buses_musica=None, verbose=True):
        """Escribe pista.wav (todo, a `objetivo` LUFS) y efectos.wav (solo fx, pico real ≈ pico_efectos)."""
        self.ecualizar()
        todos = buses_musica or list(self.bus)
        completa = self.mezclar(todos)
        ref = np.max(np.abs(completa))
        g = 1.0
        for _ in range(6):
            prueba = self.masterizar(completa, ref, g)
            L = lufs(prueba)
            if abs(L - objetivo) < 0.15:
                break
            g *= 10 ** ((objetivo - L) / 20)
        escribir_wav(os.path.join(carpeta, "pista.wav"), prueba)
        salida = {"pista.wav": (lufs(prueba), pico_real(prueba))}
        if "fx" in self.bus:
            # Los efectos solos van con la misma ganancia y luego un poco más arriba, para no
            # perderse debajo de otra música que ponga el cliente.
            ef = self.masterizar(self.mezclar(["fx"]), ref, g)
            ef = limitador(ef * 10 ** ((pico_efectos - pico_real(ef)) / 20), techo_db=-2.0)
            escribir_wav(os.path.join(carpeta, "efectos.wav"), ef)
            salida["efectos.wav"] = (lufs(ef), pico_real(ef))
        if verbose:
            for k, (L, P) in salida.items():
                print(f"{k:<12} LUFS {L:6.2f} · pico real {P:6.2f} dBTP")
        return salida
