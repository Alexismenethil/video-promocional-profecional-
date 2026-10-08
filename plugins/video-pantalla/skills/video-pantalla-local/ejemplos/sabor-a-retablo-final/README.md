# Sabor a Retablo — menu board, versión final (2:15 en bucle)

Video en bucle para la pantalla del local. Abre y cierra con el retablo de la marca en 3D: la firma se
deshace en polvo dorado que entra por la ranura, las puertas se abren y la cámara entra por el
retablo. Adentro, veintidós tableros limpios, como los de la primera versión: el color de la paleta
del retablo, la flor de la marca enorme y tono sobre tono, el producto recortado bien grande, su nombre
y su precio. Al final la cámara sale, las puertas se cierran de un portazo y el polvo vuelve a armar el
logo: el último cuadro empalma con el primero.

- 40 productos de la carta publicada: todos los crepes (16), todos los helados (6), todos los
  milkshakes (5), los cinco frappés, cuatro cafés, Torta Matilda, Red Velvet, Tiramisú de Pistacho y
  la chapla de chancho a la caja china.
- 128 BPM, 72 compases = 135 s exactos. El reloj de imagen y sonido es `cues.py` → `cues.js`.
- Imagen: three.js (WebGL) con la GPU en Chrome sin cabeza. Cada cuadro promedia de 10 a 24
  instantes: desenfoque de movimiento real, profundidad de campo y antialias. Luego brillo, curva de
  color, viñeta y grano.
- Fotos: las de la carta publicada (leída con GET), recortadas con el recorte de sujeto de macOS
  (Vision), en local. Donde el encuadre de la foto cortaba el plato, `completar_plato.py` lo completa
  (elipse del plato, loza y motas de la misma foto). La comida cortada no se inventa: ese lado del
  crepe sale de cuadro por el borde de la pantalla, o queda bajo el sello del precio. El milkshake de
  Oreo sube desde abajo, con el pie fuera de cuadro.
- Precios: debajo de cada producto (54 px de diseño; 48 en las filas de vasos) y en el sello de la
  flor (radio 156) en los tableros de un solo producto. Se cambian en `src/tableros.js`.
- Transiciones: tablas que giran (trivisión), látigo, la flor de la marca que se abre y deja ver el
  tablero siguiente en su disco, empuje con filete crema y, a mitad, las puertas del retablo.

## Regenerar

```bash
CARTA_URL=https://<api-publica>/api/carta python3 prep.py /ruta/al/repo   # productos (usa carta.json si existe; si no, la lee con GET)
python3 completar_plato.py crepes-primaveral crepa-galaxia mega-crepa crepa-fresa crepa-tropical \
  crepa-lluvia-de-coco sabor-a-otono   # platos cortados por el encuadre → fotos/*-completo.png
python3 prep.py /ruta/al/repo          # otra vez: ahora recorta desde los platos completados
python3 prep_retablo.py /ruta/al/repo  # texturas del retablo y motivos pintados
python3 cues.py                        # reloj
npm install
node render.mjs eventos                # eventos de sonido de los tableros → eventos.json
python3 audio.py                       # audio/pista.wav y audio/efectos.wav
K=1 SALIDA=rapido node render.mjs video 30           # previa rápida
ESCALA=2 TRABAJADORES=3 node render.mjs video 60     # cuadros 4K (~22 min en un Mac M1 Pro)
NOMBRE=sabor-a-retablo-menu-final SEGUNDOS=2m15 FORMATOS=4k-60fps python3 exportar.py
```

Sin `FORMATOS`, `exportar.py` saca también 1080 a 60 y a 30 fps.
Cuadros sueltos para mirar: `K=10 node render.mjs frames 9.1 37.25 54.1` → `previa/`.

## Dónde está cada cosa

| Archivo | Qué |
| --- | --- |
| `src/tableros.js` | los veintidós tableros: productos, textos, precios, colores (maquetas en px de 1920×1080) |
| `src/tablero.js` | un tablero en 3D: fondo, flor, florcitas, productos con sombra, letras, sellos |
| `src/guion.js` | qué se ve en cada t: apertura, tableros y transiciones, cierre |
| `src/guion_retablo.js` | coreografía del retablo (puertas, ranura, polvo, cámara, portal) |
| `src/retablo.js` | el retablo 3D, el salón, la firma y su polvo dorado |
| `src/transiciones.js` | tablas-prisma, flor-portal, empuje, puertas |
| `src/motor.js` | WebGL, acumulación de submuestras, lente, brillo, color |
| `prep.py`, `prep_retablo.py` | lo que se toma del repo y de la carta |
| `completar_plato.py` | retoque de los platos cortados por el encuadre de la foto |
| `audio.py`, `estudio2.py` | música y efectos (sintetizados, sin muestras) |

Para cambiar un producto o un texto: `src/tableros.js` (y su lista en `PRODUCTOS` de `prep.py` si es
nuevo). Los precios salen de la carta publicada: si cambian en el panel, basta con borrar `carta.json`,
volver a correr `prep.py`, `node render.mjs eventos`, `audio.py` y generar los cuadros.
