"""Prepara lo que «El retablo de los sabores» toma del repo y de la carta publicada.

Del repo sale la marca: el retablo (fotos del retablo cerrado y abierto, que se vuelven el modelo 3D y
sus hojas pintadas), el logotipo y la flor en vector y las fuentes. De la carta publicada salen los
productos: nombre, precio y la foto real, recortada con el recorte de sujeto de macOS (Vision, en
local, sin subir nada). La carta se lee una sola vez con GET, como el teléfono de un cliente, y se
guarda en carta.json.

    python3 prep.py /ruta/al/repo            # usa carta.json si existe; si no, la lee y la guarda
    python3 prep.py /ruta/al/repo --hoja     # además, hojas de contactos en previa/ para mirar
"""
import json
import os
import subprocess
import sys
import tempfile
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

REPO = sys.argv[1]
HOJA = "--hoja" in sys.argv
AQUI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(AQUI, "assets")
HERR = os.path.join(AQUI, "herramientas")
CARTA_JSON = os.environ.get("CARTA_JSON", os.path.join(AQUI, "carta.json"))
# La URL pública de la carta (GET /api/carta): sale de NEXT_PUBLIC_API_URL en el workflow de deploy del repo.
CARTA_URL = os.environ.get("CARTA_URL", "")
sys.path.insert(0, HERR)
from leer_carta import leer, productos, con_foto  # noqa: E402

P = lambda *a: os.path.join(REPO, *a)
for d in ("", "productos", "retablo", "motivos", "fonts"):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
os.makedirs(os.path.join(AQUI, "previa"), exist_ok=True)

# ───────────────────────── la carta en tarjetas ─────────────────────────
# Doce tarjetas de dos compases. Cada producto es una lista de preferidos (slug): si ninguno sigue
# publicado y con foto, se rellena con el primero disponible de la categoría. `nombre` vacío = el de
# la carta. `plato`: la foto tiene el plato cortado por el borde (izq/der) y se recorta como elipse
# un poco más angosta (ver `recorte_plato`).
TARJETAS = [
    {"id": "clasica", "rotulo": "Crepes salados", "productos": [
        {"slugs": ["crepe-lliqlla", "crepe-hawaiana"], "cat": "crepes-salados", "desc": "Jamón, mozzarella y salsa golf"}]},
    {"id": "salados", "rotulo": "Crepes salados", "productos": [
        {"slugs": ["crepe-hawaiana", "crepe-americana"], "cat": "crepes-salados"},
        {"slugs": ["crepe-danzante", "crepe-americana"], "cat": "crepes-salados"}]},
    {"id": "autor", "rotulo": "Crepes de autor", "productos": [
        {"slugs": ["green-crep"], "cat": "crepes-de-colores"},
        {"slugs": ["crepa-arcoiris"], "cat": "crepes-de-colores", "plato": True}]},
    {"id": "dulces", "rotulo": "Crepes dulces", "productos": [
        {"slugs": ["mega-crepa"], "cat": "crepes-dulces", "foto": True},
        {"slugs": ["crepa-tropical"], "cat": "crepes-dulces", "foto": True},
        {"slugs": ["crepa-fresa", "crepes-primaveral"], "cat": "crepes-dulces", "foto": True}]},
    {"id": "promo", "rotulo": "Promoción", "productos": [
        {"slugs": ["promo-banana-crep", "banana-crepa"], "cat": "crepes-dulces", "nombre": "Banana Crep",
         "desc": "Plátano y leche condensada"}]},
    {"id": "cafe", "rotulo": "Café de altura", "productos": [
        {"slugs": ["capuccino-chantilly"], "cat": "bebidas-calientes"},
        {"slugs": ["mocaccino", "chocolate-caliente"], "cat": "bebidas-calientes"}]},
    {"id": "postres", "rotulo": "Postres de la casa", "productos": [
        {"slugs": ["torta-de-chocolate"], "cat": "postres", "nombre": "Torta Matilda"},
        {"slugs": ["red-velvet", "carrot-cake"], "cat": "postres", "nombre": "Red Velvet"}]},
    {"id": "chapla", "rotulo": "Sabor ayacuchano", "productos": [
        {"slugs": ["chapla-chancho-caja-china"], "cat": "sandwiches", "nombre": "Chapla de chancho",
         "desc": "a la caja china"},
        {"slugs": ["chapla-pollo-deshilachado"], "cat": "sandwiches", "nombre": "Chapla de pollo",
         "desc": "deshilachado"}]},
    {"id": "milkshakes", "rotulo": "Milkshakes", "productos": [
        {"slugs": ["milkshake-fresa"], "cat": "milkshakes", "nombre": "Fresa"},
        {"slugs": ["milkshake-choco-sublime"], "cat": "milkshakes", "nombre": "Choco Sublime"},
        {"slugs": ["milkshake-muyuchi", "milkshake-quinua"], "cat": "milkshakes", "nombre": "Muyuchi"}]},
    {"id": "frappes", "rotulo": "Frappés", "productos": [
        {"slugs": ["frappe-moca"], "cat": "frappes", "nombre": "Moca"},
        {"slugs": ["frappe-oreo"], "cat": "frappes", "nombre": "Oreo"},
        {"slugs": ["frappe-menta", "frappe-fresa"], "cat": "frappes", "nombre": "Menta"}]},
    {"id": "copas", "rotulo": "Helados artesanales", "productos": [
        {"slugs": ["copa-kids"], "cat": "helados"},
        {"slugs": ["copa-plim-plim"], "cat": "helados"}]},
    {"id": "split", "rotulo": "Helados artesanales", "productos": [
        {"slugs": ["banana-split"], "cat": "helados"},
        {"slugs": ["copa-oreo"], "cat": "helados"}]},
]

CONECTORES = {"de", "del", "con", "y", "a", "al", "en", "la", "las", "el", "los"}


def nombre_limpio(n):
    pal = " ".join(n.split()).split(" ")
    pal = [p if (i and p.lower() in CONECTORES) else p[:1].upper() + p[1:] for i, p in enumerate(pal)]
    return " ".join(pal)


def precio(p):
    ts = [t for t in p.get("tamanos", []) if t.get("disponible", True)] or p.get("tamanos", [])
    c = ts[0]["precioCentimos"]
    return f"{c // 100}" if c % 100 == 0 else f"{c / 100:.2f}"


# ───────────────────────── carta publicada (solo lectura) ─────────────────────────
if os.path.exists(CARTA_JSON):
    carta = leer(ruta_json=CARTA_JSON)
else:
    if not CARTA_URL:
        sys.exit("Falta la carta: CARTA_URL=https://<api-publica>/api/carta python3 prep.py … (o un carta.json)")
    carta = leer(url=CARTA_URL)
    json.dump(carta, open(CARTA_JSON, "w", encoding="utf-8"), ensure_ascii=False)
print("carta publicada:", carta.get("actualizadaEn"))
pub = {p["slug"]: p for p in productos(carta) if con_foto(p)}

# ───────────────────────── recorte de sujeto (Vision, local) ─────────────────────────
VISION = os.path.join(HERR, "mascara_vision")
if not os.path.exists(VISION):
    subprocess.run(["swiftc", "-O", os.path.join(HERR, "mascara_vision.swift"), "-o", VISION], check=True)


def foto_local(p):
    dst = os.path.join(AQUI, "fotos", p["slug"] + ".webp")
    if not os.path.exists(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        urllib.request.urlretrieve(p["imagenUrl"], dst)       # la URL publicada, tal cual (GET)
    return dst


def mascara(slug, ruta):
    dst = os.path.join(AQUI, "recortes", "mascaras", slug + ".png")
    if not os.path.exists(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        subprocess.run([VISION, ruta, dst], check=True, capture_output=True)
    a = np.array(Image.open(dst)).astype(np.float32)
    return a / (65535.0 if a.max() > 255 else 255.0)


def sangrar(rgb, alfa, umbral=0.94):
    """El color de cada píxel poco opaco pasa a ser el del interior más cercano (sin halos ni negro)."""
    solido = alfa > umbral
    if not solido.any():
        return rgb
    _, (iy, ix) = ndimage.distance_transform_edt(~solido, return_indices=True)
    return rgb[iy, ix]


def recorte_plato(alfa, lados):
    """Plato cortado por el borde de la foto: elipse ajustada al borde visible del plato y recortada un
    poco más angosta, para que el plato termine redondo en vez de en un lado recto. Solo se toca la
    franja de los costados (lo de arriba, como la crema de la Arcoíris, queda igual)."""
    h, w = alfa.shape
    m = alfa > 0.5
    borde = m & ~ndimage.binary_erosion(m, iterations=2)
    ys, xs = np.nonzero(borde)
    ok = (xs > 10) & (xs < w - 11)
    xs, ys = xs[ok].astype(np.float64), ys[ok].astype(np.float64)
    sel = np.ones(len(xs), bool)
    for _ in range(8):           # ajuste robusto: A x² + B y² + C x + D y = 1, descartando lo que sobresale
        X = np.stack([xs[sel] ** 2, ys[sel] ** 2, xs[sel], ys[sel]], 1)
        A, B, C, D = np.linalg.lstsq(X, np.ones(sel.sum()), rcond=None)[0]
        cx, cy = -C / (2 * A), -D / (2 * B)
        k = 1 + C * C / (4 * A) + D * D / (4 * B)
        rx, ry = np.sqrt(k / A), np.sqrt(k / B)
        r = np.sqrt(((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2)
        sel = np.abs(r - 1) < max(0.012, np.percentile(np.abs(r - 1), 70))
    margen = 7
    rx2 = min(rx, (cx - margen) if "izq" in lados else rx, (w - 1 - margen - cx) if "der" in lados else rx)
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt(((xx - cx) / rx2) ** 2 + ((yy - cy) / ry) ** 2)
    dentro = np.clip((1 - d) * min(rx2, ry) / 1.6 + 0.5, 0, 1)       # borde suave de ~1,6 px
    franja = np.clip((np.abs(xx - cx) / rx2 - 0.55) / 0.12, 0, 1)    # solo los costados
    nuevo = alfa * (1 - franja + franja * dentro)
    # El canto del plato: una sombra fina por dentro del borde nuevo, donde antes estaba el corte.
    canto = np.clip(1 - (1 - d) * min(rx2, ry) / 9, 0, 1) * franja * (d < 1)
    print(f"      plato: elipse {rx:.0f}×{ry:.0f} → {rx2:.0f} (centro {cx:.0f},{cy:.0f})")
    return nuevo, canto


def foto_doble(slug, ruta):
    """Foto completa (para un arco): @2x con Lanczos y nitidez suave."""
    im = Image.open(ruta).convert("RGB")
    d = im.resize((im.width * 2, im.height * 2), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.6, 55, 2))
    d.save(os.path.join(OUT, "productos", slug + "-foto.jpg"), quality=92)
    return {"w": d.width, "h": d.height, "foto": True}


def recortar(slug, ruta, plato=False):
    """Foto → recorte RGBA @2x con el color sangrado hacia afuera, su sombra y sus medidas."""
    alfa = mascara(slug, ruta)
    im = np.array(Image.open(ruta).convert("RGB")).astype(np.float32)
    if alfa.shape != im.shape[:2]:
        alfa = np.array(Image.fromarray((alfa * 255).astype(np.uint8)).resize((im.shape[1], im.shape[0]), Image.LANCZOS)) / 255.0
    h0, w0 = alfa.shape
    canto = np.zeros_like(alfa)
    if plato:
        b = 4
        lados = [k for k, v in {"izq": alfa[:, :b].max(), "der": alfa[:, -b:].max()}.items() if v > 0.5]
        if lados:
            alfa, canto = recorte_plato(alfa, lados)
    # Filo limpio: los píxeles semitransparentes traen el fondo del local; toman el color del interior
    # más cercano y se mezclan con el original solo donde el alfa ya es alto.
    interior = sangrar(im, alfa)
    wgt = np.clip((alfa - 0.55) / 0.4, 0, 1)[..., None]
    wgt = wgt * wgt * (3 - 2 * wgt)
    limpio = interior * (1 - wgt) + im * wgt
    limpio *= (1 - 0.16 * canto[..., None])
    ys, xs = np.where(alfa > 0.04)
    pad = int(0.03 * max(h0, w0))
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, w0)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, h0)
    rgb, a = limpio[y0:y1, x0:x1], alfa[y0:y1, x0:x1]
    # @2x: Lanczos sobre color premultiplicado, nitidez suave, y de nuevo sangrado hacia afuera.
    H, W = rgb.shape[0] * 2, rgb.shape[1] * 2
    pm = np.dstack([rgb * a[..., None], a[..., None] * 255]).round().clip(0, 255).astype(np.uint8)
    g = np.array(Image.fromarray(pm, "RGBA").resize((W, H), Image.LANCZOS)).astype(np.float32)
    a2 = g[..., 3] / 255
    rgb2 = g[..., :3] / np.maximum(a2[..., None], 1e-3)
    rgb2 = sangrar(np.clip(rgb2, 0, 255), a2, 0.9)
    rgb2 = np.array(Image.fromarray(rgb2.round().clip(0, 255).astype(np.uint8)).filter(ImageFilter.UnsharpMask(1.6, 50, 2))).astype(np.float32)
    rgba = np.dstack([rgb2, a2 * 255]).round().clip(0, 255).astype(np.uint8)
    base = os.path.join(OUT, "productos", slug)
    Image.fromarray(rgba, "RGBA").save(base + ".png", optimize=False, compress_level=6)
    # Sombra: el alfa desenfocado a un cuarto (es borrosa igual).
    s = Image.fromarray((a * 255).astype(np.uint8)).resize((max(8, a.shape[1] // 2), max(8, a.shape[0] // 2)), Image.LANCZOS)
    s = s.filter(ImageFilter.GaussianBlur(max(2, s.height * 0.02)))
    s.save(base + "-sombra.png")
    # Medidas en px del @2x: caja del objeto, línea de apoyo (donde toca la mesa) y su centro.
    m = a2 > 0.5
    ys, xs = np.nonzero(m)
    filas = np.nonzero(m.any(1))[0]
    apoyo = int(filas.max())
    cols = np.nonzero(m[max(0, apoyo - 6):apoyo + 1].any(0))[0]
    return {"w": W, "h": H, "caja": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
            "apoyo": apoyo, "apoyoX": int((cols.min() + cols.max()) / 2)}


# ───────────────────────── productos de cada tarjeta ─────────────────────────
usados = set()
tarjetas = []
for T in TARJETAS:
    ps = []
    for pz in T["productos"]:
        cands = [s for s in pz["slugs"] if s in pub and s not in usados]
        cands += [s for s, p in pub.items() if p.get("categoria") == pz["cat"] and s not in usados and s not in cands]
        if not cands:
            print("  (sin producto para", pz["slugs"], ")")
            continue
        slug = cands[0]
        usados.add(slug)
        p = pub[slug]
        med = foto_doble(slug, foto_local(p)) if pz.get("foto") else recortar(slug, foto_local(p), plato=pz.get("plato", False))
        nombre = pz.get("nombre") or nombre_limpio(p["nombre"])
        ps.append({"slug": slug, "nombre": nombre, "precio": precio(p), "desc": pz.get("desc", ""),
                   "src": f"assets/productos/{slug}-foto.jpg" if med.get("foto") else f"assets/productos/{slug}.png",
                   "sombra": f"assets/productos/{slug}-sombra.png", **med})
        print(f"  {T['id']:11s} {slug:28s} S/ {precio(p):>5s}  {med['w']}×{med['h']}  {nombre}")
    tarjetas.append({"id": T["id"], "rotulo": T["rotulo"], "productos": ps})

DATOS = {"tarjetas": tarjetas, "carta": carta.get("actualizadaEn"),
         "negocio": {"nombre": "Sabor a Retablo", "instagram": carta.get("negocio", {}).get("instagram", "@saboraretablo"),
                     "direccion": carta.get("negocio", {}).get("direccion", ""),
                     "lema": "Momentos que se disfrutan,", "lemaAcento": "recuerdos que se quedan."}}
with open(os.path.join(OUT, "datos.js"), "w", encoding="utf-8") as f:
    f.write("// Escrito por prep.py desde la carta publicada (solo lectura). No editar a mano.\n")
    f.write("window.DATOS = " + json.dumps(DATOS, ensure_ascii=False, indent=1) + ";\n")

if HOJA:
    cel = 520
    todos = [p for t in tarjetas for p in t["productos"] if not p.get("foto")]
    cols = 6
    hoja = Image.new("RGB", (cols * cel, ((len(todos) + cols - 1) // cols) * cel), (40, 40, 40))
    fondos = [(47, 147, 168), (13, 59, 43), (233, 128, 110), (227, 176, 75)]
    for i, p in enumerate(todos):
        im = Image.open(os.path.join(AQUI, p["src"]))
        im.thumbnail((cel - 20, cel - 20), Image.LANCZOS)
        c = Image.new("RGB", (cel, cel), fondos[i % 4])
        c.paste(im, ((cel - im.width) // 2, (cel - im.height) // 2), im)
        hoja.paste(c, ((i % cols) * cel, (i // cols) * cel))
    hoja.save(os.path.join(AQUI, "previa", "hoja-productos.jpg"), quality=86)
    print("hoja:", os.path.join(AQUI, "previa", "hoja-productos.jpg"))
