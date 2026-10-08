// Un nicho del retablo gigante: una sala de yeso de un color, con arcos, la flor en relieve, podios
// o pedestales pintados, los productos (fotos recortadas o fotos en arcos), sus nombres y precios,
// motivos de papel flotando, vapor y polvo en la luz. Cada nicho es su propia THREE.Scene (con sus
// luces), con origen en 0: las transiciones combinan nichos con la cámara o por composición.
import * as THREE from 'three';
import * as P from './piezas.js';
import { degradado, yesoNormal, bandaPintada } from './texturas.js';
import { azar, clamp, E, deriva, resorte } from './util.js';

const col = (h) => new THREE.Color(h);
let _yeso = null;

export const SALA = { ancho: 18, alto: 12, fondo: 14 };

const _cam = new THREE.PerspectiveCamera();
export function cuaternionVista(vista) {
  _cam.position.set(...vista.pos);
  _cam.up.set(0, 1, 0);
  _cam.lookAt(...vista.mira);
  return _cam.quaternion.clone();
}

export function crearNicho(motor, recursos, def) {
  const esc = new THREE.Scene();
  esc.environment = motor.entorno;
  esc.environmentIntensity = def.entorno ?? 0.42;
  const raiz = new THREE.Group();
  esc.add(raiz);
  const C = def.color;
  if (!_yeso) {
    _yeso = motor.texturaCanvas(yesoNormal(512, 11, 1.2), { srgb: false });
    _yeso.wrapS = _yeso.wrapT = THREE.RepeatWrapping;
  }
  const { ancho: AN, alto: AL, fondo: FO } = SALA;
  const yeso = (rx, ry) => { const y = _yeso.clone(); y.needsUpdate = true; y.repeat.set(rx, ry); return y; };

  // ── sala: pared del fondo, piso, costados, techo, fachada ──
  const gradPared = motor.texturaCanvas(degradado(C.claro, C.pared, C.hondo, 1024, def.luzPared || { cx: 0.6, cy: 0.42, r: 0.8 }));
  const pared = new THREE.Mesh(new THREE.PlaneGeometry(AN + 8, AL + 24), P.matYeso(motor, '#ffffff', { mapa: gradPared, normal: yeso(5, 3.5) }));
  pared.position.set(0, AL / 2 - 1, -FO);
  pared.geometry.translate(0, 0, 0);
  pared.receiveShadow = true;
  raiz.add(pared);
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(AN + 8, FO + 30), P.matYeso(motor, C.piso, { normal: yeso(6, 10), rugosidad: 0.7 }));
  piso.material.side = THREE.DoubleSide;
  piso.rotation.x = -Math.PI / 2;
  piso.position.set(0, 0, -FO / 2 + 13);
  piso.receiveShadow = true;
  raiz.add(piso);
  for (const s of [-1, 1]) {
    const lado = new THREE.Mesh(new THREE.PlaneGeometry(FO + 26, AL + 24), P.matYeso(motor, C.lado || C.pared, { normal: yeso(10, 4) }));
    lado.rotation.y = -s * Math.PI / 2;
    lado.position.set(s * (AN / 2 + 3), AL / 2 - 1, -FO / 2 + 11);
    lado.receiveShadow = true;
    raiz.add(lado);
  }
  const techo = new THREE.Mesh(new THREE.PlaneGeometry(AN + 8, FO + 30), P.matYeso(motor, C.hondo, { normal: yeso(6, 10) }));
  techo.material.side = THREE.DoubleSide;
  techo.rotation.x = Math.PI / 2;
  techo.position.set(0, AL + 9, -FO / 2 + 13);
  raiz.add(techo);
  if (def.fachada !== false) {
    const fz = def.fachadaZ ?? 26;
    const fach = new THREE.Mesh(P.geoMarco(AN + 80, AL + 80, AN + 6, AL + 2, 0.8),
      new THREE.MeshStandardMaterial({ color: col('#f1e9d6'), roughness: 0.8, envMapIntensity: 0.4, normalMap: yeso(16, 16), normalScale: new THREE.Vector2(0.25, 0.25) }));
    fach.position.set(0, -1.0, fz);
    raiz.add(fach);
    const pint = P.motivosPintados(motor, recursos.atlasMotivos, window.MOTIVOS.lista, (def.motivos?.semilla ?? 5) + 300,
      { ancho: AN + 6, alto: AL + 1, y0: -1.0, margen: 3.2, n: 60, escala: 0.0075 });
    pint.position.set(0, 0, fz + 0.45);
    raiz.add(pint);
  }

  // ── luces ──
  esc.add(new THREE.HemisphereLight(col('#fff1dc'), col(C.hondo), def.luz?.cielo ?? 0.48));
  const clave = new THREE.SpotLight(col(def.luz?.colorClave || '#ffe3bd'), def.luz?.clave ?? 1.45, 0, Math.PI / 6.2, 1.0, 0);
  const lc = def.luz?.desde || [-6, 15, 5];
  const la = def.luz?.hacia || [1.5, 0.5, -5];
  clave.position.set(...lc);
  clave.target.position.set(...la);
  clave.castShadow = true;
  clave.shadow.mapSize.set(2048, 2048);
  clave.shadow.radius = 8;
  clave.shadow.blurSamples = 16;
  clave.shadow.bias = -0.0005;
  clave.shadow.normalBias = 0.02;
  clave.shadow.camera.near = 5;
  clave.shadow.camera.far = 50;
  esc.add(clave, clave.target);
  const contra = new THREE.DirectionalLight(col(def.luz?.colorContra || C.acento || '#ffffff'), def.luz?.contra ?? 0.55);
  contra.position.set(7, 9, -16);
  contra.target.position.set(0, 1, -3);
  esc.add(contra, contra.target);
  const relleno = new THREE.DirectionalLight(col('#fff6ea'), def.luz?.relleno ?? 0.3);
  relleno.position.set(9, 5, 12);
  esc.add(relleno);
  if (def.haz !== false) raiz.add(P.hazLuz([lc[0] + 0.6, lc[1] - 1, lc[2] - 0.4], [la[0], la[1] - 0.5, la[2]], 0.5, 4.6, { alfa: def.hazAlfa ?? 0.06 }));

  // ── la flor en relieve (detrás) ──
  let flor = null;
  if (def.flor !== false) {
    flor = P.florRelieve(def.flor?.R ?? 4.2, def.flor?.colores ?? [C.claro, C.pared, C.hondo]);
    flor.position.set(...(def.flor?.pos ?? [0, 5.5, -FO + 0.35]));
    raiz.add(flor);
  }

  // ── arcos ──
  const arcos = [];
  for (const a of def.arcos || []) {
    const m = new THREE.Mesh(P.geoArco(a.ancho, a.alto, a.grosor ?? 0.55, a.prof ?? 0.7),
      new THREE.MeshStandardMaterial({ color: col(a.color || '#f6f0e2'), roughness: 0.72, envMapIntensity: 0.4 }));
    m.position.set(...a.pos);
    if (a.rotY) m.rotation.y = a.rotY;
    m.castShadow = m.receiveShadow = true;
    raiz.add(m);
    arcos.push(m);
  }
  // ── pedestales ──
  for (const pe of def.pedestales || []) {
    const m = P.pedestal(motor, { ancho: pe.ancho, alto: pe.alto, fondo: pe.fondo, banda: recursos.banda, rep: pe.rep ?? 3, tapa: pe.tapa });
    m.position.set(...pe.pos);
    raiz.add(m);
  }
  // ── fotos en arcos ──
  const fotos = [];
  for (const f of def.fotos || []) {
    const g = P.fotoArco(motor, recursos.tex[f.slug], f.med, { ancho: f.ancho, alto: f.alto, foco: f.foco, zoom: f.zoom ?? 1 });
    const piv = new THREE.Group();
    piv.position.set(...f.pos);
    piv.add(g);
    raiz.add(piv);
    fotos.push({ def: f, piv, g });
  }

  // ── productos ──
  const prods = [];
  for (const pd of def.productos || []) {
    const g = new THREE.Group();
    g.position.set(...pd.pos);
    raiz.add(g);
    let hp = pd.base ?? 0;
    if (pd.podio) {
      const po = P.podio(motor, { radio: pd.podio.radio, alto: pd.podio.alto, banda: pd.podio.banda === false ? null : recursos.banda,
        tapa: pd.podio.tapa, rep: pd.podio.rep ?? 2 });
      g.add(po);
      hp = pd.podio.alto;
    }
    const flota = pd.modo === 'flotante';
    const prod = P.producto(motor, recursos.tex[pd.slug], pd.med, {
      altoMundo: pd.alto, anchoMundo: pd.ancho, luzBorde: pd.luzBorde ?? 0.1, ancla: flota ? 'centro' : 'apoyo' });
    const piv = new THREE.Group();
    piv.position.set(0, hp + (flota ? (pd.elevar ?? 1.8) : 0), pd.adelante ?? 0);
    const anim = new THREE.Group();
    anim.add(prod);
    piv.add(anim);
    g.add(piv);
    const so = P.sombraPlano(motor, pd.sombra?.[0] ?? prod.userData.anchoObj * 0.95, pd.sombra?.[1] ?? prod.userData.anchoObj * 0.42,
      pd.sombra?.[2] ?? 0.5, C.hondo);
    so.position.set(pd.sombra?.[3] ?? 0, hp + 0.012, (pd.adelante ?? 0) + (pd.sombra?.[4] ?? 0));
    g.add(so);
    let vap = null;
    if (pd.vapor) {
      vap = P.vapor(pd.vapor[0], pd.vapor[1], { alfa: pd.vapor[4] ?? 0.2 });
      vap.position.set(pd.vapor[2] ?? 0, hp + pd.vapor[3], (pd.adelante ?? 0) - 0.05);
      g.add(vap);
    }
    let des = null;
    if (pd.destellos) {
      des = P.destellos(motor, prod, pd.destellos, (def.motivos?.semilla ?? 5) * 13 + prods.length, { zona: pd.zonaDestellos });
      anim.add(des);
    }
    prods.push({ def: pd, grupo: g, piv, anim, prod, sombra: so, vap, flota, des });
  }

  // ── textos y sellos (miran a la cámara) ──
  const textos = [];
  for (const tx of def.textos || []) {
    const r = P.rotulo(motor, tx.texto, tx.estilo);
    const ancla = new THREE.Group();
    ancla.position.set(...tx.pos);
    ancla.add(r);
    raiz.add(ancla);
    textos.push({ def: tx, g: r, ancla });
  }
  const sellos = [];
  for (const s of def.sellos || []) {
    const m = P.sello(motor, s.precio, s.colores, s.tam);
    const ancla = new THREE.Group();
    ancla.position.set(...s.pos);
    ancla.add(m);
    raiz.add(ancla);
    sellos.push({ def: s, m, ancla });
  }

  // ── motivos de papel flotando, fuera de las zonas reservadas ──
  const nMot = def.motivos?.n ?? 30;
  const mot = P.motivosFlotantes(motor, recursos.atlasMotivos, window.MOTIVOS.lista, nMot, def.motivos?.semilla ?? 5,
    { escala: def.motivos?.escala ?? 0.0055 });
  raiz.add(mot);
  const rm = azar((def.motivos?.semilla ?? 5) + 99);
  const vistaRef = def.camara(def.dur * 0.5);
  const camRef = new THREE.PerspectiveCamera(vistaRef.fov || 30, 16 / 9, 0.05, 400);
  camRef.position.set(...vistaRef.pos); camRef.lookAt(...vistaRef.mira); camRef.updateMatrixWorld(); camRef.updateProjectionMatrix();
  const reservas = def.reservas || [];
  const lugares = mot.userData.items.map(() => {
    let l;
    for (let intento = 0; intento < 60; intento++) {
      const cerca = rm() < (def.motivos?.cerca ?? 0.16);
      l = {
        x: rm.entre(-AN / 2 - 1, AN / 2 + 1), y: rm.entre(0.4, AL - 0.5), z: cerca ? rm.entre(0, 5) : rm.entre(-FO + 1.5, -2.5),
        giro: rm.entre(0, 6.28), velGiro: rm.entre(-0.45, 0.45), bal: rm.entre(0.25, 0.55), fase: rm.entre(0, 6.28), cerca,
      };
      const v = new THREE.Vector3(l.x, l.y, l.z).project(camRef);
      const sx = v.x * 0.5 + 0.5, sy = 0.5 - v.y * 0.5;
      const enPantalla = sx > 0.0 && sx < 1.0 && sy > 0.0 && sy < 1.0;
      const libre = !reservas.some(([x0, y0, x1, y1]) => sx > x0 - 0.05 && sx < x1 + 0.05 && sy > y0 - 0.05 && sy < y1 + 0.05);
      const borde = !cerca || sx < 0.12 || sx > 0.88 || sy < 0.1 || sy > 0.9;
      l.ok = libre && borde && enPantalla;
      if (l.ok) break;
    }
    return l;
  });

  const pol = P.polvo(motor, def.polvo ?? 160, (def.motivos?.semilla ?? 5) + 7, { centro: [1, 4.5, -3], caja: [16, 9, 12], alfa: def.polvoAlfa ?? 0.45 });
  esc.add(pol);

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const _cp = new THREE.Vector3();
  function actualizar(t, cam, vista) {
    const tl = t - def.t0;
    const camPos = _cp.set(...vista.pos);
    const qv = cuaternionVista(vista);
    if (flor) flor.rotation.z = -t * 0.06;
    const its = mot.userData.items, des = mot.geometry.attributes.desenf, op = mot.geometry.attributes.opac;
    its.forEach((it, i) => {
      const l = lugares[i];
      _p.set(l.x + deriva(t, i, 0.05) * 0.5, l.y + deriva(t + 7, i, 0.06) * 0.45 + Math.sin(t * 0.55 + l.fase) * 0.1, l.z + deriva(t + 3, i, 0.04) * 0.3);
      _e.set(Math.sin(t * l.bal + l.fase) * 0.45, Math.cos(t * l.bal * 0.8 + l.fase) * 0.55, l.giro + t * l.velGiro);
      _q.setFromEuler(_e);
      const k = l.cerca ? 0.8 : 1;
      _s.set(it.s * it.m.w * k, it.s * it.m.h * k, 1);
      _m.compose(_p, _q, _s);
      mot.setMatrixAt(i, _m);
      const d = Math.abs(_p.distanceTo(camPos) - (vista.foco || 12));
      des.setX(i, clamp(d * 0.42, 0, 5.5));
      op.setX(i, l.ok ? 1 : 0);
    });
    mot.instanceMatrix.needsUpdate = true;
    des.needsUpdate = true;
    op.needsUpdate = true;
    pol.material.uniforms.t.value = t;
    prods.forEach((p, i) => {
      P.orientar(p.piv, camPos, { modo: 'frontal', inclina: p.flota ? 1 : (p.def.inclina ?? 0.85) });
      entrada(p, tl, t, i);
      p.prod.material.uniforms.barrido.value = def.barrido ? def.barrido(tl, i) : -0.6 + (tl - 1.25 - i * 0.25) * 1.15;
      if (p.vap) { p.vap.material.uniforms.t.value = t; p.vap.quaternion.copy(qv); }
      if (p.des) { p.des.material.uniforms.t.value = t; p.des.visible = p.prod.visible && tl > (p.def.tEntrada ?? def.tEntrada ?? 0) + 0.6; }
    });
    fotos.forEach((f, i) => entradaFoto(f, tl, t, i));
    textos.forEach((tx) => {
      tx.ancla.quaternion.copy(qv);
      P.animarRotulo(tx.g, tl, tx.def.t ?? 0.3, tx.def.anim || {});
    });
    sellos.forEach((s) => {
      s.ancla.quaternion.copy(qv);
      const u = clamp((tl - (s.def.t ?? 0.6)) / 0.85);
      const e = E.outBack(u, 1.7);
      s.m.scale.setScalar(Math.max(0.001, e));
      s.m.rotation.y = (1 - E.outCubic(u)) * Math.PI * 1.5;
      s.m.rotation.z = Math.sin(t * 1.3) * 0.05 * u;
      s.m.material.opacity = clamp(u * 3);
      s.m.visible = u > 0;
    });
    if (def.extra) def.extra(tl, t, vista);
  }

  // Entradas de producto: baja (cae con rebote), sube, pop (crece), gira (da la vuelta)
  function entrada(p, tl, t, i) {
    const tipo = p.def.entrada || def.entrada || 'baja';
    const t0 = (p.def.tEntrada ?? def.tEntrada ?? -0.05) + i * (def.escalon ?? 0.14);
    const u = clamp((tl - t0) / 0.75);
    const a = p.anim;
    a.position.set(0, 0, 0);
    a.rotation.set(0, 0, 0);
    a.scale.setScalar(1);
    let vis = 1;
    if (tipo === 'baja') {
      const e = resorte(u, 1.3, 6.5);
      a.position.y = (1 - e) * 4.5;
      vis = clamp(u * 6);
      a.scale.set(1 - (1 - e) * 0.08, 1 + (1 - e) * 0.08, 1);
    } else if (tipo === 'sube') {
      const e = E.outBack(u, 1.4);
      a.position.y = (e - 1) * 2.5;
      vis = clamp(u * 4);
    } else if (tipo === 'pop') {
      const e = E.outBack(u, 2.2);
      a.scale.setScalar(Math.max(0.001, 0.2 + 0.8 * e));
      vis = clamp(u * 5);
    } else if (tipo === 'gira') {
      const e = E.outCubic(u);
      a.rotation.y = (1 - e) * Math.PI * 0.5;
      a.scale.setScalar(0.85 + 0.15 * E.outBack(u, 1.6));
      vis = clamp(u * 4);
    }
    if (p.flota && u > 0) {
      const w = clamp((tl - t0 - 0.5) / 0.6);
      a.position.y += Math.sin(t * 1.25 + i * 1.9) * 0.12 * w;
      a.rotation.z += Math.sin(t * 0.9 + i) * 0.025 * w;
    }
    p.prod.material.uniforms.opacidad.value = vis;
    p.prod.visible = vis > 0.001;
    p.sombra.material.opacity = (p.def.sombra?.[2] ?? 0.5) * clamp(u * 3) * (p.flota ? 1 - Math.sin(t * 1.25 + i * 1.9) * 0.08 : 1);
    if (p.vap) p.vap.visible = u > 0.5;
  }
  function entradaFoto(f, tl, t, i) {
    const t0 = (def.tEntrada ?? -0.05) + i * (def.escalon ?? 0.14);
    const u = clamp((tl - t0) / 0.8);
    const e = E.outBack(u, 1.5);
    f.piv.scale.setScalar(Math.max(0.001, 0.6 + 0.4 * e));
    f.piv.position.y = f.def.pos[1] + (1 - E.outCubic(u)) * -1.5;
    f.piv.visible = u > 0;
  }

  return { def, escena: esc, raiz, actualizar, prods, textos, sellos, arcos, flor, fotos };
}

export function recursosNicho(motor, atlasImg) {
  const banda = motor.texturaCanvas(bandaPintada(atlasImg, window.MOTIVOS, { ancho: 4096, alto: 640 }));
  banda.wrapS = THREE.RepeatWrapping;
  return { banda };
}
