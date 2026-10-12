// Motor de imagen: WebGL con la GPU, cada cuadro es el promedio de K instantes (desenfoque de
// movimiento real, profundidad de campo de lente y antialias por subpíxel), luego brillo (bloom),
// curva de color, viñeta y grano. Todo sale de seek(t): el mismo t da siempre el mismo cuadro.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { halton } from './util.js';

export const W = 1920, H = 1080;

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export class Motor {
  constructor() {
    this.dpr = window.devicePixelRatio || 1;
    const r = (this.renderer = new THREE.WebGLRenderer({
      antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', stencil: false,
    }));
    r.setPixelRatio(this.dpr);
    r.setSize(W, H);
    r.toneMapping = THREE.NoToneMapping;
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.autoClear = false;
    r.setClearColor(0x000000, 1);
    document.body.appendChild(r.domElement);
    this.pw = Math.round(W * this.dpr);
    this.ph = Math.round(H * this.dpr);

    const rt = (msaa, depth = true) => new THREE.WebGLRenderTarget(this.pw, this.ph, {
      type: THREE.HalfFloatType, depthBuffer: depth, samples: msaa, colorSpace: THREE.LinearSRGBColorSpace,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    });
    this.rtMuestra = rt(4);
    this.rtA = rt(4);
    this.rtB = rt(4);
    this.rtAcum = rt(0, false);

    // Cuadrado de pantalla completa para las pasadas 2D
    this.cam2d = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.escena2d = new THREE.Scene();
    this.escena2d.add(this.quad);

    this.matAcum = new THREE.ShaderMaterial({
      uniforms: { t: { value: null }, peso: { value: 1 } },
      vertexShader: VERT,
      fragmentShader: `uniform sampler2D t; uniform float peso; varying vec2 vUv;
        void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb * peso, 1.0); }`,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, depthTest: false, depthWrite: false,
    });
    this.matCopia = new THREE.ShaderMaterial({
      uniforms: { t: { value: null }, alfa: { value: 1 } },
      vertexShader: VERT,
      fragmentShader: `uniform sampler2D t; uniform float alfa; varying vec2 vUv;
        void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb, alfa); }`,
      transparent: true, depthTest: false, depthWrite: false,
    });

    // Brillo: solo lo que pasa de ~1 (luces, destellos, el filo de las puertas); lo demás queda limpio.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(this.pw, this.ph), 0.42, 0.62, 0.92);

    this.matFinal = new THREE.ShaderMaterial({
      uniforms: {
        t: { value: null }, res: { value: new THREE.Vector2(this.pw, this.ph) }, semilla: { value: 0 },
        exposicion: { value: 1.0 }, saturacion: { value: 1.06 }, vineta: { value: 0.32 }, grano: { value: 0.022 },
        tinte: { value: new THREE.Vector3(1, 1, 1) }, velo: { value: new THREE.Vector4(0, 0, 0, 0) },
      },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D t; uniform vec2 res; uniform float semilla, exposicion, saturacion, vineta, grano;
        uniform vec3 tinte; uniform vec4 velo; varying vec2 vUv;
        float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
        vec3 hombro(vec3 c){
          // lineal hasta 0,82; arriba se curva suave hasta 1 (sin quemar los blancos de la loza y la crema)
          vec3 x = max(c - 0.82, 0.0);
          return min(c, 0.82) + 0.18 * (1.0 - exp(-x / 0.18));
        }
        vec3 aSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
        void main(){
          vec3 c = texture2D(t, vUv).rgb * exposicion * tinte;
          c = hombro(c);
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = max(mix(vec3(l), c, saturacion), 0.0);
          vec2 q = (vUv - 0.5) * vec2(res.x / res.y, 1.0);
          c *= mix(1.0, smoothstep(1.25, 0.28, length(q)), vineta);
          c = mix(c, velo.rgb, velo.a);
          c = aSRGB(clamp(c, 0.0, 1.0));
          vec2 p = gl_FragCoord.xy + semilla * 17.0;
          float n = hash(p) + hash(p + 0.37) - 1.0;           // triangular: grano + tramado contra bandas
          c += n * (grano + 1.0 / 255.0);
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });

    const pm = new THREE.PMREMGenerator(r);
    this.entorno = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.cargador = new THREE.TextureLoader();
    this._S = new THREE.Matrix4();
    this._T = new THREE.Matrix4();
  }

  // ── texturas ──
  textura(src, { srgb = true, repetir = false, mip = true } = {}) {
    return new Promise((ok, mal) => this.cargador.load(src, (tx) => {
      tx.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tx.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      tx.generateMipmaps = mip;
      tx.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
      if (repetir) tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
      ok(tx);
    }, undefined, mal));
  }
  texturaCanvas(canvas, { srgb = true } = {}) {
    const tx = new THREE.CanvasTexture(canvas);
    tx.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tx.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    tx.minFilter = THREE.LinearMipmapLinearFilter;
    return tx;
  }

  // ── lente: posición y mira de la cámara + subpíxel + apertura (profundidad de campo) ──
  // `vista` = {pos:[x,y,z], mira:[x,y,z], fov, giro, apertura, foco}. k/K: submuestra de este cuadro.
  colocar(cam, vista, k = 0, K = 1) {
    cam.fov = vista.fov || 30;
    cam.aspect = W / H;
    cam.near = vista.cerca || 0.05;
    cam.far = vista.lejos || 400;
    cam.position.set(...vista.pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(...vista.mira);
    if (vista.giro) cam.rotateZ(vista.giro);
    cam.updateProjectionMatrix();
    const foco = vista.foco || cam.position.distanceTo(new THREE.Vector3(...vista.mira));
    if (K > 1) {
      const i = k + 1;
      const ap = vista.apertura || 0;
      if (ap > 0) {
        const r = Math.sqrt(halton(i, 5)) * ap, th = 2 * Math.PI * halton(i, 7);
        const dx = r * Math.cos(th), dy = r * Math.sin(th);
        cam.translateX(dx);
        cam.translateY(dy);
        this._S.set(1, 0, -dx / foco, 0, 0, 1, -dy / foco, 0, 0, 0, 1, 0, 0, 0, 0, 1);
        cam.projectionMatrix.multiply(this._S);
      }
      const jx = (halton(i, 2) - 0.5) * 2 / this.pw, jy = (halton(i, 3) - 0.5) * 2 / this.ph;
      this._T.makeTranslation(jx, jy, 0);
      cam.projectionMatrix.premultiply(this._T);
    }
    cam.updateMatrixWorld(true);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    return cam;
  }

  limpiar(rt, color = 0x000000) {
    const r = this.renderer;
    r.setRenderTarget(rt);
    r.setClearColor(color, 1);
    r.clear(true, true, false);
  }
  pasada(material, destino) {
    this.quad.material = material;
    this.renderer.setRenderTarget(destino);
    this.renderer.render(this.escena2d, this.cam2d);
  }

  // Un cuadro: `dibujar(tk, k, K)` deja la submuestra en this.rtMuestra.
  cuadro(t, K, obturador, fps, dibujar, ajustes = {}) {
    this.limpiar(this.rtAcum);
    for (let k = 0; k < K; k++) {
      const tk = K === 1 ? t : t + ((k + 0.5) / K - 0.5) * (obturador / fps);
      dibujar(tk, k, K);
      this.matAcum.uniforms.t.value = this.rtMuestra.texture;
      this.matAcum.uniforms.peso.value = 1 / K;
      this.pasada(this.matAcum, this.rtAcum);
    }
    const b = this.bloom;
    b.strength = ajustes.bloom ?? 0.42;
    b.radius = ajustes.radio ?? 0.62;
    b.threshold = ajustes.umbral ?? 0.92;
    if (b.strength > 0) b.render(this.renderer, null, this.rtAcum, 0, false);
    const u = this.matFinal.uniforms;
    u.t.value = this.rtAcum.texture;
    u.semilla.value = Math.round(t * 60) % 97;
    u.exposicion.value = ajustes.exposicion ?? 1.0;
    u.saturacion.value = ajustes.saturacion ?? 1.06;
    u.vineta.value = ajustes.vineta ?? 0.32;
    u.grano.value = ajustes.grano ?? 0.018;
    u.tinte.value.set(...(ajustes.tinte || [1, 1, 1]));
    u.velo.value.set(...(ajustes.velo || [0, 0, 0, 0]));
    this.pasada(this.matFinal, null);
  }
}
