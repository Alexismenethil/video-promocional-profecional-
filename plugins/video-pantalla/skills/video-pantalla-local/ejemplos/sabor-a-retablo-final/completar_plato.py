"""Completa el plato cuando la foto lo corta por el borde (retoque, como un relleno de Photoshop).

El plato es una elipse de loza blanca moteada. Se ajusta la elipse al borde visible del plato y se
reconstruye lo que falta fuera del encuadre «por anillos»: cada anillo de la elipse (mismo radio
normalizado ρ) conserva su color y su sombreado, y el tramo que falta se interpola entre los dos
extremos donde el anillo sale y vuelve a entrar a la foto. Encima va el moteado de la loza, tomado de
la propia foto. Los hilos de chocolate que llegan al corte se terminan un poco antes (si no, quedarían
cortados en recto).

    python3 completar_plato.py slug [slug …]      → fotos/<slug>-completo.png (RGBA), previa/completo-<slug>.jpg

Imprime cuánto se extendió cada lado y si la comida (no el plato) toca algún corte.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

AQUI = os.path.dirname(os.path.abspath(__file__))


def cargar(slug):
    im = np.asarray(Image.open(os.path.join(AQUI, "fotos", slug + ".webp")).convert("RGB")).astype(np.float64) / 255
    m = np.asarray(Image.open(os.path.join(AQUI, "recortes", "mascaras", slug + ".png")).convert("L").resize((im.shape[1], im.shape[0]), Image.LANCZOS)).astype(np.float64) / 255
    return im, m


def ajustar_elipse(m, borde=6, cerca=None):
    """Elipse de ejes rectos al contorno de la máscara (sin los puntos pegados al borde de la foto).
    `cerca(xs, ys)` → peso de cada punto (para que manden los del lado que se va a completar)."""
    H, W = m.shape
    dentro = m > 0.5
    cont = dentro & ~ndimage.binary_erosion(dentro, iterations=1)
    ys, xs = np.nonzero(cont)
    ok = (xs > borde) & (xs < W - 1 - borde) & (ys > borde) & (ys < H - 1 - borde)
    xs, ys = xs[ok].astype(np.float64), ys[ok].astype(np.float64)
    pw = cerca(xs, ys) if cerca else np.ones(len(xs))
    sel = np.ones(len(xs), bool)
    for _ in range(12):
        X = np.stack([xs[sel] ** 2, ys[sel] ** 2, xs[sel], ys[sel]], 1) * pw[sel, None]
        A, B, C, D = np.linalg.lstsq(X, pw[sel], rcond=None)[0]
        cx, cy = -C / (2 * A), -D / (2 * B)
        k = 1 + C * C / (4 * A) + D * D / (4 * B)
        a, b = np.sqrt(k / A), np.sqrt(k / B)
        r = np.sqrt(((xs - cx) / a) ** 2 + ((ys - cy) / b) ** 2)
        err = np.abs(r - 1)
        sel = err < max(0.006, np.percentile(err, 80))
    res = np.median(np.abs(np.sqrt(((xs - cx) / a) ** 2 + ((ys - cy) / b) ** 2) - 1)) * min(a, b)
    return cx, cy, a, b, res


def suave(x, w, s):
    """Convolución normalizada: promedio de x donde w > 0 (gaussiana de radio s)."""
    num = np.stack([ndimage.gaussian_filter(x[..., c] * w, s) for c in range(3)], -1)
    den = ndimage.gaussian_filter(w, s)[..., None]
    return num / np.maximum(den, 1e-6), den[..., 0]


def completar(slug, verbose=True):
    im, m = cargar(slug)
    H, W = m.shape
    toca = lambda v: float((v > 0.5).mean()) > 0.02
    cortes = [k for k, v in {"arr": m[0, :], "aba": m[-1, :], "izq": m[:, 0], "der": m[:, -1]}.items() if toca(v)]
    # una elipse por lado: la ajustan sobre todo los puntos del contorno cercanos a ese corte
    pesos = {"izq": lambda xs, ys: np.exp(-xs / 170) + 0.03, "der": lambda xs, ys: np.exp(-(W - 1 - xs) / 170) + 0.03,
             "aba": lambda xs, ys: np.exp(-(H - 1 - ys) / 170) + 0.03, "arr": lambda xs, ys: np.exp(-ys / 170) + 0.03}
    eli = {l: ajustar_elipse(m, cerca=pesos[l]) for l in cortes}
    mg = 14
    pl = max(0, int(np.ceil(eli["izq"][2] - eli["izq"][0])) + mg) if "izq" in cortes else 0
    pr = max(0, int(np.ceil(eli["der"][0] + eli["der"][2] - (W - 1))) + mg) if "der" in cortes else 0
    pt = max(0, int(np.ceil(eli["arr"][3] - eli["arr"][1])) + mg) if "arr" in cortes else 0
    pb = max(0, int(np.ceil(eli["aba"][1] + eli["aba"][3] - (H - 1))) + mg) if "aba" in cortes else 0
    H2, W2 = H + pt + pb, W + pl + pr
    yy, xx = np.mgrid[0:H2, 0:W2].astype(np.float64)
    foto = np.zeros((H2, W2), bool)
    foto[pt:pt + H, pl:pl + W] = True
    img = np.zeros((H2, W2, 3))
    img[pt:pt + H, pl:pl + W] = im
    mk = np.zeros((H2, W2))
    mk[pt:pt + H, pl:pl + W] = m
    rng = np.random.default_rng(sum(map(ord, slug)) * 7919)

    # ── zona del crepe, chocolate y loza ──
    mx, mn = img.max(2), img.min(2)
    sat = (mx - mn) / np.maximum(mx, 1e-3)
    lum = img.mean(2)
    # zona del crepe: las manchas grandes de color (crepe, fruta, relleno), con margen; los hilos de chocolate
    # sobre la loza y el azúcar quedan afuera
    color = foto & (mk > 0.5) & (((sat > 0.38) & (lum > 0.12) & (lum < 0.92)) | (lum < 0.3))
    color = ndimage.binary_opening(color, iterations=5)
    labc, nc = ndimage.label(color)
    zona = np.zeros((H2, W2), bool)
    if nc:
        areas = ndimage.sum(color, labc, range(1, nc + 1))
        grandes = [i + 1 for i, ar in enumerate(areas) if ar > 0.02 * H * W]
        zona = np.isin(labc, grandes)
        zona = ndimage.binary_closing(zona, iterations=10)
        zona = ndimage.binary_fill_holes(zona)
    zona_m = ndimage.binary_dilation(zona, iterations=22)
    oscuro = foto & (mk > 0.5) & (mx < 0.5)
    chocolate = ndimage.binary_dilation(oscuro, iterations=3)
    # loza: lo que está en el plato y no es crepe ni chocolate (sirve para platos blancos y beige)
    loza = foto & (mk > 0.9) & ~zona_m & (lum > 0.45)
    comida = foto & (mk > 0.5) & zona
    comida_g = ndimage.binary_dilation(zona, iterations=6)
    limpia = loza & ~chocolate & ~comida_g
    F, sop = suave(img, limpia.astype(np.float64), 4.0)
    # color local de la loza (para rellenar junto al crepe: incluye su sombra sobre el plato)
    F20, sop20 = suave(img, limpia.astype(np.float64), 16.0)

    # ── moteado de la loza: solo puntitos oscuros, de zonas bien limpias ──
    det = img - np.stack([ndimage.gaussian_filter(img[..., c], 2.2) for c in range(3)], -1)
    det = np.clip(det, -0.35, 0.012)
    T = 32
    no_blanco = foto & (mk > 0.5) & (mx < 0.72)              # chocolate con su halo, sombras, comida
    fuente = ndimage.binary_erosion(limpia & ~ndimage.binary_dilation(no_blanco, iterations=6), iterations=T // 2 + 6)
    ys, xs = np.nonzero(fuente)
    mot = np.zeros((H2, W2, 3))
    if len(xs):
        for y0 in range(0, H2, T):
            for x0 in range(0, W2, T):
                k = rng.integers(len(xs))
                sy, sx = np.clip(ys[k] - T // 2, 0, H2 - T), np.clip(xs[k] - T // 2, 0, W2 - T)
                pz = det[sy:sy + T, sx:sx + T]
                if rng.random() < 0.5: pz = pz[:, ::-1]
                if rng.random() < 0.5: pz = pz[::-1]
                hh, ww = min(T, H2 - y0), min(T, W2 - x0)
                mot[y0:y0 + hh, x0:x0 + ww] = pz[:hh, :ww]

    # distancia a cada corte (dentro de la foto) y lado responsable de cada píxel de afuera
    dist = {"izq": xx - pl, "der": (pl + W - 1) - xx, "arr": yy - pt, "aba": (pt + H - 1) - yy}
    dueno = np.full((H2, W2), "", dtype=object)
    for l in ("izq", "der"):
        if l in cortes: dueno[(dist[l] < 0) & (yy >= pt) & (yy < pt + H)] = l
    for l in ("arr", "aba"):
        if l in cortes: dueno[dist[l] < 0] = l
    ruido = ndimage.gaussian_filter(rng.standard_normal((H2, W2)), 18)
    ruido = ruido / (np.abs(ruido).max() + 1e-9)
    banda = 34 + 22 * ruido

    out = img.copy()
    alfa = mk.copy()
    avisos = []
    info_puntas = {}
    for lado in cortes:
        cx, cy, a, b, res = eli[lado]
        ecx, ecy = cx + pl, cy + pt
        u, v = (xx - ecx) / a, (yy - ecy) / b
        rho = np.sqrt(u * u + v * v)
        th = np.arctan2(v, u)
        # tabla de anillos con la loza limpia de este lado
        NR, NT = 360, 1440
        cerca = np.maximum(dist[lado], 0) < 420
        val = limpia & (sop > 0.25) & cerca & (rho < 1.0)
        ri = np.clip((rho / 1.03 * NR).astype(int), 0, NR - 1)
        ti = ((th + np.pi) / (2 * np.pi) * NT).astype(int) % NT
        acc = np.zeros((NR, NT, 3)); cnt = np.zeros((NR, NT))
        np.add.at(acc, (ri[val], ti[val]), F[val])
        np.add.at(cnt, (ri[val], ti[val]), 1)
        tabla = np.zeros((NR, NT, 3)); hay = cnt > 0
        tabla[hay] = acc[hay] / cnt[hay][:, None]
        idx = np.arange(NT)
        for r in range(NR):
            ok = np.nonzero(hay[r])[0]
            if len(ok) == 0: continue
            ext = np.concatenate([ok - NT, ok, ok + NT])
            for c in range(3):
                tabla[r, :, c] = np.interp(idx, ext, np.tile(tabla[r, ok, c], 3))
        filas = np.nonzero(hay.any(1))[0]
        for r in range(NR):
            if not hay[r].any() and len(filas): tabla[r] = tabla[filas[np.argmin(np.abs(filas - r))]]
        tabla = ndimage.gaussian_filter(tabla, (1.0, 3.0, 0), mode=("nearest", "wrap", "nearest"))

        def anillo(rr, tt):
            fr = np.clip(rr / 1.03 * NR - 0.5, 0, NR - 1.001)
            ft = ((tt + np.pi) / (2 * np.pi) * NT - 0.5) % NT
            r0, t0 = fr.astype(int), ft.astype(int)
            dr, dt = (fr - r0)[..., None], (ft - t0)[..., None]
            t1 = (t0 + 1) % NT; r1 = np.minimum(r0 + 1, NR - 1)
            return (tabla[r0, t0] * (1 - dt) + tabla[r0, t1] * dt) * (1 - dr) + (tabla[r1, t0] * (1 - dt) + tabla[r1, t1] * dt) * dr

        motl = mot * np.clip((0.985 - rho) / 0.03, 0, 1)[..., None]
        base = anillo(rho, th)
        # corrección a lo largo de la costura: diferencia entre la loza de la foto (suavizada) y la reconstruida,
        # en una franja de 30 px dentro de la foto; se aplica afuera y se apaga con la distancia
        franja = limpia & (dist[lado] >= 0) & (dist[lado] < 30)
        dif = np.where(franja[..., None], F - base, 0)
        if lado in ("izq", "der"):
            num = dif.sum(1); den = franja.sum(1)[:, None]
            perfil = ndimage.gaussian_filter1d(num, 25, axis=0) / np.maximum(ndimage.gaussian_filter1d(den.astype(float), 25, axis=0), 1e-3)
            corr = np.repeat(perfil[:, None, :], W2, axis=1)
        else:
            num = dif.sum(0); den = franja.sum(0)[:, None]
            perfil = ndimage.gaussian_filter1d(num, 25, axis=0) / np.maximum(ndimage.gaussian_filter1d(den.astype(float), 25, axis=0), 1e-3)
            corr = np.repeat(perfil[None, :, :], H2, axis=0)
        caida = np.exp(-np.maximum(-dist[lado], 0) / 80)[..., None]
        sint = base + corr * caida + motl
        alfa_el = np.clip((1.0 - rho) * min(a, b) / 1.3 + 0.5, 0, 1)
        # afuera de la foto: este lado pinta lo suyo
        mio = dueno == lado
        out[mio] = sint[mio]
        alfa[mio] = alfa_el[mio]
        # adentro, junto al corte: el chocolate termina antes, y si la elipse queda afuera del plato real, se rellena
        junto = foto & (dist[lado] >= 0) & (dist[lado] < 60)
        rampa = np.clip(1 - dist[lado] / 40, 0, 1) * junto
        # el hilo de chocolate con su halo (más ancho) y un final gradual (no un corte recto)
        choc_m = junto & ndimage.binary_dilation(oscuro & ~zona_m, iterations=5) & ~zona
        peso_b = np.clip((banda - dist[lado]) / 12, 0, 1)
        rel = junto & (alfa_el * rampa > mk + 0.04) & ~zona_m & (np.abs(rho - 1) < 0.02)
        cubrir = np.maximum(ndimage.gaussian_filter(choc_m * peso_b, 1.6), ndimage.gaussian_filter(rel.astype(np.float64), 1.3)) * junto
        out = out * (1 - cubrir[..., None]) + sint * cubrir[..., None]
        alfa = np.where(junto, np.maximum(alfa, alfa_el * rampa), alfa)
        # ── la comida que toca el corte (la punta del crepe): se redondea un poco antes del corte ──
        # zona del crepe: la mancha grande de color (sin hilos de chocolate ni azúcar sobre la loza), con un margen
        es_comida = zona_m & foto & (mk > 0.5) & ((sat > 0.22) | (lum < 0.5) | (lum > 0.925) | zona)
        if lado in ("izq", "der"):
            xs_ = pl if lado == "izq" else pl + W - 1
            tira = es_comida[:, xs_:xs_ + 6] if lado == "izq" else es_comida[:, xs_ - 5:xs_ + 1]
            fila = tira.mean(1) > 0.5
        else:
            ys_ = pt if lado == "arr" else pt + H - 1
            tira = es_comida[ys_:ys_ + 6, :] if lado == "arr" else es_comida[ys_ - 5:ys_ + 1, :]
            fila = tira.mean(0) > 0.5
        fila = ndimage.binary_closing(fila, iterations=8)
        lab, nseg = ndimage.label(fila)
        recorte = np.zeros((H2, W2), bool)
        puntas = []
        for k in range(1, nseg + 1):
            idxs = np.nonzero(lab == k)[0]
            if len(idxs) < 30:
                continue
            c0, c1 = idxs.min(), idxs.max()
            cen, hl = (c0 + c1) / 2, (c1 - c0) / 2 + 8
            d = float(np.clip(0.3 * (c1 - c0), 18, 72))
            adentro = np.maximum(dist[lado], 0)
            otra = (yy - cen) if lado in ("izq", "der") else (xx - cen)
            puntas.append([int(c0), int(c1)])
            avisos.append(f"PUNTA DEL CREPE EN EL CORTE {lado}: filas {c0 - pt if lado in ('izq', 'der') else c0 - pl}–{c1 - pt if lado in ('izq', 'der') else c1 - pl}")
        info_puntas[lado] = puntas
        if recorte.any():
            dent = ndimage.distance_transform_edt(recorte)
            fuera = ndimage.distance_transform_edt(~recorte)
            sombra_t = np.clip(1 - dent / 7, 0, 1) * recorte          # sombrita del crepe sobre la loza
            canto = np.clip(1 - fuera / 4, 0, 1) * (~recorte) * es_comida   # canto del crepe un poco más oscuro
            suave_r = ndimage.gaussian_filter(recorte.astype(np.float64), 0.9)
            local = np.where((sop20 > 0.03)[..., None], F20, base) + motl
            out = out * (1 - suave_r[..., None]) + (local * (1 - 0.1 * sombra_t[..., None])) * suave_r[..., None]
            out *= (1 - 0.12 * canto[..., None])
        # transición suave entre la loza de la foto y la reconstruida (últimos 26 px antes del corte)
        cerca_c = foto & (dist[lado] >= 0) & (dist[lado] < 26) & limpia & ~recorte
        s_mezcla = np.clip(1 - dist[lado] / 26, 0, 1) ** 1.5 * 0.85 * cerca_c
        s_mezcla = ndimage.gaussian_filter(s_mezcla, 1.0)
        out = out * (1 - s_mezcla[..., None]) + sint * s_mezcla[..., None]
        avisos.append(f"{lado}: elipse ({cx:.0f},{cy:.0f}) {a:.0f}×{b:.0f} ±{res:.1f}px")

    rgba = np.dstack([np.clip(out, 0, 1), np.clip(alfa, 0, 1)])
    Image.fromarray((rgba * 255).round().astype(np.uint8), "RGBA").save(os.path.join(AQUI, "fotos", slug + "-completo.png"))
    fondo = np.array([0.906, 0.541, 0.486])
    pv = rgba[..., :3] * rgba[..., 3:] + fondo * (1 - rgba[..., 3:])
    Image.fromarray((pv * 255).astype(np.uint8)).save(os.path.join(AQUI, "previa", f"completo-{slug}.jpg"), quality=92)
    if verbose:
        print(f"{slug:22s} cortes={','.join(cortes):12s} +izq {pl} +der {pr} +arr {pt} +aba {pb}  " + " · ".join(avisos))
    return {"pl": pl, "pr": pr, "pt": pt, "pb": pb, "puntas": info_puntas}


if __name__ == "__main__":
    import json
    os.makedirs(os.path.join(AQUI, "previa"), exist_ok=True)
    ruta = os.path.join(AQUI, "fotos", "completos.json")
    info = json.load(open(ruta)) if os.path.exists(ruta) else {}
    for s in sys.argv[1:]:
        r = completar(s)
        im = Image.open(os.path.join(AQUI, "fotos", s + ".webp"))
        info[s] = {**r, "W": im.width, "H": im.height}
    json.dump(info, open(ruta, "w"), indent=1)
    print("→", ruta)
