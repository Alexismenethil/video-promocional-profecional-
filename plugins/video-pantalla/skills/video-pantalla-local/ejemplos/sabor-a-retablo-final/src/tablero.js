// Un tablero de la carta, como en la primera versión pero en 3D: el color de la paleta del retablo con
// su degradado, la flor de la marca enorme y tono sobre tono, florcitas que suben (unas detrás y otras
// delante, fuera de foco), el producto recortado bien grande con su sombra teñida, el nombre que sube
// desde su renglón, el precio en el sello con forma de flor. Se compone en «px de diseño» (1920×1080)
// y cada capa va a su profundidad: la cámara se mueve apenas y todo cobra volumen (paralaje).
import * as THREE from 'three';
import { formasFlor } from './piezas.js';
import { atlasTexto, selloCapas, florCanvas, petalosCanvas, lienzo, FUENTE } from './texturas.js';
import { azar, clamp, E, lerp, prog, resorte, vaiven } from './util.js';

const col = (h) => new THREE.Color(h);
export const DC = 16, FOV = 30;
const TAN = Math.tan((FOV * Math.PI) / 360);
export const S0 = (2 * DC * TAN) / 1080;          // mundo por px de diseño en z = 0
export const ZF = -6;                              // el fondo
export const ZT = 0.35;                            // los textos, apenas delante de los productos
export const aMundo = (px, py, z = 0) => { const f = (DC - z) / DC; return [(px - 960) * S0 * f, (540 - py) * S0 * f, z]; };
export const tamMundo = (px, z = 0) => (px * S0 * (DC - z)) / DC;
export const CREMA = '#f9f6ee', VERDE = '#0d3b2b';

// mezcla de dos colores hex en sRGB (como el lienzo de la primera versión)
export function mezcla(a, b, u) {
  const h = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const A = h(a), B = h(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * u).toString(16).padStart(2, '0')).join('');
}
const srgb = (h) => { const n = parseInt(h.slice(1), 16); return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };

// ═════════ shaders ═════════
const GLSL_SRGB = /* glsl */ `
  vec3 aLineal(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }`;
const VERT_MUNDO = /* glsl */ `varying vec3 vP; varying vec2 vUv;
  void main(){ vUv = uv; vec4 m = modelMatrix * vec4(position, 1.0); vP = m.xyz; gl_Position = projectionMatrix * viewMatrix * m; }`;

// Fondo: degradado radial de la primera versión (claro → fondo → oscuro), interpolado en sRGB
const FRAG_FONDO = /* glsl */ `
  uniform vec3 claro, fondo, oscuro; uniform vec2 centro; uniform float radio, escala;
  varying vec3 vP; ${GLSL_SRGB}
  void main(){
    vec2 px = vec2(960.0 + vP.x / escala, 540.0 - vP.y / escala);
    float d = length(px - centro) / radio;
    vec3 c = d < 0.5 ? mix(claro, fondo, d / 0.5) : mix(fondo, oscuro, clamp((d - 0.5) / 0.5, 0.0, 1.0));
    gl_FragColor = vec4(aLineal(c), 1.0);
  }`;

// Producto: recorte con luz de borde, un brillo que lo cruza y, si va en una ventana, recortado por el arco
const VERT_PROD = /* glsl */ `
  uniform mat4 aVentana; varying vec2 vUv; varying vec2 vL;
  void main(){ vUv = uv; vL = (aVentana * vec4(position, 1.0)).xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const GLSL_ARCO = /* glsl */ `
  uniform vec4 arco;   // x, y: base (centro abajo) · z: medio ancho · w: alto (en el espacio de la ventana); z < 0: sin recorte
  bool fueraArco(vec2 l){
    if (arco.z <= 0.0) return false;
    vec2 q = l - arco.xy;
    float r = arco.z, yc = arco.w - r;
    if (q.y < 0.0) return true;
    if (q.y <= yc) return abs(q.x) > r;
    return length(vec2(q.x, q.y - yc)) > r;
  }`;
const FRAG_PROD = /* glsl */ `
  uniform sampler2D mapa; uniform float opacidad, barrido, anchoBarrido, luzBorde, texel, exposicion;
  uniform vec3 colorBorde; uniform vec2 dirLuz;
  varying vec2 vUv; varying vec2 vL; ${GLSL_ARCO}
  void main(){
    if (fueraArco(vL)) discard;
    vec4 c = texture2D(mapa, vUv);
    if (c.a < 0.004) discard;
    vec3 rgb = c.rgb * exposicion;
    float aL = texture2D(mapa, vUv + dirLuz * texel * 6.0).a;
    rgb += colorBorde * clamp((c.a - aL) * 1.6, 0.0, 1.0) * luzBorde;
    float d = (vUv.x + vUv.y * 0.55) - barrido;
    float b = exp(-d * d / (anchoBarrido * anchoBarrido)) * step(-1.0, barrido);
    rgb += vec3(1.0, 0.97, 0.9) * b * 0.42 * smoothstep(0.3, 1.0, dot(c.rgb, vec3(0.333)));
    gl_FragColor = vec4(rgb, c.a * opacidad);
  }`;
// Sombra teñida: el alfa desenfocado del recorte (la sombra de la primera versión)
const FRAG_SOMBRA = /* glsl */ `
  uniform sampler2D mapa; uniform vec3 color; uniform float opacidad;
  varying vec2 vUv; varying vec2 vL; ${GLSL_ARCO}
  void main(){ if (fueraArco(vL)) discard; float a = texture2D(mapa, vUv).r * opacidad; gl_FragColor = vec4(color, a); }`;

// Letras: cada glifo sube desde abajo de su renglón (se recorta bajo la línea, como en la primera versión)
const VERT_GLIFO = /* glsl */ `uniform float dy; varying vec2 vUv; varying float vY;
  void main(){ vUv = uv; vY = position.y + dy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG_GLIFO = /* glsl */ `uniform sampler2D mapa; uniform vec3 color; uniform float opacidad, corte;
  varying vec2 vUv; varying float vY;
  void main(){ if (vY < corte) discard; vec4 c = texture2D(mapa, vUv); gl_FragColor = vec4(c.rgb * color, c.a * opacidad); }`;

// Florcitas: silueta de pétalos teñida, desenfocada por mip según la distancia al foco
const VERT_FLORCITA = /* glsl */ `attribute vec4 tinte; attribute float desenf; varying vec2 vUv; varying vec4 vT; varying float vD;
  void main(){ vUv = uv; vT = tinte; vD = desenf; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`;
const FRAG_FLORCITA = /* glsl */ `uniform sampler2D mapa; uniform float opacidad; varying vec2 vUv; varying vec4 vT; varying float vD; ${GLSL_SRGB}
  void main(){ float a = texture2D(mapa, vUv, vD).a * vT.a * opacidad; if (a < 0.002) discard; gl_FragColor = vec4(aLineal(vT.rgb), a); }`;

// Panel de una ventana: el claro de la escena, más hondo abajo y en los bordes (parece hundido)
const FRAG_PANEL = /* glsl */ `
  uniform vec3 arriba, abajo, borde; uniform vec4 arco; uniform float opacidad;
  varying vec3 vP; varying vec2 vUv; ${GLSL_SRGB}
  void main(){
    vec2 q = vUv; // 0..1 en la caja del arco
    vec3 c = mix(abajo, arriba, smoothstep(0.0, 0.85, q.y));
    // sombra interior: más oscura cerca del marco
    float r = 0.5, yc = arco.w / (2.0 * arco.z) - r;
    vec2 p = vec2(q.x - 0.5, q.y * arco.w / (2.0 * arco.z));
    float dB = p.y <= yc ? r - abs(p.x) : r - length(vec2(p.x, p.y - yc));
    dB = min(dB, p.y + 0.02);
    c = mix(borde, c, smoothstep(0.0, 0.16, dB));
    gl_FragColor = vec4(aLineal(c), opacidad);
  }`;

// Destello: estrella de cuatro puntas con halo que crece y se apaga girando (u 0 → 1)
const FRAG_DESTELLO = /* glsl */ `uniform float u; varying vec2 vUv;
  void main(){
    if (u <= 0.0 || u >= 1.0) discard;
    float k = pow(sin(3.14159 * u), 1.4);
    vec2 p = (vUv - 0.5) * 2.0;
    float a = 0.6 * u, cs = cos(a), sn = sin(a);
    p = mat2(cs, -sn, sn, cs) * p / max(k, 0.001);
    float rayo = max(exp(-abs(p.x) * 26.0) * exp(-abs(p.y) * 2.2), exp(-abs(p.y) * 26.0) * exp(-abs(p.x) * 2.2));
    float halo = exp(-dot(p, p) * 5.0) * 0.45;
    float n = exp(-dot(p, p) * 60.0);
    float v = (rayo + halo + n) * k;
    gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * v * 2.4, 1.0);
  }`;

// ═════════ piezas ═════════
let _petalos = null;
function texCanvas(motor, c) { return motor.texturaCanvas(c); }

// Un renglón de texto: glifos que suben desde abajo de la línea base (con sombra horneada si se pide)
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
    m.renderOrder = 6;
    m.userData = { i, x0: m.position.x };
    grupo.add(m);
    glifos.push(m);
  });
  grupo.userData = { glifos, ancho: at.ancho * k, alto, n: glifos.length, centro: alinear === 'centro' ? 0.5 : alinear === 'der' ? 1 : 0 };
  return grupo;
}

// Anima un renglón: u = 0 escondido bajo su línea … 1 en su lugar. `abre`: letras más separadas al entrar.
export function animarLinea(g, t, t0, { dur = 0.7, paso = 0.012, abre = 0, opacidad = 1 } = {}) {
  const { glifos, alto, n, centro } = g.userData;
  glifos.forEach((m) => {
    const i = m.userData.i;
    const u = clamp((t - t0 - i * paso) / dur);
    const e = E.outQuint(u);
    const y = (1 - e) * 1.25 * alto;
    m.position.y = -y;
    m.material.uniforms.dy.value = -y;
    m.material.uniforms.opacidad.value = clamp(u * 2.5) * opacidad;
    const sep = abre * (1 - E.outCubic(u));
    m.position.x = m.userData.x0 + (i - centro * (n - 1)) * sep;
    m.visible = u > 0;
  });
}

// Sello de precio (flor que gira, texto derecho, sombra quieta)
function crearSello(motor, texto, colores, R, etiqueta) {
  const cap = selloCapas(texto, { ...colores, etiqueta });
  const lado = tamMundo(R * 2 * cap.escala, ZT + 0.3);
  const g = new THREE.Group();
  const mk = (c, o = {}) => new THREE.Mesh(new THREE.PlaneGeometry(lado, lado),
    new THREE.MeshBasicMaterial({ map: motor.texturaCanvas(c), transparent: true, depthWrite: false, toneMapped: false, ...o }));
  const sombra = mk(cap.sombra, { color: 0x000000, opacity: 0.3 });
  sombra.position.set(0, -tamMundo(10), -0.02);
  const flor = mk(cap.flor);
  const txt = mk(cap.texto);
  txt.position.z = 0.01;
  sombra.renderOrder = 7; flor.renderOrder = 8; txt.renderOrder = 9;
  g.add(sombra, flor, txt);
  return { g, sombra, flor, txt };
}

// Arco (rectángulo con medio círculo arriba) como THREE.Shape, base en (0,0)
function formaArco(ancho, alto) {
  const r = ancho / 2, yc = alto - r;
  const s = new THREE.Shape();
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, yc); s.absarc(0, yc, r, 0, Math.PI, false); s.lineTo(-r, 0);
  return s;
}
function geoMarcoArco(ancho, alto, borde, prof) {
  // marco cerrado: el arco por fuera (con zócalo abajo) menos el hueco
  const R = ancho / 2 + borde, yC = alto - ancho / 2;
  const s = new THREE.Shape();
  s.moveTo(-R, -borde); s.lineTo(R, -borde); s.lineTo(R, yC); s.absarc(0, yC, R, 0, Math.PI, false); s.lineTo(-R, -borde);
  const h = new THREE.Path();
  const r = ancho / 2, yc = alto - r;
  h.moveTo(-r, 0); h.lineTo(-r, yc); h.absarc(0, yc, r, Math.PI, 0, true); h.lineTo(r, 0); h.lineTo(-r, 0);
  s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth: prof, bevelEnabled: true, bevelThickness: prof * 0.35, bevelSize: borde * 0.28, bevelSegments: 3, curveSegments: 72 });
  g.translate(0, 0, -prof);
  return g;
}

// ═════════ el tablero ═════════
// def: {id, t0, dur, pal, flor:[x,y,R], florTono:[color, alfa], deriva:[dx,dy], prods, textos, sellos,
//       filetes, iconos, ventanas, mostrador, florcitas}
export function crearTablero(motor, R, def) {
  const esc = new THREE.Scene();
  const pal = def.pal;
  esc.background = col(pal.oscuro);
  esc.add(new THREE.HemisphereLight(col('#fff6e8'), col(pal.oscuro), 1.1));
  const sol = new THREE.DirectionalLight(col('#fff1dc'), 1.6);
  sol.position.set(-5, 8, 10);
  esc.add(sol);
  esc.environment = motor.entorno;
  esc.environmentIntensity = 0.5;
  const raiz = new THREE.Group();
  esc.add(raiz);

  // ── fondo ──
  const [fx, fy, fr] = def.flor;
  const fondoMat = new THREE.ShaderMaterial({
    uniforms: { claro: { value: srgb(pal.claro) }, fondo: { value: srgb(pal.fondo) }, oscuro: { value: srgb(pal.oscuro) },
      centro: { value: new THREE.Vector2(fx, fy) }, radio: { value: def.radioFondo ?? 1350 }, escala: { value: S0 * (DC - ZF) / DC } },
    vertexShader: VERT_MUNDO, fragmentShader: FRAG_FONDO, depthWrite: false,
  });
  const fondo = new THREE.Mesh(new THREE.PlaneGeometry(260, 150), fondoMat);
  fondo.position.z = ZF;
  fondo.renderOrder = -10;
  raiz.add(fondo);

  // ── la flor de la marca, tono sobre tono, girando despacio ──
  const F = formasFlor();
  const flor = new THREE.Group();
  const [tono, alfaT] = def.florTono;
  const capasFlor = [];
  [[F.petalos, 1], [F.corona, 0.8]].forEach(([formas, a]) => {
    const m = new THREE.Mesh(new THREE.ShapeGeometry(formas, 48), new THREE.MeshBasicMaterial({ color: col(tono), transparent: true, opacity: alfaT * a, depthWrite: false, toneMapped: false }));
    m.scale.set(1, -1, 1);
    m.renderOrder = -9;
    flor.add(m);
    capasFlor.push([m, a]);
  });
  const disco = new THREE.Mesh(new THREE.CircleGeometry(F.RD, 96), new THREE.MeshBasicMaterial({ color: col(tono), transparent: true, opacity: alfaT * 0.6, depthWrite: false, toneMapped: false }));
  disco.renderOrder = -9;
  flor.add(disco);
  capasFlor.push([disco, 0.6]);
  const zFlor = ZF + 0.05;
  flor.position.set(...aMundo(fx, fy, zFlor));
  flor.scale.setScalar(tamMundo(fr, zFlor) / F.R);
  raiz.add(flor);

  // ── florcitas que suben (unas detrás, pocas delante y fuera de foco, como bokeh) ──
  if (!_petalos) { _petalos = motor.texturaCanvas(petalosCanvas(256)); _petalos.generateMipmaps = true; }
  const nF = def.florcitas?.n ?? 22;
  const rf = azar(311 + (def.semilla ?? 7) * 17);
  const fl = [];
  for (let i = 0; i < nF; i++) {
    const delante = i < (def.florcitas?.delante ?? 4);
    const z = delante ? rf.entre(2.5, 7) : rf.entre(-5.2, -0.8);
    let x0 = rf() * 2120 - 100;
    if (delante) x0 = rf() < 0.5 ? rf.entre(-60, 260) : rf.entre(1660, 1980);
    fl.push({ z, x0, y0: rf() * 1240, r: (6 + rf() ** 2 * 16) * (delante ? 1.35 : 1), vel: 26 + rf() * 34, fase: rf() * 6.283,
      giro: (rf() - 0.5) * 1.6, a: (0.16 + rf() * 0.26) * (delante ? 0.75 : 1), acento: rf() < 0.55 });
  }
  const blanco = pal.tinta === VERDE ? '#ffffff' : CREMA;
  const grupos = [fl.filter((f) => f.z < 0), fl.filter((f) => f.z >= 0)].map((lista, gi) => {
    const geoF = new THREE.PlaneGeometry(1, 1);
    const tinte = new Float32Array(Math.max(1, lista.length) * 4), desenf = new Float32Array(Math.max(1, lista.length));
    lista.forEach((f, i) => { const c = srgb(f.acento ? pal.acento : blanco); tinte.set([c.x, c.y, c.z, f.a], i * 4); });
    geoF.setAttribute('tinte', new THREE.InstancedBufferAttribute(tinte, 4));
    geoF.setAttribute('desenf', new THREE.InstancedBufferAttribute(desenf, 1));
    const im = new THREE.InstancedMesh(geoF, new THREE.ShaderMaterial({
      uniforms: { mapa: { value: _petalos }, opacidad: { value: 1 } }, vertexShader: VERT_FLORCITA, fragmentShader: FRAG_FLORCITA,
      transparent: true, depthWrite: false }), Math.max(1, lista.length));
    im.count = lista.length;
    im.frustumCulled = false;
    im.renderOrder = gi ? 20 : -5;
    raiz.add(im);
    return { im, lista, desenf };
  });

  // ── ventanas en arco (para los platos cortados por el encuadre de la foto) ──
  const ventanas = (def.ventanas || []).map((v) => {
    const g = new THREE.Group();
    g.position.set(...aMundo(v.cx, v.base, 0));
    const an = tamMundo(v.ancho), al = tamMundo(v.alto), bo = tamMundo(v.borde ?? 12);
    const marco = new THREE.Mesh(geoMarcoArco(an, al, bo, tamMundo(16)),
      new THREE.MeshStandardMaterial({ color: col(v.colorMarco || CREMA), roughness: 0.6, envMapIntensity: 0.6 }));
    marco.position.z = 0.02;
    marco.renderOrder = 3;
    // el panel es un poco más grande que el hueco: su borde queda bajo el marco
    const ext = tamMundo(4);
    const geoP = new THREE.ShapeGeometry(formaArco(an + 2 * ext, al + ext), 72);
    geoP.computeBoundingBox();
    const bb = geoP.boundingBox;
    const uvP = geoP.attributes.uv, posP = geoP.attributes.position;
    for (let j = 0; j < uvP.count; j++) uvP.setXY(j, (posP.getX(j) - bb.min.x) / (bb.max.x - bb.min.x), (posP.getY(j) - bb.min.y) / (bb.max.y - bb.min.y));
    const panel = new THREE.Mesh(geoP, new THREE.ShaderMaterial({
      uniforms: { arriba: { value: srgb(v.arriba || pal.claro) }, abajo: { value: srgb(v.abajo || mezcla(pal.claro, pal.fondo, 0.55)) },
        borde: { value: srgb(mezcla(pal.fondo, pal.oscuro, 0.35)) }, arco: { value: new THREE.Vector4(0, 0, an / 2 + ext, al + ext) }, opacidad: { value: 1 } },
      vertexShader: VERT_MUNDO, fragmentShader: FRAG_PANEL, transparent: true, depthWrite: false,
    }));
    panel.position.z = -0.32;
    panel.renderOrder = 1;
    // sombra del marco sobre el tablero
    const somMarco = new THREE.Mesh(new THREE.ShapeGeometry(formaArco(an + 2 * bo + tamMundo(26), al + bo + tamMundo(18)), 48),
      new THREE.MeshBasicMaterial({ color: col(mezcla(pal.oscuro, '#000000', 0.45)), transparent: true, opacity: 0.0, depthWrite: false }));
    somMarco.position.set(tamMundo(10), -tamMundo(20), -0.5);
    somMarco.renderOrder = 0;
    const anim = new THREE.Group();
    anim.add(somMarco, panel, marco);
    g.add(anim);
    raiz.add(g);
    return { def: v, g, anim, marco, panel, somMarco, an, al, ext };
  });

  // ── productos ──
  const _m4 = new THREE.Matrix4();
  const prods = (def.prods || []).map((pd, i) => {
    const P0 = R.productos[pd.slug];
    const [x0, y0, x1, y1] = P0.caja;
    const sw = x1 - x0, sh = y1 - y0;
    const s = pd.s ?? Math.min(pd.maxW / sw, pd.maxH / sh) * (pd.escala ?? 1);   // px de diseño por px del recorte
    const k = tamMundo(s, 0);                                             // mundo por px del recorte (en z = 0)
    const w = P0.w * k, h = P0.h * k;
    const geo = new THREE.PlaneGeometry(w, h);
    geo.translate(w / 2 - P0.apoyoX * k, P0.apoyo * k - h / 2, 0);
    const v = pd.ventana != null ? ventanas[pd.ventana] : null;
    const arco = v ? new THREE.Vector4(0, 0, v.an / 2 + v.ext * 0.4, v.al + v.ext * 0.4) : new THREE.Vector4(0, 0, -1, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        mapa: { value: R.tex[pd.slug] }, opacidad: { value: 1 }, barrido: { value: -2 }, anchoBarrido: { value: 0.08 },
        luzBorde: { value: pd.luzBorde ?? 0.08 }, colorBorde: { value: col('#fff2dc') }, dirLuz: { value: new THREE.Vector2(-0.6, 0.8) },
        texel: { value: 1 / Math.max(P0.w, P0.h) }, exposicion: { value: pd.exposicion ?? 1 }, arco: { value: arco }, aVentana: { value: new THREE.Matrix4() },
      },
      vertexShader: VERT_PROD, fragmentShader: FRAG_PROD, transparent: true, depthWrite: false,
    });
    const prod = new THREE.Mesh(geo, mat);
    prod.renderOrder = 4 + (pd.capa ?? 0);
    // sombra teñida (desplazada abajo a la derecha, como en la primera versión)
    const somMat = new THREE.ShaderMaterial({
      uniforms: { mapa: { value: R.sombra[pd.slug] }, color: { value: col(mezcla(pal.oscuro, '#000000', 0.5)) }, opacidad: { value: 0.62 },
        arco: { value: arco }, aVentana: { value: new THREE.Matrix4() } },
      vertexShader: VERT_PROD, fragmentShader: FRAG_SOMBRA, transparent: true, depthWrite: false,
    });
    const sombra = new THREE.Mesh(geo, somMat);
    sombra.position.set(tamMundo(pd.sombraDx ?? 14), -tamMundo(pd.sombraDy ?? 30), -0.12);
    sombra.renderOrder = 3 + (pd.capa ?? 0);
    const anim = new THREE.Group();
    anim.add(sombra, prod);
    // espejo: la foto invertida alrededor del centro de su caja (para esconder un borde cortado del lado de afuera)
    const espejo = pd.espejo ? -1 : 1;
    const dxCaja = ((x0 + x1) / 2 - P0.apoyoX) * k;
    if (pd.espejo) sombra.position.x = -sombra.position.x;
    // dónde se apoya: x del centro de la caja, y de la línea de apoyo (px de diseño → mundo)
    const ax = pd.cx + (P0.apoyoX - (x0 + x1) / 2) * s;
    const piv = new THREE.Group();
    if (v) {
      // dentro de la ventana: coordenadas del grupo de la ventana
      const [vx, vy] = aMundo(v.def.cx, v.def.base, 0);
      const [px, py] = aMundo(ax, pd.base, 0);
      piv.position.set(px - vx, py - vy, -0.16);
      v.anim.add(piv);
    } else {
      piv.position.set(...aMundo(ax, pd.base, pd.z ?? 0));
      raiz.add(piv);
    }
    piv.add(anim);
    // destellos en puntos del recorte (fracciones de la imagen)
    const destellos = (pd.brillos || []).map(([u, vv, tb, tam]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
        uniforms: { u: { value: 0 } }, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: FRAG_DESTELLO, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      const lado = tamMundo((tam ?? 46) * 2.4);
      m.scale.set(lado, lado, 1);
      m.position.set((u * P0.w - P0.apoyoX) * k, (P0.apoyo - vv * P0.h) * k, 0.05);
      m.renderOrder = 12;
      anim.add(m);
      return { m, t: tb };
    });
    // vapor (bebidas calientes)
    let vapor = null;
    if (pd.vapor) {
      const [anchoV, altoV, dxV, dyV, alfaV] = pd.vapor;
      vapor = crearVapor(tamMundo(anchoV), tamMundo(altoV), alfaV ?? 0.2);
      const topY = (P0.apoyo - y0) * k;                  // arriba de la caja, desde la línea de apoyo
      vapor.position.set(tamMundo(dxV ?? 0), topY + tamMundo(dyV ?? 0) + tamMundo(altoV) / 2, -0.04);
      anim.add(vapor);
    }
    return { def: pd, i, P0, s, k, piv, anim, prod, sombra, destellos, vapor, ventana: v, espejo, dxCaja };
  });

  // ── mostrador (los vasos quedan detrás: tapa el pie cortado de alguna foto) ──
  let mostrador = null;
  if (def.mostrador) {
    const M = def.mostrador;
    const zM = 0.55;
    const [, yTop] = aMundo(960, M.y, zM);
    const alto = tamMundo(700, zM);
    const g = new THREE.Group();
    const cara = new THREE.Mesh(new THREE.PlaneGeometry(200, alto), new THREE.ShaderMaterial({
      uniforms: { a: { value: srgb(M.color || pal.oscuro) }, b: { value: srgb(mezcla(M.color || pal.oscuro, '#000000', 0.35)) }, alto: { value: alto } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 a, b; uniform float alto; varying vec2 vUv; ${GLSL_SRGB}
        void main(){ vec3 c = mix(b, a, smoothstep(0.0, 1.0, vUv.y)); gl_FragColor = vec4(aLineal(c), 1.0); }`,
      depthWrite: true }));
    cara.position.set(0, yTop - alto / 2, zM);
    cara.renderOrder = 10;
    const filo = new THREE.Mesh(new THREE.PlaneGeometry(200, tamMundo(5, zM)), new THREE.MeshBasicMaterial({ color: col(M.filo || CREMA), toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false }));
    filo.position.set(0, yTop - tamMundo(2.5, zM), zM + 0.001);
    filo.renderOrder = 11;
    // sombra suave que el mostrador echa sobre lo de atrás (arriba del filo)
    const somb = new THREE.Mesh(new THREE.PlaneGeometry(200, tamMundo(60, zM)), new THREE.ShaderMaterial({
      uniforms: { c: { value: srgb(mezcla(pal.oscuro, '#000000', 0.6)) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 c; varying vec2 vUv; ${GLSL_SRGB} void main(){ gl_FragColor = vec4(aLineal(c), 0.28 * pow(1.0 - vUv.y, 2.0)); }`,
      transparent: true, depthWrite: false }));
    somb.position.set(0, yTop + tamMundo(30, zM), zM - 0.002);
    somb.renderOrder = 9;
    g.add(cara, filo, somb);
    raiz.add(g);
    mostrador = { g, yTop };
  }

  // ── textos ──
  const textos = (def.textos || []).map((tx) => {
    const g = linea(motor, tx.texto, { ...tx.estilo, z: tx.z ?? ZT });
    g.position.set(...aMundo(tx.x, tx.y, tx.z ?? ZT));
    raiz.add(g);
    return { def: tx, g };
  });

  // ── filetes (líneas finas que se dibujan) ──
  const filetes = (def.filetes || []).map((fd) => {
    const largo = tamMundo(fd.ancho, ZT), grueso = tamMundo(fd.grueso ?? 2.5, ZT);
    const geo = new THREE.PlaneGeometry(largo, grueso);
    geo.translate(fd.alinear === 'centro' ? 0 : largo / 2, 0, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col(fd.color), transparent: true, opacity: fd.alfa ?? 0.7, depthWrite: false, toneMapped: false }));
    m.position.set(...aMundo(fd.x, fd.y, ZT));
    m.renderOrder = 6;
    raiz.add(m);
    return { def: fd, m };
  });

  // ── íconos (la flor chica sobre los títulos) ──
  const iconos = (def.iconos || []).map((ic) => {
    const lado = tamMundo(ic.R * 2 * 1.04, ZT);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(lado, lado), new THREE.MeshBasicMaterial({
      map: motor.texturaCanvas(florCanvas(256, ic.colores)), transparent: true, depthWrite: false, toneMapped: false }));
    m.position.set(...aMundo(ic.x, ic.y, ZT));
    m.renderOrder = 7;
    raiz.add(m);
    return { def: ic, m };
  });

  // ── sellos de precio ──
  const sellos = (def.sellos || []).map((sd) => {
    const s = crearSello(motor, sd.precio, sd.colores, sd.R, sd.etiqueta || 'S/');
    s.g.position.set(...aMundo(sd.x, sd.y, ZT + 0.3));
    raiz.add(s.g);
    return { def: sd, ...s };
  });

  // ═════════ en el tiempo ═════════
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _mm = new THREE.Matrix4();
  const P = 60 / (window.CUES?.bpm || 128);

  function actualizar(t, vista, op = {}) {
    const tl = t - def.t0;
    const camPos = _p.set(...vista.pos);
    const foco = vista.foco || DC;
    const desv = op.desvanecer ?? 0;           // 0..1: el frente se va (zambullida por la flor)
    // flor del fondo
    flor.rotation.z = -t * 0.05 + fx * 0.001;
    // florcitas
    grupos.forEach(({ im, lista, desenf }) => {
      lista.forEach((f, i) => {
        const dt = t - def.t0 + 40;
        const H = 1240;
        const ypx = ((((f.y0 - dt * f.vel) % H) + H) % H) - 80;
        const xpx = f.x0 + Math.sin(dt * 0.9 + f.fase) * 26;
        const p = aMundo(xpx, ypx, f.z);
        const lado = tamMundo(f.r * 2 * 1.09, f.z);
        _e.set(0, 0, f.fase + dt * f.giro);
        _q.setFromEuler(_e);
        _s.set(lado, lado, 1);
        _mm.compose(new THREE.Vector3(...p), _q, _s);
        im.setMatrixAt(i, _mm);
        const d = Math.abs(Math.hypot(p[0] - vista.pos[0], p[1] - vista.pos[1], p[2] - vista.pos[2]) - foco);
        desenf[i] = clamp(d * 0.55, 0, 4.5);
      });
      im.instanceMatrix.needsUpdate = true;
      im.geometry.attributes.desenf.needsUpdate = true;
      im.material.uniforms.opacidad.value = 1 - (op.desvanecer ?? 0) * 0.6;
    });

    // ventanas: suben con su marco
    ventanas.forEach((v, i) => {
      const t0 = (v.def.t ?? -0.2) + i * (def.escalon ?? 0.12);
      const u = clamp((tl - t0) / 0.8);
      const e = E.outBack(u, 1.3);
      v.anim.position.y = (1 - E.outCubic(u)) * -tamMundo(140);
      v.anim.scale.setScalar(Math.max(0.001, 0.82 + 0.18 * e));
      v.anim.visible = u > 0;
      v.panel.material.uniforms.opacidad.value = clamp(u * 3);
      v.somMarco.material.opacity = 0.32 * clamp(u * 2);
    });

    // productos
    prods.forEach((p) => entrada(p, tl, t));

    // textos
    textos.forEach((tx) => animarLinea(tx.g, tl, tx.def.t ?? 0.3, { abre: tx.def.abre ? tamMundo(tx.def.abre) : 0, opacidad: 1 - desv }));
    filetes.forEach((fd) => {
      const u = E.inOutCubic(prog(tl, fd.def.t ?? 0.6, (fd.def.t ?? 0.6) + 0.6));
      fd.m.scale.x = Math.max(0.0001, u);
      fd.m.visible = u > 0.001;
      fd.m.material.opacity = (fd.def.alfa ?? 0.7) * (1 - desv);
    });
    iconos.forEach((ic) => {
      const u = clamp((tl - (ic.def.t ?? 0.1)) / 0.6);
      const e = E.outBack(u, 1.8);
      ic.m.scale.setScalar(Math.max(0.001, e));
      ic.m.rotation.z = (1 - E.outCubic(u)) * -1.2 + t * 0.35;
      ic.m.material.opacity = clamp(u * 3) * (1 - desv);
      ic.m.visible = u > 0;
    });
    sellos.forEach((s) => {
      const u = clamp((tl - (s.def.t ?? 0.8)) / 0.55);
      const latido = 0.025 * Math.max(0, Math.cos(((t % (2 * P)) / (2 * P)) * Math.PI * 2)) * clamp(u * 2 - 1);
      const k = Math.max(0.001, E.outBack(u, 1.7) * (1 + latido));
      s.g.scale.setScalar(k);
      s.flor.rotation.z = (1 - E.outCubic(u)) * -1.6 + t * 0.2;
      const a = clamp(u * 4) * (1 - desv);
      s.flor.material.opacity = a; s.txt.material.opacity = a; s.sombra.material.opacity = 0.3 * a;
      s.g.visible = u > 0;
    });
    if (mostrador) mostrador.g.visible = true;
  }

  // Entradas de producto (en px de diseño): portal (sale del centro creciendo), baja (cae y rebota),
  // sube, pop (crece), desliza (entra de costado), cae (cae dentro de su ventana), quieto
  function entrada(p, tl, t) {
    const pd = p.def, i = p.i;
    const tipo = pd.entrada || def.entrada || 'pop';
    const t0 = (pd.t ?? def.tEntrada ?? -0.15) + (pd.t != null ? 0 : i * (def.escalon ?? 0.12));
    const dur = tipo === 'baja' || tipo === 'cae' ? 0.9 : 0.75;
    const u = clamp((tl - t0) / dur);
    const a = p.anim;
    a.position.set(p.espejo < 0 ? 2 * p.dxCaja : 0, 0, 0);
    a.rotation.set(0, 0, 0);
    a.scale.set(p.espejo, 1, 1);
    let vis = 1;
    const altoObj = (p.P0.caja[3] - p.P0.caja[1]) * p.k;
    if (tipo === 'portal') {
      const v = E.outCubic(clamp(u * 1.25));
      a.scale.multiplyScalar(lerp(0.18, 1, E.outBack(u, 1.25)));
      const [cx, cy] = aMundo(960, 600, 0);
      const [px, py] = aMundo(pd.cx, pd.base, 0);
      a.position.x += (cx - px) * (1 - v);
      a.position.y = (cy - py + altoObj * 0.4) * (1 - v);
      a.rotation.z = (1 - v) * (i ? 0.3 : -0.3);
      vis = clamp(u * 5);
    } else if (tipo === 'baja' || tipo === 'cae') {
      const e = resorte(u, 1.3, 6.5);
      a.position.y = (1 - e) * (tipo === 'cae' ? altoObj * 1.6 : tamMundo(420));
      a.scale.set(p.espejo * (1 - (1 - e) * 0.06), 1 + (1 - e) * 0.06, 1);
      vis = tipo === 'cae' ? (u > 0 ? 1 : 0) : clamp(u * 6);
    } else if (tipo === 'sube') {
      const e = E.outBack(u, 1.4);
      a.position.y = (e - 1) * tamMundo(pd.subir ?? 260);
      vis = clamp(u * 4);
    } else if (tipo === 'pop') {
      const e = E.outBack(u, 2.0);
      a.scale.multiplyScalar(Math.max(0.001, 0.2 + 0.8 * e));
      vis = clamp(u * 5);
    } else if (tipo === 'desliza') {
      const e = E.outCubic(u);
      a.position.x += (1 - e) * tamMundo(pd.desde ?? 700);
      a.rotation.z = (1 - e) * 0.12 * Math.sign(pd.desde ?? 700);
      vis = clamp(u * 4);
    }
    // los que ya estaban (entran con la transición): un saltito al llegar
    if (tipo === 'quieto' && def.rebote !== false) {
      const ur = (tl + 0.02 - i * 0.07) / 0.55;
      a.scale.multiplyScalar(1 + 0.03 * vaiven(ur, 1.3, 4.2));
    }
    // flota apenas (la primera versión: 7 px y medio grado)
    if (pd.flota !== false && !p.ventana) {
      const w = clamp((tl - t0 - 0.5) / 0.6);
      a.position.y += Math.sin(t * 1.15 + i * 1.9) * tamMundo(7) * w;
      a.rotation.z += Math.sin(t * 0.9 + i * 2.3) * 0.007 * w;
    } else if (p.ventana) {
      const w = clamp((tl - t0 - 0.6) / 0.6);
      a.position.y += Math.sin(t * 1.15 + i * 1.9) * tamMundo(4) * w;
    }
    p.prod.material.uniforms.opacidad.value = vis;
    p.sombra.material.uniforms.opacidad.value = 0.62 * clamp(u * 3) * vis;
    p.prod.visible = p.sombra.visible = vis > 0.001;
    p.prod.material.uniforms.barrido.value = -0.6 + (tl - t0 - 0.9) * 1.1;
    // recorte por la ventana: transformación del producto al espacio del grupo de la ventana
    if (p.ventana) {
      p.anim.updateMatrix(); p.piv.updateMatrix(); p.sombra.updateMatrix();
      _m4.multiplyMatrices(p.piv.matrix, p.anim.matrix);
      p.prod.material.uniforms.aVentana.value.copy(_m4);
      _mm.multiplyMatrices(_m4, p.sombra.matrix);
      p.sombra.material.uniforms.aVentana.value.copy(_mm);
    }
    p.destellos.forEach((d) => { d.m.material.uniforms.u.value = prog(tl, d.t - 0.1, d.t + 0.45); d.m.visible = d.m.material.uniforms.u.value > 0 && d.m.material.uniforms.u.value < 1; });
    if (p.vapor) { p.vapor.material.uniforms.t.value = t; p.vapor.visible = vis > 0.5; p.vapor.material.uniforms.alfa.value = (pd.vapor[4] ?? 0.2) * clamp((tl - t0 - 0.3) / 0.8); }
  }

  // Cámara del tablero: empuje lento y una deriva suave (paralaje), con apenas profundidad de campo
  function vista(tl) {
    const [dx, dy] = def.deriva || [0.3, 0.08];
    const u = E.inOutSine(prog(tl, -0.9, def.dur + 0.9));
    const z = DC * lerp(1.035, 0.975, u);
    const x = lerp(-dx, dx, u), y = lerp(-dy, dy, u);
    return { pos: [x, y, z], mira: [x * 0.35, y * 0.35, 0], fov: FOV, foco: Math.hypot(x * 0.65, y * 0.65, z), apertura: def.apertura ?? 0.045 };
  }

  return { def, escena: esc, raiz, actualizar, vista, prods, ventanas, textos, sellos, flor, disco };
}

// Vapor: velos que suben (ruido) sobre una taza
function crearVapor(ancho, alto, alfa) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, alfa: { value: alfa } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float t, alfa; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
      void main(){
        vec2 p = vUv;
        float x = p.x - 0.5 + (fbm(vec2(p.y * 2.0 - t * 0.6, t * 0.2)) - 0.5) * 0.5 * p.y;
        float tira = exp(-x * x / (0.02 + 0.06 * p.y));
        float v = fbm(vec2(x * 4.0, p.y * 3.0 - t * 1.1));
        float a = tira * smoothstep(0.35, 0.8, v) * smoothstep(0.0, 0.18, p.y) * (1.0 - smoothstep(0.55, 1.0, p.y));
        gl_FragColor = vec4(vec3(1.0) * a * alfa, a * alfa);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), mat);
  m.renderOrder = 8;
  return m;
}
