#!/usr/bin/env python3
"""Siluetas de cada retablo para armarlo en 3D: el contorno de la caja (entre bisagras) y de cada puerta,
como polígonos en coordenadas de textura normalizadas (u →, v ↑). Se agregan a assets/datos.js."""
import json, os, re
import numpy as np
from PIL import Image
from scipy import ndimage

AQUI = os.path.dirname(os.path.abspath(__file__))
ruta = os.path.join(AQUI, 'assets', 'datos.js')
D = json.loads(re.sub(r'^window.DATOS = |;\s*$', '', open(ruta).read()))


def perfil(m, x0, x1, n):
    """Bordes de arriba y de abajo de la máscara entre las columnas x0..x1 (muestras suavizadas)."""
    xs = np.linspace(x0, x1, n)
    top, bot = [], []
    for x in xs:
        xi = int(round(min(max(x, x0), x1)))
        lo, hi = max(xi - 2, 0), min(xi + 3, m.shape[1])
        col = m[:, lo:hi].any(1)
        ys = np.where(col)[0]
        if len(ys) == 0:
            top.append(np.nan); bot.append(np.nan); continue
        top.append(ys.min()); bot.append(ys.max() + 1)
    top = np.array(top, float); bot = np.array(bot, float)
    ok = ~np.isnan(top)
    top = np.interp(np.arange(n), np.where(ok)[0], top[ok]); bot = np.interp(np.arange(n), np.where(ok)[0], bot[ok])
    return xs, ndimage.median_filter(top, 3), ndimage.median_filter(bot, 3)


def simplificar(pts, tol):
    """Douglas-Peucker sobre una polilínea abierta."""
    pts = np.asarray(pts)
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    ab = b - a
    n = np.hypot(*ab) or 1
    d = np.abs(np.cross(ab, pts - a)) / n
    i = int(np.argmax(d))
    if d[i] > tol:
        return np.vstack([simplificar(pts[:i + 1], tol)[:-1], simplificar(pts[i:], tol)])
    return np.vstack([a, b])


for slug, p in D['productos'].items():
    if p.get('tipo') != 'retablo':
        continue
    im = Image.open(os.path.join(AQUI, p['src']))
    a = np.asarray(im.getchannel('A')).astype(np.float32) / 255
    m = ndimage.binary_opening(a > 0.5, iterations=2)
    H, W = m.shape
    bL, bR = p['bisagras']
    cols = np.where(m.any(0))[0]
    x0, x1 = cols[0], cols[-1] + 1
    out = {}
    for nombre, (u0, u1) in (('centro', (bL, bR)), ('izq', (x0, bL)), ('der', (bR, x1))):
        n = max(24, int((u1 - u0) / 6))
        xs, top, bot = perfil(m, u0 + 1, u1 - 1, n)
        xs[0], xs[-1] = u0, u1
        arriba = simplificar(np.c_[xs, top], 1.2)
        abajo = simplificar(np.c_[xs[::-1], bot[::-1]], 1.2)
        poli = np.vstack([arriba, abajo])
        out[nombre] = [[round(x / W, 5), round(1 - y / H, 5)] for x, y in poli]
    # alero: dónde la caja deja de ser rectangular (para la profundidad del techo)
    p['silueta'] = out
    print(f"{slug:24s} centro {len(out['centro'])} pts · izq {len(out['izq'])} · der {len(out['der'])}")

open(ruta, 'w').write('window.DATOS = ' + json.dumps(D, ensure_ascii=False) + ';\n')
