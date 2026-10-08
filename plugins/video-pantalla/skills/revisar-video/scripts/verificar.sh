#!/usr/bin/env bash
# Verifica los MP4 exportados: códec, nivel, resolución, cuadros por segundo, duración, tasa,
# sonoridad (LUFS) y pico. Además saca cuadros del 4K ya codificado para mirarlos.
#
#   bash verificar.sh salida [0.5 3.6 7.8 12.3 14.2]
set -euo pipefail
SAL="${1:-salida}"; shift || true
TIEMPOS=("$@"); [ ${#TIEMPOS[@]} -eq 0 ] && TIEMPOS=(0.5 2.5 5 7.5 10 12.5 14.5)
find "$SAL" -name '*.mp4' -not -path '*/tmp/*' | sort | while read -r f; do
  echo "== $f ($(du -h "$f" | cut -f1))"
  ffprobe -v error -show_entries format=duration,bit_rate \
    -show_entries stream=codec_name,profile,level,width,height,r_frame_rate,codec_tag_string,sample_rate,channels \
    -of compact=p=0:nk=0 "$f" < /dev/null
  ffmpeg -nostdin -hide_banner -nostats -i "$f" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):" | tr -s ' ' | tr '\n' ' '
  echo
done
UNO=$(find "$SAL" -name '*con-musica*4k*.mp4' -not -path '*/tmp/*' | head -1)
[ -z "$UNO" ] && UNO=$(find "$SAL" -name '*.mp4' -not -path '*/tmp/*' | head -1)
mkdir -p verif
for t in "${TIEMPOS[@]}"; do
  ffmpeg -nostdin -v error -ss "$t" -i "$UNO" -frames:v 1 -y "verif/v_${t}.png"
done
echo "cuadros del archivo final en verif/ (de $UNO)"
