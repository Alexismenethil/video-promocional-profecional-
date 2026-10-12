#!/usr/bin/env python3
"""Activos del video de La Casa del Retablo, desde el catálogo 2025 (PDF) y las fotos de la casa.

    python3 prep.py <carpeta-catalogo-extraido> <carpeta-fotos>

- Recortes del catálogo (imagen + máscara suave del PDF, ya combinadas en <catalogo>/rgba/): se limpia
  la sombra que traen pegada (alfa bajo), se corrige la marca de agua de celular de algunas fotos, se
  «sangra» el color hacia lo transparente (sin halos al ampliar) y se amplían para 4K (Lanczos + nitidez).
- Retablos: se buscan las bisagras (las rendijas entre puertas y caja) para armarlos en 3D.
- Decoración: toritos, jarrones y gallinas se separan uno por uno; los espejos llevan la máscara del vidrio.
- Fotos de la casa: a 4096 px, con la máscara del sujeto (Vision) para el paralaje.
- Logo: vectorizado por color con potrace (letras y techo, pétalos rojos, verdes, disco naranja).
Escribe assets/prod, assets/sombra, assets/fotos, assets/datos.js y assets/logo.js.
"""
import json
import os
import re
import subprocess
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

AQUI = os.path.dirname(os.path.abspath(__file__))
CAT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, '..', 'catalogo')
FOTOS = sys.argv[2] if len(sys.argv) > 2 else os.path.expanduser('~/Downloads/Casa del Retablo')
OUT = os.path.join(AQUI, 'assets')
for d in ('prod', 'sombra', 'fotos'):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

# ───────────── tamaños y precios (catálogo 2025) ─────────────
TIERS = {
    't100': dict(medida='19 × 20 cm', alto=19, ancho=20, precio=100),
    't160': dict(medida='15 × 30 cm', alto=15, ancho=30, fondo=7, precio=160),
    't200': dict(medida='22 × 32 cm', alto=22, ancho=32, precio=200),
    't200b': dict(medida='26 × 32 cm', alto=26, ancho=32, precio=200),
    't250': dict(medida='27 × 36 cm', alto=27, ancho=36, precio=250),
    't500': dict(medida='37 × 48 cm', alto=37, ancho=48, precio=500),
    't500n': dict(medida='35 × 48 cm', alto=35, ancho=48, precio=500),
    't700': dict(medida='32 × 45 cm', alto=45, ancho=32, precio=700),
    't750': dict(medida='50 × 40 cm', alto=50, ancho=40, precio=750),
    't1300': dict(medida='50 × 66 cm', alto=50, ancho=66, precio=1300),
    't500w': dict(medida='30 × 60 cm', alto=30, ancho=60, precio=500),
    't60': dict(medida='16 cm', alto=16, ancho=24, precio=60),
    't180': dict(medida='26 × 40 cm', alto=26, ancho=40, precio=180),
}

# slug: (imagen del catálogo, nombre, tier, tipo, marca de agua)
R = 'retablo'
PRODUCTOS = {
    # 19 × 20 · S/ 100
    'carnaval-huam-100': ('p15_094', 'Carnaval huamanguino', 't100', R),
    'sombreros-huam-100': ('p15_096', 'Taller de sombreros', 't100', R),
    'cosecha-100': ('p16_100', 'Cosecha de maíz', 't100', R),
    'sombreros-rurales-100': ('p16_102', 'Sombreros rurales', 't100', R),
    'panaderia-100': ('p17_106', 'Panadería ayacuchana', 't100', R),
    'danzante-100': ('p17_108', 'Danzante de tijeras', 't100', R),
    'instrumentos-100': ('p19_124', 'Taller de instrumentos', 't100', R),
    'flores-100': ('p19_126', 'Venta de flores', 't100', R),
    'corazones-100': ('p20_132', 'Venta de corazones', 't100', R),
    # 15 × 30 · S/ 160
    'nacimiento-160': ('p03_018', 'Nacimiento andino', 't160', R),
    'gastronomia-160': ('p03_020', 'Gastronomía', 't160', R),
    'nac-cusqueno-160': ('p04_024', 'Nacimiento cusqueño', 't160', R),
    'chumbivilcas-160': ('p04_026', 'Chumbivilcas', 't160', R),
    'huaylash-160': ('p05_030', 'Huaylash', 't160', R),
    'techado-160': ('p05_032', 'Techado de casa', 't160', R),
    'sombreros-rurales-160': ('p06_036', 'Sombreros rurales', 't160', R),
    'yawar-chumbi-160': ('p06_038', 'Yawar Fiesta', 't160', R),
    'mascaras-160': ('p07_042', 'Taller de máscaras', 't160', R),
    'danzante-160': ('p07_044', 'Danzante de tijeras', 't160', R),
    'panaderia-cusco-160': ('p08_048', 'Panadería cusqueña', 't160', R),
    'panaderia-160': ('p08_050', 'Panadería ayacuchana', 't160', R),
    'marinera-160': ('p09_054', 'Marinera', 't160', R),
    'valicha-160': ('p09_056', 'Danza Valicha', 't160', R),
    'corazones-160': ('p10_060', 'Taller de corazones', 't160', R),
    'carnaval-rural-160': ('p10_062', 'Carnaval rural', 't160', R),
    'sombreros-huam-160': ('p11_066', 'Sombreros huamanguinos', 't160', R),
    'yawar-160': ('p11_068', 'Yawar Fiesta', 't160', R),
    'instrumentos-160': ('p12_072', 'Taller de instrumentos', 't160', R),
    'chullos-160': ('p12_074', 'Taller de chullos', 't160', R),
    'selva-160': ('p13_078', 'Danza de la selva', 't160', R),
    # 22 × 32 · S/ 200
    'danzante-200': ('p21_137', 'Danzante de tijeras', 't200', R, True),
    'nacimiento-200': ('p21_139', 'Nacimiento andino', 't200', R),
    'sombrero-rural-200': ('p22_142', 'Sombrero rural', 't200', R),
    'cosecha-200': ('p22_144', 'Cosecha de maíz', 't200', R),
    'semana-santa-200': ('p23_148', 'Semana Santa', 't200', R),
    'corazones-200': ('p23_150', 'Taller de corazones', 't200', R),
    'sombreros-huam-200': ('p24_158', 'Sombreros huamanguinos', 't200', R),
    # 26 × 32 · S/ 200
    'jarana-200b': ('p26_167', 'Jarana', 't200b', R),
    'nacimiento-200b': ('p26_169', 'Nacimiento andino', 't200b', R),
    'cosecha-200b': ('p27_173', 'Cosecha de maíz', 't200b', R, True),
    'marinera-200b': ('p27_175', 'Marinera norteña', 't200b', R),
    'mascaras-200b': ('p28_179', 'Taller de máscaras', 't200b', R),
    # 27 × 36 · S/ 250
    'instrumentos-250': ('p30_197', 'Taller de instrumentos', 't250', R, True),
    'nacimiento-250': ('p31_201', 'Nacimiento andino', 't250', R, True),
    'valicha-250': ('p32_203', 'Valicha cusqueña', 't250', R, True),
    'carnaval-rural-250': ('p33_206', 'Carnaval rural', 't250', R, True),
    'mascaras-250': ('p34_209', 'Taller de máscaras', 't250', R),
    'sombreros-250': ('p35_212', 'Sombreros huamanguinos', 't250', R),
    'semana-santa-250': ('p36_215', 'Semana Santa', 't250', R),
    'carnaval-huam-250': ('p37_218', 'Carnaval huamanguino', 't250', R),
    # 37 × 48 · S/ 500 (dos pisos)
    'nac-danzante-500': ('p38_221', 'Nacimiento y danzante de tijeras', 't500', R),
    'nac-jarana-500': ('p39_225', 'Nacimiento y jarana', 't500', R),
    'nacimiento-500': ('p42_241', 'Nacimiento andino', 't500n', R),
    # grandes
    'nacimiento-700': ('p43_244', 'Nacimiento andino', 't700', 'plano'),
    'espejo-750': ('p44_247', 'Espejo retablo', 't750', 'espejo'),
    'nac-carnaval-1300': ('p45_249', 'Nacimiento y carnaval huamanguino', 't1300', R),
    'nac-techado-1300': ('p46_255', 'Nacimiento y techado de casa', 't1300', R),
    'floreria-500': ('p48_266', 'Florería', 't500w', R),
    'panaderia-andina-500': ('p48_268', 'Panadería andina', 't500w', R),
    'nacimiento-60': ('p47_257', 'Nacimiento mini', 't60', R),
    'nacimiento-180': ('p47_259', 'Nacimiento andino', 't180', R),
    'personalizado': ('p57_369', 'Retablo personalizado', None, 'tarjeta'),
}
# decoración: (imagen, nombres por pieza de izquierda a derecha, precios, tipo)
DECOR = {
    'toritos': ('p50_282', ['Torito de Pucará'] * 4, [100, 55, 35, 75]),
    'jarrones': ('p50_280', ['Jarrón decorativo'] * 2, [60, 60]),
    'gallinas': ('p50_284', ['Gallina decorativa'] * 2, [100, 100]),
    'macetero': ('p50_286', ['Macetero decorativo'], [60]),
}
ESPEJOS = ['p51_289', 'p51_291', 'p51_293', 'p51_295', 'p51_297']
ANGELES = ['p52_299', 'p52_301', 'p52_303', 'p52_305', 'p52_307', 'p52_309', 'p52_311', 'p52_313', 'p52_315']


# ───────────── utilidades de imagen ─────────────
def cargar(nombre):
    return np.asarray(Image.open(os.path.join(CAT, 'rgba', nombre + '.png')).convert('RGBA')).astype(np.float32) / 255


def limpiar_alfa(a, umbral_obj=0.75, min_frac=0.01):
    """Quita la sombra suave pegada (alfa bajo) y las motas sueltas; conserva el borde suave del objeto."""
    obj = a > umbral_obj
    lab, n = ndimage.label(obj)
    if n == 0:
        return a
    areas = ndimage.sum(obj, lab, range(1, n + 1))
    keep = np.isin(lab, 1 + np.where(areas >= areas.max() * min_frac)[0])
    zona = ndimage.binary_dilation(keep, iterations=3)
    return np.clip((a - 0.5) / 0.4, 0, 1) * zona


def sangrar(rgb, a):
    """El color de lo opaco se extiende a lo transparente (sin halos oscuros al filtrar)."""
    lleno = a > 0.5
    if lleno.all():
        return rgb
    _, (iy, ix) = ndimage.distance_transform_edt(~lleno, return_indices=True)
    return rgb[iy, ix]


def recortar(rgba, pad_frac=0.03):
    a = rgba[..., 3]
    ys, xs = np.where(a > 0.02)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    h, w = y1 - y0, x1 - x0
    p = int(round(max(h, w) * pad_frac))
    out = np.zeros((h + 2 * p, w + 2 * p, 4), np.float32)
    out[p:p + h, p:p + w] = rgba[y0:y1, x0:x1]
    return out, p


def ampliar(rgba, lado_max, nitidez=True):
    h, w = rgba.shape[:2]
    f = lado_max / max(h, w)
    rgb = sangrar(rgba[..., :3], rgba[..., 3])
    im = Image.fromarray((np.dstack([rgb, rgba[..., 3]]) * 255 + 0.5).clip(0, 255).astype(np.uint8), 'RGBA')
    if abs(f - 1) > 0.02:
        im = im.resize((round(w * f), round(h * f)), Image.LANCZOS)
    if nitidez and f > 1.05:
        rgbI = im.convert('RGB').filter(ImageFilter.UnsharpMask(radius=1.2 * f, percent=55, threshold=2))
        al = im.getchannel('A')
        im = Image.merge('RGBA', (*rgbI.split(), al))
    return im, f


def guardar_sombra(im, slug):
    a = np.asarray(im.getchannel('A')).astype(np.float32) / 255
    k = 512 / max(a.shape)
    small = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((max(1, round(a.shape[1] * k)), max(1, round(a.shape[0] * k))), Image.LANCZOS)).astype(np.float32) / 255
    s = ndimage.gaussian_filter(small, sigma=max(small.shape) * 0.022)
    Image.fromarray((s * 255).clip(0, 255).astype(np.uint8), 'L').save(os.path.join(OUT, 'sombra', slug + '.png'))


def quitar_marca(rgba):
    """La marca de agua «Galaxy A55 5G» del celular (letras blancas abajo a la izquierda, sobre el marco
    negro y el pie de la puerta): se detectan las letras (más claras que su entorno) y se rellenan con los
    colores de alrededor, de lo chico a lo grande (empujar y tirar)."""
    a = rgba[..., 3]
    ys, xs = np.where(a > 0.5)
    y0o, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    zy0, zx1 = int(y1 - (y1 - y0o) * 0.085), int(x0 + (x1 - x0) * 0.24)
    sub = rgba[zy0:y1 + 1, x0:zx1, :3].copy()
    lum = sub.mean(-1)
    sat = sub.max(-1) - sub.min(-1)
    med = ndimage.median_filter(lum, size=31)
    texto = (lum > 0.72) & (sat < 0.22) & ((lum - med) > 0.04)
    texto &= a[zy0:y1 + 1, x0:zx1] > 0.5
    # solo trazos (no la puerta blanca entera): componentes chicas
    lab, n = ndimage.label(texto)
    if n:
        areas = ndimage.sum(texto, lab, range(1, n + 1))
        texto = np.isin(lab, 1 + np.where(areas < 0.02 * texto.size)[0])
    texto = ndimage.binary_dilation(texto, iterations=3)
    peso = (~texto).astype(np.float32)[..., None]
    lleno = sub.copy()
    hecho = ~texto
    for s in (1.5, 3, 6, 12, 24):
        num = ndimage.gaussian_filter(sub * peso, (s, s, 0))
        den = ndimage.gaussian_filter(peso, (s, s, 0))
        est = num / np.maximum(den, 1e-5)
        nuevo = (~hecho) & (den[..., 0] > 0.12)
        lleno[nuevo] = est[nuevo]
        hecho |= nuevo
    suave = ndimage.gaussian_filter(texto.astype(np.float32), 1.0)[..., None]
    rgba[zy0:y1 + 1, x0:zx1, :3] = sub * (1 - suave) + lleno * suave
    return rgba


def bisagras(a, x_off=0):
    """Rendijas verticales entre puerta y caja: columnas con poca cobertura dentro del objeto."""
    m = a > 0.5
    cols = np.where(m.any(0))[0]
    x0, x1 = cols[0], cols[-1]
    cov = m.sum(0).astype(np.float32)
    ref = np.median(cov[x0:x1 + 1][cov[x0:x1 + 1] > 0])
    bajo = cov < 0.35 * ref
    bajo[:x0 + 3] = False
    bajo[x1 - 2:] = False
    lab, n = ndimage.label(bajo)
    cand = []
    for i in range(1, n + 1):
        xs = np.where(lab == i)[0]
        c = (xs[0] + xs[-1]) / 2
        cand.append((c, xs[0], xs[-1]))
    W = x1 - x0
    def mejor(obj):
        cs = [c for c in cand if abs((c[0] - x0) / W - obj) < 0.16]
        return min(cs, key=lambda c: abs((c[0] - x0) / W - obj)) if cs else None
    izq, der = mejor(0.25), mejor(0.75)
    if izq is None or der is None:
        # sin rendija: el salto del borde de arriba (la caja es más alta que las puertas)
        top = np.array([np.argmax(m[:, x]) if m[:, x].any() else m.shape[0] for x in range(m.shape[1])], np.float32)
        d = np.abs(np.diff(ndimage.median_filter(top, 5)))
        def salto(lo, hi):
            lo, hi = int(x0 + lo * W), int(x0 + hi * W)
            return lo + int(np.argmax(d[lo:hi]))
        izq = izq or (salto(0.12, 0.40),) * 3
        der = der or (salto(0.60, 0.88),) * 3
    return [float(izq[0]), float(der[0])], [x0, x1]


def caja_de(a):
    ys, xs = np.where(a > 0.5)
    return [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]


# ───────────── productos ─────────────
datos = {'productos': {}, 'tiers': TIERS, 'decor': {}, 'fotos': {},
         'negocio': {'nombre': 'Casa del Retablo', 'firma': 'De Silvestre Ataucusi', 'whatsapp': os.environ.get('WHATSAPP', '<whatsapp>'),
                     'web': os.environ.get('WEB', '<web>')}}

LADO = {R: 2400, 'plano': 2400, 'espejo': 2200}
for slug, spec in PRODUCTOS.items():
    img, nombre, tier, tipo = spec[:4]
    marca = len(spec) > 4 and spec[4]
    rgba = cargar(img)
    if tipo != 'tarjeta':
        rgba[..., 3] = limpiar_alfa(rgba[..., 3])
    rgba, pad = recortar(rgba)
    if marca:
        rgba = quitar_marca(rgba)
    lado = LADO.get(tipo, 2400)
    src_max = max(rgba.shape[:2])
    im, f = ampliar(rgba, min(lado, src_max * 2.2))
    a = np.asarray(im.getchannel('A')).astype(np.float32) / 255
    info = {'nombre': nombre, 'tier': tier, 'tipo': tipo, 'src': f'assets/prod/{slug}.png', 'sombra': f'assets/sombra/{slug}.png',
            'w': im.width, 'h': im.height, 'caja': caja_de(a), 'escala': round(f, 3), 'fuente': img}
    if tier:
        info['precio'] = TIERS[tier]['precio']
        info['medida'] = TIERS[tier]['medida']
    c = info['caja']
    info['apoyo'] = c[3]
    info['apoyoX'] = (c[0] + c[2]) / 2
    if tipo == R:
        bs, (x0, x1) = bisagras(a)
        info['bisagras'] = [round(b, 1) for b in bs]
        # alto de la caja del centro (para la profundidad) y de cada puerta
        m = a > 0.5
        cen = m[:, int(bs[0]) + 2:int(bs[1]) - 1]
        ys = np.where(cen.any(1))[0]
        info['centro'] = [int(bs[0]), int(ys.min()), int(bs[1]), int(ys.max()) + 1]
        for lado_p, (u0, u1) in (('pIzq', (x0, int(bs[0]))), ('pDer', (int(bs[1]), x1 + 1))):
            sub = m[:, u0:u1]
            ys = np.where(sub.any(1))[0]
            info[lado_p] = [int(u0), int(ys.min()), int(u1), int(ys.max()) + 1]
    im.save(os.path.join(OUT, 'prod', slug + '.png'), optimize=False, compress_level=3)
    guardar_sombra(im, slug)
    datos['productos'][slug] = info
    print(f"{slug:26s} {img} {im.width}x{im.height} ×{f:.2f}" + (f"  bisagras {info['bisagras']}" if 'bisagras' in info else '') + ('  [marca]' if marca else ''))


# ───────────── decoración (piezas separadas) ─────────────
for clave, (img, nombres, precios) in DECOR.items():
    rgba = cargar(img)
    a = limpiar_alfa(rgba[..., 3], min_frac=0.02)
    lab, n = ndimage.label(a > 0.5)
    areas = ndimage.sum(a > 0.5, lab, range(1, n + 1))
    orden = np.argsort(-areas)[:len(nombres)]
    piezas = []
    for i in orden:
        sl = ndimage.find_objects((lab == i + 1).astype(int))[0]
        piezas.append((sl[1].start, i + 1))
    piezas.sort()
    lista = []
    for k, (_, li) in enumerate(piezas):
        zona = ndimage.binary_dilation(lab == li, iterations=3)
        pr = rgba.copy()
        pr[..., 3] = a * zona
        pr, _ = recortar(pr)
        slug = f'{clave}-{k + 1}'
        im, f = ampliar(pr, min(1400, max(pr.shape[:2]) * 2.2))
        aa = np.asarray(im.getchannel('A')).astype(np.float32) / 255
        c = caja_de(aa)
        im.save(os.path.join(OUT, 'prod', slug + '.png'))
        guardar_sombra(im, slug)
        datos['productos'][slug] = {'nombre': nombres[k], 'precio': precios[k], 'tipo': 'plano', 'src': f'assets/prod/{slug}.png',
                                    'sombra': f'assets/sombra/{slug}.png', 'w': im.width, 'h': im.height, 'caja': c,
                                    'apoyo': c[3], 'apoyoX': (c[0] + c[2]) / 2, 'escala': round(f, 3)}
        lista.append(slug)
        print(f"{slug:26s} {img} {im.width}x{im.height} ×{f:.2f}")
    datos['decor'][clave] = lista

# ───────────── espejos (con la máscara del vidrio) ─────────────
def mascara_vidrio(rgba):
    a = rgba[..., 3]
    h, w = a.shape
    # 1) hueco transparente encerrado por el marco
    vacio = a < 0.5
    lab, n = ndimage.label(vacio)
    borde = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    hueco = np.isin(lab, [i for i in range(1, n + 1) if i not in borde])
    if hueco.sum() > 0.02 * h * w:
        return hueco
    # 2) vidrio pintado de gris claro: región poco saturada y clara conectada al centro
    rgb = rgba[..., :3]
    sat = rgb.max(-1) - rgb.min(-1)
    claro = (rgb.mean(-1) > 0.62) & (sat < 0.10) & (a > 0.5)
    lab, n = ndimage.label(claro)
    c = lab[h // 2, w // 2]
    if c == 0:
        return np.zeros_like(a, bool)
    return ndimage.binary_fill_holes(lab == c)

esp_lista = []
for k, img in enumerate(ESPEJOS + ['p44_247']):
    slug = f'espejo-{k + 1}' if img != 'p44_247' else 'espejo-750'
    rgba = cargar(img)
    rgba[..., 3] = limpiar_alfa(rgba[..., 3])
    vid = mascara_vidrio(rgba)
    vid = ndimage.binary_dilation(vid, iterations=2)
    hh, ww = vid.shape
    yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float32)
    grad = 0.78 + 0.14 * (1 - yy / hh) + 0.05 * np.exp(-(((xx / ww) + (yy / hh) * 0.6 - 0.8) * 4) ** 2)
    vfl = ndimage.gaussian_filter(vid.astype(np.float32), 1.0)[..., None]
    rgba[..., :3] = rgba[..., :3] * (1 - vfl) + np.dstack([grad * 0.96, grad * 0.98, grad])[..., :3] * vfl
    rgba[..., 3] = np.maximum(rgba[..., 3], vid.astype(np.float32))
    full = np.dstack([rgba, vid.astype(np.float32)])
    ys, xs = np.where(full[..., 3] > 0.02)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    p = int(max(y1 - y0, x1 - x0) * 0.03)
    crop = np.zeros((y1 - y0 + 2 * p, x1 - x0 + 2 * p, 5), np.float32)
    crop[p:-p, p:-p] = full[y0:y1, x0:x1]
    im, f = ampliar(crop[..., :4], min(2200 if slug == 'espejo-750' else 1300, max(crop.shape[:2]) * 2.4))
    vm = Image.fromarray((crop[..., 4] * 255).astype(np.uint8), 'L').resize(im.size, Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2 * f))
    im.save(os.path.join(OUT, 'prod', slug + '.png'))
    vm.save(os.path.join(OUT, 'prod', slug + '-vidrio.png'))
    guardar_sombra(im, slug)
    aa = np.asarray(im.getchannel('A')).astype(np.float32) / 255
    c = caja_de(aa)
    info = {'nombre': 'Espejo decorativo', 'precio': 150, 'medida': '58 cm', 'tipo': 'espejo', 'src': f'assets/prod/{slug}.png',
            'vidrio': f'assets/prod/{slug}-vidrio.png', 'sombra': f'assets/sombra/{slug}.png', 'w': im.width, 'h': im.height,
            'caja': c, 'apoyo': c[3], 'apoyoX': (c[0] + c[2]) / 2, 'escala': round(f, 3)}
    if slug == 'espejo-750':
        info.update(datos['productos'].get('espejo-750', {}))
        info.update({'src': f'assets/prod/{slug}.png', 'vidrio': f'assets/prod/{slug}-vidrio.png', 'w': im.width, 'h': im.height,
                     'caja': c, 'apoyo': c[3], 'apoyoX': (c[0] + c[2]) / 2, 'tipo': 'espejo', 'nombre': 'Espejo retablo', 'precio': 750,
                     'medida': '50 × 40 cm'})
    else:
        esp_lista.append(slug)
    datos['productos'][slug] = info
    print(f"{slug:26s} {img} {im.width}x{im.height} ×{f:.2f} vidrio {vid.mean():.2f}")
datos['decor']['espejos'] = esp_lista

# ───────────── ángeles colgantes ─────────────
ang = []
for k, img in enumerate(ANGELES):
    slug = f'angel-{k + 1}'
    rgba = cargar(img)
    rgba[..., 3] = limpiar_alfa(rgba[..., 3])
    rgba, _ = recortar(rgba)
    im, f = ampliar(rgba, 980)
    aa = np.asarray(im.getchannel('A')).astype(np.float32) / 255
    c = caja_de(aa)
    im.save(os.path.join(OUT, 'prod', slug + '.png'))
    guardar_sombra(im, slug)
    datos['productos'][slug] = {'nombre': 'Ángel colgante', 'precio': 40, 'medida': '11 cm', 'tipo': 'plano', 'src': f'assets/prod/{slug}.png',
                                'sombra': f'assets/sombra/{slug}.png', 'w': im.width, 'h': im.height, 'caja': c, 'apoyo': c[3],
                                'apoyoX': (c[0] + c[2]) / 2, 'escala': round(f, 3)}
    ang.append(slug)
datos['decor']['angeles'] = ang
print('ángeles:', len(ang))

# ───────────── fotos de la casa (con máscara del sujeto para el paralaje) ─────────────
FOTOS_USO = {
    'manos': ('Casa del Retablo - Silvestre Ataucusi_0015.JPG', True),
    'maestro': ('Casa del Retablo - Silvestre Ataucusi_0012.JPG', True),
    'maestro-letrero': ('Casa del Retablo - Silvestre Ataucusi_0010.JPG', True),
    'patio': ('Casa del Retablo - Silvestre Ataucusi_0008.JPG', False),
    'museo': ('Casa del Retablo - Silvestre Ataucusi_0002.JPG', False),
    'detalle-musicos': ('DSC_4274.jpg', False),
    'detalle-arpa': ('DSC_4273.jpg', False),
    'detalle-nacimiento': ('Sin título-8..jpg', False),
}
VISION = os.path.join(AQUI, 'herramientas', 'mascara_vision')


def rellenar_fondo(rgb, m):
    """Fondo sin el sujeto (para la capa de atrás): empuja y tira de colores de alrededor."""
    peso = (1 - m)[..., None]
    out = rgb.copy()
    acum, w = rgb * peso, peso.copy()
    for s in (4, 12, 32, 80, 200):
        a = ndimage.gaussian_filter(acum, (s, s, 0)); b = ndimage.gaussian_filter(w, (s, s, 0))
        relleno = a / np.maximum(b, 1e-4)
        out = np.where(w > 0.5, out, np.where(b > 0.02, relleno, out))
    return out * peso + out * (1 - peso)


for clave, (archivo, conMascara) in FOTOS_USO.items():
    src = os.path.join(FOTOS, archivo)
    im = Image.open(src)
    from PIL import ImageOps
    im = ImageOps.exif_transpose(im).convert('RGB')
    k = 4096 / max(im.size)
    if k < 1:
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    dst = os.path.join(OUT, 'fotos', clave + '.jpg')
    im.save(dst, quality=92)
    info = {'src': f'assets/fotos/{clave}.jpg', 'w': im.width, 'h': im.height}
    if conMascara and os.path.exists(VISION):
        mpath = os.path.join(OUT, 'fotos', clave + '-m.png')
        r = subprocess.run([VISION, dst, mpath], capture_output=True, text=True)
        print('  vision', clave, r.stdout.strip())
        if os.path.exists(mpath):
            m = Image.open(mpath).convert('L').resize(im.size, Image.LANCZOS)
            m.save(mpath)
            # capa de fondo sin el sujeto (ligeramente ampliada la máscara para no dejar borde)
            mf = np.asarray(m).astype(np.float32) / 255
            mf = ndimage.gaussian_filter(ndimage.grey_dilation(mf, size=(25, 25)), 6)
            chico = 1024 / max(im.size)
            rgb = np.asarray(im.resize((round(im.width * chico), round(im.height * chico)), Image.LANCZOS)).astype(np.float32) / 255
            mc = np.asarray(Image.fromarray((mf * 255).astype(np.uint8)).resize((rgb.shape[1], rgb.shape[0]), Image.LANCZOS)).astype(np.float32) / 255
            fondo = rellenar_fondo(rgb, mc)
            fondo_g = Image.fromarray((fondo * 255).clip(0, 255).astype(np.uint8)).resize(im.size, Image.LANCZOS)
            full = np.asarray(im).astype(np.float32)
            fg = np.asarray(fondo_g).astype(np.float32)
            mm = mf[..., None]
            comp = full * (1 - mm) + fg * mm
            Image.fromarray(comp.clip(0, 255).astype(np.uint8)).save(os.path.join(OUT, 'fotos', clave + '-fondo.jpg'), quality=90)
            info['mascara'] = f'assets/fotos/{clave}-m.png'
            info['fondo'] = f'assets/fotos/{clave}-fondo.jpg'
    datos['fotos'][clave] = info
    print(f"foto {clave:20s} {im.width}x{im.height}")


# ───────────── logo vectorizado por color ─────────────
def vectorizar(mask, nombre):
    pbm = os.path.join(OUT, f'_tmp_{nombre}.pbm')
    Image.fromarray(((~mask) * 255).astype(np.uint8)).convert('1').save(pbm)
    svg = pbm.replace('.pbm', '.svg')
    subprocess.run(['potrace', pbm, '-s', '-o', svg, '-t', '6', '-a', '1.1', '-O', '0.4', '-u', '10'], check=True)
    txt = open(svg).read()
    os.remove(pbm); os.remove(svg)
    tr = re.search(r'transform="([^"]+)"', txt).group(1)
    ds = re.findall(r'<path d="([^"]+)"', txt)
    return {'transform': tr, 'd': ' '.join(d.replace('\n', ' ') for d in ds)}


logo_src = np.asarray(Image.open(os.path.join(FOTOS, '328665452_896657578042438_4407588420491438703_n.jpg')).convert('RGB')).astype(np.float32) / 255
# ampliar ×3 antes de vectorizar: curvas más finas
L = np.asarray(Image.fromarray((logo_src * 255).astype(np.uint8)).resize((logo_src.shape[1] * 3, logo_src.shape[0] * 3), Image.LANCZOS)).astype(np.float32) / 255
def cerca(c, tol):
    return np.linalg.norm(L - np.array(c), axis=-1) < tol
r, g, b = L[..., 0], L[..., 1], L[..., 2]
sat = L.max(-1) - L.min(-1)
azul = (b > r + 0.08) & (b > g + 0.05) & (L.mean(-1) < 0.55)
rojo = (r > g + 0.25) & (r > b + 0.15) & (r < 0.85) & ~((r > 0.8) & (g > 0.45))
verde = (g > r + 0.12) & (g > b + 0.05)
naranja = (r > 0.8) & (g > 0.45) & (g < 0.8) & (b < 0.4)
capas = {}
for nombre, m, color in (('letras', azul, '#2c2e6b'), ('rojo', rojo, '#b5313e'), ('verde', verde, '#3a9a48'), ('naranja', naranja, '#f39b2b')):
    m = ndimage.binary_opening(m, iterations=1)
    m = ndimage.binary_closing(m, iterations=2)
    capas[nombre] = {'color': color, **vectorizar(m, nombre)}
    print('logo capa', nombre, int(m.sum()))
LOGO = {'w': L.shape[1], 'h': L.shape[0], 'capas': capas}
# el techo (para dibujarlo): la componente azul más ancha de la mitad de arriba
lab, n = ndimage.label(azul)
mejor, ancho = None, 0
for i in range(1, n + 1):
    sl = ndimage.find_objects((lab == i).astype(int))[0]
    if sl[0].stop < L.shape[0] * 0.55 and (sl[1].stop - sl[1].start) > ancho:
        mejor, ancho = i, sl[1].stop - sl[1].start
if mejor:
    sl = ndimage.find_objects((lab == mejor).astype(int))[0]
    LOGO['techo'] = {'caja': [sl[1].start, sl[0].start, sl[1].stop, sl[0].stop], **vectorizar(lab == mejor, 'techo')}
    # las letras sin el techo
    LOGO['capas']['letras_sin_techo'] = {'color': '#2c2e6b', **vectorizar(azul & (lab != mejor), 'letras2')}
# la firma «De Silvestre Ataucusi» (logo blanco del catálogo, abajo a la derecha)
blanco = np.asarray(Image.open(os.path.join(CAT, 'rgba', 'p01_008.png')).convert('RGBA')).astype(np.float32) / 255
ab = blanco[..., 3]
hb, wb = ab.shape
zona = np.zeros_like(ab, bool)
zona[int(hb * 0.80):, int(wb * 0.38):] = True
firma = (ab > 0.5) & zona
if firma.sum() > 100:
    F3 = np.asarray(Image.fromarray((firma * 255).astype(np.uint8)).resize((wb * 4, hb * 4), Image.LANCZOS)) > 127
    ys, xs = np.where(F3)
    LOGO['firma'] = {'caja': [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())], 'w': wb * 4, 'h': hb * 4, **vectorizar(F3, 'firma')}
open(os.path.join(OUT, 'logo.js'), 'w').write('window.LOGO = ' + json.dumps(LOGO) + ';\n')

open(os.path.join(OUT, 'datos.js'), 'w').write('window.DATOS = ' + json.dumps(datos, ensure_ascii=False) + ';\n')
print('productos:', len(datos['productos']), '→ assets/datos.js')
