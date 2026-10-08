# Sabor a Retablo — «El retablo de los sabores» (menu board de 60 s)

Video en bucle para la pantalla del local. El retablo de la marca, en 3D, se abre; la cámara entra
por él y recorre doce nichos de colores con 25 productos de la carta publicada; al final sale, las
puertas se cierran de un portazo y el polvo dorado vuelve a armar el logo (el último cuadro empalma
con el primero).

- 128 BPM, 32 compases = 60 s exactos. El reloj de imagen y sonido es `cues.py` → `cues.js`.
- Imagen: three.js (WebGL) con la GPU en Chrome sin cabeza. Cada cuadro promedia K instantes:
  desenfoque de movimiento real, profundidad de campo de lente y antialias. Luego brillo, curva de
  color, viñeta y grano.
- Fotos: las de la carta publicada (leída una sola vez con GET), recortadas con el recorte de sujeto
  de macOS (Vision), en local. Los crepes dulces van en arcos con su foto completa (sus fotos tienen
  el plato cortado por el borde).
- Retablo: modelado con las fotos del repo (`frontend/public/marca/retablo-*.png`); sus hojas, ramitas
  y volutas pintadas se recortaron sueltas y flotan como recortables de papel.

## Regenerar

```bash
CARTA_URL=https://<api-publica>/api/carta python3 prep.py /ruta/al/repo   # productos (usa carta.json si existe; si no, la lee con GET)
python3 prep_retablo.py /ruta/al/repo  # texturas del retablo y motivos pintados
python3 cues.py                        # reloj
python3 audio.py                       # audio/pista.wav y audio/efectos.wav
npm install
K=1 SALIDA=rapido node render.mjs video 30          # previa rápida (~1 min)
ESCALA=2 TRABAJADORES=3 node render.mjs video 60    # cuadros 4K (~10 min en un Mac M1 Pro)
NOMBRE=sabor-a-retablo-menu SEGUNDOS=60 python3 exportar.py
```

Cuadros sueltos para mirar: `K=8 node render.mjs frames 9.6 25 40` → `previa/`.

## Dónde está cada cosa

| Archivo | Qué |
| --- | --- |
| `src/main.js` | carga y `window.seek(t, K)` |
| `src/motor.js` | WebGL, acumulación de submuestras, lente, brillo, color |
| `src/guion.js` | qué se ve en cada t: apertura, tarjetas y transiciones, cierre |
| `src/guion_retablo.js` | coreografía del retablo (puertas, ranura, polvo, cámara, portal) |
| `src/retablo.js` | el retablo 3D, el salón, la firma y su polvo dorado |
| `src/tarjetas.js` | las doce tarjetas: productos, textos, precios, colores, cámaras |
| `src/nicho.js` | un nicho: sala, arcos, flor en relieve, podios, motivos, luces |
| `src/transiciones.js` | pilastra, cornisa, tablas-prisma, remolino de hojas, puertas |
| `src/piezas.js` | piezas 3D (producto, letras, sello, podio, pedestal, foto en arco…) |
| `prep.py`, `prep_retablo.py` | lo que se toma del repo y de la carta |
| `audio.py`, `estudio2.py` | música y efectos (sintetizados, sin muestras) |

Para cambiar un producto: la lista `TARJETAS` de `prep.py` (preferidos por slug) y la tarjeta en
`src/tarjetas.js`. Los precios salen de la carta publicada: si cambian en el panel, basta con borrar
`carta.json`, volver a correr `prep.py` y generar los cuadros.
