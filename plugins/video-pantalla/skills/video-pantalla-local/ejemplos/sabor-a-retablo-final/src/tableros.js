// Los veintidós tableros de la carta. Las maquetas son las de la primera versión (px de diseño
// 1920×1080): «solo» (producto grande a un lado, título enorme y precio en la flor), «par» (título al
// costado y dos productos), «arriba» (título arriba y dos o tres productos), «autor» (dos platos
// traslapados), «fila» (vasos en fila). Y tres para fotos cortadas por el encuadre: «soloBorde» y
// «parBorde» (el producto entra grande desde el costado y la punta cortada queda fuera de cuadro; el plato
// del otro lado ya viene completado por completar_plato.py) y «soloAbajo» (el vaso sube desde abajo).
import { FUENTE, lienzo } from './texturas.js';
import { CREMA, VERDE, mezcla } from './tablero.js';

const C = window.CUES;
const PR = () => window.DATOS.productos;

export const PAL = {
  turquesa: { fondo: '#2f93a8', claro: '#58b7c9', oscuro: '#145a6b', tinta: CREMA, acento: '#f7c75a', tono: ['#ffffff', 0.075] },
  verde: { fondo: '#0d3b2b', claro: '#235f49', oscuro: '#05201a', tinta: CREMA, acento: '#8bcbd7', tono: ['#8bcbd7', 0.07] },
  mostaza: { fondo: '#e3b04b', claro: '#f4cd7a', oscuro: '#b9852a', tinta: VERDE, acento: '#9a3a26', tono: ['#ffffff', 0.12] },
  terracota: { fondo: '#a8452f', claro: '#c86448', oscuro: '#68241a', tinta: '#fbf1e6', acento: '#f7c75a', tono: ['#ffd9b8', 0.07] },
  hondo: { fondo: '#176879', claro: '#2d8a9c', oscuro: '#0a3c48', tinta: CREMA, acento: '#f7c75a', tono: ['#ffffff', 0.07] },
  coral: { fondo: '#e78a7c', claro: '#f6ab9b', oscuro: '#bd5d4e', tinta: VERDE, acento: VERDE, tono: ['#ffffff', 0.11] },
  rosa: { fondo: '#e58fa3', claro: '#f6bdca', oscuro: '#b3576e', tinta: VERDE, acento: '#7c2338', tono: ['#ffffff', 0.12] },
  aqua: { fondo: '#5fb4c1', claro: '#9fd7df', oscuro: '#2a7b88', tinta: VERDE, acento: '#9a3a26', tono: ['#ffffff', 0.12] },
  crema: { fondo: '#efe4cc', claro: '#fbf5e8', oscuro: '#cbb88f', tinta: VERDE, acento: '#a8452f', tono: ['#c9a96e', 0.16] },
};
const sombraTxt = (pal) => (pal.tinta === VERDE ? null : { blur: 13, dy: 2.2, alfa: 0.22 });
const coloresSello = (pal) => ({ petalo: pal.acento === VERDE || pal.acento === '#9a3a26' || pal.acento === '#7c2338' || pal.acento === '#a8452f' ? '#f7c75a' : pal.acento,
  corona: CREMA, disco: VERDE, tinta: CREMA });

// medir texto (las fuentes ya están cargadas cuando se arman los tableros)
const _g = lienzo(8, 8).getContext('2d');
function medir(texto, font) { _g.font = font; return _g.measureText(texto).width; }

// Encaje de un recorte (como la primera versión): la caja del objeto cabe en maxW×maxH, centrada en cx
// y apoyada en `base`.
function encaje(slug, cx, base, maxW, maxH) {
  const p = PR()[slug];
  const [x0, y0, x1, y1] = p.caja, sw = x1 - x0, sh = y1 - y0;
  const s = Math.min(maxW / sw, maxH / sh);
  return { slug, s, cx, base, maxW, maxH, izq: cx - (sw * s) / 2, der: cx + (sw * s) / 2, arriba: base - (p.apoyo - y0) * s, abajo: base, p };
}
const prod = (L, extra = {}) => ({ slug: L.slug, cx: L.cx, base: L.base, maxW: L.maxW, maxH: L.maxH, ...extra });

// Destello sobre el filo del recorte (vaso, copa, plato): lado, altura (0 arriba … 1 abajo), cuándo
function filo(slug, lado, v, tb, tam = 44) {
  const f = PR()[slug].bordes.reduce((m, x) => (Math.abs(x[0] - v) < Math.abs(m[0] - v) ? x : m));
  return [lado === 'izq' ? f[1] + 0.014 : f[2] - 0.014, f[0], tb, tam];
}
const PULSO = 60 / C.bpm;
const pulso = (n) => n * PULSO;                     // destellos y golpes, a tiempo con la música

// ── textos ──
const rotulo = (texto, x, y, color, t, alinear = 'izq', px = 25) => ({ texto: texto.toUpperCase(), x, y, t, abre: 10,
  estilo: { familia: FUENTE.texto, peso: 700, estilo: 'normal', px, tracking: 8, color, alinear } });
const titulo = (texto, x, y, px, color, t, { peso = 600, alinear = 'izq', sombra = null } = {}) => ({ texto, x, y, t,
  estilo: { familia: FUENTE.display, peso, estilo: 'italic', px, color, alinear, sombra } });
const renglon = (texto, x, y, color, t, px = 33, alinear = 'izq') => ({ texto, x, y, t,
  estilo: { familia: FUENTE.texto, peso: 500, estilo: 'normal', px, tracking: 0.5, color, alinear } });
const nombre = (texto, cx, y, color, t, px = 58, sombra = null, z = undefined) => ({ texto, x: cx, y, t, z,
  estilo: { familia: FUENTE.display, peso: 600, estilo: 'italic', px, color, alinear: 'centro', sombra } });
const precio = (p, cx, y, color, t, px = 54, z = undefined) => ({ texto: `S/ ${p}`, x: cx, y, t, z,
  estilo: { familia: FUENTE.texto, peso: 800, estilo: 'normal', px, tracking: 2, color, alinear: 'centro' } });

// Radio del sello de precio (px de diseño)
const R_SELLO = 156;

// Tiempos (s desde que llega el tablero): rótulo, título, descripción, nombres, precios, sello
const T = { rotulo: 0.05, titulo: 0.18, desc: 0.62, nombres: 0.4, precios: 0.62, sello: 0.8 };

// ═════════ maquetas ═════════
function solo({ slug, pal, lado = 'der', rot, tit, escalas = null, desc, flor, maxW, maxH, base = 960, cx = null, etiqueta, extraProd = {}, sello = null, ...resto }) {
  const der = lado !== 'izq';
  const P0 = PR()[slug];
  const L = encaje(slug, cx ?? (der ? 1340 : 560), base, maxW ?? (der ? 920 : 880), maxH ?? 760);
  const X = der ? 150 : 1170, Y = 300;
  const n = tit || [P0.nombre];
  const esc = escalas || n.map(() => 1);
  const ancho = Math.max(...n.map((s, j) => medir(s, `italic 600 100px ${FUENTE.display}`) * esc[j]));
  const libre = der ? L.izq - 90 - X : 1820 - X;
  const tam = Math.min(150, Math.floor((100 * libre) / ancho));
  const textos = [rotulo(rot, X + 4, Y, pal.acento, T.rotulo)];
  let yy = Y + 40;
  n.forEach((s, j) => {
    const tj = tam * esc[j];
    yy += tj * (j === 0 ? 0.92 : 1.08);
    textos.push(titulo(s, X, yy, tj, esc[j] < 1 ? pal.acento : pal.tinta, T.titulo + j * 0.12, { peso: esc[j] < 1 ? 500 : 600, sombra: sombraTxt(pal) }));
  });
  const yDesc = yy + 82;
  const d = desc ?? P0.desc;
  if (d) textos.push(renglon(d, X + 3, yDesc, pal.tinta, T.desc));
  const [sx, sy] = sello ? sello(L) : [der ? L.izq + 70 : L.der - 70, L.arriba + 50];
  return {
    pal, flor: flor || (der ? [1290, 560, 690] : [640, 560, 680]), florTono: pal.tono,
    prods: [prod(L, extraProd)],
    textos,
    filetes: d ? [{ x: X + 3, y: yDesc + 44, ancho: 300, color: pal.acento, t: T.desc - 0.25 }] : [],
    sellos: [{ precio: P0.precio, x: sx, y: sy, R: R_SELLO, colores: coloresSello(pal), t: T.sello, etiqueta }],
    ...resto,
  };
}

function par({ slugs, pal, lado = 'der', rot, tit, flor, maxW = 580, maxH = 600, base = 810, xs = null, extraProds = [], ...resto }) {
  const izq = lado === 'izq';                       // izq: los productos a la izquierda, texto a la derecha
  const X = izq ? 1270 : 150, Y = 380;
  const xx = xs || (izq ? [340, 930] : [1000, 1590]);
  const Ls = slugs.map((s, i) => encaje(s, xx[i], base, maxW, maxH));
  const textos = [rotulo(rot, X + 4, Y, pal.acento, T.rotulo, 'izq', 24),
    titulo(tit[0], X, Y + 160, 140, pal.tinta, T.titulo, { sombra: sombraTxt(pal) }),
    titulo(tit[1], X + 6, Y + 272, 88, pal.acento, T.titulo + 0.14, { peso: 500, sombra: sombraTxt(pal) })];
  Ls.forEach((L, i) => {
    const yN = L.abajo + 82;
    textos.push(nombre(L.p.nombre, L.cx, yN, pal.tinta, T.nombres + i * 0.22, 58, sombraTxt(pal)));
    textos.push(precio(L.p.precio, L.cx, yN + 70, pal.acento, T.precios + i * 0.22));
  });
  return { pal, flor: flor || (izq ? [1340, 520, 640] : [600, 520, 640]), florTono: pal.tono,
    prods: Ls.map((L, i) => prod(L, extraProds[i] || {})), textos, ...resto };
}

function arriba({ slugs, pal, tit, cxs, base = 835, anchos, maxH = 500, flor, extraProds = [], icono = true, pxNombre = 58, ...resto }) {
  const xs = cxs || (slugs.length === 2 ? [620, 1300] : [400, 960, 1520]);
  const Ls = slugs.map((s, i) => {
    const p = PR()[s];
    const asp = (p.caja[2] - p.caja[0]) / (p.caja[3] - p.caja[1]);
    const aw = anchos ? anchos[i] : (slugs.length === 2 ? (asp > 1.6 ? 760 : 640) : 470);
    return encaje(s, xs[i], base, aw, maxH);
  });
  const textos = [titulo(tit, 960, 232, 98, pal.tinta, T.titulo, { alinear: 'centro', sombra: sombraTxt(pal) })];
  Ls.forEach((L, i) => {
    const yN = L.abajo + 82;
    textos.push(nombre(L.p.nombre, L.cx, yN, pal.tinta, T.nombres + i * 0.2, pxNombre, sombraTxt(pal)));
    textos.push(precio(L.p.precio, L.cx, yN + 68, pal.acento, T.precios + i * 0.2));
  });
  return { pal, flor: flor || [960, 640, 760], florTono: pal.tono, prods: Ls.map((L, i) => prod(L, extraProds[i] || {})), textos,
    iconos: icono ? [{ x: 960, y: 110, R: 30, colores: { petalo: pal.acento === VERDE ? '#2f93a8' : pal.acento, corona: CREMA, disco: VERDE }, t: T.rotulo }] : [],
    ...resto };
}

// Cinco vasos en fila, con su nombre y precio debajo
function fila({ slugs, pal, tit, rot, alto = 610, base = 826, paso = 330, tSube = -0.55, ...resto }) {
  const x0 = 960 - (paso * (slugs.length - 1)) / 2;
  const prods = slugs.map((s, i) => {
    const p = PR()[s];
    return { slug: s, cx: x0 + paso * i, base, maxW: 999, maxH: alto, entrada: 'sube', t: tSube + i * 0.07, brillos: [filo(s, i % 2 ? 'izq' : 'der', 0.42, pulso(3 + i))] };
  });
  const textos = [titulo(tit, 960, 196, 98, pal.tinta, T.titulo, { alinear: 'centro', sombra: sombraTxt(pal) })];
  if (rot) textos.push(rotulo(rot, 960, 86, pal.acento, T.rotulo, 'centro', 24));
  slugs.forEach((s, i) => {
    const p = PR()[s];
    textos.push(nombre(p.nombre, x0 + paso * i, base + 76, pal.tinta, T.nombres + i * 0.1, 50, sombraTxt(pal)));
    textos.push(precio(p.precio, x0 + paso * i, base + 134, pal.acento, T.precios + i * 0.1, 48));
  });
  return { pal, flor: [960, 560, 760], florTono: pal.tono, prods, textos, ...resto };
}

// ── productos grandes que entran desde el borde de la pantalla ──
// Cuando la foto corta la punta del crepe, ese lado queda fuera de cuadro (y el plato del otro lado ya está
// completado). x de un px del recorte: cx + (u − centroCaja)·s, invertido si va en espejo.
function colocar(slug, s, espejo = false) {
  const p = PR()[slug];
  const cc = (p.caja[0] + p.caja[2]) / 2, sg = espejo ? -1 : 1;
  return { p, cc, sg, xDe: (cx, u) => cx + (u - cc) * s * sg, cxPara: (u, x) => x - (u - cc) * s * sg };
}
// borde de la foto que mira hacia `hacia` ('izq' | 'der'); si no hay corte, el canto del plato
function bordeHacia(p, hacia, espejo) {
  const lado = espejo ? (hacia === 'izq' ? 'der' : 'izq') : hacia;
  const hay = (p.puntas || {})[lado];
  const u = hay ? (lado === 'izq' ? p.foto[0] : p.foto[2]) : (lado === 'izq' ? p.caja[0] : p.caja[2]);
  return { u, lado, hay };
}

// Solo con el producto grande entrando desde un costado (el texto, del otro lado)
function soloBorde({ slug, pal, lado = 'der', espejo = false, ancho = 1150, base = 990, fuera = 50, rot, tit, escalas = null, desc,
  etiqueta, extraProd = {}, ...resto }) {
  const P0 = PR()[slug];
  const s = ancho / (P0.caja[2] - P0.caja[0]);
  const c = colocar(slug, s, espejo);
  const borde = bordeHacia(P0, lado, espejo);
  const cx = c.cxPara(borde.u, lado === 'der' ? 1920 + fuera : -fuera);
  const izqX = Math.min(c.xDe(cx, P0.caja[0]), c.xDe(cx, P0.caja[2])), derX = Math.max(c.xDe(cx, P0.caja[0]), c.xDe(cx, P0.caja[2]));
  const arriba = base - (P0.apoyo - P0.caja[1]) * s;
  const der = lado === 'der';
  const X = der ? 150 : Math.max(1170, derX + 90), Y = 300;
  const n = tit || [P0.nombre];
  const esc = escalas || n.map(() => 1);
  const anchoT = Math.max(...n.map((t, j) => medir(t, `italic 600 100px ${FUENTE.display}`) * esc[j]));
  const libre = der ? izqX - 90 - X : 1820 - X;
  const tam = Math.min(150, Math.floor((100 * libre) / anchoT));
  const textos = [rotulo(rot, X + 4, Y, pal.acento, T.rotulo)];
  let yy = Y + 40;
  n.forEach((t, j) => {
    const tj = tam * esc[j];
    yy += tj * (j === 0 ? 0.92 : 1.08);
    textos.push(titulo(t, X, yy, tj, esc[j] < 1 ? pal.acento : pal.tinta, T.titulo + j * 0.12, { peso: esc[j] < 1 ? 500 : 600, sombra: sombraTxt(pal) }));
  });
  const yDesc = yy + 82;
  const d = desc ?? P0.desc;
  if (d) textos.push(renglon(d, X + 3, yDesc, pal.tinta, T.desc));
  // sello: sobre la punta cortada del lado de adentro (si la hay); si no, en la esquina de arriba del producto
  const otro = bordeHacia(P0, der ? 'izq' : 'der', espejo);
  let sx, sy, R = R_SELLO;
  if (otro.hay) {
    const [v0, v1] = P0.puntas[otro.lado].reduce((m, q) => [Math.min(m[0], q[0]), Math.max(m[1], q[1])], [1e9, -1e9]);
    sx = c.xDe(cx, otro.u); sy = base - (P0.apoyo - (v0 + v1) / 2) * s;
    R = Math.max(R_SELLO, ((v1 - v0) * s) / 2 + 40);
  } else {
    sx = der ? izqX + 70 : derX - 70; sy = arriba + 50;
  }
  return {
    pal, flor: der ? [1290, 560, 690] : [640, 560, 680], florTono: pal.tono,
    prods: [{ slug, cx, base, s, espejo, ...extraProd }],
    textos,
    filetes: d ? [{ x: X + 3, y: yDesc + 44, ancho: 300, color: pal.acento, t: T.desc - 0.25 }] : [],
    sellos: [{ precio: P0.precio, x: sx, y: sy, R, colores: coloresSello(pal), t: T.sello, etiqueta }],
    ...resto,
  };
}

// Dos productos grandes, cada uno entrando desde su costado; título arriba al centro
function parBorde({ izq, der, pal, tit, ancho = 900, base = 880, fuera = 50, extra = [{}, {}], ...resto }) {
  const lados = [[izq, 'izq'], [der, 'der']].map(([q, hacia], i) => {
    const P0 = PR()[q.slug];
    const s = ancho / (P0.caja[2] - P0.caja[0]);
    const c = colocar(q.slug, s, q.espejo);
    const borde = bordeHacia(P0, hacia, q.espejo);
    const cx = c.cxPara(borde.u, hacia === 'der' ? 1920 + (q.fuera ?? fuera) : -(q.fuera ?? fuera));
    const x0 = Math.min(c.xDe(cx, P0.caja[0]), c.xDe(cx, P0.caja[2])), x1 = Math.max(c.xDe(cx, P0.caja[0]), c.xDe(cx, P0.caja[2]));
    const vis = (Math.max(0, x0) + Math.min(1920, x1)) / 2;
    return { P0, s, cx, vis, q, i };
  });
  const textos = [titulo(tit, 960, 196, 92, pal.tinta, T.titulo, { alinear: 'centro', sombra: sombraTxt(pal) })];
  lados.forEach((L) => {
    textos.push(nombre(L.P0.nombre, L.vis, base + 78, pal.tinta, T.nombres + L.i * 0.22, 58, sombraTxt(pal)));
    textos.push(precio(L.P0.precio, L.vis, base + 144, pal.acento, T.precios + L.i * 0.22));
  });
  return { pal, flor: [960, 460, 720], florTono: pal.tono,
    prods: lados.map((L) => ({ slug: L.q.slug, cx: L.cx, base, s: L.s, espejo: L.q.espejo, ...(extra[L.i] || {}) })),
    textos,
    iconos: [{ x: 960, y: 78, R: 28, colores: { petalo: pal.tinta === VERDE ? '#2f93a8' : pal.acento, corona: CREMA, disco: VERDE }, t: T.rotulo }],
    ...resto };
}

// Vaso grande que sube desde abajo (su pie queda fuera de cuadro: así no se ve el corte de la foto)
function soloAbajo({ slug, pal, alto = 980, cx = 1360, fuera = 70, rot, tit, escalas, desc, extraProd = {}, ...resto }) {
  const P0 = PR()[slug];
  const s = alto / (P0.apoyo - P0.caja[1]);
  const base = 1080 + fuera;
  const arriba = base - alto;
  const izqX = cx - ((P0.caja[2] - P0.caja[0]) * s) / 2;
  const X = 150, Y = 300;
  const n = tit;
  const esc = escalas || n.map(() => 1);
  const anchoT = Math.max(...n.map((t, j) => medir(t, `italic 600 100px ${FUENTE.display}`) * esc[j]));
  const tam = Math.min(150, Math.floor((100 * (izqX - 90 - X)) / anchoT));
  const textos = [rotulo(rot, X + 4, Y, pal.acento, T.rotulo)];
  let yy = Y + 40;
  n.forEach((t, j) => {
    const tj = tam * esc[j];
    yy += tj * (j === 0 ? 0.92 : 1.08);
    textos.push(titulo(t, X, yy, tj, esc[j] < 1 ? pal.acento : pal.tinta, T.titulo + j * 0.12, { peso: esc[j] < 1 ? 500 : 600, sombra: sombraTxt(pal) }));
  });
  const yDesc = yy + 82;
  textos.push(renglon(desc, X + 3, yDesc, pal.tinta, T.desc));
  return { pal, flor: [1290, 520, 700], florTono: pal.tono,
    prods: [{ slug, cx, base, s, entrada: 'sube', subir: 520, t: 0.0, ...extraProd }],
    textos, filetes: [{ x: X + 3, y: yDesc + 44, ancho: 300, color: pal.acento, t: T.desc - 0.25 }],
    sellos: [{ precio: P0.precio, x: izqX + 40, y: arriba + 190, R: R_SELLO, colores: coloresSello(pal), t: T.sello }],
    ...resto };
}

// ═════════ los veintidós ═════════
export function definirTableros() {
  const t0 = C.t0, dur = C.tablero;
  const B = (i, d) => ({ id: d.id, t0: t0[i], dur, semilla: i + 3, ...d });
  const brPlato = (slug, lado, v, n) => filo(slug, lado, v, pulso(n));
  return [
    // ── crepes ──
    B(0, { id: 'clasica', ...solo({ slug: 'crepe-lliqlla', pal: PAL.turquesa, rot: 'Crepes salados', tit: ['Crepe', 'Clásica'],
      extraProd: { entrada: 'portal', t: -1.95, brillos: [brPlato('crepe-lliqlla', 'izq', 0.4, 3), brPlato('crepe-lliqlla', 'der', 0.7, 6)] } }), deriva: [0.32, 0.06], tEntrada: -1.95 }),
    B(1, { id: 'salados-a', ...par({ slugs: ['crepe-americana', 'crepe-hawaiana'], pal: PAL.terracota, rot: 'Crepes salados', tit: ['Crepes', 'salados'],
      extraProds: [{ entrada: 'quieto', brillos: [brPlato('crepe-americana', 'der', 0.45, 3)] }, { entrada: 'quieto', brillos: [brPlato('crepe-hawaiana', 'izq', 0.55, 5)] }] }), deriva: [-0.3, 0.05] }),
    B(2, { id: 'salados-b', ...par({ slugs: ['crepa-vegetariana', 'crepe-danzante'], pal: PAL.aqua, lado: 'izq', rot: 'Crepes salados', tit: ['Recién', 'hechos'],
      extraProds: [{ entrada: 'desliza', desde: -900, t: -0.3, brillos: [brPlato('crepa-vegetariana', 'izq', 0.45, 4)] },
        { entrada: 'desliza', desde: -900, t: -0.22, brillos: [brPlato('crepe-danzante', 'der', 0.5, 6)] }] }), deriva: [0.3, -0.06] }),
    B(3, { id: 'autor', pal: PAL.mostaza, flor: [960, 640, 760], florTono: PAL.mostaza.tono,
      prods: [{ ...prod(encaje('green-crep', 690, 846, 740, 510)), capa: 1, entrada: 'pop', t: -0.62, brillos: [brPlato('green-crep', 'izq', 0.4, 3)] },
        { ...prod(encaje('crepa-arcoiris', 1265, 790, 900, 480)), capa: 0, entrada: 'pop', t: -0.7, brillos: [[0.62, 0.3, pulso(5), 40]] }],
      textos: [titulo('Crepes de autor', 960, 232, 98, VERDE, T.titulo, { alinear: 'centro' }),
        nombre('Green Crep', 600, 932, VERDE, T.nombres), precio(PR()['green-crep'].precio, 600, 998, '#9a3a26', T.precios),
        nombre('Crepa Arcoíris', 1340, 932, VERDE, T.nombres + 0.2), precio(PR()['crepa-arcoiris'].precio, 1340, 998, '#9a3a26', T.precios + 0.2)],
      iconos: [{ x: 960, y: 110, R: 30, colores: { petalo: '#2f93a8', corona: CREMA, disco: VERDE }, t: T.rotulo }], deriva: [-0.28, 0.06] }),
    B(4, { id: 'galaxia', ...soloBorde({ slug: 'crepa-galaxia', pal: PAL.verde, rot: 'Crepes de autor', tit: ['Crepa', 'Galaxia'], ancho: 1080, base: 1000,
      extraProd: { entrada: 'quieto', brillos: [[0.47, 0.33, pulso(3), 50], [0.62, 0.4, pulso(6), 44]] } }), deriva: [0.3, 0.05] }),
    B(5, { id: 'dulces-a', ...parBorde({ izq: { slug: 'crepa-tropical' }, der: { slug: 'sabor-a-otono', fuera: 90 }, pal: PAL.coral, tit: 'Crepes dulces',
      extra: [{ entrada: 'desliza', desde: -700, t: -0.34, brillos: [[0.5, 0.33, pulso(4), 44]] }, { entrada: 'desliza', desde: 700, t: -0.26, brillos: [[0.55, 0.35, pulso(6), 44]] }] }), deriva: [-0.3, 0.04] }),
    B(6, { id: 'fresa', ...soloBorde({ slug: 'crepa-fresa', pal: PAL.hondo, rot: 'Crepes dulces', tit: ['Crepa', 'Fresa'], ancho: 1150, base: 1010,
      extraProd: { entrada: 'quieto', brillos: [[0.55, 0.3, pulso(3), 46], [0.7, 0.4, pulso(5), 40]] } }), deriva: [0.3, 0.04] }),
    B(7, { id: 'dulces-b', ...parBorde({ izq: { slug: 'crepa-lluvia-de-coco', espejo: true }, der: { slug: 'mega-crepa' }, pal: PAL.rosa, tit: 'Crepes dulces',
      extra: [{ entrada: 'quieto', brillos: [[0.5, 0.3, pulso(3), 44]] }, { entrada: 'quieto', brillos: [[0.55, 0.3, pulso(5), 44]] }] }), deriva: [-0.3, 0.04] }),
    B(8, { id: 'dulces-c', ...par({ slugs: ['crepes-primaveral', 'banana-crepa'], pal: PAL.mostaza, rot: 'Crepes dulces', tit: ['Dulce', 'antojo'], maxW: 640, xs: [990, 1590],
      extraProds: [{ entrada: 'pop', t: -0.7, brillos: [[0.52, 0.3, pulso(3), 42]] }, { entrada: 'pop', t: -0.62, brillos: [brPlato('banana-crepa', 'der', 0.5, 5)] }] }), deriva: [0.3, 0.05] }),
    B(9, { id: 'promo', ...solo({ slug: 'promo-banana-crep', pal: PAL.turquesa, rot: 'Promoción', tit: ['Banana', 'Crep'], etiqueta: 'PROMO S/',
      extraProd: { entrada: 'desliza', desde: 900, t: -0.2, brillos: [brPlato('promo-banana-crep', 'izq', 0.5, 3), brPlato('promo-banana-crep', 'der', 0.6, 6)] } }), deriva: [-0.3, 0.05] }),
    // ── bien fríos ──
    B(10, { id: 'oreo', ...soloAbajo({ slug: 'milkshake-oreo', pal: PAL.aqua, rot: 'Bien fríos', tit: ['Milkshake', 'de Oreo'], escalas: [1, 0.62],
      desc: 'Cremoso, con galleta Oreo', extraProd: { t: 0.12, brillos: [filo('milkshake-oreo', 'der', 0.3, pulso(3), 50), filo('milkshake-oreo', 'izq', 0.45, pulso(6), 44)] } }), deriva: [0.28, 0.05] }),
    B(11, { id: 'milkshakes', ...fila({ slugs: ['milkshake-choco-sublime', 'milkshake-fresa', 'milkshake-muyuchi', 'milkshake-quinua'], pal: PAL.hondo, tit: 'Milkshakes',
      rot: 'Bien fríos', paso: 400, alto: 610, base: 846 }), deriva: [-0.28, 0.05] }),
    B(12, { id: 'frappes', ...fila({ slugs: ['frappe-moca', 'frappe-oreo', 'frappe-fresa', 'frappe-cafe', 'frappe-menta'], pal: PAL.verde, tit: 'Frappés', rot: 'Bien fríos', tSube: -0.3 }), deriva: [0.28, 0.05] }),
    // ── helados ──
    B(13, { id: 'copas', ...arriba({ slugs: ['copa-kids', 'copa-plim-plim', 'copa-oreo'], pal: PAL.coral, tit: 'Helados artesanales', maxH: 520, base: 830,
      extraProds: [{ entrada: 'pop', t: -0.72, brillos: [filo('copa-kids', 'der', 0.62, pulso(3))] }, { entrada: 'pop', t: -0.64, brillos: [filo('copa-plim-plim', 'izq', 0.55, pulso(4))] },
        { entrada: 'pop', t: -0.56, brillos: [filo('copa-oreo', 'der', 0.55, pulso(5))] }] }), deriva: [-0.3, 0.05] }),
    B(14, { id: 'split', ...solo({ slug: 'banana-split', pal: PAL.turquesa, lado: 'izq', rot: 'Helados artesanales', tit: ['Banana', 'Split'],
      maxW: 1000, maxH: 620, base: 900, cx: 600, sello: (L) => [L.izq + 140, L.arriba - 10],
      extraProd: { entrada: 'quieto', brillos: [[0.317, 0.255, pulso(3), 40], [0.517, 0.235, pulso(4), 40], [0.71, 0.3, pulso(5), 40]] } }), deriva: [0.3, 0.05] }),
    B(15, { id: 'paleta', ...solo({ slug: 'paleta-retablo', pal: PAL.mostaza, rot: 'Helados para compartir', tit: ['Paleta', 'Kids Retablo'], escalas: [1, 0.55],
      maxW: 860, maxH: 720, extraProd: { entrada: 'quieto', brillos: [filo('paleta-retablo', 'der', 0.45, pulso(4)), filo('paleta-retablo', 'izq', 0.62, pulso(6))] } }), deriva: [-0.3, 0.05] }),
    // ── café y postres ──
    B(16, { id: 'affogato', ...solo({ slug: 'affogato', pal: PAL.terracota, lado: 'izq', rot: 'Helado y café', tit: ['Affogato', 'de Muyuchi'], escalas: [1, 0.55],
      maxW: 760, maxH: 760, extraProd: { entrada: 'quieto', brillos: [filo('affogato', 'izq', 0.15, pulso(3)), filo('affogato', 'der', 0.55, pulso(6))] } }), deriva: [0.28, 0.05] }),
    B(17, { id: 'cafe-a', ...par({ slugs: ['capuccino-chantilly', 'mocaccino'], pal: PAL.verde, rot: 'Café de altura', tit: ['Café', 'de altura'], maxW: 500, maxH: 520,
      extraProds: [{ entrada: 'quieto', vapor: [230, 360, 0, -10, 0.22], brillos: [filo('capuccino-chantilly', 'der', 0.3, pulso(3))] },
        { entrada: 'quieto', vapor: [230, 360, 0, -10, 0.22], brillos: [filo('mocaccino', 'der', 0.35, pulso(5))] }] }), deriva: [-0.28, 0.05] }),
    B(18, { id: 'cafe-b', ...par({ slugs: ['americano', 'espresso-doble'], pal: PAL.aqua, lado: 'izq', rot: 'Café de altura', tit: ['Café', 'clásico'], maxW: 520, maxH: 420,
      extraProds: [{ entrada: 'quieto', vapor: [240, 380, -20, -30, 0.24], brillos: [filo('americano', 'izq', 0.3, pulso(4))] },
        { entrada: 'quieto', vapor: [200, 340, -10, -20, 0.22], brillos: [filo('espresso-doble', 'der', 0.35, pulso(6))] }] }), deriva: [0.28, 0.05] }),
    B(19, { id: 'torta', ...solo({ slug: 'torta-de-chocolate', pal: PAL.crema, rot: 'Postres de la casa', tit: ['Torta', 'Matilda'], maxW: 860, maxH: 700,
      extraProd: { entrada: 'quieto', brillos: [filo('torta-de-chocolate', 'izq', 0.85, pulso(3)), [0.6, 0.12, pulso(5), 44]] } }), deriva: [-0.28, 0.05] }),
    B(20, { id: 'postres', ...par({ slugs: ['red-velvet', 'tiramisu-de-pistacho'], pal: PAL.rosa, lado: 'izq', rot: 'Postres de la casa', tit: ['Postres', 'de la casa'],
      maxW: 560, maxH: 600, xs: [420, 960], extraProds: [{ entrada: 'quieto', brillos: [filo('red-velvet', 'der', 0.85, pulso(4))] }, { entrada: 'quieto', brillos: [filo('tiramisu-de-pistacho', 'der', 0.5, pulso(5))] }] }), deriva: [0.28, 0.05] }),
    B(21, { id: 'chapla', ...solo({ slug: 'chapla-chancho-caja-china', pal: PAL.hondo, lado: 'izq', rot: 'Sabor ayacuchano', tit: ['Chapla', 'con chancho', 'a la caja china'],
      escalas: [1, 0.5, 0.5], extraProd: { entrada: 'quieto', brillos: [filo('chapla-chancho-caja-china', 'der', 0.75, pulso(3)), filo('chapla-chancho-caja-china', 'izq', 0.8, pulso(6))] } }), deriva: [-0.28, 0.05] }),
  ];
}
