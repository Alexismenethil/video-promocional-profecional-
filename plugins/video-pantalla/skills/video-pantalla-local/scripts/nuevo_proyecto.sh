#!/usr/bin/env bash
# Arma la carpeta de trabajo de un video nuevo: plantilla + generador + exportador + audio + herramientas.
#
#   bash nuevo_proyecto.sh <carpeta-de-trabajo>
#
# Trabajar SIEMPRE en la carpeta temporal de la sesión (scratchpad), nunca dentro del repo del negocio.
set -euo pipefail
DEST="${1:?uso: nuevo_proyecto.sh <carpeta-de-trabajo>}"
SK="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"   # la carpeta que contiene todas las skills
for s in animacion-html-deterministica generar-y-exportar-video sonido-para-video revisar-video marca-y-carta-publicada; do
  [ -d "$SK/$s" ] || { echo "falta la skill $s junto a video-pantalla-local ($SK)"; exit 1; }
done
mkdir -p "$DEST/herramientas"
cp -R "$SK/animacion-html-deterministica/plantilla/." "$DEST/"
cp "$SK/generar-y-exportar-video/scripts/render.mjs" "$SK/generar-y-exportar-video/scripts/exportar.py" \
   "$SK/generar-y-exportar-video/scripts/package.json" "$DEST/"
cp "$SK/sonido-para-video/scripts/audiolib.py" "$DEST/"
cp "$SK/revisar-video/scripts/"* "$SK/marca-y-carta-publicada/scripts/"* "$DEST/herramientas/"
cd "$DEST"
npm install --prefer-offline --no-audit --no-fund --loglevel=error
echo "Carpeta lista: $DEST"
echo "  node render.mjs frames 0 3 7.8 12   → previa/"
echo "  python3 audio.py                    → audio/pista.wav y audio/efectos.wav"
for c in ffmpeg potrace python3 node; do command -v "$c" >/dev/null || echo "  AVISO: falta $c"; done
python3 -c "import numpy, scipy, PIL, fontTools" 2>/dev/null || echo "  AVISO: faltan módulos de Python (pip install numpy scipy pillow fonttools)"
