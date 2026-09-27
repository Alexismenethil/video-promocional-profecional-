#!/usr/bin/env python3
"""Tira de cuadros: una miniatura cada N cuadros de una carpeta, con su tiempo. Para ver el
movimiento completo (saltos, huecos, cosas que aparecen de golpe) en una o dos imágenes.

    python3 tira.py rapido/ --fps 30 --cada 3 --salida previa/tira   → previa/tira0.jpg, tira1.jpg…

Lo habitual: una previa rápida sin desenfoque (MUESTRAS=1 SALIDA=rapido node render.mjs video 30)
y una miniatura cada 0,1 s (cada 3 cuadros a 30 fps): 150 miniaturas en dos hojas.
"""
import argparse
import os
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("carpeta")
ap.add_argument("--fps", type=float, default=30)
ap.add_argument("--cada", type=int, default=3)
ap.add_argument("--por-hoja", type=int, default=80)
ap.add_argument("--cols", type=int, default=8)
ap.add_argument("--salida", default="previa/tira")
a = ap.parse_args()

fuentes = ["/System/Library/Fonts/Supplemental/Arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
f = next((ImageFont.truetype(p, 14) for p in fuentes if os.path.exists(p)), ImageFont.load_default())
archivos = sorted(x for x in os.listdir(a.carpeta) if x.lower().endswith((".png", ".jpg", ".jpeg")))[:: a.cada]
w, h = 240, 135
os.makedirs(os.path.dirname(a.salida) or ".", exist_ok=True)
for n in range(0, len(archivos), a.por_hoja):
    parte = archivos[n:n + a.por_hoja]
    filas = (len(parte) + a.cols - 1) // a.cols
    hoja = Image.new("RGB", (a.cols * w, filas * (h + 18)), (15, 15, 15))
    d = ImageDraw.Draw(hoja)
    for i, x in enumerate(parte):
        im = Image.open(os.path.join(a.carpeta, x)).convert("RGB").resize((w, h), Image.BILINEAR)
        X, Y = (i % a.cols) * w, (i // a.cols) * (h + 18)
        hoja.paste(im, (X, Y))
        d.text((X + 3, Y + h + 1), f"{int(os.path.splitext(x)[0]) / a.fps:.2f}s", fill=(255, 255, 255), font=f)
    ruta = f"{a.salida}{n // a.por_hoja}.jpg"
    hoja.save(ruta, quality=85)
    print(ruta)
