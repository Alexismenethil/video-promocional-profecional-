#!/usr/bin/env python3
"""¿Se nota el corte del bucle? Compara el último cuadro con el primero, y el final del audio
con su comienzo, contra la variación normal entre vecinos.

    python3 costura.py --cuadros cuadros60_4k --audio audio/pista.wav audio/efectos.wav

Imagen: la diferencia media último→primero tiene que parecerse a la de dos cuadros vecinos.
Audio: el salto de muestra en la costura tiene que ser mucho menor que el percentil 99 de los saltos.
"""
import argparse
import os
import wave

import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("--cuadros")
ap.add_argument("--audio", nargs="*", default=[])
a = ap.parse_args()
ok = True

if a.cuadros:
    fs = sorted(x for x in os.listdir(a.cuadros) if x.lower().endswith((".png", ".jpg")))
    def c(i):
        return np.array(Image.open(os.path.join(a.cuadros, fs[i])).convert("RGB").resize((960, 540), Image.BILINEAR)).astype(float)
    costura = np.abs(c(-1) - c(0)).mean()
    # referencia: los saltos normales entre vecinos al final y al comienzo (incluye cambios de grano)
    pares = [(i, i + 1) for i in range(-7, -1)] + [(i, i + 1) for i in range(0, 6)]
    vecinos = [np.abs(c(a) - c(b)).mean() for a, b in pares]
    tope = max(vecinos)
    bien = costura <= tope * 1.3 + 0.2
    ok &= bien
    print(f"imagen · costura {costura:.3f} · vecinos {np.mean(vecinos):.3f} (máx {tope:.3f}) → "
          f"{'sin corte visible' if bien else 'SE NOTA EL CORTE'}")

for ruta in a.audio:
    w = wave.open(ruta)
    x = np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, w.getnchannels()).astype(float) / 32768
    saltos = np.abs(np.diff(x, axis=0))
    costura = np.abs(x[0] - x[-1]).max()
    p99 = np.percentile(saltos, 99)
    bien = costura < p99
    ok &= bien
    print(f"audio {os.path.basename(ruta)} · {len(x) / w.getframerate():.3f} s · salto en la costura {costura:.4f} · p99 {p99:.4f} → "
          f"{'sin clic' if bien else 'HAY UN CLIC EN EL CORTE'}")
raise SystemExit(0 if ok else 1)
