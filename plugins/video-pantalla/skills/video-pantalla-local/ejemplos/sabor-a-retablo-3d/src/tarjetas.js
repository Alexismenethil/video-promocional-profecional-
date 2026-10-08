// Las doce tarjetas de la carta: color, decorado, productos, textos, precio y cámara de cada nicho.
// Cinco arquetipos: solo flotante, dúo flotante, fotos en arcos, dúo de pie, trío de pie.
import { FUENTE } from './texturas.js';
import { E, prog, lerp, clamp } from './util.js';

const C = window.CUES;
const PUL = 60 / (C.bpm || 128), COMP = 4 * PUL;
const b = (compas, pulso = 0) => (compas - 1) * COMP + pulso * PUL;
const CREMA = '#f9f6ee', VERDE = '#0d3b2b', MOSTAZA = '#f7c75a', CORAL = '#f0b8a4';

export function orbita(mira, dist, elev, azim, fov = 30, extra = {}) {
  const e = (elev * Math.PI) / 180, a = (azim * Math.PI) / 180;
  const pos = [mira[0] + dist * Math.sin(a) * Math.cos(e), mira[1] + dist * Math.sin(e), mira[2] + dist * Math.cos(a) * Math.cos(e)];
  return { pos, mira, fov, foco: dist, ...extra };
}
const l3 = (a, c, u) => a.map((v, i) => lerp(v, c[i], u));
// Cámara de sostén: va de `a` a `c` en la tarjeta (mira, dist, elev, azim)
const camino = (a, c, ap = 0.12) => (tl) => {
  const u = E.inOutSine(prog(tl, -0.6, 4.4));
  return orbita(l3(a.mira, c.mira, u), lerp(a.dist, c.dist, u), lerp(a.elev, c.elev, u), lerp(a.azim, c.azim, u), 30,
    { apertura: ap, foco: lerp(a.dist, c.dist, u) + (a.foco || 0) });
};

// ── textos ──
const rotulo = (texto, pos, t, color = MOSTAZA, alto = 0.3, alinear = 'izq') => ({ texto, pos, t,
  estilo: { familia: FUENTE.texto, estilo: 'normal', peso: 700, px: 120, tracking: 34, altoMundo: alto, color, alinear } });
const titulo = (texto, pos, t, alto = 1.3, color = CREMA, alinear = 'izq') => ({ texto, pos, t,
  estilo: { px: 260, altoMundo: alto, color, peso: 500, alinear } });
const linea = (texto, pos, t, color = '#e8f3f4', alto = 0.27, alinear = 'izq') => ({ texto, pos, t,
  estilo: { familia: FUENTE.texto, estilo: 'normal', peso: 500, px: 110, tracking: 2, altoMundo: alto, color, alinear } });
const precio = (p, pos, t, color, alto = 0.46, alinear = 'centro') => ({ texto: `S/ ${p}`, pos, t,
  estilo: { familia: FUENTE.texto, estilo: 'normal', peso: 800, px: 160, tracking: 4, altoMundo: alto, color, alinear } });
const nombre = (texto, pos, t, color, alto = 0.66, alinear = 'centro') => ({ texto, pos, t,
  estilo: { px: 240, altoMundo: alto, color, peso: 600, alinear } });

// Paletas de nicho (pared, claro, hondo, piso, acento, lado) y tintas
const PAL = {
  turquesa: { pared: '#2f93a8', claro: '#6cc3d1', hondo: '#0e4a59', piso: '#2b8697', acento: MOSTAZA, lado: '#2a8799', tinta: CREMA, sub: '#e8f3f4', rot: MOSTAZA, flor: ['#3ba1b5', '#56b5c6', '#2b8a9e'], arco2: '#e9b44c' },
  verde: { pared: '#145c43', claro: '#2f8063', hondo: '#062519', piso: '#12523c', acento: MOSTAZA, lado: '#13563f', tinta: CREMA, sub: '#d9ece3', rot: MOSTAZA, flor: ['#1d6b50', '#2a7a5e', '#175e46'], arco2: '#2f93a8' },
  coral: { pared: '#e47c66', claro: '#f6b09f', hondo: '#9a3d2f', piso: '#d8705b', acento: VERDE, lado: '#dd735d', tinta: VERDE, sub: '#4a1d14', rot: VERDE, flor: ['#ec8c77', '#f19c88', '#de745f'], arco2: '#2f93a8' },
  mostaza: { pared: '#e3ae48', claro: '#f6d585', hondo: '#a2731c', piso: '#d6a03d', acento: VERDE, lado: '#dca643', tinta: VERDE, sub: '#4b3510', rot: VERDE, flor: ['#e9b957', '#efc469', '#dba443'], arco2: '#e47c66' },
  hondo: { pared: '#176879', claro: '#3e9aab', hondo: '#062c35', piso: '#145d6c', acento: CORAL, lado: '#166474', tinta: CREMA, sub: '#e2f0f2', rot: CORAL, flor: ['#1f7586', '#2a8394', '#1a6b7c'], arco2: '#f0b8a4' },
  terracota: { pared: '#b5533c', claro: '#d98463', hondo: '#5e2316', piso: '#a64b35', acento: MOSTAZA, lado: '#ad4f39', tinta: CREMA, sub: '#f6e3d8', rot: MOSTAZA, flor: ['#bf5f46', '#c96c51', '#b0513b'], arco2: '#f7c75a' },
  rosa: { pared: '#e88aa0', claro: '#f7bccb', hondo: '#a2445b', piso: '#df8097', acento: VERDE, lado: '#e3849b', tinta: VERDE, sub: '#4f1a27', rot: VERDE, flor: ['#ee98ac', '#f2a7b8', '#e48399'], arco2: '#2f93a8' },
  aqua: { pared: '#5fb7c4', claro: '#a3dbe2', hondo: '#24707d', piso: '#55aab7', acento: VERDE, lado: '#59b0bd', tinta: VERDE, sub: '#123f45', rot: VERDE, flor: ['#6cc0cc', '#7cc8d3', '#5aafbc'], arco2: '#f7c75a' },
};

// ═════════ arquetipos ═════════
function soloFlotante({ id, t0, P0, pal, lado = 'der', rot, tit, desc, ancho = 5.4, angulo = 0, entrada = 'baja', extra = {} }) {
  const s = lado === 'der' ? 1 : -1;
  const px = s * 2.9;
  const tx = s > 0 ? -5.5 : 1.25;
  return {
    id, t0, dur: 2 * COMP, origen: [0, 0, 0], color: pal, entrada,
    camara: camino({ mira: [s * 0.35, 3.4, -4.4], dist: 17.0, elev: 10.5, azim: -s * 10 + angulo },
      { mira: [s * 0.7, 3.4, -4.4], dist: 15.4, elev: 9.0, azim: -s * 3 + angulo }),
    flor: { R: 4.4, pos: [px, 6.0, -13.6], colores: pal.flor },
    arcos: [
      { ancho: 7.6, alto: 9.0, grosor: 0.6, prof: 0.8, pos: [px, 0, -8.8], color: '#f6f0e2' },
      { ancho: 10.2, alto: 10.8, grosor: 0.42, prof: 0.5, pos: [px, 0, -11.6], color: pal.arco2 },
    ],
    productos: [{ slug: P0.slug, med: P0, ancho, pos: [px, 0, -4.4], modo: 'flotante', elevar: 2.85,
      podio: { radio: 2.5, alto: 1.0 }, sombra: [ancho * 1.02, ancho * 0.82, 0.5, 0, 0] }],
    textos: [
      rotulo(rot, [tx + 0.15, 6.15, -2.2], 0.15, pal.rot),
      ...tit.map((l, i) => titulo(l, [tx + (i === 1 ? 0.45 : 0), 4.8 - i * 1.35, -2.2], 0.25 + i * 0.12, 1.25, pal.tinta)),
      ...(desc ? [linea(desc, [tx + 0.2, 4.8 - tit.length * 1.35 + 0.62, -2.2], 0.62, pal.sub)] : []),
    ],
    sellos: [{ precio: P0.precio, pos: [s > 0 ? -0.1 : 0.1, 6.15, -2.6], tam: 1.6, t: 0.85,
      colores: { petalo: pal.acento === VERDE ? MOSTAZA : pal.acento, corona: CREMA, disco: VERDE, tinta: CREMA } }],
    reservas: s > 0 ? [[0.44, 0.15, 0.97, 0.92], [0.03, 0.12, 0.44, 0.7]] : [[0.03, 0.15, 0.56, 0.92], [0.56, 0.12, 0.97, 0.7]],
    motivos: { n: 28, semilla: t0 * 7 | 0, escala: 0.0052, cerca: 0.14 },
    ...extra,
  };
}

function duoFlotante({ id, t0, Ps, pal, rot, ancho = 4.8, entrada = 'baja', extra = {} }) {
  const xs = [-3.75, 3.75];
  return {
    id, t0, dur: 2 * COMP, origen: [0, 0, 0], color: pal, entrada, escalon: 0.16,
    camara: camino({ mira: [-0.4, 4.45, -4.8], dist: 19.2, elev: 8, azim: 7 }, { mira: [0.3, 4.45, -4.8], dist: 17.9, elev: 7, azim: -4 }),
    flor: { R: 4.6, pos: [0, 6.4, -13.6], colores: pal.flor },
    arcos: [
      { ancho: 17.0, alto: 11.6, grosor: 0.7, prof: 0.9, pos: [0, 0, -10.0], color: '#f6f0e2' },
      { ancho: 6.4, alto: 8.6, grosor: 0.4, prof: 0.5, pos: [0, 0, -11.8], color: pal.arco2 },
    ],
    productos: Ps.map((P0, i) => ({ slug: P0.slug, med: P0, ancho, pos: [xs[i], 0, -4.8], modo: 'flotante', elevar: 2.55,
      podio: { radio: 2.1, alto: 0.9 }, sombra: [ancho, ancho * 0.8, 0.5, 0, 0] })),
    textos: [
      rotulo(rot, [0, 7.85, -3.2], 0.12, pal.rot, 0.32, 'centro'),
      ...Ps.flatMap((P0, i) => [nombre(P0.nombre, [xs[i] * 1.0, 6.6, -3.0], 0.3 + i * 0.15, pal.tinta),
        precio(P0.precio, [xs[i] * 1.0, 6.0, -3.0], 0.55 + i * 0.15, pal.acento === VERDE ? VERDE : pal.acento)]),
    ],
    reservas: [[0.1, 0.05, 0.9, 0.9]],
    motivos: { n: 22, semilla: t0 * 7 | 0, escala: 0.0048, cerca: 0.12 },
    ...extra,
  };
}

function arcosFotos({ id, t0, Ps, pal, rot, focos, extra = {} }) {
  const xs = [-5.7, 0, 5.7];
  return {
    id, t0, dur: 2 * COMP, origen: [0, 0, 0], color: pal, escalon: 0.12,
    camara: camino({ mira: [0, 4.75, -5], dist: 19.0, elev: 5, azim: -6 }, { mira: [0, 4.75, -5], dist: 17.8, elev: 4, azim: 5 }),
    flor: { R: 4.8, pos: [0, 7.4, -13.6], colores: pal.flor },
    arcos: [],
    pedestales: [{ pos: [0, 0, -5.4], ancho: 18.4, alto: 0.75, fondo: 2.6 }],
    fotos: Ps.map((P0, i) => ({ slug: P0.slug, med: P0, pos: [xs[i], 0.75, -5.6], ancho: 4.5, alto: 5.9, foco: focos[i], zoom: 1.12 })),
    productos: [],
    textos: [
      rotulo(rot, [0, 8.55, -4.6], 0.1, pal.rot, 0.34, 'centro'),
      ...Ps.flatMap((P0, i) => [nombre(P0.nombre, [xs[i], 2.2, -4.85], 0.35 + i * 0.14, CREMA, 0.6),
        precio(P0.precio, [xs[i], 1.45, -4.85], 0.55 + i * 0.14, MOSTAZA, 0.44)]),
    ],
    reservas: [[0.08, 0.04, 0.92, 0.92]],
    motivos: { n: 20, semilla: t0 * 7 | 0, escala: 0.0048, cerca: 0.12 },
    ...extra,
  };
}

function duoDePie({ id, t0, Ps, pal, rot, altos = [4.0, 4.0], dx = 3.7, entrada = 'baja', vapores = null, destellos = null, extra = {} }) {
  const xs = [-dx, dx];
  const H = 1.25;
  return {
    id, t0, dur: 2 * COMP, origen: [0, 0, 0], color: pal, entrada, escalon: 0.16,
    camara: camino({ mira: [0.3, 4.65, -4.8], dist: 18.0, elev: 6, azim: -7 }, { mira: [-0.2, 4.65, -4.8], dist: 16.8, elev: 5, azim: 4 }),
    flor: { R: 4.6, pos: [0, 6.6, -13.6], colores: pal.flor },
    arcos: [
      { ancho: 7.0, alto: 9.4, grosor: 0.55, prof: 0.7, pos: [-dx, 0, -9.6], color: '#f6f0e2' },
      { ancho: 7.0, alto: 9.4, grosor: 0.55, prof: 0.7, pos: [dx, 0, -9.6], color: '#f6f0e2' },
    ],
    pedestales: [{ pos: [0, 0, -4.8], ancho: 15.2, alto: H, fondo: 3.6, rep: 4 }],
    productos: Ps.map((P0, i) => ({ slug: P0.slug, med: P0, alto: altos[i], pos: [xs[i], H, -4.6], modo: 'pie', inclina: 0.6,
      sombra: [P0.caja ? (P0.caja[2] - P0.caja[0]) / (P0.caja[3] - P0.caja[1]) * altos[i] * 1.05 : 3, 1.2, 0.55, 0, 0.1],
      vapor: vapores ? vapores[i] : null, destellos: destellos ? destellos[i] : 0, zonaDestellos: [0.15, 0.85, 0.1, 0.7] })),
    textos: [
      rotulo(rot, [0, 8.0, -3.6], 0.12, pal.rot, 0.32, 'centro'),
      ...Ps.flatMap((P0, i) => [nombre(P0.nombre, [xs[i], 7.0, -3.6], 0.3 + i * 0.15, pal.tinta, 0.7),
        precio(P0.precio, [xs[i], 6.3, -3.6], 0.55 + i * 0.15, pal.acento === VERDE ? VERDE : pal.acento, 0.48)]),
    ],
    reservas: [[0.1, 0.05, 0.9, 0.9]],
    motivos: { n: 22, semilla: t0 * 7 | 0, escala: 0.0048, cerca: 0.12 },
    ...extra,
  };
}

function trioDePie({ id, t0, Ps, pal, rot, alto = 5.0, entrada = 'baja', extra = {} }) {
  const xs = [-4.9, 0, 4.9];
  const H = 1.3;
  return {
    id, t0, dur: 2 * COMP, origen: [0, 0, 0], color: pal, entrada, escalon: 0.12,
    camara: camino({ mira: [0, 5.0, -4.8], dist: 19.6, elev: 5, azim: 6 }, { mira: [0, 5.0, -4.8], dist: 18.4, elev: 4, azim: -5 }),
    flor: { R: 5.0, pos: [0, 7.6, -13.6], colores: pal.flor },
    arcos: xs.map((x) => ({ ancho: 4.6, alto: 9.2, grosor: 0.4, prof: 0.6, pos: [x, 0, -9.8], color: '#f6f0e2' })),
    pedestales: [{ pos: [0, 0, -4.8], ancho: 16.6, alto: H, fondo: 3.4, rep: 4 }],
    productos: Ps.map((P0, i) => ({ slug: P0.slug, med: P0, alto, pos: [xs[i], H, -4.6], modo: 'pie', inclina: 0.6,
      sombra: [2.4, 1.0, 0.55, 0, 0.1], destellos: 5, zonaDestellos: [0.12, 0.88, 0.32, 0.8] })),
    textos: [
      rotulo(rot, [0, 9.15, -3.8], 0.1, pal.rot, 0.34, 'centro'),
      ...Ps.flatMap((P0, i) => [nombre(P0.nombre, [xs[i], 8.25, -3.6], 0.3 + i * 0.12, pal.tinta, 0.66),
        precio(P0.precio, [xs[i], 7.6, -3.6], 0.5 + i * 0.12, pal.acento === VERDE ? VERDE : pal.acento, 0.46)]),
    ],
    reservas: [[0.1, 0.04, 0.9, 0.9]],
    motivos: { n: 20, semilla: t0 * 7 | 0, escala: 0.0048, cerca: 0.12 },
    ...extra,
  };
}

// ═════════ las doce ═════════
export function definirTarjetas(P) {
  const tk = (k) => b(5 + 2 * k);
  return [
    soloFlotante({ id: 'clasica', t0: tk(0), P0: P['crepe-lliqlla'], pal: PAL.turquesa, rot: 'CREPES SALADOS', tit: ['Crepe', 'Clásica'],
      desc: 'Jamón, mozzarella y salsa golf', entrada: 'pop', extra: { portal: [0.7, 3.3, 24], tEntrada: -1.55 } }),
    duoFlotante({ id: 'salados', t0: tk(1), Ps: [P['crepe-hawaiana'], P['crepe-danzante']], pal: PAL.verde, rot: 'CREPES SALADOS' }),
    duoFlotante({ id: 'autor', t0: tk(2), Ps: [P['green-crep'], P['crepa-arcoiris']], pal: PAL.coral, rot: 'CREPES DE AUTOR', entrada: 'pop' }),
    arcosFotos({ id: 'dulces', t0: tk(3), Ps: [P['mega-crepa'], P['crepa-tropical'], P['crepa-fresa']], pal: PAL.mostaza, rot: 'CREPES DULCES',
      focos: [[0.45, 0.5], [0.42, 0.52], [0.52, 0.5]] }),
    soloFlotante({ id: 'promo', t0: tk(4), P0: P['promo-banana-crep'], pal: PAL.hondo, lado: 'izq', rot: 'PROMOCIÓN', tit: ['Banana', 'Crep'],
      desc: 'Plátano y leche condensada', ancho: 5.6, entrada: 'pop' }),
    duoDePie({ id: 'cafe', t0: tk(5), Ps: [P['capuccino-chantilly'], P['mocaccino']], pal: PAL.terracota, rot: 'CAFÉ DE ALTURA', altos: [3.5, 3.5],
      vapores: [[1.8, 3.4, -0.05, 3.3, 0.34], [1.8, 3.4, -0.05, 3.3, 0.34]], destellos: [3, 3], entrada: 'sube' }),
    duoDePie({ id: 'postres', t0: tk(6), Ps: [P['torta-de-chocolate'], P['red-velvet']], pal: PAL.rosa, rot: 'POSTRES DE LA CASA', altos: [3.1, 3.4] }),
    duoDePie({ id: 'chapla', t0: tk(7), Ps: [P['chapla-chancho-caja-china'], P['chapla-pollo-deshilachado']], pal: PAL.mostaza, rot: 'SABOR AYACUCHANO',
      altos: [2.9, 2.9], dx: 3.9, entrada: 'gira' }),
    trioDePie({ id: 'milkshakes', t0: tk(8), Ps: [P['milkshake-fresa'], P['milkshake-choco-sublime'], P['milkshake-muyuchi']], pal: PAL.aqua, rot: 'MILKSHAKES', alto: 5.3 }),
    trioDePie({ id: 'frappes', t0: tk(9), Ps: [P['frappe-moca'], P['frappe-oreo'], P['frappe-menta']], pal: PAL.verde, rot: 'FRAPPÉS', alto: 5.4, entrada: 'sube' }),
    duoDePie({ id: 'copas', t0: tk(10), Ps: [P['copa-kids'], P['copa-plim-plim']], pal: PAL.rosa, rot: 'HELADOS ARTESANALES', altos: [4.6, 4.9], entrada: 'pop', destellos: [5, 5] }),
    duoDePie({ id: 'split', t0: tk(11), Ps: [P['banana-split'], P['copa-oreo']], pal: PAL.turquesa, rot: 'HELADOS ARTESANALES', altos: [3.0, 4.6], dx: 3.9, destellos: [4, 5],
      extra: { portal: [0, 4.4, 22] } }),
  ];
}
