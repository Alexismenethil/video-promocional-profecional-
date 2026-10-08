// El guion completo: qué se dibuja en cada instante t (apertura del retablo, doce tarjetas con sus
// transiciones, cierre del retablo). 128 BPM, 32 compases = 60 s exactos.
import { estadoRetablo, vistaRetablo, M, PORTAL, aB, aA, b } from './guion_retablo.js';
import { E, prog, lerp, clamp, vaiven } from './util.js';

// Transición que lleva a la tarjeta j (desde la j−1) y su ventana alrededor del compás: de cues.js
export const TRANS = window.CUES.trans;
export const VENTANA = window.CUES.ventana;

const desplazar = (v, dx = 0, dy = 0, dz = 0) => ({ ...v, pos: [v.pos[0] + dx, v.pos[1] + dy, v.pos[2] + dz], mira: [v.mira[0] + dx, v.mira[1] + dy, v.mira[2] + dz] });
function girar(v, ang) {
  const dx = v.mira[0] - v.pos[0], dz = v.mira[2] - v.pos[2];
  const c = Math.cos(ang), s = Math.sin(ang);
  return { ...v, mira: [v.pos[0] + dx * c + dz * s, v.mira[1], v.pos[2] - dx * s + dz * c] };
}

export function crearGuion(motor, mundo, tr) {
  const { retablo, nichos, camA, camB } = mundo;
  const r = motor.renderer;
  const N = nichos.length;
  const T1 = nichos[0].def.t0;
  const FIN = nichos[N - 1].def.t0 + nichos[N - 1].def.dur;   // b(29)

  function pintar(escena, cam, destino) {
    motor.limpiar(destino);
    r.setRenderTarget(destino);
    r.render(escena, cam);
  }
  function nicho(n, t, v, k, K, destino = motor.rtMuestra) {
    motor.colocar(camB, v, k, K);
    n.actualizar(t, camB, v);
    pintar(n.escena, camB, destino);
  }
  const vistaDe = (n, t) => n.def.camara(t - n.def.t0);

  // ── apertura: el retablo y la zambullida por el portal hasta la tarjeta 1 ──
  function apertura(t, k, K) {
    const n = nichos[0];
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
      if (vB.pos[2] <= B[2]) return nicho(n, t, vB, k, K);
    }
    retablo_(t, vA, e, n, vB, B, k, K);
  }
  function retablo_(t, vA, e, n, vB, B, k, K) {
    if (e.puerta > 0.001) {
      const vb = vB || { pos: aB(vA.pos, B), mira: aB(vA.mira, B), fov: vA.fov, foco: vA.foco * PORTAL.escala, apertura: vA.apertura * PORTAL.escala };
      nicho(n, t, vb, k, K, motor.rtB);
      retablo.portal.material.uniforms.t.value = motor.rtB.texture;
    }
    motor.colocar(camA, vA, k, K);
    retablo.actualizar(t, vA, e);
    pintar(retablo.escena, camA, motor.rtMuestra);
  }

  // ── cierre: la cámara sale del último nicho por el portal, las puertas se cierran, vuelve la firma ──
  function cierre(t, k, K) {
    const n = nichos[N - 1];
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
      if (vB.pos[2] <= B[2]) return nicho(n, t, vB, k, K);
      const vA = { pos: aA(vB.pos, B), mira: aA(vB.mira, B), fov: vB.fov, foco: vB.foco / PORTAL.escala, apertura: vB.apertura / PORTAL.escala, cerca: 0.02 };
      return retablo_(t, vA, e, n, vB, B, k, K);
    }
    retablo_(t, vistaRetablo(t), e, n, null, B, k, K);
  }

  // ── tarjetas y transiciones ──
  function tarjetas(t, k, K) {
    // ¿estamos en la ventana de alguna transición?
    for (let j = 1; j < N; j++) {
      const T = TRANS[j];
      if (!T) continue;
      const tb = nichos[j].def.t0;
      const [antes, despues] = VENTANA[T.tipo];
      if (t >= tb - antes && t < tb + despues) return transicion(T, nichos[j - 1], nichos[j], tb, t, k, K);
    }
    let c = 0;
    for (let i = 0; i < N; i++) if (t >= nichos[i].def.t0) c = i;
    nicho(nichos[c], t, vistaDe(nichos[c], t), k, K);
  }

  function transicion(T, A, B, tb, t, k, K) {
    const vA = vistaDe(A, t), vB = vistaDe(B, t);
    if (T.tipo === 'paneo' || T.tipo === 'grua') {
      const D = T.tipo === 'paneo' ? 13 : 7;
      const tc = tb - 0.04;
      const [antes, despues] = VENTANA[T.tipo];
      const off = (v, d) => (T.tipo === 'paneo' ? desplazar(v, d * T.dir) : desplazar(v, 0, d * T.dir));
      if (t < tc) nicho(A, t, off(vA, D * E.inCubic(prog(t, tb - antes, tc))), k, K);
      else nicho(B, t, off(vB, -D * (1 - E.outCubic(prog(t, tc, tb + despues)))), k, K);
      const u = prog(t, tb - 0.34, tb + 0.26);
      if (u > 0 && u < 1) (T.tipo === 'paneo' ? tr.pilastra(u, T.dir) : tr.cornisa(u, T.dir));
      return;
    }
    if (T.tipo === 'latigo') {
      const [antes, despues] = VENTANA.latigo;
      const A_ = 0.95;
      if (t < tb) nicho(A, t, girar(vA, -T.dir * A_ * E.inQuart(prog(t, tb - antes, tb))), k, K);
      else nicho(B, t, girar(vB, T.dir * A_ * (1 - E.outQuart(prog(t, tb, tb + despues)))), k, K);
      return;
    }
    if (T.tipo === 'tablas') {
      const [antes] = VENTANA.tablas;
      nicho(A, t, vA, k, K, motor.rtA);
      nicho(B, t, vB, k, K, motor.rtB);
      tr.tablas(motor.rtA.texture, motor.rtB.texture, prog(t, tb - antes, tb), T.juego, T.desde);
      return;
    }
    if (T.tipo === 'hojas') {
      if (t < tb) nicho(A, t, desplazar(vA, 0.6 * E.inCubic(prog(t, tb - 0.56, tb)) * T.dir), k, K);
      else nicho(B, t, vB, k, K);
      tr.hojas(prog(t, tb - 0.56, tb + 0.56), T.dir);
      return;
    }
    if (T.tipo === 'puertas') {
      if (t < tb) nicho(A, t, vA, k, K); else nicho(B, t, vB, k, K);
      let a;
      if (t < tb - 0.04) a = E.inCubic(prog(t, tb - 0.46, tb - 0.04));
      else if (t < tb + 0.12) a = 1 - Math.abs(vaiven((t - tb + 0.04) / 0.16, 1.2, 4)) * 0.03;
      else a = 1 - E.outCubic(prog(t, tb + 0.12, tb + 0.66));
      const brillo = t > tb + 0.04 ? clamp((t - tb - 0.04) / 0.1) * (1 - prog(t, tb + 0.2, tb + 0.5)) : 0;
      tr.puertas(a, brillo);
      return;
    }
  }

  return {
    dibujar(t, k, K) {
      if (t < T1) return apertura(t, k, K);
      if (t >= FIN) return cierre(t, k, K);
      return tarjetas(t, k, K);
    },
    T1, FIN,
  };
}
