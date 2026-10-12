// Un tablero del video: una pared de color con su degradado y la flor del logo tono sobre tono, flores
// chicas que flotan (delante, fuera de foco), los retablos en 3D colgados de la pared (con su sombra de
// verdad: la luz principal se reparte en un disco entre submuestras, así la sombra sale suave), el nombre,
// la medida y el precio en una casita. Se compone en px de diseño (1920×1080) y la cámara se mueve en 3D.
import * as THREE from 'three';
import { florCanvas, mallaFlor, etiquetaCanvas, formaCasa } from './marca.js';
import { crearRetablo3D, crearPlano, texVacia } from './retablo3d.js';
import { DC, FOV, S0, ZT, aMundo, tamMundo, linea, animarLinea, mezcla, srgb, CREMA } from './letras.js';
import { azar, clamp, E, lerp, prog, resorte, vaiven, halton } from './util.js';

const col = (h) => new THREE.Color(h);
const GLSL_SRGB = /* glsl */ `vec3 aLineal(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }`;
const VERT_MUNDO = /* glsl */ `varying vec3 vP; varying vec2 vUv;
  void main(){ vUv = uv; vec4 m = modelMatrix * vec4(position, 1.0); vP = m.xyz; gl_Position = projectionMatrix * viewMatrix * m; }`;

// Pared: degradado radial (claro → fondo → oscuro) en sRGB, con un grano muy fino de yeso
const FRAG_PARED = /* glsl */ `
  uniform vec3 claro, fondo, oscuro; uniform vec2 centro; uniform float radio, escala;
  varying vec3 vP; ${GLSL_SRGB}
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){
    vec2 px = vec2(960.0 + vP.x / escala, 540.0 - vP.y / escala);
    float d = length((px - centro) * vec2(1.0, 1.12)) / radio;
    vec3 c = d < 0.5 ? mix(claro, fondo, smoothstep(0.0, 0.5, d)) : mix(fondo, oscuro, smoothstep(0.5, 1.15, d));
    c *= 1.0 + (h(floor(px * 1.5)) - 0.5) * 0.012;
    gl_FragColor = vec4(aLineal(c), 1.0);
  }`;

// Florcitas: la flor del logo blanca, teñida, desenfocada por mip según su distancia al foco
const VERT_FLORCITA = /* glsl */ `attribute vec4 tinte; attribute float desenf; varying vec2 vUv; varying vec4 vT; varying float vD;
  void main(){ vUv = uv; vT = tinte; vD = desenf; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`;
const FRAG_FLORCITA = /* glsl */ `uniform sampler2D mapa; uniform float opacidad; varying vec2 vUv; varying vec4 vT; varying float vD; ${GLSL_SRGB}
  void main(){ float a = texture2D(mapa, vUv, vD).a * vT.a * opacidad; if (a < 0.002) discard; gl_FragColor = vec4(aLineal(vT.rgb), a); }`;

// Destello: estrella de cuatro puntas (u 0 → 1)
const FRAG_DESTELLO = /* glsl */ `uniform float u; varying vec2 vUv;
  void main(){
    if (u <= 0.0 || u >= 1.0) discard;
    float k = pow(sin(3.14159 * u), 1.4);
    vec2 p = (vUv - 0.5) * 2.0;
    float a = 0.6 * u, cs = cos(a), sn = sin(a);
    p = mat2(cs, -sn, sn, cs) * p / max(k, 0.001);
    float rayo = max(exp(-abs(p.x) * 26.0) * exp(-abs(p.y) * 2.2), exp(-abs(p.y) * 26.0) * exp(-abs(p.x) * 2.2));
    float v = (rayo + exp(-dot(p, p) * 5.0) * 0.45 + exp(-dot(p, p) * 60.0)) * k;
    gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * v * 2.4, 1.0);
  }`;

let _petalo = null;
const _cacheEtiq = new Map();

// ═════════ el tablero ═════════
// def: {id, t0, dur, pal, flor:[x,y,R], pared, prods, textos, filetes, etiquetas, iconos, camara, luz, extra}
export function crearTablero(motor, R, def) {
  const esc = new THREE.Scene();
  const pal = def.pal;
  esc.background = col(pal.oscuro);
  const raiz = new THREE.Group();
  esc.add(raiz);
  // textos y etiquetas: van pegados a la cámara (como en la vista de referencia), así nunca se salen de cuadro
  const hud = new THREE.Group();
  hud.matrixAutoUpdate = false;
  esc.add(hud);
  const capaTexto = def.hud === false ? raiz : hud;
  const zP = def.pared ?? -2.6;                         // la pared

  // ── luz: cielo + una principal con sombra (calibradas: una cara de frente sale con el color de la foto) ──
  const L = def.luz || {};
  const dirLuz = new THREE.Vector3(...(L.dir || [-0.42, 0.5, 0.76])).normalize();
  const suelo = col(mezcla('#ffffff', pal.oscuro, 0.45));
  const prom = (1 + (suelo.r + suelo.g + suelo.b) / 3) / 2;
  const hemi = new THREE.HemisphereLight(col('#ffffff'), suelo, (L.cielo ?? 0.40) * Math.PI / prom);
  esc.add(hemi);
  const sol = new THREE.DirectionalLight(col(L.color || '#fff6ea'), ((L.fuerza ?? 0.62) * Math.PI) / Math.max(0.2, dirLuz.z));
  const dist = 30;
  sol.position.copy(dirLuz).multiplyScalar(dist);
  sol.target.position.set(0, 0, 0);
  esc.add(sol, sol.target);
  sol.castShadow = true;
  const sc = sol.shadow.camera;
  const mitadX = tamMundo(1100, zP), mitadY = tamMundo(700, zP);
  sc.left = -mitadX; sc.right = mitadX; sc.top = mitadY; sc.bottom = -mitadY; sc.near = 1; sc.far = 80;
  sol.shadow.mapSize.set(4096, 4096);
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.02;
  const ablandar = L.blando ?? 0.05;                    // radio del disco de la luz (sombras suaves)

  // ── la pared ──
  const [fx, fy, fr] = def.flor || [960, 520, 700];
  const paredMat = new THREE.ShaderMaterial({
    uniforms: { claro: { value: srgb(pal.claro) }, fondo: { value: srgb(pal.fondo) }, oscuro: { value: srgb(pal.oscuro) },
      centro: { value: new THREE.Vector2(fx, fy) }, radio: { value: def.radioFondo ?? 1350 }, escala: { value: (S0 * (DC - zP)) / DC } },
    vertexShader: VERT_MUNDO, fragmentShader: FRAG_PARED, depthWrite: false,
  });
  const pared = new THREE.Mesh(new THREE.PlaneGeometry(220, 130), paredMat);
  pared.position.z = zP;
  pared.renderOrder = -10;
  raiz.add(pared);
  const sombraMat = new THREE.ShadowMaterial({ color: col(mezcla(pal.oscuro, '#000000', 0.55)), opacity: L.sombra ?? 0.5, depthWrite: false });
  const paredSombra = new THREE.Mesh(new THREE.PlaneGeometry(220, 130), sombraMat);
  paredSombra.position.z = zP + 0.003;
  paredSombra.receiveShadow = true;
  paredSombra.renderOrder = -8;
  raiz.add(paredSombra);

  // la flor del logo tono sobre tono, enorme y girando despacio
  const [tono, alfaT] = pal.tono || ['#ffffff', 0.08];
  const flor = mallaFlor(tono, { opacidad: alfaT });
  flor.userData.mats.forEach((m) => { m.opacity = alfaT; });
  flor.children.forEach((m) => { m.renderOrder = -9; });
  const zFlor = zP + 0.01;
  flor.position.set(...aMundo(fx, fy, zFlor));
  flor.scale.setScalar(tamMundo(fr, zFlor));
  if (def.flor !== null) raiz.add(flor);

  // ── florcitas (la flor del logo, chiquita) que flotan: unas sobre la pared, pocas delante y fuera de foco ──
  if (!_petalo) { _petalo = motor.texturaCanvas(florCanvas(256)); _petalo.generateMipmaps = true; }
  const nF = def.florcitas?.n ?? 18;
  const rf = azar(311 + (def.semilla ?? 7) * 17);
  const fl = [];
  for (let i = 0; i < nF; i++) {
    const delante = i < (def.florcitas?.delante ?? 4);
    const z = delante ? rf.entre(3, 8) : rf.entre(zP + 0.25, -0.4);
    let x0 = rf() * 2120 - 100;
    if (delante) x0 = rf() < 0.5 ? rf.entre(-80, 280) : rf.entre(1640, 2000);
    fl.push({ z, x0, y0: rf() * 1240, r: (7 + rf() ** 2 * 15) * (delante ? 1.5 : 1), vel: 22 + rf() * 30, fase: rf() * 6.283,
      giro: (rf() - 0.5) * 1.4, a: (0.18 + rf() * 0.26) * (delante ? 0.7 : 1), acento: rf() < 0.5 });
  }
  const blanco = def.florcitas?.color || '#ffffff';
  const grupos = [fl.filter((f) => f.z < 0), fl.filter((f) => f.z >= 0)].map((lista, gi) => {
    const geoF = new THREE.PlaneGeometry(1, 1);
    const tinte = new Float32Array(Math.max(1, lista.length) * 4), desenf = new Float32Array(Math.max(1, lista.length));
    lista.forEach((f, i) => { const c = srgb(f.acento ? pal.acento : blanco); tinte.set([c.x, c.y, c.z, f.a], i * 4); });
    geoF.setAttribute('tinte', new THREE.InstancedBufferAttribute(tinte, 4));
    geoF.setAttribute('desenf', new THREE.InstancedBufferAttribute(desenf, 1));
    const im = new THREE.InstancedMesh(geoF, new THREE.ShaderMaterial({
      uniforms: { mapa: { value: _petalo }, opacidad: { value: 1 } }, vertexShader: VERT_FLORCITA, fragmentShader: FRAG_FLORCITA,
      transparent: true, depthWrite: false }), Math.max(1, lista.length));
    im.count = lista.length;
    im.frustumCulled = false;
    im.renderOrder = gi ? 40 : -5;
    raiz.add(im);
    return { im, lista, desenf };
  });

  // ── productos: retablos en 3D o recortes planos ──
  const prods = (def.prods || []).map((pd, i) => {
    const P0 = R.productos[pd.slug];
    const z = pd.z ?? 0;
    const tipo = P0.tipo === 'retablo' && pd.plano !== true ? 'retablo' : 'plano';
    // escala: el alto (base → arriba) o el ancho total, en px de diseño
    const altoPx = P0.apoyo - P0.caja[1], anchoPx = P0.caja[2] - P0.caja[0];
    const s = pd.alto ? pd.alto / altoPx : pd.ancho ? pd.ancho / anchoPx : Math.min((pd.maxW ?? 900) / anchoPx, (pd.maxH ?? 700) / altoPx);
    const k = tamMundo(s, z);
    const obj = tipo === 'retablo' ? crearRetablo3D(P0, { k, fondoRel: pd.fondoRel ?? 0.4 }) : crearPlano(P0, { k });
    const piv = new THREE.Group();          // dónde se apoya (centro de la caja, línea de apoyo)
    const cxPx = tipo === 'retablo' ? pd.cx : pd.cx;
    piv.position.set(...aMundo(cxPx, pd.base, z));
    const anim = new THREE.Group();
    anim.add(obj.grupo);
    piv.add(anim);
    raiz.add(piv);
    // destellos en puntos de la foto (fracciones de la imagen)
    const destellos = (pd.brillos || []).map(([u, v, tb, tam]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
        uniforms: { u: { value: 0 } }, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: FRAG_DESTELLO, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      const lado = tamMundo((tam ?? 46) * 2.4);
      m.scale.set(lado, lado, 1);
      const bx = tipo === 'retablo' ? (P0.bisagras[0] + P0.bisagras[1]) / 2 : P0.apoyoX;
      m.position.set((u * P0.w - bx) * k, (P0.apoyo - v * P0.h) * k, 0.06);
      m.renderOrder = 35;
      anim.add(m);
      return { m, t: tb };
    });
    return { def: pd, i, P0, tipo, obj, piv, anim, s, k, destellos };
  });

  // ── textos ──
  const textos = (def.textos || []).map((tx) => {
    const g = linea(motor, tx.texto, { ...tx.estilo, z: tx.z ?? ZT });
    g.position.set(...aMundo(tx.x, tx.y, tx.z ?? ZT));
    capaTexto.add(g);
    return { def: tx, g };
  });
  const filetes = (def.filetes || []).map((fd) => {
    const largo = tamMundo(fd.ancho, ZT), grueso = tamMundo(fd.grueso ?? 3, ZT);
    const geo = new THREE.PlaneGeometry(largo, grueso);
    geo.translate(fd.alinear === 'centro' ? 0 : largo / 2, 0, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col(fd.color), transparent: true, opacity: fd.alfa ?? 0.8, depthWrite: false, toneMapped: false }));
    m.position.set(...aMundo(fd.x, fd.y, ZT));
    m.renderOrder = 29;
    capaTexto.add(m);
    return { def: fd, m };
  });
  const iconos = (def.iconos || []).map((ic) => {
    const m = mallaFlor(ic.colores || { rojo: pal.acento, verde: pal.tinta, naranja: pal.acento });
    m.children.forEach((c) => { c.renderOrder = 31; });
    m.position.set(...aMundo(ic.x, ic.y, ZT));
    const r = tamMundo(ic.R ?? 30, ZT);
    capaTexto.add(m);
    return { def: ic, m, r };
  });

  // ── etiquetas de precio (casitas) ──
  const etiquetas = (def.etiquetas || []).map((ed) => {
    const clave = `${ed.precio}|${ed.fondo}|${ed.tinta}|${ed.sub || ''}|${ed.borde || ''}`;
    if (!_cacheEtiq.has(clave)) _cacheEtiq.set(clave, motor.texturaCanvas(etiquetaCanvas(ed.precio, { fondo: ed.fondo, tinta: ed.tinta, sub: ed.sub, borde: ed.borde })));
    const tex = _cacheEtiq.get(clave);
    const z = ed.z ?? ZT + 0.25;
    const ancho = tamMundo(ed.ancho ?? 230, z);
    const g = new THREE.Group();
    const geo = new THREE.PlaneGeometry(ancho, ancho * 1.02);
    geo.translate(0, -ancho * 1.02 / 2, 0);            // cuelga del techo de la casita
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    m.renderOrder = 33;
    const somb = new THREE.Mesh(new THREE.ShapeGeometry(formaCasa(ancho * 0.88, ancho * 0.9, ancho * 0.3, ancho * 0.06)),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
    somb.position.set(tamMundo(10, z), -ancho * 0.96 - tamMundo(12, z), -0.03);
    somb.renderOrder = 32;
    // el hilo del que cuelga
    const hilo = new THREE.Mesh(new THREE.PlaneGeometry(tamMundo(2.2, z), 1), new THREE.MeshBasicMaterial({ color: col(ed.hilo || pal.tinta), transparent: true, opacity: 0.7, depthWrite: false }));
    hilo.geometry.translate(0, 0.5, 0);
    hilo.renderOrder = 32;
    hilo.visible = ed.entrada === 'cuelga';
    g.add(somb, m, hilo);
    g.position.set(...aMundo(ed.x, ed.y, z));
    capaTexto.add(g);
    return { def: ed, g, m, somb, hilo, ancho };
  });

  // ── escena especial (galería, carrusel, foto con paralaje, ángeles…) ──
  const extra = def.extra ? def.extra({ motor, R, def, esc, raiz, pal, zP, sol, hemi, prods, dirLuz, capaTexto }) : null;

  // ═════════ en el tiempo ═════════
  const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _mm = new THREE.Matrix4(), _v = new THREE.Vector3();
  const P = 60 / (window.CUES?.bpm || 120);

  const _eye = new THREE.Vector3(), _tg = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _R = new THREE.Matrix4(), _Tr = new THREE.Matrix4();
  function actualizar(t, vista, op = {}) {
    const tl = t - def.t0;
    _eye.set(...vista.pos); _tg.set(...vista.mira);
    _R.lookAt(_eye, _tg, _up);
    _R.setPosition(_eye);
    if (vista.giro) _R.multiply(_Tr.makeRotationZ(vista.giro));
    hud.matrix.copy(_R).multiply(_Tr.makeTranslation(0, 0, -DC));
    hud.matrixWorldNeedsUpdate = true;
    const desv = op.desvanecer ?? 0;
    // luz de área: la dirección se reparte en un disco entre submuestras (sombras suaves)
    const kk = (op.k ?? 0) + 1;
    const rr = Math.sqrt(halton(kk, 11)) * ablandar, th = 2 * Math.PI * halton(kk, 13);
    _v.copy(dirLuz).add(new THREE.Vector3(Math.cos(th) * rr, Math.sin(th) * rr, 0)).normalize();
    sol.position.copy(_v).multiplyScalar(dist);
    flor.rotation.z = -t * 0.045;

    grupos.forEach(({ im, lista, desenf }) => {
      lista.forEach((f, i) => {
        const dt = t - def.t0 + 40;
        const Hh = 1240;
        const ypx = ((((f.y0 - dt * f.vel) % Hh) + Hh) % Hh) - 80;
        const xpx = f.x0 + Math.sin(dt * 0.8 + f.fase) * 28;
        const p = aMundo(xpx, ypx, f.z);
        const lado = tamMundo(f.r * 2.1, f.z);
        _e.set(0, 0, f.fase + dt * f.giro);
        _q.setFromEuler(_e);
        _s.set(lado, lado, 1);
        _mm.compose(new THREE.Vector3(...p), _q, _s);
        im.setMatrixAt(i, _mm);
        const d = Math.abs(Math.hypot(p[0] - vista.pos[0], p[1] - vista.pos[1], p[2] - vista.pos[2]) - (vista.foco || DC));
        desenf[i] = clamp(d * 0.5, 0, 4.5);
      });
      im.instanceMatrix.needsUpdate = true;
      im.geometry.attributes.desenf.needsUpdate = true;
      im.material.uniforms.opacidad.value = 1 - desv * 0.6;
    });

    prods.forEach((p) => entrada(p, tl, t));

    textos.forEach((tx) => animarLinea(tx.g, tl, tx.def.t ?? 0.3, {
      abre: tx.def.abre ? tamMundo(tx.def.abre) : 0, opacidad: 1 - desv, sale: tx.def.sale ?? null }));
    filetes.forEach((fd) => {
      const u = E.inOutCubic(prog(tl, fd.def.t ?? 0.6, (fd.def.t ?? 0.6) + 0.6));
      fd.m.scale.x = Math.max(0.0001, u);
      fd.m.visible = u > 0.001;
      fd.m.material.opacity = (fd.def.alfa ?? 0.8) * (1 - desv);
    });
    iconos.forEach((ic) => {
      const u = clamp((tl - (ic.def.t ?? 0.1)) / 0.6);
      const e = E.outBack(u, 1.8);
      ic.m.scale.setScalar(Math.max(0.0001, e * ic.r));
      ic.m.rotation.z = (1 - E.outCubic(u)) * -1.4 + t * 0.3;
      ic.m.visible = u > 0;
    });
    etiquetas.forEach((et) => animarEtiqueta(et, tl, t, desv));
    if (extra) extra.actualizar(tl, t, vista, op);
  }

  // Entradas de los productos (todas terminan con el retablo quieto y las puertas como en la foto)
  function entrada(p, tl, t) {
    const pd = p.def, o = p.obj;
    const tipo = pd.entrada || 'quieto';
    const t0 = pd.t ?? 0;
    const a = p.anim;
    a.position.set(0, 0, 0);
    a.rotation.set(0, 0, 0);
    a.scale.set(1, 1, 1);
    let cierre = 0, vis = true;
    const alto = o.altoTotal;
    if (tipo === 'abre') {
      // ya está (cerrado) y abre sus puertas
      const ua = clamp((tl - t0) / (pd.durAbre ?? 1.0));
      cierre = 1 - E.outBack(ua, 1.25);
      vis = tl > (pd.tVis ?? -1.5);
    } else if (tipo === 'puertas') {
      // llega cerrado (sube y se asienta), y abre sus puertas con un rebote de madera
      const u = clamp((tl - t0) / 0.55);
      const e = E.outCubic(u);
      a.position.y = (1 - e) * -alto * 0.25;
      a.position.z = (1 - e) * -0.8;
      vis = u > 0;
      const ta = t0 + (pd.abre ?? 0.5);
      const ua = clamp((tl - ta) / (pd.durAbre ?? 1.0));
      cierre = 1 - E.outBack(ua, 1.25);
      if (pd.escalonPuertas) {
        const ub = clamp((tl - ta - pd.escalonPuertas) / (pd.durAbre ?? 1.0));
        o.puertasA?.(cierre, 1 - E.outBack(ub, 1.25));
        cierre = null;
      }
      a.scale.setScalar(lerp(0.92, 1, e));
    } else if (tipo === 'gira') {
      // entra girando sobre su eje (se ve el canto y la caja) mientras abre
      const u = clamp((tl - t0) / 1.1);
      const e = E.outCubic(u);
      a.rotation.y = (1 - e) * (pd.desde ?? -1.25);
      a.position.x = (1 - e) * tamMundo(pd.dx ?? 260) * Math.sign(pd.desde ?? -1);
      cierre = 1 - E.outBack(clamp((tl - t0 - 0.35) / 0.95), 1.2);
      vis = tl > (pd.tVis ?? -1.5);
    } else if (tipo === 'voltea') {
      // de espaldas (la caja de madera) a de frente
      const u = clamp((tl - t0) / 1.0);
      a.rotation.y = (1 - E.outBack(u, 1.15)) * Math.PI * (pd.sentido ?? 1);
      cierre = 1 - E.outBack(clamp((tl - t0 - 0.55) / 0.9), 1.2);
      vis = tl > (pd.tVis ?? -1.5);
    } else if (tipo === 'cae') {
      const u = clamp((tl - t0) / 0.95);
      const e = resorte(u, 1.25, 6.5);
      a.position.y = (1 - e) * tamMundo(pd.altura ?? 700);
      a.scale.set(1 - (1 - e) * 0.04, 1 + (1 - e) * 0.05, 1);
      cierre = pd.abreAlCaer ? 1 - E.outBack(clamp((tl - t0 - 0.55) / 0.9), 1.2) : 0;
      vis = u > 0;
    } else if (tipo === 'sube') {
      const u = clamp((tl - t0) / 0.9);
      const e = E.outBack(u, 1.3);
      a.position.y = (e - 1) * tamMundo(pd.subir ?? 500);
      vis = u > 0;
      cierre = pd.abreAlSubir ? 1 - E.outBack(clamp((tl - t0 - 0.4) / 0.9), 1.2) : 0;
    } else if (tipo === 'desliza') {
      const u = clamp((tl - t0) / 0.95);
      const e = E.outCubic(u);
      a.position.x = (1 - e) * tamMundo(pd.desde ?? 900);
      a.rotation.y = (1 - e) * 0.35 * Math.sign(pd.desde ?? 900);
      vis = u > 0;
      cierre = pd.abreAlLlegar ? 1 - E.outBack(clamp((tl - t0 - 0.45) / 0.9), 1.2) : 0;
    } else if (tipo === 'pop') {
      const u = clamp((tl - t0) / 0.7);
      a.scale.setScalar(Math.max(0.001, 0.2 + 0.8 * E.outBack(u, 1.9)));
      vis = u > 0;
    } else if (tipo === 'acerca') {
      // viene desde el fondo (de lejos, chico) hasta la pared
      const u = clamp((tl - t0) / 1.1);
      const e = E.outCubic(u);
      a.position.z = (1 - e) * -14;
      a.position.y = (1 - e) * alto * 0.3;
      a.rotation.y = (1 - e) * 0.25 * (pd.sentido ?? 1);
      vis = tl > (pd.tVis ?? -1.5);
      cierre = pd.abreAlLlegar ? 1 - E.outBack(clamp((tl - t0 - 0.6) / 0.9), 1.2) : 0;
    }
    if (pd.cierreFijo != null) cierre = pd.cierreFijo;
    if (cierre != null && o.puertasA) o.puertasA(cierre);
    // un respiro: casi nada, para que no esté muerto
    if (pd.flota !== false) {
      const w = clamp((tl - t0 - 1.0) / 0.8);
      a.position.y += Math.sin(t * 1.1 + p.i * 1.9) * tamMundo(4) * w;
      a.rotation.y += Math.sin(t * 0.7 + p.i * 2.3) * 0.012 * w;
    }
    o.grupo.visible = vis;
    o.tiempo?.(t + p.i * 0.8);
    p.destellos.forEach((d) => { const u = prog(tl, d.t - 0.1, d.t + 0.45); d.m.material.uniforms.u.value = u; d.m.visible = u > 0 && u < 1 && vis; });
  }

  function animarEtiqueta(et, tl, t, desv) {
    const ed = et.def;
    const t0 = ed.t ?? 0.9;
    const u = clamp((tl - t0) / 0.9);
    const g = et.g;
    const [x, y, z] = aMundo(ed.x, ed.y, ed.z ?? ZT + 0.25);
    g.position.set(x, y, z);
    g.rotation.set(0, 0, 0);
    g.scale.setScalar(1);
    const tipo = ed.entrada || 'pop';
    if (tipo === 'cuelga') {
      // baja colgada de su hilo y se mece (péndulo amortiguado)
      const caida = E.outCubic(clamp(u * 1.4));
      g.position.y = y + (1 - caida) * tamMundo(700);
      const ang = vaiven(clamp((tl - t0 - 0.35) / 2.6), 1.6, 2.2) * 0.32 + Math.sin(t * 1.3 + ed.x) * 0.02 * clamp(u * 2);
      g.rotation.z = ang;
      et.hilo.scale.y = tamMundo(1400);
      et.hilo.position.y = 0;
    } else if (tipo === 'gira') {
      g.rotation.y = (1 - E.outBack(u, 1.3)) * Math.PI * 0.5;
      g.scale.setScalar(Math.max(0.001, E.outCubic(clamp(u * 2))));
    } else if (tipo === 'cae') {
      const e = resorte(u, 1.4, 7);
      g.position.y = y + (1 - e) * tamMundo(500);
    } else {
      const e = E.outBack(u, 2.2);
      g.scale.setScalar(Math.max(0.001, e));
      g.rotation.z = (1 - E.outCubic(u)) * -0.5;
    }
    // latido suave al compás
    const lat = 0.018 * Math.max(0, Math.cos(((t % (2 * P)) / (2 * P)) * Math.PI * 2)) * clamp(u * 2 - 1);
    g.scale.multiplyScalar(1 + lat);
    et.m.material.opacity = clamp(u * 4) * (1 - desv);
    et.somb.material.opacity = 0.22 * clamp(u * 3) * (1 - desv);
    g.visible = u > 0;
  }

  // ── cámara del tablero ──
  function vista(tl) {
    if (extra?.vista) return extra.vista(tl);
    const C = def.camara || {};
    const u = E.inOutSine(prog(tl, -0.9, def.dur + 0.9));
    if (C.tipo === 'orbita') {
      const [cxp, cyp] = C.centro || [960, 540];
      const c = aMundo(cxp, cyp, C.zc ?? -0.6);
      const az = lerp(...(C.az || [-0.1, 0.1]), u), el = lerp(...(C.el || [0.03, -0.01]), u);
      const d = DC * lerp(...(C.dist || [1.03, 0.97]), u) - (C.zc ?? -0.6);
      const pos = [c[0] + d * Math.sin(az) * Math.cos(el), c[1] + d * Math.sin(el), c[2] + d * Math.cos(az) * Math.cos(el)];
      return { pos, mira: c, fov: FOV, foco: d, apertura: C.apertura ?? 0.05 };
    }
    const [dx, dy] = def.deriva || [0.3, 0.06];
    const z = DC * lerp(1.035, 0.975, u);
    const x = lerp(-dx, dx, u), y = lerp(-dy, dy, u);
    return { pos: [x, y, z], mira: [x * 0.35, y * 0.35, 0], fov: FOV, foco: Math.hypot(x * 0.65, y * 0.65, z), apertura: def.apertura ?? 0.045 };
  }

  // texturas que necesita este tablero (se cargan antes de dibujarlo)
  const slugs = new Set([...prods.map((p) => p.def.slug), ...prods.filter((p) => p.P0.vidrio).map((p) => p.def.slug + '#vidrio'), ...(extra?.slugs || [])]);
  prods.forEach((p) => p.obj.colores?.(mezcla(pal.claro, '#ffffff', 0.5), mezcla(pal.oscuro, '#55606a', 0.4)));
  function texturas(cache) {
    prods.forEach((p) => p.obj.ponerTextura(cache[p.def.slug] || texVacia(), cache[p.def.slug + '#vidrio'] || null));
    extra?.texturas?.(cache);
  }

  return { def, escena: esc, raiz, actualizar, vista, prods, textos, etiquetas, slugs, texturas, extra };
}
