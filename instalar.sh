#!/usr/bin/env bash
# Instala las skills como skills personales de Claude Code (enlaces simbólicos a este repo):
# quedan disponibles en todas las sesiones y se actualizan con un `git pull`.
#
#   bash instalar.sh            # enlaza en ~/.claude/skills
#   bash instalar.sh --quitar   # quita los enlaces
set -euo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
mkdir -p "$DEST"
for s in "$AQUI"/plugins/video-pantalla/skills/*/; do
  s="${s%/}"; n="$(basename "$s")"
  if [ "${1:-}" = "--quitar" ]; then
    [ -L "$DEST/$n" ] && rm "$DEST/$n" && echo "quitada $n"
    continue
  fi
  if [ -e "$DEST/$n" ] && [ ! -L "$DEST/$n" ]; then
    echo "ya existe $DEST/$n y no es un enlace: no lo toco"; continue
  fi
  ln -sfn "$s" "$DEST/$n"
  echo "✓ $n → $s"
done
