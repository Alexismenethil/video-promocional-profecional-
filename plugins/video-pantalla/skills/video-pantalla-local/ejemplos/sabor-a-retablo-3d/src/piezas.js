// Piezas 3D de los nichos: sala de yeso, arcos, podios pintados, la flor en relieve, el producto
// (foto recortada que mira a la cámara), letras por glifo, sello de precio, motivos de papel que
// flotan y polvo en la luz.
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { atlasTexto, selloPrecio, discoSuave, sombraContacto, FUENTE } from './texturas.js';
import { azar, clamp } from './util.js';

const col = (h) => new THREE.Color(h);

// ───────────────────────── materiales ─────────────────────────
export function matYeso(motor, color, { normal = null, rugosidad = 0.9, mapa = null, rep = 1, env = 0.35 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: col(color), roughness: rugosidad, metalness: 0, envMapIntensity: env });
  if (mapa) m.map = mapa;
  if (normal) {
    m.normalMap = normal;
    m.normalScale = new THREE.Vector2(0.55, 0.55);
  }
  return m;
}

// ───────────────────────── geometrías ─────────────────────────
// Arco en U invertida (sin agujeros: un solo contorno), extruido con bisel.
export function geoArco(ancho, alto, grosor, prof, { bisel = 0.05, curva = 64 } = {}) {
  const r = ancho / 2, ri = r - grosor, yc = alto - r;
  const s = new THREE.Shape();
  s.moveTo(-r, 0);
  s.lineTo(-r, yc);
  s.absarc(0, yc, r, Math.PI, 0, true);
  s.lineTo(r, 0);
  s.lineTo(ri, 0);
  s.lineTo(ri, yc);
  s.absarc(0, yc, ri, 0, Math.PI, false);
  s.lineTo(-ri, 0);
  s.lineTo(-r, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: prof, bevelEnabled: bisel > 0, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 4, curveSegments: curva });
  g.translate(0, 0, -prof / 2);
  return g;
}

// Pared con un hueco en forma de arco (para atravesarla): rectángulo menos arco.
export function geoParedArco(ancho, alto, huecoAncho, huecoAlto, prof = 0.4) {
  const s = new THREE.Shape();
  s.moveTo(-ancho / 2, 0); s.lineTo(ancho / 2, 0); s.lineTo(ancho / 2, alto); s.lineTo(-ancho / 2, alto); s.lineTo(-ancho / 2, 0);
  const r = huecoAncho / 2, yc = huecoAlto - r;
  const h = new THREE.Path();
  h.moveTo(-r, 0.001); h.lineTo(r, 0.001); h.lineTo(r, yc); h.absarc(0, yc, r, 0, Math.PI, false); h.lineTo(-r, 0.001);
  s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth: prof, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 64 });
  g.translate(0, 0, -prof / 2);
  return g;
}

// Formas de la flor oficial (flor.js) como THREE.Shape, radio 1.
let _formasFlor = null;
export function formasFlor() {
  if (_formasFlor) return _formasFlor;
  const F = window.FLOR, L = new SVGLoader();
  const formas = (d) => {
    const { paths } = L.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
    return paths.flatMap((p) => SVGLoader.createShapes(p));
  };
  _formasFlor = { petalos: formas(F.capas[0].d), corona: formas(F.capas[1].d), R: F.radio, RD: F.disco };
  return _formasFlor;
}

// La flor en relieve, tono sobre tono (detrás del producto). Devuelve un Group de radio R.
export function florRelieve(R, colores, { prof = 0.18 } = {}) {
  const f = formasFlor(), k = R / f.R;
  const grupo = new THREE.Group();
  const capa = (formas, c, z, d) => {
    const g = new THREE.ExtrudeGeometry(formas, { depth: d / k, bevelEnabled: true, bevelThickness: 2.2, bevelSize: 1.8, bevelSegments: 2, curveSegments: 24 });
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.8, envMapIntensity: 0.4 }));
    m.scale.set(k, -k, k);
    m.position.z = z;
    m.castShadow = true;
    m.receiveShadow = true;
    grupo.add(m);
    return m;
  };
  capa(f.petalos, colores[0], 0, prof);
  capa(f.corona, colores[1], prof * 0.6, prof * 0.8);
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(f.RD * k, f.RD * k, prof * 1.5, 96),
    new THREE.MeshStandardMaterial({ color: col(colores[2]), roughness: 0.75, envMapIntensity: 0.4 }));
  disco.rotation.x = Math.PI / 2;
  disco.position.z = prof * 1.2;
  disco.castShadow = disco.receiveShadow = true;
  grupo.add(disco);
  return grupo;
}

// Podio: cilindro con banda pintada al costado, tapa crema y filete dorado.
export function podio(motor, { radio = 2, alto = 1, banda = null, tapa = '#e9dfcb', canto = '#c9a35a', rep = 2 } = {}) {
  const g = new THREE.Group();
  const lado = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, envMapIntensity: 0.35 });
  if (banda) {
    const b = banda.clone();
    b.needsUpdate = true;
    b.wrapS = THREE.RepeatWrapping;
    b.repeat.set(rep, 1);
    lado.map = b;
  } else lado.color = col(tapa);
  const arriba = new THREE.MeshStandardMaterial({ color: col(tapa), roughness: 0.92, envMapIntensity: 0.35 });
  const cil = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio * 1.01, alto, 128, 1), [lado, arriba, arriba]);
  cil.position.y = alto / 2;
  cil.castShadow = cil.receiveShadow = true;
  g.add(cil);
  const filete = new THREE.Mesh(new THREE.TorusGeometry(radio * 1.003, Math.max(0.025, radio * 0.012), 12, 160),
    new THREE.MeshStandardMaterial({ color: col(canto), roughness: 0.35, metalness: 0.7, envMapIntensity: 1.0 }));
  filete.rotation.x = Math.PI / 2;
  filete.position.y = alto;
  g.add(filete);
  const zocalo = new THREE.Mesh(new THREE.CylinderGeometry(radio * 1.06, radio * 1.08, alto * 0.08, 128),
    new THREE.MeshStandardMaterial({ color: col(tapa), roughness: 0.7, envMapIntensity: 0.3 }));
  zocalo.position.y = alto * 0.04;
  zocalo.receiveShadow = zocalo.castShadow = true;
  g.add(zocalo);
  g.userData = { radio, alto };
  return g;
}

// ───────────────────────── producto (foto recortada) ─────────────────────────
// Un plano que mira a la cámara (en Y y un poco en X), apoyado en `base` por su línea de apoyo.
const VERT_PROD = /* glsl */ `
  varying vec2 vUv; varying vec3 vMundo;
  void main(){ vUv = uv; vec4 m = modelMatrix * vec4(position, 1.0); vMundo = m.xyz; gl_Position = projectionMatrix * viewMatrix * m; }`;
const FRAG_PROD = /* glsl */ `
  uniform sampler2D mapa; uniform float opacidad, barrido, anchoBarrido, luzBorde, exposicion;
  uniform vec3 tinte, colorBorde; uniform vec2 dirLuz; uniform float texel;
  varying vec2 vUv;
  void main(){
    vec4 c = texture2D(mapa, vUv);
    if (c.a < 0.004) discard;
    vec3 rgb = c.rgb * tinte * exposicion;
    // luz de borde: donde el alfa cae hacia el lado de la luz
    float aL = texture2D(mapa, vUv + dirLuz * texel * 6.0).a;
    float borde = clamp((c.a - aL) * 1.6, 0.0, 1.0) * luzBorde;
    rgb += colorBorde * borde;
    // barrido de brillo (un destello que cruza en diagonal)
    float d = (vUv.x + vUv.y * 0.55) - barrido;
    float b = exp(-d * d / (anchoBarrido * anchoBarrido)) * step(-1.0, barrido);
    rgb += vec3(1.0, 0.97, 0.9) * b * 0.55 * smoothstep(0.35, 1.0, dot(c.rgb, vec3(0.333)));
    gl_FragColor = vec4(rgb, c.a * opacidad);
  }`;

export function producto(motor, tex, med, { altoMundo = 4, anchoMundo = null, luzBorde = 0.12, colorBorde = '#fff2dc', ancla = 'apoyo' } = {}) {
  const k = anchoMundo ? anchoMundo / (med.caja[2] - med.caja[0]) : altoMundo / (med.caja[3] - med.caja[1]);   // mundo por px del @2x
  const w = med.w * k, h = med.h * k;
  const geo = new THREE.PlaneGeometry(w, h);
  // origen en la línea de apoyo (pie del vaso) o en el centro del plato (fotos cenitales)
  const ax = ancla === 'centro' ? (med.caja[0] + med.caja[2]) / 2 : med.apoyoX;
  const ay = ancla === 'centro' ? (med.caja[1] + med.caja[3]) / 2 : med.apoyo;
  geo.translate(w / 2 - ax * k, ay * k - h / 2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      mapa: { value: tex }, opacidad: { value: 1 }, barrido: { value: -2 }, anchoBarrido: { value: 0.07 },
      luzBorde: { value: luzBorde }, colorBorde: { value: col(colorBorde) }, tinte: { value: new THREE.Color(1, 1, 1) },
      dirLuz: { value: new THREE.Vector2(-0.6, 0.8) }, texel: { value: 1 / Math.max(med.w, med.h) }, exposicion: { value: 1 },
    },
    vertexShader: VERT_PROD, fragmentShader: FRAG_PROD, transparent: true, depthWrite: false,
  });
  const m = new THREE.Mesh(geo, mat);
  // alto/ancho del objeto (sin el aire del recorte) en el mundo
  m.userData = { k, w, h, med, anchoObj: (med.caja[2] - med.caja[0]) * k, altoObj: (med.caja[3] - med.caja[1]) * k };
  m.renderOrder = 2;
  return m;
}

// Orientación del producto respecto de la cámara.
//  frontal: mira a la cámara en Y y se inclina `inclina` (0..1) hacia ella.
//  cenital (fotos de plato desde arriba, tomadas a `angFoto` grados): el plano va casi acostado,
//  inclinado lo justo para que la elipse del plato coincida con la del podio vista desde la cámara.
const _v = new THREE.Vector3();
export function orientar(obj, camPos, { modo = 'frontal', inclina = 0.85, angFoto = 50 } = {}) {
  obj.updateMatrixWorld();
  const p = obj.getWorldPosition(_v.set(0, 0, 0));
  const dx = camPos.x - p.x, dy = camPos.y - p.y, dz = camPos.z - p.z;
  const ry = Math.atan2(dx, dz);
  const phi = Math.atan2(dy, Math.hypot(dx, dz));
  if (modo === 'cenital') {
    const s = Math.min(0.999, Math.sin(Math.max(phi, 0.05)) / Math.sin((angFoto * Math.PI) / 180));
    const beta = Math.asin(s) - phi;
    obj.rotation.set(-(Math.PI / 2 - beta), ry, 0, 'YXZ');
    return beta;
  }
  obj.rotation.set(-phi * inclina, ry, 0, 'YXZ');
  return Math.PI / 2 - phi;
}
export function mirarCamara(obj, camPos, inclina = 1) { return orientar(obj, camPos, { modo: 'frontal', inclina }); }

// ───────────────────────── letras ─────────────────────────
// Un texto como grupo de glifos (cada uno su plano), para animar letra por letra.
export function rotulo(motor, texto, { familia = FUENTE.display, peso = 500, estilo = 'italic', px = 200, tracking = 0,
  altoMundo = 1, color = '#f9f6ee', alinear = 'izq', sombra = 0 } = {}) {
  const at = atlasTexto(texto, { familia, peso, estilo, px, tracking });
  const tex = motor.texturaCanvas(at.canvas);
  const k = altoMundo / px;
  const grupo = new THREE.Group();
  const dx = alinear === 'centro' ? -at.ancho / 2 : alinear === 'der' ? -at.ancho : 0;
  const glifos = [];
  at.glifos.forEach((gl, i) => {
    if (!gl.ch.trim()) return;
    const geo = new THREE.PlaneGeometry(gl.ancho * k, gl.alto * k);
    const uv = geo.attributes.uv;
    for (let j = 0; j < uv.count; j++) uv.setXY(j, gl.uv[0] + uv.getX(j) * gl.uv[2], gl.uv[1] + uv.getY(j) * gl.uv[3]);
    // pivote en la base del glifo (para que suba desde su renglón)
    geo.translate(gl.ancho * k / 2, gl.alto * k / 2 - gl.base * k, 0);
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: col(color), transparent: true, depthWrite: false, toneMapped: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.x = (gl.x + dx) * k;
    m.renderOrder = 5;
    m.userData = { i, x0: m.position.x, avance: gl.avance * k };
    grupo.add(m);
    glifos.push(m);
  });
  grupo.userData = { glifos, ancho: at.ancho * k, alto: altoMundo, asc: at.asc * k, tex };
  return grupo;
}

// Anima la entrada de un rótulo: cada glifo sube desde abajo con giro leve; u en [0,1] por glifo.
export function animarRotulo(g, t, t0, { dur = 0.7, paso = 0.035, subir = 0.6, giro = 0.5, salida = null, salidaDur = 0.5 } = {}) {
  const gl = g.userData.glifos, n = gl.length;
  gl.forEach((m, i) => {
    const u = clamp((t - t0 - i * paso) / dur);
    const e = 1 - Math.pow(1 - u, 4);
    let a = clamp(u * 2.2), y = (1 - e) * -subir * g.userData.alto, rx = (1 - e) * giro;
    if (salida != null) {
      const v = clamp((t - salida - (n - 1 - i) * paso * 0.5) / salidaDur);
      const s = v * v * v;
      a *= 1 - s;
      y += s * subir * g.userData.alto * 0.8;
      rx -= s * giro;
    }
    m.position.y = y;
    m.rotation.x = rx;
    m.material.opacity = a;
    m.visible = a > 0.001;
  });
}

// Sello de precio (la flor con «S/ 12»), plano que entra girando como moneda.
export function sello(motor, precio, colores, tam = 1.6) {
  const tex = motor.texturaCanvas(selloPrecio(precio, colores));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  m.renderOrder = 6;
  return m;
}

// ───────────────────────── motivos de papel que flotan ─────────────────────────
const VERT_MOT = /* glsl */ `
  attribute vec4 rect; attribute float opac; attribute float desenf;
  varying vec2 vUv; varying float vOp; varying float vDes; varying vec2 vLoc;
  void main(){
    vUv = rect.xy + uv * rect.zw; vOp = opac; vDes = desenf; vLoc = uv;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  }`;
const FRAG_MOT = /* glsl */ `
  uniform sampler2D mapa; uniform vec3 papel; uniform float luz;
  varying vec2 vUv; varying float vOp; varying float vDes; varying vec2 vLoc;
  void main(){
    vec4 c = texture2D(mapa, vUv, min(vDes, 2.6));
    float e = min(min(vLoc.x, 1.0 - vLoc.x), min(vLoc.y, 1.0 - vLoc.y));
    c.a *= smoothstep(0.0, 0.16, e);
    if (c.a * vOp < 0.003) discard;
    vec3 rgb = gl_FrontFacing ? c.rgb : papel * 0.78;
    gl_FragColor = vec4(rgb * luz, c.a * vOp);
  }`;

export function motivosFlotantes(motor, atlasTex, lista, n, semilla, { escala = 1, filtro = null } = {}) {
  const r = azar(semilla);
  const pool = filtro ? lista.filter(filtro) : lista;
  const geo = new THREE.PlaneGeometry(1, 1);
  const rect = new Float32Array(n * 4), opac = new Float32Array(n), desenf = new Float32Array(n);
  const items = [];
  for (let i = 0; i < n; i++) {
    const m = r.elegir(pool);
    rect.set(m.uv, i * 4);
    opac[i] = 1;
    const asp = m.w / m.h;
    const s = escala * r.entre(0.6, 1.2) * Math.sqrt(m.area / 2500);
    items.push({ m, asp, s, sem: r() * 1000 });
  }
  geo.setAttribute('rect', new THREE.InstancedBufferAttribute(rect, 4));
  geo.setAttribute('opac', new THREE.InstancedBufferAttribute(opac, 1));
  geo.setAttribute('desenf', new THREE.InstancedBufferAttribute(desenf, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { mapa: { value: atlasTex }, papel: { value: col('#f4eedf') }, luz: { value: 1 } },
    vertexShader: VERT_MOT, fragmentShader: FRAG_MOT, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const im = new THREE.InstancedMesh(geo, mat, n);
  im.frustumCulled = false;
  im.renderOrder = 4;
  im.userData = { items };
  return im;
}

// ───────────────────────── polvo en la luz ─────────────────────────
const VERT_POLVO = /* glsl */ `
  attribute vec4 semilla; uniform float t; uniform float tam; uniform vec3 caja; uniform vec3 centro;
  varying float vA;
  void main(){
    vec3 p = centro + (semilla.xyz - 0.5) * caja;
    p.x += sin(t * 0.21 + semilla.w * 40.0) * 0.35 + t * 0.05;
    p.y += sin(t * 0.17 + semilla.w * 23.0) * 0.25 + t * 0.03;
    p.z += cos(t * 0.13 + semilla.w * 31.0) * 0.3;
    p = centro + mod(p - centro + caja * 0.5, caja) - caja * 0.5;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 0.55 + 0.45 * sin(t * 2.1 + semilla.w * 91.0);
    vA = tw;
    gl_PointSize = tam * (0.6 + semilla.w) / -mv.z;
  }`;
const FRAG_POLVO = /* glsl */ `
  uniform sampler2D mapa; uniform vec3 color; uniform float alfa; varying float vA;
  void main(){ float a = texture2D(mapa, gl_PointCoord).a; gl_FragColor = vec4(color * a * vA * alfa, 1.0); }`;

const VERT_POLVO_PER = /* glsl */ `
  attribute vec4 semilla; uniform float t; uniform float tam; uniform vec3 caja; uniform vec3 centro; uniform float per;
  varying float vA;
  void main(){
    float w = 6.2831853 / per;
    vec3 p = centro + (semilla.xyz - 0.5) * caja;
    p.x += sin(t * w * 2.0 + semilla.w * 40.0) * 0.9 + sin(t * w * 7.0 + semilla.y * 13.0) * 0.25;
    p.y += sin(t * w * 2.0 + semilla.w * 23.0) * 0.6 + cos(t * w * 5.0 + semilla.x * 17.0) * 0.2;
    p.z += cos(t * w * 1.0 + semilla.w * 31.0) * 0.5;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vA = 0.55 + 0.45 * sin(t * w * 20.0 + semilla.w * 91.0);
    gl_PointSize = tam * (0.6 + semilla.w) / -mv.z;
  }`;

export function polvo(motor, n, semilla, { centro = [0, 4, -4], caja = [12, 8, 10], color = '#ffe2b0', tam = 60, alfa = 0.6, periodo = 0 } = {}) {
  const r = azar(semilla);
  const s = new Float32Array(n * 4).map(() => r());
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('semilla', new THREE.BufferAttribute(s, 4));
  const tex = motor.texturaCanvas(discoSuave(64, 0.15));
  const mat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, tam: { value: tam * motor.dpr }, caja: { value: new THREE.Vector3(...caja) },
      centro: { value: new THREE.Vector3(...centro) }, mapa: { value: tex }, color: { value: col(color) }, alfa: { value: alfa },
      per: { value: periodo || 60 } },
    vertexShader: periodo ? VERT_POLVO_PER : VERT_POLVO, fragmentShader: FRAG_POLVO, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  p.renderOrder = 7;
  return p;
}

// Sombra de contacto (plano en el piso o en la tapa del podio)
let _texSombra = null;
export function sombraPlano(motor, ancho, fondo, opac = 0.5, color = '#000000') {
  if (!_texSombra) _texSombra = motor.texturaCanvas(sombraContacto(256), { srgb: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, fondo),
    new THREE.MeshBasicMaterial({ map: _texSombra, color: col(color), transparent: true, opacity: opac, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

// Haz de luz visible (cono abierto, suma de luz, se apaga hacia abajo y en los bordes)
const VERT_HAZ = /* glsl */ `varying float vY; varying vec3 vN; varying vec3 vV;
  void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const FRAG_HAZ = /* glsl */ `uniform vec3 color; uniform float alfa; varying float vY; varying vec3 vN; varying vec3 vV;
  void main(){ float f = pow(clamp(abs(dot(vN, vV)), 0.0, 1.0), 1.6); float a = f * pow(clamp(vY, 0.0, 1.0), 1.3) * alfa; gl_FragColor = vec4(color * a, 1.0); }`;
export function hazLuz(desde, hacia, radioArriba, radioAbajo, { color = '#ffe2b8', alfa = 0.08 } = {}) {
  const a = new THREE.Vector3(...desde), b = new THREE.Vector3(...hacia);
  const largo = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(radioArriba, radioAbajo, largo, 64, 1, true);
  const mat = new THREE.ShaderMaterial({ uniforms: { color: { value: col(color) }, alfa: { value: alfa } },
    vertexShader: VERT_HAZ, fragmentShader: FRAG_HAZ, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.clone().sub(b).normalize());
  m.renderOrder = 8;
  return m;
}

// Marco: rectángulo grande con un hueco rectangular (fachada con la boca del nicho).
export function geoMarco(ancho, alto, huecoAncho, huecoAlto, prof, y0 = 0) {
  const s = new THREE.Shape();
  s.moveTo(-ancho / 2, -alto / 2); s.lineTo(ancho / 2, -alto / 2); s.lineTo(ancho / 2, alto / 2); s.lineTo(-ancho / 2, alto / 2); s.lineTo(-ancho / 2, -alto / 2);
  const h = new THREE.Path();
  const hy0 = -y0 * 0, hb = 0, ht = huecoAlto;
  h.moveTo(-huecoAncho / 2, hb); h.lineTo(huecoAncho / 2, hb); h.lineTo(huecoAncho / 2, ht); h.lineTo(-huecoAncho / 2, ht); h.lineTo(-huecoAncho / 2, hb);
  s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth: prof, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3 });
  g.translate(0, alto / 2 - alto / 2, -prof / 2);
  return g;
}

// Motivos pintados (planos, sin vuelo) repartidos en una franja alrededor de un hueco
export function motivosPintados(motor, atlasTex, lista, semilla, { ancho, alto, y0 = 0, margen = 2.5, n = 40, escala = 0.0058 } = {}) {
  const r = azar(semilla);
  const pool = lista.filter((m) => m.area > 250);
  const geo = new THREE.PlaneGeometry(1, 1);
  const rect = new Float32Array(n * 4), opac = new Float32Array(n).fill(1), desenf = new Float32Array(n);
  const im = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
    uniforms: { mapa: { value: atlasTex }, papel: { value: col('#f4eedf') }, luz: { value: 0.95 } },
    vertexShader: VERT_MOT, fragmentShader: FRAG_MOT, transparent: true, depthWrite: false,
  }), n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    const m = r.elegir(pool);
    rect.set(m.uv, i * 4);
    // un punto en la franja: arriba, a los costados o abajo del hueco
    let x, y;
    const lado = r();
    if (lado < 0.45) { x = r.entre(-ancho / 2 - margen, ancho / 2 + margen); y = y0 + alto + r.entre(0.3, margen); }
    else if (lado < 0.75) { x = -ancho / 2 - r.entre(0.3, margen); y = r.entre(y0, y0 + alto + margen); }
    else { x = ancho / 2 + r.entre(0.3, margen); y = r.entre(y0, y0 + alto + margen); }
    const s = escala * r.entre(0.8, 1.25) * Math.sqrt(m.area / 2500) * 1.3;
    e.set(0, 0, r.entre(-0.8, 0.8));
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x, y, 0), q, new THREE.Vector3(s * m.w, s * m.h, 1));
    im.setMatrixAt(i, m4);
  }
  geo.setAttribute('rect', new THREE.InstancedBufferAttribute(rect, 4));
  geo.setAttribute('opac', new THREE.InstancedBufferAttribute(opac, 1));
  geo.setAttribute('desenf', new THREE.InstancedBufferAttribute(desenf, 1));
  im.frustumCulled = false;
  return im;
}

// Pedestal largo (para dos o tres productos): caja de bordes redondeados, banda pintada al frente,
// tapa crema y filete dorado.
export function pedestal(motor, { ancho = 14, alto = 1.2, fondo = 3.2, banda = null, tapa = '#e9dfcb', canto = '#c9a35a', rep = 3 } = {}) {
  const g = new THREE.Group();
  const r = 0.35;
  const s = new THREE.Shape();
  s.moveTo(-ancho / 2 + r, -fondo / 2);
  s.lineTo(ancho / 2 - r, -fondo / 2); s.quadraticCurveTo(ancho / 2, -fondo / 2, ancho / 2, -fondo / 2 + r);
  s.lineTo(ancho / 2, fondo / 2 - r); s.quadraticCurveTo(ancho / 2, fondo / 2, ancho / 2 - r, fondo / 2);
  s.lineTo(-ancho / 2 + r, fondo / 2); s.quadraticCurveTo(-ancho / 2, fondo / 2, -ancho / 2, fondo / 2 - r);
  s.lineTo(-ancho / 2, -fondo / 2 + r); s.quadraticCurveTo(-ancho / 2, -fondo / 2, -ancho / 2 + r, -fondo / 2);
  const geo = new THREE.ExtrudeGeometry(s, { depth: alto, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 10,
    UVGenerator: {
      generateTopUV: (gg, v, a, b, c) => [a, b, c].map((i) => new THREE.Vector2(v[i * 3] / ancho + 0.5, v[i * 3 + 1] / fondo + 0.5)),
      generateSideWallUV: (gg, v, a, b, c, d) => [a, b, c, d].map((i) => new THREE.Vector2((v[i * 3] / ancho + 0.5) * rep, v[i * 3 + 2] / alto)),
    } });
  geo.rotateX(-Math.PI / 2);               // la extrusión va hacia +y
  const lado = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, envMapIntensity: 0.35 });
  if (banda) { const b = banda.clone(); b.needsUpdate = true; b.wrapS = THREE.RepeatWrapping; lado.map = b; } else lado.color = col(tapa);
  const arriba = new THREE.MeshStandardMaterial({ color: col(tapa), roughness: 0.92, envMapIntensity: 0.35 });
  const m = new THREE.Mesh(geo, [arriba, lado]);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  const filete = new THREE.Mesh(new THREE.BoxGeometry(ancho - 0.3, 0.05, 0.05),
    new THREE.MeshStandardMaterial({ color: col(canto), roughness: 0.35, metalness: 0.7, envMapIntensity: 1.0 }));
  filete.position.set(0, alto + 0.01, fondo / 2 + 0.02);
  g.add(filete);
  g.userData = { alto, fondo, ancho };
  return g;
}

// Foto en un arco: marco crema extruido y la foto adentro (recortada con forma de arco), hundida.
export function fotoArco(motor, tex, med, { ancho = 4.4, alto = 5.8, marco = 0.32, prof = 0.45, foco = [0.5, 0.5], zoom = 1.0, colorMarco = '#f6f0e2' } = {}) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geoArco(ancho + 2 * marco, alto + marco, marco, prof, { bisel: 0.05 }),
    new THREE.MeshStandardMaterial({ color: col(colorMarco), roughness: 0.65, envMapIntensity: 0.5 }));
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  const asp = ancho / alto, aspF = med.w / med.h;
  // encuadre por cobertura con foco
  let du = 1, dv = 1;
  if (aspF > asp) du = asp / aspF; else dv = aspF / asp;
  du /= zoom; dv /= zoom;
  const u0 = Math.min(1 - du, Math.max(0, foco[0] - du / 2)), v0 = Math.min(1 - dv, Math.max(0, (1 - foco[1]) - dv / 2));
  const mat = new THREE.ShaderMaterial({
    uniforms: { mapa: { value: tex }, rect: { value: new THREE.Vector4(u0, v0, du, dv) }, asp: { value: asp }, luz: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D mapa; uniform vec4 rect; uniform float asp, luz; varying vec2 vUv;
      void main(){
        // forma de arco: rectángulo + medio círculo arriba
        vec2 p = vec2((vUv.x - 0.5) * asp, vUv.y);
        float r = 0.5 * asp; float yc = 1.0 - r;
        float dentro = p.y < yc ? step(abs(p.x), r) : step(length(vec2(p.x, p.y - yc)), r);
        if (dentro < 0.5) discard;
        vec3 c = texture2D(mapa, rect.xy + vUv * rect.zw).rgb;
        // sombra interior suave cerca del marco
        float dBorde = p.y < yc ? (r - abs(p.x)) : (r - length(vec2(p.x, p.y - yc)));
        dBorde = min(dBorde, p.y);
        c *= mix(0.55, 1.0, smoothstep(0.0, 0.12, dBorde)) * luz;
        // velo para el texto (abajo)
        c *= mix(0.45, 1.0, smoothstep(0.0, 0.45, vUv.y));
        // placa oscura redondeada detrás del nombre y el precio
        vec2 q = vec2((vUv.x - 0.5) * asp, vUv.y - 0.205);
        vec2 hq = vec2(0.42 * asp, 0.13);
        vec2 dq = abs(q) - hq + 0.06;
        float caja = length(max(dq, 0.0)) + min(max(dq.x, dq.y), 0.0) - 0.06;
        float placa = 1.0 - smoothstep(-0.006, 0.006, caja);
        c = mix(c, mix(c * 0.03, vec3(0.04, 0.016, 0.006), 0.7), placa * 0.95);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const foto = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), mat);
  foto.position.set(0, alto / 2, -prof * 0.3);
  g.add(foto);
  g.userData = { foto, marco: m };
  return g;
}

// Vapor: velos que suben (ruido) sobre una taza
export function vapor(ancho = 1.6, alto = 3.0, { alfa = 0.22 } = {}) {
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
        float v = fbm(vec2(x * 4.0, p.y * 3.0 - t * 1.1)) ;
        float a = tira * smoothstep(0.35, 0.8, v) * smoothstep(0.0, 0.18, p.y) * (1.0 - smoothstep(0.55, 1.0, p.y));
        gl_FragColor = vec4(vec3(1.0) * a * alfa, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), mat);
  m.renderOrder = 7;
  return m;
}

// Destellos (estrellas de 4 puntas que titilan) sobre un producto: n puntos en la parte alta del recorte.
const VERT_DES = /* glsl */ `
  attribute vec4 dato; uniform float t; uniform float tam; varying float vA; varying float vRot;
  void main(){
    float ciclo = fract((t + dato.w * 3.7) / 2.3);
    vA = pow(max(0.0, sin(ciclo * 3.14159)), 6.0);
    vRot = dato.w * 6.28 + t * 0.8;
    vec4 mv = modelViewMatrix * vec4(dato.xyz, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = tam * (0.6 + 0.8 * vA) / -mv.z;
  }`;
const FRAG_DES = /* glsl */ `
  uniform vec3 color; varying float vA; varying float vRot;
  void main(){
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vRot), s = sin(vRot);
    p = mat2(c, -s, s, c) * p;
    float rayo = max(exp(-abs(p.x) * 60.0) * exp(-abs(p.y) * 5.0), exp(-abs(p.y) * 60.0) * exp(-abs(p.x) * 5.0));
    float nucleo = exp(-dot(p, p) * 160.0);
    float a = (rayo * 0.9 + nucleo) * vA;
    gl_FragColor = vec4(color * a * 3.0, 1.0);
  }`;
export function destellos(motor, prod, n, semilla, { tam = 90, zona = [0.15, 0.85, 0.0, 0.45] } = {}) {
  const r = azar(semilla);
  const { w, h, k, med } = prod.userData;
  const dato = new Float32Array(n * 4);
  const geoPos = prod.geometry.attributes.position;
  // la geometría está corrida al ancla; uso la caja del objeto (px del @2x) para ubicar los puntos
  const ax = prod.geometry.boundingBox ? 0 : 0;
  prod.geometry.computeBoundingBox();
  const bb = prod.geometry.boundingBox;
  const [cx0, cy0, cx1, cy1] = med.caja || [0, 0, med.w, med.h];
  for (let i = 0; i < n; i++) {
    const u = r.entre(zona[0], zona[1]), v = r.entre(zona[2], zona[3]);
    const px = cx0 + (cx1 - cx0) * u, py = cy0 + (cy1 - cy0) * v;     // px desde arriba
    const x = bb.min.x + px * k, y = bb.max.y - py * k;
    dato.set([x, y, 0.02, r()], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('dato', new THREE.BufferAttribute(dato, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, tam: { value: tam * motor.dpr }, color: { value: col('#fff6e2') } },
    vertexShader: VERT_DES, fragmentShader: FRAG_DES, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 9;
  return pts;
}
