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

## Video 3 · SubeYA (app para descubrir la ciudad, para redes sociales) — 3-oct-2026

**Idea.** Primer video **vertical para redes** (1080×1920, 24 s = 12 compases a 120 BPM) y primero de
una **app**, no de un local. El hilo es el propio logo: la ruta punteada que termina en un pin. El pin
cae sobre blanco y pregunta «¿A dónde vamos hoy?»; la cámara **entra por el hueco del pin** a la
ciudad de noche (foto real), que se encoge dentro de un **teléfono 3D** con la app real grabada en el
emulador: Conoce (fotos reales flotando en 3D alrededor), Reels (videos reales, con «me gusta»),
Turismo (anillo de lugares que orbita) y Mapa 3D (el teléfono se acuesta). La ruta nace en el punto
azul del mapa, sube hasta el pin y el pin arma el logo: «Sube» se escribe, «YA» salta, los guiones
aparecen uno a uno y llega Suby (mascota redibujada en vector). Cierre con lema y «Disponible en
Google Play» (verificado en la ficha pública). El pin despega al final y cae al inicio: bucle.
Música: house andino en Do (I–V–vi–IV), silbido en Conoce, charango y quena en Turismo, la ruta
«suena» como una escala de kalimba, campanas en el logo.

**Lecciones técnicas (app en el emulador)**
- Versión actual de la app sin tocar el repo: copiar `android-app/` a la carpeta temporal, cambiar
  `API_BASE_URL` a producción en esa copia y compilar (`assembleDebug`, 1,5 min). `adb install -r`.
- Barra de estado limpia: modo demostración (`sysui_demo_allowed 1` + broadcasts de reloj, batería,
  wifi; `network -e mobile hide` quita el «3G»). La «G» era una notificación de Google Play
  Services: `cmd notification snooze --for <ms> '<key>'` (la clave de `dumpsys notification` sin el
  «:» final). Al terminar: `-e command exit` y `sysui_demo_allowed 0`.
- `adb shell screenrecord … &` **se come la entrada estándar** de los comandos que siguen (las
  acciones no llegaban y la toma salía quieta) → `</dev/null` en cada `adb` y acciones en un archivo.
- El AVD con 2 GB de RAM congelaba la grabación (5 cuadros en 9 s) → arrancarlo con `-memory 4096`.
- Reproducir las reels (HLS) en el emulador **rompe el decodificador h264** del emulador («no frame!»
  en el log): las reels salen congeladas o con bloques, y después `screenrecord` graba 0 cuadros
  hasta reiniciar el emulador. Solución: bajar el video publicado (HLS de Bunny con el `Referer` que
  usa la app, solo lectura) y **reconstruir la interfaz de Reels en vector** (coordenadas 1080×2400
  escaladas a la pantalla), idéntica a la app y nítida en 4K. Grabar primero todo lo demás.
- Precargar imágenes antes de grabar (recorrer la pantalla una vez): si no, la galería muestra
  marcadores grises. Horarios reales: un local cerrado muestra un letrero «CERRADO» en el detalle
  (AlCafe tiene cargado «Dom 22–23»): elegir para el detalle un lugar abierto a esa hora (EOS).
- `uiautomator dump` + buscar por `content-desc` para tocar; verificar antes de cada toque que la app
  esté al frente (un «atrás» de más dejó el escritorio y la búsqueda de Google a la vista).
- Las tomas salen a 30–60 fps variables: `ffmpeg -vf fps=60` → JPEG por cuadro; dentro del video se
  **remapea el tiempo** por tramos (más rápido en el desplazamiento) para que todo caiga en el compás.

**Lecciones técnicas (animación vertical)**
- `seek(t)` asíncrono: cambia el `src` de los cuadros de cada toma y espera `img.decode()`;
  `render.mjs` ya espera la promesa de `page.evaluate`.
- Teléfono 3D en CSS: frente + 22 láminas de 0,75 px (espesor) con `preserve-3d`; reflejo del vidrio
  que se corre con el giro. Medio giro sin dorso: el ángulo sigue continuo (4 → 190) y se dibuja
  `ry − 180` pasado 90°: de canto el salto no se ve. Todo contenedor intermedio necesita
  `transform-style: preserve-3d` o aplana a sus hijos (pasó con el contenedor de las tarjetas).
- Anillo de tarjetas que siempre miran a cámara: `rotateY(a) translateZ(R) rotateY(−(a+θ)) rotateX(tilt)`.
  Con 8 tarjetas tapaban la app; con 6 y el anillo más inclinado, pasan por la parte baja.
- Portal por el hueco del pin: recortar la ciudad con `circle(r·1.07 + 5)`; con `r + 3` quedaba un
  hilo blanco (el hueco trazado no es un círculo perfecto).
- La foto que se encoge a la pantalla del teléfono: la capa se sube con `z-index` solo en ese tramo;
  ojo, un `z-index` sube la capa sobre TODO lo que tiene `auto` (títulos, viñeta) → poner `z-index`
  explícito a todas las capas.
- Una tarjeta detrás del teléfono pierde su nombre si el texto queda del lado tapado: moverla.
- `render.mjs` con `ANCHO/ALTO` (vertical por defecto en el proyecto) y `exportar.py` que detecta la
  orientación (1080×1920; el nivel HEVC 5.1 admite 2160×3840).
- Zonas seguras de redes: textos entre y≈230 y 1480 y fuera de la franja derecha (iconos de la app).

**Tiempos.** previa rápida 720 cuadros 42 s; cuadros 4K verticales 1.440 en 15 min (893 s, 6 Chrome, K de 4 a 10); exportar 4,2 min. Costura: imagen 0,155 (vecinos 0,405), audio 0,010 (p99 0,108). Pesos: 4K 50 MB, 1080 60 32 MB, 1080 30 27 MB.

## Video 4 · Sabor a Retablo, menu board de 30 s (café · crepes · helados, Ayacucho) — 6-oct-2026

**Pedido.** «Digital menu board» como una compilación de plantillas de After Effects para restaurantes
(producto recortado sobre color plano, nombre enorme, precio en sello), pero «más creativo», de ~30 s,
con 1 o 2 productos principales a la vez y visibles para todos. Referencia extra: la entrada del video
de La Casa del Retablo (fondo rojo, logo, retablo recortado sobre color y persianas verticales entre
productos), «pero mucho mejor, más inmersión, más bonitas las transiciones». Y la música: «siento que
no te sale muy bien, pero esmérate».

**Idea.** La carta que gira. La firma (logo crema sobre verde retablo) se abre: la flor viaja al centro,
estalla en florcitas, su disco se llena del color de la primera escena y la cámara entra por él. Seis
tableros de la paleta del retablo (turquesa, verde, mostaza, terracota, turquesa hondo, coral) con el
producto recortado, el nombre en Playfair itálica y el precio: en los solos, un sello con la forma de la
flor del logo (pétalos en el acento de la escena, corona blanca, disco verde con «S/ 12»); en los pares,
«S/ 12» bajo el nombre. Entre escenas, **tablas-prisma 3D que giran en ola** (trivisión): la versión con
volumen, luz y sombra de las persianas de La Casa del Retablo; varían en número (8, 10, 6 horizontales,
12) y dirección. A mitad, la cámara entra por la flor tono sobre tono que gira detrás de los crepes (los
platos pasan de largo). Al final la escena se mete en la flor del logo y vuelve la firma con brillo
turquesa. 128 BPM, 16 compases = 30 s.

**Productos.** Crepe Clásica (trae dos flores del retablo dibujadas con polvo verde: continuidad con la
flor del logo), Milkshake de Fresa + Frappé Moca, Green Crep + Crepa Arcoíris (traslapadas), Capuccino
con vapor + Torta Matilda, Chapla con chancho a la caja china, Copa Kids + Banana Split. Precios y
nombres de la carta publicada; rótulos y descripciones cortas, editoriales (en `ESCENAS` de prep.py).

**Música.** House cálido con color andino: la vuelta del café Re maj9 · Si m9 · Mi m9 · La 13 (tres
vueltas en el groove); firma en Sol maj9 (el cruce del bucle, una sola nota de colchón que cruza),
subida en La9sus → La9 y caída en Re justo cuando aterriza la cámara. Tema en pentatónica de 4 compases
que pasa del charango punteado (dos cuerdas desafinadas ±4 ¢ + kalimba a la octava) al silbido y a la
quena, con rasgueo de charango en contratiempo y bombo legüero que abre cada frase en la segunda mitad.
Sidechain del bajo, los acordes y el colchón al bombo (envolvente desde los tiempos del bombo, −55 %,
85 ms); eco ping-pong de corchea con puntillo en los buses del tema. Efectos: un clac de madera por
tabla (paneado donde encaja), burbujas cuando el disco se llena, tintineos en los destellos de vidrio.

**Lecciones técnicas.**
- **Recorte de sujeto de macOS** (Vision `VNGenerateForegroundInstanceMaskRequest`): un binario Swift
  de 40 líneas (`mascara_vision.swift`) da máscaras excelentes de platos, copas y vasos; local, sin
  instalar nada, 66 fotos en ~1 min. Abrió la puerta a todo el estilo «producto sobre color».
- Borde del recorte: restar el fondo dividiendo por un alfa chico satura el color (halo rosado sobre el
  coral) → sangrado: el filo toma el color del interior más cercano (`distance_transform_edt` con
  `return_indices`) y se mezcla con el original solo donde alfa > 0,55.
- **Revisar si la máscara toca el borde de la foto.** La Crepa Tropical, la Galaxia y el Milkshake de
  Oreo tenían el plato o el pie cortados por el encuadre: recortados sobre color quedan con un lado
  recto (se ve en 4K). Completar la loza sintéticamente no pasó (costura visible, chocolate cortado).
  Arreglo: fotos completas, o tapar el corte con otro producto delante (Arcoíris detrás de la Green Crep).
- Flor del logo: potrace sobre un PNG de 384 px daba rayos ondulados con zoom ×15. Reconstrucción
  geométrica medida en polar sobre la original: pétalos = disco 122,5 ∪ 8 círculos r 48,5 a 139,4
  (mínimos cuadrados sobre el alfa); corona = 64 rayos en hoja (8 por pétalo a 0, ±5, ±10,5, ±15,3 y
  22,5°) + aro 80,5; disco 73. Con relleno nonzero, la unión pide el mismo sentido de giro en todos los
  subtrazos (el aro dibujado al revés dejaba rayas).
- Tablas-prisma en canvas 2D (receta 18): columnas de 1,25 px con la perspectiva resuelta en forma
  cerrada, luz desde el lado de la cara que llega, tablas 4,5 % más largas que la pantalla (si no,
  cuñas oscuras), fondo entre tablas del tono hondo de las escenas (no negro).
- Escenas dibujadas en búferes (canvas fuera de pantalla) para usarlas como textura: la misma función
  `escena(g, k, t)` sirve para la pantalla, las tablas y los portales.
- Portal por una flor que está **detrás** de los productos: escena en capas (`capa: 'fondo' | 'frente'`):
  fondo con zoom Z, ventana con la escena siguiente, frente con zoom Z^1,45 que se desvanece.
- Precio en TV: Montserrat 800 (Playfair trae números de estilo antiguo y el canvas no tiene
  `font-variant-numeric`). Nombre largo («Chapla con chancho a la caja china»): jerarquía en tres
  renglones («Chapla» grande, el resto en acento a la mitad) y tamaño que se ajusta a su columna.
- Sombras teñidas con el tono hondo de cada fondo (la gris ensucia mostaza y coral).

**Tiempos.** prep (66 máscaras + 10 recortes) ~25 s; previa rápida 900 cuadros 50 s; cuadros 4K
1.800 (≈8.000 capturas) en 13,6 min (814 s, 6 Chrome); exportar ~7 min (30 s en 3 formatos × 2 pistas); audio.py 10 s. Costura: imagen 0,472 (vecinos 0,475),
audio 0,036 (p99 0,083).

## Video 5 · Sabor a Retablo, «El retablo de los sabores», menu board 3D de 60 s — 6-oct-2026

**Pedido.** El menu board de 30 s (video 4) no gustó: «lo siento muy simple, le falta inmersión, el
inicio y el final nada que ver». Que dure 45 s o 1 min con más productos, «muchas animaciones,
inmersión, como toda una edición súper profesional». Lo más importante: **el inicio y el final**.

**Lo que no funcionó en el video 4 (y la lección).** Tableros planos de color + flor abstracta como
entrada: el usuario no reconoció su marca en la apertura ni en el cierre. Su objeto es el **retablo**
(está en el nombre, en el video de 15 s y en el de La Casa del Retablo): la apertura y el cierre tienen
que ser el retablo, y «inmersión» = espacio 3D real, cámara que viaja, profundidad, luz.

**Idea.** El retablo de la marca en 3D (modelado con las fotos `retablo-cerrado/abierto.png` del repo)
sobre un podio en un salón verde de noche con bokeh. La firma (logo) se deshace en polvo dorado que
entra por la ranura de las puertas; la ranura se enciende, las puertas tiemblan y se abren de golpe
(rayos, destello, estallido de hojas pintadas hacia la cámara) y la cámara entra: el fondo de la caja
es un **portal** a otro mundo. Adentro, doce nichos de colores (salas de yeso con arcos crema, la flor
de la marca en relieve, podios y pedestales con banda pintada, motivos de papel flotando, polvo en la
luz). Al final la cámara sale por el portal, las puertas se cierran de un portazo y el polvo vuelve a
armar el logo. 128 BPM, 32 compases = 60 s; 25 productos.

**Lecciones técnicas.**
- **WebGL (three.js) en Chrome sin cabeza usa la GPU del Mac** (ANGLE Metal, WebGL2, texturas float):
  `--use-angle=metal`. Una captura 4K tarda ~0,1 s. Cambia todo: escenas 3D reales, cámara libre.
- **Desenfoque de movimiento + profundidad de campo + antialias en la misma pasada**: K submuestras por
  cuadro dentro de la página (tiempo dentro del obturador, cámara corrida en un disco de apertura con
  cizalla de proyección para mantener el plano de foco, jitter de subpíxel Halton), acumuladas en un
  render target HalfFloat. Después brillo (UnrealBloomPass sobre el acumulado), hombro suave, viñeta y
  grano/tramado. 4K: 0,3–0,75 s por cuadro (K 10–24); 3.600 cuadros en ~10 min con 3 Chrome.
- **Portal**: el fondo de la caja muestra el nicho dibujado con la cámara llevada al otro espacio
  (traslación + escala 3,4); al cruzar el plano, se dibuja solo el nicho. La trayectoria se define en el
  espacio B y se lleva a A con la inversa: continuidad exacta.
- **Fotos de plato tomadas desde arriba**: acostarlas sobre el podio aplasta el producto; de pie parecen
  cartas. Lo que funciona: **flotando** sobre el podio, mirando a la cámara (inclinación natural de la
  foto), con sombra suave en la tapa y un leve vaivén. Vasos y tazas, de pie.
- **Platos cortados por el encuadre** (crepes dulces): recortar como elipse más angosta no sirve si el
  corte es grande (Mega Crepa: el plato real mide 1.300 px en una foto de 1.086). Solución: **arcos con
  la foto completa** (como la carta de la marca), con velo oscuro abajo para el nombre y el precio.
- **Motivos del retablo recortados de su foto** (componentes conexas de lo pintado, con filo de papel
  crema): 59 hojas, ramitas, volutas y florcitas → recortables que flotan, banda pintada de podios,
  pintura de la fachada, el remolino de hojas. Desenfoque por mip bias + fundido en el borde del cuadrado
  (si no, en mips altos se ven rectángulos grises).
- Textos 3D por glifo (atlas en canvas con posición por prefijos medidos: conserva el kerning), siempre
  mirando a la cámara; los adornos se reparten fuera de las zonas reservadas de texto y producto
  (proyectando con la cámara de referencia) y se esconden si no encuentran lugar.
- Brillos que queman: el crema (0,95) bajo un spot pasa de 1 y florece; tapas a #e9dfcb, umbral 1,12.
  Los rayos aditivos de la ranura, si quedan encendidos cuando la cámara pasa por su centro, dejan una
  mancha blanca: apagarlos antes de la zambullida.
- **El bucle se mide, no se supone** (otra vez): `costura.py` dio 6,6 contra 0,59 de vecinos porque los
  motivos, el polvo y el bokeh del salón de la firma (lo que se ve en el cruce) se movían con
  frecuencias sueltas y una deriva lineal. Arreglo: `deriva(t, semilla, f, periodo)` y `vueltas(w,
  periodo)` redondean cada frecuencia a vueltas enteras en 60 s, y el polvo periódico no tiene deriva
  lineal. Costura final 0,596 contra 0,581.
- Transiciones en 3D: pilastra pintada que barre el paneo (esconde el corte), cornisa en la grúa,
  látigo con 24 submuestras, tablas-prisma con cámara gran angular propia (58°) para que se vea el
  volumen, remolino de hojas de papel (frente pintado, poco giro), puertas del retablo a pantalla
  completa. Cada nicho es su propia escena con origen en 0: no hace falta un mundo único.
- Música (estudio2.py sobre audiolib): batería por capas, bajo house sub + púa, acordes de sierras,
  zampoña con soplo, sidechain al bombo (envolvente calculada de los golpes), dos reverberaciones, eco
  ping-pong, ancho por medio/lado en armonía y cuerdas (la correlación bajó de 0,94 a 0,90), master con
  compresión rápida (envolvente cada 16 muestras), saturación y limitador a −1,9 dB (pico real −1,3).
  Efectos solos llevados a −20 LUFS con limitador.

**Tiempos.** prep 30 s · previa 1080p30 K=1 75 s · cuadros 4K60 ~10 min · audio 13 s.

## Video 6 · Sabor a Retablo, menu board versión final (1:52 → 2:15, 40 productos) — 7-oct-2026

**Lo que gustó / lo que corrigió.** Del video 5 (3D con nichos): «amo el final y el inicio, aunque
siento que demora un poquitito»; «el interior hazlo un poco más limpio, como en la primera versión,
siento que los productos perdieron el protagonismo». Pidió todos los crepes, helados y milkshakes,
Torta Matilda, Red Velvet, Tiramisú de Pistacho, la chapla a la caja china, algo de frappé y café:
«no importa cuánto demora, lo importante es que salgan los productos». Versión final.

**Idea.** El retablo 3D abre y cierra (acortado de 7,5 s a 5,6 s cada punta: el logo se deshace antes,
los golpes de las puertas en el compás 2, se abren en el 3 y la cámara llega en el 4). Adentro, 18
tableros de la primera versión rehechos en 3D: color de la paleta del retablo con su degradado, la flor
tono sobre tono, florcitas que suben (unas delante, fuera de foco), el producto recortado grande con su
sombra teñida, el nombre que sube desde su renglón, el precio en el sello-flor. 128 BPM, 60 compases.

**Lecciones técnicas.**
- **Maquetar en px de diseño y llevar al mundo.** Cámara de referencia (z = 16, 30°): `aMundo(px, py, z)`
  escala cada capa por (16 − z)/16 para que en la vista de referencia quede donde estaba en el lienzo
  de 1920×1080. Así se reusan tal cual las maquetas de la versión plana, y una deriva lenta de cámara
  (±0,3, empuje 6 %) da paralaje: fondo a z −6, producto 0, textos 0,35, sellos 0,65, florcitas ±5.
- **Platos cortados por el encuadre de la foto → ventanas en arco.** El plato llena el ancho del arco y
  sigue por detrás del marco (62 px de sobra por lado): los bordes rectos de la foto quedan tapados.
  Recorte por el arco en el shader del producto (coordenadas del grupo de la ventana). Marco cerrado
  (con zócalo) extruido, panel hundido con sombra interior. Sirvió para 7 crepes.
- **Vaso cortado abajo → mostrador.** Una franja oscura con filo crema delante de los vasos (opaca y
  escribiendo profundidad) tapa los pies; nombres y precios van escritos en el mostrador (z delante).
  Los vasos se escalan por el ancho de la copa al 40 % de la altura, no por la altura.
- **Flor-portal.** La flor de la marca aparece girando; su disco muestra el tablero siguiente entero en
  miniatura: la cámara del tablero B se aleja ×1,02/r (r = radio del disco en altos de pantalla) y
  se dibuja en pantalla completa; cuando el disco cubre la pantalla (r ≥ 1,02) la cámara ya está en
  su lugar y se corta sin salto.
- **Empuje** (tablero que sale de costado con filete crema) como pasada 2D sobre rtA/rtB: con 22
  submuestras el barrido sale con desenfoque real.
- **Eventos de sonido desde la imagen.** La página expone `eventos()` (entradas de producto, ventanas,
  sellos, destellos, títulos) y `render.mjs eventos` escribe `eventos.json`; `audio.py` lo lee. Un solo
  reloj y una sola fuente de verdad para cuándo cae cada cosa.
- **Destellos sobre el filo.** `prep.py` guarda el perfil del recorte (izquierda/derecha por cada 5 % de
  altura): los destellos caen sobre el borde del vaso o del plato, a tiempo con el pulso.
- **Cuadros enteros.** A 128 BPM un compás son 112,5 cuadros a 60 fps y 56,25 a 30 fps: la duración
  tiene que ser múltiplo de 4 compases (60 compases = 112,5 s = 6.750 / 3.375 cuadros).
- Música en frases de 6 compases (dos tableros de 3); la frase del cruce del bucle es cierre 3 + apertura 3.
- Entre las tablas-prisma, el tono hondo de las dos escenas mezclado (no un marrón fijo).

**Tiempos.** prep 54 s (40 recortes) · cuadro de prueba 1080 0,2 s · previa 1080p30 K=1 2,4 min ·
cuadros 4K60 13,4 min (6.750, 3 Chrome) · exportar 28 min · audio 27 s. Costura: imagen 0,684 (vecinos
0,578: la diferencia es el grano, cuyo patrón se corre 17 px por cuadro y salta en el corte; no se ve),
audio 0,066 (p99 0,091). Pesos: 4K 520 MB, 1080p60 186 MB, 1080p30 129 MB por pista.

**Corrección final (mismo día).** «Me encanta; lo único que no me gustó fueron las escenas de las ventanas y
el mostrador: el producto pierde protagonismo». Enmarcar o tapar un producto (arcos, mostrador) le quita
protagonismo aunque se vea prolijo. Arreglo: **completar el plato por retoque** (`completar_plato.py`):
elipse ajustada por lado con los puntos del contorno cercanos al corte, la loza reconstruida «por anillos»
(cada anillo conserva su color y se interpola entre los dos puntos donde sale y vuelve a entrar a la
foto), moteado tomado en parches de loza bien limpia, brillo igualado a lo largo de la costura y los hilos
de chocolate terminados antes del corte con su halo. La loza es «todo lo que no es crepe ni chocolate»
(sirve para platos beige). Lo que no se inventa es la comida: si la punta del crepe toca el borde de la
foto, ese lado va fuera de cuadro (`soloBorde`, `parBorde`, con espejo si hace falta) o bajo el sello del
precio. El vaso cortado abajo sube desde abajo de la pantalla (`soloAbajo`). Quedó en 22 tableros, 2:15;
el usuario pidió entregar solo los dos 4K.

**Último ajuste.** «Haz los precios un poquito más grandes»: el precio bajo el producto pasó de 42 a 54 px
de diseño (casi la altura del nombre; 48 en las filas de vasos) y el sello de la flor, de 138 a 156 de
radio. En un menu board el precio se lee desde lejos: arrancar con el precio del tamaño del nombre, no
como nota al pie.

## Para el próximo video (ideas pendientes)

- Pedir al cliente las fotos originales en alta (las de la carta vienen a ~1100 px): en 4K una foto a
  pantalla completa se amplía ×3,4. Mientras tanto: ampliación Lanczos + nitidez (`doble.py`) y no
  dejar una foto a pantalla completa más de ~1,5 s quieta.
- Probar una escena con producto recortado (sin fondo) si hay recortes buenos: da más profundidad.
- Si piden redes: 1080×1920 (9:16) cambia la composición entera; no es escalar el 16:9.
- **Vertical ya probado** (SubeYA): portar a la skill `ANCHO/ALTO` de `render.mjs`, la detección de
  orientación de `exportar.py` y hojas de contactos verticales (`hojav.sh`, `tirav.py` del proyecto
  SubeYA en `output/video/fuente/herramientas/`). Hoy viven solo en esa copia.
- Para apps: grabar en el emulador ANTES de reproducir videos en él, y reconstruir en vector toda
  pantalla con video (la reconstrucción se ve mejor que la toma y no depende del decodificador).
- Considerar un cierre con dato útil (horario, @instagram) si el usuario lo pide; por defecto, limpio.
- Videos de 30 s (menu board): 128 BPM = 16 compases justos. Escenas de 2 compases (8 pulsos) con 1–2
  productos; transición en el último pulso de cada escena. La entrega va en su propia carpeta
  (`output/video-menu-board/`) para no pisar el video de 15 s que el local ya usa.
- Con recortes Vision, el estilo «producto sobre color» queda abierto para cualquier carta con fotos de
  local: probar podios/sombras de contacto, o productos que entran desde la profundidad.
- **Lo que el usuario aprobó como versión final** (video 6): el objeto de la marca en 3D abre y cierra,
  corto (~5,5 s cada punta), y el cuerpo son tableros limpios con el producto protagonista (como el
  video 4, pero en 3D con paralaje y desenfoque). Partir del ejemplo `sabor-a-retablo-final/`; el
  `sabor-a-retablo-3d/` (nichos) quedó como referencia de un interior que resultó recargado.
- Pendiente para el 3D: un piso con reflejo suave en el salón de la firma (Reflector solo en apertura y
  cierre), escarcha/gotas en las bebidas frías, y una versión 9:16 con la misma cámara.

## Plantilla de entrada nueva

```
## Video N · <Negocio> (<rubro>, <ciudad>) — <fecha>
**Idea.** <el hilo conductor en 4–6 líneas: qué objeto o palabra de la marca lo mueve y el recorrido>
**Lo que gustó / lo que corrigió.** <citas cortas del usuario y el cambio que se hizo>
**Lecciones técnicas.** <problema → causa → arreglo, con valores>
**Tiempos.** cuadros 4K <min>, exportar <min>, costura <valor>.
```
