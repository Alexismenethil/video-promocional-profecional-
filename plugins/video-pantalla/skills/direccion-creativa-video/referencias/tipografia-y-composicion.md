# Tipografía, color y composición para pantallas

Escenario fijo de 1920×1080 (en 4K se genera con devicePixelRatio 2: todo lo vectorial sale nítido).

## Tipografía

- **Siempre las fuentes de la marca** (las del build de la carta: `fuentes_next.py`). Nunca una genérica
  si la marca tiene las suyas. Display para títulos (serif o redonda), sans para rótulos y datos.
- Tamaños que funcionaron en TV (px del escenario 1920×1080):

| Uso | Tamaño | Estilo |
| --- | --- | --- |
| Título de escena | 150–190 (una palabra), 100–120 (frase) | display itálica 500, interlineado 0,92 |
| Acento del título | 60–65 % del título | misma itálica, color de acento |
| Rótulo (sobre el título) | 18–22 | sans 700, versalitas, tracking 0,24 em, color dorado |
| Nombre de producto | 40–50 | display itálica 500 |
| Categoría bajo el nombre | 14–16 | sans 700, versalitas, tracking 0,2 em |
| Lema de la firma | 56–64 | display 500 + parte en itálica de acento |

- Cifras en estilo antiguo (Cormorant) quedan mal en precios: si hay números, `lining-nums`.
- Probar el nombre más largo (p. ej. «Avellana del Piamonte») en su caja: nada de cortes.
- Texto siempre con aire: si toca un arco o una foto, bajar tamaño o mover la pieza.
- El rótulo va antes de un título, nunca solo. Una sola jerarquía por escena.

## Color

- Tomar los tokens del CSS de la carta (`globals.css`, `IDENTIDAD.md`, `DESIGN.md`): superficie, tinta,
  primario, acento, terciario. Anotarlos como variables en `:root` del `index.html`.
- Fondos de escena: degradado radial del color (centro un paso más claro, bordes más oscuros) + un halo
  cálido suave detrás de los productos (la luz de la vitrina). Viñeta 0,5–0,7 en escenas oscuras.
- Texto sobre oscuro en crema (no blanco); acento dorado o el rosa/terciario de la marca.
- Grano muy leve (opacidad 0,06, overlay): quita lo «digital plano» sin ensuciar.

## Composición

- Margen seguro 80–110 px. Títulos a la izquierda con la vitrina a la derecha, o centrados arriba con
  el carrusel abajo (variar entre escenas).
- Arcos de producto (el motivo de EOS): 340×460 con borde crema de 7 px, radio de arriba = ancho/2,
  abajo 14 px; sombra `0 34px 60px -28px rgba(0,0,0,.7)` y halo cálido. En el carrusel, 430×580.
- Fotos: encuadre **por cobertura** con un foco (0–1) sobre lo apetitoso; el producto lleno, no el
  fondo. Si la foto tiene el logo del vaso, que no quede dentro de otra letra del logo.
- Hojas, flores o adornos: en las esquinas, parcialmente fuera de cuadro, girando desde su tallo; nunca
  compitiendo con el logo ni tapando texto.
- Partículas (virutas, pétalos): detrás de los productos, opacidad 0,35–0,6, lentas, periódicas en 15 s.

## Legibilidad a distancia (TV del local)
- Contraste alto en títulos; nada de texto fino sobre foto.
- Cada texto en pantalla al menos ~1,2 s ya asentado.
- Movimiento del texto solo al entrar y salir; quieto mientras se lee.
