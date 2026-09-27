#!/usr/bin/env python3
"""Quita la base lisa y clara de estudio (plato, pedestal) de un recorte de producto, p. ej. bolas
de helado ya recortadas pero con su base blanca pegada. La base es lisa y el producto tiene textura:
se come desde afuera todo lo liso y claro de la parte de abajo.

    python3 quitar_base_lisa.py fresa.webp assets/bolas/fresa.png [--desde 0.55]
"""
import argparse
import numpy as np
from PIL import Image
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument("entrada"); ap.add_argument("salida")
ap.add_argument("--desde", type=float, default=0.55, help="fracción de la altura desde donde puede haber base")
a = ap.parse_args()
im = np.array(Image.open(a.entrada).convert("RGBA")).astype(float)
rgb, al = im[..., :3], im[..., 3].copy()
lum = rgb @ [0.299, 0.587, 0.114]
mu = ndimage.uniform_filter(lum, 7); mu2 = ndimage.uniform_filter(lum * lum, 7)
std = np.sqrt(np.maximum(mu2 - mu * mu, 0))
sat = rgb.max(-1) - rgb.min(-1)
ys = np.where(al.max(1) > 10)[0]; ytop, ybot = ys.min(), ys.max()
yy = np.arange(al.shape[0])[:, None] * np.ones((1, al.shape[1]))
cand = (yy > ytop + a.desde * (ybot - ytop)) & (al > 0) & (std < 7.5) & (lum > 95) & (sat < 60)
fuera = al < 20
comido = fuera.copy()
for _ in range(60):
    nuevo = ndimage.binary_dilation(comido) & cand & ~comido
    if not nuevo.any():
        break
    comido |= nuevo
al[comido & ~fuera] = 0
al[(yy > ybot - 40) & (sat < 34) & (lum > 140)] = 0
lab, nl = ndimage.label(al > 40)
if nl > 1:
    sizes = ndimage.sum(np.ones_like(al), lab, range(1, nl + 1))
    al[(lab != np.argmax(sizes) + 1) & (lab > 0)] = 0
m = ndimage.binary_erosion(ndimage.binary_opening(al > 100, iterations=2), iterations=1).astype(float)
al = np.minimum(al / 255.0, ndimage.gaussian_filter(m, 1.0)) * 255
o = Image.fromarray(np.dstack([rgb, al]).clip(0, 255).astype(np.uint8), "RGBA")
bb = o.getbbox()
o.crop((max(0, bb[0] - 4), max(0, bb[1] - 4), min(o.width, bb[2] + 4), min(o.height, bb[3] + 4))).save(a.salida)
print(a.salida)
