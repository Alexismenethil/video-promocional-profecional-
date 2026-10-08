# Catálogo de transiciones

Cada una con: qué transmite, cuándo usarla, duración típica, sonido que la acompaña y dónde está el
código. «Receta» remite a `../../animacion-html-deterministica/referencias/recetas.md`; «SAR» y «EOS» al
código completo en `../../video-pantalla-local/ejemplos/`.

## Grandes (entrada y su espejo de salida)

### Portal por un hueco (SAR)
La cámara avanza hacia un objeto y entra por una abertura (hornacina, ventana, puerta, la boca de una
taza). La pared es una capa con un hueco recortado (`clip-path: path(evenodd, …)`) y la escena de
adentro está detrás, más chica (paralaje). Zoom exponencial `Z = exp(ln(ZMAX)·e)` con e = inOutCubic.
- Duración: 0,9–1,1 s de ida; la vuelta con outQuart (sale rápido, llega suave).
- Sonido: riser + whoosh ancho, impacto al llegar.
- Receta: «Portal por un hueco». SAR: `camara()`, `#yeso`, `SC_DENTRO`.

### Letras-ventana y zoom por una letra (EOS)
El logo crece, cada letra se llena de una foto (ola que sube), una letra cierra su hueco y la cámara
entra por ella; la foto vive en un plano lejano (paralaje) y termina a pantalla completa. Salida: la
escena queda recortada por todas las letras mientras la cámara se aleja por otra letra, y las letras se
vacían mostrando el logo sólido.
- Requiere el logo vectorizado (`vectorizar_logo.py`) y letras gruesas (tipos redondeados, bold).
- Duración: llenado 0,6 s escalonado; zoom 0,85 s; salida 0,75 s; vaciado 0,6 s escalonado.
- Sonido: burbujas que suben de tono (llenado), «bloop» (hueco que se cierra), whoosh grande; al salir,
  succión que baja, burbujas que bajan (vaciado), gelatina al asentarse.
- Receta: «Letras-ventana», «Zoom con paralaje», «Salida por una letra». EOS: `camara()`, `llenar()`.

### Puertas que se abren y se cierran (SAR)
Puertas en 3D CSS (`perspective`, `rotateY`, `backface-visibility`, cara delantera y trasera). Abrir con
resorte que rebota contra el tope; cerrar con aceleración (inCubic) y rebote corto + polvo.
- Sonido: pestillo (madera chica), soplidos laterales al abrir; portazo modal (madera) al cerrar.
- Receta: «Puertas 3D». SAR: `anguloApertura()`, `anguloPuerta()`.

### Portal por el centro de una flor o un sello (SAR menu board)
El disco del isotipo (o del sello de precio) se llena del color de la escena siguiente con una onda
desde el centro y la cámara entra: la flor (en vector) crece ×16 y sus rayos pasan a los costados. Si la
flor está detrás de los productos, la escena va en capas: los productos crecen más rápido y pasan de
largo. Su espejo: la escena se encoge dentro del disco, el disco vuelve al verde y la flor se asienta.
- Duración: llenado 0,5 s; zambullida 1,0 s (inOutQuart); salida 0,95 s.
- Sonido: burbujas que suben (llenado), riser + whoosh ancho + platillo al revés, impacto al aterrizar;
  al salir, succión, burbujas que bajan, gelatina que baja y campanas descendentes.

### Iris (plantilla, SAR)
Un círculo que se abre desde un punto de interés (el centro del logo) mostrando la escena siguiente; su
espejo se cierra hacia el logo. Simple, legible, sirve para cualquier marca.
- Duración: 0,7–0,8 s inOutCubic. Sonido: whoosh que abre / que cierra.
- Plantilla: `circulo()` + `clip()`.

## Medianas (entre escenas)

### Tablas que giran (prismas de trivisión, SAR menu board)
La pantalla se parte en 6–12 tablas triangulares que giran 120° en ola (de un lado, del otro, desde el
centro, en filas) y traen la escena siguiente con luz y sombra: el producto se corta en tiras. Es la
versión 3D de las persianas planas de La Casa del Retablo, y la que el usuario pidió «mucho mejor».
Se puede repetir en todo un video variando número, eje y sentido (es la firma del tablero).
- Duración: 0,62 s por tabla, retraso 0,04–0,07 s, la ola entera ~1 s, aterriza en el compás.
- Sonido: clac de madera por tabla en su golpe (paneado donde está) + whoosh en el sentido de la ola.
- Receta: «Tablas que giran» (18).

### La foto se encoge en un arco (EOS)
La foto a pantalla completa se achica hasta ser un arco de la vitrina; las esquinas de arriba se van
redondeando. La foto se encuadra **por cobertura** del rectángulo que se interpola, y al llegar se
reemplaza por el arco del DOM idéntico (misma sombra, mismo encuadre).
- Duración: 0,7 s inOutCubic. Sonido: whoosh que baja + pop al aterrizar.
- Receta: «Encoger en un arco».

### Jarabe que chorrea (EOS)
El color de la escena siguiente cae desde arriba con dedos que se afinan en gotas; al cubrir todo, la
escena nueva aparece encima con su mismo fondo. Ideal para heladería, pastelería, jugos.
- Duración: 0,6 s. Sonido: riser antes, impacto en el tiempo fuerte, chorro espeso + gotas + «splat».
- Receta: «Jarabe». Plantilla: `jarabe()`.

### Látigo / paneo rápido (SAR)
La escena se va de costado con desenfoque fuerte y entra la siguiente. Muy energético; usarlo una vez.
- Duración: 0,35–0,45 s. 12 submuestras. Sonido: whoosh estéreo de lado a lado.

### Vaciado / llenado
Una ola baja (o sube) dentro de una forma cambiando su contenido. Receta: «Ola».

## Chicas (dentro de una escena)

- **Entrada por pulso con resorte**: arcos que suben desde abajo con outBack, 1 por pulso, escalonados.
  Sonido: pop afinado (notas de la armonía). Plantilla: `piezas`.
- **Fila que corre un lugar por pulso**: outBack(1.15) en 0,42 s + deriva lenta constante. Sonido:
  whoosh corto + tic al encajar.
- **Carrusel 3D**: entra girando desde −200° con outCubic y escala 0,72→1; luego un paso por pulso.
  Nombre del de adelante debajo. Sonido: whoosh circular, tic por paso. Plantilla: `anillo`.
- **Caída con aplastamiento** (SAR, bolas): caída inQuad, aplastamiento al tocar, saltito, baile al
  pulso. Hacer caer primero lo que queda abajo. Sonido: plop afinado por pieza.
- **Palabras que suben de su renglón** (`sube()`): 0,6–0,75 s outQuint, con desenfoque que se aclara;
  escalonado 0,12–0,14 s. Sonido: soplido suave por título.
- **Cinta de nombres** (SAR, crepes): marquesina que corre en loop periódico.
- **Brillo que barre el logo**: 0,7 s inOutSine. Sobre letras oscuras, luz cálida con `screen`; sobre
  letras claras, un brillo de color (el blanco las borra). Sonido: siseo agudo + campanita + chispas.

## Cómo combinar
Entrada grande → producto estrella → vitrina (entradas por pulso) → cambio de color (jarabe/iris/látigo)
→ segunda familia (carrusel, cinta, caída) → salida espejo → firma con brillo. No repetir la misma
transición mediana dos veces seguidas. Cada transición tiene su sonido; el sonido llega un pelo antes
(20–40 ms) que el golpe visual o justo en él, nunca después.
