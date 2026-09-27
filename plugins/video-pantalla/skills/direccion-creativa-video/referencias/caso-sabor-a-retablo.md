# Caso 1 · Sabor a Retablo (café · crepes · helados, Ayacucho)

Código completo: `../../video-pantalla-local/ejemplos/sabor-a-retablo/`.

## La marca
- Retablo ayacuchano: caja de madera con puertas pintadas y una hornacina con escenas. Está en su
  logo, en sus fondos (yeso) y en su carta. Paleta: verde, turquesa, coral, ámbar, crema.
- Tipografías del sitio: Playfair Display (títulos, itálica) y Montserrat (rótulos).
- Productos: café (espresso, americano, capuccino, mocaccino), crepes dulces y salados, helados (10
  sabores con recortes de bolas en el repo).

## La idea
El video ES el retablo: se centra, se abre, la cámara entra por la hornacina y adentro están los
productos; sale, las puertas se cierran de un portazo y firma la casa.

## Guion (120 BPM, 2/4: pulso 0,5 s)

| Tiempo | Evento (cue) | Imagen | Sonido |
| --- | --- | --- | --- |
| 0,15–0,95 | retabloAlCentro | el retablo viaja del costado (donde firmaba) al centro | arpegio de charango, soplido |
| 0,97 | — | pestillo | madera chica |
| 1,00 / 1,08 | puertaIzq / puertaDer | puertas abren con resorte (rebotan contra el tope) | soplidos laterales, rasgueo Fa, bombo, campanas |
| 1,12 | estallido | estallido de pétalos desde la hornacina (física cerrada, perspectiva) | glissando de charango, papel |
| 1,9–3,0 | empuje | la cámara entra por la hornacina (portal, Z exp hasta 5,6) | redoble de bombo, riser, quena que sube |
| 3,0 | — | café: arco con foto + vapor; «Preparado al momento» / «Café» / lista | golpe, boom, platillo; entra el groove |
| 4,78–5,22 | latigo | paneo rápido a crepes: dos arcos + cinta de nombres; «Dulces y salados» / «Crepes» | whoosh estéreo |
| 6,85–7,25 | iris | iris a helados (fondo turquesa); «Elige tus sabores» / «Helados» | whoosh |
| 7,5 + n·0,125 | bolaPrimera, bolaPaso | caen las bolas (fila de abajo primero), aplastamiento, baile al pulso, nombres | un plop afinado por bola (melodía) |
| 10,5–11,4 | retroceso | la cámara sale de la hornacina | whoosh que baja |
| 11,5–12,0 | cierre | las puertas se cierran, rebote, polvo | portazo modal + bombo + golpe; rasgueo La mayor |
| 12,08–12,8 | retabloAlLado | el retablo va al costado | trémolo de charango |
| 12,25 | flor | la flor del logo gira | campanas en La mayor, chispas |
| 12,45–13,3 | nombre, filete, bajada | el logo se arma por piezas | quena |
| 13,1 | lema | «Momentos que se disfrutan, recuerdos que se quedan.» | — |
| 13,95–14,75 | brillo | brillo turquesa sobre el nombre | siseo agudo, campanita |
| 15 = 0 | — | el retablo al costado con la firma: primer cuadro | la cola del sonido entra al inicio |

## Música
Huayno-pop 120 BPM en La menor que termina en La mayor (Asus2 → F → G → E7 → Am … → A). Charango
rasgueado (Karplus-Strong, 5 órdenes dobles con desafinación natural), quena (aditiva + soplo),
bombo legüero, chajchas, bajo redondo, colchón. Melodía de quena en los tramos de producto. Las bolas
cantan la melodía al caer (NOTAS = [69, 72, 76, 81, 79, 76, 79, 84, 88, 91, 93, 96]).

## Lo que se corrigió (y quedó como regla)
- Fotos reales de la carta publicada; los sabores solo si están disponibles y tienen recorte.
- El Mocaccino real lucía pobre en el arco → foto de la casa para el café.
- Brillo blanco borraba letras → brillo del color de la marca.
- Bolas de la segunda fila atravesaban la primera → caer primero la de abajo.
- Base blanca de estudio en las bolas → recorte por textura.
- Versión solo efectos; 4K 60, 1080 60 y 1080 30.
