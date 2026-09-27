#!/usr/bin/env python3
"""Lee la carta PUBLICADA (solo GET, como el teléfono de un cliente), lista lo que hay y baja fotos.

    # 1) leer una vez y guardar (el plan gratis de Render tarda ~1 min en despertar)
    python3 leer_carta.py --url https://<api-publica>/api/carta --guardar carta.json
    # 2) ver categorías y productos: disponible, con foto o sin foto
    python3 leer_carta.py --json carta.json --listar
    # 3) bajar fotos (todas o las elegidas) y armar una hoja de contactos para elegir con los ojos
    python3 leer_carta.py --json carta.json --bajar fotos --todas --hoja fotos/hoja.jpg
    python3 leer_carta.py --json carta.json --bajar assets/fotos --slugs maracuya cacao-chuncho

Nunca escribe nada en producción: no usa POST/PUT/PATCH/DELETE, no manda cookies ni tokens.
Importable: `from leer_carta import productos, sabor` para elegir y nombrar desde prep.py.
"""
import argparse
import json
import os
import re
import sys
import unicodedata
import urllib.request

AGENTE = "pantalla-local/1.0 (lectura de la carta publica)"


def leer(url=None, ruta_json=None):
    if ruta_json:
        return json.load(open(ruta_json, encoding="utf-8"))
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": AGENTE}, method="GET")
    with urllib.request.urlopen(req, timeout=150) as r:
        return json.load(r)


def productos(carta, solo_disponibles=True):
    """Lista plana: {categoria, categoriaNombre, slug, nombre, disponible, imagenUrl, …} por producto.

    Entiende la forma {categorias: [{slug, nombre, productos: [...]}]} y, si no, recorre el JSON
    buscando objetos con 'nombre' e 'imagenUrl'.
    """
    out = []
    if isinstance(carta, dict) and isinstance(carta.get("categorias"), list):
        for c in carta["categorias"]:
            for p in c.get("productos", []):
                out.append({**p, "categoria": c.get("slug") or c.get("nombre"), "categoriaNombre": c.get("nombre")})
    else:
        def andar(x, cat=None):
            if isinstance(x, dict):
                if "nombre" in x and "imagenUrl" in x:
                    out.append({**x, "categoria": cat})
                for k, v in x.items():
                    andar(v, x.get("slug", cat) if isinstance(x.get("slug"), str) else cat)
            elif isinstance(x, list):
                for v in x:
                    andar(v, cat)
        andar(carta)
    if solo_disponibles:
        out = [p for p in out if p.get("disponible", True)]
    return out


def con_foto(p):
    return isinstance(p.get("imagenUrl"), str) and p["imagenUrl"].startswith("https://")


ACENTOS = {"maracuya": "maracuyá", "cafe": "café", "platano": "plátano", "arandano": "arándano", "pina": "piña",
           "limon": "limón", "lucuma": "lúcuma", "azucar": "azúcar", "jamon": "jamón", "tipico": "típico"}
CONECTORES = ("de", "del", "con", "y", "a", "al", "en", "la", "las", "el", "los")


def sabor(nombre, prefijos=("milkshake", "soda italiana", "soda", "frozen", "batido", "jugo")):
    """«Milkshake  de Cafe» → «Café»: quita la categoría del nombre, repone tildes y ordena mayúsculas."""
    n = " ".join(nombre.split())
    patron = r"^(" + "|".join(re.escape(p) for p in prefijos) + r")( de)?\s+"
    n = re.sub(patron, "", n, flags=re.I)
    palabras = []
    for w in n.split():
        base = unicodedata.normalize("NFD", w.lower()).encode("ascii", "ignore").decode()
        palabras.append(ACENTOS.get(base, w) if w.lower() == base else w)
    n = " ".join(p if p.lower() in CONECTORES else p[:1].upper() + p[1:] for p in palabras)
    return n[:1].upper() + n[1:]


def bajar(p, carpeta):
    os.makedirs(carpeta, exist_ok=True)
    ext = os.path.splitext(p["imagenUrl"].split("?")[0])[1] or ".jpg"
    destino = os.path.join(carpeta, p["slug"] + ext)
    if not os.path.exists(destino):
        req = urllib.request.Request(p["imagenUrl"], headers={"User-Agent": AGENTE})
        with urllib.request.urlopen(req, timeout=60) as r, open(destino, "wb") as f:
            f.write(r.read())
    return destino


def hoja(rutas, salida, cols=5, lado=380):
    from PIL import Image, ImageDraw, ImageFont
    fuentes = ["/System/Library/Fonts/Supplemental/Arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    f = next((ImageFont.truetype(x, 17) for x in fuentes if os.path.exists(x)), ImageFont.load_default())
    filas = (len(rutas) + cols - 1) // cols
    H = Image.new("RGB", (cols * lado, filas * (lado + 30)), (30, 30, 30))
    d = ImageDraw.Draw(H)
    for i, r in enumerate(rutas):
        im = Image.open(r).convert("RGB")
        im.thumbnail((lado, lado))
        x, y = (i % cols) * lado, (i // cols) * (lado + 30)
        H.paste(im, (x + (lado - im.width) // 2, y))
        d.text((x + 4, y + lado + 4), os.path.basename(r)[:40], fill=(255, 255, 255), font=f)
    H.save(salida, quality=88)
    return salida


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--url")
    ap.add_argument("--json")
    ap.add_argument("--guardar")
    ap.add_argument("--listar", action="store_true")
    ap.add_argument("--bajar")
    ap.add_argument("--slugs", nargs="*")
    ap.add_argument("--todas", action="store_true")
    ap.add_argument("--hoja")
    a = ap.parse_args()
    if not (a.url or a.json):
        sys.exit("Falta --url (la carta publicada, solo lectura) o --json (una copia ya leída)")
    carta = leer(a.url, a.json)
    if a.guardar:
        json.dump(carta, open(a.guardar, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("guardada en", a.guardar, "·", carta.get("actualizadaEn", "") if isinstance(carta, dict) else "")
    ps = productos(carta)
    if a.listar or not (a.bajar or a.guardar):
        cat = None
        for p in ps:
            if p["categoria"] != cat:
                cat = p["categoria"]
                print(f"## {p.get('categoriaNombre') or cat}  [{cat}]")
            print(f"   {'📷' if con_foto(p) else '  '} {p['slug']:<40} {p['nombre']}")
        print(f"{len(ps)} productos disponibles · {sum(con_foto(p) for p in ps)} con foto publicada")
    if a.bajar:
        elegidos = [p for p in ps if con_foto(p) and (a.todas or (a.slugs and p["slug"] in a.slugs))]
        rutas = [bajar(p, a.bajar) for p in elegidos]
        for r in rutas:
            print("  ", r)
        if a.hoja and rutas:
            print("hoja:", hoja(rutas, a.hoja))
