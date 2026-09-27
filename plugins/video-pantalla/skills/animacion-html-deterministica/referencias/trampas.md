# Trampas conocidas (y el arreglo)

| Síntoma | Causa | Arreglo |
| --- | --- | --- |
| Un recorte, una ola o un estilo «viejo» aparece en un instante que no le toca | el DOM persiste entre `seek` del mismo trabajador y ese estilo solo se asigna dentro de un `if` | fijar siempre (o reiniciar) todo lo que se toca; `ver()` para ocultar |
| Franja de fondo dentro de una letra o ventana a mitad de un zoom | la foto va en un plano lejano (crece menos) y su borde entra en la ventana | margen: la foto tiene que sobrar al final del zoom (receta 4) |
| Franja oscura arriba/abajo de una foto en su arco | escala calculada por un lado sin cubrir el otro | encuadre por cobertura (`encuadrarCaja` / `cubrir`) |
| Una foto que se encoge deja ver su marco | foto y marco interpolan distinto | interpolar el rectángulo y encuadrar la foto por cobertura de ese rectángulo |
| Sombra con bordes duros | `filter: blur()` y `clip-path` en el mismo elemento (el recorte se aplica después) | desenfoque en el padre, recorte en el hijo |
| Dientes en el contorno del logo al hacer zoom | potrace siguió la escalera de píxeles del PNG | suavizar el alfa y ampliar ×8 antes de trazar (`vectorizar_logo.py`) |
| El logo del vaso aparece dentro de las letras del logo | encuadre de la foto dentro de la letra demasiado abierto | encuadrar sobre el producto (zoom ×2,25, foco arriba) |
| Partículas encima de los productos «ensucian» | un solo lienzo de efectos arriba de todo | un lienzo por escena, detrás de las piezas |
| Las fotos del carrusel muestran una esquina | no se llamó al encuadre para esas imágenes | encuadrar en cada `seek` (es barato) |
| Rayas flotando en el canto de una puerta 3D | cara trasera más angosta que la delantera | estirar el dorso al ancho del frente |
| Un brillo blanco borra letras | blanco sobre letras claras | brillo del color de la marca, o `screen` sobre letras oscuras |
| Palabras cortadas arriba o abajo al subir | el renglón `.linea` con `overflow: hidden` no deja aire a los rasgos | `padding: .06em .12em .16em` con margen negativo igual |
| Textos o fuentes distintas en algunos cuadros | captura antes de que cargue la fuente | `document.fonts.load` de cada peso/estilo en `listo` |
| Una imagen aparece tarde en el primer cuadro de un trabajador | imagen sin decodificar | `img.decode()` de todas en `listo` |
| `'EOS'.forEach is not a function` | los strings no tienen forEach | `[...'EOS'].forEach` |
| En 4K los lienzos se ven borrosos | canvas a 1920×1080 estirado | `width = 1920·DPR`, `setTransform(DPR…)`, blur y sombras ×DPR |
| Una imagen de fondo muestra manchas en las esquinas al moverse | `background-size` justo, se ven los bordes de la textura | fondo más grande que el recorrido de la cámara |
| Lo que está delante de una pared tapa lo que se ve por su hueco | los rayos/brillos no comparten el recorte de la pared | recortarlos con el mismo `clip-path` evenodd |
| Salto en el bucle | algo ambiental no da vueltas enteras en 15 s, o el final no vuelve a la pose inicial | `ciclo(t, n)` con n entero; medir con `costura.py` |
| Ola/nivel se ve «plano» | sin menisco | línea clara de 3 px con sombra blanca sobre la ola, recortada a la forma |
| `clip-path: path()` no recorta | comillas o comas mal en el string; o coordenadas en NaN | armar con `f2()` y probar con un camino simple; NaN = división por cero en algún `prog` |

## Del entorno (macOS / zsh)
- `rm previa/*.png` sin coincidencias en zsh aborta toda la cadena `&&` («no matches found»): usar
  `find previa -name '*.png' -delete` o separar con `;`.
- macOS no trae `timeout`; `sleep` largo en primer plano puede estar bloqueado: esperar con un bucle que
  mire el log (`until grep -q "listo en" log; do sleep 20; done`) o dejar el proceso en segundo plano.
- `grep` sobre un log que otro proceso escribe puede no mostrar lo último (búfer): contar los archivos
  de cuadros (`ls cuadros60_4k | wc -l`) para saber el avance.
