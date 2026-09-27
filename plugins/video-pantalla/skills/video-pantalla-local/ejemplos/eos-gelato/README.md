# Pantalla del local · 15 s

Pieza en bucle para la TV de EOS Gelato. Las letras del logo se llenan de gelato
(frutos rojos, maracuyá y cacao). La cámara entra por la «O» al amanecer andino
del Maracuyá, que se encoge en un arco de la vitrina de gelatos y sorbetes. El
jarabe de frambuesa chorrea hacia el carrusel de milkshakes, sodas y frozen, se
sale por la «S» y el logo firma. El último cuadro es el primero y la cola del
sonido vuelve a entrar al comienzo: en la pantalla no se nota el corte.

Todo es código: `seek(t)` dibuja cualquier instante sin depender del reloj, y
`cues.js` es el único reloj que comparten imagen y sonido (128 BPM: ocho
compases justos en 15 s).

| Archivo | Qué hace |
| --- | --- |
| `prep.py` | Vectoriza el logo, recorta la monstera, copia las fuentes y lee la carta publicada: fotos reales y nombres vigentes |
| `index.html` + `anim.js` | La animación (`index.html?play` la reproduce en vivo, con sonido al hacer clic) |
| `cues.js` | Los tiempos de cada evento, en segundos |
| `audio.py` | Dos pistas: `audio/pista.wav` (música + efectos) y `audio/efectos.wav` (solo efectos) |
| `render.mjs` | Genera los cuadros con Chrome, con desenfoque de movimiento |
| `exportar.py` | 4K 60, 1080 60 y 1080 30, cada uno con música y solo efectos |

`prep.py` solo **lee** la carta publicada (la misma consulta que hace el
teléfono de un cliente al escanear el QR). Las fotos y los nombres salen de ahí:
lo que se cambie en el panel entra en el próximo video. Las fuentes se toman
del build de la carta (`frontend/.next*/static/media`), así que la carta tiene
que haberse construido al menos una vez.

## Volver a generarlo

```bash
CARTA_URL=https://<api-publica>/api/carta python3 prep.py /ruta/al/repo   # logo, hojas, fuentes y datos de la carta publicada
python3 audio.py                   # audio/pista.wav y audio/efectos.wav
npm install
ESCALA=2 node render.mjs video 60  # 900 cuadros 4K con desenfoque de movimiento
python3 exportar.py                # 4K 60, 1080 60 y 1080 30; con música y solo efectos
```

`ESCALA=1` genera directamente en 1080 (PNG) si no hace falta el 4K.
