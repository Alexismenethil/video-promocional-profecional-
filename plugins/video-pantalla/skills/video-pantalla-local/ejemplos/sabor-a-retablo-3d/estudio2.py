"""Estudio 2: audiolib con instrumentos y mezcla de producción.

Lo nuevo frente a audiolib.Estudio:
- Batería por capas (bombo con cuerpo + clic + saturación, palmas con cola, charles, shaker con acento,
  pandereta, platillo, redoble), bajo de house (sub + púa filtrada), acordes brillantes (sierras
  desafinadas con filtro que se cierra), zampoña (flauta de caña con soplo).
- Efectos: whoosh con cuerpo grave, riser con tono que sube, platillo al revés, impacto con sub,
  portazo de madera, aleteo de papel, estela de destellos que viaja en el estéreo, brillo.
- Mezcla: «sidechain» al bombo (el bajo, los acordes y el colchón respiran con cada golpe), dos
  reverberaciones (sala grande para lo melódico, cuarto para la batería), eco ping-pong de corchea con
  puntillo, y master con compresión de pegamento, saturación suave y limitador, calculado sobre dos
  vueltas para que el bucle no respire en el corte.
"""
import numpy as np
from scipy.signal import fftconvolve, lfilter

from audiolib import (FS, Estudio, barrido, escribir_wav, fase, filt, hz, lufs, pico_real)


def compresor_rapido(x, umbral_db=-18, ratio=2.0, ataque=0.015, suelta=0.18, paso=16):
    """Compresor por RMS con la envolvente calculada cada `paso` muestras (rápido en Python)."""
    nivel = np.sqrt(np.maximum(filt(np.mean(x ** 2, axis=0), ("lp", 25)), 0) + 1e-12)
    db = 20 * np.log10(nivel[::paso])
    g = 10 ** (-np.maximum(0, db - umbral_db) * (1 - 1 / ratio) / 20)
    a_at, a_su = np.exp(-paso / (ataque * FS)), np.exp(-paso / (suelta * FS))
    out = np.empty_like(g); v = 1.0
    for i in range(len(g)):
        a = a_at if g[i] < v else a_su
        v = a * v + (1 - a) * g[i]
        out[i] = v
    gi = np.interp(np.arange(x.shape[1]), np.arange(len(out)) * paso, out)
    return x * gi


def limitador_rapido(x, techo_db=-1.3, anticipo=0.005, suelta=0.06, paso=8):
    from scipy.ndimage import maximum_filter1d
    techo = 10 ** (techo_db / 20)
    la = int(anticipo * FS)
    pico = maximum_filter1d(np.max(np.abs(x), axis=0), size=2 * la + 1)[::paso]
    g = np.minimum(1, techo / np.maximum(pico, 1e-9))
    a = np.exp(-paso / (suelta * FS))
    out = np.empty_like(g); v = 1.0
    for i in range(len(g)):
        v = g[i] if g[i] < v else a * v + (1 - a) * g[i]
        out[i] = v
    gi = np.interp(np.arange(x.shape[1]), np.arange(len(out)) * paso, out)
    return x * np.minimum(gi, 1.0)


class Estudio2(Estudio):
    NIVEL = {"bombo": 0.9, "perc": 1.0, "bajo": 0.9, "armonia": 1.0, "cuerdas": 1.0, "melodia": 1.0,
             "kalimba": 1.0, "colchon": 1.0, "campanas": 1.0, "pluck": 1.0, "fx": 1.0}
    ENVIO = {"bombo": 0.02, "perc": 0.1, "bajo": 0.0, "armonia": 0.18, "cuerdas": 0.18, "melodia": 0.3,
             "kalimba": 0.35, "colchon": 0.3, "campanas": 0.5, "pluck": 0.2, "fx": 0.14}

    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self.golpes = []            # tiempos del bombo (para el sidechain)
        self.nivel = dict(self.NIVEL)
        self.envio = dict(self.ENVIO)
        self.duck = {"bajo": 0.78, "armonia": 0.42, "colchon": 0.55, "cuerdas": 0.25, "pluck": 0.5, "kalimba": 0.0, "melodia": 0.12}
        self.eco = {"melodia": 0.22, "kalimba": 0.18, "pluck": 0.12}
        self.sin_duck = []          # tramos [t0, t1] donde no hay sidechain (intro, cierre)
        self.ancho = {"cuerdas": 1.7, "armonia": 1.5, "pluck": 1.6, "colchon": 1.35, "perc": 1.25, "kalimba": 1.4, "campanas": 1.3}

    # ═════════ batería ═════════
    def bombo2(self, t0, vel=1.0, bus="bombo", duck=True):
        n = int(0.6 * FS)
        t = np.arange(n) / FS
        f = 47 + 120 * np.exp(-t / 0.032) + 260 * np.exp(-t / 0.004)
        cuerpo = np.sin(fase(f)) * (np.exp(-t / 0.30) * 0.85 + 0.15 * np.exp(-t / 0.08))
        click = filt(self.ruido(n), ("hp", 2200), ("lp", 9000)) * np.exp(-t / 0.0022) * 0.45
        blip = np.sin(2 * np.pi * 1650 * t) * np.exp(-t / 0.004) * 0.25
        s = np.tanh(1.6 * (cuerpo + click + blip)) / np.tanh(1.6)
        self.add(bus, s * np.minimum(1, t / 0.0008), t0, 0.5 * vel)
        if duck:
            self.golpes.append((t0, vel))

    def palmas2(self, t0, vel=0.8, pan=0.0, bus="perc"):
        n = int(0.45 * FS)
        t = np.arange(n) / FS
        r = self.ruido(n)
        cuerpo = filt(r, ("bp", 1250, 0.9), ("peak", 2700, 1.0, 4))
        e = np.zeros(n)
        for d, a in ((0.0, 1.0), (0.0085, 0.85), (0.017, 0.8), (0.026, 0.7)):
            i = int(d * FS)
            e[i:] += a * np.exp(-(t[: n - i]) / 0.0042)
        i = int(0.03 * FS)
        e[i:] += 0.75 * np.exp(-(t[: n - i]) / 0.11)
        caja = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.045) * 0.25
        s = cuerpo * e + caja
        for p, k in ((pan - 0.25, 0.9), (pan + 0.25, 1.0)):
            self.add(bus, s * k, t0 + (0.0006 if p > pan else 0), 0.16 * vel, pan=p)

    def charles2(self, t0, vel=0.5, abierto=False, pan=0.2, bus="perc"):
        n = int((0.38 if abierto else 0.09) * FS)
        t = np.arange(n) / FS
        met = sum(np.sign(np.sin(2 * np.pi * f * t + self.rng.uniform(0, 6.28))) for f in (317, 451, 587, 803, 912, 1123))
        s = filt(0.6 * met + self.ruido(n), ("hp", 7400), ("peak", 10500, 1.0, 4), ("lp", 15500))
        s *= np.exp(-t / (0.14 if abierto else 0.022)) * np.minimum(1, t / 0.0004)
        self.add(bus, s, t0, 0.024 * vel, pan=pan)

    def shaker2(self, t0, vel=0.4, pan=-0.3, bus="perc"):
        n = int(0.09 * FS)
        t = np.arange(n) / FS
        e = np.sin(np.pi * np.minimum(1, t / 0.07)) ** 2 * np.exp(-t / 0.05)
        s = filt(self.ruido(n), ("bp", 7200, 0.9), ("hp", 4500)) * e
        self.add(bus, s, t0, 0.07 * vel, pan=pan)

    def pandereta(self, t0, vel=0.5, pan=0.45, bus="perc"):
        n = int(0.25 * FS)
        t = np.arange(n) / FS
        s = filt(self.ruido(n), ("bp", 8800, 1.4), ("hp", 5500)) * (np.exp(-t / 0.05) + 0.3 * np.exp(-t / 0.15))
        s += 0.3 * sum(np.sin(2 * np.pi * f * t) for f in (5240, 6930, 8110)) * np.exp(-t / 0.07)
        self.add(bus, s * np.minimum(1, t / 0.0006), t0, 0.05 * vel, pan=pan)

    def platillo(self, t0, vel=0.7, dur=2.6, bus="perc"):
        n = int(dur * FS)
        t = np.arange(n) / FS
        for p in (-0.55, 0.55):
            r = self.ruido(n)
            s = filt(r, ("hp", 3200), ("peak", 7500, 0.8, 3), ("lp", 15000)) * np.exp(-t / (dur * 0.33))
            s += 0.4 * filt(r, ("bp", 1800, 1.0)) * np.exp(-t / 0.25)
            self.add(bus, s * np.minimum(1, t / 0.001), t0, 0.035 * vel, pan=p)

    def redoble(self, t0, dur, golpes=16, vel=0.8, bus="perc", leguero=False):
        """Redoble que crece (palmas/caja o bombo legüero) hacia un compás fuerte."""
        for k in range(golpes):
            u = k / max(1, golpes - 1)
            tt = t0 + dur * k / golpes
            if leguero:
                self.bombo_leguero(tt, vel=0.25 + 0.75 * u ** 1.4, bus="bombo")
            else:
                self.palmas2(tt, vel=(0.25 + 0.75 * u ** 1.5) * vel, pan=-0.3 + 0.6 * u)

    # ═════════ bajo, acordes, colchón, melodía ═════════
    def bajo_house(self, t0, m, dur, vel=0.85, bus="bajo", brillo=1.0):
        f = hz(m)
        n = int((dur + 0.05) * FS)
        t = np.arange(n) / FS
        ph = 2 * np.pi * f * t
        saw = sum(np.sin(k * ph) / k for k in range(1, 22) if k * f < 10000)
        corte = lambda u: u
        s = barrido(saw, 1700 * brillo, 230, q=1.1, kind="lp", curva=lambda u: 1 - np.exp(-u * (n / FS) / 0.09))
        sub = np.sin(ph)
        s = 0.55 * s + 0.9 * sub
        e = np.minimum(1, t / 0.004) * (0.75 + 0.25 * np.exp(-t / 0.12))
        ns = int(dur * FS)
        e[ns:] *= np.linspace(1, 0, n - ns) ** 2
        self.add(bus, np.tanh(1.3 * s * e) / np.tanh(1.3), t0, 0.24 * vel)

    def acorde_brillante(self, t0, notas, dur, vel=0.7, bus="pluck", corte=(5200, 900), dec=0.22):
        """Sierras desafinadas (super-sierra) con filtro que se cierra: el «stab» brillante."""
        n = int((dur + 0.3) * FS)
        t = np.arange(n) / FS
        lados = []
        for lado in range(2):
            s = np.zeros(n)
            for m in notas:
                for d in (-11, -4, 3, 9):
                    ff = hz(m) * 2 ** ((d + (lado - 0.5) * 6) / 1200)
                    s += 2 * ((ff * t + self.rng.uniform(0, 1)) % 1.0) - 1
            s /= 4 * len(notas)
            s = barrido(s, corte[0], corte[1], q=0.8, kind="lp", curva=lambda u: 1 - np.exp(-u * (n / FS) / dec))
            lados.append(filt(s, ("hp", 220)))
        e = np.minimum(1, t / 0.003) * np.exp(-t / (dec * 2.4))
        ns = int(dur * FS)
        e[ns:] *= np.exp(-(t[ns:] - dur) / 0.06)
        self.add(bus, np.vstack(lados) * e, t0, 0.32 * vel)

    def zampona(self, t0, dur, m, vel=0.8, de=None, bus="melodia", pan=0.0):
        """Flauta de caña: tono casi puro, mucho soplo, ataque con «chiff» y caída de afinación al entrar."""
        f0 = hz(m); rel = 0.12
        n = int((dur + rel) * FS)
        t = np.arange(n) / FS
        cents = ((hz(de) / f0 - 1) * 1731 * np.exp(-t / 0.04)) if de else -45 * np.exp(-t / 0.035)
        cents = cents + 14 * np.clip((t - 0.16) / 0.3, 0, 1) * np.sin(2 * np.pi * 5.0 * t + self.rng.uniform(0, 6.28))
        ph = fase(f0 * 2 ** ((cents + lfilter([0.002], [1, -0.998], self.ruido(n)) * 3) / 1200))
        tono = np.sin(ph) + 0.12 * np.sin(2 * ph + 0.3) + 0.05 * np.sin(3 * ph + 0.9)
        r = self.ruido(n)
        soplo = filt(r, ("bp", min(f0 * 1.02, 7000), 2.2)) * 0.9 + filt(r, ("bp", min(2 * f0, 9000), 2.0)) * 0.35 + filt(r, ("hp", 6000)) * 0.06
        env = np.ones(n)
        na = int(0.03 * FS)
        env[:na] = np.linspace(0, 1, na) ** 1.4
        nr = int(rel * FS)
        env[n - nr:] *= np.linspace(1, 0, nr) ** 2
        chiff = filt(r, ("bp", 2.6 * f0, 1.4)) * np.exp(-t / 0.02)
        s = (0.8 * tono + 0.32 * soplo) * env + 0.4 * chiff
        self.add(bus, s, t0, 0.17 * vel, pan=pan)

    def campanita(self, t0, m, vel=0.5, pan=0.0, dec=1.2, bus="campanas"):
        """Celesta / campanita FM (brillo de cosas que aparecen, el polvo dorado)."""
        f = hz(m)
        n = int((dec * 2.5) * FS)
        t = np.arange(n) / FS
        I = 2.2 * np.exp(-t / 0.12)
        s = np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * 4.0 * t)) * np.exp(-t / dec)
        s += 0.25 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / (dec * 0.4))
        self.add(bus, s * np.minimum(1, t / 0.0015), t0, 0.06 * vel, pan=pan)

    # ═════════ efectos ═════════
    def whoosh(self, t0, dur, f_de=300, f_a=4000, vel=0.6, pan_de=-0.8, pan_a=0.8, grave=0.5, forma=None):
        n = int(dur * FS)
        u = np.linspace(0, 1, n)
        env = (np.sin(np.pi * u) ** 1.6) if forma is None else forma(u)
        s = barrido(self.ruido(n), f_de, f_a, q=1.3) * env
        s2 = barrido(self.ruido(n), f_de * 0.4, f_a * 0.35, q=0.8, kind="lp") * env * grave
        a = (pan_de + (pan_a - pan_de) * u + 1) * np.pi / 4
        x = s + s2
        self.add("fx", np.vstack([np.cos(a) * x, np.sin(a) * x]), t0, 0.32 * vel)

    def riser(self, t0, dur, vel=0.6, nota=62):
        n = int(dur * FS)
        u = np.linspace(0, 1, n)
        ruido = barrido(self.ruido(n), 400, 9000, q=2.0, curva=lambda x: x ** 1.5) * u ** 2.2
        f = hz(nota) * 2 ** (2 * u ** 1.6)
        tono = np.sin(fase(f)) * u ** 2.5 * (0.6 + 0.4 * np.sin(2 * np.pi * (4 + 14 * u) * u * dur))
        for p in (-0.5, 0.5):
            self.add("fx", ruido, t0, 0.1 * vel, pan=p)
        self.add("fx", tono, t0, 0.05 * vel)

    def reverso(self, t0, dur=1.2, vel=0.6):
        """Platillo al revés que termina justo en t0 + dur."""
        n = int(dur * FS)
        t = np.arange(n) / FS
        s = filt(self.ruido(n), ("hp", 2500), ("peak", 8000, 0.8, 3)) * np.exp(-(dur - t) / (dur * 0.3))
        for p in (-0.6, 0.6):
            self.add("fx", s * np.minimum(1, (dur - t) / 0.004), t0, 0.06 * vel, pan=p)

    def impacto2(self, t0, vel=1.0, cola=0.7, sub=48):
        n = int(2.0 * FS)
        t = np.arange(n) / FS
        boom = np.sin(fase(sub + 60 * np.exp(-t / 0.06))) * np.exp(-t / cola)
        tom = np.sin(fase(95 + 80 * np.exp(-t / 0.03))) * np.exp(-t / 0.18) * 0.5
        self.add("fx", np.tanh(1.4 * (boom + tom)), t0, 0.28 * vel)
        for p in (-0.5, 0.5):
            crash = filt(self.ruido(n), ("hp", 2200), ("peak", 6500, 0.8, 3)) * np.exp(-t / 0.7) * np.minimum(1, t / 0.0015)
            self.add("fx", crash, t0, 0.028 * vel, pan=p)

    def portazo(self, t0, vel=1.0):
        """Puertas de madera que se cierran: golpe grave, madera y aire."""
        self.madera(t0, vel=vel, tono=0.62)
        n = int(1.2 * FS)
        t = np.arange(n) / FS
        golpe = np.sin(fase(62 + 70 * np.exp(-t / 0.025))) * np.exp(-t / 0.22)
        self.add("fx", golpe, t0, 0.32 * vel)
        aire = filt(self.ruido(n), ("lp", 1800), ("hp", 150)) * np.exp(-t / 0.18) * np.minimum(1, t / 0.003)
        for p in (-0.4, 0.4):
            self.add("fx", aire, t0 + 0.005, 0.07 * vel, pan=p)

    def estela(self, t0, dur, notas, n=24, vel=0.5, pan_de=0.7, pan_a=-0.6, semilla=1, bus="fx"):
        """Destellos afinados que viajan en el estéreo (el polvo dorado yendo de un lado al otro)."""
        r = np.random.default_rng(semilla)
        for k in range(n):
            u = k / max(1, n - 1)
            m = notas[int(r.integers(0, len(notas)))]
            pan = pan_de + (pan_a - pan_de) * u + r.uniform(-0.12, 0.12)
            if bus == "fx":
                f = hz(m)
                m2 = int(1.0 * FS)
                t = np.arange(m2) / FS
                s = np.sin(2 * np.pi * f * t + 1.6 * np.exp(-t / 0.08) * np.sin(2 * np.pi * f * 3.0 * t)) * np.exp(-t / r.uniform(0.25, 0.5))
                self.add("fx", s * np.minimum(1, t / 0.001), t0 + dur * u + r.uniform(-0.02, 0.02), 0.03 * vel * r.uniform(0.5, 1), pan=pan)
            else:
                self.campanita(t0 + dur * u, m, vel * r.uniform(0.5, 1), pan=pan, dec=0.6, bus=bus)

    # ═════════ mezcla ═════════
    def envolvente_duck(self, N, prof):
        """Ganancia del sidechain: cae `prof` en cada bombo y vuelve en ~0,2 s (curva suave)."""
        g = np.ones(N)
        L = int(0.32 * FS)
        tt = np.arange(L) / FS
        forma = 1 - (1 - np.exp(-np.maximum(tt - 0.002, 0) / 0.0015)) * np.exp(-np.maximum(tt - 0.01, 0) / 0.085)
        forma = 1 - (1 - forma)      # 1 → valle → 1
        for t0, v in self.golpes:
            if any(a <= t0 < b for a, b in self.sin_duck):
                continue
            i = int(t0 * FS)
            seg = 1 - prof * min(1.0, v) * (1 - forma)
            j = min(N, i + L)
            if j > i:
                g[i:j] = np.minimum(g[i:j], seg[: j - i])
        return g

    def eco_pingpong(self, x, tiempo, fb=0.42, n=6):
        d = int(tiempo * FS)
        y = np.zeros_like(x)
        m = x.mean(axis=0)
        cola = m.copy()
        for k in range(1, n + 1):
            cola = filt(cola, ("lp", 6500 - 600 * k), ("hp", 300))
            ch = k % 2
            if k * d < x.shape[1]:
                y[ch, k * d:] += (fb ** k) * cola[: x.shape[1] - k * d]
        return y

    def mezclar(self, incluir, ir=None, humedad=0.3):
        if getattr(self, "_ir", None) is None:
            self._ir = self.ir_sala(rt60=2.1, largo=3.2, pre=0.022)
            self._ir2 = self.ir_sala(rt60=0.6, largo=1.0, pre=0.006)
        N = self.N
        seco = np.zeros((2, N)); envio = np.zeros((2, N)); envio2 = np.zeros((2, N)); ecos = np.zeros((2, N))
        cache = {}
        for b in incluir:
            if b not in self.bus:
                continue
            x = self.nivel.get(b, 1.0) * self.bus[b]
            p = self.duck.get(b, 0)
            if p > 0 and self.golpes:
                k = (b, p)
                if k not in cache:
                    cache[k] = self.envolvente_duck(N, p)
                x = x * cache[k]
            k_s = self.ancho.get(b, 1.0)
            if k_s != 1.0:              # medio/lado: abre el estéreo del bus
                mid, lado = (x[0] + x[1]) / 2, (x[0] - x[1]) / 2 * k_s
                x = np.vstack([mid + lado, mid - lado])
            seco += x
            if b in ("bombo", "perc"):
                envio2 += self.envio.get(b, 0.1) * x
            else:
                envio += self.envio.get(b, 0.2) * x
            if b in self.eco:
                ecos += self.eco[b] * self.eco_pingpong(x, 0.75 * self.pulso)
        hum = np.vstack([fftconvolve(envio[0], self._ir[0])[:N], fftconvolve(envio[1], self._ir[1])[:N]])
        hum2 = np.vstack([fftconvolve(envio2[0], self._ir2[0])[:N], fftconvolve(envio2[1], self._ir2[1])[:N]])
        m = filt(seco + humedad * hum + 0.22 * hum2 + ecos, ("hp", 30), ("hp", 30))
        nd = int(self.dur * FS)
        p = m[:, :nd].copy()
        cola = m[:, nd:]
        p[:, : cola.shape[1]] += cola
        return p

    @staticmethod
    def masterizar(p, ref, g, techo_db=-1.9):
        n = p.shape[1]
        x = np.tile(p / ref * 0.7, 2)
        x = filt(x, ("ls", 90, 0.7, 1.8), ("hs", 4200, 0.7, 1.2), ("hs", 10000, 0.7, 1.2))
        x = compresor_rapido(x, umbral_db=-17, ratio=2.0, ataque=0.02, suelta=0.2)
        x = x * g
        x = 0.72 * x + 0.28 * np.tanh(1.3 * x) / np.tanh(1.3)
        return limitador_rapido(x, techo_db=techo_db)[:, n:]

    def exportar(self, carpeta="audio", objetivo=-16.0, pico_efectos=-1.6, buses_musica=None, verbose=True):
        import os
        self.ecualizar()
        todos = buses_musica or list(self.bus)
        completa = self.mezclar(todos)
        ref = np.max(np.abs(completa))
        g = 1.0
        for _ in range(7):
            prueba = self.masterizar(completa, ref, g)
            L = lufs(prueba)
            if abs(L - objetivo) < 0.12:
                break
            g *= 10 ** ((objetivo - L) / 20)
        escribir_wav(os.path.join(carpeta, "pista.wav"), prueba)
        salida = {"pista.wav": (lufs(prueba), pico_real(prueba))}
        if "fx" in self.bus:
            ef = self.masterizar(self.mezclar(["fx"]), ref, g)
            # efectos solos: más presentes (−20 LUFS) con el limitador cuidando el pico real
            for _ in range(4):
                ef = limitador_rapido(ef * 10 ** ((-20.0 - lufs(ef)) / 20), techo_db=-2.0)
            escribir_wav(os.path.join(carpeta, "efectos.wav"), ef)
            salida["efectos.wav"] = (lufs(ef), pico_real(ef))
        if verbose:
            for k, (L, P) in salida.items():
                print(f"{k:<12} LUFS {L:6.2f} · pico real {P:6.2f} dBTP")
        return salida
