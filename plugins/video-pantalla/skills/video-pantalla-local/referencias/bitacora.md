# Bitácora de videos de pantalla

Se lee **antes** de empezar un video y se le agrega una entrada **al terminarlo**. Es lo que hace
que cada video salga mejor que el anterior: lo que el usuario aprobó, lo que corrigió y lo que costó
técnicamente. Anotar hechos concretos (tiempos, valores, nombres de archivo), no impresiones.

## Preferencias del usuario (vigentes)

- **Producción no se toca.** Se alarmó al leer «render» (su API corre en Render.com). Decir «generar
  cuadros» o «exportar». De la carta publicada solo lectura (GET), y lo pidió explícitamente: «usa las
  fotos reales del desplegado».
- **Fotos reales** de la carta publicada, no las provisionales del repo. Pero si una foto real luce
  mal en el diseño, prefiere la foto de la casa (rechazó el Mocaccino real: «está feíta»).
- **Entrega completa**: 4K 60, 1080 60 y 1080 30; cada uno con música y solo efectos. Suele poner
  su propia música; la mía es de respaldo. Los efectos importan.
- **Diseño limpio y bonito** por encima de todo; sorprender («bonito y llamativo»). Le gustó que cada
  video tenga una idea propia salida de la marca, no una plantilla.
- Trabajo en línea, sin subagentes salvo que los pida. Verificar con los ojos antes de decir listo.
- Mensajes en español, cortos, con avances cada tanto; al final, qué se entregó y dónde.
- Los videos quedan en `<repo>/output/video/` sin commit; las versiones anteriores se mueven a la
  carpeta temporal, no se borran.

## Video 1 · Sabor a Retablo (café · crepes · helados, Ayacucho) — 27-sep-2026

**Idea.** El retablo ayacuchano (caja de madera con puertas pintadas) es el objeto de la marca: se
centra, **abre sus puertas** con resorte y estallido de pétalos, la cámara **entra por la hornacina**
(portal: el yeso con un hueco recortado en `clip-path` evenodd y zoom exponencial) y recorre tres
escenas —café (arco con foto y vapor), crepes (dos arcos + cinta de nombres), helados (bolas que caen
en fila con aplastamiento y bailan al pulso)—, sale, **las puertas se cierran de un portazo** y el
logo firma con brillo. Huayno-pop a 120 BPM en 2/4 (La menor → La mayor): charango, quena, bombo
legüero, chajchas.

**Lo que el usuario corrigió o pidió**
- «No se toca producción»: se asustó con la palabra render. Desde entonces: «generar cuadros».
- Fotos del desplegado (la carta publicada), no las por defecto. Los sabores sí estaban bien.
- Versión solo efectos además de la con música.
- El café real (Mocaccino) se veía pobre en el arco → volver a la foto de la casa.
- Exportar en 4K 60, 1080 60 y 1080 30.

**Lecciones técnicas**
- Puertas 3D: las caras traseras eran más angostas que las delanteras y quedaban rayas flotando en
  el canto → estirar los dorsos al ancho del frente.
- Los rayos de luz del nicho tapaban el contenido → recortarlos con el mismo hueco que el yeso.
- El yeso con manchas verdes en las esquinas → fondo más grande (`background-size` 2520px).
- Un brillo blanco sobre el logo **borraba** letras claras → brillo turquesa (del color de la marca).
- Título que chocaba con el arco → bajar tamaño y mover el arco: probar siempre el texto más largo.
- Bolas de la segunda fila atravesaban la primera → hacer caer primero la fila de abajo.
- Bolas con la base blanca de estudio pegada → quitarla por textura (`quitar_base_lisa.py`).
- La flor del logo desaparecía sobre turquesa → ponerla en un sello crema.
- Audio: intro 13 dB más baja que el groove, charango enterrado, bombo alto, casi mono → rebalancear
  con DIAG por bus, más paneo, limitador a −2 dBFS. Compresor con NaN (el pasabajos de la envolvente
  oscila bajo cero) → `np.maximum(…, 0)` antes de la raíz. Siseo del vapor demasiado presente → bajarlo.
- Chrome se colgaba con varias pestañas (`Runtime.callFunctionOn timed out`) → un navegador por
  trabajador y banderas anti-estrangulamiento (ya en `render.mjs`).
- zsh: `rm previa/*.png` sin coincidencias corta toda la cadena `&&` → usar `find … -delete` o `;`.

## Video 2 · EOS Gelato (gelatos, sorbetes, bebidas, Ayacucho) — 27-sep-2026

**Idea.** «Eos» es la diosa del amanecer. El logo EOS (letras blanditas) se vuelve **ventana**: cada
letra se llena de un gelato real (frutos rojos, maracuyá, cacao) con una ola que sube; la «O» cierra su
hueco y la cámara **entra por la O** al Maracuyá, cuya foto tiene un atardecer sobre cerros (el
amanecer andino). Esa foto **se encoge en un arco** y abre la vitrina «Gelatos y sorbetes» sobre verde
bosque (arcos que avanzan un lugar por pulso). **Jarabe de frambuesa** chorrea y trae el carrusel 3D de
«Milkshakes, sodas y frozen». La cámara **sale por la S** (las letras recortan la escena), las letras
se vacían en verde, el logo se asienta con gelatina y firma «Gelato artesanal *en Ayacucho*» con las
monsteras de la carta. House suave a 128 BPM (8 compases = 15 s): piano FM, kalimba, silbido.

**Lo que gustó.** «Me sorprendes cada vez más.» La idea salida del nombre y del logo; el amanecer.

**Lecciones técnicas**
- El PNG del logo tiene escalera de píxeles; potrace la copia y al hacer zoom se ven dientes →
  desenfocar el alfa (σ 1,6), ampliar ×8 cúbico y recién trazar (`vectorizar_logo.py`).
- Dentro de las letras se veía el logo EOS de los vasos (EOS dentro de EOS) y el borde del vaso →
  encuadrar sobre la bola (foco más arriba, zoom ×2,25 de la altura de la letra).
- **Zoom con paralaje**: la foto vive en un plano más lejano y crece menos que la letra; a mitad del
  zoom el borde de la foto asomaba dentro de la O (franja marfil) → al terminar el zoom la foto debe
  sobrar (cubrir ×1,08 y 160 px por arriba). Calcular la condición, no adivinar (ver recetas).
- Al encoger la foto a un arco, la escala de la foto caía más rápido que el marco → **encuadre por
  cobertura**: la foto cubre siempre el rectángulo que la recorta (`cubrir` / `encuadrarCaja`).
- Los arcos de la vitrina tenían una franja oscura arriba (escala por el alto sin cubrir) → mismo arreglo.
- Las fotos del carrusel no se encuadraban (faltaba llamar al encuadre) → se ven en la tira rápida.
- El jarabe parecía alfileres (dedos iguales con bolas) → dedos que se afinan, gota apenas más ancha
  que el cuello, anchos y largos variados (los finos bajan más), frente ondulado, veta de brillo.
- Partículas encima de los productos ensucian → dibujarlas detrás de los arcos (un lienzo por escena).
- `clip-path` en el mismo elemento que `filter: blur()` corta el desenfoque (la sombra salía dura) →
  el desenfoque en el padre y el recorte en el hijo.
- El arco que aterriza se cambia por el arco del DOM: igualar sombra y encuadre y comparar los dos
  cuadros (diferencia de recortes) para que el cambio sea invisible.
- Hojas de monstera: pivote del vaivén en el tallo (no en la esquina de la imagen) y metidas en las
  esquinas; si no, compiten con el logo.
- `render.mjs` quedaba minutos colgado al final (conexiones abiertas) → `closeAllConnections` y `exit`.
- `verificar.sh`: ffmpeg dentro de `while read` se come la entrada → `-nostdin`.
- 900 cuadros 4K con desenfoque: 11 min. Exportar: 3,5 min. Costura medida: 0,344 vs vecinos 0,335.

## Para el próximo video (ideas pendientes)

- Pedir al cliente las fotos originales en alta (las de la carta vienen a ~1100 px): en 4K una foto a
  pantalla completa se amplía ×3,4. Mientras tanto: ampliación Lanczos + nitidez (`doble.py`) y no
  dejar una foto a pantalla completa más de ~1,5 s quieta.
- Probar una escena con producto recortado (sin fondo) si hay recortes buenos: da más profundidad.
- Si piden redes: 1080×1920 (9:16) cambia la composición entera; no es escalar el 16:9.
- Considerar un cierre con dato útil (horario, @instagram) si el usuario lo pide; por defecto, limpio.

## Plantilla de entrada nueva

```
## Video N · <Negocio> (<rubro>, <ciudad>) — <fecha>
**Idea.** <el hilo conductor en 4–6 líneas: qué objeto o palabra de la marca lo mueve y el recorrido>
**Lo que gustó / lo que corrigió.** <citas cortas del usuario y el cambio que se hizo>
**Lecciones técnicas.** <problema → causa → arreglo, con valores>
**Tiempos.** cuadros 4K <min>, exportar <min>, costura <valor>.
```
