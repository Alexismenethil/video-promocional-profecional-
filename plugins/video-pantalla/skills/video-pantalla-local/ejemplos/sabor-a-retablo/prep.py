"""Prepara lo que la animación toma del repo y de la carta publicada.

Del repo salen la marca: el retablo, el logotipo, la flor, el yeso y los
recortes de las bolas de helado. De la carta publicada salen las fotos reales,
los nombres vigentes y los sabores disponibles: la carta la manda el panel, no
el código. Es solo lectura, la misma consulta que hace el teléfono de un
cliente al abrir la carta. Sin red, se usan las fotos provisionales del repo.

    python3 prep.py /ruta/al/repo
"""
import json
import os
import shutil
import sys
import urllib.request

import numpy as np
from PIL import Image
from scipy import ndimage

REPO = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
# La URL pública de la carta (GET /api/carta): sale de NEXT_PUBLIC_API_URL en el workflow de deploy del repo.
CARTA_URL = os.environ.get("CARTA_URL", "")
os.makedirs(OUT, exist_ok=True)
P = lambda *a: os.path.join(REPO, *a)

# ───────────── retablo ─────────────
ab = Image.open(P("frontend/public/marca/retablo-abierto.png")).convert("RGBA")
ce = Image.open(P("frontend/public/marca/retablo-cerrado.png")).convert("RGBA")

# Caja: el retablo abierto sin sus puertas (bisagras en x=332 y x=937).
a = np.array(ab)
a[:, :332, 3] = 0
a[:, 938:, 3] = 0
caja = Image.fromarray(a)
caja.crop(caja.getbbox()).save(os.path.join(OUT, "retablo-caja.png"))

# Frentes (retablo cerrado) y dorsos (retablo abierto) de cada puerta.
for nombre, (img, box) in {
    "puerta-izq-frente": (ce, (326, 404, 632, 1036)),
    "puerta-der-frente": (ce, (632, 404, 934, 1036)),
    "puerta-izq-dorso": (ab, (66, 399, 332, 1038)),
    "puerta-der-dorso": (ab, (938, 399, 1186, 1033)),
}.items():
    img.crop(box).save(os.path.join(OUT, nombre + ".png"))

# ───────────── logotipo por piezas ─────────────
lg = np.array(Image.open(P("frontend/public/marca/logotipo-oficial.png")).convert("RGBA"))
nombre = lg[226:458].copy()
r, g, b = [nombre[..., i].astype(int) for i in range(3)]
nombre[:8, 380:640, 3] = 0                                   # restos de pétalos sobre la «S»
nombre[(b > g - 10) & (b > r + 40) & (g > r + 30), 3] = 0
Image.fromarray(nombre).save(os.path.join(OUT, "logo-nombre.png"))
Image.fromarray(lg[458:481]).save(os.path.join(OUT, "logo-filete.png"))
Image.fromarray(lg[481:530]).save(os.path.join(OUT, "logo-bajada.png"))
for src, dst in [("frontend/public/marca/flor-oficial.webp", "flor.webp"),
                 ("frontend/public/marca/fondo-carta-editorial.webp", "yeso.webp")]:
    shutil.copy(P(src), os.path.join(OUT, dst))

# ───────────── carta publicada ─────────────
def leer_carta():
    req = urllib.request.Request(CARTA_URL, headers={"Accept": "application/json",
                                                     "User-Agent": "sabor-a-retablo-pantalla/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


try:
    carta = leer_carta()
    print("carta publicada leída:", carta.get("actualizadaEn"))
except Exception as e:  # sin red: fotos provisionales y nombres del catálogo sembrado
    print("sin carta publicada (", e, ") → se usan las fotos provisionales del repo")
    carta = None

clave = lambda s: " ".join(s.lower().split())
if carta:
    categorias = {clave(c["nombre"]): [p for p in c["productos"] if p.get("disponible", True)] for c in carta["categorias"]}
    productos = {clave(p["nombre"]): p for ps in categorias.values() for p in ps}
else:
    categorias, productos = {}, {}

# Foto elegida por producto, con su encuadre dentro del arco: `foco` es el
# punto de la foto que queda al centro, `vapor` de dónde sale el humo.
# El café usa la foto de la casa a propósito: la del Mocaccino no luce en el arco.
FOTOS = {
    "cafe": (None, None, {"foco": [0.49, 0.5], "zoom": 1.0, "vapor": [0.45, 0.333]},
             "frontend/public/productos/cafe-de-la-casa.jpg"),
    "crepe-dulce": ("Crepa Tropical", "crepes dulces", {"foco": [0.5, 0.56], "zoom": 1.0},
                    "frontend/public/productos/provisional-1.webp"),
    "crepe-salado": ("Crepe Hawaiana", "crepes salados", {"foco": [0.55, 0.52], "zoom": 1.3},
                     "frontend/public/productos/crepe-salado.jpg"),
}
datos = {"fotos": {}}
for archivo, (producto, categoria, encuadre, respaldo) in FOTOS.items():
    p = productos.get(clave(producto)) if producto else None
    if producto and not (p and p.get("imagenUrl")):
        p = next((q for q in categorias.get(categoria, []) if q.get("imagenUrl")), None)
        encuadre = {"foco": [0.5, 0.5], "zoom": 1.0, "vapor": [0.5, 0.35]}
    destino = os.path.join(OUT, archivo + ".webp")
    if p and p.get("imagenUrl"):
        urllib.request.urlretrieve(p["imagenUrl"], destino)
        print(f"  {archivo}: {p['nombre']}")
    else:
        Image.open(P(respaldo)).convert("RGB").save(destino, quality=95)
        print(f"  {archivo}: foto de la casa ({os.path.basename(respaldo)})")
    datos["fotos"][archivo] = {"src": f"assets/{archivo}.webp", **encuadre}


def vigentes(preferidos, categoria_nombres):
    """Los nombres preferidos que siguen en la carta, en ese orden."""
    if not carta:
        return preferidos
    disponibles = {clave(p["nombre"]): p["nombre"].strip() for c in categoria_nombres for p in categorias.get(c, [])}
    return [disponibles[clave(n)] for n in preferidos if clave(n) in disponibles]


cafes = vigentes(["Café espresso", "Café americano", "Capuccino", "Mocaccino"], ["bebidas calientes"])
datos["cafe"] = [n[5:].capitalize() if n.lower().startswith("café ") else n for n in cafes]
datos["crepes"] = vigentes(["Banana Crepa", "Crepe Lliqlla", "Crepa Arcoíris", "Crepe Hawaiana", "Mega Crepa",
                            "Crepe Danzante", "Crepa Galaxia", "Crepa Tropical"],
                           ["crepes dulces", "crepes salados", "crepes de colores"])

# Sabores: los helados disponibles que tienen su bola recortada en el repo.
ORDEN = ["lucuma", "muyuchi", "quinua", "fresa", "chocolate", "menta", "oreo", "chocochip", "capuccino", "tutifruti"]
if carta:
    publicados = [(s["slug"], s["nombre"]) for s in carta["sabores"] if s.get("grupo") == "helado" and s.get("disponible", True)]
else:
    publicados = [(s, s.capitalize()) for s in ORDEN]
sabores = [(s, n) for s, n in publicados if os.path.exists(P(f"frontend/public/sabores/{s}.webp"))]
sin_foto = [n for s, n in publicados if (s, n) not in sabores]
sabores.sort(key=lambda x: ORDEN.index(x[0]) if x[0] in ORDEN else 99)
datos["sabores"] = sabores
if sin_foto:
    print("  sabores sin recorte (no salen en la vitrina):", ", ".join(sin_foto))

# Bolas de helado: fuera la base de estudio. La base es lisa y el helado tiene
# textura, así que se come desde afuera todo lo liso y claro de la mitad baja.
os.makedirs(os.path.join(OUT, "scoops"), exist_ok=True)
for n, _ in sabores:
    im = np.array(Image.open(P(f"frontend/public/sabores/{n}.webp")).convert("RGBA")).astype(float)
    rgb, al = im[..., :3], im[..., 3].copy()
    lum = rgb @ [0.299, 0.587, 0.114]
    mu = ndimage.uniform_filter(lum, 7); mu2 = ndimage.uniform_filter(lum * lum, 7)
    std = np.sqrt(np.maximum(mu2 - mu * mu, 0))
    sat = rgb.max(-1) - rgb.min(-1)
    ys = np.where(al.max(1) > 10)[0]; ytop, ybot = ys.min(), ys.max()
    yy = np.arange(al.shape[0])[:, None] * np.ones((1, al.shape[1]))
    cand = (yy > ytop + 0.55 * (ybot - ytop)) & (al > 0) & (std < 7.5) & (lum > 95) & (sat < 60)
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
    m = ndimage.binary_opening(al > 100, iterations=2)
    m = ndimage.binary_erosion(m, iterations=1).astype(float)
    al = np.minimum(al / 255.0, ndimage.gaussian_filter(m, 1.0)) * 255
    o = Image.fromarray(np.dstack([rgb, al]).clip(0, 255).astype(np.uint8), "RGBA")
    bb = o.getbbox()
    o.crop((max(0, bb[0] - 4), max(0, bb[1] - 4), min(480, bb[2] + 4), min(480, bb[3] + 4))).save(
        os.path.join(OUT, "scoops", n + ".png"))

# Para 4K: lo que en pantalla se ve más grande que su archivo se amplía con
# Lanczos y un toque de nitidez; el navegador lo toma solo con `srcset` 2x.
from PIL import ImageFilter
def doble(nombre):
    ruta = os.path.join(OUT, nombre)
    base, ext = os.path.splitext(ruta)
    im = Image.open(ruta)
    modo = im.mode
    im2 = im.convert("RGBA" if "A" in modo else "RGB").resize((im.width * 2, im.height * 2), Image.LANCZOS)
    im2 = im2.filter(ImageFilter.UnsharpMask(radius=1.6, percent=55, threshold=2))
    if ext == ".webp":
        im2.save(base + "@2x.webp", quality=94)
    else:
        im2.save(base + "@2x" + ext)
for n in ["retablo-caja.png", "puerta-izq-frente.png", "puerta-der-frente.png", "puerta-izq-dorso.png",
          "puerta-der-dorso.png", "logo-nombre.png", "logo-filete.png", "logo-bajada.png", "cafe.webp"]:
    doble(n)
datos["fotos"]["cafe"]["src2x"] = "assets/cafe@2x.webp"

with open(os.path.join(OUT, "datos.js"), "w") as f:
    f.write("window.DATOS = " + json.dumps(datos, ensure_ascii=False, indent=1) + ";\n")
print(json.dumps({k: v for k, v in datos.items() if k != "fotos"}, ensure_ascii=False))
