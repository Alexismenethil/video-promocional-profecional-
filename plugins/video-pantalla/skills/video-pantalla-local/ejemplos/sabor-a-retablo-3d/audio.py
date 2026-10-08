"""Música y efectos de «El retablo de los sabores» (60 s, 128 BPM, Re mayor).

Forma (compases desde 1):
  1–4    Firma y apertura: colchón Sol maj9 / Mi m9, charango en arpegio, la estela de campanitas del
         polvo dorado (va de la firma al retablo), golpes de madera en la ranura, ¡las puertas! (4) en
         La7sus4 con impacto y aleteo de hojas, redoble de bombo legüero y riser hacia la caída.
  5–12   A · crepes: house cálido. I–V/3–vi–IV (Re · La/Do# · Si m7 · Sol maj7). Tema de zampoña.
         Charango en contratiempo, piano eléctrico sincopado, bajo en corcheas a contratiempo.
  13–20  B · café, postres, chapla: Mi m7 · La7sus4–La7 · Fa# m7 · Si m7 · Sol maj7 · La · Si m7 · La/Do#.
         Melodía larga de zampoña, charango punteado en contracanto, bombo legüero en los acentos.
  21–28  C · fríos y helados: vuelve el tema con todo (acordes brillantes, pandereta, platillos).
  29–32  Cierre: se van los tambores, portazo en Re (30), Sol maj9 con la estela de campanitas que arma
         el logo y el brillo. El compás 32 empalma con el 1 (mismo acorde y misma textura).

    python3 audio.py            → audio/pista.wav (−16 LUFS) y audio/efectos.wav
    DIAG=1 python3 audio.py     → además, el nivel de cada bus por tramo
"""
import os
import numpy as np

import cues as Q
from estudio2 import Estudio2
from audiolib import CHARANGO

b, PUL = Q.b, Q.PUL
R = Q.RETABLO
e = Estudio2(dur=Q.DUR, bpm=Q.BPM, semilla=2027, cola=5.0)
e.sin_duck = [[0, b(5) - 0.01], [b(29), Q.DUR + 5]]

# ───────────────────────── armonía ─────────────────────────
# piano (voz media), bajo (raíz), charango (10 cuerdas), colchón
AC = {
    "D":    {"p": [66, 69, 74, 76], "b": 38, "ch": CHARANGO["D"], "pad": [62, 66, 69, 76]},
    "A/C#": {"p": [64, 69, 73, 76], "b": 37, "ch": CHARANGO["A"], "pad": [61, 64, 69, 76]},
    "Bm7":  {"p": [66, 69, 71, 74], "b": 35, "ch": [66, 66, 71, 71, 74, 62, 71, 71, 78, 78], "pad": [59, 62, 66, 69]},
    "Gmaj7": {"p": [66, 67, 71, 74], "b": 31, "ch": [66, 66, 71, 71, 74, 62, 67, 67, 79, 79], "pad": [55, 62, 66, 71]},
    "Gmaj9": {"p": [66, 69, 71, 74], "b": 31, "ch": [66, 66, 71, 71, 74, 62, 69, 69, 79, 79], "pad": [55, 62, 66, 69, 71]},
    "Em7":  {"p": [64, 67, 71, 74], "b": 40, "ch": [67, 67, 71, 71, 76, 64, 71, 71, 76, 76], "pad": [52, 59, 62, 67]},
    "Em9":  {"p": [66, 67, 71, 74], "b": 40, "ch": [66, 66, 71, 71, 76, 64, 67, 67, 78, 78], "pad": [52, 59, 62, 66, 67]},
    "A7sus4": {"p": [64, 69, 74, 79], "b": 33, "ch": [67, 67, 74, 74, 76, 64, 69, 69, 76, 76], "pad": [57, 62, 64, 67]},
    "A7":   {"p": [64, 67, 69, 73], "b": 33, "ch": [67, 67, 73, 73, 76, 64, 69, 69, 76, 76], "pad": [57, 61, 64, 67]},
    "A":    {"p": [64, 69, 73, 76], "b": 33, "ch": CHARANGO["A"], "pad": [57, 61, 64, 69]},
    "F#m7": {"p": [64, 66, 69, 73], "b": 42, "ch": [66, 66, 69, 69, 73, 61, 69, 69, 76, 76], "pad": [54, 61, 64, 69]},
}
# Un acorde por compás (los compases con dos acordes: lista de (pulso, acorde))
COMPASES = {1: "Gmaj9", 2: "Gmaj9", 3: "Em9", 4: "A7sus4"}
A_PROG = ["D", "A/C#", "Bm7", "Gmaj7"]
for k in range(8):
    COMPASES[5 + k] = A_PROG[k % 4]
    COMPASES[21 + k] = A_PROG[k % 4]
B_PROG = ["Em7", [(0, "A7sus4"), (2, "A7")], "F#m7", "Bm7", "Gmaj7", "A", "Bm7", "A/C#"]
for k, c in enumerate(B_PROG):
    COMPASES[13 + k] = c
COMPASES.update({29: "Gmaj7", 30: "D", 31: "Gmaj9", 32: "Gmaj9"})


def acordes_de(c):
    v = COMPASES[c]
    return v if isinstance(v, list) else [(0, v)]


def acorde_en(c, pulso):
    act = acordes_de(c)[0][1]
    for p, a in acordes_de(c):
        if pulso >= p:
            act = a
    return AC[act]


# ───────────────────────── tema (zampoña) ─────────────────────────
# (pulso desde el inicio de la frase, nota MIDI, duración en pulsos)
TEMA_A = [(0, 78, .5), (.5, 81, .5), (1, 83, 1), (2, 81, .5), (2.5, 78, .5), (3, 76, .5), (3.5, 78, .5),
          (4, 76, 1.5), (5.5, 74, .5), (6, 76, .5), (6.5, 78, .5), (7, 81, 1),
          (8, 83, .5), (8.5, 81, .5), (9, 78, 1), (10, 76, .5), (10.5, 78, .5), (11, 74, 1),
          (12, 71, 1), (13, 74, .5), (13.5, 76, .5), (14, 78, 1.5), (15.5, 76, .5)]
TEMA_A2 = TEMA_A[:12] + [(8, 83, .5), (8.5, 86, .5), (9, 83, 1), (10, 81, .5), (10.5, 78, .5), (11, 81, 1),
                         (12, 78, 1), (13, 76, .5), (13.5, 74, .5), (14, 76, 2)]
TEMA_B = [(0, 79, 1.5), (1.5, 78, .5), (2, 76, 2), (4, 74, 1), (5, 76, 1), (6, 73, 2),
          (8, 76, 1.5), (9.5, 78, .5), (10, 81, 2), (12, 83, 1), (13, 81, .5), (13.5, 78, .5), (14, 78, 2),
          (16, 79, 1.5), (17.5, 81, .5), (18, 83, 2), (20, 81, 1), (21, 76, 1), (22, 81, 1), (23, 85, 1),
          (24, 86, 1.5), (25.5, 83, .5), (26, 81, 2), (28, 78, 1), (29, 76, 1), (30, 73, 2)]


def tocar_tema(t0, notas, vel=0.85, oct=0, pan=0.08, eco=True):
    prev = None
    for p, m, d in notas:
        de = prev if prev is not None and abs(prev - m) <= 3 else None
        e.zampona(t0 + p * PUL, d * PUL * 0.96, m + 12 * oct, vel=vel * (1.0 if d >= 1 else 0.9), de=de, pan=pan)
        prev = m


# ═════════════════════ MÚSICA ═════════════════════
def colchon_compas(c, vel=0.45, corte=1500):
    for p, a in acordes_de(c):
        largo = (4 - p) if len(acordes_de(c)) == 1 else (2 if p == 0 else 2)
        e.colchon(b(c, p), largo * PUL + 0.05, AC[a]["pad"], vel=vel, ataque=0.25, suelta=0.6, corte=corte)


# ── 1–4: firma y apertura ──
for c in (1, 2, 3, 4):
    colchon_compas(c, vel=0.5 if c < 4 else 0.38, corte=1200 + 250 * c)
e.bajo_redondo(b(1), 31, 2 * Q.COMP - 0.05, vel=0.35)
e.bajo_redondo(b(3), 40, Q.COMP - 0.05, vel=0.4)
# charango en arpegio lento (la caja que despierta)
for c, notas in ((1, [67, 71, 74, 78, 81, 78, 74, 71]), (2, [67, 71, 74, 78, 81, 83, 81, 78]),
                 (3, [64, 67, 71, 74, 78, 79, 78, 74])):
    for k, m in enumerate(notas):
        s = e.cuerda(440.0 * 2 ** ((m - 69) / 12), 1.8, 0.5 * (0.8 + 0.2 * (k % 2)), t60=1.8, brillo=0.5)
        e.add("cuerdas", s, b(c, k * 0.5), 0.12, pan=-0.35 + 0.1 * (k % 4))
# trémolo de charango que sube en el compás 3 (la ranura se enciende)
for k in range(16):
    u = k / 15
    m = [74, 78][k % 2]
    s = e.cuerda(440.0 * 2 ** ((m - 69) / 12), 0.6, 0.18 + 0.32 * u, t60=0.8, brillo=0.6)
    e.add("cuerdas", s, b(3, 2 + k * 0.125), 0.1, pan=0.25)
# bombo legüero de latido (compases 2–3) y el redoble hacia la caída
for c in (2, 3):
    for p in (0, 2):
        e.bombo_leguero(b(c, p), vel=0.22 if c == 2 else 0.3)
e.rasgueo(AC["A7sus4"]["ch"], R["abre"], vel=0.95, dur=1.6)
e.rasgueo(AC["A7sus4"]["ch"], R["abre"] + PUL * 1.5, vel=0.55, abajo=False, dur=0.9)
e.redoble(b(4, 2), 2 * PUL, golpes=16, leguero=True)
e.redoble(b(4, 3), PUL, golpes=8, vel=0.7)
for m, p in ((76, -0.4), (81, 0), (85, 0.4), (88, 0.2)):
    e.campanita(R["abre"] + 0.02, m, vel=0.6, pan=p, dec=1.6)

# ── groove (A, B, C) ──
def groove(c, seccion):
    """Batería, bajo, piano, charango y colchón del compás c."""
    t = lambda p: b(c, p)
    lleno = seccion == "C"
    # bombo a negras
    for p in range(4):
        e.bombo2(t(p), vel=(1.0 if p == 0 else 0.92) * (0.88 if seccion == "B" else 1.0))
    # palmas en 2 y 4
    for p in (1, 3):
        e.palmas2(t(p), vel=0.9 if lleno else (0.62 if seccion == "B" else 0.78))
    # charles: cerrado a contratiempo; abierto en B y C
    for p in (0.5, 1.5, 2.5, 3.5):
        e.charles2(t(p), vel=0.75, abierto=(seccion != "A"), pan=0.25)
    for p in (0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75):
        e.charles2(t(p), vel=0.28, pan=0.3)
    # shaker en semicorcheas con acento
    for k in range(16):
        if seccion == "B" and k % 2 == 1:
            continue
        e.shaker2(t(k * 0.25 + 0.01 * (k % 2)), vel=(0.55 if k % 2 else 0.3) * (1.1 if lleno else 1.0), pan=-0.35)
    if seccion != "A":
        for k in range(8):
            e.pandereta(t(k * 0.5 + 0.25), vel=0.5 if lleno else 0.35, pan=0.5)
    if seccion in ("B", "C") and c % 2 == 1:
        e.bombo_leguero(t(0), vel=0.55)
        e.bombo_leguero(t(3.5), vel=0.4)
    # bajo
    for p, a in acordes_de(c):
        r = AC[a]["b"]
        pulsos = [x for x in (0.5, 1.5, 2.5, 3.5) if (len(acordes_de(c)) == 1 or (p <= x < p + 2))]
        for x in pulsos:
            if seccion == "B":
                e.bajo_house(t(x - 0.5), r, 0.42 * PUL, vel=0.55)
            nota = r + (12 if (x == 3.5 and c % 2 == 0) else 0)
            e.bajo_house(t(x), nota, 0.42 * PUL, vel=0.9)
    # piano eléctrico sincopado
    golpes_p = [0, 1.5, 2.5] if seccion != "B" else [0, 2]
    for p in golpes_p:
        ac = acorde_en(c, p)
        e.acorde_piano(t(p), ac["p"], 0.5 * PUL if seccion != "B" else 1.6 * PUL, vel=0.55 if seccion != "B" else 0.45)
    # charango en contratiempo (A y C), punteado en B
    if seccion != "B":
        for k, p in enumerate((0.5, 1.5, 2.5, 3.5)):
            ac = acorde_en(c, p)
            e.rasgueo(ac["ch"], t(p), vel=0.42 if k % 2 == 0 else 0.34, abajo=(k % 2 == 0), dur=0.35, lapso=0.016)
    # colchón
    colchon_compas(c, vel=0.32 if seccion == "A" else 0.4, corte=1600)
    # acordes brillantes (C)
    if lleno:
        for p in (0.5, 1.5, 2.5, 3.5):
            ac = acorde_en(c, p)
            e.acorde_brillante(t(p), ac["p"], 0.3 * PUL, vel=0.42)


for c in range(5, 13):
    groove(c, "A")
for c in range(13, 21):
    groove(c, "B")
for c in range(21, 29):
    groove(c, "C")

# charango punteado en B (contracanto en corcheas desde las notas del acorde)
for c in range(13, 21):
    for k in range(8):
        ac = acorde_en(c, k * 0.5)
        notas = sorted(set(ac["ch"]))
        m = notas[[0, 2, 1, 3, 2, 4, 3, 2][k] % len(notas)] + (12 if notas[0] < 66 else 0)
        s = e.cuerda(440.0 * 2 ** ((m - 69) / 12), 0.7, 0.4 if k % 2 == 0 else 0.3, t60=1.2, brillo=0.62)
        e.add("cuerdas", s, b(c, k * 0.5), 0.12, pan=-0.3)

# tema
tocar_tema(b(5), TEMA_A, vel=0.85)
tocar_tema(b(9), TEMA_A2, vel=0.88)
tocar_tema(b(13), TEMA_B, vel=0.8, pan=0.12)
tocar_tema(b(21), TEMA_A, vel=0.92)
tocar_tema(b(21), TEMA_A, vel=0.38, oct=-1, pan=-0.2, eco=False)
tocar_tema(b(25), TEMA_A2, vel=0.95)
tocar_tema(b(25), TEMA_A2, vel=0.38, oct=-1, pan=-0.2, eco=False)

# platillos y rellenos de sección
for c in (5, 9, 13, 17, 21, 25):
    e.platillo(b(c), vel=0.75 if c in (5, 13, 21) else 0.5)
e.redoble(b(12, 3), PUL, golpes=8, vel=0.7)
e.redoble(b(20, 2), 2 * PUL, golpes=16, vel=0.8)
e.reverso(b(21) - 1.2, 1.2, vel=0.7)
e.reverso(b(13) - 1.0, 1.0, vel=0.5)
e.riser(b(20), Q.COMP, vel=0.5, nota=62)
e.riser(b(12, 2), 2 * PUL, vel=0.35, nota=64)

# ── 29–32: cierre ──
colchon_compas(29, vel=0.5, corte=1100)
e.bajo_redondo(b(29), 31, Q.COMP - 0.05, vel=0.4)
e.rasgueo(AC["Gmaj7"]["ch"], b(29), vel=0.6, dur=1.8)
for c in (30, 31, 32):
    colchon_compas(c, vel=0.5, corte=1300)
e.bajo_redondo(b(30), 38, Q.COMP * 0.9, vel=0.45)
e.bajo_redondo(b(31), 31, 2 * Q.COMP - 0.05, vel=0.35)
e.rasgueo(AC["D"]["ch"], R["cierra"], vel=0.95, dur=1.8)
for c, notas in ((31, [67, 71, 74, 78, 81, 83, 81, 78]), (32, [67, 71, 74, 78, 81, 78, 74, 71])):
    for k, m in enumerate(notas):
        s = e.cuerda(440.0 * 2 ** ((m - 69) / 12), 1.8, 0.48 * (0.8 + 0.2 * (k % 2)), t60=1.8, brillo=0.5)
        e.add("cuerdas", s, b(c, k * 0.5), 0.12, pan=-0.35 + 0.1 * (k % 4))

# ═════════════════════ EFECTOS (bus fx: es lo que sale en efectos.wav) ═════════════════════
PENTA = [74, 76, 78, 81, 83, 86, 88, 90, 93, 95]
# apertura
e.estela(R["disuelve"][0], R["disuelve"][1] - R["disuelve"][0], PENTA[3:], n=34, vel=0.75, pan_de=0.65, pan_a=-0.45, semilla=3)
e.whoosh(R["alCentro"][0], R["alCentro"][1] - R["alCentro"][0], 180, 1200, vel=0.35, pan_de=-0.6, pan_a=0.0, grave=0.8)
e.riser(R["ranura"][0], R["ranura"][1] - R["ranura"][0], vel=0.32, nota=57)
for g in R["golpes"]:
    e.madera(g, vel=0.55, tono=1.25, pan=0.0)
    e.tic(g + 0.035, vel=0.4, tono=1.4)
e.impacto2(R["abre"], vel=1.0, cola=0.8)
e.whoosh(R["abre"] - 0.02, 0.9, 900, 6500, vel=0.6, pan_de=0, pan_a=0, grave=0.6, forma=lambda u: np.exp(-u * 4) * np.minimum(1, u * 30))
e.papel(R["abre"] + 0.02, 1.3, n=70, vel=0.9, semilla=41)
e.chispas(R["abre"] + 0.05, 0.8, n=14, vel=0.6, ancho=0.9, semilla=5)
z0, z1 = R["zambullida"]
e.whoosh(z0 - 0.1, z1 - z0 + 0.25, 200, 5200, vel=0.9, pan_de=-0.2, pan_a=0.2, grave=0.9, forma=lambda u: u ** 1.8 * np.minimum(1, (1 - u) * 14))
e.reverso(z1 - 1.0, 1.0, vel=0.8)
e.riser(z0, z1 - z0, vel=0.55, nota=62)
e.impacto2(z1, vel=0.85, cola=0.6)

# tarjetas: entradas de producto, textos, sello de precio, brillo
T0 = Q.T0
ENTRADA = {0: (-1.55, 0.14), 4: (-0.05, 0.14)}   # (tEntrada, escalon) especiales; resto (-0.05, 0.14 o 0.16 o 0.12)
ESCALON = {1: 0.16, 2: 0.16, 3: 0.12, 5: 0.16, 6: 0.16, 7: 0.16, 8: 0.12, 9: 0.12, 10: 0.16, 11: 0.16}
NPROD = [1, 2, 2, 3, 1, 2, 2, 2, 3, 3, 2, 2]
for k, t0 in enumerate(T0):
    te, esc = ENTRADA.get(k, (-0.05, ESCALON.get(k, 0.14)))
    ac = acorde_en(5 + 2 * k, 0)
    for i in range(NPROD[k]):
        ti = t0 + te + i * esc + 0.12
        if k == 0:
            ti = t0 - 1.55 + 0.1
        m = sorted(ac["p"])[min(i + 1, 3)] + 12
        e.pop(ti, m, vel=0.75, pan=(-0.4 + 0.8 * i / max(1, NPROD[k] - 1)) if NPROD[k] > 1 else 0.25)
    e.whoosh(t0 + 0.12, 0.55, 2500, 7000, vel=0.12, pan_de=-0.3, pan_a=0.3, grave=0.0)
    if k in (0, 4):
        e.whoosh(t0 + 0.8, 0.45, 600, 3200, vel=0.25, pan_de=0.2, pan_a=-0.2, grave=0.2)
        e.campanita(t0 + 1.08, 86, vel=0.7, pan=-0.2 if k == 0 else 0.2, bus="fx")
        e.campanita(t0 + 1.12, 90, vel=0.5, pan=-0.2 if k == 0 else 0.2, bus="fx")
    e.chispas(t0 + 1.3, 0.6, n=5, vel=0.35, ancho=0.6, semilla=10 + k)

# transiciones
for j, T in enumerate(Q.TRANS):
    if not T:
        continue
    tb = T0[j]
    tipo = T["tipo"]
    if tipo in ("paneo", "grua"):
        d = T["dir"]
        if tipo == "paneo":
            e.whoosh(tb - 0.52, 0.95, 260, 4200, vel=0.75, pan_de=-0.85 * d, pan_a=0.85 * d, grave=0.7)
        else:
            e.whoosh(tb - 0.52, 0.95, 220 if d > 0 else 3600, 3600 if d > 0 else 220, vel=0.7, pan_de=0, pan_a=0, grave=0.8)
        e.madera(tb - 0.04, vel=0.35, tono=0.8)
    elif tipo == "latigo":
        d = T["dir"]
        e.whoosh(tb - 0.3, 0.62, 500, 7500, vel=0.85, pan_de=-0.95 * d, pan_a=0.95 * d, grave=0.4,
                 forma=lambda u: np.sin(np.pi * u) ** 3)
        e.impacto2(tb + 0.02, vel=0.35, cola=0.3, sub=60)
    elif tipo == "tablas":
        n = {"v8": 8, "v12": 12, "h6": 6, "v10": 10}[T["juego"]]
        dur, antes = 0.62, Q.VENTANA["tablas"][0]
        paso = (1 - dur) / max(1, n - 1)
        for i in range(n):
            orden = i if T["desde"] == "izq" else (n - 1 - i if T["desde"] == "der" else abs(i - (n - 1) / 2) * 2)
            u_golpe = orden * paso * (0.5 if T["desde"] == "centro" else 1) + dur * 0.93
            tg = tb - antes + antes * u_golpe
            pan = (-0.85 + 1.7 * i / (n - 1)) if T["juego"] != "h6" else (-0.2 + 0.4 * (i % 2))
            e.madera(tg, vel=0.42, tono=1.0 + 0.05 * (i % 3), pan=pan)
        e.whoosh(tb - antes, antes + 0.1, 400, 3000, vel=0.35, pan_de=-0.6, pan_a=0.6, grave=0.3)
    elif tipo == "hojas":
        e.papel(tb - 0.5, 1.0, n=120, vel=1.0, semilla=91)
        e.whoosh(tb - 0.55, 1.1, 300, 6000, vel=0.75, pan_de=-0.8, pan_a=0.8, grave=0.6)
        e.impacto2(tb, vel=0.6, cola=0.5)
    elif tipo == "puertas":
        e.whoosh(tb - 0.46, 0.44, 500, 2500, vel=0.5, pan_de=0, pan_a=0, grave=0.7, forma=lambda u: u ** 2)
        e.portazo(tb - 0.04, vel=0.95)
        e.whoosh(tb + 0.12, 0.6, 2500, 600, vel=0.45, pan_de=0, pan_a=0, grave=0.5)
        e.chispas(tb + 0.15, 0.5, n=8, vel=0.5, semilla=77)

# cierre
s0, s1 = R["sale"]
e.whoosh(s0, s1 - s0 + 0.2, 5000, 250, vel=0.7, pan_de=0.2, pan_a=-0.2, grave=0.8, forma=lambda u: np.minimum(1, u * 10) * (1 - u) ** 1.2)
e.reverso(R["cierra"] - 0.62, 0.62, vel=0.5)
e.portazo(R["cierra"], vel=1.1)
e.impacto2(R["cierra"], vel=0.7, cola=0.9)
e.papel(R["cierra"] + 0.03, 0.6, n=24, vel=0.5, semilla=13)
e.estela(R["arma"][0], R["arma"][1] - R["arma"][0], PENTA[2:], n=40, vel=0.75, pan_de=-0.5, pan_a=0.6, semilla=8)
e.brillo(R["brillo"][0], vel=1.0)
for m, p in ((74, -0.3), (78, 0.0), (81, 0.3), (86, 0.1)):
    e.campanita(R["brillo"][0] + 0.15, m, vel=0.5, pan=p, dec=1.8, bus="fx")

# ═════════════════════ mezcla ═════════════════════
e.nivel.update({"bombo": 0.5, "perc": 2.0, "bajo": 1.18, "armonia": 1.35, "cuerdas": 3.3, "melodia": 0.86,
                "colchon": 1.0, "campanas": 1.2, "pluck": 1.45, "fx": 1.15})
e.eq.update({"melodia": [("hp", 250), ("peak", 2400, 0.9, 1.5)], "cuerdas": [("hp", 180), ("peak", 2800, 0.9, 2.5), ("hs", 7500, 0.7, -2)],
             "pluck": [("hp", 260), ("hs", 8000, 0.7, -3)], "colchon": [("hp", 120), ("lp", 6000)]})
if os.environ.get("DIAG"):
    tramos = [(0, b(5)), (b(5), b(13)), (b(13), b(21)), (b(21), b(29)), (b(29), Q.DUR)]
    e.ecualizar()
    e.diag(tramos)
os.makedirs("audio", exist_ok=True)
e.exportar("audio", objetivo=-16.0, pico_efectos=-1.6)
