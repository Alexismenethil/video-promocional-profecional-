---
name: animacion-html-deterministica
description: Construye animaciones de motion design en HTML/CSS/Canvas/SVG como función pura del tiempo (window.seek(t)) para generarlas cuadro a cuadro con Chrome sin cabeza en 1080 o 4K, con desenfoque de movimiento y bucle perfecto. Incluye una plantilla lista (firma, iris, vitrina de arcos, jarabe, carrusel 3D) y recetas probadas (letras-ventana, zoom con paralaje, portal, puertas 3D, partículas, encuadre por cobertura). Úsala para animar el guion de un video de pantalla o cualquier motion que deba exportarse a video.
when_to_use: Fase 4 de video-pantalla-local. También cuando haya que depurar un efecto (huecos, saltos entre cuadros, cosas que aparecen de golpe), portar un efecto de un video anterior o escribir el cues.js.
---

# Animación HTML determinista

La animación es una página web de **1920×1080 fijos** que expone `window.seek(t)`: dibuja el instante
`t` (segundos) sin depender de nada anterior. `render.mjs` (skill `generar-y-exportar-video`) abre la
página en Chrome sin cabeza, llama a `seek` para cada cuadro (y varias veces por cuadro para el
desenfoque) y captura. Con `deviceScaleFactor: 2` la misma página sale en 4K nítido.

## Camino 3D (WebGL, three.js) — cuando piden «inmersión»
Chrome sin cabeza en el Mac usa la GPU (`--use-angle=metal`: ANGLE Metal, WebGL2, texturas float). Con
three.js la página arma escenas 3D reales y `window.seek(t, K)` promedia **dentro de la página** K
instantes en un render target HalfFloat: tiempo dentro del obturador (desenfoque de movimiento), cámara
corrida en un disco de apertura con cizalla de proyección (profundidad de campo) y jitter de subpíxel
(antialias). Después brillo, curva, viñeta y grano; una sola captura por cuadro. 4K: 0,3–0,75 s por
cuadro. Código completo y comentado: `../video-pantalla-local/ejemplos/sabor-a-retablo-3d/` (motor,
portal, nichos, transiciones, textos por glifo, motivos de papel, polvo de partículas). Reglas extra:
texturas con `colorSpace` sRGB y color sangrado hacia lo transparente; nada de `Math.random` (azar con
semilla); fotos de producto como planos que miran a la cámara (los platos fotografiados desde arriba,
**flotando**); cuidado con lo crema bajo un spot (pasa de 1 y florece).

## Empezar
La carpeta de trabajo ya trae la plantilla (`video-pantalla-local/scripts/nuevo_proyecto.sh`):

```
index.html   escenario, capas y estilos (tokens de la marca en :root)
anim.js      MOTOR (librería) · ESCENAS (se reescriben) · ARRANQUE (listo, seek, ?t, ?play)
cues.js      el reloj: tiempos de cada evento + tramos de submuestras
assets/      datos.js (de la carta), fotos/, fonts/, logo.js (si se usa el logo vectorizado)
audio.py     partitura (skill sonido-para-video)
```

Ciclo de trabajo: editar → `node render.mjs frames 0 1.2 2.5 …` → mirar `previa/` (hoja de contactos con
`herramientas/hoja.py`) → corregir. Para ver en vivo: servir la carpeta y abrir `index.html?play`
(clic = con sonido) o `index.html?t=3.2` para congelar un instante.

## Reglas del motor (no negociables)

1. **Pura en el tiempo.** Todo sale de `t` y de constantes. Nada de `Date.now()`, `Math.random()` sin
   semilla (`azar(seed)`), acumuladores ni estado entre cuadros. Física en forma cerrada (fórmula del
   instante), no integrada paso a paso.
2. **Cada `seek` fija todo lo que toca.** El DOM persiste entre llamadas del mismo trabajador: si un
   estilo solo se asigna dentro de un `if`, queda el valor de otro instante. Usar `ver(el, o)` para
   mostrar/ocultar y volver a fijar clips, transforms y textos siempre.
3. **Bucle exacto.** `t` se normaliza a `[0, dur)`. Todo lo ambiental (partículas, vaivenes, grano) da
   vueltas **enteras** en `dur` (`ciclo(t, n)`), y el estado en `t = dur` es idéntico al de `t = 0`: el
   último tramo termina exactamente en la pose del primero.
4. **Vectorial antes que bitmap.** Texto, formas, recortes (`clip-path: path()`), logos vectorizados:
   todo escala a 4K. Los bitmaps grandes, con versión `@2x` (Lanczos) y elegidos por `devicePixelRatio`.
5. **Lienzos a la densidad real**: `canvas.width = 1920·DPR` y `setTransform(DPR,…)` (`lienzo()`,
   `limpiar()`); desenfoques y sombras de canvas multiplicados por DPR.
6. **Listo antes de capturar**: `window.listo` espera fuentes (`document.fonts.load` de cada peso) e
   imágenes decodificadas (`img.decode()`), y hace un `seek(0)`.
7. **Un solo reloj**: los tiempos viven en `cues.js`, no sueltos en `anim.js`; `audio.py` lee el mismo
   archivo. Cambiar un tiempo = cambiarlo en un lugar.

## cues.js
```js
window.CUES = {
  "dur": 15.0, "fps": 60, "bpm": 128, "pulso": 0.46875,
  "iris": [0.47, 1.25],                 // [inicio, fin] de un movimiento
  "arcos": [1.875, 2.109, 2.344],       // eventos puntuales (uno por pulso)
  "llenado": { "E": [0.9, 1.5] },       // se permiten objetos
  "muestras": [[0.47, 1.25, 6], …]      // [desde, hasta, submuestras] para render.mjs
};
```
Los tiempos caen en pulsos (`n × pulso`). `muestras`: 2 por defecto; 4–6 en movimientos medianos; 8–12
en zooms, látigos y jarabe (un borde que corre más de ~40 px por cuadro necesita ≥8).

## La librería del motor (anim.js de la plantilla)

| Función | Para qué |
| --- | --- |
| `clamp, lerp, prog(t, a, b)` | `prog` = 0→1 entre a y b (la base de todo) |
| `E.inOutCubic, outBack(u, s), outQuint, inOutSine…` | curvas; `outBack` para resortes cortos |
| `vaiven(s, f, z)` | oscilación amortiguada (gelatina, rebote) desde que pasó un evento |
| `ciclo(t, n)` | fase de n vueltas exactas en la duración (ambiente periódico) |
| `mul, T, S, ap, sobre` | afines 2D para transformar caminos (logo, zoom de cámara) |
| `azar(seed)` | aleatorio reproducible (partículas, gotas) |
| `dArco(x0,y0,x1,y1,rt,rb)` | arco/rectángulo redondeado como camino para `clip-path` |
| `dOla / olaEn` | región bajo una ola: líquido que sube o baja dentro de una forma |
| `clip(el, d, evenodd)`, `ver(el, o)` | recorte y visibilidad, siempre fijados |
| `sube(el, t, t0, dur, salida)` | palabra que sube de su renglón (con desenfoque que se aclara) |
| `encuadrarCaja(img, w, h, fx, fy, zoom)` | foto que **cubre** la caja con su foco al centro |
| `lienzo(id)`, `limpiar(l)` | canvas a DPR |
| `virutas(ctx, t, paleta, peso)` | partículas periódicas |
| `jarabe(l, t, u, colores)` | transición de jarabe que chorrea (u 0→1) |
| `circulo(cx, cy, r)` | círculo como camino (iris) |

## Capas (orden típico, de abajo arriba)
fondo de la firma → partículas del fondo → logo/firma → escena B (fondo, partículas, piezas, textos) →
foto protagonista (si viaja entre escenas) → lienzo del jarabe → escena C → textos globales → partículas
de primer plano → viñeta → grano. Cada escena es un contenedor de 1920×1080 que se muestra con
`ver()` solo en su tramo; las transiciones recortan contenedores (`clip-path`) o los tapan.

## Recetas y trampas
- [referencias/recetas.md](referencias/recetas.md) — el código de cada efecto que ya funcionó: letras-
  ventana, zoom con paralaje (con la fórmula del margen), salida por una letra y vaciado, encoger en un
  arco, portal por un hueco, puertas 3D, carrusel, jarabe, partículas con física cerrada, brillo, hojas.
- [referencias/trampas.md](referencias/trampas.md) — errores ya cometidos y cómo se evitan.
- Código completo de los dos videos: `../video-pantalla-local/ejemplos/`.

## Antes de pasar a generar cuadros
- [ ] `node render.mjs frames` en cada cue (inicio, mitad y fin de cada movimiento) y hoja de contactos.
- [ ] 2–3 cuadros a resolución completa: bordes, textos, fotos sin franjas.
- [ ] `t=0` y `t=14.99` iguales a la vista; en `render.mjs video` la costura se mide.
- [ ] Previa rápida (`MUESTRAS=1`) + tira cada 0,1 s: sin saltos ni huecos entre cuadros clave.
