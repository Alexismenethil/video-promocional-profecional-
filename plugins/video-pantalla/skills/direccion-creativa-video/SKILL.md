---
name: direccion-creativa-video
description: Dirección creativa para videos cortos de pantalla de negocio de 15 s en bucle. Encuentra el hilo conductor en la marca, escribe el guion por pulsos y el cues.js, elige transiciones, color por escena, tipografía y composición para TV. Úsala después de conocer la marca y antes de animar, cuando haya que proponer la idea de un video promocional, mejorar uno existente o decidir cómo contar los productos en pocos segundos.
when_to_use: Parte de la skill video-pantalla-local (fase 2). También sirve sola para revisar un guion, criticar un video de referencia o pensar variaciones de un video ya hecho.
---

# Dirección creativa: la idea, el guion y el ritmo

Un video de pantalla se mira de reojo, en loop, a 3–5 metros. Tiene que **agarrar en el primer
segundo, mostrar producto con apetito y firmar la marca**, sin ruido. Lo que lo hace memorable es
**una idea que solo podría ser de esa marca**, no una plantilla con fotos cambiadas.

## 1. Encontrar el hilo conductor (lo más importante)

Busca en este orden y quédate con lo que tenga más fuerza visual:

1. **El objeto de la marca**: algo físico que la identifica. Sabor a Retablo → el retablo ayacuchano:
   una caja con puertas pintadas. Se abre, se entra, se cierra: el video entero es ese objeto.
2. **El nombre y su significado**: EOS = diosa del amanecer → el amanecer sobre los cerros andinos, que
   justo estaba en la foto real del Maracuyá.
3. **El logotipo como forma**: letras blanditas de EOS → letras-ventana llenas de gelato; se entra por la
   O y se sale por la S. Un logo con un símbolo (flor, sello) puede abrirse, girar, sembrar partículas.
4. **El local físico**: arcos de madera con luz cálida, toldos, azulejos, plantas. Traerlos como motivo
   (los arcos de EOS enmarcan todas las fotos; las monsteras de su carta van a las esquinas).
5. **El producto y su materia**: helado que se derrite (jarabe que chorrea, letras que se llenan y
   vacían), café con vapor, crepe que se dobla, bolas que caen y rebotan.

Propón 2 o 3 ideas en una línea cada una y elige la que cumpla: nace de la marca, tiene un recorrido
claro (entrar → recorrer → salir → firmar), cabe en 15 s, y se puede hacer bien con las fotos que hay.

## 2. Estructura de 15 s en bucle

El primer y el último cuadro son **la firma** (logo + lema): es el punto del bucle y lo que más tiempo
se ve. El recorrido típico:

| Tramo | Tiempo | Qué pasa |
| --- | --- | --- |
| Firma → gancho | 0–1,9 s | la firma se retira y la marca hace algo inesperado (se abre, crece, se llena) |
| Entrada | 1,9–2,8 s | la transición grande: la cámara entra (portal, letra, iris) |
| Producto estrella | 2,8–4,2 s | una foto protagonista a pantalla completa, con su nombre |
| Vitrina | 4,2–7,5 s | varios productos en arcos, uno por pulso |
| Segunda familia | 7,5–11,2 s | bebidas u otra categoría, con otra transición y otro color |
| Salida | 11,2–13 s | la cámara sale (inverso de la entrada) y todo vuelve a la marca |
| Firma | 13–15 s | logo, lema, filete, brillo; quieto lo suficiente para leerlo |

Reglas: una transición grande de entrada y su espejo de salida; entre medio, transiciones de otro
tipo (encogerse en un arco, jarabe, iris). **No más de 3 familias de producto.** Cada foto quieta al
menos ~1 s; un título, ~1,2 s.

## 3. Ritmo: todo cae en el pulso

Elige el tempo para que los compases **cierren exacto** en la duración, así la música loopea:

- **128 BPM, 4/4**: pulso 0,46875 s, compás 1,875 s → 8 compases = 15 s. (EOS)
- **120 BPM, 2/4**: pulso 0,5 s → 30 pulsos = 15 compases. (Sabor a Retablo, huayno)
- 96 BPM 4/4 → 6 compases; 112 BPM 4/4 → 7 compases.

Los eventos visuales (entra un arco, paso del carrusel, impacto) van **en pulsos**; los movimientos
largos empiezan en un tiempo fuerte (inicio de compás). Anota el guion en compases y pulsos y recién
después pásalo a segundos en `cues.js` (formato en la skill `animacion-html-deterministica`).

## 4. Color por escena

- Firma en el color claro de la marca (marfil/crema) con la tinta de la marca: elegante y legible.
- Escenas de producto en **fondos oscuros y saturados de la paleta** (verde bosque, frambuesa,
  turquesa): las fotos con luz cálida brillan encima y la TV se ve rica. Un color por escena.
- Cambiar de color es una transición en sí (jarabe que cubre, iris, letra que se vacía).
- Acentos: el dorado/roble de la marca para rótulos y filetes; texto en crema sobre oscuro.
- Nada de blanco puro ni negro puro; nada de colores que no estén en la marca.

## 5. Tipografía y composición para TV

Detalle y medidas en [referencias/tipografia-y-composicion.md](referencias/tipografia-y-composicion.md).
Lo esencial: títulos en la display de la marca (itálica para el acento), 100–190 px en un escenario de
1920×1080; rótulos en versalitas con tracking ancho (18–22 px); nombres de producto 40–50 px; nunca
menos de 14 px. Zona segura: 80–110 px de margen. Texto sobre foto solo donde la foto es oscura y lisa,
o con un velo.

## 6. Transiciones

Catálogo con cuándo usar cada una y dónde está la receta: [referencias/transiciones.md](referencias/transiciones.md).
Las que ya funcionaron: portal por la hornacina (SAR), letras-ventana + zoom con paralaje por una letra
(EOS), foto que se encoge en un arco (EOS), jarabe que chorrea (EOS), carrusel 3D (EOS), puertas que se
abren y cierran (SAR), bolas que caen al pulso (SAR), iris (SAR y plantilla).

## 7. Qué hace que se vea «llamativo y bonito»

- Un cambio de escala grande (algo pequeño que llena la pantalla, o al revés) en los primeros 2 s.
- Movimiento con peso: anticipación, rebote (outBack, resorte), gelatina en lo blando, escalonado de
  0,04–0,15 s entre piezas hermanas.
- Desenfoque de movimiento real (submuestras) en todo lo rápido.
- Profundidad: paralaje entre planos, sombras suaves, viñeta, grano muy leve.
- Un solo brillo al final (barrido de luz sobre el logo). Partículas sutiles y detrás de los productos.
- **Contención**: si dudas si un adorno suma, no suma.

## 8. Antes de animar, revisa el guion contra esto

- [ ] La idea sale de la marca y se entiende sin explicación.
- [ ] El primer segundo ya se mueve; la firma se ve completa al menos ~2 s entre final e inicio.
- [ ] Cada producto mostrado tiene foto real publicada y buena (mirada en la hoja de contactos).
- [ ] Ninguna foto a pantalla completa más de ~1,5 s quieta (se ablanda en 4K).
- [ ] Cada evento cae en un pulso; los compases cierran exacto en 15 s.
- [ ] Textos cortos: 1–3 palabras por título; nombres tal como están en la carta, bien escritos.
- [ ] El recorrido tiene espejo (entra/sale) y vuelve exacto al primer cuadro.

## Casos completos (guion, cues y lo que se aprendió)
- [referencias/caso-sabor-a-retablo.md](referencias/caso-sabor-a-retablo.md)
- [referencias/caso-eos-gelato.md](referencias/caso-eos-gelato.md)
- Código de ambos: `../video-pantalla-local/ejemplos/`
