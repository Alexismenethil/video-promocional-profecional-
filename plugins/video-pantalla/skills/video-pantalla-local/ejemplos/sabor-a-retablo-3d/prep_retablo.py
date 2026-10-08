"""Texturas del retablo de la marca (fotos del repo) y sus motivos pintados sueltos.

    python3 prep_retablo.py /ruta/al/repo [--hoja]

- assets/retablo/: frentes y dorsos de las puertas, frontón (el triángulo de arriba), @2x para 4K.
- assets/motivos/atlas.png + motivos.js: cada hoja, ramita, voluta y florcita pintada del retablo,
  recortada con un filo de papel crema (adornos que flotan en 3D, como recortables).
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

REPO = sys.argv[1]
HOJA = "--hoja" in sys.argv
AQUI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(AQUI, "assets")
MARCA = os.path.join(REPO, "frontend", "public", "marca")
os.makedirs(os.path.join(OUT, "retablo"), exist_ok=True)
os.makedirs(os.path.join(OUT, "motivos"), exist_ok=True)

ce = Image.open(os.path.join(MARCA, "retablo-cerrado.png")).convert("RGBA")
ab = Image.open(os.path.join(MARCA, "retablo-abierto.png")).convert("RGBA")


def doble(im, nitidez=True):
    """@2x: Lanczos sobre premultiplicado + nitidez suave, sin halos en el filo."""
    a = np.array(im).astype(np.float32)
    al = a[..., 3:4] / 255
    pm = np.dstack([a[..., :3] * al, a[..., 3:4]]).round().astype(np.uint8)
    g = np.array(Image.fromarray(pm, "RGBA").resize((im.width * 2, im.height * 2), Image.LANCZOS)).astype(np.float32)
    a2 = g[..., 3:4] / 255
    rgb = g[..., :3] / np.maximum(a2, 1e-3)
    solido = a2[..., 0] > 0.9
    if solido.any():
        _, (iy, ix) = ndimage.distance_transform_edt(~solido, return_indices=True)
        rgb = np.where(a2 > 0.9, rgb, rgb[iy, ix])
    rgb = Image.fromarray(np.clip(rgb, 0, 255).round().astype(np.uint8))
    if nitidez:
        rgb = rgb.filter(ImageFilter.UnsharpMask(1.4, 45, 2))
    return Image.fromarray(np.dstack([np.array(rgb), (a2 * 255).round().astype(np.uint8)]), "RGBA")


def opaco(im):
    """Las caras van pegadas a la geometría: sin transparencia (el borde de la foto toma el color vecino)."""
    a = np.array(im).astype(np.float32)
    al = a[..., 3]
    sol = al > 200
    _, (iy, ix) = ndimage.distance_transform_edt(~sol, return_indices=True)
    rgb = a[..., :3][iy, ix]
    return Image.fromarray(rgb.round().astype(np.uint8), "RGB")


# Medidas en la foto del retablo cerrado (px): frontón de y 108 a 400, puertas de y 402 a 1035,
# de x 333 a 928, costura en x 631. El abierto: dorsos de x 67 a 332 y de x 936 a 1184.
piezas = {
    "puerta-izq": (ce, (333, 402, 631, 1035)),
    "puerta-der": (ce, (631, 402, 929, 1035)),
    "dorso-izq": (ab, (67, 401, 333, 1034)),
    "dorso-der": (ab, (936, 401, 1185, 1034)),
    "fronton": (ce, (329, 104, 931, 401)),
}
for n, (im, caja) in piezas.items():
    c = im.crop(caja)
    if n == "fronton":
        doble(c).save(os.path.join(OUT, "retablo", n + ".png"))        # el triángulo lleva alfa
    else:
        d = doble(opaco_rgba := Image.merge("RGBA", (*opaco(c).split(), Image.new("L", c.size, 255))))
        d.convert("RGB").save(os.path.join(OUT, "retablo", n + ".jpg"), quality=93)
    print(n, c.size)

# ───────────────────────── motivos pintados ─────────────────────────
# Lo pintado se separa de la madera crema por distancia de color; cada mancha conexa es un motivo.
a = np.array(ce).astype(np.float32)
rgb, al = a[..., :3], a[..., 3]
crema = np.array([236.0, 231.0, 216.0])
dist = np.sqrt(((rgb - crema) ** 2).sum(-1))
pint = (dist > 46) & (al > 250)
pint = ndimage.binary_closing(pint, iterations=2)
pint = ndimage.binary_opening(pint, iterations=1)
# Solo lo que está adentro de las caras (no las bisagras ni el canto)
zona = np.zeros_like(pint)
zona[118:392, 345:915] = True        # frontón
zona[412:1026, 345:917] = True       # puertas
zona[412:1026, 622:640] = False      # costura
pint &= zona
lab, n = ndimage.label(pint, structure=np.ones((3, 3)))
objs = ndimage.find_objects(lab)
motivos = []
PAD = 16
for i, sl in enumerate(objs):
    area = (lab[sl] == i + 1).sum()
    if area < 60:
        continue
    y0, y1 = max(sl[0].start - PAD, 0), min(sl[0].stop + PAD, a.shape[0])
    x0, x1 = max(sl[1].start - PAD, 0), min(sl[1].stop + PAD, a.shape[1])
    m = (lab[y0:y1, x0:x1] == i + 1)
    # Filo de papel: la mancha engordada ~4 px con borde suave; adentro, la pintura real.
    dt = ndimage.distance_transform_edt(~m)
    papel = np.clip((5.0 - dt) / 1.6, 0, 1)
    col = rgb[y0:y1, x0:x1].copy()
    pintado = ndimage.binary_dilation(m, iterations=1)
    col[~pintado] = col[~pintado] * 0.25 + np.array([246.0, 241.0, 228.0]) * 0.75     # el filo, crema
    c = col[m].mean(0)
    tono = ("turquesa" if c[2] > c[0] + 15 and c[1] > c[0] else "verde" if c[1] > c[0] + 15 else
            "coral" if c[0] > 180 and c[1] < 170 else "amarillo" if c[0] > 170 and c[1] > 150 else
            "rosa" if c[0] > 200 else "cafe")
    motivos.append({"img": np.dstack([col, papel * 255]), "area": int(area), "tono": tono,
                    "caja": [int(x0), int(y0), int(x1), int(y1)]})
print("motivos:", len(motivos), {t: sum(1 for m in motivos if m["tono"] == t) for t in set(m["tono"] for m in motivos)})

# Atlas @2x por estantes
ESC = 2
motivos.sort(key=lambda m: -m["img"].shape[0])
ANCHO = 2048
x = y = alto_fila = 0
pos = []
for m in motivos:
    h, w = m["img"].shape[0] * ESC, m["img"].shape[1] * ESC
    if x + w > ANCHO:
        x, y, alto_fila = 0, y + alto_fila + 10, 0
    pos.append((x, y, w, h))
    x += w + 10
    alto_fila = max(alto_fila, h)
ALTO = int(2 ** np.ceil(np.log2(y + alto_fila + 10)))
atlas = Image.new("RGBA", (ANCHO, ALTO), (0, 0, 0, 0))
lista = []
for m, (x, y, w, h) in zip(motivos, pos):
    im = doble(Image.fromarray(m["img"].round().clip(0, 255).astype(np.uint8), "RGBA"))
    atlas.paste(im, (x, y))
    lista.append({"uv": [x / ANCHO, 1 - (y + h) / ALTO, w / ANCHO, h / ALTO], "w": w, "h": h,
                  "tono": m["tono"], "area": m["area"], "caja": m["caja"]})
# Sangrado del color hacia lo transparente (mipmaps sin filo oscuro)
A = np.array(atlas).astype(np.float32)
sol = A[..., 3] > 30
_, (iy, ix) = ndimage.distance_transform_edt(~sol, return_indices=True)
A[..., :3] = np.where(sol[..., None], A[..., :3], A[..., :3][iy, ix])
Image.fromarray(A.round().astype(np.uint8), "RGBA").save(os.path.join(OUT, "motivos", "atlas.png"))
with open(os.path.join(OUT, "motivos", "motivos.js"), "w") as f:
    f.write("// Motivos pintados del retablo (prep_retablo.py). uv = [u0, v0, du, dv] en el atlas.\n")
    f.write("window.MOTIVOS = " + json.dumps({"ancho": ANCHO, "alto": ALTO, "lista": lista}) + ";\n")
print("atlas", ANCHO, ALTO)

if HOJA:
    fondo = Image.new("RGB", (ANCHO, ALTO), (13, 59, 43))
    fondo.paste(atlas, (0, 0), atlas)
    fondo.save(os.path.join(AQUI, "previa", "motivos.jpg"), quality=85)
