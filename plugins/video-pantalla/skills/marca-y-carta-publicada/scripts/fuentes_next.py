#!/usr/bin/env python3
"""Encuentra las fuentes de la marca en el build de Next.js (next/font las baja ahí) y las copia.

    python3 fuentes_next.py /ruta/al/repo --listar
    python3 fuentes_next.py /ruta/al/repo --copiar "Cormorant Garamond:normal=assets/fonts/display.woff2" \
        "Cormorant Garamond:italic=assets/fonts/display-italica.woff2" "Manrope:normal=assets/fonts/texto.woff2"

Busca en frontend/.next*/static/media y .next*/static/media. Elige el archivo que cubre español
(Á É Í Ó Ú Ñ ·): el subconjunto «latin» de Google Fonts. Si no hay build, construir la carta una vez
en local o pedir las fuentes (nunca bajarlas de sitios dudosos; Google Fonts es la fuente oficial).
"""
import argparse
import glob
import os
import shutil
from fontTools.ttLib import TTFont

ap = argparse.ArgumentParser()
ap.add_argument("repo")
ap.add_argument("--listar", action="store_true")
ap.add_argument("--copiar", nargs="*", default=[])
a = ap.parse_args()
archivos = sorted(set(glob.glob(os.path.join(a.repo, "**/.next*/static/media/*.woff2"), recursive=True)))
fuentes = []
for f in archivos:
    try:
        t = TTFont(f)
    except Exception:
        continue
    fam = t["name"].getDebugName(1) or ""
    italica = "Italic" in (t["name"].getDebugName(2) or "") or "Italic" in (t["name"].getDebugName(4) or "")
    cmap = t.getBestCmap() or {}
    es = all(ord(c) in cmap for c in "AaÁáÉéÍíÓóÚúÑñ·")
    ejes = [f"{x.axisTag} {x.minValue:g}-{x.maxValue:g}" for x in t["fvar"].axes] if "fvar" in t else []
    fuentes.append({"ruta": f, "familia": fam, "italica": italica, "espanol": es, "ejes": ejes, "glifos": len(cmap)})
if a.listar or not a.copiar:
    for x in fuentes:
        print(f"{'✓' if x['espanol'] else ' '} {x['familia']:<24} {'itálica' if x['italica'] else 'normal ':<8} {' '.join(x['ejes']):<14} {x['glifos']:>4} glifos  {os.path.basename(x['ruta'])}")
for pedido in a.copiar:
    clave, destino = pedido.split("=")
    fam, estilo = clave.split(":")
    cand = [x for x in fuentes if x["familia"].startswith(fam) and x["italica"] == (estilo == "italic") and x["espanol"]]
    if not cand:
        raise SystemExit(f"no encontré {fam} {estilo} con glifos de español")
    os.makedirs(os.path.dirname(destino) or ".", exist_ok=True)
    shutil.copy(cand[0]["ruta"], destino)
    print(f"{fam} {estilo} → {destino}")
