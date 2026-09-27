# Catálogo: evento visual → efecto de sonido

Llamadas de `audiolib.Estudio` con valores que funcionaron. `t0` siempre sale de `cues.js`.

| Evento en pantalla | Efecto | Llamada típica |
| --- | --- | --- |
| Algo se retira (lema que se va) | soplido corto que baja | `soplido(t0, 0.34, 2600, 700, vel=0.16, q=1.2)` |
| Logo o pieza blanda que crece | gelatina que sube | `gelatina(t0, 150, 330, vel=0.9)` |
| …que se asienta | gelatina que baja | `gelatina(t0, 360, 150, vel=0.75)` |
| Algo que se llena (letras, vaso) | burbujas que suben de tono | `llenado(a, b-a, 330, 700, pan=-0.55, semilla=k)` (un rango por pieza: 330→700, 400→860, 480→1050) |
| …que se vacía | burbujas que bajan | `llenado(a, b-a, 900, 320, baja=True)` |
| Un hueco que se cierra / tapón | bloop | `bloop(t0, 0.9)` (0,2 s antes del cierre) |
| Entrada grande (zoom, portal) | impacto en el tiempo fuerte + whoosh ancho | `impacto(t0)`; `soplido(t0, dur+0.25, 280, 5200, vel=0.85, q=1.3)` |
| Llegada luminosa (amanecer, luz) | campanas ascendentes + chispas | `campana(t0-0.18+k*0.055, [77,81,84,89,93,96][k])`; `chispas(t0-0.1, 0.5, n=9)` |
| Amanecer, jardín | pajaritos lejanos | `pajarito(t0+0.12, pan=0.55)` (2–3 grupos, muy bajos) |
| Título que entra | soplido suave | `soplido(t0, 0.36, 700, 3000, vel=0.14, forma=…sin²·(1−0,5u))` |
| Foto que se encoge y aterriza | whoosh que baja + pop | `soplido(e0, dur, 4200, 420, forma=(1-u)^1.3)`; `pop(e1, 72)` |
| Pieza que aparece (arco, bola) | pop afinado (notas del acorde) | `pop(t0+0.02, [77,81,84][k], pan=…)` |
| Fila/carrusel que corre un lugar | whoosh corto + tic al encajar | `soplido(p-0.02, 0.36, 500, 2200, pan_de=0.5, pan_a=-0.5)`; `tic(p+0.3)` |
| Carrusel que entra girando | whoosh circular (paneo que cruza) | `soplido(c0, dur, 350, 2600, pan_de=-0.8, pan_a=0.6, forma=sin(πu^0.6)²)` |
| Jarabe/salsa que cae | riser + impacto + chorro + gotas + splat | `subida(g0-0.9, 0.9)`; `impacto(g0, 0.75, cola=0.3)`; `jarabe(g0, dur)` |
| Cámara que sale (inverso) | succión que baja + impacto suave | `soplido(s0, 0.85, 5200, 260, forma=(1-u)^1.6·min(1,14u))`; `impacto(s0, 0.45, cola=0.25)` |
| Puerta que se abre | soplido lateral | `soplido(t0, 0.55, 300, 1200, pan_de=-0.1, pan_a=-0.7, q=1.2)` |
| Portazo | madera modal + bombo + golpe | `madera(t0, 1.0)`; `madera(t0+0.09, 0.28, tono=1.15)` |
| Pétalos, papel picado | aleteos secos | `papel(t0, 0.95, n=40)` |
| Vapor | siseo muy bajo | `siseo(t0, 1.5, vel=0.45)` |
| Filete que se dibuja | roce metálico + campanita | `hilo(t0, 0.9)` |
| Brillo sobre el logo | siseo agudo + campanita + chispas | `brillo(t0)` |
| Paneo rápido (látigo) | whoosh estéreo de lado a lado | `soplido(t0-0.05, 0.55, 400, 5500, pan_de=0.8, pan_a=-0.8, q=1.3)` |

Reglas: efectos «de ambiente» (vapor, pajaritos) casi inaudibles; los de golpe, claros. Nunca dos
whooshes grandes superpuestos. Cada efecto tiene su lugar en el estéreo según de dónde viene la imagen.
