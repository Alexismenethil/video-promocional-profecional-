// Utilidades sin estado: curvas de animación, azar con semilla, secuencias para el muestreo.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, u) => a + (b - a) * u;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
export const mix3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

export const E = {
  lin: (u) => u,
  inQuad: (u) => u * u,
  outQuad: (u) => 1 - (1 - u) * (1 - u),
  inOutQuad: (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2),
  inCubic: (u) => u * u * u,
  outCubic: (u) => 1 - Math.pow(1 - u, 3),
  inOutCubic: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  inQuart: (u) => u * u * u * u,
  outQuart: (u) => 1 - Math.pow(1 - u, 4),
  inOutQuart: (u) => (u < 0.5 ? 8 * u ** 4 : 1 - Math.pow(-2 * u + 2, 4) / 2),
  outQuint: (u) => 1 - Math.pow(1 - u, 5),
  inOutQuint: (u) => (u < 0.5 ? 16 * u ** 5 : 1 - Math.pow(-2 * u + 2, 5) / 2),
  inExpo: (u) => (u <= 0 ? 0 : Math.pow(2, 10 * u - 10)),
  outExpo: (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u)),
  inOutExpo: (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? Math.pow(2, 20 * u - 10) / 2 : (2 - Math.pow(2, -20 * u + 10)) / 2),
  inOutSine: (u) => -(Math.cos(Math.PI * u) - 1) / 2,
  outSine: (u) => Math.sin((u * Math.PI) / 2),
  outBack: (u, s = 1.70158) => 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2),
  inBack: (u, s = 1.70158) => (s + 1) * u * u * u - s * u * u,
};
for (const k of Object.keys(E)) { const f = E[k]; E[k] = (u, ...r) => f(clamp(u), ...r); }

// Resorte amortiguado que llega a 1: rebota `rebotes` veces, se apaga con `amort`.
export const resorte = (u, f = 1.6, amort = 5.5) => {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return 1 - Math.exp(-amort * u) * Math.cos(f * Math.PI * 2 * u) * (1 - u * u * u);
};
// Vaivén que se apaga (golpe que tiembla): 0 en u=0, oscila y vuelve a 0.
export const vaiven = (u, f = 3, amort = 7) => (u <= 0 || u >= 1 ? 0 : Math.sin(u * Math.PI * 2 * f) * Math.exp(-amort * u));

// Azar con semilla (mulberry32): siempre el mismo video.
export function azar(semilla = 1) {
  let a = semilla >>> 0;
  const f = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.entre = (a0, b0) => a0 + (b0 - a0) * f();
  f.signo = () => (f() < 0.5 ? -1 : 1);
  f.elegir = (arr) => arr[Math.floor(f() * arr.length) % arr.length];
  return f;
}

// Secuencia de Halton (muestreo bien repartido para subpíxel y lente).
export function halton(i, b) {
  let f = 1, r = 0;
  while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); }
  return r;
}

// Ruido suave 1D periódico (suma de senos con fases fijas): para derivas lentas que no se repiten feo.
export function deriva(t, semilla = 0, f = 0.2, periodo = 0) {
  const r = azar(semilla * 7919 + 13);
  let s = 0, n = 0;
  for (let k = 0; k < 3; k++) {
    const a = 1 / (k + 1);
    let fk = f * (1 + k * 1.618);
    if (periodo) fk = Math.max(1, Math.round(fk * periodo)) / periodo;     // vueltas enteras en el bucle
    s += a * Math.sin(t * fk * Math.PI * 2 + r() * 6.283);
    n += a;
  }
  return s / n;
}
// Velocidad angular (rad/s) redondeada para dar vueltas enteras en `periodo` segundos
export const vueltas = (w, periodo) => (periodo ? (2 * Math.PI * Math.round((w * periodo) / (2 * Math.PI))) / periodo : w);

export const hex = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
