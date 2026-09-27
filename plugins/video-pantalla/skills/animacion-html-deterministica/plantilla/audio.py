#!/usr/bin/env python3
"""Partitura de la plantilla: house suave a 128 BPM en Fa mayor + efectos al compás de la imagen.

Lee los tiempos de cues.js (el mismo reloj que la animación) y usa audiolib.py
(copiarlo junto a este archivo desde la skill sonido-para-video). Escribe:
    audio/pista.wav    música + efectos, −16 LUFS
    audio/efectos.wav  solo efectos (la versión para poner otra música encima)

    python3 audio.py          DIAG=1 python3 audio.py   (imprime el nivel de cada bus)
"""
import os
import numpy as np
from audiolib import Estudio, leer_cues

C = leer_cues("cues.js")
e = Estudio(dur=C["dur"], bpm=C["bpm"], semilla=128)
tb = e.tb

# ───────── armonía: I · vi · IV · V en Fa, con séptimas y novenas ─────────
F9, DM9, BB9, C9 = [57, 60, 64, 67], [60, 64, 65, 69], [62, 65, 69, 72], [58, 62, 64, 67]
ARMONIA = [(F9, 41), (DM9, 38), (BB9, 34), (C9, 36), (F9, 41), (DM9, 38), (BB9, 34), (F9, 41)]

# Compases 1 y 8 (el cruce del bucle) quietos: la firma respira; el groove va del 2 al 7.
for c in (0, 7):
    for k, m in enumerate([77, 81, 84, 88, 91, 88, 84, 81]):
        e.kalimba(tb(c, k * 0.5), m, 0.55 if k % 2 == 0 else 0.4, pan=-0.35 + 0.1 * k)
    e.colchon(tb(c), e.compas, [53, 57, 60, 64, 67], 0.8, ataque=0.3)
    e.acorde_piano(tb(c), F9, 1.6, 0.42)
    for k in range(8):
        e.maraca(tb(c, k * 0.5 + 0.5), 0.2 if k % 2 else 0.12, pan=0.3)
e.bajo_pulsado(tb(0), 29, 0.9, 0.55)
e.subida(tb(0, 1.9), 2.1 * e.pulso, vel=0.9)
for k in range(8):                                   # redoble de palmas hacia la caída
    e.palmas(tb(0, 2 + k * 0.25), 0.2 + 0.5 * (k / 7) ** 1.5, pan=0.1 * (-1) ** k)

STAB = [(0.0, 0.2), (1.5, 0.16), (2.5, 0.16), (3.0, 0.3)]   # «uno», «y» del dos, «y» del tres, cuatro
for c in range(1, 7):
    voz, raiz = ARMONIA[c]
    voces = [(0, BB9, 34), (2, C9, 36)] if c == 6 else [(0, voz, raiz)]
    for pulso in range(4):
        e.bombo_house(tb(c, pulso), 0.95 if pulso == 0 else 0.8)
        e.plato(tb(c, pulso + 0.5), 0.9, abierto=True, pan=0.22)
        for s16 in (0.25, 0.75):
            e.plato(tb(c, pulso + s16), 0.45, pan=-0.2)
        for s16 in range(4):
            e.maraca(tb(c, pulso + s16 * 0.25), 0.35 if s16 % 2 else 0.2, largo=0.045)
    e.palmas(tb(c, 1), 0.85)
    e.palmas(tb(c, 3), 0.85)
    for inicio, v, r in voces:
        largo = 4 if len(voces) == 1 else 2
        for p, d in STAB:
            if inicio <= p < inicio + largo:
                e.acorde_piano(tb(c, p), v, d, 0.72 if p == 0 else 0.58)
        for p in (0.0, 0.5, 1.5, 2.5, 3.5):         # bajo de casa: raíz en el uno y contratiempos
            if inicio <= p < inicio + largo:
                e.bajo_pulsado(tb(c, p), r + (12 if p in (1.5, 3.5) else 0), 0.32 if p == 0 else 0.2, 0.95 if p == 0 else 0.75)
    e.colchon(tb(c), e.compas, [m - 12 for m in voz] + [voz[-1]], 0.35, ataque=0.2)

# el tema, silbado
MELODIA = [
    (2, 0.0, 0.5, 84), (2, 0.5, 0.5, 86), (2, 1.0, 0.95, 89), (2, 2.0, 0.5, 86), (2, 2.5, 0.5, 84), (2, 3.0, 0.95, 81),
    (3, 0.0, 0.5, 79), (3, 0.5, 0.5, 81), (3, 1.0, 0.95, 84), (3, 2.0, 0.5, 81), (3, 2.5, 0.5, 79), (3, 3.0, 0.9, 76),
    (5, 0.0, 0.5, 81), (5, 0.5, 0.5, 84), (5, 1.0, 0.95, 86), (5, 2.0, 0.5, 84), (5, 2.5, 0.5, 81), (5, 3.0, 0.95, 77),
    (6, 0.0, 0.95, 86), (6, 1.0, 0.5, 84), (6, 1.5, 0.5, 81), (6, 2.0, 1.9, 79), (7, 0.0, 1.6, 81),
]
prev = None
for c, p, d, m in MELODIA:
    e.silbido(tb(c, p), d * e.pulso, m, 0.9 if d >= 0.9 else 0.75, de=prev if prev and abs(prev - m) <= 3 else None)
    prev = m

# ───────── efectos: cada uno sobre su cue ─────────
e.soplido(C["firmaSale"][0], 0.34, 2600, 700, vel=0.16, q=1.2)               # la firma se retira
e.gelatina(C["iris"][0], 150, 330, vel=0.8)                                  # el nombre crece
e.impacto(tb(1), 0.9)                                                        # cae el groove
e.soplido(C["iris"][0], C["iris"][1] - C["iris"][0], 300, 3800, vel=0.6, q=1.3)  # se abre el iris
for k, t0 in enumerate(C["arcos"]):                                          # entran los arcos
    e.pop(t0 + 0.02, [77, 81, 84][k], 0.85, pan=-0.05 + 0.25 * (k + 1))
e.soplido(C["tituloB"], 0.36, 700, 3000, vel=0.14, q=1.2, forma=lambda u: np.sin(np.pi * u) ** 2 * (1 - 0.5 * u))
for k, t0 in enumerate(C["pasosB"]):                                         # la fila corre un lugar
    e.soplido(t0 - 0.02, 0.36, 500, 2200, vel=0.3, pan_de=0.5, pan_a=-0.5, q=1.4)
    e.tic(t0 + 0.3, 0.55, tono=1.0 + 0.04 * k, pan=0.2)
e.subida(C["goteo"][0] - 0.9, 0.9, vel=0.8)                                  # el jarabe
e.impacto(C["goteo"][0], 0.75, cola=0.3)
e.jarabe(C["goteo"][0], C["goteo"][1] - C["goteo"][0], vel=0.9)
e.soplido(C["carrusel"][0], C["carrusel"][1] - C["carrusel"][0], 350, 2600, vel=0.5, pan_de=-0.8, pan_a=0.6, q=1.2,
          forma=lambda u: np.sin(np.pi * u ** 0.6) ** 2)                     # el carrusel entra girando
e.tic(C["carrusel"][1] - 0.02, 0.8, tono=0.9)
e.soplido(C["tituloC"], 0.36, 700, 3000, vel=0.14, q=1.2, forma=lambda u: np.sin(np.pi * u) ** 2 * (1 - 0.5 * u))
for k, t0 in enumerate(C["carruselPasos"]):
    e.soplido(t0 - 0.03, 0.34, 600, 2400, vel=0.28, pan_de=0.6, pan_a=-0.6, q=1.5)
    e.tic(t0 + 0.2, 0.6, tono=0.95 + 0.05 * (k % 3))
e.soplido(C["cierre"][0], C["cierre"][1] - C["cierre"][0], 4200, 300, vel=0.6, q=1.2,
          forma=lambda u: (1 - u) ** 1.3 * np.minimum(1, u * 10))           # se cierra el iris
e.gelatina(C["cierre"][1] - 0.05, 360, 150, vel=0.7)                         # el nombre se asienta
e.hilo(C["firma"][0], 0.9)                                                   # se dibuja el filete
e.soplido(C["firma"][0] + 0.12, 0.4, 900, 2800, vel=0.14, q=1.2, forma=lambda u: np.sin(np.pi * u) ** 2 * (1 - 0.5 * u))
e.brillo(C["brillo"][0])                                                     # el brillo final

if os.environ.get("DIAG"):
    e.diag([(0, 1.875), (1.875, 7.5), (7.5, 13.125), (13.125, 15)])
e.exportar("audio")
