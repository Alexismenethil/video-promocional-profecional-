// Los veintiséis tableros. Maquetas en px de diseño (1920×1080); cada retablo se arma en 3D desde su foto.
import { FUENTE } from './texturas.js';
import { CREMA, AZUL, ROJO } from './letras.js';
import { extraMedidas, extraFila, extraCarrusel, extraPared, extraFoto, extraAngeles, extraEspejos } from './especiales.js';

const C = window.CUES;
const PR = () => window.DATOS.productos;
const NEG = () => window.DATOS.negocio;

export const PAL = {
  azul: { fondo: '#8dbccc', claro: '#c2e0e8', oscuro: '#4f8799', tinta: AZUL, acento: ROJO, tono: ['#ffffff', 0.14] },
  morado: { fondo: '#4a2c7e', claro: '#7655ad', oscuro: '#25124a', tinta: CREMA, acento: '#f6c453', tono: ['#ffffff', 0.07] },
  menta: { fondo: '#dcebdc', claro: '#f4f9f2', oscuro: '#a9c7ab', tinta: AZUL, acento: ROJO, tono: ['#ffffff', 0.4] },
  crema: { fondo: '#efe3cc', claro: '#fbf6ea', oscuro: '#cdb68f', tinta: AZUL, acento: ROJO, tono: ['#ffffff', 0.35] },
  noche: { fondo: '#1f2747', claro: '#34407a', oscuro: '#0b0f22', tinta: CREMA, acento: '#f6c453', tono: ['#ffffff', 0.05] },
  verde: { fondo: '#1e5d4a', claro: '#2f8066', oscuro: '#0c3026', tinta: CREMA, acento: '#f6c453', tono: ['#ffffff', 0.06] },
  turquesa: { fondo: '#2a8b9a', claro: '#56b5c3', oscuro: '#125665', tinta: CREMA, acento: '#f6c453', tono: ['#ffffff', 0.08] },
  carbon: { fondo: '#2a2a31', claro: '#45454f', oscuro: '#111114', tinta: CREMA, acento: '#f6c453', tono: ['#ffffff', 0.04] },
  rojo: { fondo: '#d4163c', claro: '#ea4563', oscuro: '#930b28', tinta: CREMA, acento: '#f6c453', tono: ['#ffffff', 0.055] },
};
// etiqueta de precio según la pared
const etiq = (pal) => (pal.tinta === AZUL ? { fondo: ROJO, tinta: CREMA } : { fondo: CREMA, tinta: pal === PAL.rojo ? ROJO : AZUL });

// ── textos ──
const rotulo = (texto, x, y, color, t, alinear = 'izq', px = 24) => ({ texto: texto.toUpperCase(), x, y, t, abre: 10,
  estilo: { familia: FUENTE.texto, peso: 700, estilo: 'normal', px, tracking: 8, color, alinear } });
const titulo = (texto, x, y, px, color, t, { peso = 600, alinear = 'izq', estilo = 'italic' } = {}) => ({ texto, x, y, t,
  estilo: { familia: FUENTE.display, peso, estilo, px, color, alinear } });
const nombre = (texto, x, y, color, t, px = 50, alinear = 'centro') => ({ texto, x, y, t,
  estilo: { familia: FUENTE.display, peso: 600, estilo: 'italic', px, color, alinear } });
const medida = (texto, x, y, color, t, alinear = 'izq', px = 30) => ({ texto, x, y, t,
  estilo: { familia: FUENTE.texto, peso: 600, estilo: 'normal', px, tracking: 3, color, alinear } });
const T = { rotulo: 0.1, titulo: 0.25, nombre: 0.55, medida: 0.7, etiqueta: 1.0 };

// ═════════ maquetas ═════════
// Un retablo grande (abre sus puertas) con su medida dibujada; el texto del otro lado
function heroe({ slug, pal, lado = 'der', rot = 'Retablos', alto, ancho, cx, base = 960, entrada = 'puertas', textoX, extraMed = {}, nombreTxt, t = -0.35, abre = 0.75 }) {
  const P0 = PR()[slug];
  const der = lado === 'der';
  const X = textoX ?? (der ? 150 : 1300);
  const tier = window.DATOS.tiers[P0.tier];
  const e = etiq(pal);
  return {
    pal, flor: der ? [640, 520, 620] : [1280, 520, 620],
    prods: [{ slug, cx: cx ?? (der ? 1250 : 670), base, alto, ancho, entrada, t, abre, durAbre: 1.1 }],
    textos: [rotulo(rot, X + 4, 330, pal.acento, T.rotulo),
      titulo(tier.medida.replace(' cm', ''), X, 470, 132, pal.tinta, T.titulo),
      medida('CENTÍMETROS', X + 6, 528, pal.tinta, T.titulo + 0.2, 'izq', 22),
      nombre(nombreTxt || P0.nombre, X, 640, pal.tinta, T.nombre, 50, 'izq')],
    filetes: [{ x: X + 4, y: 570, ancho: 260, color: pal.acento, t: 0.5 }],
    etiquetas: [{ precio: tier.precio, x: X + 130, y: 690, ancho: 250, t: 1.35, entrada: 'gira', ...e }],
    camara: { tipo: 'orbita', centro: [(cx ?? (der ? 1250 : 670)) * 0.5 + 480, base - (alto || 600) * 0.5], az: der ? [-0.1, 0.04] : [0.1, -0.04], el: [0.05, 0.0], dist: [1.05, 0.98] },
    extra: (ctx) => extraMedidas(ctx, { slugIdx: 0, ...extraMed }),
  };
}

// Dos o tres retablos en fila, con sus nombres; un precio para todos (c/u)
function fila({ slugs, pal, rot, tit, xs, base = 860, alto, entradas, precio, sub = 'c/u', tY = 200, precios = null, nombres = true, escalaComun = false, subs = null }) {
  const e = etiq(pal);
  const P = PR();
  // escala común: se respetan los tamaños relativos de la foto (alto = el del más alto)
  let altos = slugs.map(() => alto);
  if (escalaComun) {
    const hs = slugs.map((s) => P[s].apoyo - P[s].caja[1]);
    const ks = slugs.map((s) => P[s].escala || 1);
    const real = hs.map((h, i) => h / ks[i]);
    const mx = Math.max(...real);
    altos = real.map((r) => (alto * r) / mx);
  }
  const ps = slugs.map((slug, i) => ({ slug, cx: xs[i], base, alto: altos[i], ...(entradas?.[i] || { entrada: 'cae', t: 0.1 + i * 0.16, altura: 650, abreAlCaer: true }) }));
  const textos = [rotulo(rot, 960, tY - 92, pal.acento, T.rotulo, 'centro'), titulo(tit, 960, tY, 88, pal.tinta, T.titulo, { alinear: 'centro' })];
  if (nombres) slugs.forEach((s, i) => textos.push(nombre(P[s].nombre, xs[i], base + 70, pal.tinta, T.nombre + i * 0.15, 42)));
  const etiquetas = precios
    ? precios.map((pr, i) => ({ precio: pr, x: xs[i], y: base + (nombres ? 108 : 40), ancho: 168, t: 0.9 + i * 0.16, entrada: 'pop', sub: subs?.[i] || '', ...e }))
    : [{ precio: precio ?? P[slugs[0]].precio, x: 1760, y: 120, ancho: 210, t: 1.2, entrada: 'cuelga', sub, ...e }];
  return {
    pal, flor: [960, 520, 760],
    prods: ps, textos, etiquetas,
    camara: { tipo: 'orbita', centro: [960, base - alto * 0.45], az: [-0.08, 0.08], el: [0.05, 0.01], dist: [1.04, 0.98] },
  };
}

// ═════════ los veintiséis ═════════
export function definirTableros() {
  const t0 = C.t0, dur = C.tablero;
  const B = (i, d) => ({ id: C.tableros[i], t0: t0[i], dur, semilla: i + 3, ...d });
  const P = PR();
  return [
    // historia: las manos y el maestro (foto con paralaje)
    B(0, { pal: PAL.carbon, flor: null, extra: (ctx) => extraFoto(ctx, { fotos: ['manos', 'maestro'],
      textos: [['Arte ayacuchano', 'hecho a mano']] }) }),
    // los tamaños, lado a lado
    B(1, { pal: PAL.menta, flor: [960, 560, 820], extra: (ctx) => extraFila(ctx, {
      slugs: ['flores-100', 'nacimiento-160', 'nacimiento-200', 'nacimiento-250', 'nac-jarana-500', 'nac-carnaval-1300'] }),
      textos: [rotulo('Retablos ayacuchanos', 960, 120, ROJO, 0.1, 'centro'), titulo('Elige tu tamaño', 960, 214, 92, AZUL, 0.25, { alinear: 'centro' })] }),
    // 19 × 20 · S/ 100
    B(2, heroe({ slug: 'cosecha-100', pal: PAL.morado, alto: 780 })),
    B(3, fila({ slugs: ['panaderia-100', 'flores-100', 'danzante-100'], pal: PAL.azul, rot: 'Retablos de 19 × 20 cm', tit: 'Escenas de nuestra tierra',
      xs: [400, 960, 1520], alto: 470, entradas: [0.25, 0.45, 0.65].map((t) => ({ entrada: 'abre', t })) })),
    B(4, { pal: PAL.verde, pared: -9, extra: (ctx) => extraCarrusel(ctx, { slugs: ['carnaval-huam-100', 'sombreros-huam-100', 'sombreros-rurales-100', 'instrumentos-100', 'corazones-100', 'cosecha-100'] }),
      textos: [rotulo('Retablos de 19 × 20 cm', 960, 120, '#f6c453', 0.1, 'centro')] , etiquetas: [{ precio: 100, x: 1730, y: 130, ancho: 210, t: 1.0, entrada: 'cuelga', sub: 'c/u', fondo: CREMA, tinta: AZUL }] }),
    // 15 × 30 · S/ 160
    B(5, heroe({ slug: 'nacimiento-160', pal: PAL.azul, lado: 'izq', ancho: 960, cx: 600, base: 850, textoX: 1350, extraMed: { fondo: 7 } })),
    B(6, { pal: PAL.crema, extra: (ctx) => extraPared(ctx, { slugs: ['gastronomia-160', 'chumbivilcas-160', 'huaylash-160', 'techado-160', 'sombreros-rurales-160', 'mascaras-160', 'panaderia-160', 'corazones-160'] }),
      textos: [rotulo('Retablos de 15 × 30 cm', 960, 120, ROJO, 0.1, 'centro')], etiquetas: [{ precio: 160, x: 1740, y: 120, ancho: 200, t: 1.4, entrada: 'cuelga', sub: 'c/u', fondo: ROJO, tinta: CREMA }] }),
    B(7, fila({ slugs: ['danzante-160', 'marinera-160'], pal: PAL.morado, rot: 'Retablos de 15 × 30 cm', tit: 'Música y danza', xs: [520, 1400], alto: 400, base: 820,
      entradas: [{ entrada: 'gira', t: 0.1, desde: -0.85 }, { entrada: 'gira', t: 0.3, desde: 0.85, dx: -260 }] })),
    B(8, fila({ slugs: ['yawar-160', 'chullos-160'], pal: PAL.turquesa, rot: 'Retablos de 15 × 30 cm', tit: 'Costumbres andinas', xs: [520, 1400], alto: 400, base: 820,
      entradas: [{ entrada: 'voltea', t: 0.1 }, { entrada: 'voltea', t: 0.32, sentido: -1 }] })),
    // 22 × 32 · S/ 200
    B(9, heroe({ slug: 'semana-santa-200', pal: PAL.noche, alto: 700, lado: 'der', t: -1.0, abre: 1.4 })),
    B(10, fila({ slugs: ['cosecha-200', 'corazones-200', 'sombrero-rural-200'], pal: PAL.menta, rot: 'Retablos de 22 × 32 cm', tit: 'Retablos con arco', xs: [400, 960, 1520], alto: 350, base: 830,
      entradas: [{ entrada: 'sube', t: -0.32, abreAlSubir: true }, { entrada: 'sube', t: -0.2, abreAlSubir: true }, { entrada: 'sube', t: -0.08, abreAlSubir: true }] })),
    B(11, fila({ slugs: ['marinera-200b', 'mascaras-200b'], pal: PAL.verde, rot: 'Retablos de 26 × 32 cm', tit: 'Fiesta y tradición', xs: [560, 1360], alto: 560, base: 900,
      precio: 200, entradas: [{ entrada: 'gira', t: 0.1, desde: -0.6, dx: 160 }, { entrada: 'gira', t: 0.28, desde: 0.6, dx: -160 }] })),
    // 27 × 36 · S/ 250
    B(12, heroe({ slug: 'nacimiento-250', pal: PAL.morado, alto: 730, lado: 'izq', cx: 640, textoX: 1340 })),
    B(13, fila({ slugs: ['semana-santa-250', 'carnaval-huam-250'], pal: PAL.azul, rot: 'Retablos de 27 × 36 cm', tit: 'Grandes escenas', xs: [520, 1400], alto: 540, base: 920,
      entradas: [{ entrada: 'acerca', t: -0.5, abreAlLlegar: true }, { entrada: 'acerca', t: -0.32, sentido: -1, abreAlLlegar: true }] })),
    // 37 × 48 · S/ 500
    B(14, heroe({ slug: 'nac-jarana-500', pal: PAL.turquesa, alto: 820, lado: 'der', t: -0.2, abre: 0.8 })),
    B(15, fila({ slugs: ['nac-danzante-500', 'nacimiento-500'], pal: PAL.crema, rot: 'Retablos de dos pisos', tit: 'Dos historias en uno', xs: [510, 1410], alto: 540, base: 920,
      precio: 500, entradas: [{ entrada: 'abre', t: 0.3 }, { entrada: 'abre', t: 0.55 }] })),
    // grandes
    B(16, heroe({ slug: 'nac-carnaval-1300', pal: PAL.carbon, alto: 800, base: 970, cx: 1370, lado: 'der', rot: 'Obra maestra', t: -0.1, abre: 0.9, nombreTxt: 'Nacimiento y carnaval' })),
    B(17, fila({ slugs: ['nacimiento-700', 'espejo-750'], pal: PAL.verde, rot: 'Piezas únicas', tit: 'Cuadro y espejo retablo', xs: [660, 1270], alto: 540, base: 790,
      entradas: [{ entrada: 'voltea', t: 0.1 }, { entrada: 'voltea', t: 0.32, sentido: -1 }], precios: [700, 750], subs: ['32 × 45 cm', '50 × 40 cm'] })),
    B(18, fila({ slugs: ['floreria-500', 'panaderia-andina-500'], pal: PAL.azul, rot: 'Retablos de 30 × 60 cm', tit: 'Panorámicos', xs: [520, 1400], alto: 420, base: 830,
      precio: 500, entradas: [{ entrada: 'cae', t: -0.15, altura: 700, abreAlCaer: true }, { entrada: 'cae', t: 0.0, altura: 700, abreAlCaer: true }] })),
    B(19, fila({ slugs: ['nacimiento-60', 'nacimiento-180'], pal: PAL.rojo, rot: 'Nacimientos', tit: 'Para regalar', xs: [600, 1340], alto: 420, base: 780,
      escalaComun: false, precios: [60, 180], subs: ['16 cm', ''], entradas: [{ entrada: 'abre', t: 0.3 }, { entrada: 'abre', t: 0.5 }] })),
    // decoración
    B(20, fila({ slugs: ['toritos-3', 'toritos-2', 'toritos-4', 'toritos-1'], pal: PAL.azul, rot: 'Cerámica de Pucará', tit: 'Toritos', xs: [430, 770, 1140, 1560], alto: 560, base: 830,
      escalaComun: true, nombres: false, entradas: [0, 1, 2, 3].map((i) => ({ entrada: 'cae', t: -0.9 + i * 0.2, altura: 600 })), precios: [35, 55, 75, 100] })),
    B(21, { pal: PAL.morado, extra: (ctx) => extraEspejos(ctx, {}), textos: [rotulo('Decoración', 960, 120, '#f6c453', 0.1, 'centro'),
      titulo('Espejos decorativos', 960, 214, 88, CREMA, 0.25, { alinear: 'centro' })], etiquetas: [{ precio: 150, x: 1730, y: 120, ancho: 210, t: 1.2, entrada: 'cuelga', sub: 'c/u', fondo: CREMA, tinta: AZUL }] }),
    B(22, { pal: PAL.crema, extra: (ctx) => extraAngeles(ctx, {}), textos: [rotulo('Para colgar', 960, 930, ROJO, 0.3, 'centro'),
      titulo('Ángeles colgantes', 960, 1008, 76, AZUL, 0.45, { alinear: 'centro' })], etiquetas: [{ precio: 40, x: 1700, y: 760, ancho: 210, t: 1.2, entrada: 'pop', sub: 'c/u', fondo: ROJO, tinta: CREMA }] }),
    B(23, { pal: PAL.menta, flor: [1280, 520, 620], prods: [{ slug: 'personalizado', cx: 1260, base: 930, alto: 700, entrada: 'gira', t: 0.05, desde: 0.7, dx: -160 }],
      textos: [rotulo('Por encargo', 154, 330, ROJO, 0.1), titulo('Tu idea,', 150, 460, 120, AZUL, 0.25), titulo('hecha retablo', 150, 590, 96, ROJO, 0.4, { peso: 500 }),
        medida('Para empresas, familias y regalos', 154, 680, AZUL, 0.8, 'izq', 28), medida(`Cotiza al ${NEG().whatsapp}`, 154, 740, AZUL, 1.0, 'izq', 28)],
      filetes: [{ x: 154, y: 632, ancho: 260, color: ROJO, t: 0.6 }], camara: { tipo: 'orbita', centro: [1000, 560], az: [0.08, -0.06], el: [0.04, 0], dist: [1.04, 0.98] } }),
    B(24, { pal: PAL.carbon, flor: null, extra: (ctx) => extraFoto(ctx, { fotos: ['patio'], textos: [['Visítanos en el', 'Museo Casa del Retablo']] }) }),
    B(25, { pal: PAL.carbon, flor: null, extra: (ctx) => extraFoto(ctx, { fotos: ['maestro-letrero'], textos: [['Pedidos y cotizaciones · WhatsApp', NEG().whatsapp]] }),
      textos: [medida(NEG().web, 154, 1010, CREMA, 1.2, 'izq', 30)] }),
  ];
}
