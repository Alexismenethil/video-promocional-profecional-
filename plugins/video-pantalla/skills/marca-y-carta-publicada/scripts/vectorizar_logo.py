#!/usr/bin/env python3
"""Vectoriza un logotipo (PNG) letra por letra para usar las letras como ventanas y hacer zoom en 4K.

    python3 vectorizar_logo.py logo.png assets/logo.js --letras EOS
    python3 vectorizar_logo.py logo.png assets/logo.js --suavizado 1.6 --escala 8 --previa logo_vector.png

Salida: window.LOGO = { ancho, alto, orden: ["E","O","S"], letras: {E: [subtrazo, …]}, nucleo: {E: [x, y, r]} }
  · coordenadas en px del PNG original, con origen en la esquina de la caja del logo
  · cada subtrazo es [x0, y0, c1x, c1y, c2x, c2y, x, y, …] (solo cúbicas); el primero es el contorno
    exterior y los siguientes son huecos (la «O», la «e»): dibujar con fill-rule evenodd
  · nucleo = centro y radio del mayor círculo inscrito en la letra: el punto al que apunta la cámara

Por qué se suaviza: el PNG trae la escalera de sus píxeles; potrace la sigue y al hacer zoom se ven
los dientes. Se desenfoca el alfa (σ≈1.6 px) y se amplía x8 con interpolación cúbica ANTES de trazar:
el contorno sale liso y fiel a la forma.

Letras: cada componente conectado es una pieza; las piezas que se solapan en x (el punto de la «i»,
la tilde de la «ñ») se juntan en una letra. Requiere `potrace` (brew install potrace).
"""
import argparse
import json
import os
import re
import subprocess
import tempfile

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument("png")
ap.add_argument("salida")
ap.add_argument("--letras", default="", help="nombres de las letras de izquierda a derecha, p. ej. EOS")
ap.add_argument("--suavizado", type=float, default=1.6)
ap.add_argument("--escala", type=int, default=8)
ap.add_argument("--min-area", type=float, default=0.002, help="piezas más chicas que esta fracción se descartan")
ap.add_argument("--previa", help="PNG de control con el trazo relleno")
a = ap.parse_args()

im = np.array(Image.open(a.png).convert("RGBA")).astype(float) / 255
alfa = im[..., 3]
if alfa.max() - alfa.min() < 0.5:           # sin transparencia: tinta oscura sobre fondo claro
    alfa = 1 - im[..., :3].mean(-1)
ys, xs = np.where(alfa > 0.5)
x0, y0 = xs.min(), ys.min()
ancho, alto = int(xs.max() - x0 + 1), int(ys.max() - y0 + 1)
PAD, S = 20, a.escala
grande = ndimage.zoom(ndimage.gaussian_filter(np.pad(alfa, PAD), a.suavizado), S, order=3) > 0.5
H = grande.shape[0]
lab, n = ndimage.label(grande)
tam = ndimage.sum(np.ones_like(grande), lab, range(1, n + 1))
piezas = [k + 1 for k in range(n) if tam[k] >= a.min_area * grande.sum()]
cajas = {k: (np.where(lab == k)[1].min(), np.where(lab == k)[1].max()) for k in piezas}
# juntar piezas que se solapan en x
grupos = []
for k in sorted(piezas, key=lambda k: cajas[k][0]):
    for g in grupos:
        if cajas[k][0] <= g["x1"] and cajas[k][1] >= g["x0"]:
            g["piezas"].append(k); g["x0"] = min(g["x0"], cajas[k][0]); g["x1"] = max(g["x1"], cajas[k][1])
            break
    else:
        grupos.append({"piezas": [k], "x0": cajas[k][0], "x1": cajas[k][1]})
nombres = list(a.letras) if a.letras and len(a.letras) == len(grupos) else [f"L{i}" for i in range(len(grupos))]
if a.letras and len(a.letras) != len(grupos):
    print(f"aviso: {len(grupos)} letras encontradas y {len(a.letras)} nombres dados; uso L0, L1…")


def leer_potrace(fn):
    s = open(fn).read()
    sub = []
    for d in re.findall(r'<path d="([^"]+)"', s, re.S):
        toks = re.findall(r"[MmCcLlZz]|-?\d+(?:\.\d+)?", d)
        i, cmd, x, y, cur = 0, None, 0.0, 0.0, None
        while i < len(toks):
            t = toks[i]
            if t in "MmCcLlZz":
                cmd = t; i += 1
                if cmd in "Zz" and cur:
                    sub.append(cur); cur = None
                continue
            if cmd in "Mm":
                nx, ny = float(toks[i]), float(toks[i + 1]); i += 2
                if cmd == "m":
                    nx, ny = nx + x, ny + y
                x, y = nx, ny
                if cur:
                    sub.append(cur)
                cur = [[x, y]]
                cmd = "l" if cmd == "m" else "L"
            elif cmd in "Cc":
                v = [float(toks[i + k]) for k in range(6)]; i += 6
                if cmd == "c":
                    v = [v[0] + x, v[1] + y, v[2] + x, v[3] + y, v[4] + x, v[5] + y]
                cur.append(v); x, y = v[4], v[5]
            else:
                v = [float(toks[i]), float(toks[i + 1])]; i += 2
                if cmd == "l":
                    v = [v[0] + x, v[1] + y]
                cur.append([x + (v[0] - x) / 3, y + (v[1] - y) / 3, x + 2 * (v[0] - x) / 3, y + 2 * (v[1] - y) / 3, *v])
                x, y = v
        if cur:
            sub.append(cur)
    f = lambda X, Y: (round(X / 10 / S - PAD - x0, 2), round((H * 10 - Y) / 10 / S - PAD - y0, 2))
    out = []
    for sp in sub:
        pts = [f(*sp[0])]
        for v in sp[1:]:
            pts += [f(v[j], v[j + 1]) for j in (0, 2, 4)]
        out.append([c for p in pts for c in p])
    return out


def poligono(sp, pasos=10):
    pts = [(sp[0], sp[1])]
    for i in range(2, len(sp), 6):
        p0, c1, c2, p3 = (np.array(pts[-1]), np.array(sp[i:i + 2]), np.array(sp[i + 2:i + 4]), np.array(sp[i + 4:i + 6]))
        for t in np.linspace(0, 1, pasos)[1:]:
            pts.append(tuple((1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t * t * c2 + t ** 3 * p3))
    return pts


def area(pts):
    x, y = np.array(pts).T
    return 0.5 * (np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))


letras, nucleo = {}, {}
with tempfile.TemporaryDirectory() as tmp:
    for nombre, g in zip(nombres, grupos):
        pbm, svg = os.path.join(tmp, "l.pbm"), os.path.join(tmp, "l.svg")
        Image.fromarray(np.where(np.isin(lab, g["piezas"]), 0, 255).astype(np.uint8)).convert("1").save(pbm)
        subprocess.run(["potrace", "-s", "--flat", "-a", "1.3334", "-O", "1.5", "-t", "10", "-u", "10", pbm, "-o", svg], check=True)
        subs = leer_potrace(svg)
        # el contorno exterior primero (el de mayor área)
        subs.sort(key=lambda sp: -abs(area(poligono(sp))))
        letras[nombre] = subs
        Z = 4
        m = Image.new("L", (ancho * Z + 40, alto * Z + 40), 0)
        d = ImageDraw.Draw(m)
        for k, sp in enumerate(subs):
            d.polygon([(x * Z + 20, y * Z + 20) for x, y in poligono(sp)], fill=255 if k == 0 else 0)
        dt = ndimage.distance_transform_edt(np.array(m) > 127)
        iy, ix = np.unravel_index(np.argmax(dt), dt.shape)
        nucleo[nombre] = [round((ix - 20) / Z, 2), round((iy - 20) / Z, 2), round(dt.max() / Z, 2)]

logo = {"ancho": ancho, "alto": alto, "orden": nombres, "letras": letras, "nucleo": nucleo}
os.makedirs(os.path.dirname(a.salida) or ".", exist_ok=True)
with open(a.salida, "w") as f:
    f.write("window.LOGO = " + json.dumps(logo, separators=(",", ":")) + ";\n")
print(f"{a.salida}: {ancho}×{alto} px · letras {nombres} · segmentos {[sum(len(s) // 6 for s in letras[n]) for n in nombres]}")
if a.previa:
    Z = 2
    P = Image.new("RGB", (ancho * Z, alto * Z), "white")
    d = ImageDraw.Draw(P)
    for n in nombres:
        for k, sp in enumerate(letras[n]):
            d.polygon([(x * Z, y * Z) for x, y in poligono(sp)], fill=(30, 30, 30) if k == 0 else (255, 255, 255))
        cx, cy, r = nucleo[n]
        d.ellipse(((cx - r) * Z, (cy - r) * Z, (cx + r) * Z, (cy + r) * Z), outline=(220, 60, 60), width=2)
    P.save(a.previa)
    print("previa:", a.previa)
