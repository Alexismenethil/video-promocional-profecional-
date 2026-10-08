#!/usr/bin/env python3
"""Codifica los cuadros 4K en los tres formatos de pantalla, cada uno con música y solo efectos.

    4K · 60 fps    HEVC (hvc1), nivel 5.1, tasa tope 38 Mb/s: lo que leen por USB los televisores 4K
    1080 · 60 fps  H.264 High 4.2, reducido desde el 4K (sale más limpio que uno nativo)
    1080 · 30 fps  H.264 High 4.1, mezclando cuadros de a dos (desenfoque de 180°)

La imagen se codifica una sola vez por formato y después se le pega cada pista.

    NOMBRE=eos-gelato python3 exportar.py
    NOMBRE=… CUADROS=cuadros60_4k PISTA=audio/pista.wav EFECTOS=audio/efectos.wav SEGUNDOS=15 python3 exportar.py
    NOMBRE=… FORMATOS=4k-60fps python3 exportar.py      (solo los formatos nombrados)

Salida: salida/{4k-60fps,1080-60fps,1080-30fps}/{NOMBRE}-{SEGUNDOS}s-{con-musica|solo-efectos}-{formato}.mp4
Si falta una de las dos pistas, se exporta solo la que exista.
"""
import os
import subprocess

ROOT = os.getcwd()
NOMBRE = os.environ.get("NOMBRE", "video")
SEG = os.environ.get("SEGUNDOS", "15")
CUADROS = os.environ.get("CUADROS", "cuadros60_4k")
SAL = os.environ.get("SALIDA", "salida")
EXT = "jpg" if os.path.exists(os.path.join(CUADROS, "00000.jpg")) else "png"
ENTRADA = ["-framerate", "60", "-i", os.path.join(CUADROS, f"%05d.{EXT}")]
os.makedirs(os.path.join(SAL, "tmp"), exist_ok=True)


def ff(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


# Si los cuadros ya son 1080 (ESCALA=1), el formato 4K no se genera.
from PIL import Image
ancho = Image.open(os.path.join(CUADROS, f"00000.{EXT}")).width
FORMATOS = {
    "4k-60fps": ["-c:v", "libx265", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-tag:v", "hvc1",
                 "-x265-params", "keyint=60:min-keyint=60:level-idc=51:vbv-maxrate=38000:vbv-bufsize=60000:log-level=error"],
    "1080-60fps": ["-vf", "scale=1920:1080:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "16",
                   "-pix_fmt", "yuv420p", "-profile:v", "high", "-level:v", "4.2", "-x264-params", "keyint=60:min-keyint=60"],
    "1080-30fps": ["-vf", "scale=1920:1080:flags=lanczos,tmix=frames=2,select='not(mod(n+1\\,2))',setpts=N/30/TB", "-r", "30",
                   "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high",
                   "-level:v", "4.1", "-x264-params", "keyint=30:min-keyint=30"],
}
if ancho < 3840:
    FORMATOS.pop("4k-60fps")
if os.environ.get("FORMATOS"):                     # FORMATOS=4k-60fps → solo esos (separados por comas)
    FORMATOS = {k: v for k, v in FORMATOS.items() if k in os.environ["FORMATOS"].split(",")}
PISTAS = {"con-musica": os.environ.get("PISTA", "audio/pista.wav"),
          "solo-efectos": os.environ.get("EFECTOS", "audio/efectos.wav")}
PISTAS = {k: v for k, v in PISTAS.items() if os.path.exists(v)}

for fmt, opciones in FORMATOS.items():
    video = os.path.join(SAL, "tmp", f"{fmt}.mp4")
    print("codificando", fmt, flush=True)
    ff(*ENTRADA, *opciones, "-an", video)
    for nombre, wav in PISTAS.items():
        out = os.path.join(SAL, fmt, f"{NOMBRE}-{SEG}s-{nombre}-{fmt}.mp4")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        ff("-i", video, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
           "-ar", "48000", "-movflags", "+faststart", "-shortest", out)
        print("  ", out, flush=True)
    if not PISTAS:
        print("   (sin audio: quedó solo", video, ")")
