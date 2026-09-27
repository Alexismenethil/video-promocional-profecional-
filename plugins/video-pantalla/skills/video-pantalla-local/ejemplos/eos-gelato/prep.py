"""Prepara lo que la animación toma del repo de EOS y de la carta publicada.

Del repo salen la marca: el logotipo (vectorizado, para que las letras sirvan
de ventana y aguanten el zoom en 4K), la hoja de monstera y las fuentes de la
casa. De la carta publicada salen las fotos reales y los nombres vigentes: la
carta la manda el panel, no el código. Es solo lectura, la misma consulta que
hace el teléfono de un cliente al escanear el QR.

    python3 prep.py /ruta/al/repo            # lee la carta publicada
    CARTA_JSON=carta.json python3 prep.py …  # usa una copia ya leída
"""
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import urllib.request

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

REPO = sys.argv[1]
AQUI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(AQUI, "assets")
# La URL pública de la carta (GET /api/carta): sale de NEXT_PUBLIC_API_URL en el workflow de deploy del repo.
CARTA_URL = os.environ.get("CARTA_URL", "")
P = lambda *a: os.path.join(REPO, *a)
for d in ["", "fotos", "fonts"]:
    os.makedirs(os.path.join(OUT, d), exist_ok=True)


# ───────────── fuentes de la casa ─────────────
# Cormorant Garamond y Manrope, tal como las baja el build de la carta.
from fontTools.ttLib import TTFont

def fuente(familia, italica):
    for f in sorted(glob.glob(P("frontend/.next*/static/media/*.woff2"))):
        t = TTFont(f)
        nombre = t["name"].getDebugName(1) or ""
        es_italica = "Italic" in (t["name"].getDebugName(2) or "")
        cmap = t.getBestCmap()
        if nombre.startswith(familia) and es_italica == italica and all(ord(c) in cmap for c in "AaÁáéíóúñÑ·"):
            return f
    raise SystemExit(f"falta la fuente {familia} {'itálica' if italica else ''} (¿se construyó la carta?)")

for dst, (fam, it) in {"cormorant.woff2": ("Cormorant Garamond", False),
                       "cormorant-italica.woff2": ("Cormorant Garamond", True),
                       "manrope.woff2": ("Manrope", False)}.items():
    shutil.copy(fuente(fam, it), os.path.join(OUT, "fonts", dst))


# ───────────── logotipo vectorizado ─────────────
# El PNG oficial trae la escalera de sus píxeles: se suaviza el alfa antes de
# trazarlo, así el contorno queda liso aunque la cámara entre por la «O».
def trazar_logo():
    al = np.array(Image.open(P("frontend/public/logo-eos.png")).convert("RGBA"))[..., 3].astype(float) / 255
    ys, xs = np.where(al > 0.5)
    x0, y0 = xs.min(), ys.min()
    PAD, S = 20, 8
    al = np.pad(al, PAD)
    grande = ndimage.zoom(ndimage.gaussian_filter(al, 1.6), S, order=3) > 0.5
    H = grande.shape[0]
    lab, n = ndimage.label(grande)
    tam = ndimage.sum(np.ones_like(grande), lab, range(1, n + 1))
    piezas = sorted((np.where(lab == k)[1].min(), k) for k in np.argsort(-tam)[:3] + 1)
    letras = {}
    with tempfile.TemporaryDirectory() as tmp:
        for L, (_, k) in zip("EOS", piezas):
            pbm, svg = os.path.join(tmp, L + ".pbm"), os.path.join(tmp, L + ".svg")
            Image.fromarray(np.where(lab == k, 0, 255).astype(np.uint8)).convert("1").save(pbm)
            subprocess.run(["potrace", "-s", "--flat", "-a", "1.3334", "-O", "1.5", "-t", "10", "-u", "10",
                            pbm, "-o", svg], check=True)
            letras[L] = leer_potrace(svg, H, S, PAD, x0, y0)
    return letras


def leer_potrace(fn, H, S, pad, x0, y0):
    """Subtrazos en coordenadas del logo (px del PNG oficial, origen en su esquina)."""
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
                if cmd == "m": nx, ny = nx + x, ny + y
                x, y = nx, ny
                if cur: sub.append(cur)
                cur = [[x, y]]
                cmd = "l" if cmd == "m" else "L"
            elif cmd in "Cc":
                v = [float(toks[i + k]) for k in range(6)]; i += 6
                if cmd == "c": v = [v[0] + x, v[1] + y, v[2] + x, v[3] + y, v[4] + x, v[5] + y]
                cur.append(v); x, y = v[4], v[5]
            else:
                v = [float(toks[i]), float(toks[i + 1])]; i += 2
                if cmd == "l": v = [v[0] + x, v[1] + y]
                # una recta como cúbica, para que todo el contorno sea del mismo tipo
                cur.append([x + (v[0] - x) / 3, y + (v[1] - y) / 3, x + 2 * (v[0] - x) / 3, y + 2 * (v[1] - y) / 3, *v])
                x, y = v
        if cur: sub.append(cur)
    f = lambda X, Y: (round(X / 10 / S - pad - x0, 2), round((H * 10 - Y) / 10 / S - pad - y0, 2))
    out = []
    for sp in sub:
        pts = [f(*sp[0])]
        for v in sp[1:]:
            pts += [f(v[j], v[j + 1]) for j in (0, 2, 4)]
        out.append([c for p in pts for c in p])   # [x0,y0, c1x,c1y, c2x,c2y, x,y, …]
    return out


def nucleo(sps, ancho, alto, Z=4):
    """El punto más hondo de la letra (centro del mayor círculo inscrito): ahí apunta la cámara."""
    from PIL import ImageDraw
    img = Image.new("L", (ancho * Z + 40, alto * Z + 40), 0)
    d = ImageDraw.Draw(img)
    for k, sp in enumerate(sps):
        pts = [(sp[0], sp[1])]
        for i in range(2, len(sp), 6):
            p0, c1, c2, p3 = (np.array(pts[-1]), np.array(sp[i:i + 2]), np.array(sp[i + 2:i + 4]), np.array(sp[i + 4:i + 6]))
            for t in np.linspace(0, 1, 10)[1:]:
                pts.append(tuple((1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t * t * c2 + t ** 3 * p3))
        d.polygon([(x * Z + 20, y * Z + 20) for x, y in pts], fill=255 if k == 0 else 0)
    dt = ndimage.distance_transform_edt(np.array(img) > 127)
    iy, ix = np.unravel_index(np.argmax(dt), dt.shape)
    return [round((ix - 20) / Z, 2), round((iy - 20) / Z, 2), round(dt.max() / Z, 2)]


letras = trazar_logo()
al = np.array(Image.open(P("frontend/public/logo-eos.png")).convert("RGBA"))[..., 3]
ys, xs = np.where(al > 127)
logo = {"ancho": int(xs.max() - xs.min() + 1), "alto": int(ys.max() - ys.min() + 1), "letras": letras}
logo["nucleo"] = {L: nucleo(v, logo["ancho"], logo["alto"]) for L, v in letras.items()}
with open(os.path.join(OUT, "logo.js"), "w") as f:
    f.write("window.LOGO = " + json.dumps(logo, separators=(",", ":")) + ";\n")
print("logo:", {L: [len(s) // 6 for s in v] for L, v in letras.items()}, "segmentos")


# ───────────── hojas de la casa ─────────────
# La monstera y la palma de la portada, recortadas del fondo blanco.
hojas = np.array(Image.open(P("frontend/public/hoja-monstera.jpg")).convert("RGB")).astype(float)
r, g, b = hojas[..., 0], hojas[..., 1], hojas[..., 2]
blanco = np.minimum(np.minimum(r, g), b)
verde = g - (r + b) / 2
alfa = np.clip((245 - blanco) / 55, 0, 1) * np.clip(verde / 18 + 0.25, 0, 1)
alfa = ndimage.gaussian_filter(np.maximum(alfa, ndimage.binary_erosion(alfa > 0.5, iterations=2)), 0.7)
lab, n = ndimage.label(alfa > 0.2)
tam = ndimage.sum(np.ones_like(alfa), lab, range(1, n + 1))
alfa[(lab > 0) & ~np.isin(lab, np.argsort(-tam)[:2] + 1)] = 0
rgba = np.dstack([hojas, np.clip(alfa, 0, 1) * 255]).astype(np.uint8)
hoja = Image.fromarray(rgba, "RGBA")
hoja.crop(hoja.getbbox()).save(os.path.join(OUT, "hojas.png"))


# ───────────── carta publicada ─────────────
def leer_carta():
    if os.environ.get("CARTA_JSON"):
        return json.load(open(os.environ["CARTA_JSON"]))
    req = urllib.request.Request(CARTA_URL, headers={"Accept": "application/json",
                                                     "User-Agent": "eos-pantalla/1.0"})
    with urllib.request.urlopen(req, timeout=150) as r:
        return json.load(r)


carta = leer_carta()
print("carta publicada:", carta.get("actualizadaEn"))
productos = {}
for c in carta["categorias"]:
    for p in c["productos"]:
        if p.get("disponible", True) and (p.get("imagenUrl") or "").startswith("https://"):
            productos[p["slug"]] = {**p, "categoria": c["slug"]}

ACENTOS = {"maracuya": "maracuyá", "cafe": "café", "platano": "plátano", "arandano": "arándano",
           "pina": "piña", "limon": "limón", "lucuma": "lúcuma"}

def sabor(nombre):
    """«Milkshake  de Cafe» → «Café»: el sabor, sin la categoría y con sus tildes."""
    n = " ".join(nombre.split())
    n = re.sub(r"^(milkshake|soda italiana|soda|frozen|batido|jugo)( de)?\s+", "", n, flags=re.I)
    palabras = []
    for w in n.split():
        base = unicodedata.normalize("NFD", w.lower()).encode("ascii", "ignore").decode()
        palabras.append(ACENTOS.get(base, w) if w.lower() == base else w)
    n = " ".join(p if p.lower() in ("de", "del", "con", "y") else p[:1].upper() + p[1:] for p in palabras)
    return n[:1].upper() + n[1:]

ROTULO = {"gelatos": "Gelato", "sorbetes": "Sorbete", "milkshakes": "Milkshake", "sodas-italianas": "Soda italiana",
          "frozen": "Frozen", "batidos-con-proteina": "Batido", "jugos-naturales": "Jugo natural"}

# Encuadre de cada foto: `foco` es el punto que queda al centro del arco.
ENCUADRE = {
    "maracuya": {"foco": [0.52, 0.47], "zoom": 1.0},
    "gelato-frutos-rojos": {"foco": [0.53, 0.47], "zoom": 1.0},
    "cacao-chuncho": {"foco": [0.47, 0.5], "zoom": 1.0},
    "avellana-piamonte": {"foco": [0.52, 0.47], "zoom": 1.0},
    "coco": {"foco": [0.5, 0.5], "zoom": 1.0},
    "cafe-de-altura": {"foco": [0.5, 0.5], "zoom": 1.0},
    "sorbete-mango": {"foco": [0.5, 0.52], "zoom": 1.0},
    "aguaymanto": {"foco": [0.45, 0.5], "zoom": 1.0},
    "frutilla-con-naranja": {"foco": [0.52, 0.5], "zoom": 1.0},
    "sorbete-pina": {"foco": [0.5, 0.5], "zoom": 1.0},
}

def elegir(preferidos, categorias, cuantos):
    """Los preferidos que siguen publicados; si faltan, otros de las mismas categorías."""
    lista = [s for s in preferidos if s in productos]
    lista += [s for s, p in productos.items() if p["categoria"] in categorias and s not in lista]
    return lista[:cuantos]

def baja(slug, doble=False):
    dst = os.path.join(OUT, "fotos", slug + ".webp")
    if not os.path.exists(dst):
        req = urllib.request.Request(productos[slug]["imagenUrl"], headers={"User-Agent": "eos-pantalla/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(dst, "wb") as f:
            f.write(r.read())
    item = {"slug": slug, "nombre": sabor(productos[slug]["nombre"]),
            "rotulo": ROTULO.get(productos[slug]["categoria"], ""), "src": f"assets/fotos/{slug}.webp",
            **ENCUADRE.get(slug, {"foco": [0.5, 0.5], "zoom": 1.0})}
    if doble:
        # Lo que se ve más grande que el archivo se amplía con Lanczos y un toque de nitidez.
        im = Image.open(dst).convert("RGB")
        im2 = im.resize((im.width * 2, im.height * 2), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.8, 60, 2))
        im2.save(os.path.join(OUT, "fotos", slug + "@2x.webp"), quality=94)
        item["src2x"] = f"assets/fotos/{slug}@2x.webp"
    return item

vitrina = elegir(["maracuya", "gelato-frutos-rojos", "cacao-chuncho", "avellana-piamonte", "sorbete-mango",
                  "coco", "aguaymanto", "cafe-de-altura", "frutilla-con-naranja", "sorbete-pina"],
                 ["gelatos", "sorbetes"], 10)
bebidas = elegir(["milkshake-de-chocolate", "soda-maracuya", "frozen-frutos-rojos", "milkshake-de-mango",
                  "soda-frutos-rojos", "frozen-mango", "milkshake-de-cafe", "soda-mango", "frozen-maracuya",
                  "milkshake", "soda-de-naranja"],
                 ["milkshakes", "sodas-italianas", "frozen"], 10)
letras_fotos = elegir(["gelato-frutos-rojos", "maracuya", "cacao-chuncho"], ["gelatos", "sorbetes"], 3)
grandes = set(letras_fotos)
datos = {
    "letras": [baja(s, True) for s in letras_fotos],        # E, O, S (la O es la foto que se abre)
    "vitrina": [baja(s, s in grandes) for s in vitrina],
    "bebidas": [baja(s) for s in bebidas],
}
with open(os.path.join(OUT, "datos.js"), "w") as f:
    f.write("window.DATOS = " + json.dumps(datos, ensure_ascii=False, indent=1) + ";\n")
for k, v in datos.items():
    print(f"{k}: " + ", ".join(f"{x['nombre']} ({x['rotulo']})" for x in v))
