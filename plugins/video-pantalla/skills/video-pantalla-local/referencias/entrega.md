# Entrega

## Copiar al repo del negocio (sin commit)

```bash
REPO="/ruta/al/repo-del-negocio"; T="<scratchpad>/<negocio>"; DST="$REPO/output/video"
# si ya había una entrega, moverla a la carpeta temporal (no borrarla)
[ -d "$DST" ] && mv "$DST" "$T/anterior-$(date +%H%M)"
mkdir -p "$DST"
for f in 4k-60fps 1080-60fps 1080-30fps; do mkdir -p "$DST/$f" && cp "$T/salida/$f/"*.mp4 "$DST/$f/"; done
cp "$T/audio/efectos.wav" "$DST/<negocio>-efectos.wav"
rsync -a --exclude node_modules --exclude 'cuadros*' --exclude salida --exclude previa --exclude verif \
  --exclude rapido --exclude '*.log' --exclude carta.json "$T/" "$DST/fuente/"
cd "$REPO" && git status --short     # debe mostrar solo: ?? output/
```

- Revisar que `fuente/package-lock.json` tenga el nombre del proyecto (no el de otro video): si se
  copió de otro, regenerarlo con `npm install --package-lock-only`.
- `fuente/` incluye assets (fotos elegidas, logo.js, fuentes) y `audio/` para que `index.html?play`
  funcione. No incluye `carta.json` ni cuadros.
- Si el repo del negocio es público o se va a subir, `output/` no debería commitearse (pesa ~170 MB).

## README de la fuente (plantilla)

```markdown
# Pantalla del local · 15 s

<La idea en un párrafo: qué pasa en pantalla, en orden.> El último cuadro es el primero y la cola del
sonido vuelve a entrar al comienzo: en la pantalla no se nota el corte.

Todo es código: `seek(t)` dibuja cualquier instante sin depender del reloj, y `cues.js` es el único
reloj que comparten imagen y sonido.

| Archivo | Qué hace |
| --- | --- |
| `prep.py` | Lee la carta publicada (solo lectura) y prepara marca, fotos y datos |
| `index.html` + `anim.js` | La animación (`index.html?play` la reproduce en vivo) |
| `cues.js` | Los tiempos de cada evento, en segundos |
| `audio.py` | `audio/pista.wav` (música + efectos) y `audio/efectos.wav` (solo efectos) |
| `render.mjs` | Genera los cuadros con Chrome, con desenfoque de movimiento |
| `exportar.py` | 4K 60, 1080 60 y 1080 30; con música y solo efectos |

## Volver a generarlo
    python3 prep.py /ruta/al/repo
    python3 audio.py
    npm install
    ESCALA=2 node render.mjs video 60
    NOMBRE=<negocio> python3 exportar.py
```

## Mensaje final al usuario (forma)

1. Una línea: qué se entregó (los 4K van adjuntos con SendUserFile, `display: render`).
2. La idea en 4–6 líneas numeradas o en prosa corta (el recorrido del video).
3. Tabla: carpeta · formato · peso. Audio: LUFS de cada versión.
4. Qué se dejó fuera y por qué (producto sin foto publicada, fotos de estilo distinto…).
5. «Producción no se tocó: solo leí la carta pública.» + qué apareció en el repo (`output/`, sin commit).
6. Ofrecer el siguiente paso concreto (cambiar productos, textos o música; cuánto tarda).

Sin jerga (nada de «render», «pipeline», «bus»); números sí (duración, pesos, LUFS).
