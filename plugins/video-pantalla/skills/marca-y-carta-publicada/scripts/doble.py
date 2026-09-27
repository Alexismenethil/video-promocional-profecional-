#!/usr/bin/env python3
"""Versión @2x de las imágenes que en 4K se ven más grandes que su archivo (Lanczos + nitidez suave).

    python3 doble.py assets/fotos/maracuya.webp assets/logo.png …   → maracuya@2x.webp, logo@2x.png

El navegador no amplía bien (bilineal): ampliar antes con Lanczos y un toque de máscara de enfoque
(radio 1.6–1.8, 55–60 %) da bordes limpios. En la página se usa con srcset="a.webp 1x, a@2x.webp 2x"
o eligiendo src2x cuando devicePixelRatio > 1. No inventa detalle: una foto de 1100 px no será 4K real.
"""
import os
import sys
from PIL import Image, ImageFilter

for ruta in sys.argv[1:]:
    base, ext = os.path.splitext(ruta)
    im = Image.open(ruta)
    modo = "RGBA" if "A" in im.mode or im.mode == "P" else "RGB"
    im2 = im.convert(modo).resize((im.width * 2, im.height * 2), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.7, 58, 2))
    destino = base + "@2x" + ext
    im2.save(destino, quality=94) if ext.lower() in (".webp", ".jpg", ".jpeg") else im2.save(destino)
    print(destino, im2.size)
