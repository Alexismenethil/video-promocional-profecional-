// Entrada: fuentes, tableros, transiciones y guion. Las fotos de los productos se cargan por tramos
// (las del tablero que se dibuja y sus vecinos) y se liberan las lejanas: así entran en la memoria
// de la GPU aunque sean muchas y grandes. window.seek(t, K) espera a que estén antes de dibujar.
import * as THREE from 'three';
import { Motor } from './motor.js';
import { FUENTE } from './texturas.js';
import { crearTablero } from './tablero.js';
import { definirTableros } from './tableros.js';
import { crearTransiciones } from './transiciones.js';
import { crearGuion } from './guion.js';
import { crearApertura } from './apertura.js';

const motor = new Motor();
const D = window.DATOS;
const CUES = window.CUES;
const FPS = CUES.fps || 60;

async function cargarFuentes() {
  const pedidos = [`italic 500 100px ${FUENTE.display}`, `italic 600 100px ${FUENTE.display}`, `600 100px ${FUENTE.display}`,
    `700 100px ${FUENTE.texto}`, `800 100px ${FUENTE.texto}`, `500 100px ${FUENTE.texto}`, `600 100px ${FUENTE.texto}`];
  await Promise.all(pedidos.map((f) => document.fonts.load(f, 'ÁÉÍÓÚáéíóúñÑ S/ 0123456789 × Retablo')));
  await document.fonts.ready;
}

let guion = null, tableros = [];
const cache = {};          // slug → textura cargada
const cargando = {};

// claves: «slug» (la foto del producto), «slug#vidrio» (máscara del vidrio de un espejo), «foto:clave»
// (foto de la casa: {foto, fondo, masc})
async function cargarClave(clave) {
  if (clave.startsWith('foto:')) {
    const F = D.fotos[clave.slice(5)];
    const [foto, fondo, masc] = await Promise.all([motor.textura(F.src), F.fondo ? motor.textura(F.fondo) : null,
      F.mascara ? motor.textura(F.mascara, { srgb: false }) : null]);
    return { foto, fondo, masc, dispose() { foto.dispose(); fondo?.dispose(); masc?.dispose(); } };
  }
  if (clave.endsWith('#vidrio')) return motor.textura(D.productos[clave.slice(0, -7)].vidrio, { srgb: false });
  return motor.textura(D.productos[clave].src);
}
async function cargar(clave) {
  if (cache[clave]) return cache[clave];
  if (!cargando[clave]) cargando[clave] = cargarClave(clave).then((tx) => { cache[clave] = tx; delete cargando[clave]; return tx; });
  return cargando[clave];
}
// Tableros que tocan el instante t (con margen para las transiciones)
function tablerosEn(t, margen) {
  return tableros.filter((n) => t >= n.def.t0 - margen && t < n.def.t0 + n.def.dur + margen);
}
async function asegurar(t) {
  const cerca = tablerosEn(t, 1.6);
  const pedir = new Set();
  cerca.forEach((n) => n.slugs.forEach((s) => pedir.add(s)));
  guion.slugsExtra?.(t).forEach((s) => pedir.add(s));
  await Promise.all([...pedir].map(cargar));
  cerca.forEach((n) => n.texturas(cache));
  guion.texturas?.(cache);
  // liberar lo lejano
  const lejos = new Set();
  tablerosEn(t, 14).forEach((n) => n.slugs.forEach((s) => lejos.add(s)));
  guion.slugsExtra?.(t).forEach((s) => lejos.add(s));
  for (const s of Object.keys(cache)) {
    if (!lejos.has(s)) { cache[s].dispose(); delete cache[s]; }
  }
}

async function armar() {
  await cargarFuentes();
  const defs = definirTableros();
  const recursos = { productos: D.productos, fotos: D.fotos, datos: D };
  tableros = defs.map((d) => crearTablero(motor, recursos, d));
  const mundo = { tableros, camA: new THREE.PerspectiveCamera(), camB: new THREE.PerspectiveCamera() };
  mundo.apertura = crearApertura(motor, recursos);
  const tr = crearTransiciones(motor, recursos);
  guion = crearGuion(motor, mundo, tr);
  window.guion = guion;
  window.tableros = tableros;
  window.eventos = () => guion.eventos(defs);
}

window.seek = async (t, K) => {
  await asegurar(t);
  motor.cuadro(t, K || 8, 0.5, FPS, (tk, k, KK) => guion.dibujar(tk, k, KK), guion.ajustes(t));
};
window.listo = armar().then(() => window.seek(0, 1));
