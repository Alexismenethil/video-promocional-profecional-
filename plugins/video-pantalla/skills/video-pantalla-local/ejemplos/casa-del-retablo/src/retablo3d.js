// Un retablo del catálogo armado en 3D desde su foto (puertas abiertas de frente): la caja es la silueta
// del centro extruida hacia atrás (techo a dos aguas o arco, con sus cantos de madera), y cada puerta es
// su silueta con grosor, colgada de su bisagra. Las puertas giran de verdad: se cierran por delante de la
// caja (por fuera se ve su pintura en espejo, un poco más oscura) y se abren con la luz y la sombra
// cambiando. Todo con material Lambert calibrado: una cara de frente se ve con el color de la foto.
import * as THREE from 'three';
import { lerp } from './util.js';

export const MADERA = '#231915';

// Textura vacía (mientras la foto no está cargada) — mantiene compilado el shader con mapa
let _vacia = null;
export function texVacia() {
  if (!_vacia) {
    _vacia = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    _vacia.needsUpdate = true;
  }
  return _vacia;
}

// UV de las tapas de la extrusión: de coordenadas locales (X, Y) a la textura
function generadorUV(fx) {
  const v2 = (x, y) => new THREE.Vector2(...fx(x, y));
  return {
    generateTopUV(geo, v, a, b, c) {
      return [v2(v[a * 3], v[a * 3 + 1]), v2(v[b * 3], v[b * 3 + 1]), v2(v[c * 3], v[c * 3 + 1])];
    },
    generateSideWallUV(geo, v, a, b, c, d) {
      const p = (i) => new THREE.Vector2((v[i * 3] + v[i * 3 + 1]) * 0.7, v[i * 3 + 2] * 0.7);
      return [p(a), p(b), p(c), p(d)];
    },
  };
}

// La cara de atrás de una puerta (el exterior, que se ve cuando está cerrada) un poco más oscura
function conDorso(mat, oscuro = 0.8) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vDorso;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDorso = step(normal.z, -0.5);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vDorso;')
      .replace('#include <map_fragment>', `#include <map_fragment>\ndiffuseColor.rgb *= mix(1.0, ${oscuro.toFixed(3)}, vDorso);`);
  };
  mat.customProgramCacheKey = () => 'dorso' + oscuro;
  return mat;
}

// P0: datos del producto (w, h, apoyo, bisagras, centro, silueta). k: mundo por px de la textura.
export function crearRetablo3D(P0, { k, fondoRel = 0.42, grosorRel = 0.024, madera = MADERA, sombras = true } = {}) {
  const W = P0.w, H = P0.h, ap = P0.apoyo;
  const [bL, bR] = P0.bisagras;
  const cx = (bL + bR) / 2;
  const aLocal = ([u, v]) => [(u * W - cx) * k, (v * H - (H - ap)) * k];
  const aUV = (X, Y) => [(X / k + cx) / W, (Y / k + H - ap) / H];
  const altoC = (P0.centro[3] - P0.centro[1]) * k;
  const fondo = altoC * fondoRel;
  const grosor = altoC * grosorRel;
  const anchoC = (bR - bL) * k;

  const matCara = new THREE.MeshLambertMaterial({ map: texVacia(), alphaTest: 0.5 });
  const matPuerta = conDorso(new THREE.MeshLambertMaterial({ map: texVacia(), alphaTest: 0.5 }));
  const matCanto = new THREE.MeshLambertMaterial({ color: new THREE.Color(madera) });

  const grupo = new THREE.Group();     // origen: abajo al centro de la caja, en su frente
  const forma = (poli, dx = 0) => {
    const s = new THREE.Shape();
    poli.forEach((q, i) => { const [x, y] = aLocal(q); if (i) s.lineTo(x - dx, y); else s.moveTo(x - dx, y); });
    s.closePath();
    return s;
  };

  // la caja
  const geoC = new THREE.ExtrudeGeometry(forma(P0.silueta.centro), { depth: fondo, bevelEnabled: false, curveSegments: 1, UVGenerator: generadorUV(aUV) });
  geoC.translate(0, 0, -fondo);
  const caja = new THREE.Mesh(geoC, [matCara, matCanto]);
  grupo.add(caja);

  // las puertas, colgadas de su bisagra (apenas delante de la caja)
  const zB = grosor * 0.15;
  const puertas = [['izq', bL, 1], ['der', bR, -1]].map(([lado, b, signo]) => {
    const xB = (b - cx) * k;
    const geo = new THREE.ExtrudeGeometry(forma(P0.silueta[lado], xB), {
      depth: grosor, bevelEnabled: false, curveSegments: 1, UVGenerator: generadorUV((X, Y) => aUV(X + xB, Y)) });
    geo.translate(0, 0, -grosor);
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const ancho = Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x));
    const malla = new THREE.Mesh(geo, [matPuerta, matCanto]);
    const piv = new THREE.Group();
    piv.position.set(xB, 0, zB);
    piv.add(malla);
    grupo.add(piv);
    return { lado, signo, piv, malla, ancho };
  });

  [caja, ...puertas.map((p) => p.malla)].forEach((m) => { m.castShadow = sombras; m.receiveShadow = sombras; });

  const altoTotal = (H - P0.caja[1] - (H - ap)) * k;      // de la base a lo más alto
  const anchoTotal = (P0.caja[2] - P0.caja[0]) * k;

  return {
    grupo, caja, puertas, fondo, grosor, anchoC, altoC, altoTotal, anchoTotal, k,
    mats: [matCara, matPuerta],
    ponerTextura(tex) { matCara.map = tex; matPuerta.map = tex; },
    // cierre: 0 abiertas como en la foto … 1 cerradas por delante (se puede dar uno por puerta)
    puertasA(cIzq, cDer = cIzq) {
      puertas.forEach((p) => {
        const c = p.lado === 'izq' ? cIzq : cDer;
        p.piv.rotation.y = p.signo * Math.PI * c;
        // al cerrar, cada puerta tapa justo media caja
        p.malla.scale.x = lerp(1, (anchoC / 2 * 1.012) / p.ancho, Math.min(1, c * 1.15));
      });
    },
  };
}

// Producto plano (recorte): plano Lambert con sombra recortada por su alfa
export function crearPlano(P0, { k, sombras = true } = {}) {
  const w = P0.w * k, h = P0.h * k;
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(w / 2 - P0.apoyoX * k, P0.apoyo * k - h / 2, 0);    // origen: punto de apoyo
  const mat = new THREE.MeshLambertMaterial({ map: texVacia(), alphaTest: 0.35, side: THREE.DoubleSide });
  // espejos: el vidrio refleja (degradado de la pared y un brillo que cruza); uniformes creados antes de compilar
  const uni = P0.vidrio ? { vidrio: { value: texVacia() }, tiempo: { value: 0 }, c1: { value: new THREE.Color('#e9f1f4') }, c2: { value: new THREE.Color('#6d8590') } } : null;
  if (uni) {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D vidrio; uniform float tiempo; uniform vec3 c1, c2;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          float vv = texture2D(vidrio, vMapUv).r;
          float gy = vMapUv.y * 0.85 + 0.08 + sin(vMapUv.x * 3.0 + tiempo * 0.3) * 0.03;
          vec3 refl = mix(c2, c1, smoothstep(0.0, 1.0, gy));
          float banda = exp(-pow((vMapUv.x + vMapUv.y * 0.55 - fract(tiempo * 0.16) * 2.4 + 0.4) * 6.0, 2.0));
          float banda2 = exp(-pow((vMapUv.x + vMapUv.y * 0.55 - fract(tiempo * 0.16) * 2.4 + 0.25) * 18.0, 2.0));
          refl += vec3(1.0, 0.99, 0.96) * (banda * 0.45 + banda2 * 0.35);
          diffuseColor.rgb = mix(diffuseColor.rgb, refl, vv);`);
    };
    mat.customProgramCacheKey = () => 'espejo';
  }
  const malla = new THREE.Mesh(geo, mat);
  const prof = new THREE.MeshDepthMaterial({ map: texVacia(), alphaTest: 0.35, depthPacking: THREE.RGBADepthPacking });
  malla.customDepthMaterial = prof;
  malla.castShadow = sombras;
  malla.receiveShadow = false;
  const grupo = new THREE.Group();
  grupo.add(malla);
  return {
    grupo, malla, mats: [mat], uni,
    altoTotal: (P0.apoyo - P0.caja[1]) * k, anchoTotal: (P0.caja[2] - P0.caja[0]) * k, k,
    ponerTextura(tex, vidrio = null) { mat.map = tex; prof.map = tex; if (uni && vidrio) uni.vidrio.value = vidrio; },
    tiempo(t) { if (uni) uni.tiempo.value = t; },
    colores(c1, c2) { if (uni) { uni.c1.value.set(c1); uni.c2.value.set(c2); } },
  };
}
