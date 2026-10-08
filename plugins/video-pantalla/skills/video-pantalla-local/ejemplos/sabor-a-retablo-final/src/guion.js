// El guion completo: qué se dibuja en cada instante t. Apertura del retablo (la cámara entra por el
// portal al primer tablero), veintidós tableros con sus transiciones, cierre del retablo (la cámara
// sale del último tablero, portazo, vuelve la firma). 128 BPM, 72 compases = 135 s exactos.
import { estadoRetablo, vistaRetablo, M, PORTAL, aB, aA } from './guion_retablo.js';
import { E, prog, lerp, clamp, vaiven } from './util.js';
import { DC, mezcla } from './tablero.js';

const TRANS = window.CUES.trans;
const VENTANA = window.CUES.ventana;

function girar(v, ang) {
  const dx = v.mira[0] - v.pos[0], dz = v.mira[2] - v.pos[2];
  const c = Math.cos(ang), s = Math.sin(ang);
  return { ...v, mira: [v.pos[0] + dx * c + dz * s, v.mira[1], v.pos[2] - dx * s + dz * c] };
}
// la cámara del tablero, más atrás (z × k) para la zambullida por la flor
const alejar = (v, k) => ({ ...v, pos: [v.pos[0], v.pos[1], v.pos[2] * k], foco: (v.foco || DC) * k });

export function crearGuion(motor, mundo, tr) {
  const { retablo, tableros, camA, camB } = mundo;
  const r = motor.renderer;
  const N = tableros.length;
  const T1 = tableros[0].def.t0;
  const FIN = tableros[N - 1].def.t0 + tableros[N - 1].def.dur;

  function pintar(escena, cam, destino) {
    motor.limpiar(destino);
    r.setRenderTarget(destino);
    r.render(escena, cam);
  }
  function tablero(n, t, v, k, K, destino = motor.rtMuestra, op = {}) {
    motor.colocar(camB, v, k, K);
    n.actualizar(t, v, op);
    pintar(n.escena, camB, destino);
  }
  const vistaDe = (n, t) => n.vista(t - n.def.t0);

  // ── apertura: el retablo y la zambullida por el portal hasta el primer tablero ──
  function apertura(t, k, K) {
    const n = tableros[0];
    const e = estadoRetablo(t);
    let vA = vistaRetablo(t), vB = null;
    const B = n.def.portal;
    if (t >= M.zambullida[0]) {
      const v0 = vistaRetablo(M.zambullida[0]);
      const ini = { pos: aB(v0.pos, B), mira: aB(v0.mira, B) };
      const fin = vistaDe(n, T1);
      const w = E.inOutCubic(prog(t, ...M.zambullida));
      vB = { pos: ini.pos.map((x, i) => lerp(x, fin.pos[i], w)), mira: ini.mira.map((x, i) => lerp(x, fin.mira[i], w)),
        fov: fin.fov, foco: 0, apertura: lerp(v0.apertura * PORTAL.escala, fin.apertura, w) };
      vB.foco = Math.hypot(vB.pos[0] - fin.mira[0], vB.pos[1] - fin.mira[1], vB.pos[2] - fin.mira[2]);
      vA = { pos: aA(vB.pos, B), mira: aA(vB.mira, B), fov: vB.fov, foco: vB.foco / PORTAL.escala, apertura: vB.apertura / PORTAL.escala, cerca: 0.02 };
      if (vB.pos[2] <= B[2]) return tablero(n, t, vB, k, K);
    }
    retablo_(t, vA, e, n, vB, B, k, K);
  }
  function retablo_(t, vA, e, n, vB, B, k, K) {
    if (e.puerta > 0.001) {
      const vb = vB || { pos: aB(vA.pos, B), mira: aB(vA.mira, B), fov: vA.fov, foco: vA.foco * PORTAL.escala, apertura: vA.apertura * PORTAL.escala };
      tablero(n, t, vb, k, K, motor.rtB);
      retablo.portal.material.uniforms.t.value = motor.rtB.texture;
    }
    motor.colocar(camA, vA, k, K);
    retablo.actualizar(t, vA, e);
    pintar(retablo.escena, camA, motor.rtMuestra);
  }

  // ── cierre: la cámara sale del último tablero por el portal, las puertas se cierran, vuelve la firma ──
  function cierre(t, k, K) {
    const n = tableros[N - 1];
    const e = estadoRetablo(t);
    const B = n.def.portal;
    if (t < M.sale[1]) {
      const v0 = vistaDe(n, M.sale[0]);
      const v1 = vistaRetablo(M.sale[1]);
      const fin = { pos: aB(v1.pos, B), mira: aB(v1.mira, B) };
      const w = E.inOutCubic(prog(t, ...M.sale));
      const vB = { pos: v0.pos.map((x, i) => lerp(x, fin.pos[i], w)), mira: v0.mira.map((x, i) => lerp(x, fin.mira[i], w)),
        fov: v0.fov, foco: 0, apertura: lerp(v0.apertura, v1.apertura * PORTAL.escala, w) };
      vB.foco = Math.hypot(vB.pos[0] - v0.mira[0], vB.pos[1] - v0.mira[1], vB.pos[2] - v0.mira[2]);
      if (vB.pos[2] <= B[2]) return tablero(n, t, vB, k, K);
      const vA = { pos: aA(vB.pos, B), mira: aA(vB.mira, B), fov: vB.fov, foco: vB.foco / PORTAL.escala, apertura: vB.apertura / PORTAL.escala, cerca: 0.02 };
      return retablo_(t, vA, e, n, vB, B, k, K);
    }
    retablo_(t, vistaRetablo(t), e, n, null, B, k, K);
  }

  // ── tableros y transiciones ──
  function enTableros(t, k, K) {
    for (let j = 1; j < N; j++) {
      const T = TRANS[j];
      if (!T) continue;
      const tb = tableros[j].def.t0;
      const [antes, despues] = VENTANA[T.tipo];
      if (t >= tb - antes && t < tb + despues) return transicion(T, tableros[j - 1], tableros[j], tb, t, k, K);
    }
    let c = 0;
    for (let i = 0; i < N; i++) if (t >= tableros[i].def.t0) c = i;
    tablero(tableros[c], t, vistaDe(tableros[c], t), k, K);
  }

  function transicion(T, A, B, tb, t, k, K) {
    const vA = vistaDe(A, t), vB = vistaDe(B, t);
    const [antes, despues] = VENTANA[T.tipo];
    if (T.tipo === 'latigo') {
      const ang = 0.42;
      if (t < tb) tablero(A, t, girar(vA, -T.dir * ang * E.inQuart(prog(t, tb - antes, tb))), k, K);
      else tablero(B, t, girar(vB, T.dir * ang * (1 - E.outQuart(prog(t, tb, tb + despues)))), k, K);
      return;
    }
    if (T.tipo === 'tablas') {
      tablero(A, t, vA, k, K, motor.rtA);
      tablero(B, t, vB, k, K, motor.rtB);
      // entre tablas, el tono hondo de las dos escenas (no negro)
      const fondo = mezcla(A.def.pal.oscuro, B.def.pal.oscuro, 0.5);
      tr.tablas(motor.rtA.texture, motor.rtB.texture, prog(t, tb - antes, tb), T.juego, T.desde, 0.62, mezcla(fondo, '#000000', 0.45));
      return;
    }
    if (T.tipo === 'empuje') {
      tablero(A, t, vA, k, K, motor.rtA);
      tablero(B, t, vB, k, K, motor.rtB);
      tr.empuje(motor.rtA.texture, motor.rtB.texture, E.inOutCubic(prog(t, tb - antes, tb + despues)), T.dir);
      return;
    }
    if (T.tipo === 'flor') {
      // 0 → 0,45: la flor aparece girando; 0,45 → 0,6: queda; 0,6 → 0,93: la cámara entra por el disco.
      // En el disco se ve el tablero siguiente entero, en miniatura (su cámara, alejada lo justo para que
      // quepa); cuando el disco cubre la pantalla, la cámara ya está en su lugar y se corta a él.
      const u = prog(t, tb - antes, tb + despues);
      const zoom = E.inExpo(prog(u, 0.6, 0.93));
      if (u >= 0.93) return tablero(B, t, vB, k, K);
      const aparece = E.outBack(prog(u, 0.0, 0.45), 1.6);
      const R = 0.34 * aparece + zoom * (2.63 - 0.34);           // radio de los pétalos, en altos de pantalla
      const rDisco = 0.3885 * R;
      tablero(B, t, alejar(vB, Math.max(1, 1.02 / Math.max(rDisco, 0.02))), k, K, motor.rtB);
      tablero(A, t, alejar(vA, lerp(1.0, 0.9, E.inCubic(prog(u, 0.45, 0.93)))), k, K);
      const giro = -(1 - E.outCubic(prog(u, 0, 0.5))) * 2.2 - u * 0.9;
      const frios = ['#2f93a8', '#176879', '#5fb4c1'];
      const petalo = frios.includes(B.def.pal.fondo) || frios.includes(A.def.pal.fondo) ? '#f7c75a' : '#2f93a8';
      tr.flor(motor.rtB.texture, R, giro, { petalo, filo: 0.05 * (1 - zoom) });
      return;
    }
    if (T.tipo === 'puertas') {
      if (t < tb) tablero(A, t, vA, k, K); else tablero(B, t, vB, k, K);
      let a;
      if (t < tb - 0.04) a = E.inCubic(prog(t, tb - 0.46, tb - 0.04));
      else if (t < tb + 0.12) a = 1 - Math.abs(vaiven((t - tb + 0.04) / 0.16, 1.2, 4)) * 0.03;
      else a = 1 - E.outCubic(prog(t, tb + 0.12, tb + 0.66));
      const brillo = t > tb + 0.04 ? clamp((t - tb - 0.04) / 0.1) * (1 - prog(t, tb + 0.2, tb + 0.5)) : 0;
      tr.puertas(a, brillo);
      return;
    }
  }

  // Ajustes de la última pasada: el salón del retablo, más viñeta; los tableros, más limpios
  function ajustes(t) {
    const salon = t < T1 ? 1 - E.inOutSine(prog(t, M.zambullida[0], T1)) : E.inOutSine(prog(t, M.sale[0] + 0.3, M.sale[1] + 0.4));
    return { bloom: lerp(0.18, 0.22, salon), radio: 0.45, umbral: 1.12, vineta: lerp(0.2, 0.38, salon) };
  }

  return {
    dibujar(t, k, K) {
      if (t < T1) return apertura(t, k, K);
      if (t >= FIN) return cierre(t, k, K);
      return enTableros(t, k, K);
    },
    ajustes, T1, FIN,
  };
}
