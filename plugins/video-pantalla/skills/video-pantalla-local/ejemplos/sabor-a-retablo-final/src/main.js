// Entrada: carga fuentes y texturas, arma el retablo, los veintidós tableros y las transiciones, y
// expone window.seek(t, K) y window.listo.
import * as THREE from 'three';
import { Motor } from './motor.js';
import { recursosNicho } from './nicho.js';
import { crearRetablo } from './retablo.js';
import { FUENTE } from './texturas.js';
import { crearTablero } from './tablero.js';
import { definirTableros } from './tableros.js';
import { crearTransiciones } from './transiciones.js';
import { crearGuion } from './guion.js';

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

let guion = null;
async function armar() {
  await cargarFuentes();
  const atlasImg = await cargarImagen('assets/motivos/atlas.png');
  const tx = (s, o) => motor.textura(s, o);
  const [atlasMotivos, frontonTex, puertaIzq, puertaDer, dorsoIzq, dorsoDer] = await Promise.all([
    tx('assets/motivos/atlas.png'), tx('assets/retablo/fronton.png'), tx('assets/retablo/puerta-izq.jpg'),
    tx('assets/retablo/puerta-der.jpg'), tx('assets/retablo/dorso-izq.jpg'), tx('assets/retablo/dorso-der.jpg')]);
  const defs = definirTableros();
  defs[0].portal = [0, -3.6, 21];
  defs[defs.length - 1].portal = [0, -2.8, 21];
  // texturas de los productos que salen (recorte y sombra)
  const usados = new Set(defs.flatMap((d) => (d.prods || []).map((p) => p.slug)));
  const tex = {}, sombra = {};
  await Promise.all([...usados].map(async (slug) => {
    const p = D.productos[slug];
    tex[slug] = await motor.textura(p.src);
    sombra[slug] = await motor.textura(p.sombra, { srgb: false });
  }));
  const recursos = { tex, sombra, productos: D.productos, atlasMotivos, frontonTex, puertaIzq, puertaDer, dorsoIzq, dorsoDer, ...recursosNicho(motor, atlasImg) };
  const retablo = crearRetablo(motor, recursos);
  const tableros = defs.map((d) => crearTablero(motor, recursos, d));
  const mundo = { retablo, tableros, camA: new THREE.PerspectiveCamera(), camB: new THREE.PerspectiveCamera() };
  const tr = crearTransiciones(motor, recursos);
  guion = crearGuion(motor, mundo, tr);
  window.guion = guion;
  // Eventos de sonido de los tableros (entradas, sellos, ventanas, destellos), para audio.py
  window.eventos = () => {
    const ev = [];
    const panDe = (x) => Math.max(-0.8, Math.min(0.8, ((x - 960) / 960) * 0.9));
    defs.forEach((d, j) => {
      (d.prods || []).forEach((p, i) => {
        const tipo = p.entrada || d.entrada || 'pop';
        const te = d.t0 + (p.t ?? d.tEntrada ?? -0.15) + (p.t != null ? 0 : i * (d.escalon ?? 0.12));
        const x = p.ventana != null ? d.ventanas[p.ventana].cx : p.cx;
        if (tipo !== 'quieto') ev.push({ t: +te.toFixed(4), tipo, tablero: j, pan: +panDe(x).toFixed(2) });
        (p.brillos || []).forEach((b) => ev.push({ t: +(d.t0 + b[2]).toFixed(4), tipo: 'destello', tablero: j, pan: +panDe(x).toFixed(2) }));
      });
      (d.ventanas || []).forEach((v, i) => ev.push({ t: +(d.t0 + (v.t ?? -0.2) + i * (d.escalon ?? 0.12)).toFixed(4), tipo: 'ventana', tablero: j, pan: +panDe(v.cx).toFixed(2) }));
      (d.sellos || []).forEach((sd) => ev.push({ t: +(d.t0 + (sd.t ?? 0.8)).toFixed(4), tipo: sd.etiqueta === 'PROMO' ? 'promo' : 'sello', tablero: j, pan: +panDe(sd.x).toFixed(2) }));
      const tit = (d.textos || []).find((x) => x.estilo?.familia?.includes('Playfair') && x.estilo.px >= 88);
      if (tit) ev.push({ t: +(d.t0 + (tit.t ?? 0.3)).toFixed(4), tipo: 'titulo', tablero: j, pan: +panDe(tit.x).toFixed(2) });
    });
    return ev.sort((a, b) => a.t - b.t);
  };
}

function dibujar(t, k, K) { guion.dibujar(t, k, K); }

window.seek = (t, K) => {
  motor.cuadro(t, K || 8, 0.5, FPS, dibujar, guion.ajustes(t));
};
window.listo = armar().then(() => { window.seek(0, 1); });
