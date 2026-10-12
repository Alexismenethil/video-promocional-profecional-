// Coordenadas de diseño (1920×1080) llevadas al mundo, y los renglones de texto: cada glifo sube desde
// abajo de su línea base (recortado bajo la línea), como en los videos anteriores.
import * as THREE from 'three';
import { atlasTexto, FUENTE } from './texturas.js';
import { clamp, E } from './util.js';

export const DC = 16, FOV = 30;
const TAN = Math.tan((FOV * Math.PI) / 360);
export const S0 = (2 * DC * TAN) / 1080;          // mundo por px de diseño en z = 0
export const ZT = 0.35;                            // los textos, apenas delante de los productos
export const aMundo = (px, py, z = 0) => { const f = (DC - z) / DC; return [(px - 960) * S0 * f, (540 - py) * S0 * f, z]; };
export const tamMundo = (px, z = 0) => (px * S0 * (DC - z)) / DC;
export const CREMA = '#fbf5ea', AZUL = '#2c2e6b', ROJO = '#d4163c';

export function mezcla(a, b, u) {
  const h = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const A = h(a), B = h(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * u).toString(16).padStart(2, '0')).join('');
}
export const srgb = (h) => { const n = parseInt(h.slice(1), 16); return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };
const col = (h) => new THREE.Color(h);

const VERT_GLIFO = /* glsl */ `uniform float dy; varying vec2 vUv; varying float vY;
  void main(){ vUv = uv; vY = position.y + dy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG_GLIFO = /* glsl */ `uniform sampler2D mapa; uniform vec3 color; uniform float opacidad, corte;
  varying vec2 vUv; varying float vY;
  void main(){ if (vY < corte) discard; vec4 c = texture2D(mapa, vUv); gl_FragColor = vec4(c.rgb * color, c.a * opacidad); }`;

export function linea(motor, texto, { familia = FUENTE.display, peso = 600, estilo = 'italic', px = 60, tracking = 0,
  color = CREMA, alinear = 'izq', sombra = null, z = ZT } = {}) {
  const pxAtlas = Math.max(96, Math.round(px * 2.3));
  const at = atlasTexto(texto, { familia, peso, estilo, px: pxAtlas, tracking: (tracking * pxAtlas) / px, sombra });
  const tex = motor.texturaCanvas(at.canvas);
  const alto = tamMundo(px, z);
  const k = alto / pxAtlas;
  const grupo = new THREE.Group();
  const dx = alinear === 'centro' ? -at.ancho / 2 : alinear === 'der' ? -at.ancho : 0;
  const glifos = [];
  at.glifos.forEach((gl, i) => {
    if (!gl.ch.trim()) return;
    const geo = new THREE.PlaneGeometry(gl.ancho * k, gl.alto * k);
    const uv = geo.attributes.uv;
    for (let j = 0; j < uv.count; j++) uv.setXY(j, gl.uv[0] + uv.getX(j) * gl.uv[2], gl.uv[1] + uv.getY(j) * gl.uv[3]);
    geo.translate((gl.ancho * k) / 2, (gl.alto * k) / 2 - gl.base * k, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { mapa: { value: tex }, color: { value: col(color) }, opacidad: { value: 1 }, corte: { value: -0.42 * alto }, dy: { value: 0 } },
      vertexShader: VERT_GLIFO, fragmentShader: FRAG_GLIFO, transparent: true, depthWrite: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.x = (gl.x + dx) * k;
    m.renderOrder = 30;
    m.userData = { i, x0: m.position.x };
    grupo.add(m);
    glifos.push(m);
  });
  grupo.userData = { glifos, ancho: at.ancho * k, alto, n: glifos.length, centro: alinear === 'centro' ? 0.5 : alinear === 'der' ? 1 : 0 };
  return grupo;
}

// u = 0 escondido bajo su línea … 1 en su lugar. `abre`: letras más separadas al entrar. `sale`: se va.
export function animarLinea(g, t, t0, { dur = 0.7, paso = 0.012, abre = 0, opacidad = 1, sale = null, durSale = 0.45 } = {}) {
  const { glifos, alto, n, centro } = g.userData;
  glifos.forEach((m) => {
    const i = m.userData.i;
    const u = clamp((t - t0 - i * paso) / dur);
    const e = E.outQuint(u);
    let y = (1 - e) * 1.25 * alto;
    let op = clamp(u * 2.5) * opacidad;
    if (sale != null) {
      const s = clamp((t - sale - i * paso * 0.6) / durSale);
      y -= E.inCubic(s) * 1.25 * alto * -1;
      op *= 1 - s;
    }
    m.position.y = -y;
    m.material.uniforms.dy.value = -y;
    m.material.uniforms.opacidad.value = op;
    const sep = abre * (1 - E.outCubic(u));
    m.position.x = m.userData.x0 + (i - centro * (n - 1)) * sep;
    m.visible = u > 0 && op > 0.001;
  });
}
