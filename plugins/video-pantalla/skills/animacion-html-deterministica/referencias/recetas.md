# Recetas probadas

Código mínimo de cada efecto, con los valores que funcionaron. Las funciones base (`prog`, `E`,
`vaiven`, `mul/T/S/ap/sobre`, `dArco`, `dOla`, `clip`, `ver`, `sube`, `encuadrarCaja`, `lienzo`,
`virutas`, `jarabe`, `circulo`) están en `../plantilla/anim.js`. El código completo de cada video está
en `../../video-pantalla-local/ejemplos/{sabor-a-retablo,eos-gelato}/anim.js`.

---

## 1. Resortes y gelatina

```js
// Resorte a un escalón (SAR): 0 → 1 con sobrepaso; u en segundos desde el evento.
function spring(u, freq = 2, zeta = 0.5) {
  if (u <= 0) return 0;
  const w = 2 * Math.PI * freq, wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * u) * (Math.cos(wd * u) + ((zeta * w) / wd) * Math.sin(wd * u));
}
// Puerta que rebota contra el tope en vez de atravesar la pared:
const angulo = 180 - Math.abs(180 - 180 * spring(t - t0, 1.35, 0.72));

// Gelatina (EOS): cada letra se aplasta/estira sobre su base, con retraso entre letras.
const g = vaiven(t - c0 - i * 0.045, 2.6, 5.2) * 0.13;            // f=2,6 Hz, amortigua 5,2
const J = sobre(letra.cx, letra.base, S(1 - g * 0.55, 1 + g));    // conserva el volumen a ojo
```

## 2. Encuadre por cobertura (usarlo en TODO lo que recorta una foto)

```js
// La foto cubre el rectángulo r; el foco (0–1) va al centro hasta donde dejan los bordes.
const cubrir = (r, fx, fy, zf, lado = 1122) => {
  const w = r.x1 - r.x0, h = r.y1 - r.y0, s = (Math.max(w, h) / lado) * zf, n = s * lado;
  return { s,
    tx: clamp((r.x0 + r.x1) / 2 - s * fx * lado, r.x1 - n, r.x0),
    ty: clamp((r.y0 + r.y1) / 2 - s * fy * lado, r.y1 - n, r.y0) };
};
img.style.transform = `translate(${tx}px,${ty}px) scale(${s * lado / img.naturalWidth})`;   // transform-origin 0 0
```
Para fotos no cuadradas usar `encuadrarCaja` (usa naturalWidth y naturalHeight).

## 3. Letras-ventana (EOS)

`assets/logo.js` (de `vectorizar_logo.py`): cada letra = lista de subtrazos cúbicos en px del logo.

```js
function dSub(sp, A) {                     // subtrazo → camino SVG transformado por la afín A
  let p = ap(A, sp[0], sp[1]), d = `M${f2(p[0])} ${f2(p[1])}`;
  for (let i = 2; i < sp.length; i += 6) {
    const a = ap(A, sp[i], sp[i+1]), b = ap(A, sp[i+2], sp[i+3]), c = ap(A, sp[i+4], sp[i+5]);
    d += `C${f2(a[0])} ${f2(a[1])} ${f2(b[0])} ${f2(b[1])} ${f2(c[0])} ${f2(c[1])}`;
  }
  return d + 'Z';
}
function dLetra(L, A, hueco = 1) {         // hueco 1→0 cierra la «O» (escala el agujero a su centro)
  const l = LET[L]; let d = dSub(l.sps[0], A);
  if (l.sps[1] && hueco > 0.002) d += dSub(l.sps[1], mul(A, sobre(l.hueco.x, l.hueco.y, S(hueco))));
  return d;
}
const matLogo = (cy, k) => mul(T(960, cy), mul(S(k), T(-LW / 2, -LH / 2)));
const A_E = mul(camara.M, mul(matLogo(cy, k), jalea.E));
clip(ventanaE, dLetra('E', A_E), true);    // la ventana (1920×1080) muestra su foto solo dentro de la E
```
Estructura: `.ventana` (clip de la letra) › `.nivel` (clip de la ola: `dOla(x0, x1, nivel, amp, t)`)
› `img`. El nivel sube de la base a la cima de la caja de la letra con inOutSine; amplitud
`14·sin(πu)+2`. Menisco: en un canvas encima, recortar a la letra y trazar `olaEn(x…)` con línea clara
de 3 px y sombra blanca (se lee como líquido). Logo verde **debajo** de las ventanas; se oculta cuando
las ventanas están llenas (evita el filo verde del antialias).

Encuadre dentro de la letra: sobre la bola, no el vaso (si no, aparece el logo del vaso dentro de la
letra): altura de la foto = 2,25 × altura de la letra, foco ~(0,52, 0,36).

## 4. Zoom con paralaje por una letra o un hueco (EOS)

```js
const ZIN = 7, LEJOS = 2.5;
const zLejos = (z) => LEJOS / (LEJOS - (1 - 1 / z));    // el plano de la foto crece menos
function camara(t) {                                    // entra por la O: escala alrededor de su centro
  const e = E.inOutCubic(prog(t, z0, z1)), z = Math.exp(Math.log(ZIN) * e);
  const cx = lerp(centroO[0], 960, e), cy = lerp(centroO[1], 540, e);
  return { z, M:  mul(T(cx, cy), mul(S(z), T(-centroO[0], -centroO[1]))),
              Mf: mul(T(cx, cy), mul(S(zLejos(z)), T(-centroO[0], -centroO[1]))) };
}
```
- La foto usa `Mf`; su encuadre inicial `F0` es el final `F1` visto hacia atrás:
  `Mend = T(960,540)·S(zLejos(ZIN))·T(-centroO)`, `F0.origen = Mend⁻¹(F1.origen)`, `F0.s = F1.s / zLejos(ZIN)`.
- **Margen obligatorio**: como la foto crece menos que la letra, su borde puede asomar dentro de la
  letra a mitad del zoom. Condición (arriba): `zLejos(z)·(540 + m)/zLejos(ZIN) ≥ min(alto_letra/2·z, cy)`;
  para EOS salió m ≈ 150 px → `F1` cubre ×1,08 con 160 px de foto por encima del cuadro. Lo mismo a
  los lados. Revisar 4 cuadros a mitad del zoom.
- Cuando la letra ya cubre la pantalla (z > ~6), quitar el `clip-path`.
- Antes del zoom, cerrar el hueco de la O (`hueco` 1→0 en 0,26 s): así se entra por un óvalo lleno.

## 5. Salida por una letra y vaciado (EOS)
La escena entera va en `#escena` › `#escenaNivel`. Durante la salida:
`clip(#escena, dLetra(E)+dLetra(O)+dLetra(S), true)` con la cámara alejándose desde el núcleo de la S
(`nucleo` en logo.js, `ZOUT ≈ 1101/(r_nucleo·k)·1.1`, easing outCubic). Luego, por letra y escalonado,
`#escenaNivel` se recorta con `dOla(…)` cuyo nivel baja de la cima a la base: aparece el logo sólido que
está debajo. Al terminar, ocultar la escena.

## 6. Encoger una foto en un arco y cambiarla por el arco del DOM (EOS)
```js
const u = E.inOutCubic(prog(t, e0, e1));
const r = { x0: lerp(0, dst.x0, u), y0: lerp(0, dst.y0, u), x1: lerp(1920, dst.x1, u), y1: lerp(1080, dst.y1, u) };
const F = cubrir(r, lerp(foco2[0], focoArco[0], u), lerp(foco2[1], focoArco[1], u), lerp(1.16, 1, u));
clip(heroe, dArco(r.x0, r.y0, r.x1, r.y1, lerp(0, RT - BORDE, E.outCubic(u)), lerp(0, rb - BORDE / 2, u)));
```
Marco crema: otra capa con `dArco` expandido `BORDE·m` (m sube en la segunda mitad). Sombra: capa padre
con `filter: blur(30px)` y el hijo recortado (`dArco` metido 21 px y bajado 34 px: igual a
`box-shadow: 0 34px 60px -28px`). Al llegar, ocultar la foto viajera y mostrar el arco del DOM con el
mismo encuadre: comparar el cuadro anterior y el posterior (diferencia de recortes ≈ 0).

## 7. Portal por un hueco (SAR)
```js
// yeso (pared) con la hornacina calada; mundo = yeso + retablo, escalado por la cámara
yeso.style.clipPath = `path(evenodd, "M0 0 H2160 V1320 H0 Z M${x0} ${y0} H${x1} V${y1} H${x0} Z")`;
mundo.style.transform = `translate(${P.x - Z * N0.x}px, ${P.y - Z * N0.y}px) scale(${Z})`;
// Z = exp(ln(ZMAX)·e) (ZMAX 5,6: la hornacina cubre la pantalla); P va del nicho al centro
// la escena de adentro se ve más chica y crece menos (paralaje):
const sc = Math.exp(lerp(Math.log(0.4), 0, e));
escena.style.transform = `translate(${P.x - sc * 960}px, ${P.y - sc * 540}px) scale(${sc})`;
```
Salida: `e = 1 - outQuart(prog(t, retroceso))`. Recortar con el mismo hueco todo lo que esté delante
de la pared (rayos de luz, brillos), o tapan la escena.

## 8. Puertas 3D (SAR)
```css
#retablo { perspective: 2100px; transform-style: preserve-3d; }
.puerta { position: absolute; transform-style: preserve-3d; }
#puertaIzq { transform-origin: 0 50%; }   #puertaDer { transform-origin: 100% 50%; }
.cara { position: absolute; backface-visibility: hidden; }
.dorso { transform: rotateY(180deg); }      /* cara trasera: recorte del retablo ABIERTO */
.canto { width: 16px; transform: rotateY(90deg); }   /* espesor de la madera */
```
Frente = recorte del retablo cerrado; dorso = recorte del abierto, **estirado al ancho del frente**
(si no, queda una raya flotando). Sombreado por cara: opacidad `0.42·sin(ángulo)`. Cierre: `180·(1 −
inCubic(u))` y después rebote `6·e^(−9u)·|sin 19u|`, más un aplastamiento de la caja (1,2 %) y polvo.

## 9. Carrusel 3D (EOS, plantilla)
Contenedor con `perspective: 2000px`; `#anillo` con `transform-style: preserve-3d`; cada arco
`rotateY(i·360/N) translateZ(R)` y `backface-visibility: hidden`. Giro:
`g = −200·(1−outCubic(entrada)) − Σ paso·outBack(prog(t, p, p+0.4), 1.25)` y
`anillo.style.transform = scale(s) translateZ(−R) rotateY(g)`. El de adelante: `round(−g/paso) mod N`;
su etiqueta se apaga a mitad de cada paso (`1 − resto·4`). Valores: 430×580, R = 830, 8–10 arcos.

## 10. Jarabe (EOS, plantilla)
Ver `jarabe()` en la plantilla. Claves: frente que ondula (12 px, lento); dedos con ensanche en la
base → cuello de 0,56·ancho → gota de radio 0,4·ancho; anchos 40–120, largos 90–470 (los finos más
largos); `L = largo·outSine(u·1,7·vel)·(1 − 0,4u²)`; dedo corto = bulto (escala entera); veta de brillo
+ punto de luz por gota; algunas gotas se sueltan (`y = tip + 26 + v²·1100`). Sombra de canvas con DPR.
Al cubrir (u = 1) se pinta el rectángulo entero y la escena nueva aparece encima con el mismo fondo.

## 11. Partículas con física cerrada y cámara (SAR)
```js
// gravedad g + arrastre lineal k, sin integrar: posición exacta en u segundos
const fk = (1 - Math.exp(-k * u)) / k;
const x = x0 + vx * fk, y = y0 + vy * fk + (g / k) * (u - fk), z = z0 + vz * fk;
const sc = F / (F - (z + e * 900));              // perspectiva; la cámara avanza con e
```
Pétalos de formas dibujadas en canvas (hoja, gota, florcita, estrella) con giro y «flip» (escala x =
|cos|). Ambiente periódico: reloj propio que da la vuelta en `dur` (`τ = (t − t0) mod dur`).

## 12. Virutas / ambiente periódico
`y = ((y0 − (t/dur)·alto·vueltas) mod alto)`, `x = x0 + amp·sin(ciclo(t,2)+fase)`,
`ángulo = giro + ciclo(t, giros)` con vueltas y giros **enteros**. Un lienzo por escena, detrás de los
productos; en la firma, detrás del logo.

## 13. Brillo que barre el logo
- SVG: banda (rect con degradado transparente→crema 0,42→transparente, `skewX(-18)`) dentro de un
  `<g clip-path="url(#logoClip)">` con el mismo camino del logo, y `mix-blend-mode: screen`.
- Texto HTML: capa gemela con `background: linear-gradient(105deg, transparent 40%, rgba(255,244,214,.55)
  50%, transparent 60%)`, `background-clip: text`, `background-size: 300% 100%`, mover `background-position`.
- Sobre letras claras el blanco las borra: usar un color de la marca (SAR: turquesa).

## 14. Hojas en las esquinas (EOS)
Recorte con `recortar_fondo_blanco.py`. Transformar desde el tallo:
`translate(tallo) rotate(r + vaivén) scale(s) translate(−talloEnImagen)`, vaivén ±1,5° con período
`dur/2`. Sombra: la misma imagen con `filter: brightness(0) blur(14px)` a 0,13, corrida hacia abajo.

## 15. Vapor de una taza (SAR)
Canvas con bocanadas: círculos grandes muy transparentes que suben, se abren y se apagan, con
`filter: blur(7·DPR px)`; origen en un punto de la foto (encuadre conocido). Sutil: se nota en
movimiento, no en un cuadro.

## 16. Caída con aplastamiento (SAR, bolas de helado)
`y = y0 + (base − y0)·inQuad(u)` en 0,34 s; al tocar, `scaleX 1+0,18·v, scaleY 1−0,22·v` con
`v = vaiven(t − toque, 3.2, 7)`; un saltito; baile al pulso (`±4°` y `−6 px` en cada tiempo). Caen
primero las piezas de la fila de abajo (si no, las de arriba las atraviesan).

## 17. Grano, viñeta, luz de vitrina
Grano: 6 lienzos de ruido fijos (960×540 estirados), `floor(t·30) mod 6`, overlay a 0,06. Viñeta:
radial transparente 55 % → negro 0,5, opacidad 0,16 en la firma y 0,7 en escenas oscuras. Halo cálido
detrás de los productos: radial `rgba(214,160,80,.2)`. Bokeh: círculos radiales en `lighter`, corridos
con el giro del carrusel (paralaje).

## 18. Tablas que giran: prismas de trivisión (Sabor a Retablo, menu board)

La pantalla se parte en N tablas triangulares (eje vertical u horizontal) que giran 120° en ola; la
cara de adelante lleva la escena que se va y la que gira hacia el frente, la que llega. Las dos
escenas se dibujan antes en búferes (canvas fuera de pantalla, a DPR) con la misma función de
escena. Cada cara se proyecta en perspectiva por columnas finas (1,25 px) con la inversa cerrada:

```js
// prisma i: eje en xc = (i+0,5)·w, z = −a (a = w/(2√3)); cara k con normal φ = θ + k·120°
const nx = Math.sin(phi), nz = Math.cos(phi), pcx = xc + a * nx, pcz = -a + a * nz;
if (nx * (c1 - pcx) + nz * (FOCO - pcz) <= 0.5) continue;           // de espaldas a la cámara
const tx = Math.cos(phi), tz = -Math.sin(phi);                         // borde: P(s) = P0 + s·(dx, dz)
const x0 = pcx - tx * w / 2, z0 = pcz - tz * w / 2, dX = tx, dZ = tz;
const pr = (x, z) => c1 + (x - c1) * FOCO / (FOCO - z);                 // FOCO 2300
const sDe = (xp) => ((xp - c1) * (FOCO - z0) - FOCO * (x0 - c1)) / (FOCO * dX + (xp - c1) * dZ);
for (let xa = pr(x0, z0); xa < pr(x1, z1); xa += 1.25) {               // una columna de la cara
  const sa = sDe(xa), sb = sDe(xa + 1.25), kz = FOCO / (FOCO - (z0 + dZ * (sa + sb) / 2));
  g.drawImage(buf, (xc - w/2 + sa) * DPR, 0, (sb - sa) * DPR, H * DPR,
              xa, c2 - (c2 + EXT) * kz, 1.25 + 0.6, (H + 2 * EXT) * kz);
}
```
- Ángulo: `−120°·inOutCubic(u)` con u de 0,62 s por tabla, retraso 0,04–0,07 s entre tablas
  (izquierda→derecha, al revés o desde el centro) + `vaiven(golpe, 3,4, 9)·0,09` al encajar.
- Luz Lambert normalizada para que en reposo la cara quede igual a la escena; la luz viene del lado
  de donde gira la cara nueva (entra iluminada, la vieja se apaga). Por encima de 1, un velo
  `lighter` crema muy suave. Sombreado = un solo trapecio por cara (no por columna).
- Las tablas sobran 4,5 % por los extremos (`EXT`): si no, al girar aparecen cuñas oscuras.
- Entre tablas se ve el fondo: el tono hondo de las dos escenas mezclado con negro (0,28), no negro.
- Ordenar las caras por z antes de dibujar. Tablas horizontales: lo mismo con filas.
- Sonido: un clac de madera por tabla en su golpe, con el paneo de su lugar en pantalla, y un whoosh
  que cruza en el sentido de la ola.
- Submuestras 8 en todo el tramo de la ola.
