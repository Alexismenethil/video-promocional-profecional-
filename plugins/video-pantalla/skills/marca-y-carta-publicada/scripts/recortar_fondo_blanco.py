#!/usr/bin/env python3
"""Recorta objetos de color sobre fondo blanco de estudio (hojas, frutas, flores) → PNG con alfa.

    python3 recortar_fondo_blanco.py hoja-monstera.jpg assets/hojas.png [--piezas 2] [--umbral 245]

El alfa sale de dos cosas: qué tan lejos del blanco está el píxel y cuánto color tiene (el
blanco y los grises de la sombra de estudio tienen poco). Se quedan las `piezas` más grandes.
Revisarlo SIEMPRE sobre el fondo real (claro y oscuro): una sombra gris de estudio se ve como halo.
"""
import argparse
import numpy as np
from PIL import Image
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument("entrada"); ap.add_argument("salida")
ap.add_argument("--piezas", type=int, default=2)
ap.add_argument("--umbral", type=float, default=245)
a = ap.parse_args()
x = np.array(Image.open(a.entrada).convert("RGB")).astype(float)
blanco = x.min(-1)
color = x.max(-1) - x.min(-1)
alfa = np.clip((a.umbral - blanco) / 55, 0, 1) * np.clip(color / 18 + 0.25, 0, 1)
alfa = ndimage.gaussian_filter(np.maximum(alfa, ndimage.binary_erosion(alfa > 0.5, iterations=2)), 0.7)
lab, n = ndimage.label(alfa > 0.2)
if n:
    tam = ndimage.sum(np.ones_like(alfa), lab, range(1, n + 1))
    alfa[(lab > 0) & ~np.isin(lab, np.argsort(-tam)[: a.piezas] + 1)] = 0
out = Image.fromarray(np.dstack([x, np.clip(alfa, 0, 1) * 255]).astype(np.uint8), "RGBA")
out.crop(out.getbbox()).save(a.salida)
print(a.salida, out.getbbox())
