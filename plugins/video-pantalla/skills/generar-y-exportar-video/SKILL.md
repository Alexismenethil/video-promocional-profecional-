---
name: generar-y-exportar-video
description: Genera los cuadros de una animación HTML determinista (window.seek) con Chrome sin cabeza —1080 o 4K, con desenfoque de movimiento por submuestras y varios trabajadores— y los exporta con ffmpeg en 4K 60 (HEVC hvc1), 1080 60 y 1080 30 (H.264), cada uno con música y solo efectos. Úsala cuando la animación y el audio estén listos y haya que producir los MP4 finales, o para una previa rápida del movimiento completo.
when_to_use: Fases 7 y 8 de video-pantalla-local (previa rápida; cuadros 4K y exportación). También cuando el generador se cuelgue, tarde demasiado, o un televisor no lea el archivo.
---

# Generar cuadros y exportar

Scripts (copiados a la carpeta del proyecto por `nuevo_proyecto.sh`): `scripts/render.mjs`,
`scripts/exportar.py`, `scripts/package.json` (puppeteer-core + sharp; usa el Chrome instalado).

## Cuadros sueltos (mientras se anima)
```bash
node render.mjs frames 0 1.2 2.4 7.8        # → previa/t0.000.png …  (ESCALA=2 → *_4k.png)
```

## Previa rápida del movimiento completo
```bash
MUESTRAS=1 SALIDA=rapido node render.mjs video 30     # 450 cuadros 1080 sin desenfoque (~30 s + arranque)
python3 herramientas/tira.py rapido --fps 30 --cada 3 --salida previa/tira
```
Mirar `previa/tira0.jpg` y `tira1.jpg` (una miniatura cada 0,1 s): saltos, huecos, fotos sin encuadrar,
cosas que aparecen de golpe. Barato y encuentra lo que los cuadros sueltos no muestran.

## Cuadros definitivos en 4K (en segundo plano)
```bash
rm -rf cuadros60_4k; ESCALA=2 node render.mjs video 60 > generar4k.log 2>&1 &
until grep -q "listo en" generar4k.log; do sleep 30; done; tail -2 generar4k.log
```
- `ESCALA=2` = `deviceScaleFactor` 2 → 3840×2160. Salida `cuadros60_4k/00000.jpg…` (JPEG 97, 4:4:4).
- Submuestras por cuadro: `CUES.muestras = [[desde, hasta, K], …]` (por defecto 2). Obturador de 180°:
  las K capturas se reparten en medio cuadro alrededor del instante y se promedian.
- Trabajadores: 6 en 4K (`TRABAJADORES=`), uno **por navegador** (varias pestañas en un Chrome se
  cuelgan con `Runtime.callFunctionOn timed out`). Banderas anti-estrangulamiento incluidas.
- Referencia: 900 cuadros 4K con K promedio ~4 → 10–15 min en una Mac. Avance en el log cada 30 cuadros.
- Disco: ~1,5–2,5 GB de JPEG en 4K por cada 15 s (2:15 son 23 GB). Todo en la carpeta temporal, nunca en el
  repo. Mirar `df -h` antes de empezar: tres trabajadores en 4K pueden hacer crecer la memoria virtual
  ~5 GB en el mismo disco.

`ESCALA=1 node render.mjs video 60` genera 1080 directo (PNG) si no hace falta 4K (~3–4 min); en ese
caso `exportar.py` se salta el 4K solo.

## Exportar
```bash
NOMBRE=<negocio> python3 exportar.py          # ~3,5 min
```
| Formato | Códec | Detalles |
| --- | --- | --- |
| `4k-60fps` | HEVC Main, `hvc1`, nivel 5.1 | CRF 18, VBV 38 Mb/s (bufsize 60 M), GOP 60: lo que leen por USB los TV 4K y Apple |
| `1080-60fps` | H.264 High 4.2 | reducido desde el 4K con Lanczos (más limpio que generar en 1080), CRF 16 |
| `1080-30fps` | H.264 High 4.1 | reducido + `tmix=frames=2` y un cuadro de cada dos (desenfoque de 180° real), CRF 17 |

La imagen se codifica una vez por formato (`salida/tmp/`) y se le pega cada pista (AAC 256 kb/s, 48 kHz,
`+faststart`): `…-con-musica-…mp4` y `…-solo-efectos-…mp4`. Variables: `CUADROS`, `PISTA`, `EFECTOS`,
`SEGUNDOS`, `SALIDA` y `FORMATOS` (`FORMATOS=4k-60fps` saca solo ese, cuando el usuario pide solo el 4K).

## Si algo falla
| Problema | Arreglo |
| --- | --- |
| `No encontré Google Chrome` | `CHROME=/ruta/al/chrome` |
| Se cuelga una captura (ProtocolError) | ya se usa un navegador por trabajador; bajar `TRABAJADORES` |
| El proceso no termina al final | `render.mjs` cierra conexiones y sale con `process.exit(0)` (no quitarlo) |
| Errores de la página en consola | aparecen como `[error en la página]`: corregir anim.js y volver a probar con `frames` |
| 404 en consola | suele ser `favicon.ico`: se ignora |
| Un TV no abre el 4K | usar el 1080 60; si tampoco, el 1080 30 (H.264 lo lee todo) |
| Archivo 4K pesado | normal: 20–35 Mb/s. No bajar el CRF de 18 ni subir el VBV de 38 M (nivel 5.1) |

Después: skill `revisar-video` (verificar los MP4, la costura y cuadros del archivo final).
