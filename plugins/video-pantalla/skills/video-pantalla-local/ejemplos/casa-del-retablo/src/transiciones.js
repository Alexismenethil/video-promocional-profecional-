// Transiciones entre tableros. Cada tablero se dibuja en su textura (A el que se va, B el que llega) y
// estas piezas las combinan en 3D:
//   abrir    el tablero se parte al medio y sus dos mitades se abren como las puertas de un retablo
//   casa     la casita del logo crece desde el centro con el tablero siguiente adentro y la cámara entra
//   tablas   tablas-prisma que giran en ola (la versión con volumen de las persianas del video de la casa)
//   empuje   el tablero se va de costado y entra el otro, con un filete crema entre los dos
//   flores   un remolino de flores del logo cruza la pantalla y tapa el corte
import * as THREE from 'three';
import { formaCasa, florCanvas } from './marca.js';
import { azar, clamp, E, lerp, vaiven } from './util.js';

const col = (h) => new THREE.Color(h);
const ASP = 16 / 9;

export function crearTransiciones(motor) {
  const r = motor.renderer;

  // ═════ tablas-prisma ═════
  const escTablas = new THREE.Scene();
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
        const fi = (f * 2 * Math.PI) / 3;
        const holder = new THREE.Group();
        if (horizontal) holder.rotation.x = -fi; else holder.rotation.y = fi;
        m.position.z = a;
        holder.add(m);
        piv.add(holder);
        const ext = (largo / (horizontal ? anchoT : altoT) - 1) / 2;
        if (horizontal) mat.uniforms.franja.value.set(1 - (i + 1) / n, 1 / n, 0, 0); else mat.uniforms.franja.value.set(i / n, 1 / n, 0, 0);
        const uv = geo.attributes.uv;
        for (let j = 0; j < uv.count; j++) {
          if (horizontal) uv.setX(j, -ext + uv.getX(j) * (1 + 2 * ext)); else uv.setY(j, -ext + uv.getY(j) * (1 + 2 * ext));
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
  const juegos = { v8: armarTablas(8, false), v12: armarTablas(12, false), h6: armarTablas(6, true), v10: armarTablas(10, false), v16: armarTablas(16, false), h8: armarTablas(8, true) };

  // ═════ abrir: el tablero A como dos puertas que se abren hacia la cámara, B detrás ═════
  const escAbrir = new THREE.Scene();
  const FOV_A = 40, TAN_A = Math.tan((FOV_A * Math.PI) / 360);
  const camA = new THREE.PerspectiveCamera(FOV_A, ASP, 0.05, 200);
  camA.lookAt(0, 0, -1);
  camA.updateMatrixWorld();
  const D_A = 8;
  const altoA = 2 * D_A * TAN_A, anchoA = altoA * ASP;
  const VERT_P = /* glsl */ `varying vec2 vUv; varying vec3 vN;
    void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const matFondoA = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, luz: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tex; uniform float luz; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tex, vUv).rgb * luz, 1.0); }`,
  });
  const fondoA = new THREE.Mesh(new THREE.PlaneGeometry(anchoA * 1.02, altoA * 1.02), matFondoA);
  fondoA.position.z = -D_A - 0.02;
  escAbrir.add(fondoA);
  const hojasA = [-1, 1].map((lado) => {
    const mat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, u0: { value: lado < 0 ? 0 : 0.5 }, canto: { value: col('#2a1d16') } },
      vertexShader: VERT_P,
      fragmentShader: `uniform sampler2D tex; uniform float u0; uniform vec3 canto; varying vec2 vUv; varying vec3 vN;
        void main(){
          vec3 n = normalize(vN);
          vec3 c = gl_FrontFacing ? texture2D(tex, vec2(u0 + vUv.x * 0.5, vUv.y)).rgb : canto;
          float lam = max(dot(gl_FrontFacing ? n : -n, normalize(vec3(-0.35, 0.4, 1.0))), 0.0);
          float k = 0.38 + 0.62 * lam / 0.88;
          gl_FragColor = vec4(c * k, 1.0);
        }`,
      side: THREE.DoubleSide,
    });
    const geo = new THREE.PlaneGeometry(anchoA / 2, altoA * 1.02);
    geo.translate(-lado * anchoA / 4, 0, 0);           // la bisagra en el borde de la pantalla
    const m = new THREE.Mesh(geo, mat);
    const piv = new THREE.Group();
    piv.position.set(lado * anchoA / 2, 0, -D_A);
    piv.add(m);
    // sombra que la puerta echa sobre B (franja oscura junto a la bisagra)
    escAbrir.add(piv);
    return { lado, piv, mat };
  });
  const filoLuz = new THREE.Mesh(new THREE.PlaneGeometry(0.05, altoA * 1.05), new THREE.MeshBasicMaterial({ color: col('#fff1d6'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  filoLuz.position.z = -D_A + 0.01;
  escAbrir.add(filoLuz);

  // ═════ casa-portal: la casita crece con el tablero siguiente adentro ═════
  const escCasa = new THREE.Scene();
  const camC = new THREE.OrthographicCamera(-ASP, ASP, 1, -1, -10, 10);
  camC.position.z = 5;
  camC.updateMatrixWorld();
  const casaG = new THREE.Group();
  const matHueco = new THREE.ShaderMaterial({
    uniforms: { t: { value: null }, res: { value: new THREE.Vector2(motor.pw, motor.ph) } },
    vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D t; uniform vec2 res; void main(){ gl_FragColor = vec4(texture2D(t, gl_FragCoord.xy / res).rgb, 1.0); }`,
  });
  const fCasa = formaCasa(1, 1.08, 0.4, 0.05);
  const hueco = new THREE.Mesh(new THREE.ShapeGeometry(fCasa, 24), matHueco);
  const marco = new THREE.Mesh(new THREE.ShapeGeometry(formaCasa(1.08, 1.17, 0.43, 0.06), 24), new THREE.MeshBasicMaterial({ color: col('#fbf5ea'), toneMapped: false }));
  marco.position.set(0, -0.045, -0.01);
  const sombraCasa = new THREE.Mesh(new THREE.ShapeGeometry(formaCasa(1.1, 1.19, 0.44, 0.06), 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
  sombraCasa.position.set(0.02, -0.08, -0.02);
  casaG.add(sombraCasa, marco, hueco);
  escCasa.add(casaG);

  // ═════ flores: remolino de flores del logo ═════
  const escFlores = new THREE.Scene();
  const camF = new THREE.PerspectiveCamera(50, ASP, 0.05, 200);
  camF.lookAt(0, 0, -1);
  camF.updateMatrixWorld();
  const TAN_F = Math.tan((50 * Math.PI) / 360);
  const texFlor = motor.texturaCanvas(florCanvas(512, { rojo: '#ffffff', verde: '#ffffff', naranja: '#ffffff' }));
  const nFl = 56;
  const rf = azar(909);
  const PALETA = ['#d4163c', '#3a9a48', '#f39b2b', '#fbf5ea', '#2c2e6b', '#e8405e'];
  const flores = [];
  for (let i = 0; i < nFl; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texFlor, color: col(PALETA[i % PALETA.length]), transparent: true, depthWrite: false, toneMapped: false }));
    const z = -rf.entre(2.5, 16);
    flores.push({ m, z, y0: rf.entre(-1.15, 1.15), fase: rf.entre(-0.25, 0.25), giro: rf.entre(-5, 5), tam: rf.entre(0.55, 1.6), curva: rf.entre(-0.4, 0.4) });
    escFlores.add(m);
  }
  flores.sort((a, b) => a.z - b.z).forEach((f, i) => { f.m.renderOrder = i; });

  function encima(escena, cam) {
    r.setRenderTarget(motor.rtMuestra);
    r.clearDepth();
    r.render(escena, cam);
  }

  // ── empuje ──
  const matEmpuje = new THREE.ShaderMaterial({
    uniforms: { a: { value: null }, b: { value: null }, u: { value: 0 }, dir: { value: 1 }, filete: { value: col('#fbf5ea') }, ancho: { value: 0.005 } },
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
  // ── mezcla (fundido) ──
  const matFundido = new THREE.ShaderMaterial({
    uniforms: { a: { value: null }, b: { value: null }, u: { value: 0 }, luz: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D a, b; uniform float u, luz; varying vec2 vUv;
      void main(){ vec3 c = mix(texture2D(a, vUv).rgb, texture2D(b, vUv).rgb, u); c += vec3(1.0, 0.95, 0.86) * luz; gl_FragColor = vec4(c, 1.0); }`,
    depthTest: false, depthWrite: false,
  });

  return {
    tablas(texA, texB, u, juego = 'v8', desde = 'izq', dur = 0.62, fondo = 0x120c08) {
      for (const k in juegos) juegos[k].g.visible = k === juego;
      const J = juegos[juego];
      const n = J.n;
      const paso = (1 - dur) / Math.max(1, n - 1);
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
      r.setClearColor(fondo, 1);
      r.clear(true, true, false);
      r.render(escTablas, camT);
    },
    // abrir: u 0 → 1 (las dos mitades de A se abren hacia la cámara y salen de cuadro)
    abrir(texA, texB, u) {
      matFondoA.uniforms.tex.value = texB;
      const e = E.inOutCubic(u);
      hojasA.forEach((h) => {
        h.mat.uniforms.tex.value = texA;
        h.piv.rotation.y = -h.lado * e * Math.PI * 0.62;
      });
      // B en penumbra mientras las puertas tapan la luz
      matFondoA.uniforms.luz.value = lerp(0.55, 1, E.outCubic(clamp(u * 1.3)));
      filoLuz.material.color.setRGB(1, 0.94, 0.82).multiplyScalar(4 * Math.max(0, 1 - u * 6));
      filoLuz.visible = u > 0 && u < 0.17;
      r.setRenderTarget(motor.rtMuestra);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      r.render(escAbrir, camA);
    },
    // casa: la casita (escala en altos de pantalla) muestra B en su hueco, sobre A ya dibujado
    casa(texB, escala, giro = 0, y = -0.5) {
      matHueco.uniforms.t.value = texB;
      casaG.scale.setScalar(escala);
      casaG.position.set(0, y * escala, 0);
      casaG.rotation.z = giro;
      encima(escCasa, camC);
    },
    // flores: u 0..1 (cubren del todo cerca de 0,5), dir ±1
    flores(u, dir = 1) {
      flores.forEach((f) => {
        const ui = clamp(u + f.fase);
        const w = 2 * (-f.z) * TAN_F * ASP;
        const x = lerp(w * 0.8, -w * 0.8, E.inOutSine(ui)) * dir;
        const y = f.y0 * (-f.z) * TAN_F + Math.sin(ui * Math.PI) * f.curva * (-f.z) * 0.5;
        f.m.position.set(x, y, f.z);
        f.m.rotation.z = f.giro * ui;
        const s = f.tam * (-f.z) * 0.22;
        f.m.scale.set(s, s, 1);
        f.m.visible = ui > 0 && ui < 1;
      });
      encima(escFlores, camF);
    },
    empuje(texA, texB, u, dir = 1) {
      matEmpuje.uniforms.a.value = texA;
      matEmpuje.uniforms.b.value = texB;
      matEmpuje.uniforms.u.value = u;
      matEmpuje.uniforms.dir.value = dir;
      motor.pasada(matEmpuje, motor.rtMuestra);
    },
    fundido(texA, texB, u, luz = 0) {
      matFundido.uniforms.a.value = texA;
      matFundido.uniforms.b.value = texB;
      matFundido.uniforms.u.value = u;
      matFundido.uniforms.luz.value = luz;
      motor.pasada(matFundido, motor.rtMuestra);
    },
  };
}
