#!/usr/bin/env python3
"""Espectrograma + envolvente de cada pista, con las marcas de cues.js arriba (verde).

    python3 espectro.py previa/espectro.png audio/pista.wav audio/efectos.wav [--cues cues.js]

Como no se puede escuchar, se mira: cada efecto tiene que caer sobre su marca, la música tiene
que respirar en la firma (inicio y final) y no puede haber huecos ni saturación.
"""
import argparse
import json
import re
import wave

import numpy as np
from PIL import Image, ImageDraw
from scipy.signal import spectrogram

ap = argparse.ArgumentParser()
ap.add_argument("salida")
ap.add_argument("wavs", nargs="+")
ap.add_argument("--cues", default="cues.js")
ap.add_argument("--ancho", type=int, default=1500)
a = ap.parse_args()

texto = "\n".join(l for l in open(a.cues, encoding="utf-8").read().splitlines() if not l.strip().startswith("//"))
C = json.loads(re.sub(r";\s*$", "", re.sub(r"^[^=]*=\s*", "", texto.strip())))
dur = C.get("dur", 15.0)
marcas = []
def juntar(v):
    if isinstance(v, (int, float)):
        marcas.append(float(v))
    elif isinstance(v, list):
        for x in v:
            juntar(x)
    elif isinstance(v, dict):
        for x in v.values():
            juntar(x)
for k, v in C.items():
    if k not in ("dur", "fps", "bpm", "pulso", "muestras"):
        juntar(v)
compas = 4 * 60.0 / C["bpm"] if "bpm" in C else None

W = a.ancho
piezas = []
for ruta in a.wavs:
    w = wave.open(ruta)
    x = np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, w.getnchannels()).T / 32768.0
    m = x.mean(0)
    fr, tt, Sx = spectrogram(m, w.getframerate(), nperseg=2048, noverlap=1536)
    Sx = 10 * np.log10(Sx + 1e-12)
    idx = np.clip(np.searchsorted(fr, np.geomspace(40, 16000, 300)), 0, len(fr) - 1)
    Z = np.clip((Sx[idx[::-1], :] + 110) / 80, 0, 1)
    Z = np.array(Image.fromarray((Z * 255).astype(np.uint8)).resize((W, 300)))
    im = Image.fromarray(np.stack([Z, (Z * 0.8).astype(np.uint8), (255 - Z) // 3], -1).astype(np.uint8))
    d = ImageDraw.Draw(im)
    for c in marcas:
        X = int(c / dur * W); d.line([(X, 0), (X, 12)], fill=(0, 255, 0))
    d.text((6, 280), ruta, fill=(255, 255, 255))
    env = np.sqrt(np.convolve(m ** 2, np.ones(2400) / 2400, "same"))[::480]
    db = 20 * np.log10(env + 1e-6)
    e = Image.new("RGB", (W, 120)); d2 = ImageDraw.Draw(e)
    if compas:
        for k in range(int(dur / compas) + 1):
            X = int(k * compas / dur * W); d2.line([(X, 0), (X, 120)], fill=(70, 70, 70))
    d2.line([(int(i / len(db) * W), int(120 - (max(-60, v) + 60) / 60 * 120)) for i, v in enumerate(db)], fill=(255, 255, 255))
    piezas += [im, e]
hoja = Image.new("RGB", (W, sum(p.height + 10 for p in piezas)))
y = 0
for p in piezas:
    hoja.paste(p, (0, y)); y += p.height + 10
hoja.save(a.salida)
print(a.salida)
