"""Música y efectos del video de La Casa del Retablo (168 s, 120 BPM, La menor: huayno y carnaval).

Forma (compases desde 1; frases de seis compases, una por cada dos tableros):
  82–84 + 1–3  cierre y apertura (una sola frase que cruza el bucle): colchón en La menor, arpa en
               arpegio, el retablo sube (madera), ¡las puertas! (2, pulso 3) con golpe, campanas y flores;
               riser hacia la entrada al nicho. En el cierre, la salida, el portazo (83) y el logo.
  4–9          A · historia y tamaños: quena sola sobre el colchón y el arpa; entra el pulso en el 8.
  10–51        huayno con todo: bombo legüero, chajchas, rasgueo de charango, bajo; temas de zampoña.
  52–57        respiro (las obras grandes): sin batería, arpa, quena lenta y campanas; golpes de legüero.
  58–81        vuelve el huayno: más liviano (kalimba y campanitas en la decoración), cierra cálido.

    python3 audio.py            → audio/pista.wav (−16 LUFS) y audio/efectos.wav
"""
import json
import os
import numpy as np

import cues as Q
from estudio2 import Estudio2
from audiolib import CHARANGO

b, PUL, COMP = Q.b, Q.PUL, Q.COMP
AP, CI = Q.APERTURA, Q.CIERRE
C_FIN = Q.C_FIN                      # 82
DUR = Q.DUR
e = Estudio2(dur=DUR, bpm=Q.BPM, semilla=4242, cola=5.0)
e.sin_duck = [[0, b(4) - 0.01], [b(52) - 0.01, b(58) - 0.01], [b(C_FIN), DUR + 5]]

# ───────────────────────── armonía ─────────────────────────
CH = dict(CHARANGO)
CH["Dm"] = [69, 69, 74, 74, 77, 65, 69, 69, 77, 77]
CH["Em"] = [67, 67, 71, 71, 76, 64, 71, 71, 76, 76]
AC = {
    "Am": {"b": 33, "pad": [57, 60, 64, 69], "arpa": [45, 52, 57, 60, 64, 69, 72, 76]},
    "C": {"b": 36, "pad": [55, 60, 64, 67], "arpa": [48, 55, 60, 64, 67, 72, 76, 79]},
    "G": {"b": 31, "pad": [55, 59, 62, 67], "arpa": [43, 50, 55, 59, 62, 67, 71, 74]},
    "F": {"b": 29, "pad": [57, 60, 65, 69], "arpa": [41, 48, 53, 57, 60, 65, 69, 72]},
    "E7": {"b": 28, "pad": [56, 59, 62, 64], "arpa": [40, 47, 52, 56, 59, 62, 64, 68]},
    "Dm": {"b": 38, "pad": [57, 62, 65, 69], "arpa": [38, 45, 50, 53, 57, 62, 65, 69]},
    "Em": {"b": 40, "pad": [55, 59, 64, 67], "arpa": [40, 47, 52, 55, 59, 64, 67, 71]},
}
H1 = ["Am", "C", "G", "Am", [(0, "F"), (2, "G")], "Am"]
H2 = ["C", "G", "Am", "Em", "F", [(0, "F"), (2, "E7")]]
H3 = ["F", "C", "G", "Am", "Dm", [(0, "F"), (2, "E7")]]
FRASES = [(4, "intro", H1), (10, "A", H1), (16, "B", H2), (22, "A", H1), (28, "B", H2), (34, "C", H1), (40, "B", H2),
          (46, "C", H3), (52, "R", H3), (58, "A", H1), (64, "L", H2), (70, "L", H1), (76, "C", H1)]
COMPASES = {1: "Am", 2: [(0, "F"), (2, "E7")], 3: "Am", C_FIN: "Am", C_FIN + 1: "F", C_FIN + 2: "Am"}
SECCION = {}
for c0, sec, prog in FRASES:
    for k, ac in enumerate(prog):
        COMPASES[c0 + k] = ac
        SECCION[c0 + k] = sec


def acordes_de(c):
    v = COMPASES[c]
    return v if isinstance(v, list) else [(0, v)]


def acorde_en(c, pulso):
    act = acordes_de(c)[0][1]
    for p, a in acordes_de(c):
        if pulso >= p:
            act = a
    return act


# ───────────────────────── temas (La menor pentatónica) ─────────────────────────
# (pulso desde el inicio de la frase, nota MIDI, duración en pulsos); frases de 24 pulsos
TEMA_A = [(0, 76, .5), (.5, 79, .5), (1, 81, 1), (2, 79, .5), (2.5, 76, .5), (3, 74, 1),
          (4, 76, .5), (4.5, 79, .5), (5, 76, .5), (5.5, 74, .5), (6, 72, 1), (7, 74, 1),
          (8, 74, .5), (8.5, 76, .5), (9, 79, 1), (10, 76, .5), (10.5, 74, .5), (11, 74, 1),
          (12, 72, .5), (12.5, 74, .5), (13, 76, .5), (13.5, 74, .5), (14, 72, .5), (14.5, 69, .5), (15, 69, 1),
          (16, 69, .5), (16.5, 72, .5), (17, 74, 1), (18, 74, .5), (18.5, 76, .5), (19, 79, 1),
          (20, 76, 1.5), (21.5, 74, .5), (22, 72, .5), (22.5, 74, .5), (23, 69, 1)]
TEMA_A2 = TEMA_A[:12] + [(8, 79, .5), (8.5, 81, .5), (9, 84, 1), (10, 81, .5), (10.5, 79, .5), (11, 76, 1),
                         (12, 79, .5), (12.5, 76, .5), (13, 74, .5), (13.5, 76, .5), (14, 72, 1), (15, 69, 1),
                         (16, 72, .5), (16.5, 74, .5), (17, 76, 1), (18, 79, .5), (18.5, 81, .5), (19, 84, 1),
                         (20, 81, 1.5), (21.5, 79, .5), (22, 76, 1), (23, 81, 1)]
TEMA_B = [(0, 81, 1.5), (1.5, 79, .5), (2, 76, 1), (3, 79, 1),
          (4, 81, 1), (5, 84, 1), (6, 81, 1), (7, 79, 1),
          (8, 79, 1.5), (9.5, 76, .5), (10, 74, 1), (11, 76, 1),
          (12, 76, 2), (14, 74, 1), (15, 72, 1),
          (16, 74, 1), (17, 76, 1), (18, 79, 1), (19, 81, 1),
          (20, 81, 3), (23, 79, .5), (23.5, 76, .5)]
LENTO = [(0, 76, 3), (3, 74, 1), (4, 72, 2), (6, 74, 2), (8, 79, 3), (11, 76, 1), (12, 76, 4),
         (16, 74, 2), (18, 72, 2), (20, 71, 2), (22, 69, 2)]


def tocar_tema(t0, notas, vel=0.85, oct=0, pan=0.08, inst="zampona"):
    prev = None
    for p, m, d in notas:
        de = prev if prev is not None and abs(prev - m) <= 3 else None
        mm = m + 12 * oct
        if inst == "quena":
            e.quena(t0 + p * PUL, d * PUL * 0.96, mm, vel=vel, vibrato=1.0 if d >= 1 else 0.4, pan=pan)
        elif inst == "kalimba":
            e.kalimba(t0 + p * PUL, mm, vel=vel * 0.8, pan=pan)
        elif inst == "campanita":
            e.campanita(t0 + p * PUL, mm, vel=vel * 0.6, pan=pan, dec=1.3)
        else:
            e.zampona(t0 + p * PUL, d * PUL * 0.96, mm, vel=vel * (1.0 if d >= 1 else 0.9), de=de, pan=pan)
        prev = m


# ═════════════════════ MÚSICA ═════════════════════
def colchon_compas(c, vel=0.42, corte=1500):
    for p, a in acordes_de(c):
        largo = (4 - p) if len(acordes_de(c)) == 1 else 2
        e.colchon(b(c, p), largo * PUL + 0.05, AC[a]["pad"], vel=vel, ataque=0.3, suelta=0.7, corte=corte)


def arpa(c, vel=0.42, figura=(0, 2, 3, 4, 5, 4, 3, 2), paso=0.5, oct=0):
    """Arpa andina: cuerda pulsada larga, grave y brillante a la vez."""
    for k, i in enumerate(figura):
        p = k * paso
        a = acorde_en(c, p)
        m = AC[a]["arpa"][i % len(AC[a]["arpa"])] + 12 * oct
        s = e.cuerda(440.0 * 2 ** ((m - 69) / 12), 2.6, vel * (1.0 if k % 4 == 0 else 0.78), t60=2.6, brillo=0.45)
        e.add("cuerdas", s, b(c, p), 0.13, pan=-0.25 + 0.5 * (i / 7))


def huayno(c, sec):
    t = lambda p: b(c, p)
    lleno = sec in ("C",)
    liviano = sec in ("L",)
    # bombo legüero: ¡pum! . pa ¡pum! . pa
    for p, v in ((0, 0.95), (1.5, 0.45), (2, 0.85), (3.5, 0.45)):
        e.bombo_leguero(t(p), vel=v * (0.85 if liviano else 1.0))
    e.bombo2(t(0), vel=0.55 if not liviano else 0.4)
    e.bombo2(t(2), vel=0.45 if not liviano else 0.3)
    # chajchas (maracas de pezuña): corcheas con acento a contratiempo
    for k in range(8):
        e.maraca(t(k * 0.5 + 0.01), vel=0.5 if k % 2 else 0.3, largo=0.07, pan=-0.4)
    if lleno:
        for k in range(16):
            e.shaker2(t(k * 0.25 + 0.01), vel=0.35 if k % 2 else 0.2, pan=0.35)
        for p in (1, 3):
            e.palmas2(t(p), vel=0.75)
    if not liviano:
        for k in range(8):
            e.pandereta(t(k * 0.5 + 0.25), vel=0.28 if not lleno else 0.38, pan=0.5)
    # rasgueo de charango: abajo fuerte en el pulso, arriba suave en la corchea
    for k in range(8):
        p = k * 0.5
        a = acorde_en(c, p)
        ch = CH.get(a, CH["Am"])
        e.rasgueo(ch, t(p), vel=(0.62 if k % 2 == 0 else 0.36) * (0.8 if liviano else 1.0), abajo=(k % 2 == 0), dur=0.42, lapso=0.015)
    # bajo: fundamental en 1, quinta en 3 (y paseo en corcheas en lo lleno)
    for p, a in acordes_de(c):
        r = AC[a]["b"]
        tramo = [x for x in (0, 1, 2, 3) if len(acordes_de(c)) == 1 or p <= x < p + 2]
        for x in tramo:
            nota = r if x in (0, 2) and (x == 0 or len(acordes_de(c)) > 1) else r + 7
            e.bajo_redondo(t(x), nota, PUL * 0.9, vel=0.85 if x % 2 == 0 else 0.6)
            if lleno:
                e.bajo_redondo(t(x + 0.5), nota + (12 if x % 2 else 0), PUL * 0.4, vel=0.45)
    colchon_compas(c, vel=0.26 if not liviano else 0.32, corte=1700)


# ── 1–3: apertura (el logo, el retablo que sube, las puertas, la entrada) ──
colchon_compas(1, vel=0.5, corte=1300)
colchon_compas(2, vel=0.46, corte=1500)
colchon_compas(3, vel=0.38, corte=1900)
e.bajo_redondo(b(1), 33, COMP - 0.05, vel=0.4)
e.bajo_redondo(b(2), 29, 2 * PUL, vel=0.42)
e.bajo_redondo(b(2, 2), 28, 2 * PUL, vel=0.45)
arpa(1, vel=0.45, figura=(0, 2, 4, 5, 6, 5, 4, 2))
arpa(2, vel=0.42, figura=(0, 2, 4, 5, 6, 7, 6, 5))
# las puertas se abren (compás 2, pulso 3)
t_abre = AP["abre"]
e.rasgueo(CH["E7"], t_abre, vel=0.95, dur=1.4)
e.rasgueo(CH["Am"], t_abre + PUL * 1.0, vel=0.7, dur=1.6)
e.bombo_leguero(t_abre, vel=0.9)
e.redoble(b(3, 2), 2 * PUL, golpes=16, leguero=True, vel=0.7)
for m, p in ((76, -0.4), (81, 0), (84, 0.4), (88, 0.2)):
    e.campanita(t_abre + 0.04, m, vel=0.55, pan=p, dec=1.6)
arpa(3, vel=0.4, figura=(4, 5, 6, 7, 6, 7, 6, 7), paso=0.5, oct=0)

# ── 4–9: intro (historia y tamaños): quena sola, arpa; el pulso entra en el 8 ──
for c in range(4, 10):
    colchon_compas(c, vel=0.42, corte=1500)
    arpa(c, vel=0.38)
    a = acorde_en(c, 0)
    e.bajo_redondo(b(c), AC[a]["b"], COMP * 0.9, vel=0.38)
    if c >= 8:
        huayno(c, "L")
tocar_tema(b(4), TEMA_A, vel=0.82, inst="quena", pan=0.12)

# ── huayno ──
for c in range(10, 52):
    huayno(c, SECCION[c])
for c in range(58, C_FIN):
    huayno(c, SECCION[c])

# ── 52–57: respiro (las obras grandes) ──
for c in range(52, 58):
    colchon_compas(c, vel=0.5, corte=1300)
    arpa(c, vel=0.46, figura=(0, 2, 3, 4, 5, 6, 5, 4, 3, 4, 5, 6, 7, 6, 5, 4), paso=0.25)
    a = acorde_en(c, 0)
    e.bajo_redondo(b(c), AC[a]["b"], COMP * 0.95, vel=0.45)
    e.bombo_leguero(b(c), vel=0.7)
tocar_tema(b(52), LENTO, vel=0.8, inst="quena", pan=0.1)
for k, (p, m, d) in enumerate(TEMA_B[:12]):
    e.campanita(b(55) + p * PUL, m + 12, vel=0.3, pan=0.3 * (1 if k % 2 else -1), dec=1.4)

# temas
tocar_tema(b(10), TEMA_A, vel=0.85)
tocar_tema(b(16), TEMA_B, vel=0.82, pan=0.12)
tocar_tema(b(22), TEMA_A2, vel=0.88)
tocar_tema(b(28), TEMA_B, vel=0.84, pan=0.12)
for c0, tema in ((34, TEMA_A2), (46, TEMA_A2)):
    tocar_tema(b(c0), tema, vel=0.92)
    tocar_tema(b(c0), tema, vel=0.34, oct=-1, pan=-0.2)
tocar_tema(b(40), TEMA_B, vel=0.88, pan=0.1)
tocar_tema(b(58), TEMA_A, vel=0.85)
tocar_tema(b(64), TEMA_B, vel=0.8, inst="kalimba", pan=-0.15)
tocar_tema(b(64), TEMA_B, vel=0.5, pan=0.15)
tocar_tema(b(70), TEMA_A2, vel=0.75, inst="campanita", pan=0.2)
tocar_tema(b(70), TEMA_A2, vel=0.7)
tocar_tema(b(76), TEMA_A, vel=0.9)
tocar_tema(b(76), TEMA_A, vel=0.34, oct=-1, pan=-0.2)

# platillos y redobles entre frases
for c in (10, 16, 22, 28, 34, 40, 46, 58, 64, 70, 76):
    e.platillo(b(c), vel=0.7 if c in (10, 34, 58, 76) else 0.45)
for c in (15, 21, 27, 33, 39, 45, 63, 69, 75):
    e.redoble(b(c, 3), PUL, golpes=8, vel=0.6, leguero=c % 2 == 1)
e.redoble(b(51, 2), 2 * PUL, golpes=16, vel=0.7, leguero=True)
e.reverso(b(52) - 0.9, 0.9, vel=0.45)
e.riser(b(56), 2 * COMP, vel=0.45, nota=64)
e.redoble(b(57, 2), 2 * PUL, golpes=16, vel=0.8)

# ── 82–84: cierre ──
colchon_compas(C_FIN, vel=0.45, corte=1600)
arpa(C_FIN, vel=0.42, figura=(7, 6, 5, 4, 5, 4, 3, 2))
e.bajo_redondo(b(C_FIN), 33, COMP - 0.05, vel=0.4)
colchon_compas(C_FIN + 1, vel=0.48, corte=1400)
e.bajo_redondo(b(C_FIN + 1), 29, COMP - 0.05, vel=0.42)
e.rasgueo(CH["F"], b(C_FIN + 1), vel=0.7, dur=1.6)
colchon_compas(C_FIN + 2, vel=0.5, corte=1300)
e.bajo_redondo(b(C_FIN + 2), 33, COMP - 0.05, vel=0.4)
arpa(C_FIN + 2, vel=0.4, figura=(0, 2, 4, 5, 6, 5, 4, 2))

# ═════════════════════ EFECTOS ═════════════════════
PENTA = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93]
# apertura
e.estela(0.45, 0.8, PENTA[4:][::-1], n=18, vel=0.45, pan_de=-0.4, pan_a=0.4, semilla=3)
e.whoosh(0.85, 1.5, 180, 1400, vel=0.5, pan_de=0, pan_a=0, grave=0.9, forma=lambda u: np.sin(np.pi * u) ** 1.5)
e.madera(2.28, vel=0.6, tono=0.7)
e.madera(2.33, vel=0.35, tono=0.9)
e.whoosh(t_abre - 0.15, 0.6, 600, 3200, vel=0.4, pan_de=-0.6, pan_a=0.6, grave=0.4)
e.impacto2(t_abre + 0.02, vel=0.75, cola=0.9)
e.madera(t_abre + 0.95, vel=0.5, tono=0.75, pan=-0.5)
e.madera(t_abre + 1.0, vel=0.45, tono=0.8, pan=0.5)
e.papel(t_abre + 0.1, 0.9, n=30, vel=0.45, semilla=21)
e.chispas(t_abre + 0.1, 0.8, n=12, vel=0.4, semilla=22)
e.brillo(t_abre + 0.05, vel=0.6)
e.riser(4.2, 1.7, vel=0.5, nota=64)
e.whoosh(5.1, 0.95, 300, 6500, vel=0.75, pan_de=0, pan_a=0, grave=0.7, forma=lambda u: u ** 2.4 * np.minimum(1, (1 - u) * 14))
e.impacto2(b(4) + 0.01, vel=0.55, cola=0.6)
# cierre
s0 = b(C_FIN)
e.whoosh(s0 + 0.1, 1.6, 5500, 300, vel=0.6, pan_de=0.15, pan_a=-0.15, grave=0.7, forma=lambda u: np.minimum(1, u * 8) * (1 - u) ** 1.3)
e.reverso(s0 + 1.75 - 0.55, 0.55, vel=0.4)
e.portazo(s0 + 2.35, vel=1.0)
e.impacto2(s0 + 2.35, vel=0.55, cola=0.8)
e.whoosh(s0 + 3.0, 1.2, 1400, 180, vel=0.45, pan_de=0, pan_a=0, grave=0.9)
e.estela(s0 + 4.2, 0.9, PENTA[3:], n=22, vel=0.55, pan_de=-0.5, pan_a=0.6, semilla=8)
e.brillo(s0 + 5.0, vel=0.7)
for m, p in ((76, -0.3), (81, 0.0), (84, 0.3), (88, 0.1)):
    e.campanita(s0 + 5.05, m, vel=0.4, pan=p, dec=1.6, bus="fx")

# eventos de los tableros (de las mismas definiciones que la imagen)
eventos = json.load(open("eventos.json")) if os.path.exists("eventos.json") else []
NOTAS_POP = [72, 74, 76, 79, 81, 84]
for k, ev in enumerate(eventos):
    t, tipo, pan = ev["t"], ev["tipo"], ev.get("pan", 0)
    if tipo == "puertas":
        e.whoosh(t, 0.55, 250, 1800, vel=0.3, pan_de=pan, pan_a=pan, grave=0.7)
    elif tipo == "abre":
        e.madera(t + 0.05, vel=0.42, tono=0.8, pan=pan - 0.2)
        e.madera(t + 0.11, vel=0.36, tono=0.86, pan=pan + 0.2)
        e.siseo(t, 0.5, vel=0.12, pan=pan)
        e.campanita(t + 0.5, 88, vel=0.28, pan=pan, bus="fx")
    elif tipo == "gira":
        e.whoosh(t, 0.8, 400, 3600, vel=0.38, pan_de=-pan, pan_a=pan, grave=0.4)
    elif tipo == "voltea":
        e.whoosh(t, 0.7, 500, 4200, vel=0.4, pan_de=pan, pan_a=pan, grave=0.3, forma=lambda u: np.sin(np.pi * u) ** 2)
        e.madera(t + 0.62, vel=0.3, tono=0.9, pan=pan)
    elif tipo == "cae":
        e.whoosh(t, 0.42, 3200, 600, vel=0.25, pan_de=pan, pan_a=pan, grave=0.3)
        e.madera(t + 0.36, vel=0.55, tono=0.7, pan=pan)
    elif tipo == "sube":
        e.whoosh(t, 0.6, 400, 2600, vel=0.3, pan_de=pan, pan_a=pan, grave=0.4)
    elif tipo == "desliza":
        e.whoosh(t, 0.7, 800, 3400, vel=0.35, pan_de=-0.9 * np.sign(pan or 1), pan_a=pan, grave=0.3)
    elif tipo == "acerca":
        e.whoosh(t, 0.9, 200, 2400, vel=0.4, pan_de=0, pan_a=pan, grave=0.8)
    elif tipo == "pop":
        e.pop(t + 0.05, NOTAS_POP[k % len(NOTAS_POP)], vel=0.45, pan=pan)
    elif tipo.startswith("etiqueta"):
        if tipo == "etiqueta-cuelga":
            e.whoosh(t, 0.5, 2600, 900, vel=0.18, pan_de=pan, pan_a=pan, grave=0.2)
        e.pop(t + 0.12, 84, vel=0.35, pan=pan)
        e.campanita(t + 0.2, 88, vel=0.42, pan=pan, bus="fx")
        e.campanita(t + 0.25, 93, vel=0.3, pan=pan, bus="fx")
    elif tipo == "destello":
        e.destello(t, 93 + (k % 2) * 2, vel=0.25, pan=pan)
    elif tipo == "titulo":
        e.whoosh(t - 0.05, 0.5, 2500, 7000, vel=0.08, pan_de=pan - 0.2, pan_a=pan + 0.2, grave=0.0)
    elif tipo == "nota":
        e.pop(t, ev.get("m", 79), vel=0.4, pan=pan)
        e.campanita(t + 0.04, ev.get("m", 79) + 12, vel=0.3, pan=pan, bus="fx")
    elif tipo == "tic":
        e.tic(t, vel=0.35, tono=ev.get("tono", 1.0), pan=pan)
    elif tipo == "campana":
        e.campanita(t, ev.get("m", 88), vel=ev.get("vel", 0.35), pan=pan, bus="fx")
    elif tipo == "cristal":
        e.brillo(t, vel=0.35)
        e.campanita(t + 0.05, ev.get("m", 91), vel=0.3, pan=pan, bus="fx")
    elif tipo == "ceramica":
        e.tic(t, vel=0.5, tono=1.4, pan=pan)
        e.madera(t + 0.01, vel=0.25, tono=1.3, pan=pan)

# transiciones
T0 = Q.T0
for j, T in enumerate(Q.TRANS):
    if not T:
        continue
    tb = T0[j]
    tipo = T["tipo"]
    antes, despues = Q.VENTANA[tipo]
    if tipo == "latigo":
        d = T["dir"]
        e.whoosh(tb - antes, antes + despues, 500, 7500, vel=0.8, pan_de=-0.95 * d, pan_a=0.95 * d, grave=0.4, forma=lambda u: np.sin(np.pi * u) ** 3)
        e.impacto2(tb + 0.02, vel=0.3, cola=0.3, sub=60)
    elif tipo == "tablas":
        n = {"v8": 8, "v12": 12, "h6": 6, "v10": 10, "v16": 16, "h8": 8}[T["juego"]]
        dur = 0.62
        paso = (1 - dur) / max(1, n - 1)
        for i in range(n):
            orden = i if T["desde"] == "izq" else (n - 1 - i if T["desde"] == "der" else abs(i - (n - 1) / 2) * 2)
            u_golpe = orden * paso * (0.5 if T["desde"] == "centro" else 1) + dur * 0.93
            tg = tb - antes + antes * u_golpe
            pan = (-0.85 + 1.7 * i / (n - 1)) if T["juego"][0] == "v" else (-0.2 + 0.4 * (i % 2))
            e.madera(tg, vel=0.4 if n <= 10 else 0.3, tono=1.0 + 0.05 * (i % 3), pan=pan)
        e.whoosh(tb - antes, antes + 0.1, 400, 3000, vel=0.35, pan_de=-0.6, pan_a=0.6, grave=0.3)
    elif tipo == "empuje":
        d = T["dir"]
        e.whoosh(tb - antes, antes + despues, 300, 5200, vel=0.7, pan_de=0.85 * d, pan_a=-0.85 * d, grave=0.6, forma=lambda u: np.sin(np.pi * u) ** 2)
        e.madera(tb + despues * 0.5, vel=0.2, tono=0.85)
    elif tipo == "abrir":
        e.madera(tb - antes + 0.02, vel=0.5, tono=0.7, pan=-0.6)
        e.madera(tb - antes + 0.05, vel=0.45, tono=0.75, pan=0.6)
        e.whoosh(tb - antes, antes + despues, 900, 300, vel=0.5, pan_de=0, pan_a=0, grave=0.8, forma=lambda u: np.sin(np.pi * u) ** 1.5)
        e.siseo(tb - antes + 0.1, 0.6, vel=0.18, pan=0)
        e.campanita(tb + 0.15, 84, vel=0.3, pan=-0.2, bus="fx")
    elif tipo == "casa":
        t_ap = tb - antes
        e.campanita(t_ap + 0.12, 81, vel=0.5, pan=-0.1, dec=1.5, bus="fx")
        e.campanita(t_ap + 0.18, 86, vel=0.42, pan=0.1, dec=1.5, bus="fx")
        e.chispas(t_ap + 0.1, 0.5, n=8, vel=0.35, ancho=0.4, semilla=31 + j)
        e.riser(t_ap + 0.4, antes - 0.35, vel=0.4, nota=64)
        e.whoosh(tb - 0.45, 0.6, 250, 6000, vel=0.7, pan_de=0, pan_a=0, grave=0.7, forma=lambda u: u ** 2.2 * np.minimum(1, (1 - u) * 12))
        e.impacto2(tb + despues * 0.4, vel=0.45, cola=0.5)
    elif tipo == "flores":
        d = T.get("dir", 1)
        e.papel(tb - antes, antes + despues, n=40, vel=0.45, semilla=50 + j)
        e.whoosh(tb - antes, antes + despues, 600, 5000, vel=0.45, pan_de=0.8 * d, pan_a=-0.8 * d, grave=0.3)
        e.estela(tb - antes + 0.1, antes + despues - 0.2, PENTA[4:], n=14, vel=0.4, pan_de=0.7 * d, pan_a=-0.7 * d, semilla=60 + j)
    elif tipo == "zoom":
        e.riser(tb - antes, antes, vel=0.45, nota=66)
        e.whoosh(tb - 0.4, 0.5, 300, 7000, vel=0.7, pan_de=0, pan_a=0, grave=0.6, forma=lambda u: u ** 2.6 * np.minimum(1, (1 - u) * 14))
        e.impacto2(tb + 0.02, vel=0.5, cola=0.6)

# ═════════════════════ mezcla ═════════════════════
e.nivel.update({"bombo": 0.55, "perc": 1.9, "bajo": 1.2, "armonia": 1.2, "cuerdas": 3.2, "melodia": 0.9,
                "colchon": 1.0, "campanas": 1.2, "kalimba": 1.3, "pluck": 1.3, "fx": 1.15})
e.eq.update({"melodia": [("hp", 250), ("peak", 2400, 0.9, 1.5)], "cuerdas": [("hp", 90), ("peak", 2800, 0.9, 2.0), ("hs", 7500, 0.7, -2)],
             "colchon": [("hp", 120), ("lp", 6000)]})
if os.environ.get("DIAG"):
    tramos = [(0, b(4)), (b(4), b(10)), (b(10), b(52)), (b(52), b(58)), (b(58), b(C_FIN)), (b(C_FIN), DUR)]
    e.ecualizar()
    e.diag(tramos)
os.makedirs("audio", exist_ok=True)
e.exportar("audio", objetivo=-16.0, pico_efectos=-1.6)
