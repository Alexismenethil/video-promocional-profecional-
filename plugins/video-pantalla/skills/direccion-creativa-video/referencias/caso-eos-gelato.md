# Caso 2 · EOS Gelato (gelatos, sorbetes y bebidas, Ayacucho)

Código completo: `../../video-pantalla-local/ejemplos/eos-gelato/`.

## La marca
- Logo: «EOS» en letras redondas y blanditas (tinta verde bosque #1b2c1a). Eos = diosa del amanecer.
- Carta «Artisanal Arch»: marfil #faf7ef, verde bosque, oro pistacho #b07d36/#c99a52, frambuesa
  #6b1f36/#882b48, rosa #f3b3c5. Motivos: el **arco** (las fotos van en arcos), el filete (hilo con
  rombo), el rótulo en versalitas, las virutas que flotan, el halo cálido, el barrido de luz, la gota.
- Tipografías: Cormorant Garamond (display, itálica para el acento) y Manrope (rótulos).
- Fotos publicadas: 8 gelatos, 4 sorbetes, batidos, milkshakes, jugos, sodas, frozen (≈1100 px, vasos
  verde salvia con el logo, fondos de banqueta rosa y luz cálida; la del Maracuyá tiene un atardecer
  sobre cerros).

## La idea
El logo es la ventana: las letras se llenan de gelato, se entra por la O al amanecer andino (la foto
del Maracuyá), la foto se encoge en el primer arco de la vitrina, el jarabe de frambuesa trae las
bebidas, y se sale por la S de vuelta al logo.

## Guion (128 BPM, 4/4: pulso 0,46875 s, compás 1,875 s)

| Tiempo | Cue | Imagen | Sonido |
| --- | --- | --- | --- |
| 0–0,26 | — | firma: EOS verde, filete, «Gelato artesanal *en Ayacucho*», monsteras en esquinas | kalimba en Fa, colchón |
| 0,26–0,5 | rotuloSale | el lema baja y se va (antes de que el logo crezca encima) | soplido corto |
| 0,47–1,12 | crece | el logo crece ×2 (gelatina, cada letra con retraso) | gelatina (boing que sube) |
| 0,9 / 1,04 / 1,18 (+0,6) | llenado E/O/S | cada letra se llena de un gelato real con una ola (menisco brillante) | burbujas que suben, tres alturas |
| 1,6–1,86 | cierraO | el hueco de la O se cierra | bloop |
| 1,875–2,72 | zoom | la cámara entra por la O; la foto en plano lejano (paralaje) termina a pantalla completa | impacto en el uno, whoosh grande, campanas + chispas al llegar |
| 2,72–4,22 | amanecer | el Maracuyá con el atardecer; empuje lento; «GELATO ARTESANAL / Maracuyá» arriba a la izquierda | pajaritos, entra el groove |
| 4,22–4,92 | encoge | la foto se encoge en el primer arco (esquinas que se redondean) | whoosh que baja, pop al aterrizar |
| 4,55 | vitrinaTitulo | «HECHOS EN CASA / Gelatos / y sorbetes» | soplido |
| 4,92 / 5,16 / 5,39 | vitrinaEntra | entran tres arcos con resorte | pops afinados (Fa, La, Do) |
| 5,625 … 7,031 | vitrinaPasos | la fila corre un lugar por pulso | whoosh + tic |
| 7,5–8,1 | goteo | jarabe de frambuesa cae y cubre | riser, impacto, chorro, gotas, splat |
| 8,0–8,9 | carrusel | carrusel 3D de bebidas entra girando | whoosh circular, tic al encajar |
| 8,3 | bebidasTitulo | «PARA TOMAR / Milkshakes, *sodas y frozen*» | soplido |
| 8,9 … 10,78 | carruselPasos | un paso por pulso; nombre y categoría del de adelante | whoosh + tic |
| 11,25–12,0 | salida | la cámara sale por la S: las letras recortan la escena | succión que baja, impacto suave |
| 11,92 … 12,74 | drenaje E/O/S | las letras se vacían de arriba abajo, aparece el verde | burbujas que bajan |
| 12,66–13,3 | asienta | el logo vuelve a su tamaño con gelatina | gelatina que baja |
| 13,1–13,7 | firma | filete se dibuja, rombo, lema sube | roce metálico + campanita |
| 14,06–14,75 | brillo | barrido de luz cálida (screen) sobre las letras | siseo agudo, campanita, chispas |

## Música
House suave, Fa mayor: Fa maj9 · Re m9 · Si♭ maj9 · Do 9 (y Do 6/9). Compases 1 y 8 (el cruce del bucle)
quietos: kalimba + piano + colchón. Del 2 al 7: bombo en negras, palmas en 2 y 4, charles a
contratiempo, maracas en semicorcheas, piano FM en «uno, y-del-dos, y-del-tres, cuatro», bajo de casa
a contratiempo con saltos de octava. Silbido: tema de 2 compases en 3–4 y variación en 6–7.

## Lo que se aprendió (ver la bitácora para el detalle)
- Vectorizar el logo suavizando antes (sin dientes al hacer zoom).
- Encuadrar las letras sobre la bola (no el vaso con su logo).
- Paralaje con margen: la foto tiene que sobrar al final del zoom.
- Encuadre por cobertura en todo lo que se recorta.
- Jarabe orgánico: dedos que se afinan y terminan en gota.
- Partículas detrás de los productos; sombras desenfocadas en el padre del recorte.
