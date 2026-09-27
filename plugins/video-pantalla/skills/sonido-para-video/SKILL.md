---
name: sonido-para-video
description: Diseño sonoro y música sintetizada (sin muestras ni licencias) para videos cortos en bucle con audiolib.py —instrumentos (charango, quena, piano FM, kalimba, silbido, bajo, batería, pads, campanas) y efectos (whoosh, riser, impacto, gelatina, burbujas, jarabe, pop, tic, madera, chispas, brillo)—, alineados al mismo reloj cues.js que la imagen, con plegado del bucle, mezcla por buses, compresión, limitador y medición LUFS. Entrega pista.wav (música + efectos, −16 LUFS) y efectos.wav (solo efectos). Úsala para ponerle sonido a un motion o video de pantalla.
when_to_use: Fase 6 de video-pantalla-local. También para cambiar solo la música de un video ya hecho, hacer la versión solo efectos, o revisar un audio que no se puede escuchar (espectrograma, niveles por bus, costura).
---

# Sonido para el video

Dos pistas, siempre: **con música** (respaldo) y **solo efectos** (el usuario suele poner su música y
necesita que la imagen «suene» igual). Todo sale de `cues.js`, así el sonido cae exacto en la imagen.

## Principios
1. **Un efecto por evento visual**, en el cuadro exacto (o 20–40 ms antes del golpe, nunca después).
2. **La música respeta el bucle**: el tempo hace que los compases cierren en la duración (128 BPM →
   8 compases en 15 s; 120 BPM 2/4 → 15 compases). El cruce del bucle (final + inicio) va tranquilo
   (la firma); la energía va en el medio. Lo que suena después de 15 s vuelve a entrar al comienzo.
3. **El estilo sale de la marca**: andino para un retablo (charango, quena, bombo legüero, chajchas);
   fresco y moderno para una heladería (house suave, piano FM, kalimba, silbido). Ver
   [referencias/composicion.md](referencias/composicion.md).
4. **No se puede escuchar: se mide.** Niveles por bus (`DIAG=1`), espectrograma con las marcas de los
   cues, LUFS, pico real y la costura. Nunca decir «suena bien»: decir qué se midió.

## Cómo se usa audiolib
```python
from audiolib import Estudio, leer_cues
C = leer_cues("cues.js")
e = Estudio(dur=C["dur"], bpm=C["bpm"], semilla=128)
tb = e.tb                                   # tb(compás, pulso) → segundos (compás desde 0)
e.bombo_house(tb(1, 0)); e.palmas(tb(1, 1))
e.acorde_piano(tb(1), [57, 60, 64, 67], 0.2, 0.7)
e.soplido(C["zoom"][0], 0.9, 280, 5200, vel=0.85)     # un whoosh sobre su cue
e.exportar("audio")                                   # audio/pista.wav y audio/efectos.wav
```
- La plantilla trae una partitura completa lista para adaptar: `../animacion-html-deterministica/plantilla/audio.py`.
- Partituras de los videos hechos: `../video-pantalla-local/ejemplos/{sabor-a-retablo,eos-gelato}/audio.py`
  (usan la versión anterior en un solo archivo; las funciones son las mismas que en audiolib).
- Buses: `bombo, perc, bajo, armonia, cuerdas, melodia, kalimba, colchon, campanas, fx`. **Todo efecto va
  a `fx`** (es lo único que sale en efectos.wav). Niveles por defecto en `Estudio.NIVEL`; se cambian en
  `e.nivel["perc"] = …`; envío a reverberación en `e.envio`; EQ extra en `e.eq[bus] = [("hp", 150), …]`.

## Referencia rápida de audiolib

**Instrumentos** — `cuerda` (Karplus-Strong) · `rasgueo(notas, t0, …)` (con `CHARANGO["Am"]` etc.) ·
`arpegio` · `quena` · `silbido(t0, dur, m, de=nota_anterior)` · `piano` / `acorde_piano` (FM) · `kalimba`
· `campana` · `colchon` (pad) · `bajo_pulsado` (house) · `bajo_redondo` (acústico) · `bombo_house` ·
`bombo_leguero` · `aro` · `golpe` · `palmas` · `plato(abierto=)` · `maraca` (y chajchas con `corte`).

**Efectos** — `soplido(t0, dur, f_de, f_a, pan_de, pan_a, forma)` whoosh · `subida` riser · `impacto` ·
`gelatina(f0, f1)` boing · `burbuja` · `llenado(…, baja=)` · `bloop` · `pop(m)` · `tic` · `madera` ·
`jarabe` · `chispas` · `destello` · `hilo` · `pajarito` · `papel` · `siseo` · `brillo`.
Catálogo evento → efecto: [referencias/catalogo-efectos.md](referencias/catalogo-efectos.md).

**Mezcla** — `diag(tramos)` imprime el RMS de cada bus por tramo · `exportar(carpeta, objetivo=-16,
pico_efectos=-1.6)` hace EQ, reverberación (sala sintética), plegado del bucle, compresión suave y
limitador a −2 dBFS **sobre dos vueltas seguidas** (el estado al empezar es el del final) y ajusta la
ganancia hasta −16 LUFS. Efectos solos: misma ganancia y luego subidos a pico real ≈ −1,6 dBTP.

## Flujo
1. Escribir la partitura sobre el guion: primero los efectos (cada cue), después la música.
2. `DIAG=1 python3 audio.py` → balance. Referencias que funcionaron (dBFS RMS por tramo del groove):
   bombo ≈ −22, bajo ≈ −22, perc ≈ −31, melodía ≈ −28, armonía ≈ −29, colchón ≈ −45, fx −25 a −33.
   Si la intro está 10 dB por debajo del groove, subirla; si un instrumento principal queda a −40, no
   se oye.
3. `python3 herramientas/espectro.py previa/espectro.png audio/pista.wav audio/efectos.wav`: cada efecto
   sobre su marca verde; la envolvente respira en la firma; nada saturado.
4. `python3 herramientas/costura.py --audio audio/pista.wav audio/efectos.wav`: sin clic en el corte.
5. Resultado esperado: pista −16 LUFS (pico real < −1 dBTP); efectos entre −18 y −21 LUFS con pico ≈ −1,6.

## Errores que ya pasaron
- Intro 13 dB más baja que el groove y charango enterrado → rebalancear con DIAG, no a ojo.
- Mezcla casi mono (correlación 0,97) → paneos reales por instrumento y dos voces desafinadas L/R.
- Compresor con NaN en efectos escasos: la envolvente filtrada baja de cero → `np.maximum(…, 0)` (ya en audiolib).
- Siseo de vapor y colas graves de impacto demasiado largos → efectos ambientales muy bajos, colas ≤ 0,4 s.
- Efectos fuera de su cue por usar tiempos sueltos → siempre `C["…"]` o `tb(compás, pulso)`.
