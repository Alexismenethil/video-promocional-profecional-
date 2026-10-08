"""Música y efectos de la versión final del menu board (135 s, 128 BPM, Re mayor).

Forma (compases desde 1; frases de seis compases, una por cada dos tableros):
  1–3    Firma y apertura: colchón Sol maj9 · Mi m9, charango en arpegio, la estela de campanitas del
         polvo dorado, golpes de madera en la ranura, ¡las puertas! (3) en La7sus4 con impacto y aleteo
         de hojas, redoble de bombo legüero y riser hacia la caída.
  4–15   A · crepes salados y de autor: house cálido. Re · La/Do# · Si m7 · Sol maj7 · Mi m9 · La7sus4–La7.
         Tema de zampoña en dos vueltas (la segunda sube).
  16–33  B · crepes dulces y la promo: más liviano. Sol maj7 · Fa# m7 · Mi m7 · Si m7 · Sol maj7 · La.
         Charango punteado en contracanto y tema largo de zampoña; los dos últimos compases suben hacia
         las puertas.
  34–51  C · bien fríos y helados: las puertas del retablo y la caída con todo (acordes brillantes,
         pandereta, el tema doblado a la octava; la tercera vuelta con el tema B).
  52–57  D · respiro (affogato y café): sin bombo, piano, celesta y charango; vuelve el pulso y sube.
  58–69  A' y C' · café, postres y chapla: el tema otra vez y el final con todo.
  70–72  Cierre: se van los tambores, portazo en Re (71), Sol maj9 con la estela que arma el logo y el
         brillo. El compás 72 empalma con el 1 (mismo acorde y misma textura).

    python3 audio.py            → audio/pista.wav (−16 LUFS) y audio/efectos.wav
    DIAG=1 python3 audio.py     → además, el nivel de cada bus por tramo

Los efectos de los tableros (entradas de producto, ventanas, sellos, destellos) salen de eventos.json,
que escribe `node render.mjs eventos` desde las mismas definiciones que la imagen.
"""
import json
import os
import numpy as np

import cues as Q
from estudio2 import Estudio2
from audiolib import CHARANGO

b, PUL = Q.b, Q.PUL
R = Q.RETABLO
C_FIN = Q.C_FIN                    # 58
e = Estudio2(dur=Q.DUR, bpm=Q.BPM, semilla=2031, cola=5.0)
e.sin_duck = [[0, b(4) - 0.01], [b(52) - 0.01, b(56) - 0.01], [b(C_FIN), Q.DUR + 5]]

# ───────────────────────── armonía ─────────────────────────
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
A6 = ["D", "A/C#", "Bm7", "Gmaj7", "Em9", [(0, "A7sus4"), (2, "A7")]]
B6 = ["Gmaj7", "F#m7", "Em7", "Bm7", "Gmaj7", "A"]
D6 = ["Bm7", "Gmaj7", "D", "A/C#", "Bm7", [(0, "A7sus4"), (2, "A7")]]
FRASES = [(4, "A", A6), (10, "A2", A6), (16, "B", B6), (22, "B2", B6), (28, "B3", B6), (34, "C", A6), (40, "C2", A6),
          (46, "C3", B6), (52, "D", D6), (58, "A3", A6), (64, "C4", A6)]
COMPASES = {1: "Gmaj9", 2: "Em9", 3: "A7sus4", C_FIN: "Gmaj7", C_FIN + 1: "D", C_FIN + 2: "Gmaj9"}
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
    return AC[act]


# ───────────────────────── temas (zampoña) ─────────────────────────
# (pulso desde el inicio de la frase, nota MIDI, duración en pulsos); frases de 24 pulsos
TEMA_A = [(0, 78, .5), (.5, 81, .5), (1, 83, 1), (2, 81, .5), (2.5, 78, .5), (3, 76, .5), (3.5, 78, .5),
          (4, 76, 1.5), (5.5, 74, .5), (6, 76, .5), (6.5, 78, .5), (7, 81, 1),
          (8, 83, .5), (8.5, 81, .5), (9, 78, 1), (10, 76, .5), (10.5, 78, .5), (11, 74, 1),
          (12, 71, 1), (13, 74, .5), (13.5, 76, .5), (14, 78, 1.5), (15.5, 76, .5),
          (16, 79, 1), (17, 78, .5), (17.5, 76, .5), (18, 74, 1), (19, 76, 1),
          (20, 76, 1.5), (21.5, 74, .5), (22, 73, 1.5), (23.5, 76, .5)]
TEMA_A2 = TEMA_A[:12] + [(8, 83, .5), (8.5, 86, .5), (9, 83, 1), (10, 81, .5), (10.5, 78, .5), (11, 81, 1),
                         (12, 78, 1), (13, 76, .5), (13.5, 74, .5), (14, 76, 2),
                         (16, 83, 1), (17, 81, .5), (17.5, 79, .5), (18, 78, 1), (19, 79, 1),
                         (20, 81, 1.5), (21.5, 79, .5), (22, 76, 1), (23, 73, 1)]
TEMA_B = [(0, 83, 1.5), (1.5, 81, .5), (2, 79, 1), (3, 78, 1),
          (4, 76, 1.5), (5.5, 78, .5), (6, 81, 2),
          (8, 79, 1.5), (9.5, 78, .5), (10, 76, 1), (11, 74, 1),
          (12, 78, 2), (14, 81, 1), (15, 83, 1),
          (16, 86, 1.5), (17.5, 83, .5), (18, 81, 1), (19, 79, 1),
          (20, 81, 1), (21, 76, 1), (22, 73, 1), (23, 76, 1)]
TEMA_B2 = TEMA_B[:14] + [(16, 86, 1), (17, 88, .5), (17.5, 86, .5), (18, 83, 1), (19, 81, 1),
                         (20, 81, 1), (21, 83, 1), (22, 85, 2)]


def tocar_tema(t0, notas, vel=0.85, oct=0, pan=0.08):
    prev = None
    for p, m, d in notas:
        de = prev if prev is not None and abs(prev - m) <= 3 else None
        e.zampona(t0 + p * PUL, d * PUL * 0.96, m + 12 * oct, vel=vel * (1.0 if d >= 1 else 0.9), de=de, pan=pan)
        prev = m


# ═════════════════════ MÚSICA ═════════════════════
def colchon_compas(c, vel=0.45, corte=1500):
    for p, a in acordes_de(c):
        largo = (4 - p) if len(acordes_de(c)) == 1 else 2
        e.colchon(b(c, p), largo * PUL + 0.05, AC[a]["pad"], vel=vel, ataque=0.25, suelta=0.6, corte=corte)


def arpegio_charango(c, notas, vel=0.5):
    for k, m in enumerate(notas):
        s = e.cuerda(440.0 * 2 ** ((m - 69) / 12), 1.8, vel * (0.8 + 0.2 * (k % 2)), t60=1.8, brillo=0.5)
        e.add("cuerdas", s, b(c, k * 0.5), 0.12, pan=-0.35 + 0.1 * (k % 4))


# ── 1–3: firma y apertura ──
for c in (1, 2, 3):
    colchon_compas(c, vel=0.5 if c < 3 else 0.38, corte=1300 + 250 * c)
e.bajo_redondo(b(1), 31, Q.COMP - 0.05, vel=0.35)
e.bajo_redondo(b(2), 40, Q.COMP - 0.05, vel=0.4)
arpegio_charango(1, [67, 71, 74, 78, 81, 78, 74, 71])
arpegio_charango(2, [64, 67, 71, 74, 78, 79, 78, 74])
# trémolo de charango que sube (la ranura se enciende)
for k in range(16):
    u = k / 15
    m = [74, 78][k % 2]
    s = e.cuerda(440.0 * 2 ** ((m - 69) / 12), 0.6, 0.18 + 0.32 * u, t60=0.8, brillo=0.6)
    e.add("cuerdas", s, b(2, 2 + k * 0.125), 0.1, pan=0.25)
for p in (0, 2):
    e.bombo_leguero(b(2, p), vel=0.26)
e.rasgueo(AC["A7sus4"]["ch"], R["abre"], vel=0.95, dur=1.6)
e.rasgueo(AC["A7sus4"]["ch"], R["abre"] + PUL * 1.5, vel=0.55, abajo=False, dur=0.9)
e.redoble(b(3, 2), 2 * PUL, golpes=16, leguero=True)
e.redoble(b(3, 3), PUL, golpes=8, vel=0.7)
for m, p in ((76, -0.4), (81, 0), (85, 0.4), (88, 0.2)):
    e.campanita(R["abre"] + 0.02, m, vel=0.6, pan=p, dec=1.6)


# ── groove ──
def groove(c, sec):
    t = lambda p: b(c, p)
    lleno = sec in ("C", "C2", "C3", "C4")
    liviano = sec in ("B", "B2", "B3")
    respiro = sec == "D"
    if respiro and c < 56:
        # sin bombo: piano, charango, colchón y bajo largo
        for p, a in acordes_de(c):
            e.bajo_redondo(t(p), AC[a]["b"], (4 - p if len(acordes_de(c)) == 1 else 2) * PUL - 0.04, vel=0.42)
            e.acorde_piano(t(p), AC[a]["p"], 1.8 * PUL, vel=0.42)
            e.acorde_piano(t(p + 1.5), AC[a]["p"], 0.5 * PUL, vel=0.3)
        for k in range(8):
            e.shaker2(t(k * 0.5 + 0.01), vel=0.28, pan=-0.35)
        colchon_compas(c, vel=0.46, corte=1300)
        return
    for p in range(4):
        e.bombo2(t(p), vel=(1.0 if p == 0 else 0.92) * (0.88 if liviano else 1.0) * (0.8 if respiro else 1.0))
    for p in (1, 3):
        e.palmas2(t(p), vel=0.9 if lleno else (0.62 if liviano else 0.78))
    for p in (0.5, 1.5, 2.5, 3.5):
        e.charles2(t(p), vel=0.75, abierto=(sec not in ("A", "D")), pan=0.25)
    for p in (0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75):
        e.charles2(t(p), vel=0.28, pan=0.3)
    for k in range(16):
        if liviano and k % 2 == 1:
            continue
        e.shaker2(t(k * 0.25 + 0.01 * (k % 2)), vel=(0.55 if k % 2 else 0.3) * (1.1 if lleno else 1.0), pan=-0.35)
    if sec not in ("A", "D"):
        for k in range(8):
            e.pandereta(t(k * 0.5 + 0.25), vel=0.5 if lleno else 0.35, pan=0.5)
    if (liviano or lleno) and c % 2 == 0:
        e.bombo_leguero(t(0), vel=0.55)
        e.bombo_leguero(t(3.5), vel=0.4)
    # bajo
    for p, a in acordes_de(c):
        r = AC[a]["b"]
        pulsos = [x for x in (0.5, 1.5, 2.5, 3.5) if (len(acordes_de(c)) == 1 or (p <= x < p + 2))]
        for x in pulsos:
            if liviano:
                e.bajo_house(t(x - 0.5), r, 0.42 * PUL, vel=0.55)
            nota = r + (12 if (x == 3.5 and c % 2 == 1) else 0)
            e.bajo_house(t(x), nota, 0.42 * PUL, vel=0.9)
    # piano eléctrico sincopado
    golpes_p = [0, 1.5, 2.5] if not liviano else [0, 2]
    for p in golpes_p:
        ac = acorde_en(c, p)
        e.acorde_piano(t(p), ac["p"], 0.5 * PUL if not liviano else 1.6 * PUL, vel=0.55 if not liviano else 0.45)
    # charango en contratiempo (no en B)
    if not liviano:
        for k, p in enumerate((0.5, 1.5, 2.5, 3.5)):
            ac = acorde_en(c, p)
            e.rasgueo(ac["ch"], t(p), vel=0.42 if k % 2 == 0 else 0.34, abajo=(k % 2 == 0), dur=0.35, lapso=0.016)
    colchon_compas(c, vel=0.32 if sec in ("A", "A3") else 0.4, corte=1600)
    if lleno:
        for p in (0.5, 1.5, 2.5, 3.5):
            ac = acorde_en(c, p)
            e.acorde_brillante(t(p), ac["p"], 0.3 * PUL, vel=0.42)


for c in range(4, C_FIN):
    groove(c, SECCION[c])

# charango punteado en B (contracanto en corcheas desde las notas del acorde)
for c in range(16, 34):
    for k in range(8):
        ac = acorde_en(c, k * 0.5)
        notas = sorted(set(ac["ch"]))
        m = notas[[0, 2, 1, 3, 2, 4, 3, 2][k] % len(notas)] + (12 if notas[0] < 66 else 0)
        s = e.cuerda(440.0 * 2 ** ((m - 69) / 12), 0.7, 0.4 if k % 2 == 0 else 0.3, t60=1.2, brillo=0.62)
        e.add("cuerdas", s, b(c, k * 0.5), 0.12, pan=-0.3)
# respiro (52–57): celesta con el tema B en la octava de arriba y charango en arpegio
for k, (p, m, d) in enumerate(TEMA_B[:14]):
    e.campanita(b(52) + p * PUL, m + 12, vel=0.42, pan=0.25 * (1 if k % 2 else -1), dec=1.4)
for c in range(52, 58):
    ac = acorde_en(c, 0)
    notas = sorted(set(ac["ch"]))
    arpegio_charango(c, [notas[i % len(notas)] + (12 if i >= 4 else 0) for i in (0, 2, 3, 4, 5, 4, 3, 2)], vel=0.42)

# temas
tocar_tema(b(4), TEMA_A, vel=0.85)
tocar_tema(b(10), TEMA_A2, vel=0.88)
tocar_tema(b(16), TEMA_B, vel=0.8, pan=0.12)
tocar_tema(b(22), TEMA_B2, vel=0.84, pan=0.12)
tocar_tema(b(28), TEMA_B, vel=0.82, pan=0.12)
for c0, tema in ((34, TEMA_A), (40, TEMA_A2), (64, TEMA_A2)):
    tocar_tema(b(c0), tema, vel=0.93)
    tocar_tema(b(c0), tema, vel=0.36, oct=-1, pan=-0.2)
tocar_tema(b(46), TEMA_B2, vel=0.9, pan=0.1)
tocar_tema(b(46), TEMA_B2, vel=0.34, oct=-1, pan=-0.2)
tocar_tema(b(58), TEMA_A, vel=0.88)

# platillos, rellenos y subidas entre secciones
for c in (4, 10, 16, 22, 28, 34, 40, 46, 58, 64):
    e.platillo(b(c), vel=0.75 if c in (4, 16, 34, 58) else 0.5)
e.redoble(b(9, 3), PUL, golpes=8, vel=0.6)
e.redoble(b(15, 3), PUL, golpes=8, vel=0.7)
e.reverso(b(16) - 1.0, 1.0, vel=0.5)
e.redoble(b(27, 3), PUL, golpes=8, vel=0.6)
e.redoble(b(32, 2), 6 * PUL, golpes=40, vel=0.8)          # hacia las puertas
e.riser(b(32), 2 * Q.COMP, vel=0.5, nota=62)
e.redoble(b(39, 3), PUL, golpes=8, vel=0.6)
e.redoble(b(45, 3), PUL, golpes=8, vel=0.65)
e.redoble(b(51, 2), 2 * PUL, golpes=16, vel=0.6)
e.reverso(b(52) - 0.9, 0.9, vel=0.45)
e.riser(b(56), 2 * Q.COMP, vel=0.5, nota=62)              # vuelve el pulso y sube
e.redoble(b(57, 2), 2 * PUL, golpes=16, vel=0.8)
e.reverso(b(58) - 1.2, 1.2, vel=0.65)
e.redoble(b(63, 3), PUL, golpes=8, vel=0.65)
e.reverso(b(64) - 1.0, 1.0, vel=0.55)

# ── cierre (58–60) ──
colchon_compas(C_FIN, vel=0.5, corte=1100)
e.bajo_redondo(b(C_FIN), 31, Q.COMP - 0.05, vel=0.4)
e.rasgueo(AC["Gmaj7"]["ch"], b(C_FIN), vel=0.6, dur=1.8)
for c in (C_FIN + 1, C_FIN + 2):
    colchon_compas(c, vel=0.5, corte=1300)
e.bajo_redondo(b(C_FIN + 1), 38, Q.COMP * 0.9, vel=0.45)
e.bajo_redondo(b(C_FIN + 2), 31, Q.COMP - 0.05, vel=0.35)
e.rasgueo(AC["D"]["ch"], R["cierra"], vel=0.95, dur=1.8)
arpegio_charango(C_FIN + 2, [67, 71, 74, 78, 81, 83, 81, 78], vel=0.48)

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

# tableros: entradas, ventanas, sellos, destellos (de eventos.json)
ev = json.load(open("eventos.json"))
cuenta = {}
for x in ev:
    t, tipo, pan = x["t"], x["tipo"], x["pan"]
    c = int(t // Q.COMP) + 1
    ac = acorde_en(min(max(c, 4), C_FIN - 1), 0) if 4 <= c < C_FIN else AC["D"]
    k = cuenta[(x["tablero"], tipo)] = cuenta.get((x["tablero"], tipo), -1) + 1
    nota = sorted(ac["p"])[min(k + 1, 3)] + 12
    if tipo in ("pop", "portal"):
        e.pop(t + 0.08, nota, vel=0.72, pan=pan)
    elif tipo == "cae":
        e.whoosh(t, 0.3, 3200, 700, vel=0.18, pan_de=pan, pan_a=pan, grave=0.2)
        e.pop(t + 0.22, nota - 12, vel=0.5, pan=pan)
        e.madera(t + 0.24, vel=0.16, tono=0.9, pan=pan)
    elif tipo == "sube":
        e.whoosh(t, 0.45, 600, 3600, vel=0.16, pan_de=pan, pan_a=pan, grave=0.2)
        e.pop(t + 0.3, nota, vel=0.4, pan=pan)
    elif tipo == "desliza":
        e.whoosh(t, 0.55, 900, 3800, vel=0.28, pan_de=-0.8, pan_a=pan, grave=0.3)
    elif tipo == "ventana":
        e.whoosh(t, 0.5, 500, 2400, vel=0.14, pan_de=pan, pan_a=pan, grave=0.4)
    elif tipo == "sello":
        e.whoosh(t - 0.05, 0.4, 700, 3400, vel=0.2, pan_de=pan, pan_a=pan, grave=0.2)
        e.campanita(t + 0.25, 86, vel=0.62, pan=pan, bus="fx")
        e.campanita(t + 0.29, 90, vel=0.45, pan=pan, bus="fx")
    elif tipo == "promo":
        e.whoosh(t - 0.05, 0.4, 700, 3400, vel=0.22, pan_de=pan, pan_a=pan, grave=0.2)
        for i, m in enumerate((86, 90, 93)):
            e.campanita(t + 0.22 + i * 0.06, m, vel=0.55, pan=pan, bus="fx")
        e.chispas(t + 0.3, 0.5, n=6, vel=0.35, ancho=0.5, semilla=99)
    elif tipo == "destello":
        e.destello(t, 93 + (k % 2) * 2, vel=0.28, pan=pan)
    elif tipo == "titulo":
        e.whoosh(t - 0.05, 0.5, 2500, 7000, vel=0.1, pan_de=pan - 0.2, pan_a=pan + 0.2, grave=0.0)

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
        e.whoosh(tb - antes, antes + despues, 500, 7500, vel=0.85, pan_de=-0.95 * d, pan_a=0.95 * d, grave=0.4,
                 forma=lambda u: np.sin(np.pi * u) ** 3)
        e.impacto2(tb + 0.02, vel=0.32, cola=0.3, sub=60)
    elif tipo == "tablas":
        n = {"v8": 8, "v12": 12, "h6": 6, "v10": 10}[T["juego"]]
        dur = 0.62
        paso = (1 - dur) / max(1, n - 1)
        for i in range(n):
            orden = i if T["desde"] == "izq" else (n - 1 - i if T["desde"] == "der" else abs(i - (n - 1) / 2) * 2)
            u_golpe = orden * paso * (0.5 if T["desde"] == "centro" else 1) + dur * 0.93
            tg = tb - antes + antes * u_golpe
            pan = (-0.85 + 1.7 * i / (n - 1)) if T["juego"] != "h6" else (-0.2 + 0.4 * (i % 2))
            e.madera(tg, vel=0.42, tono=1.0 + 0.05 * (i % 3), pan=pan)
        e.whoosh(tb - antes, antes + 0.1, 400, 3000, vel=0.35, pan_de=-0.6, pan_a=0.6, grave=0.3)
    elif tipo == "empuje":
        d = T["dir"]
        e.whoosh(tb - antes, antes + despues, 300, 5200, vel=0.75, pan_de=0.85 * d, pan_a=-0.85 * d, grave=0.6,
                 forma=lambda u: np.sin(np.pi * u) ** 2)
        e.madera(tb + despues * 0.5, vel=0.22, tono=0.85)
    elif tipo == "flor":
        t_ap = tb - antes
        e.campanita(t_ap + 0.12, 81, vel=0.5, pan=-0.1, dec=1.5, bus="fx")
        e.campanita(t_ap + 0.18, 86, vel=0.42, pan=0.1, dec=1.5, bus="fx")
        e.chispas(t_ap + 0.1, 0.5, n=8, vel=0.35, ancho=0.4, semilla=31 + j)
        e.riser(t_ap + 0.4, antes - 0.35, vel=0.4, nota=66)
        e.whoosh(tb - 0.45, 0.6, 250, 6000, vel=0.75, pan_de=0, pan_a=0, grave=0.7, forma=lambda u: u ** 2.2 * np.minimum(1, (1 - u) * 12))
        e.impacto2(tb + despues * 0.4, vel=0.45, cola=0.5)
    elif tipo == "puertas":
        e.whoosh(tb - 0.46, 0.44, 500, 2500, vel=0.5, pan_de=0, pan_a=0, grave=0.7, forma=lambda u: u ** 2)
        e.portazo(tb - 0.04, vel=0.95)
        e.whoosh(tb + 0.12, 0.6, 2500, 600, vel=0.45, pan_de=0, pan_a=0, grave=0.5)
        e.chispas(tb + 0.15, 0.5, n=8, vel=0.5, semilla=77)
        e.impacto2(tb + 0.12, vel=0.6, cola=0.7)

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
    e.campanita(R["brillo"][0] + 0.15, m, vel=0.5, pan=p, dec=1.6, bus="fx")

# ═════════════════════ mezcla ═════════════════════
e.nivel.update({"bombo": 0.5, "perc": 2.0, "bajo": 1.18, "armonia": 1.35, "cuerdas": 3.3, "melodia": 0.86,
                "colchon": 1.0, "campanas": 1.2, "pluck": 1.45, "fx": 1.15})
e.eq.update({"melodia": [("hp", 250), ("peak", 2400, 0.9, 1.5)], "cuerdas": [("hp", 180), ("peak", 2800, 0.9, 2.5), ("hs", 7500, 0.7, -2)],
             "pluck": [("hp", 260), ("hs", 8000, 0.7, -3)], "colchon": [("hp", 120), ("lp", 6000)]})
if os.environ.get("DIAG"):
    tramos = [(0, b(4)), (b(4), b(16)), (b(16), b(34)), (b(34), b(52)), (b(52), b(58)), (b(58), b(C_FIN)), (b(C_FIN), Q.DUR)]
    e.ecualizar()
    e.diag(tramos)
os.makedirs("audio", exist_ok=True)
e.exportar("audio", objetivo=-16.0, pico_efectos=-1.6)
