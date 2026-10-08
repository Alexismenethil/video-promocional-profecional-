// Entrada: carga fuentes y texturas, arma el mundo y expone window.seek(t, K) y window.listo.
import * as THREE from 'three';
import { Motor } from './motor.js';
import { crearNicho, recursosNicho } from './nicho.js';
import { crearRetablo } from './retablo.js';
import { FUENTE } from './texturas.js';
import { definirTarjetas } from './tarjetas.js';
import { crearTransiciones } from './transiciones.js';
import { crearGuion } from './guion.js';
import { E, prog, lerp } from './util.js';

const motor = new Motor();
const D = window.DATOS;
const CUES = window.CUES;
const FPS = CUES.fps || 60;

async function cargarFuentes() {
  const pedidos = [
    `italic 500 100px ${FUENTE.display}`, `italic 600 100px ${FUENTE.display}`, `500 100px ${FUENTE.display}`,
    `700 100px ${FUENTE.texto}`, `800 100px ${FUENTE.texto}`, `500 100px ${FUENTE.texto}`, `600 100px ${FUENTE.texto}`,
  ];
  await Promise.all(pedidos.map((f) => document.fonts.load(f, 'ÁÉÍÓÚáéíóúñÑ S/ 0123456789 Crepe Clásica')));
  await document.fonts.ready;
}
const cargarImagen = (src) => new Promise((ok, mal) => { const im = new Image(); im.onload = () => ok(im); im.onerror = mal; im.src = src; });

const productos = {};
for (const t of D.tarjetas) for (const p of t.productos) productos[p.slug] = p;

let mundo = null;
async function armar() {
  await cargarFuentes();
  const atlasImg = await cargarImagen('assets/motivos/atlas.png');
  const tx = (s, o) => motor.textura(s, o);
  const [atlasMotivos, frontonTex, puertaIzq, puertaDer, dorsoIzq, dorsoDer] = await Promise.all([
    tx('assets/motivos/atlas.png'), tx('assets/retablo/fronton.png'), tx('assets/retablo/puerta-izq.jpg'),
    tx('assets/retablo/puerta-der.jpg'), tx('assets/retablo/dorso-izq.jpg'), tx('assets/retablo/dorso-der.jpg')]);
  const tex = {};
  await Promise.all(Object.values(productos).map(async (p) => { tex[p.slug] = await motor.textura(p.src); }));
  const recursos = { tex, atlasMotivos, frontonTex, puertaIzq, puertaDer, dorsoIzq, dorsoDer, ...recursosNicho(motor, atlasImg) };
  const retablo = crearRetablo(motor, recursos);
  const defs = definirTarjetas(productos);
  const nichos = defs.map((d) => crearNicho(motor, recursos, d));
  mundo = { retablo, nichos, defs, camA: new THREE.PerspectiveCamera(), camB: new THREE.PerspectiveCamera() };
  const tr = crearTransiciones(motor, recursos);
  guion = crearGuion(motor, mundo, tr);
}

let guion = null;
function dibujar(t, k, K) { guion.dibujar(t, k, K); }

window.seek = (t, K) => {
  motor.cuadro(t, K || 8, 0.5, FPS, dibujar, { bloom: 0.22, radio: 0.45, umbral: 1.12, vineta: 0.38 });
};
window.listo = armar().then(() => { window.seek(0, 1); });
