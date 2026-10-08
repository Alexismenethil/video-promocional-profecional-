// El retablo de la marca en 3D (de las fotos del repo): caja crema, frontón pintado y dos puertas
// con bisagras. Vive en un salón verde retablo de noche, sobre su podio, con luz cálida, bokeh,
// motivos de papel y polvo. Su fondo es un portal: adentro está el primer nicho de la carta.
// También trae la firma (logo) que se deshace en polvo dorado y entra por la ranura de las puertas.
import * as THREE from 'three';
import * as P from './piezas.js';
import { logoCanvas, degradado, discoSuave, lienzo, FUENTE, dibujarFlor, yesoNormal } from './texturas.js';
import { polvoLogo, puntosDeCanvas } from './particulas.js';
import { azar, clamp, E, prog, lerp, vaiven, deriva, vueltas } from './util.js';

const PER = (window.CUES && window.CUES.dur) || 60;   // el salón del retablo se ve en el cruce del bucle: todo da vueltas enteras

const col = (h) => new THREE.Color(h);
// Medidas (1 unidad = 100 px de la foto del retablo)
export const RET = { W: 5.96, H: 6.33, D: 2.6, HP: 2.93, t: 0.14, td: 0.1, base: 0.9 };

export function crearRetablo(motor, recursos) {
  const esc = new THREE.Scene();
  esc.background = col('#041a13');
  esc.fog = new THREE.Fog(col('#0e3d2d'), 24, 58);
  esc.environment = motor.entorno;
  esc.environmentIntensity = 0.3;
  const { W, H, D, HP, t: T, td } = RET;
  const VERDE = '#0d3b2b', CREMA = '#f9f6ee';

  // ── salón: fondo curvo verde con halo detrás del retablo, piso oscuro ──
  const fondoTex = motor.texturaCanvas(degradado('#1d5a45', '#0d3b2b', '#03140e', 1024, { cx: 0.42, cy: 0.5, r: 0.62 }));
  const fondo = new THREE.Mesh(new THREE.CylinderGeometry(42, 42, 60, 96, 1, true, Math.PI * 0.62, Math.PI * 0.76),
    new THREE.MeshBasicMaterial({ map: fondoTex, side: THREE.BackSide, toneMapped: false, fog: false }));
  fondo.position.set(0, 14, 6);
  esc.add(fondo);
  const yeso = motor.texturaCanvas(yesoNormal(512, 5, 1.0), { srgb: false });
  yeso.wrapS = yeso.wrapT = THREE.RepeatWrapping;
  yeso.repeat.set(10, 10);
  const piso = new THREE.Mesh(new THREE.CircleGeometry(60, 96), new THREE.MeshStandardMaterial({
    color: col('#0b3a27'), roughness: 0.55, metalness: 0.0, envMapIntensity: 0.04, normalMap: yeso, normalScale: new THREE.Vector2(0.3, 0.3) }));
  piso.rotation.x = -Math.PI / 2;
  piso.receiveShadow = true;
  esc.add(piso);

  // bokeh: luces lejanas fuera de foco (cálidas, coral, turquesa)
  const rb = azar(31);
  const nB = 70;
  const bok = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: { mapa: { value: motor.texturaCanvas(discoSuave(128, 0.62)) }, alfa: { value: 1 } },
    vertexShader: `attribute vec3 tinte; varying vec2 vUv; varying vec3 vT;
      void main(){ vUv = uv; vT = tinte; vec4 c = viewMatrix * modelMatrix * instanceMatrix * vec4(0,0,0,1);
        vec2 s = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
        c.xy += position.xy * s; gl_Position = projectionMatrix * c; }`,
    fragmentShader: `uniform sampler2D mapa; uniform float alfa; varying vec2 vUv; varying vec3 vT;
      void main(){ float a = texture2D(mapa, vUv).a; gl_FragColor = vec4(vT * a * alfa, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }), nB);
  const tintes = new Float32Array(nB * 3);
  const bokD = [];
  const paleta = [[1.0, 0.78, 0.45], [1.0, 0.62, 0.45], [0.42, 0.8, 0.85], [1.0, 0.9, 0.7]];
  for (let i = 0; i < nB; i++) {
    const c = rb.elegir(paleta), k = rb.entre(0.04, 0.13);
    tintes.set([c[0] * k, c[1] * k, c[2] * k], i * 3);
    bokD.push({ x: rb.entre(-34, 34), y: rb.entre(-2, 22), z: rb.entre(-34, -14), s: rb.entre(1.2, 3.6), f: rb() * 6.28 });
  }
  bok.geometry.setAttribute('tinte', new THREE.InstancedBufferAttribute(tintes, 3));
  bok.frustumCulled = false;
  bok.renderOrder = 0;
  esc.add(bok);

  // ── podio del retablo ──
  const podio = P.podio(motor, { radio: 4.4, alto: RET.base, banda: recursos.banda, rep: 3 });
  esc.add(podio);

  // ── el retablo ──
  const ret = new THREE.Group();
  ret.position.y = RET.base;
  esc.add(ret);
  const crema = new THREE.MeshStandardMaterial({ color: col('#efe8d6'), roughness: 0.78, envMapIntensity: 0.5, normalMap: yeso, normalScale: new THREE.Vector2(0.15, 0.15) });
  const cremaIn = new THREE.MeshStandardMaterial({ color: col('#efe5cf'), roughness: 0.85, envMapIntensity: 0.6, emissive: col('#ffcf8a'), emissiveIntensity: 0 });
  const tabla = (w, h, d, x, y, z, m = crema) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    b.castShadow = b.receiveShadow = true;
    ret.add(b);
    return b;
  };
  tabla(W, H, T, 0, H / 2, -D / 2 + T / 2, cremaIn);                 // fondo (detrás del portal)
  tabla(T, H, D, -W / 2 + T / 2, H / 2, 0);                           // costados
  tabla(T, H, D, W / 2 - T / 2, H / 2, 0);
  tabla(W, T, D, 0, H - T / 2, 0);                                     // techo de la caja
  tabla(W, T, D, 0, T / 2, 0);                                         // piso de la caja
  // frontón: prisma triangular con la cara pintada
  const tri = new THREE.Shape();
  const bw = W + 0.04;
  tri.moveTo(-bw / 2, 0); tri.lineTo(bw / 2, 0); tri.lineTo(0, HP); tri.lineTo(-bw / 2, 0);
  const uvTri = {
    generateTopUV: (g, v, a, b, c) => [a, b, c].map((i) => new THREE.Vector2((v[i * 3] + bw / 2) / bw * 0.994 + 0.003, v[i * 3 + 1] / HP * 0.985)),
    generateSideWallUV: (g, v, a, b, c, d) => [a, b, c, d].map(() => new THREE.Vector2(0.5, 0.5)),
  };
  const frontonTex = recursos.frontonTex;
  const geoF = new THREE.ExtrudeGeometry(tri, { depth: D + 0.06, bevelEnabled: false, UVGenerator: uvTri });
  geoF.translate(0, 0, -D / 2 - 0.03);
  const fronton = new THREE.Mesh(geoF, [new THREE.MeshStandardMaterial({ map: frontonTex, roughness: 0.78, envMapIntensity: 0.45, alphaTest: 0.5 }), crema]);
  fronton.position.y = H;
  fronton.castShadow = fronton.receiveShadow = true;
  ret.add(fronton);
  // puertas con bisagra en los cantos
  const wd = W / 2 - 0.012;
  const puertas = [];
  for (const lado of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(lado * W / 2, H / 2, D / 2 + td / 2);
    ret.add(piv);
    const mats = [crema, crema, crema, crema,
      new THREE.MeshStandardMaterial({ map: lado < 0 ? recursos.puertaIzq : recursos.puertaDer, roughness: 0.75, envMapIntensity: 0.45 }),
      new THREE.MeshStandardMaterial({ map: lado < 0 ? recursos.dorsoIzq : recursos.dorsoDer, roughness: 0.75, envMapIntensity: 0.45 })];
    const m = new THREE.Mesh(new THREE.BoxGeometry(wd, H - 0.02, td), mats);
    m.position.x = -lado * wd / 2;
    m.castShadow = m.receiveShadow = true;
    piv.add(m);
    // bisagras de bronce
    for (const yb of [-H / 2 + 1.0, H / 2 - 1.0]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 16),
        new THREE.MeshStandardMaterial({ color: col('#b88d4a'), roughness: 0.35, metalness: 0.85, envMapIntensity: 1 }));
      b.position.set(lado * 0.02, yb, 0);
      ret.add(b);
      b.position.add(piv.position);
    }
    puertas.push({ lado, piv, m });
  }

  // ── portal: el fondo de la caja muestra el primer (o último) nicho ──
  const portalMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: null }, res: { value: new THREE.Vector2(motor.pw, motor.ph) }, destello: { value: 0 }, activo: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D t; uniform vec2 res; uniform float destello, activo; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(t, gl_FragCoord.xy / res).rgb * activo;
        vec2 q = vUv - 0.5; float bord = smoothstep(0.5, 0.36, max(abs(q.x), abs(q.y)));
        c += vec3(1.0, 0.86, 0.6) * destello * (0.6 + 0.4 * bord);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(W - 2 * T, H - 2 * T), portalMat);
  portal.position.set(0, H / 2, D / 2 - 0.02);
  ret.add(portal);
  // luz de adentro (se enciende al abrir)
  const luzIn = new THREE.PointLight(col('#ffd9a0'), 0, 12, 1.2);
  luzIn.position.set(0, H / 2, -D / 2 + 0.6);
  ret.add(luzIn);

  // ── ranura de luz entre las puertas y rayos ──
  const ranura = new THREE.Mesh(new THREE.PlaneGeometry(0.05, H - 0.3), new THREE.MeshBasicMaterial({ color: col('#fff1cf'), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  ranura.position.set(0, H / 2, D / 2 + td + 0.012);
  ret.add(ranura);
  const rayoTex = (() => {
    const c = lienzo(64, 512), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 512, 0, 0);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 512);
    const g2 = g.createLinearGradient(0, 0, 64, 0);
    g.globalCompositeOperation = 'destination-in';
    g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(0.5, 'rgba(0,0,0,1)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = g2; g.fillRect(0, 0, 64, 512);
    return motor.texturaCanvas(c);
  })();
  const rayos = new THREE.Group();
  rayos.position.set(0, H / 2, D / 2 + td + 0.05);
  ret.add(rayos);
  const rr = azar(12);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rr.entre(-0.1, 0.1);
    const largo = rr.entre(4, 11), ancho = rr.entre(0.25, 0.9);
    const g = new THREE.PlaneGeometry(ancho, largo);
    g.translate(0, largo / 2, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: rayoTex, color: col('#ffe3b0'), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.rotation.z = a;
    m.userData = { a, largo, f: rr() * 6.28, peso: rr.entre(0.4, 1) };
    m.renderOrder = 10;
    rayos.add(m);
  }

  // ── la firma: logo con flor y bajada ──
  const firma = crearFirma(motor);
  const grupoFirma = new THREE.Group();
  esc.add(grupoFirma);
  grupoFirma.add(firma.malla);
  const polvo = polvoLogo(motor, firma.puntos, { n: 11000, tam: 30, brillo: 2.4 });
  grupoFirma.add(polvo);

  // ── motivos de papel flotando en el salón ──
  const mot = P.motivosFlotantes(motor, recursos.atlasMotivos, window.MOTIVOS.lista, 40, 61, { escala: 0.0062 });
  esc.add(mot);
  const rm = azar(62);
  const lug = mot.userData.items.map(() => ({
    x: rm.entre(-16, 16), y: rm.entre(0.5, 13), z: rm.entre(-14, 6), fase: rm() * 6.28, bal: rm.entre(0.2, 0.5), giro: rm() * 6.28, vg: rm.entre(-0.4, 0.4),
  }));
  lug.forEach((l) => {
    if (Math.abs(l.x) < 6 && l.z > -4) l.z = -4 - rm() * 8;                       // ni delante del retablo
    if (l.x > 0 && l.x < 12 && l.z > -9) { l.x = rm() < 0.5 ? rm.entre(12, 17) : rm.entre(-16, -7); }   // ni sobre la firma
  });
  // motivos del estallido al abrir: salen de la caja hacia la cámara
  const nE = 90;
  const est = P.motivosFlotantes(motor, recursos.atlasMotivos, window.MOTIVOS.lista, nE, 77, { escala: 0.0068 });
  ret.add(est);
  const re = azar(78);
  const vel = est.userData.items.map(() => {
    const a = re.entre(0, Math.PI * 2), r = Math.sqrt(re());
    return { v: [Math.cos(a) * r * re.entre(3, 9), Math.sin(a) * r * re.entre(2, 7) + 1.2, re.entre(7, 19)],
      p0: [re.entre(-1.6, 1.6), re.entre(1.2, H - 1.2), D / 2 + re.entre(0.1, 0.6)], giro: [re.entre(-6, 6), re.entre(-6, 6), re.entre(-6, 6)], ret: re.entre(0, 0.18) };
  });

  // ── luces ──
  esc.add(new THREE.HemisphereLight(col('#ffecd2'), col('#06231a'), 0.2));
  const clave = new THREE.SpotLight(col('#ffe1b8'), 2.2, 0, Math.PI / 7.5, 0.75, 0);
  clave.castShadow = true;
  clave.shadow.mapSize.set(2048, 2048);
  clave.shadow.radius = 7;
  clave.shadow.blurSamples = 16;
  clave.shadow.bias = -0.0005;
  clave.shadow.normalBias = 0.02;
  clave.shadow.camera.near = 6; clave.shadow.camera.far = 60;
  esc.add(clave, clave.target);
  const contra = new THREE.SpotLight(col('#7fd0de'), 1.6, 0, Math.PI / 6, 0.9, 0);
  esc.add(contra, contra.target);
  const relleno = new THREE.DirectionalLight(col('#fff3e2'), 0.25);
  relleno.position.set(10, 6, 16);
  esc.add(relleno);
  const haz = P.hazLuz([-7, 22, 6], [0, 0.9, 0], 0.6, 6.5, { alfa: 0.06 });
  esc.add(haz);
  const pol = P.polvo(motor, 260, 41, { centro: [0, 6, 0], caja: [22, 13, 16], alfa: 0.5, tam: 55, periodo: PER });
  esc.add(pol);

  // ═════════ estado en el tiempo ═════════
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  // e = {x, rotY, puerta (0..1 abierta), ranura (0..), rayos (0..), destello, luzIn, firmaU (0 entera → 1 deshecha), brilloFirma, estallido (s desde que abre), golpe}
  function actualizar(t, vista, e) {
    ret.position.x = e.x;
    ret.rotation.y = e.rotY;
    ret.position.y = RET.base + (e.salto || 0);
    podio.position.x = e.x;
    podio.rotation.y = e.rotY;
    const ang = e.puerta * Math.PI * 0.86;
    puertas[0].piv.rotation.y = -ang + (e.tiembla || 0);
    puertas[1].piv.rotation.y = ang - (e.tiembla || 0);
    ranura.material.color.setRGB(1, 0.92, 0.75).multiplyScalar(e.ranura * 6);
    ranura.visible = e.ranura > 0.001 && e.puerta < 0.06;
    ranura.scale.x = 1 + e.ranura * 0.8;
    rayos.children.forEach((m) => {
      const u = m.userData;
      const pulso = 0.75 + 0.25 * Math.sin(t * 2.4 + u.f);
      m.material.opacity = clamp(e.rayos * u.peso * pulso, 0, 1.5);
      m.scale.set(1 + e.rayos * 0.4, 0.4 + e.rayos * 0.9, 1);
      m.visible = e.rayos > 0.002;
    });
    rayos.quaternion.copy(ret.quaternion).invert().multiply(qVista(vista));
    luzIn.intensity = e.luzIn;
    cremaIn.emissiveIntensity = Math.min(0.55, e.luzIn * 0.06);
    portalMat.uniforms.destello.value = e.destello;
    portalMat.uniforms.activo.value = e.puerta > 0.001 ? 1 : 0;
    portal.visible = e.puerta > 0.001;
    // firma
    grupoFirma.position.set(...firma.pos);
    grupoFirma.quaternion.copy(qVista(vista));
    firma.mat.uniforms.u.value = e.firmaU;
    firma.mat.uniforms.brillo.value = e.brilloFirma;
    firma.mat.uniforms.opacidad.value = e.firmaOpac ?? 1;
    polvo.material.uniforms.u.value = e.firmaU;
    polvo.material.uniforms.t.value = t;
    polvo.visible = e.firmaU > 0.001 && e.firmaU < 0.999;
    // destino del polvo: la ranura del retablo (en coordenadas del grupo de la firma)
    const seam = new THREE.Vector3(0, H * 0.55, D / 2 + td + 0.05).applyMatrix4(ret.matrixWorld);
    grupoFirma.updateMatrixWorld();
    const inv = grupoFirma.matrixWorld.clone().invert();
    const seamL = seam.clone().applyMatrix4(inv);
    if (!firma.fijado || firma.fijado.distanceTo(seamL) > 0.01) {
      polvo.userData.fijar((i, r) => [seamL.x + (r() - 0.5) * 0.12, seamL.y + (r() - 0.5) * (H * 0.75), seamL.z + 0.1],
        (x) => clamp((firma.anchoMundo / 2 - x) / firma.anchoMundo, 0, 1));
      firma.fijado = seamL.clone();
    }
    polvo.material.uniforms.ctrl.value.set((seamL.x) * 0.5 + 1.5, seamL.y + 3.2, 2.4);
    polvo.material.uniforms.abanico.value = 5;
    // motivos del salón
    mot.userData.items.forEach((it, i) => {
      const l = lug[i];
      _p.set(l.x + deriva(t, i + 3, 0.04, PER) * 0.8, l.y + deriva(t + 5, i, 0.05, PER) * 0.6 + Math.sin(t * vueltas(0.5, PER) + l.fase) * 0.15, l.z);
      _e.set(Math.sin(t * vueltas(l.bal, PER) + l.fase) * 0.5, Math.cos(t * vueltas(l.bal * 0.8, PER) + l.fase) * 0.6, l.giro + t * vueltas(l.vg, PER));
      _q.setFromEuler(_e);
      _s.set(it.s * it.m.w, it.s * it.m.h, 1);
      _m.compose(_p, _q, _s);
      mot.setMatrixAt(i, _m);
      const d = Math.abs(_p.distanceTo(new THREE.Vector3(...vista.pos)) - (vista.foco || 14));
      mot.geometry.attributes.desenf.setX(i, clamp(d * 0.4, 0, 5.5));
    });
    mot.instanceMatrix.needsUpdate = true;
    mot.geometry.attributes.desenf.needsUpdate = true;
    // estallido
    const te = e.estallido;
    est.visible = te > 0 && te < 3.5;
    if (est.visible) {
      est.userData.items.forEach((it, i) => {
        const v = vel[i], s = Math.max(0, te - v.ret);
        const arr = 1 - Math.exp(-s * 1.6);                 // frenado por el aire
        _p.set(v.p0[0] + v.v[0] * arr / 1.6, v.p0[1] + v.v[1] * arr / 1.6 - 0.9 * s * s, v.p0[2] + v.v[2] * arr / 1.6);
        _e.set(v.giro[0] * s * 0.4, v.giro[1] * s * 0.4, v.giro[2] * s * 0.4);
        _q.setFromEuler(_e);
        const k = Math.min(1, s * 6);
        _s.set(it.s * it.m.w * k, it.s * it.m.h * k, 1);
        _m.compose(_p, _q, _s);
        est.setMatrixAt(i, _m);
        est.geometry.attributes.opac.setX(i, s > 0 ? clamp(3.2 - te, 0, 1) : 0);
        const wp = _p.clone().applyMatrix4(ret.matrixWorld);
        const d = Math.abs(wp.distanceTo(new THREE.Vector3(...vista.pos)) - (vista.foco || 10));
        est.geometry.attributes.desenf.setX(i, clamp(d * 0.5, 0, 6));
      });
      est.instanceMatrix.needsUpdate = true;
      est.geometry.attributes.opac.needsUpdate = true;
      est.geometry.attributes.desenf.needsUpdate = true;
    }
    // luces que siguen al retablo
    clave.position.set(e.x - 8, 20, 9);
    clave.target.position.set(e.x + 0.3, 3.5, 0);
    contra.position.set(e.x + 6, 12, -12);
    contra.target.position.set(e.x, 4, 0);
    // bokeh
    bokD.forEach((b, i) => {
      _p.set(b.x + Math.sin(t * vueltas(0.07, PER) + b.f) * 1.2, b.y + Math.sin(t * vueltas(0.09, PER) + b.f * 2) * 0.8, b.z);
      _m.makeScale(b.s, b.s, 1).setPosition(_p);
      bok.setMatrixAt(i, _m);
    });
    bok.instanceMatrix.needsUpdate = true;
    pol.material.uniforms.t.value = t;
  }

  return { escena: esc, ret, portal, puertas, actualizar, firma, RET };
}

const _cv = new THREE.PerspectiveCamera();
function qVista(v) {
  _cv.position.set(...v.pos); _cv.up.set(0, 1, 0); _cv.lookAt(...v.mira);
  return _cv.quaternion.clone();
}

// ── la firma: un canvas con flor, nombre, filete y bajada; se deshace según `u` (derecha → izquierda) ──
function crearFirma(motor) {
  const AN = 4096;
  const lg = logoCanvas({ ancho: 3400, tinta: '#f9f6ee', acento: '#f0b8a4', margen: 0.0 });
  const altoFlor = 620, altoNom = lg.alto, gap = 70;
  const AL = Math.ceil(altoFlor + gap + altoNom + 380);
  const c = lienzo(AN, AL), g = c.getContext('2d');
  dibujarFlor(g, AN / 2, altoFlor / 2 + 10, altoFlor / 2, 0, { petalo: '#2f93a8', corona: '#f9f6ee', disco: '#0d3b2b' });
  g.drawImage(lg.canvas, (AN - lg.ancho) / 2, altoFlor + gap);
  const yF = altoFlor + gap + altoNom + 90;
  g.fillStyle = '#e9dcc4';
  g.globalAlpha = 0.85;
  g.fillRect(AN / 2 - 1180, yF, 1120, 7);
  g.fillRect(AN / 2 + 60, yF, 1120, 7);
  g.beginPath(); g.arc(AN / 2, yF + 3.5, 17, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 1;
  g.font = `500 112px ${FUENTE.texto}`;
  g.letterSpacing = '30px';
  g.textAlign = 'center';
  g.fillStyle = '#e9dcc4';
  g.fillText('CAFÉ   •   CREPE   •   HELADOS', AN / 2 + 15, yF + 230);
  const tex = motor.texturaCanvas(c);
  const anchoMundo = 10.4, altoMundo = (AL / AN) * anchoMundo;
  const mat = new THREE.ShaderMaterial({
    uniforms: { mapa: { value: tex }, u: { value: 0 }, brillo: { value: -1 }, opacidad: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D mapa; uniform float u, brillo, opacidad; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(mapa, vUv);
        // se va con el polvo: cada pixel se apaga cuando parte su partícula (mismo orden que el polvo)
        float orden = 1.0 - vUv.x;
        float sale = orden * 0.55;
        float vis = 1.0 - smoothstep(sale - 0.02, sale + 0.06, u);
        // brillo turquesa que barre en diagonal
        float d = (vUv.x - vUv.y * 0.35) - brillo;
        float b = exp(-d * d / 0.004) * step(-0.5, brillo);
        vec3 rgb = c.rgb + vec3(0.55, 0.95, 1.0) * b * 0.9 * c.a;
        gl_FragColor = vec4(rgb, c.a * vis * opacidad);
      }`,
    transparent: true, depthWrite: false,
  });
  const malla = new THREE.Mesh(new THREE.PlaneGeometry(anchoMundo, altoMundo), mat);
  malla.renderOrder = 8;
  const puntos = puntosDeCanvas(c, anchoMundo, 4, 140);
  return { malla, mat, puntos, anchoMundo, altoMundo, pos: [5.5, 5.7, 1.0] };
}
