# Casa del Retablo — video para la pantalla (2:48 en bucle, 4K a 60 fps)

Video en bucle con los retablos del catálogo 2025, en 3D de verdad. Abre con el logo en crema sobre el
rojo de la marca: las letras se van, y bajo el techo del logo sube un retablo cerrado cuyo frontón calza
con ese techo. Sus puertas se abren con un golpe de luz y flores, y la cámara entra por el nicho de
arriba, donde ya están las manos del maestro amasando. Al final, la cámara sale del nicho, las puertas
se cierran y la casa vuelve a ser el logo: el último cuadro empalma con el primero.

- **Retablos en 3D desde su foto.** Las fotos del catálogo vienen recortadas y con las puertas abiertas
  de frente. Se buscan las bisagras (las rendijas entre puertas y caja), se traza la silueta de la caja
  y de cada puerta, y se arman: la caja es su silueta extruida hacia atrás (techo a dos aguas o arco, con
  cantos de madera) y cada puerta es su silueta con grosor, colgada de su bisagra. Las puertas giran de
  verdad (por fuera se ve su pintura en espejo) y la luz principal da sombras suaves sobre la pared.
- **Precios por tamaño** (catálogo 2025): 19 × 20 cm S/ 100 · 15 × 30 cm S/ 160 · 22 × 32 y
  26 × 32 cm S/ 200 · 27 × 36 cm S/ 250 · 37 × 48 cm S/ 500 · 50 × 66 cm S/ 1 300, y piezas únicas,
  nacimientos, toritos, espejos y ángeles. Cada tamaño abre con su retablo y sus medidas dibujándose en
  3D, como el dibujo del catálogo, y el precio en una casita que cuelga de un hilo.
- 26 tableros: historia (fotos con paralaje), los tamaños lado a lado sobre un piso que refleja, héroes
  con medidas, filas, un carrusel, una pared de galería, ángeles que se mecen, espejos que reflejan, el
  museo y el maestro con el WhatsApp.
- Transiciones: el tablero se abre como las puertas de un retablo, la casita del logo como portal,
  tablas que giran, empuje, látigo, remolino de flores del logo y zambullida en un nicho.
- 120 BPM, 84 compases = 168 s exactos. El reloj de imagen y sonido es `cues.py` → `cues.js`.
- Música de respaldo sintetizada (huayno: bombo legüero, chajchas, charango, zampoña, quena, arpa) y
  los efectos en su propia pista.

## Regenerar

```bash
python3 prep.py <catalogo-extraido> <carpeta-de-fotos>   # recortes, bisagras, fotos, logo vectorizado
python3 siluetas.py                                      # siluetas de caja y puertas para el 3D
python3 cues.py                                          # reloj
npm install
node render.mjs eventos                                  # eventos de sonido → eventos.json
python3 audio.py                                         # audio/pista.wav y audio/efectos.wav
JPG=1 K=1 SALIDA=rapido node render.mjs video 30         # previa rápida (~2 min)
ESCALA=2 TRABAJADORES=3 node render.mjs video 60         # cuadros 4K
NOMBRE=casa-del-retablo SEGUNDOS=2m48 FORMATOS=4k-60fps python3 exportar.py
```

El catálogo se extrae del PDF con `pdfimages -j -p CATÁLOGO.pdf im` y cada imagen se une a su máscara
suave (la imagen del PDF ya viene recortada). Cuadros sueltos para mirar:
`K=6 node render.mjs frames 9.5 22 40` → `previa/`.

## Dónde está cada cosa

| Archivo | Qué |
| --- | --- |
| `src/tableros.js` | los 26 tableros: retablos, textos, precios, colores (px de diseño de 1920×1080) |
| `src/tablero.js` | un tablero: pared, flor del logo, florcitas, luz con sombras suaves, entradas, etiquetas |
| `src/retablo3d.js` | el retablo en 3D desde su foto (caja extruida, puertas con bisagra) y los recortes planos |
| `src/especiales.js` | medidas en 3D, fila de tamaños, carrusel, pared de galería, fotos con paralaje, ángeles, espejos |
| `src/apertura.js` | apertura y cierre (una sola escena; el cierre termina donde empieza la apertura) |
| `src/transiciones.js` | abrir, casa, tablas, empuje, flores |
| `src/guion.js` | qué se ve en cada t |
| `src/marca.js` | el logo vectorizado, la flor, la casita y las etiquetas de precio |
| `prep.py`, `siluetas.py` | lo que se toma del catálogo y de las fotos |
| `audio.py`, `estudio2.py`, `audiolib.py` | música y efectos (sintetizados, sin muestras) |
