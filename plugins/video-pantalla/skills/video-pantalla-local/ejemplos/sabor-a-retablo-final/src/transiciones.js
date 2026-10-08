// Transiciones entre tableros (y las piezas de la versión de nichos que siguen sirviendo). Las de cámara (paneo, grúa, látigo) mueven la cámara de un nicho y de
// otro y esconden el corte detrás de una pieza en primer plano (pilastra, cornisa) o del desenfoque.
// Las de composición dibujan cada nicho en su textura y las combinan: tablas-prisma que giran en
// ola, remolino de hojas de papel, puertas del retablo que se cierran y se abren.
import * as THREE from 'three';
import * as P from './piezas.js';
import { azar, clamp, E, prog, lerp, vaiven } from './util.js';

const col = (h) => new THREE.Color(h);
const FOV = 30, ASP = 16 / 9;
const TAN = Math.tan((FOV * Math.PI) / 360);

export function crearTransiciones(motor, recursos) {
  const cam = new THREE.PerspectiveCamera(FOV, ASP, 0.05, 200);
  cam.position.set(0, 0, 0);
  cam.lookAt(0, 0, -1);
  cam.updateMatrixWorld();
  const luzOverlay = () => {
    const g = new THREE.Group();
    g.add(new THREE.HemisphereLight(col('#fff3e2'), col('#3a2a1c'), 0.9));
    const d = new THREE.DirectionalLight(col('#ffe6c8'), 1.6);
    d.position.set(-4, 6, 6);
    g.add(d);
    return g;
  };

  // ── pilastra (paneo) y cornisa (grúa): piezas crema pintadas que barren la pantalla ──
  const escPieza = new THREE.Scene();
  escPieza.environment = motor.entorno;
  escPieza.environmentIntensity = 0.5;
  escPieza.add(luzOverlay());
  const bandaV = recursos.banda.clone();
  bandaV.needsUpdate = true;
  bandaV.center.set(0.5, 0.5);
  bandaV.rotation = Math.PI / 2;
  bandaV.wrapS = bandaV.wrapT = THREE.RepeatWrapping;
  bandaV.repeat.set(1.6, 1);
  const matCrema = new THREE.MeshStandardMaterial({ color: col('#f1e8d4'), roughness: 0.75, envMapIntensity: 0.4 });
  const matPint = new THREE.MeshStandardMaterial({ map: bandaV, roughness: 0.75, envMapIntensity: 0.4 });
  const D_P = 7;
  const altoV = 2 * D_P * TAN, anchoV = altoV * ASP;
  const pilastra = new THREE.Mesh(new THREE.BoxGeometry(anchoV * 0.34, altoV * 1.3, 1.2), [matCrema, matCrema, matCrema, matCrema, matPint, matCrema]);
  pilastra.position.z = -D_P;
  escPieza.add(pilastra);
  const bandaH = recursos.banda.clone();
  bandaH.needsUpdate = true;
  bandaH.wrapS = THREE.RepeatWrapping;
  bandaH.repeat.set(2.2, 1);
  const cornisa = new THREE.Mesh(new THREE.BoxGeometry(anchoV * 1.3, altoV * 0.42, 1.2),
    [matCrema, matCrema, matCrema, matCrema, new THREE.MeshStandardMaterial({ map: bandaH, roughness: 0.75, envMapIntensity: 0.4 }), matCrema]);
  cornisa.position.z = -D_P;
  escPieza.add(cornisa);
  // filetes dorados en los cantos de la pieza
  const oro = new THREE.MeshStandardMaterial({ color: col('#c9a35a'), roughness: 0.35, metalness: 0.75, envMapIntensity: 1 });
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, altoV * 1.3, 0.06), oro);
    f.position.set(s * anchoV * 0.17, 0, 0.62);
    pilastra.add(f);
    const g = new THREE.Mesh(new THREE.BoxGeometry(anchoV * 1.3, 0.06, 0.06), oro);
    g.position.set(0, s * altoV * 0.21, 0.62);
    cornisa.add(g);
  }

  // ── tablas-prisma ──
  const escTablas = new THREE.Scene();
  escTablas.background = col('#120c08');
  const FOV_T = 58, TAN_T = Math.tan((FOV_T * Math.PI) / 360);
  const camT = new THREE.PerspectiveCamera(FOV_T, ASP, 0.05, 200);
  camT.lookAt(0, 0, -1);
  camT.updateMatrixWorld();
  const D_T = 10;
  const altoT = 2 * D_T * TAN_T, anchoT = altoT * ASP;
  const VERT_T = /* glsl */ `
    varying vec2 vUv; varying vec3 vN; varying vec3 vP;
    void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vP = mv.xyz; gl_Position = projectionMatrix * mv; }`;
  const FRAG_T = /* glsl */ `
    uniform sampler2D tex; uniform vec4 franja; uniform float horizontal; uniform vec3 luzDir; uniform float oscura;
    varying vec2 vUv; varying vec3 vN; varying vec3 vP;
    void main(){
      vec2 uv = horizontal > 0.5 ? vec2(vUv.x, franja.x + vUv.y * franja.y) : vec2(franja.x + vUv.x * franja.y, vUv.y);
      vec3 c = texture2D(tex, clamp(uv, 0.001, 0.999)).rgb;
      vec3 n = normalize(vN);
      vec3 v = normalize(-vP);
      float lam = max(dot(n, normalize(luzDir)), 0.0);
      float lam0 = max(dot(vec3(0.0, 0.0, 1.0), normalize(luzDir)), 0.0);
      float k = 0.42 + 0.58 * lam / max(lam0, 0.05);
      k *= mix(1.0, 0.25, oscura);
      float filo = pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.25;
      gl_FragColor = vec4(c * k + vec3(1.0, 0.95, 0.85) * filo, 1.0);
    }`;
  function armarTablas(n, horizontal) {
    const g = new THREE.Group();
    const w = (horizontal ? altoT : anchoT) / n;
    const largo = (horizontal ? anchoT : altoT) * 1.1;
    const a = w / (2 * Math.sqrt(3));
    const tablas = [];
    for (let i = 0; i < n; i++) {
      const piv = new THREE.Group();
      const c = -((horizontal ? altoT : anchoT) / 2) + (i + 0.5) * w;
      if (horizontal) piv.position.set(0, -c, -D_T - a); else piv.position.set(c, 0, -D_T - a);
      const caras = [];
      for (let f = 0; f < 3; f++) {
        const geo = new THREE.PlaneGeometry(horizontal ? largo : w * 1.004, horizontal ? w * 1.004 : largo);
        const mat = new THREE.ShaderMaterial({
          uniforms: { tex: { value: null }, franja: { value: new THREE.Vector4() }, horizontal: { value: horizontal ? 1 : 0 },
            luzDir: { value: new THREE.Vector3(0.5, 0.3, 1) }, oscura: { value: f === 2 ? 1 : 0 } },
          vertexShader: VERT_T, fragmentShader: FRAG_T,
        });
        const m = new THREE.Mesh(geo, mat);
        // cara f con normal a f·120° del frente, a distancia `a` del eje
        const fi = (f * 2 * Math.PI) / 3;
        const holder = new THREE.Group();
        if (horizontal) holder.rotation.x = -fi; else holder.rotation.y = fi;
        m.position.z = a;
        holder.add(m);
        piv.add(holder);
        // franja de pantalla que cubre la tabla en reposo (en uv)
        const u0 = (i / n), du = 1 / n;
        const ext = (largo / (horizontal ? anchoT : altoT) - 1) / 2;
        if (horizontal) mat.uniforms.franja.value.set(1 - (i + 1) / n, du, 0, 0); else mat.uniforms.franja.value.set(u0, du, 0, 0);
        mat.userData = { ext };
        if (horizontal) {
          const uv = geo.attributes.uv;
          for (let j = 0; j < uv.count; j++) uv.setX(j, -ext + uv.getX(j) * (1 + 2 * ext));
        } else {
          const uv = geo.attributes.uv;
          for (let j = 0; j < uv.count; j++) uv.setY(j, -ext + uv.getY(j) * (1 + 2 * ext));
        }
        caras.push(m);
      }
      g.add(piv);
      tablas.push({ piv, caras, i });
    }
    g.visible = false;
    escTablas.add(g);
    return { g, tablas, n, horizontal };
  }
  const juegos = { v8: armarTablas(8, false), v12: armarTablas(12, false), h6: armarTablas(6, true), v10: armarTablas(10, false) };

  // ── remolino de hojas ──
  const escHojas = new THREE.Scene();
  const nH = 150;
  const hojas = P.motivosFlotantes(motor, recursos.atlasMotivos, window.MOTIVOS.lista, nH, 404,
    { escala: 0.0105, filtro: (m) => m.area > 400 });
  escHojas.add(hojas);
  const rh = azar(405);
  const vuelo = hojas.userData.items.map(() => ({
    z: rh.entre(-14, -2.2), y0: rh.entre(-1.2, 1.2), fase: rh.entre(-0.22, 0.22), giro: [rh.entre(-1.4, 1.4), rh.entre(-1.4, 1.4), rh.entre(-6, 6)],
    curva: rh.entre(-0.5, 0.5), esc: rh.entre(0.8, 1.6),
  }));

  // ── puertas del retablo (de pantalla completa) ──
  const escPuertas = new THREE.Scene();
  escPuertas.environment = motor.entorno;
  escPuertas.environmentIntensity = 0.45;
  escPuertas.add(luzOverlay());
  const D_D = 6;
  const altoD = 2 * D_D * TAN, anchoD = altoD * ASP;
  const puertas = [];
  for (const lado of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(lado * anchoD / 2 * 1.02, 0, -D_D);
    const tex = (lado < 0 ? recursos.puertaIzq : recursos.puertaDer).clone();
    tex.needsUpdate = true;
    // encuadre por cobertura (la mitad de la pantalla es más ancha que la puerta)
    const aspP = 298 / 633, aspM = (anchoD / 2) / altoD;
    tex.repeat.set(1, aspP / aspM);
    tex.offset.set(0, (1 - aspP / aspM) / 2);
    const mats = [matCrema, matCrema, matCrema, matCrema, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, envMapIntensity: 0.45 }), matCrema];
    const m = new THREE.Mesh(new THREE.BoxGeometry(anchoD / 2 * 1.02, altoD * 1.05, 0.25), mats);
    m.position.x = -lado * anchoD / 4 * 1.02;
    piv.add(m);
    escPuertas.add(piv);
    puertas.push({ lado, piv });
  }
  const ranura = new THREE.Mesh(new THREE.PlaneGeometry(0.08, altoD * 1.1), new THREE.MeshBasicMaterial({ color: col('#fff3d6'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  ranura.position.z = -D_D + 0.2;
  escPuertas.add(ranura);

  // ── flor-portal: la flor de la marca aparece girando en el centro y la cámara entra por su disco,
  //    que ya muestra el tablero siguiente ──
  const escFlor = new THREE.Scene();
  const camF = new THREE.OrthographicCamera(-ASP, ASP, 1, -1, -10, 10);
  camF.position.z = 5;
  camF.updateMatrixWorld();
  const F = P.formasFlor();
  const florG = new THREE.Group();
  const matPet = new THREE.MeshBasicMaterial({ color: col('#2f93a8'), toneMapped: false });
  const matCor = new THREE.MeshBasicMaterial({ color: col('#f9f6ee'), toneMapped: false });
  const pet = new THREE.Mesh(new THREE.ShapeGeometry(F.petalos, 64), matPet);
  const cor = new THREE.Mesh(new THREE.ShapeGeometry(F.corona, 64), matCor);
  pet.scale.set(1, -1, 1); cor.scale.set(1, -1, 1);
  cor.position.z = 0.01;
  const matDisco = new THREE.ShaderMaterial({
    uniforms: { t: { value: null }, res: { value: new THREE.Vector2(motor.pw, motor.ph) }, borde: { value: col('#0d3b2b') }, filo: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D t; uniform vec2 res; uniform vec3 borde; uniform float filo; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(t, gl_FragCoord.xy / res).rgb;
        float d = length(vUv - 0.5) * 2.0;
        c = mix(c, borde, smoothstep(1.0 - filo, 1.0, d));   // un aro verde fino (el disco del logo)
        c *= mix(1.0, 0.8, smoothstep(0.7, 1.0, d) * filo * 6.0);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(F.RD, 128), matDisco);
  disc.position.z = 0.02;
  const somb = new THREE.Mesh(new THREE.ShapeGeometry(F.petalos, 48), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  somb.scale.set(1.04, -1.04, 1);
  somb.position.set(6, -12, -0.01);
  florG.add(somb, pet, cor, disc);
  escFlor.add(florG);

  // ── empuje: el tablero se va de costado y entra el siguiente (con un filete crema entre los dos) ──
  const matEmpuje = new THREE.ShaderMaterial({
    uniforms: { a: { value: null }, b: { value: null }, u: { value: 0 }, dir: { value: 1 }, filete: { value: col('#f9f6ee') }, ancho: { value: 0.006 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D a, b; uniform float u, dir, ancho; uniform vec3 filete; varying vec2 vUv;
      void main(){
        float x = dir > 0.0 ? vUv.x : 1.0 - vUv.x;
        float corte = 1.0 - u;
        vec3 c;
        if (x < corte - ancho) { float xa = x + u; c = texture2D(a, vec2(dir > 0.0 ? xa : 1.0 - xa, vUv.y)).rgb; }
        else if (x > corte + ancho) { float xb = x - corte; c = texture2D(b, vec2(dir > 0.0 ? xb : 1.0 - xb, vUv.y)).rgb; }
        else c = filete;
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });

  const r = motor.renderer;
  function encima(escena) {
    r.setRenderTarget(motor.rtMuestra);
    r.clearDepth();
    r.render(escena, cam);
  }

  return {
    // u: avance de la pieza (0 entra por un lado, 1 sale por el otro); dir +1 = la cámara va a la derecha
    pilastra(u, dir) {
      pilastra.visible = true; cornisa.visible = false;
      pilastra.position.x = lerp(anchoV * 0.75, -anchoV * 0.75, u) * dir;
      encima(escPieza);
    },
    cornisa(u, dir) {
      pilastra.visible = false; cornisa.visible = true;
      cornisa.position.y = lerp(altoV * 0.8, -altoV * 0.8, u) * dir;
      encima(escPieza);
    },
    // tablas: texA/texB ya dibujadas; u global de la ola (0..1); juego 'v8', 'v12', 'h6', 'v10'; desde: 'izq'|'der'|'centro'
    tablas(texA, texB, u, juego = 'v8', desde = 'izq', dur = 0.62, fondo = 0x120c08) {
      for (const k in juegos) juegos[k].g.visible = k === juego;
      const J = juegos[juego];
      const n = J.n;
      const tot = 1;                      // la ola completa en u ∈ [0,1]
      const paso = (tot - dur / 1.0) / Math.max(1, n - 1);
      J.tablas.forEach((tb) => {
        let orden = tb.i;
        if (desde === 'der') orden = n - 1 - tb.i;
        if (desde === 'centro') orden = Math.abs(tb.i - (n - 1) / 2) * 2;
        const ua = clamp((u - orden * paso * (desde === 'centro' ? 0.5 : 1)) / dur);
        const e = E.inOutCubic(ua);
        const golpe = vaiven(clamp((ua - 0.86) / 0.5), 2.2, 6) * 0.1;
        const ang = (-2 * Math.PI / 3) * e + golpe * (e > 0.85 ? 1 : 0);
        if (J.horizontal) tb.piv.rotation.x = -ang; else tb.piv.rotation.y = ang;
        tb.caras[0].material.uniforms.tex.value = texA;
        tb.caras[1].material.uniforms.tex.value = texB;
        tb.caras[2].material.uniforms.tex.value = texB;
        const dirLuz = J.horizontal ? new THREE.Vector3(0.1, -0.7, 1) : new THREE.Vector3(desde === 'der' ? -0.7 : 0.7, 0.15, 1);
        tb.caras.forEach((c) => c.material.uniforms.luzDir.value.copy(dirLuz));
      });
      r.setRenderTarget(motor.rtMuestra);
      escTablas.background = col(fondo);
      r.setClearColor(fondo, 1);
      r.clear(true, true, false);
      r.render(escTablas, camT);
    },
    // remolino: u 0..1 (cubre del todo cerca de 0,5)
    hojas(u, dir = 1) {
      const items = hojas.userData.items;
      const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
      items.forEach((it, i) => {
        const v = vuelo[i];
        const ui = clamp(u + v.fase);
        const w = 2 * (-v.z) * TAN * ASP;
        const x = lerp(w * 0.75, -w * 0.75, E.inOutSine(ui)) * dir;
        const y = v.y0 * (-v.z) * TAN + Math.sin(ui * Math.PI) * v.curva * (-v.z) * 0.6;
        _p.set(x, y, v.z);
        _e.set(v.giro[0] * ui, v.giro[1] * ui, v.giro[2] * ui);
        _q.setFromEuler(_e);
        const s = it.s * v.esc * (-v.z) * 0.11;
        _s.set(s * it.m.w, s * it.m.h, 1);
        _m.compose(_p, _q, _s);
        hojas.setMatrixAt(i, _m);
        hojas.geometry.attributes.desenf.setX(i, clamp((-v.z - 6) * 0.25, 0, 3) + clamp((3.5 + v.z) * 1.2, 0, 3));
        hojas.geometry.attributes.opac.setX(i, ui > 0 && ui < 1 ? 1 : 0);
      });
      hojas.instanceMatrix.needsUpdate = true;
      hojas.geometry.attributes.desenf.needsUpdate = true;
      hojas.geometry.attributes.opac.needsUpdate = true;
      encima(escHojas);
    },
    // flor-portal: R = radio de los pétalos (en altos de pantalla), giro, colores; el disco muestra texB
    flor(texB, R, giro, { petalo = '#2f93a8', corona = '#f9f6ee', disco = '#0d3b2b', filo = 0.05 } = {}) {
      matPet.color.set(petalo); matCor.color.set(corona);
      matDisco.uniforms.t.value = texB;
      matDisco.uniforms.borde.value.set(disco);
      matDisco.uniforms.filo.value = filo;
      const k = (R * 2) / F.R;
      florG.scale.setScalar(k);
      florG.rotation.z = giro;
      somb.material.opacity = 0.22 * Math.min(1, 0.6 / Math.max(R, 0.01));
      r.setRenderTarget(motor.rtMuestra);
      r.clearDepth();
      r.render(escFlor, camF);
    },
    // empuje: u 0 → 1, dir +1 = el tablero se va hacia la izquierda
    empuje(texA, texB, u, dir = 1) {
      matEmpuje.uniforms.a.value = texA;
      matEmpuje.uniforms.b.value = texB;
      matEmpuje.uniforms.u.value = u;
      matEmpuje.uniforms.dir.value = dir;
      motor.pasada(matEmpuje, motor.rtMuestra);
    },
    // puertas: a (0 abiertas … 1 cerradas), brillo de la ranura
    puertas(a, brillo = 0) {
      puertas.forEach((p) => { p.piv.rotation.y = p.lado * (1 - a) * Math.PI * 0.62; });
      ranura.material.color.setRGB(1, 0.93, 0.78).multiplyScalar(brillo * 5);
      ranura.visible = brillo > 0.01 && a > 0.9;
      encima(escPuertas);
    },
  };
}
