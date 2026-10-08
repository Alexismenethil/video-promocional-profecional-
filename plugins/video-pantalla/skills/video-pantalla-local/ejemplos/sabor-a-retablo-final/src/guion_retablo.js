// Coreografía del retablo: la apertura (compases 1–3) y el cierre (los tres últimos).
// Todo en función de t, con los tiempos de cues.js (128 BPM: compás 1,875 s, pulso 0,46875 s).
import { clamp, E, prog, lerp, vaiven, resorte } from './util.js';
import { RET } from './retablo.js';

const C = window.CUES;
const PUL = 60 / (C.bpm || 128), COMP = 4 * PUL;
const MITAD = C.dur / 2;          // antes: apertura; después: cierre
export const b = (compas, pulso = 0) => (compas - 1) * COMP + pulso * PUL;   // compás desde 1

// Momentos clave (se pueden pisar desde cues.js)
export const M = Object.assign({
  disuelve: [b(1, 2), b(2, 3)],          // el logo se deshace en polvo hacia la ranura
  alCentro: [b(1, 3), b(3)],             // el retablo va al centro y queda de frente
  ranura: [b(2, 1), b(4)],               // la ranura se enciende
  golpes: [b(3, 1), b(3, 3), b(3, 3.5)], // las puertas tiemblan (anticipación)
  abre: b(4),                            // ¡se abren!
  zambullida: [b(4, 1.6), b(5)],         // la cámara entra (cruza el portal ~b(5) − 0,3)
  // cierre
  sale: [b(29), b(29, 2.6)],             // la cámara sale del último nicho por el portal
  cierra: b(30),                         // portazo
  alLado: [b(30, 1), b(31, 1)],          // el retablo vuelve a su lugar de firma
  arma: [b(30, 2), b(31, 3)],            // el polvo arma el logo
  brillo: [b(31, 3.2), b(32, 1.6)],      // brillo turquesa sobre el logo
}, C.retablo || {});

const FIRMA = { x: -4.7, rotY: 0.24 };
// Vistas de cámara en el salón del retablo
const V_FIRMA = { pos: [0.6, 6.0, 27.5], mira: [0.6, 5.3, 0], fov: 30, foco: 27.5, apertura: 0.12 };
const V_FRENTE = { pos: [0, 5.5, 24.0], mira: [0, 5.1, 0], fov: 30, foco: 24, apertura: 0.13 };
const V_CERCA = { pos: [0, 4.9, 13.5], mira: [0, 4.7, 0], fov: 30, foco: 13.5, apertura: 0.1 };

const mixV = (a, bv, u) => ({
  pos: a.pos.map((v, i) => lerp(v, bv.pos[i], u)), mira: a.mira.map((v, i) => lerp(v, bv.mira[i], u)),
  fov: lerp(a.fov, bv.fov, u), foco: lerp(a.foco, bv.foco, u), apertura: lerp(a.apertura, bv.apertura, u),
});

// Estado del retablo en t (apertura en la primera mitad del bucle, cierre en la segunda)
export function estadoRetablo(t) {
  const e = { x: FIRMA.x, rotY: FIRMA.rotY, puerta: 0, ranura: 0, rayos: 0, destello: 0, luzIn: 0, firmaU: 0,
    brilloFirma: -1, estallido: -1, tiembla: 0, salto: 0, firmaOpac: 1 };
  if (t < MITAD) {
    // ── apertura ──
    const uc = E.inOutCubic(prog(t, ...M.alCentro));
    e.x = lerp(FIRMA.x, 0, uc);
    e.rotY = lerp(FIRMA.rotY, 0, uc);
    e.firmaU = E.inOutSine(prog(t, ...M.disuelve));
    const ur = prog(t, ...M.ranura);
    e.ranura = Math.pow(ur, 1.6) * (0.85 + 0.15 * Math.sin(t * 13));
    for (const g of M.golpes) {
      const u = (t - g) / 0.45;
      e.tiembla += vaiven(u, 3.2, 6) * 0.035;
      e.salto += vaiven(u, 1.6, 9) * 0.05 * 0;
      e.ranura += Math.max(0, 1 - Math.abs(t - g) / 0.12) * 0.8;
    }
    e.rayos = Math.pow(ur, 2.2) * 0.35;
    if (t >= M.abre) {
      const ua = (t - M.abre) / 0.95;
      e.puerta = clamp(resorte(ua, 1.15, 5.2), 0, 1.08);
      e.ranura = 0;
      e.destello = Math.exp(-(t - M.abre) / 0.12) * 1.3 + 0.18 * Math.exp(-(t - M.abre) / 1.0);
      e.rayos = 1.4 * Math.exp(-(t - M.abre) / 0.32) * (1 - prog(t, M.abre + 0.5, M.abre + 0.9));
      e.luzIn = 8 * Math.exp(-(t - M.abre) / 0.45) + 2;
      e.estallido = t - M.abre;
    }
  } else {
    // ── cierre ──
    e.x = 0; e.rotY = 0; e.firmaU = 1;
    const tc = M.cierra;
    const uCierre = prog(t, tc - 0.62, tc);
    e.puerta = t < tc ? 1 - E.inCubic(uCierre) : 0;
    if (t >= tc) {
      e.tiembla = vaiven((t - tc) / 0.5, 2.5, 6) * 0.05;
      e.salto = vaiven((t - tc) / 0.35, 1.5, 8) * 0.03;
    }
    e.luzIn = t < tc ? 2 + 3 * uCierre : 0;
    e.destello = 0;
    e.ranura = t >= tc ? 2.2 * Math.exp(-(t - tc) / 0.25) : 0;
    e.rayos = t >= tc ? 0.8 * Math.exp(-(t - tc) / 0.35) : 0;
    const ul = E.inOutCubic(prog(t, ...M.alLado));
    e.x = lerp(0, FIRMA.x, ul);
    e.rotY = lerp(0, FIRMA.rotY, ul);
    e.firmaU = 1 - E.inOutSine(prog(t, ...M.arma));
    e.brilloFirma = prog(t, ...M.brillo) > 0 && prog(t, ...M.brillo) < 1 ? lerp(-0.4, 1.4, E.inOutSine(prog(t, ...M.brillo))) : -1;
  }
  return e;
}

// Cámara en el salón del retablo (espacio A)
export function vistaRetablo(t) {
  if (t < MITAD) {
    if (t < M.alCentro[0]) return mixV(V_FIRMA, V_FIRMA, 0);
    const u1 = E.inOutCubic(prog(t, M.alCentro[0], M.alCentro[1]));
    const v1 = mixV(V_FIRMA, V_FRENTE, u1);
    const u2 = E.inOutSine(prog(t, M.alCentro[1], M.abre + 0.5));
    return mixV(v1, V_CERCA, u2 * 0.55);
  }
  // cierre: desde cerca (saliendo del portal) hacia la firma, con un arco suave alrededor del retablo
  const u1 = E.outCubic(prog(t, M.sale[1], M.cierra + 0.6));
  const v1 = mixV(V_CERCA, V_FRENTE, u1);
  const u2 = E.inOutCubic(prog(t, M.alLado[0], M.alLado[1] + 0.6));
  const v = mixV(v1, V_FIRMA, u2);
  const ua = prog(t, M.cierra - 0.2, M.alLado[1] + 0.6);
  const ang = 0.22 * Math.sin(Math.PI * E.inOutSine(ua));
  const dx = v.pos[0] - v.mira[0], dz = v.pos[2] - v.mira[2];
  const c = Math.cos(ang), s = Math.sin(ang);
  return { ...v, pos: [v.mira[0] + dx * c + dz * s, v.pos[1], v.mira[2] - dx * s + dz * c] };
}

// Portal: centro del fondo de la caja (espacio A, retablo al centro y de frente) ↔ espacio B (nicho)
export const PORTAL = {
  A: [0, RET.base + RET.H / 2, RET.D / 2 - 0.02],
  escala: 3.4,
};
export const aB = (p, B) => p.map((v, i) => B[i] + PORTAL.escala * (v - PORTAL.A[i]));
export const aA = (p, B) => p.map((v, i) => PORTAL.A[i] + (v - B[i]) / PORTAL.escala);
