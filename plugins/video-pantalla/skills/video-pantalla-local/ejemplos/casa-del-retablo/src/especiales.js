// Escenas especiales que se montan sobre un tablero:
//   medidas   el retablo con sus medidas dibujándose en 3D (como el dibujo del catálogo)
//   fila      los seis tamaños lado a lado sobre un piso que refleja; la cámara los recorre
//   carrusel  una rueda de retablos que gira; el de adelante dice su nombre
//   pared     una pared de galería con ocho retablos; la cámara camina de costado
//   foto      fotos de la casa con paralaje (el sujeto adelante, el fondo atrás) y un texto
//   angeles   ángeles colgados de hilos que bajan y se mecen
//   espejos   espejos decorativos con su vidrio reflejando
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { crearRetablo3D, crearPlano, texVacia } from './retablo3d.js';
import { etiquetaCanvas } from './marca.js';
import { FUENTE } from './texturas.js';
import { DC, FOV, S0, ZT, aMundo, tamMundo, linea, animarLinea, mezcla, CREMA, AZUL, ROJO } from './letras.js';
import { azar, clamp, E, lerp, prog, resorte, vaiven } from './util.js';

const col = (h) => new THREE.Color(h);
const W = 1920, H = 1080;

// ── trazos (líneas de ancho fijo en pantalla) que se dibujan ──
function crearTrazos(color, ancho = 2.6, opacidad = 0.9) {
  const geo = new LineSegmentsGeometry();
  geo.setPositions(new Float32Array(6));
  const mat = new LineMaterial({ color: col(color).getHex(), linewidth: ancho, transparent: true, opacity: opacidad, depthWrite: false, worldUnits: false });
  mat.resolution.set(W, H);
  const l = new LineSegments2(geo, mat);
  l.frustumCulled = false;
  l.renderOrder = 34;
  return l;
}
// segs: [[a, b, t0, dur], …] (a, b: Vector3); dibuja cada uno hasta su avance
function dibujarTrazos(l, segs, tl) {
  const pos = [];
  segs.forEach(([a, b, t0, d]) => {
    const u = E.inOutCubic(clamp((tl - t0) / d));
    if (u <= 0) return;
    const c = a.clone().lerp(b, u);
    pos.push(a.x, a.y, a.z, c.x, c.y, c.z);
  });
  if (!pos.length) { l.visible = false; return; }
  l.visible = true;
  l.geometry.dispose();
  const g = new LineSegmentsGeometry();
  g.setPositions(new Float32Array(pos));
  l.geometry = g;
}

// texto en el mundo (un renglón), con sus parámetros de animación
function texto(motor, padre, txt, { px = 34, color = AZUL, familia = FUENTE.texto, peso = 700, estilo = 'normal', tracking = 2, alinear = 'centro' } = {}) {
  const g = linea(motor, txt, { familia, peso, estilo, px, tracking, color, alinear, z: 0 });
  padre.add(g);
  return g;
}

// ═════════ medidas ═════════
export function extraMedidas(ctx, { slugIdx = 0, fondo = null, color = null, tDibujo = 1.15 } = {}) {
  const { motor, prods, pal } = ctx;
  const p = prods[slugIdx];
  const o = p.obj, P0 = p.P0, k = p.k;
  const tier = window.DATOS.tiers[P0.tier];
  const tinta = color || pal.tinta;
  const g = new THREE.Group();
  p.piv.add(g);
  const cx = P0.bisagras ? (P0.bisagras[0] + P0.bisagras[1]) / 2 : P0.apoyoX;
  const x0 = (P0.caja[0] - cx) * k, x1 = (P0.caja[2] - cx) * k;
  const yTop = (P0.apoyo - P0.caja[1]) * k;
  const sep = tamMundo(46), tick = tamMundo(16);
  const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const t0 = tDibujo;
  // alto: a un costado (del lado del texto)
  const ladoTexto = (p.def.cx < 960) ? 1 : -1;
  const ladoLinea = -ladoTexto;                       // la línea del alto, del lado contrario al texto
  const xa = ladoLinea > 0 ? x1 + sep : x0 - sep;
  const segs = [
    [V(xa, 0), V(xa, yTop), t0, 0.55],
    [V(xa - tick, 0), V(xa + tick, 0), t0, 0.2], [V(xa - tick, yTop), V(xa + tick, yTop), t0 + 0.45, 0.2],
    // ancho: debajo
    [V(x0, -sep), V(x1, -sep), t0 + 0.2, 0.6],
    [V(x0, -sep - tick), V(x0, -sep + tick), t0 + 0.2, 0.2], [V(x1, -sep - tick), V(x1, -sep + tick), t0 + 0.7, 0.2],
    // líneas de referencia punteadas cortas desde el retablo
    [V(x0, -tick * 0.6), V(x0, -sep + tick), t0 + 0.1, 0.25], [V(x1, -tick * 0.6), V(x1, -sep + tick), t0 + 0.1, 0.25],
  ];
  let etFondo = null;
  if ((fondo ?? tier.fondo) && P0.silueta) {
    // fondo: por el alero de la caja, de adelante hacia atrás
    const pts = P0.silueta.centro;
    const uMax = Math.max(...pts.map((q) => q[0]));
    const alero = Math.max(...pts.filter((q) => q[0] > uMax - 0.01).map((q) => q[1]));
    const xe = (uMax * P0.w - cx) * k, ye = (alero * P0.h - (P0.h - P0.apoyo)) * k;
    const fz = o.fondo;
    segs.push([V(xe + tamMundo(18), ye + tamMundo(18), 0), V(xe + tamMundo(18), ye + tamMundo(18), -fz), t0 + 0.6, 0.45]);
    etFondo = { pos: V(xe + tamMundo(70), ye + tamMundo(40), -fz / 2), txt: `${fondo ?? tier.fondo} cm` };
  }
  const trazos = crearTrazos(tinta, 2.4, 0.85);
  g.add(trazos);
  // etiquetas de la medida
  const etAlto = texto(motor, g, `${tier.alto} cm`, { px: 30, color: tinta });
  etAlto.rotation.z = -ladoLinea * Math.PI / 2;
  etAlto.position.set(xa + ladoLinea * tamMundo(34), yTop / 2, 0.02);
  const etAncho = texto(motor, g, `${tier.ancho} cm`, { px: 30, color: tinta });
  etAncho.position.set((x0 + x1) / 2, -sep - tamMundo(46), 0.02);
  let etF = null;
  if (etFondo) {
    etF = texto(motor, g, etFondo.txt, { px: 26, color: tinta });
    etF.position.copy(etFondo.pos);
    etF.rotation.y = Math.PI / 2 * 0.6;
  }
  return {
    actualizar(tl) {
      dibujarTrazos(trazos, segs, tl);
      animarLinea(etAlto, tl, t0 + 0.4);
      animarLinea(etAncho, tl, t0 + 0.6);
      if (etF) animarLinea(etF, tl, t0 + 0.9);
    },
  };
}

// ═════════ fila de tamaños ═════════
export function extraFila(ctx, { slugs }) {
  const { motor, R, raiz, pal, zP, def } = ctx;
  const T = window.DATOS.tiers;
  const cmPx = 9.2;                              // px de diseño por centímetro
  const gap = 70;
  const zF = zP + 0.9;                           // retablos de pie, delante de la pared
  const yPiso = 860;                             // línea del piso (px de diseño, a la altura de los retablos)
  const items = [];
  let x = 0;
  slugs.forEach((slug) => {
    const P0 = R.productos[slug];
    const tr = T[P0.tier];
    const anchoPx = tr.ancho * cmPx;
    items.push({ slug, P0, tr, anchoPx, x: x + anchoPx / 2 });
    x += anchoPx + gap;
  });
  const total = x - gap;
  items.forEach((it) => { it.x = it.x - total / 2 + 960; });
  const g = new THREE.Group();
  raiz.add(g);
  // piso que refleja: los reflejos son copias invertidas, el piso semitransparente encima
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(260, 60), new THREE.MeshLambertMaterial({ color: col(pal.fondo), transparent: true, opacity: 0.86 }));
  piso.rotation.x = -Math.PI / 2;
  const [, yP] = aMundo(0, yPiso, zF);
  piso.position.set(0, yP, zF + 20);
  piso.receiveShadow = true;
  piso.renderOrder = 1;
  g.add(piso);
  const objs = items.map((it, i) => {
    const s = (it.tr.ancho * cmPx) / (it.P0.caja[2] - it.P0.caja[0]);
    const k = tamMundo(s, zF);
    const o = crearRetablo3D(it.P0, { k, fondoRel: 0.4 });
    const piv = new THREE.Group();
    piv.position.set(...aMundo(it.x, yPiso, zF));
    piv.position.y = yP;
    piv.add(o.grupo);
    g.add(piv);
    // reflejo
    const ref = crearRetablo3D(it.P0, { k, fondoRel: 0.4, sombras: false });
    ref.grupo.scale.y = -1;
    const pr = new THREE.Group();
    pr.position.copy(piv.position);
    pr.add(ref.grupo);
    ref.mats.forEach((m) => { m.side = THREE.BackSide; });
    g.add(pr);
    // etiqueta con el precio y la medida
    const e = pal.tinta === AZUL ? { fondo: ROJO, tinta: CREMA } : { fondo: CREMA, tinta: AZUL };
    const tex = motor.texturaCanvas(etiquetaCanvas(it.tr.precio, { ...e, sub: it.tr.medida }));
    const anchoE = tamMundo(150, zF + 0.6);
    const et = new THREE.Mesh(new THREE.PlaneGeometry(anchoE, anchoE * 1.02), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    et.renderOrder = 33;
    const [ex] = aMundo(it.x, 0, zF + 0.6);
    et.position.set(ex, yP - tamMundo(120, zF + 0.6), zF + 0.6);
    g.add(et);
    return { it, o, ref, piv, pr, et, i };
  });
  // la cámara recorre la fila de chico a grande
  const centroX = (xs) => aMundo(xs, 540, zF)[0];
  const xIni = centroX(items[0].x + 120), xFin = centroX(items[items.length - 1].x - 60);
  return {
    slugs,
    texturas(cache) { objs.forEach((q) => { q.o.ponerTextura(cache[q.it.slug] || texVacia()); q.ref.ponerTextura(cache[q.it.slug] || texVacia()); }); },
    actualizar(tl, t) {
      objs.forEach((q) => {
        const tE = -0.85 + q.i * 0.4;
        const u = clamp((tl - tE) / 0.8);
        const e = E.outBack(u, 1.4);
        const s = Math.max(0.001, e);
        q.o.grupo.scale.setScalar(s);
        q.ref.grupo.scale.set(s, -s, s);
        q.o.grupo.visible = q.ref.grupo.visible = u > 0;
        const c = 1 - E.outBack(clamp((tl - tE - 0.3) / 0.9), 1.2);
        q.o.puertasA(c); q.ref.puertasA(c);
        const ue = clamp((tl - tE - 0.55) / 0.6);
        q.et.scale.setScalar(Math.max(0.001, E.outBack(ue, 2)));
        q.et.visible = ue > 0;
      });
    },
    vista(tl) {
      const u = E.inOutSine(prog(tl, -0.6, def.dur + 0.6));
      const x = lerp(xIni, xFin, u);
      const z = DC * lerp(0.62, 1.02, E.inOutSine(prog(tl, 0.4, def.dur)));
      const y = lerp(0.35, 1.2, u);
      const mira = [x * 0.92, lerp(-0.6, -0.2, u), zF];
      return { pos: [x, y, z], mira, fov: FOV, foco: Math.hypot(x - mira[0], y - mira[1], z - mira[2]), apertura: 0.06 };
    },
  };
}

// ═════════ carrusel (fila que avanza: el del centro de frente y abierto, los de los lados girados) ═════════
export function extraCarrusel(ctx, { slugs }) {
  const { motor, R, raiz, pal, esc, def, capaTexto } = ctx;
  const n = slugs.length;
  esc.fog = new THREE.Fog(col(pal.fondo), DC + 2, DC + 12);
  const g = new THREE.Group();
  raiz.add(g);
  const baseY = aMundo(0, 860, 0)[1];
  const objs = slugs.map((slug, i) => {
    const P0 = R.productos[slug];
    const k = tamMundo(560 / (P0.apoyo - P0.caja[1]), 0);
    const o = crearRetablo3D(P0, { k, fondoRel: 0.4 });
    const piv = new THREE.Group();
    piv.add(o.grupo);
    g.add(piv);
    const nom = linea(motor, P0.nombre, { familia: FUENTE.display, peso: 600, estilo: 'italic', px: 56, color: pal.tinta, alinear: 'centro', z: ZT });
    nom.position.set(...aMundo(960, 945, ZT));
    capaTexto.add(nom);
    return { slug, o, piv, nom, i };
  });
  const paso = 0.9, espera = 1.0;
  const gap = tamMundo(560);
  const desfase = (tl) => {
    const s = (tl - espera) / paso;
    if (s < 0) return 0;
    const b = Math.floor(s), f = s - b;
    return Math.min(n - 1, b + E.inOutCubic(clamp(f / 0.6)));
  };
  return {
    slugs,
    texturas(cache) { objs.forEach((q) => q.o.ponerTextura(cache[q.slug] || texVacia())); },
    actualizar(tl, t) {
      const off = desfase(tl);
      const entra = E.outCubic(clamp((tl + 1.0) / 1.1));
      objs.forEach((q) => {
        const sl = q.i - off;                  // lugar respecto del centro
        const a = Math.abs(sl), sg = Math.sign(sl);
        const x = sg * (Math.min(a, 1) * gap * 1.05 + Math.max(0, a - 1) * gap * 0.62);
        const z = -Math.min(a, 1) * 2.2 - Math.max(0, a - 1) * 1.4;
        q.piv.position.set(x + (1 - entra) * gap * 1.5, baseY, z);
        q.piv.rotation.y = -sg * Math.min(a, 1) * 0.62;
        q.piv.visible = a < 3.2;
        q.o.puertasA(clamp(a * 1.2));
        // nombre del que queda al centro
        const ai = q.i;
        let tA = null, tS = null;
        if (ai === 0) { tA = 0.5; tS = espera; } else { tA = espera + (ai - 1) * paso + 0.6 * paso; tS = espera + ai * paso; }
        if (ai === n - 1) tS = null;
        if (tl >= tA - 0.01) animarLinea(q.nom, tl, tA, { sale: tS, durSale: 0.22, dur: 0.45 }); else animarLinea(q.nom, -10, 0);
      });
    },
    vista(tl) {
      const u = E.inOutSine(prog(tl, -0.6, def.dur + 0.6));
      const z = DC * lerp(1.0, 0.95, u);
      const mira = [0, aMundo(0, 600, 0)[1], -0.8];
      const pos = [lerp(0.3, -0.3, u), mira[1] + 0.9, z];
      return { pos, mira, fov: FOV, foco: Math.hypot(pos[0], pos[1] - mira[1], pos[2] - 0.1), apertura: 0.08 };
    },
  };
}

// ═════════ pared de galería ═════════
export function extraPared(ctx, { slugs }) {
  const { motor, R, raiz, pal, zP, def } = ctx;
  const g = new THREE.Group();
  raiz.add(g);
  const cols = 4, filas = 2;
  const anchoPx = 560, sepX = 640, sepY = 400;
  const x0 = 960 - ((cols - 1) * sepX) / 2, y0 = 540 - ((filas - 1) * sepY) / 2 + 40;
  const z = zP + 0.62;
  const objs = slugs.map((slug, i) => {
    const P0 = R.productos[slug];
    const c = i % cols, f = Math.floor(i / cols);
    const k = tamMundo(anchoPx / (P0.caja[2] - P0.caja[0]), z);
    const o = crearRetablo3D(P0, { k, fondoRel: 0.4 });
    const piv = new THREE.Group();
    const altoPx = (P0.apoyo - P0.caja[1]) * (anchoPx / (P0.caja[2] - P0.caja[0]));
    const cx = x0 + c * sepX, base = y0 + f * sepY + altoPx / 2;
    piv.position.set(...aMundo(cx, base, z));
    piv.add(o.grupo);
    g.add(piv);
    const nom = linea(motor, P0.nombre, { familia: FUENTE.display, peso: 600, estilo: 'italic', px: 30, color: pal.tinta, alinear: 'centro', z: z + 0.05 });
    nom.position.set(...aMundo(cx, base + 44, z + 0.05));
    g.add(nom);
    return { slug, o, piv, nom, i, cx, c, f };
  });
  return {
    slugs,
    texturas(cache) { objs.forEach((q) => q.o.ponerTextura(cache[q.slug] || texVacia())); },
    actualizar(tl) {
      objs.forEach((q) => {
        const tE = 0.15 + q.c * 0.32 + q.f * 0.14;
        q.o.grupo.visible = true;
        q.o.puertasA(1 - E.outBack(clamp((tl - tE) / 0.85), 1.2));
        animarLinea(q.nom, tl, tE + 0.45);
      });
    },
    vista(tl) {
      const u = E.inOutSine(prog(tl, -0.6, def.dur + 0.6));
      const az = lerp(0.26, -0.22, u);
      const c = [lerp(-2.2, 2.2, u), 0.05, z];
      const d = DC * lerp(0.9, 0.94, Math.sin(u * Math.PI)) - z;
      return { pos: [c[0] + Math.sin(az) * d, c[1] + 0.4, c[2] + Math.cos(az) * d], mira: c, fov: FOV, foco: d, apertura: 0.07 };
    },
  };
}

// ═════════ fotos con paralaje ═════════
export function extraFoto(ctx, { fotos, textos = [] }) {
  const { motor, R, raiz, esc, def } = ctx;
  esc.background = col('#0b0b0d');
  const capas = [];
  const cargadas = {};
  const nF = fotos.length;
  const durF = def.dur / nF;
  fotos.forEach((clave, i) => {
    const F = R.fotos[clave];
    const asp = F.w / F.h;
    const zFondo = -5, zSuj = -1.2;
    const altoF = tamMundo(1080, zFondo) * 1.18;
    const grupo = new THREE.Group();
    raiz.add(grupo);
    const mFondo = new THREE.MeshBasicMaterial({ map: texVacia(), toneMapped: false, transparent: true });
    const fondo = new THREE.Mesh(new THREE.PlaneGeometry(altoF * asp, altoF), mFondo);
    fondo.position.z = zFondo;
    grupo.add(fondo);
    let suj = null, mSuj = null;
    if (F.mascara) {
      const altoS = altoF * (DC - zSuj) / (DC - zFondo);
      mSuj = new THREE.ShaderMaterial({
        uniforms: { mapa: { value: texVacia() }, masc: { value: texVacia() }, opacidad: { value: 1 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform sampler2D mapa, masc; uniform float opacidad; varying vec2 vUv;
          void main(){ float a = texture2D(masc, vUv).r; vec4 c = texture2D(mapa, vUv); gl_FragColor = vec4(c.rgb, a * opacidad); }`,
        transparent: true, depthWrite: false,
      });
      suj = new THREE.Mesh(new THREE.PlaneGeometry(altoS * asp, altoS), mSuj);
      suj.position.z = zSuj;
      suj.renderOrder = 2;
      grupo.add(suj);
    }
    capas.push({ clave, F, grupo, fondo, mFondo, suj, mSuj, i });
  });
  // texto con un velo oscuro abajo
  const velo = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), new THREE.ShaderMaterial({
    uniforms: { opacidad: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float opacidad; varying vec2 vUv; void main(){ float a = smoothstep(0.62, 0.0, vUv.y) * 0.72 * opacidad; gl_FragColor = vec4(0.0, 0.0, 0.0, a); }`,
    transparent: true, depthWrite: false }));
  velo.position.set(...aMundo(960, 1040, 1.0));
  velo.renderOrder = 25;
  ctx.capaTexto.add(velo);
  const lineas = [];
  textos.forEach((par, j) => {
    const [a, b] = par;
    const l1 = linea(motor, a, { familia: FUENTE.texto, peso: 700, estilo: 'normal', px: 30, tracking: 7, color: '#f6c453', alinear: 'izq', z: ZT });
    l1.position.set(...aMundo(150, 840, ZT));
    const l2 = linea(motor, b, { familia: FUENTE.display, peso: 600, estilo: 'italic', px: 104, color: CREMA, alinear: 'izq', z: ZT });
    l2.position.set(...aMundo(144, 960, ZT));
    ctx.capaTexto.add(l1, l2);
    lineas.push([l1, l2, j]);
  });
  return {
    slugs: fotos.map((c) => 'foto:' + c),
    texturas(cache) {
      capas.forEach((c) => {
        const t = cache['foto:' + c.clave];
        if (!t) return;
        c.mFondo.map = t.fondo || t.foto;
        c.mFondo.needsUpdate = true;
        if (c.mSuj && t.masc) { c.mSuj.uniforms.mapa.value = t.foto; c.mSuj.uniforms.masc.value = t.masc; }
      });
    },
    actualizar(tl, t) {
      capas.forEach((c) => {
        const a = c.i * durF, b = a + durF;
        const entra = c.i === 0 ? 1 : E.inOutSine(prog(tl, a - 0.35, a + 0.35));
        const sale = c.i === nF - 1 ? 0 : E.inOutSine(prog(tl, b - 0.35, b + 0.35));
        const vis = entra * (1 - sale);
        c.grupo.visible = vis > 0.001;
        c.mFondo.opacity = vis;
        if (c.mSuj) c.mSuj.uniforms.opacidad.value = vis;
        // el sujeto se acerca apenas más que el fondo (paralaje propio)
        const u = prog(tl, a - 0.5, b + 0.5);
        if (c.suj) c.suj.position.z = -1.2 + u * 0.5;
      });
      velo.material.uniforms.opacidad.value = E.inOutSine(prog(tl, 0.2, 1.0));
      lineas.forEach(([l1, l2]) => { animarLinea(l1, tl, 0.6, { abre: tamMundo(8) }); animarLinea(l2, tl, 0.8); });
    },
    vista(tl) {
      const u = E.inOutSine(prog(tl, -0.6, def.dur + 0.6));
      const z = DC * lerp(1.0, 0.86, u);
      return { pos: [lerp(-0.9, 0.9, u), lerp(0.25, -0.15, u), z], mira: [lerp(-0.3, 0.3, u), 0, -3], fov: FOV, foco: z + 1.2, apertura: 0.05 };
    },
  };
}

// ═════════ ángeles colgantes ═════════
export function extraAngeles(ctx, { slugs = null } = {}) {
  const { motor, R, raiz, pal, zP } = ctx;
  const lista = slugs || window.DATOS.decor.angeles;
  const r = azar(77);
  const z0 = zP + 0.8;
  const objs = lista.map((slug, i) => {
    const P0 = R.productos[slug];
    const z = z0 + r.entre(-0.2, 0.9);
    const altoPx = r.entre(330, 400);
    const k = tamMundo(altoPx / (P0.apoyo - P0.caja[1]), z);
    const o = crearPlano(P0, { k });
    const x = 170 + i * ((1920 - 340) / (lista.length - 1)) + r.entre(-25, 25);
    const yCabeza = (i % 2 ? r.entre(330, 470) : r.entre(130, 250));
    // pivote en el hilo, arriba de la pantalla
    const piv = new THREE.Group();
    piv.position.set(...aMundo(x, -120, z));
    const largo = tamMundo(yCabeza + 120, z);
    const cuerpo = new THREE.Group();
    cuerpo.position.y = -largo;
    // el plano se apoya en su base: lo subo para que cuelgue de la cabeza
    o.grupo.position.y = -o.altoTotal;
    cuerpo.add(o.grupo);
    const hilo = new THREE.Mesh(new THREE.PlaneGeometry(tamMundo(2, z), largo), new THREE.MeshBasicMaterial({ color: col(mezcla(pal.tinta, pal.fondo, 0.4)), transparent: true, opacity: 0.6, depthWrite: false }));
    hilo.position.y = -largo / 2;
    piv.add(hilo, cuerpo);
    raiz.add(piv);
    return { slug, o, piv, cuerpo, hilo, largo, i, fase: r.entre(0, 6.28), amp: r.entre(0.04, 0.09), tE: 0.05 + i * 0.11 };
  });
  return {
    slugs: lista,
    texturas(cache) { objs.forEach((q) => q.o.ponerTextura(cache[q.slug] || texVacia())); },
    actualizar(tl, t) {
      objs.forEach((q) => {
        // baja como un yoyo y se mece
        const u = clamp((tl - q.tE) / 1.1);
        const e = resorte(u, 1.1, 5.5);
        q.piv.position.y = aMundo(0, -120, q.piv.position.z)[1] + (1 - e) * q.largo * 1.1;
        const meneo = vaiven(clamp((tl - q.tE - 0.5) / 3), 1.4, 2.5) * 0.12;
        q.piv.rotation.z = Math.sin(t * 1.05 + q.fase) * q.amp + meneo;
        q.cuerpo.rotation.y = Math.sin(t * 0.6 + q.fase) * 0.25;
        q.piv.visible = u > 0;
      });
    },
  };
}

// ═════════ espejos ═════════
export function extraEspejos(ctx, { slugs = null } = {}) {
  const { motor, R, raiz, pal, zP } = ctx;
  const lista = slugs || window.DATOS.decor.espejos;
  const z = zP + 0.5;
  const xs = [310, 660, 960, 1260, 1610], ys = [650, 575, 650, 575, 650], tams = [380, 360, 440, 360, 380];
  const objs = lista.map((slug, i) => {
    const P0 = R.productos[slug];
    const k = tamMundo(tams[i] / (P0.caja[3] - P0.caja[1]), z);
    const o = crearPlano(P0, { k });
    o.colores(mezcla(pal.claro, '#ffffff', 0.55), mezcla(pal.oscuro, '#6a7480', 0.35));
    const piv = new THREE.Group();
    piv.position.set(...aMundo(xs[i], ys[i] + tams[i] / 2, z));
    piv.add(o.grupo);
    raiz.add(piv);
    return { slug, o, piv, i };
  });
  return {
    slugs: [...lista, ...lista.map((s) => s + '#vidrio')],
    texturas(cache) { objs.forEach((q) => q.o.ponerTextura(cache[q.slug] || texVacia(), cache[q.slug + '#vidrio'] || null)); },
    actualizar(tl, t) {
      objs.forEach((q) => {
        const tE = -0.55 + q.i * 0.14;
        const u = clamp((tl - tE) / 0.9);
        q.piv.visible = u > 0;
        q.o.grupo.rotation.y = (1 - E.outBack(u, 1.3)) * Math.PI * 0.6;
        q.o.grupo.scale.setScalar(Math.max(0.001, E.outCubic(clamp(u * 1.6))));
        q.o.grupo.rotation.z = Math.sin(t * 0.8 + q.i) * 0.012;
        q.o.tiempo(t + q.i * 0.9);
      });
    },
  };
}
