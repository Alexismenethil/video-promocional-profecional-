# Pantalla del local · 15 s

Pieza en bucle para la TV del local: el retablo se abre, la cámara entra por
la hornacina y recorre café, crepes y helados, vuelve a salir, las puertas se
cierran y firma la casa. El último cuadro es el primero, y la cola del sonido
vuelve a entrar al comienzo: en la pantalla no se nota el corte.

Todo es código: `seek(t)` dibuja cualquier instante sin depender del reloj, y
`cues.js` es el único reloj que comparten imagen y sonido.

| Archivo | Qué hace |
| --- | --- |
| `prep.py` | Recorta la marca del repo y lee la carta publicada: fotos reales, nombres vigentes y sabores |
| `index.html` + `anim.js` | La animación (`index.html?play` la reproduce en vivo, con sonido al hacer clic) |
| `cues.js` | Los tiempos de cada evento, en segundos |
| `audio.py` | Dos pistas: `audio/pista.wav` (huayno-pop + efectos) y `audio/efectos.wav` (solo efectos) |
| `render.mjs` | Genera los cuadros con Chrome, con desenfoque de movimiento |

`prep.py` solo **lee** la carta publicada (la misma consulta que hace un
cliente al abrir la carta). Las fotos, los nombres y los sabores salen de ahí:
lo que se cambie en el panel entra en el próximo video. Un sabor aparece en la
vitrina si está disponible y tiene su bola recortada en `frontend/public/sabores/`.

El café usa a propósito la foto de la casa (`frontend/public/productos/cafe-de-la-casa.jpg`);
los crepes, las fotos reales de la carta.

## Volver a generarlo

```bash
CARTA_URL=https://<api-publica>/api/carta python3 prep.py /ruta/al/repo   # marca, fotos y datos de la carta publicada
python3 audio.py                   # audio/pista.wav y audio/efectos.wav
npm install
ESCALA=2 node render.mjs video 60  # 900 cuadros 4K con desenfoque de movimiento (~15 min)
python3 exportar.py                # 4K 60, 1080 60 y 1080 30; con música y solo efectos
```

`ESCALA=1` genera directamente en 1080 (PNG, unos 3 minutos) si no hace falta el 4K.
