// La marca de La Casa del Retablo: el logo vectorizado (letras, techo, la flor de cuatro pétalos y la
// firma), como formas de three.js (nítidas a cualquier tamaño) o dibujado en canvas; la casita (pentágono
// redondeado) de las etiquetas de precio y del portal.
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { lienzo, FUENTE } from './texturas.js';

const L = () => window.LOGO;

// ── capas del logo como Path2D (canvas) ──
function dibujarCapa(g, capa) {
  // potrace: <g transform="translate(0,H) scale(0.1,-0.1)">
  const m = capa.transform.match(/translate\(([-\d.]+),([-\d.]+)\)\s*scale\(([-\d.]+),([-\d.]+)\)/);
  g.save();
  g.translate(+m[1], +m[2]);
  g.scale(+m[3], +m[4]);
  g.fill(new Path2D(capa.d));
  g.restore();
}

// Logo en canvas: tinta = un solo color (o null para los colores originales)
export function logoCanvas({ ancho = 4096, tinta = null, margen = 0.04, sinTecho = false, firma = false, soloTecho = false, sinFlor = false } = {}) {
  const lg = L();
  const k = (ancho * (1 - 2 * margen)) / lg.w;
  const alto = Math.round(lg.h * k + ancho * margen * 2 + (firma ? lg.h * k * 0.16 : 0));
  const c = lienzo(ancho, alto), g = c.getContext('2d');
  g.translate(ancho * margen, ancho * margen);
  g.scale(k, k);
  const capas = lg.capas;
  let orden = [sinTecho ? 'letras_sin_techo' : 'letras', 'verde', 'rojo', 'naranja'];
  if (soloTecho) orden = ['techo', 'verde', 'rojo', 'naranja'];
  if (sinFlor) orden = orden.filter((n) => !['verde', 'rojo', 'naranja'].includes(n));
  for (const n of orden) {
    const capa = n === 'techo' ? lg.techo : capas[n];
    if (!capa) continue;
    g.fillStyle = tinta || capa.color || '#2c2e6b';
    dibujarCapa(g, capa);
  }
  if (firma && lg.firma) {
    const F = lg.firma;
    const kf = (lg.w * 0.42) / (F.caja[2] - F.caja[0]);
    g.save();
    g.translate(lg.w * 0.52 - F.caja[0] * kf, lg.h * 0.985 - F.caja[1] * kf);
    g.scale(kf, kf);
    g.fillStyle = tinta || '#2c2e6b';
    dibujarCapa(g, F);
    g.restore();
  }
  return c;
}

// ── formas three.js desde las capas (SVGLoader) ──
const _cache = {};
function formasDe(capa, clave) {
  if (_cache[clave]) return _cache[clave];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><g transform="${capa.transform}"><path d="${capa.d}"/></g></svg>`;
  const datos = new SVGLoader().parse(svg);
  const formas = [];
  datos.paths.forEach((p) => SVGLoader.createShapes(p).forEach((s) => formas.push(s)));
  _cache[clave] = formas;
  return formas;
}
function cajaDe(formas) {
  const b = new THREE.Box2(new THREE.Vector2(Infinity, Infinity), new THREE.Vector2(-Infinity, -Infinity));
  formas.forEach((s) => s.getPoints(8).forEach((p) => b.expandByPoint(p)));
  return b;
}

// La flor del logo (pétalos rojos y verdes, disco naranja), centrada en el disco, radio 1 = punta del pétalo.
let _flor = null;
export function florLogo() {
  if (_flor) return _flor;
  const c = L().capas;
  const rojo = formasDe(c.rojo, 'rojo'), verde = formasDe(c.verde, 'verde'), naranja = formasDe(c.naranja, 'naranja');
  const disco = cajaDe(naranja);
  const centro = disco.getCenter(new THREE.Vector2());
  const todo = cajaDe([...rojo, ...verde]);
  const R = Math.max(todo.max.x - centro.x, centro.x - todo.min.x, todo.max.y - centro.y, centro.y - todo.min.y);
  _flor = { rojo, verde, naranja, centro, R, rDisco: (disco.max.x - disco.min.x) / 2 / R };
  return _flor;
}

// Malla de la flor: colores = {rojo, verde, naranja} o un solo color; y hacia arriba, radio 1.
export function mallaFlor(colores, { opacidad = 1, segmentos = 6 } = {}) {
  const F = florLogo();
  const g = new THREE.Group();
  const col = typeof colores === 'string' ? { rojo: colores, verde: colores, naranja: colores } : colores;
  const mats = [];
  for (const [n, formas] of [['verde', F.verde], ['rojo', F.rojo], ['naranja', F.naranja]]) {
    const geo = new THREE.ShapeGeometry(formas, segmentos);
    geo.translate(-F.centro.x, -F.centro.y, 0);
    geo.scale(1 / F.R, -1 / F.R, 1);
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(col[n]), transparent: true, opacity: opacidad, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    mats.push(m);
    g.add(new THREE.Mesh(geo, m));
  }
  g.userData.mats = mats;
  return g;
}

// Flor del logo en canvas (para florcitas, íconos, sellos): blanca para teñir o con sus colores
export function florCanvas(tam = 256, colores = null, margen = 0.04) {
  const F = florLogo();
  const c = lienzo(tam, tam), g = c.getContext('2d');
  const k = (tam / 2 / (1 + margen)) / F.R;
  const lg = L();
  g.translate(tam / 2, tam / 2);
  g.scale(k, k);
  g.translate(-F.centro.x, -F.centro.y);
  for (const n of ['verde', 'rojo', 'naranja']) {
    g.fillStyle = colores ? colores[n] : '#ffffff';
    dibujarCapa(g, lg.capas[n]);
  }
  return c;
}

// ── la casita: pentágono redondeado (base y paredes rectas, techo a dos aguas) ──
// ancho 1, alto total `alto` (con el techo `techo`), origen abajo al centro
export function formaCasa(ancho = 1, alto = 1.1, techo = 0.38, radio = 0.06) {
  const a = ancho / 2, hp = alto - techo;
  const pts = [[-a, 0], [a, 0], [a, hp], [0, alto], [-a, hp]];
  const s = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const v0 = new THREE.Vector2(p0[0] - p1[0], p0[1] - p1[1]).normalize();
    const v2 = new THREE.Vector2(p2[0] - p1[0], p2[1] - p1[1]).normalize();
    const r = i === 3 ? radio * 0.7 : radio;
    const a0 = [p1[0] + v0.x * r, p1[1] + v0.y * r], a2 = [p1[0] + v2.x * r, p1[1] + v2.y * r];
    if (i === 0) s.moveTo(...a0); else s.lineTo(...a0);
    s.quadraticCurveTo(p1[0], p1[1], ...a2);
  }
  s.closePath();
  return s;
}
export function caminoCasa(g, x, y, ancho, alto, techo, radio) {
  const a = ancho / 2, hp = alto - techo;
  const pts = [[x - a, y], [x + a, y], [x + a, y - hp], [x, y - alto], [x - a, y - hp]];
  g.beginPath();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const d0 = Math.hypot(p0[0] - p1[0], p0[1] - p1[1]), d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const r = Math.min(radio, d0 / 2, d2 / 2);
    const a0 = [p1[0] + (p0[0] - p1[0]) / d0 * r, p1[1] + (p0[1] - p1[1]) / d0 * r];
    const a2 = [p1[0] + (p2[0] - p1[0]) / d2 * r, p1[1] + (p2[1] - p1[1]) / d2 * r];
    if (i === 0) g.moveTo(...a0); else g.lineTo(...a0);
    g.quadraticCurveTo(p1[0], p1[1], ...a2);
  }
  g.closePath();
}

// Etiqueta de precio con forma de casita: «S/ 160» (y abajo, chico, la medida o «c/u»)
export function etiquetaCanvas(precio, { fondo = '#d4163c', tinta = '#fbf5ea', borde = null, sub = '', ancho = 1024, flor = true } = {}) {
  const alto = Math.round(ancho * 1.02);
  const c = lienzo(ancho, alto), g = c.getContext('2d');
  const m = ancho * 0.06;
  const W = ancho - 2 * m, Ht = alto - 2 * m;
  const techo = W * 0.34;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.0)';
  caminoCasa(g, ancho / 2, alto - m, W, Ht, techo, W * 0.07);
  g.fillStyle = fondo;
  g.fill();
  if (borde) { g.lineWidth = W * 0.022; g.strokeStyle = borde; g.stroke(); }
  g.restore();
  // la flor en el techo
  if (flor) {
    const fc = florCanvas(256, { rojo: tinta, verde: tinta, naranja: fondo });
    const tf = techo * 0.62;
    g.drawImage(fc, ancho / 2 - tf / 2, m + techo * 0.30, tf, tf);
  }
  g.fillStyle = tinta;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const txt = String(precio);
  const yBase = m + techo + (Ht - techo) * (sub ? 0.62 : 0.72);
  // «S/» chico arriba a la izquierda del número
  const big = W * (txt.length >= 4 ? 0.36 : txt.length === 3 ? 0.44 : 0.52);
  g.font = `800 ${big.toFixed(1)}px ${FUENTE.texto}`;
  g.letterSpacing = `${(-big * 0.03).toFixed(1)}px`;
  const wNum = g.measureText(txt).width;
  const sS = big * 0.36;
  g.font = `800 ${sS.toFixed(1)}px ${FUENTE.texto}`;
  g.letterSpacing = '0px';
  const wS = g.measureText('S/').width;
  const x0 = ancho / 2 - (wNum + wS + big * 0.06) / 2;
  g.textAlign = 'left';
  g.fillText('S/', x0, yBase - big * 0.42);
  g.font = `800 ${big.toFixed(1)}px ${FUENTE.texto}`;
  g.letterSpacing = `${(-big * 0.03).toFixed(1)}px`;
  g.fillText(txt, x0 + wS + big * 0.06, yBase);
  if (sub) {
    g.font = `700 ${(W * 0.085).toFixed(1)}px ${FUENTE.texto}`;
    g.letterSpacing = `${(W * 0.012).toFixed(1)}px`;
    g.textAlign = 'center';
    g.globalAlpha = 0.85;
    g.fillText(sub.toUpperCase(), ancho / 2, yBase + W * 0.16);
  }
  return c;
}
