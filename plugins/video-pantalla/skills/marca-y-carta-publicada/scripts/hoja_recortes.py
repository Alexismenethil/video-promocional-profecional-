"""Hoja de contactos de recortes sobre color, para juzgar bordes: python3 hoja_recortes.py salida.jpg slug…"""
import sys, numpy as np
from PIL import Image, ImageDraw
sal, slugs = sys.argv[1], sys.argv[2:]
T = 380; cols = 6
fondos = [(13, 59, 43), (232, 116, 76), (47, 147, 168)]
filas = (len(slugs) + cols - 1) // cols
hoja = Image.new("RGB", (cols * T, filas * (T + 18)), (20, 20, 20))
d = ImageDraw.Draw(hoja)
for i, s in enumerate(slugs):
    im = Image.open(f"fotos/{s}.webp").convert("RGB")
    m = Image.open(f"recortes/mascaras/{s}.png").convert("I;16")
    a = np.array(m).astype(np.float32) / 65535.0
    if a.shape != (im.height, im.width):
        a = np.array(Image.fromarray((a * 255).astype(np.uint8)).resize(im.size, Image.LANCZOS)).astype(np.float32) / 255
    ys, xs = np.where(a > 0.05)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    rgb = np.array(im).astype(np.float32)
    bg = np.array(fondos[i % 3], np.float32)
    comp = rgb * a[..., None] + bg * (1 - a[..., None])
    c = Image.fromarray(comp[y0:y1 + 1, x0:x1 + 1].astype(np.uint8))
    c.thumbnail((T - 10, T - 10), Image.LANCZOS)
    tile = Image.new("RGB", (T, T), tuple(int(v) for v in bg))
    tile.paste(c, ((T - c.width) // 2, (T - c.height) // 2))
    hoja.paste(tile, ((i % cols) * T, (i // cols) * (T + 18)))
    d.text(((i % cols) * T + 4, (i // cols) * (T + 18) + T + 3), s, fill=(230, 230, 230))
hoja.save(sal, quality=88)
