// Polvo dorado que deshace y arma el logo: cada partícula tiene su casa en el logo (muestreada del
// alfa) y viaja por una curva hasta la ranura de las puertas del retablo. Todo en el shader de
// vértices a partir de `u` global y del retraso de cada partícula: barato y determinista.
import * as THREE from 'three';
import { azar } from './util.js';
import { discoSuave } from './texturas.js';

const VERT = /* glsl */ `
  attribute vec3 casa; attribute vec3 destino; attribute vec4 rnd;
  uniform float u; uniform float tam; uniform float t; uniform vec3 ctrl; uniform float abanico;
  varying float vA; varying float vTw;
  // u global 0→1; cada partícula sale con un retraso según su x en el logo (rnd.x ya lo trae)
  void main(){
    float k = clamp((u - rnd.x * 0.55) / 0.45, 0.0, 1.0);
    float e = k * k * (3.0 - 2.0 * k);
    // curva cuadrática: casa → control (arriba, con abanico propio) → destino
    vec3 c = ctrl + vec3((rnd.y - 0.5) * abanico, (rnd.z - 0.5) * abanico * 0.6, (rnd.w - 0.5) * abanico * 0.5);
    vec3 p = mix(mix(casa, c, e), mix(c, destino, e), e);
    // remolino suave en vuelo
    float giro = sin(e * 3.14159) * 0.35;
    p.x += sin(t * 3.0 + rnd.y * 40.0) * giro;
    p.y += cos(t * 2.6 + rnd.z * 37.0) * giro;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // brillan al salir y se apagan al llegar
    vA = smoothstep(0.0, 0.08, k) * (1.0 - smoothstep(0.82, 1.0, k));
    vTw = 0.6 + 0.4 * sin(t * 9.0 + rnd.w * 80.0);
    gl_PointSize = tam * (0.55 + rnd.z * 0.9) * (1.0 + sin(e * 3.14159) * 0.8) / -mv.z;
  }`;
const FRAG = /* glsl */ `
  uniform sampler2D mapa; uniform vec3 color; uniform float brillo; varying float vA; varying float vTw;
  void main(){ float a = texture2D(mapa, gl_PointCoord).a; if (a * vA < 0.003) discard; gl_FragColor = vec4(color * brillo * a * vA * vTw, 1.0); }`;

// `puntos`: [[x,y], …] en coordenadas del plano del logo (mundo, origen en su centro).
// `orden(x)` → 0..1 retraso de salida.
export function polvoLogo(motor, puntos, { n = 9000, semilla = 21, color = '#ffd88a', tam = 26, brillo = 2.2 } = {}) {
  const r = azar(semilla);
  const casa = new Float32Array(n * 3), destino = new Float32Array(n * 3), rnd = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const [x, y] = puntos[Math.floor(r() * puntos.length)];
    casa.set([x + (r() - 0.5) * 0.02, y + (r() - 0.5) * 0.02, (r() - 0.5) * 0.05], i * 3);
    rnd.set([0, r(), r(), r()], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('casa', new THREE.BufferAttribute(casa, 3));
  geo.setAttribute('destino', new THREE.BufferAttribute(destino, 3));
  geo.setAttribute('rnd', new THREE.BufferAttribute(rnd, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      u: { value: 0 }, t: { value: 0 }, tam: { value: tam * motor.dpr }, ctrl: { value: new THREE.Vector3() }, abanico: { value: 3 },
      mapa: { value: motor.texturaCanvas(discoSuave(64, 0.25)) }, color: { value: new THREE.Color(color) }, brillo: { value: brillo },
    },
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  p.renderOrder = 9;
  // destino y retraso se fijan desde afuera (dependen de dónde está la ranura)
  p.userData = {
    fijar(destinoFn, ordenFn) {
      const d = geo.attributes.destino.array, c = geo.attributes.casa.array, q = geo.attributes.rnd.array;
      for (let i = 0; i < n; i++) {
        const [x, y, z] = destinoFn(i, r);
        d[i * 3] = x; d[i * 3 + 1] = y; d[i * 3 + 2] = z;
        q[i * 4] = ordenFn(c[i * 3], c[i * 3 + 1]);
      }
      geo.attributes.destino.needsUpdate = true;
      geo.attributes.rnd.needsUpdate = true;
    },
  };
  return p;
}

// Muestrea puntos del alfa de un canvas (paso en px) → coordenadas de mundo centradas.
export function puntosDeCanvas(canvas, anchoMundo, paso = 3, umbral = 128) {
  const g = canvas.getContext('2d');
  const { width: W, height: H } = canvas;
  const d = g.getImageData(0, 0, W, H).data;
  const k = anchoMundo / W, out = [];
  for (let y = 0; y < H; y += paso) for (let x = 0; x < W; x += paso) {
    if (d[(y * W + x) * 4 + 3] > umbral) out.push([(x - W / 2) * k, (H / 2 - y) * k]);
  }
  return out;
}
