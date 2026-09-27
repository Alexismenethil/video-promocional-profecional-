#!/usr/bin/env python3
"""Hoja de contactos: junta varias imágenes (cuadros sueltos) en una sola, con su nombre debajo.

    python3 hoja.py salida.jpg previa/t0.000.png previa/t1.500.png …  [--cols 2] [--ancho 960]

Sirve para revisar muchos instantes de un vistazo sin gastar una lectura por imagen.
"""
import argparse
import os
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("salida")
ap.add_argument("imagenes", nargs="+")
ap.add_argument("--cols", type=int, default=2)
ap.add_argument("--ancho", type=int, default=960)
a = ap.parse_args()


def fuente(tam):
    for f in ["/System/Library/Fonts/Supplemental/Arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(f):
            return ImageFont.truetype(f, tam)
    return ImageFont.load_default()


w = a.ancho
h = round(w * 9 / 16)
filas = (len(a.imagenes) + a.cols - 1) // a.cols
hoja = Image.new("RGB", (a.cols * w, filas * (h + 26)), (20, 20, 20))
d = ImageDraw.Draw(hoja)
f = fuente(18)
for i, ruta in enumerate(a.imagenes):
    im = Image.open(ruta).convert("RGB").resize((w, h), Image.LANCZOS)
    x, y = (i % a.cols) * w, (i // a.cols) * (h + 26)
    hoja.paste(im, (x, y))
    d.text((x + 6, y + h + 3), os.path.basename(ruta), fill=(255, 255, 255), font=f)
hoja.save(a.salida, quality=90)
print(a.salida, hoja.size)
