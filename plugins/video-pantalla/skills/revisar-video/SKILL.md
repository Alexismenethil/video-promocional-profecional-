---
name: revisar-video
description: Control de calidad visual y sonoro de un video generado por código cuando no se puede verlo ni escucharlo en tiempo real —hojas de contactos de instantes clave, tira de cuadros de una previa rápida, comparación de cuadros para cambios invisibles, costura del bucle en imagen y audio, espectrograma con las marcas de cues.js, verificación de los MP4 (códec, nivel, duración, LUFS) y cuadros sacados del archivo final—, con la lista de lo que hay que mirar. Úsala antes de decir que un video está listo y después de cada cambio importante.
when_to_use: Fases 5, 7 y 9 de video-pantalla-local. También para investigar un reclamo concreto («en tal segundo se ve raro»), comparar dos versiones o confirmar que un bucle no salta.
---

# Revisar el video

No alcanza con que «corra»: cada cuadro tiene que verse bien y el bucle no puede notarse. Estas
herramientas (en `scripts/`, copiadas a `herramientas/` en cada proyecto) convierten lo que no se
puede ver ni oír en imágenes y números.

## 1. Instantes clave (mientras se anima)
```bash
node render.mjs frames 0 0.7 1.5 2.3 3.6 4.6 5.4 7.8 9.6 12.3 14.4
python3 herramientas/hoja.py previa/hoja.jpg previa/t0.000.png previa/t0.700.png …   # 2 columnas
```
Elegir tiempos en el inicio, la mitad y el final de cada movimiento del `cues.js`. Leer la hoja (una sola
lectura para muchos cuadros) y abrir a resolución completa 2–3 cuadros donde haya texto o bordes finos.

## 2. Movimiento completo
```bash
MUESTRAS=1 SALIDA=rapido node render.mjs video 30
python3 herramientas/tira.py rapido --fps 30 --cada 3 --salida previa/tira
```
Dos hojas con una miniatura cada 0,1 s. Buscar: saltos entre miniaturas vecinas, algo que aparece o
desaparece de golpe, franjas de fondo, fotos sin encuadrar, textos que se pisan, la última miniatura
igual a la primera.

## 3. Cambios que tienen que ser invisibles
Cuando una pieza se reemplaza por otra (la foto que aterriza y el arco del DOM), sacar el cuadro de
antes y el de después, recortar la zona y comparar lado a lado (y la diferencia media con numpy). Tiene
que dar ≈ 0 salvo lo que entra a propósito.

## 4. Bucle sin costura
```bash
python3 herramientas/costura.py --cuadros cuadros60_4k --audio audio/pista.wav audio/efectos.wav
```
Imagen: la diferencia último→primero no supera los saltos normales entre vecinos (EOS: 0,344 con vecinos 0,337, máx. 0,354). Audio: el salto en la
costura muy por debajo del p99 de saltos (EOS: 0,004 vs 0,11). Sale con código 1 si se nota.

## 5. Sonido sin escuchar
```bash
DIAG=1 python3 audio.py
python3 herramientas/espectro.py previa/espectro.png audio/pista.wav audio/efectos.wav --cues cues.js
```
En el espectrograma cada efecto tiene que caer sobre su marca verde; la envolvente (abajo, con líneas por
compás) debe respirar en la firma y no tener huecos. En DIAG ningún bus principal perdido 10 dB abajo.

## 6. Los archivos finales
```bash
bash herramientas/verificar.sh salida 0.5 1.7 3.6 5.4 7.8 9.8 12.3 14.2
python3 herramientas/hoja.py previa/verif.jpg verif/v_*.png
```
Revisa códec/perfil/nivel/resolución/fps/duración/tasa y LUFS/pico de cada MP4, y saca cuadros del 4K
**ya codificado** a `verif/`. Esperado: 15,000 s; HEVC hvc1 nivel 153 (5.1) 3840×2160 60 fps;
H.264 High 42 y 41; con música −16 LUFS; solo efectos −18 a −21 LUFS. Mirar además un recorte a
resolución nativa (nitidez real en 4K).

## Qué mirar en cada cuadro (lista)
- **Fotos**: cubren su marco (sin franjas), el producto apetitoso al centro, sin el logo del vaso dentro
  de otra letra, sin bordes de la foto a la vista en zooms.
- **Texto**: legible a distancia, sin choques, sin cortes en los rasgos, nombres bien escritos.
- **Marca**: colores y fuentes de la marca; nada de activos de otra marca.
- **Composición**: adornos en las esquinas; partículas detrás de los productos; márgenes ≥ 80 px.
- **Transiciones**: sin franjas de fondo a mitad de un zoom; cambios de pieza invisibles; desenfoque de
  movimiento donde algo corre (sin «escalones» visibles: subir K en `CUES.muestras`).
- **Bucle**: el primer y el último cuadro iguales; nada «salta» al volver.
- **Sonido**: cada efecto en su evento; música tranquila en el cruce del bucle; sin clic en la costura.

Si algo falla: arreglar, volver a sacar esos cuadros y repetir la revisión del tramo. Recién cuando
todo pase, generar los cuadros definitivos.
