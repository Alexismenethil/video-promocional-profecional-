---
name: video-pantalla-local
description: Crea un video promocional de 15 s en bucle para la pantalla (TV) de un negocio —cafetería, heladería, crepería, restaurante— con motion design hecho en código (HTML + Chrome sin cabeza), fotos reales de la carta publicada, sonido sintetizado y exportación en 4K 60, 1080 60 y 1080 30, cada uno con música y solo efectos. Úsala cuando pidan «un video para la pantalla del local», «una animación bonita y llamativa como las de los negocios», «un motion de 15 segundos», un reel o promo del negocio, o una versión nueva o mejorada de un video anterior.
when_to_use: También cuando el usuario comparta un video de referencia y pida «hazlo así», cuando pida cambiar fotos, productos, textos o formatos de un video ya hecho, o cuando pregunte cómo se hizo uno de estos videos. Es la skill de entrada; ella indica cuándo usar las demás del plugin.
---

# Video para la pantalla del local (15 s en bucle)

Esta skill dirige el trabajo completo. El detalle técnico vive en las skills hermanas; léelas
cuando llegues a su fase, no antes:

| Fase | Skill | Qué resuelve |
| --- | --- | --- |
| Marca y fotos | `marca-y-carta-publicada` | identidad, carta publicada (solo lectura), fotos, logo vectorizado, fuentes |
| Idea y guion | `direccion-creativa-video` | concepto, guion por pulsos, color, tipografía, transiciones, casos anteriores |
| Animación | `animacion-html-deterministica` | `seek(t)` puro, plantilla, recetas de cada efecto, trampas |
| Sonido | `sonido-para-video` | música de respaldo + efectos, mezcla y master (audiolib.py) |
| Cuadros y archivos | `generar-y-exportar-video` | cuadros 4K con desenfoque de movimiento y los 6 MP4 |
| Control de calidad | `revisar-video` | hojas de contactos, tira de cuadros, costura del bucle, espectrograma |

Cada video tiene que salir **mejor que el anterior**: antes de empezar se lee la bitácora y al
terminar se le agrega lo aprendido (ver [referencias/bitacora.md](referencias/bitacora.md)).

## Qué se entrega (definición de terminado)

En `<repo-del-negocio>/output/video/` (sin commit, sin push):

```
4k-60fps/   <negocio>-15s-con-musica-4k-60fps.mp4     <negocio>-15s-solo-efectos-4k-60fps.mp4
1080-60fps/ <negocio>-15s-con-musica-1080-60fps.mp4   <negocio>-15s-solo-efectos-1080-60fps.mp4
1080-30fps/ <negocio>-15s-con-musica-1080-30fps.mp4   <negocio>-15s-solo-efectos-1080-30fps.mp4
<negocio>-efectos.wav      la pista de efectos suelta, para montar otra música
fuente/                    el proyecto para regenerarlo (sin node_modules ni cuadros)
```

- 15,000 s exactos, 60 fps (o 30), bucle **sin costura**: el último cuadro empalma con el primero en
  imagen y sonido (se mide, no se supone: skill `revisar-video`).
- 4K: HEVC `hvc1` nivel 5.1, tope 38 Mb/s. 1080: H.264 High 4.2 (60 fps) y 4.1 (30 fps). AAC 256 kb/s.
- Audio con música a −16 LUFS; solo efectos a pico real ≈ −1,6 dBTP (queda entre −18 y −21 LUFS).
- Fotos **reales** de la carta publicada; nombres como están publicados (limpios de tildes y mayúsculas).
- Se revisaron cuadros del archivo **final** (decodificado), no solo los de la animación.

El usuario pidió este juego completo (3 formatos × con música y solo efectos). No preguntes formatos:
entrégalos todos. La música es de respaldo: el usuario suele poner la suya, así que los efectos importan
tanto como la imagen.

## Reglas que no se negocian

1. **Producción no se toca.** Ni deploy, ni base de datos, ni Render, ni Vercel, ni el panel. De la
   carta publicada solo se hace `GET` anónimo, como el teléfono de un cliente, y se guarda una copia
   local (`carta.json`) para no repetir la consulta. Detalle en `marca-y-carta-publicada`.
2. **No digas «render»**: en estos proyectos suena a Render.com (el hosting de la API) y alarma al
   usuario. Di «generar cuadros» y «exportar».
3. **Todo se trabaja en la carpeta temporal de la sesión** (scratchpad). En el repo del negocio solo
   se escribe `output/video/` al final. Nada de commits ni push en el repo del negocio.
4. **Activos heredados, con desconfianza**: un repo copiado de otra marca puede traer logos, fondos o
   fotos de la otra (Sabor a Retablo traía cosas de EOS Gelato). Mira cada imagen antes de usarla.
5. **Diseño limpio primero**: pocas cosas, bien hechas. Si un adorno compite con el producto, sale.
6. **Verifica con los ojos antes de decir «listo»**: cuadros clave, tira completa, archivo final.
7. **Sin subagentes** salvo que el usuario los pida: se trabaja en línea con las herramientas propias.
8. Escribe al usuario en español, con avances cortos. Nada de jerga innecesaria.

## Flujo de trabajo

### 0. Antes de empezar
- Lee [referencias/bitacora.md](referencias/bitacora.md): preferencias del usuario, qué aprobó, qué
  rechazó y las lecciones técnicas de cada video.
- Si hay un video de referencia, míralo por cuadros (`ffmpeg -ss … -frames:v 1`) y describe cómo está
  hecho (cámara, transiciones, ritmo, sonido) antes de proponer.
- Dile al usuario dónde vas a trabajar y que no se toca el repo ni producción.

### 1. Marca y carta → skill `marca-y-carta-publicada`
Identidad (colores, tipografías, motivos, significado del nombre, el local físico), carta publicada
(qué productos hay, cuáles tienen foto), fotos bajadas y mirando una hoja de contactos, logo
vectorizado si la idea usa letras, fuentes copiadas del build.

### 2. Idea y guion → skill `direccion-creativa-video`
Un hilo conductor que salga de la marca (el retablo que se abre; las letras de EOS como ventanas; el
amanecer de «Eos»). Guion en pulsos (128 BPM = 8 compases justos en 15 s). Escribe `cues.js`.

### 3. Armar la carpeta de trabajo
```bash
bash ${CLAUDE_SKILL_DIR}/scripts/nuevo_proyecto.sh <scratchpad>/<negocio>
```
Copia la plantilla (index.html, anim.js, cues.js, audio.py, assets de muestra), `render.mjs`,
`exportar.py`, `audiolib.py`, los scripts de revisión y de marca (en `herramientas/`) e instala
`puppeteer-core` y `sharp`. Requisitos: Google Chrome, Node 20+, Python 3 con numpy, scipy, pillow y
fonttools, ffmpeg con libx264/libx265, potrace.

### 4. Animar → skill `animacion-html-deterministica`
Reemplaza las escenas de la plantilla por las del guion. Cuadros sueltos para mirar:
`node render.mjs frames 0 1.2 2.4 …` → `previa/`.

### 5. Revisar cuadros clave → skill `revisar-video`
Hoja de contactos de los instantes de cada cue; 2 o 3 cuadros a resolución completa. Iterar hasta
que cada cuadro se vea bien por sí solo (encuadres, textos legibles, nada tapando el producto).

### 6. Sonido → skill `sonido-para-video`
`audio.py` con audiolib: música de respaldo + un efecto por cada evento visual. Espectrograma con las
marcas de `cues.js` y chequeo de la costura.

### 7. Previa rápida y tira
`MUESTRAS=1 SALIDA=rapido node render.mjs video 30` (≈1 min) y `tira.py rapido --fps 30 --cada 3`:
150 miniaturas para ver el movimiento completo (saltos, huecos, cosas que aparecen de golpe).

### 8. Cuadros 4K y exportación → skill `generar-y-exportar-video`
`ESCALA=2 node render.mjs video 60` en segundo plano (≈11 min) y `NOMBRE=<negocio> python3 exportar.py`
(≈3,5 min). Mientras tanto: README de la fuente, revisión del audio.

### 9. Verificar lo exportado → skill `revisar-video`
`verificar.sh salida` (códec, nivel, duración, LUFS), `costura.py` (imagen y audio), cuadros sacados
del MP4 final y un recorte a resolución nativa.

### 10. Entregar y anotar
- Copiar a `<repo>/output/video/` (ver [referencias/entrega.md](referencias/entrega.md)), `git status`
  para mostrar que solo apareció `output/`.
- Enviar los dos 4K al usuario (SendUserFile) y un mensaje corto: la idea en 4–6 líneas, tabla de
  formatos, qué se dejó fuera y por qué, que producción no se tocó.
- **Agregar una entrada a la bitácora** con lo aprendido (qué gustó, qué se corrigió, qué mejorar).

## Tiempos de referencia (Mac, 2026)

| Paso | Tiempo |
| --- | --- |
| Leer carta (Render gratis despierta) | ~1 min la primera vez |
| Un cuadro suelto 1080 | ~1 s |
| Previa rápida 450 cuadros (30 fps, sin desenfoque) | ~30 s de cuadros |
| 900 cuadros 4K con desenfoque (6 Chrome) | 10–15 min |
| Exportar 3 formatos × 2 pistas | ~3,5 min |
| audio.py | 5–10 s |

## Si piden cambios después de entregar
- Cambiar una foto: editar la selección en prep (o `datos.js`), regenerar cuadros y exportar. Si una
  foto real se ve mal, ofrecer la foto de la casa (el usuario lo prefirió así con el Mocaccino).
- Cambiar música: solo `audio.py` + exportar (no hace falta regenerar cuadros).
- Mover las versiones anteriores a la carpeta temporal (no borrarlas) antes de copiar las nuevas.

## Archivos de esta skill
- [referencias/bitacora.md](referencias/bitacora.md) — preferencias del usuario y lecciones por video.
- [referencias/entrega.md](referencias/entrega.md) — estructura de entrega, README de la fuente, mensaje final.
- `scripts/nuevo_proyecto.sh` — arma la carpeta de trabajo desde la plantilla.
- [ejemplos/](ejemplos/) — el código completo de los dos videos hechos (Sabor a Retablo y EOS Gelato).
