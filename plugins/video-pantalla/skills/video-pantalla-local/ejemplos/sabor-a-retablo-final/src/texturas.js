// Texturas dibujadas en canvas 2D: letras (un atlas por texto), sello de precio con la flor de la
// marca, degradados, sombras de contacto, discos suaves, banda pintada de los podios, logo.
import { azar } from './util.js';

export const FUENTE = { display: "'Playfair Display', Georgia, serif", texto: "'Montserrat', Arial, sans-serif" };

export function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// ── Letras: cada glifo en su celda (con aire para la itálica) y su posición en la palabra ──
// Devuelve {canvas, px, glifos:[{ch, x, ancho, alto, uv:[u0,v0,du,dv], base}], ancho, asc, desc}
// x = posición del borde izquierdo de la celda respecto del inicio de la línea (px de la fuente).
export function atlasTexto(texto, { familia = FUENTE.display, peso = 500, estilo = 'italic', px = 220, tracking = 0, sombra = null } = {}) {
  const m = lienzo(8, 8).getContext('2d');
  const font = `${estilo} ${peso} ${px}px ${familia}`;
  m.font = font;
  m.letterSpacing = `${tracking}px`;
  const chars = [...texto];
  const pre = [];
  for (let i = 0; i <= chars.length; i++) pre.push(m.measureText(chars.slice(0, i).join('')).width);
  const mets = chars.map((ch) => m.measureText(ch));
  const asc = Math.max(px * 0.8, ...mets.map((q) => q.actualBoundingBoxAscent));
  const desc = Math.max(px * 0.25, ...mets.map((q) => q.actualBoundingBoxDescent));
  // con sombra, la celda lleva aire para el desenfoque (la sombra va horneada debajo de cada glifo)
  const pad = Math.ceil(px * (sombra ? 0.14 + (sombra.blur + Math.abs(sombra.dy || 0)) / 100 : 0.14));
  const celdas = mets.map((q, i) => {
    const izq = Math.ceil(q.actualBoundingBoxLeft) + pad, der = Math.ceil(q.actualBoundingBoxRight) + pad;
    return { ch: chars[i], izq, w: izq + der, h: Math.ceil(asc + desc) + 2 * pad };
  });
  // Estantes de hasta 4096 px
  const MAXW = 4096;
  let x = 0, y = 0, fila = 0;
  const pos = celdas.map((c) => {
    if (x + c.w > MAXW) { x = 0; y += fila + 2; fila = 0; }
    const p = [x, y];
    x += c.w + 2;
    fila = Math.max(fila, c.h);
    return p;
  });
  const A = Math.min(MAXW, Math.max(...pos.map((p, i) => p[0] + celdas[i].w)) + 2);
  const B = y + fila + 2;
  const cv = lienzo(A, B);
  const g = cv.getContext('2d');
  g.font = font;
  g.fillStyle = '#ffffff';
  g.textBaseline = 'alphabetic';
  if (sombra) {
    g.shadowColor = `rgba(0,0,0,${sombra.alfa ?? 0.22})`;
    g.shadowBlur = (sombra.blur * px) / 100;
    g.shadowOffsetY = ((sombra.dy || 0) * px) / 100;
  }
  const glifos = celdas.map((c, i) => {
    const [cx, cy] = pos[i];
    if (c.ch.trim()) g.fillText(c.ch, cx + c.izq, cy + pad + asc);
    return {
      ch: c.ch, x: pre[i] - c.izq, ancho: c.w, alto: c.h, avance: pre[i + 1] - pre[i],
      uv: [cx / A, 1 - (cy + c.h) / B, c.w / A, c.h / B], base: pad + desc,
    };
  });
  return { canvas: cv, px, glifos, ancho: pre[chars.length], asc, desc, pad };
}

// ── La flor de la marca en canvas (Path2D de flor.js) ──
let _flor = null;
function caminosFlor() {
  if (!_flor) {
    const F = window.FLOR;
    _flor = { petalos: new Path2D(F.capas[0].d), corona: new Path2D(F.capas[1].d), R: F.radio, RD: F.disco };
  }
  return _flor;
}
export function dibujarFlor(g, x, y, R, rot, col, alfas = [1, 1, 1]) {
  const f = caminosFlor(), k = R / f.R;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(k, k);
  g.globalAlpha = alfas[0]; g.fillStyle = col.petalo; g.fill(f.petalos);
  g.globalAlpha = alfas[1]; g.fillStyle = col.corona; g.fill(f.corona);
  g.globalAlpha = alfas[2]; g.beginPath(); g.arc(0, 0, f.RD, 0, Math.PI * 2); g.fillStyle = col.disco; g.fill();
  g.restore();
}

// Sello de precio: la flor (pétalos del acento, corona crema, disco verde) con «S/ 12» en el disco.
export function selloPrecio(precio, { petalo = '#f7c75a', corona = '#f9f6ee', disco = '#0d3b2b', tinta = '#f9f6ee', tam = 1024 } = {}) {
  const c = lienzo(tam, tam), g = c.getContext('2d');
  const f = caminosFlor();
  const R = tam * 0.47;
  g.shadowColor = 'rgba(0,0,0,0)';
  dibujarFlor(g, tam / 2, tam / 2, R, 0, { petalo, corona, disco });
  const r = (f.RD / f.R) * R;
  g.fillStyle = tinta;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = `700 ${(r * 0.34).toFixed(1)}px ${FUENTE.texto}`;
  g.letterSpacing = `${(r * 0.02).toFixed(1)}px`;
  g.fillText('S/', tam / 2, tam / 2 - r * 0.3);
  const n = String(precio);
  const big = n.length > 2 ? r * 0.78 : r * 0.98;
  g.font = `800 ${big.toFixed(1)}px ${FUENTE.texto}`;
  g.letterSpacing = `${(-r * 0.03).toFixed(1)}px`;
  g.fillText(n, tam / 2 - r * 0.015, tam / 2 + r * 0.58);
  return c;
}

// Degradado radial (paredes): centro un paso más claro, bordes más hondos.
export function degradado(centro, medio, borde, tam = 1024, { cx = 0.5, cy = 0.45, r = 0.75 } = {}) {
  const c = lienzo(tam, tam), g = c.getContext('2d');
  const gr = g.createRadialGradient(tam * cx, tam * cy, 0, tam * cx, tam * cy, tam * r);
  gr.addColorStop(0, centro);
  gr.addColorStop(0.55, medio);
  gr.addColorStop(1, borde);
  g.fillStyle = gr;
  g.fillRect(0, 0, tam, tam);
  return c;
}

// Mapa de normales de yeso (ruido suave a varias escalas), repetible.
export function yesoNormal(tam = 512, semilla = 7, fuerza = 1.4) {
  const r = azar(semilla);
  const N = tam;
  const alt = new Float32Array(N * N);
  for (const [oct, amp] of [[8, 1], [24, 0.5], [64, 0.25], [160, 0.12]]) {
    const G = oct, gr = new Float32Array((G + 1) * (G + 1)).map(() => r());
    for (let j = 0; j <= G; j++) gr[G * (G + 1) + j] = gr[j];
    for (let i = 0; i <= G; i++) gr[i * (G + 1) + G] = gr[i * (G + 1)];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = (x / N) * G, fy = (y / N) * G, ix = Math.floor(fx), iy = Math.floor(fy);
      const u = fx - ix, v = fy - iy, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
      const a = gr[iy * (G + 1) + ix], b = gr[iy * (G + 1) + ix + 1], c2 = gr[(iy + 1) * (G + 1) + ix], d = gr[(iy + 1) * (G + 1) + ix + 1];
      alt[y * N + x] += amp * (a + (b - a) * su + (c2 - a) * sv + (a - b - c2 + d) * su * sv);
    }
  }
  const c = lienzo(N, N), g = c.getContext('2d'), im = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const h = (dx, dy) => alt[((y + dy + N) % N) * N + ((x + dx + N) % N)];
    let nx = (h(-1, 0) - h(1, 0)) * fuerza, ny = (h(0, -1) - h(0, 1)) * fuerza;
    const l = Math.hypot(nx, ny, 1);
    const i = (y * N + x) * 4;
    im.data[i] = (nx / l * 0.5 + 0.5) * 255;
    im.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
    im.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
    im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}

// Disco suave (polvo, bokeh, destellos)
export function discoSuave(tam = 128, dureza = 0.0) {
  const c = lienzo(tam, tam), g = c.getContext('2d');
  const gr = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(Math.max(0.01, dureza), 'rgba(255,255,255,0.85)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, tam, tam);
  return c;
}

// Sombra de contacto: elipse suave (se aplasta en 3D con la escala del plano)
export function sombraContacto(tam = 256) {
  const c = lienzo(tam, tam), g = c.getContext('2d');
  const gr = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
  gr.addColorStop(0, 'rgba(0,0,0,0.9)');
  gr.addColorStop(0.35, 'rgba(0,0,0,0.6)');
  gr.addColorStop(0.7, 'rgba(0,0,0,0.18)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, tam, tam);
  return c;
}

// Banda pintada para el costado de los podios: motivos del retablo en fila sobre crema.
export function bandaPintada(atlasImg, motivos, { ancho = 4096, alto = 512, fondo = '#f4efe2', semilla = 3, escala = 1 } = {}) {
  const c = lienzo(ancho, alto), g = c.getContext('2d');
  g.fillStyle = fondo;
  g.fillRect(0, 0, ancho, alto);
  const r = azar(semilla);
  const hojas = motivos.lista.filter((m) => m.tono === 'turquesa' || m.tono === 'verde');
  const flores = motivos.lista.filter((m) => m.tono === 'amarillo' || (m.tono === 'coral' && m.area > 300));
  const paso = 300 * escala;
  for (let x = paso / 2, i = 0; x < ancho + paso; x += paso, i++) {
    const m = i % 2 ? r.elegir(flores) : r.elegir(hojas);
    const [u0, v0, du, dv] = m.uv;
    const sx = u0 * atlasImg.width, sy = (1 - v0 - dv) * atlasImg.height, sw = du * atlasImg.width, sh = dv * atlasImg.height;
    const k = Math.min((alto * 0.62) / sh, (paso * 0.8) / sw) * (i % 2 ? 0.75 : 1);
    g.save();
    g.translate(x % ancho, alto / 2);
    g.rotate((i % 2 ? 0 : (r() - 0.5) * 0.9) + (i % 4 === 0 ? Math.PI / 2 : 0) * 0);
    g.drawImage(atlasImg, sx, sy, sw, sh, (-sw * k) / 2, (-sh * k) / 2, sw * k, sh * k);
    g.restore();
  }
  // filetes arriba y abajo
  g.fillStyle = '#3e2319';
  g.globalAlpha = 0.85;
  g.fillRect(0, alto * 0.06, ancho, alto * 0.018);
  g.fillRect(0, alto * 0.924, ancho, alto * 0.018);
  return c;
}

// Haz de luz (cono): degradado vertical blanco → transparente, bordes suaves
export function haz(tam = 256) {
  const c = lienzo(tam, tam), g = c.getContext('2d');
  const im = g.createImageData(tam, tam);
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
    const u = x / (tam - 1), v = y / (tam - 1);
    const borde = Math.pow(Math.sin(Math.PI * u), 2.2);
    const largo = Math.pow(1 - v, 1.6) * Math.min(1, v * 12);
    const a = borde * largo;
    const i = (y * tam + x) * 4;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = 255;
    im.data[i + 3] = a * 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}

// Logotipo en vector (logo.js): nombre en `tinta`, la «a» chica en `acento`. Devuelve canvas + caja.
export function logoCanvas({ ancho = 4096, tinta = '#f9f6ee', acento = '#f0b8a4', margen = 0.04 } = {}) {
  const LG = window.LOGO;
  const dSub = (sp) => {
    let d = `M${sp[0]} ${sp[1]}`;
    for (let i = 2; i < sp.length; i += 6) d += `C${sp[i]} ${sp[i + 1]} ${sp[i + 2]} ${sp[i + 3]} ${sp[i + 4]} ${sp[i + 5]}`;
    return d + 'Z';
  };
  let dNombre = '', dA = '';
  for (const L of LG.orden) for (const sp of LG.letras[L]) {
    const xs = sp.filter((_, i) => i % 2 === 0), ys = sp.filter((_, i) => i % 2 === 1);
    const esA = Math.min(...xs) > 420 && Math.max(...xs) < 512 && Math.min(...ys) > 120;
    if (esA) dA += dSub(sp); else dNombre += dSub(sp);
  }
  const k = (ancho * (1 - 2 * margen)) / LG.ancho;
  const alto = Math.ceil(LG.alto * k + 2 * margen * ancho);
  const c = lienzo(ancho, alto), g = c.getContext('2d');
  g.translate(margen * ancho, margen * ancho);
  g.scale(k, k);
  g.fillStyle = tinta; g.fill(new Path2D(dNombre), 'evenodd');
  g.fillStyle = acento; g.fill(new Path2D(dA), 'evenodd');
  return { canvas: c, ancho, alto, escala: k, margen: margen * ancho, nombre: dNombre, a: dA };
}

// ── Sello de precio por capas: la flor (gira), el texto (derecho) y su sombra (quieta) ──
// Mismo lienzo para las tres, con aire alrededor de la flor para la sombra.
export function selloCapas(texto, { petalo = '#f7c75a', corona = '#f9f6ee', disco = '#0d3b2b', tinta = '#f9f6ee', tam = 1024,
  etiqueta = 'S/', margen = 0.18 } = {}) {
  const f = caminosFlor();
  const R = (tam / 2) / (1 + margen);
  const flor = lienzo(tam, tam), gf = flor.getContext('2d');
  dibujarFlor(gf, tam / 2, tam / 2, R, 0, { petalo, corona, disco });
  const sombra = lienzo(tam / 4, tam / 4), gs = sombra.getContext('2d');
  gs.filter = `blur(${(tam / 4) * 0.03}px)`;
  dibujarFlor(gs, tam / 8, tam / 8, R / 4, 0, { petalo: '#000', corona: '#000', disco: '#000' });
  const txt = lienzo(tam, tam), g = txt.getContext('2d');
  const r = (f.RD / f.R) * R;
  g.fillStyle = tinta;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  if (etiqueta === 'PROMO S/') {
    g.font = `800 ${(r * 0.27).toFixed(1)}px ${FUENTE.texto}`;
    g.letterSpacing = `${(r * 0.03).toFixed(1)}px`;
    g.fillText('PROMO', tam / 2 + r * 0.01, tam / 2 - r * 0.36);
    const n = String(texto);
    g.font = `800 ${(n.length > 2 ? r * 0.7 : r * 0.92).toFixed(1)}px ${FUENTE.texto}`;
    g.letterSpacing = `${(-r * 0.03).toFixed(1)}px`;
    g.fillText('S/' + n, tam / 2 - r * 0.015, tam / 2 + r * 0.5);
  } else if (etiqueta === 'PROMO') {
    g.font = `800 ${(r * 0.44).toFixed(1)}px ${FUENTE.texto}`;
    g.letterSpacing = `${(r * 0.03).toFixed(1)}px`;
    g.fillText('PROMO', tam / 2 + r * 0.015, tam / 2 + r * 0.16);
  } else {
    g.font = `700 ${(r * 0.36).toFixed(1)}px ${FUENTE.texto}`;
    g.letterSpacing = `${(r * 0.02).toFixed(1)}px`;
    g.fillText(etiqueta, tam / 2, tam / 2 - r * 0.28);
    const n = String(texto);
    const big = n.length > 2 ? r * 0.78 : r * 0.98;
    g.font = `800 ${big.toFixed(1)}px ${FUENTE.texto}`;
    g.letterSpacing = `${(-r * 0.03).toFixed(1)}px`;
    g.fillText(n, tam / 2 - r * 0.015, tam / 2 + r * 0.6);
  }
  return { flor, texto: txt, sombra, escala: 1 + margen };
}

// La flor entera en un lienzo (íconos sobre los títulos, la flor-portal)
export function florCanvas(tam, col, margen = 0.04) {
  const c = lienzo(tam, tam), g = c.getContext('2d');
  dibujarFlor(g, tam / 2, tam / 2, (tam / 2) / (1 + margen), 0, col);
  return c;
}

// Silueta de los pétalos (florcitas que flotan): blanca, para teñir en el shader
export function petalosCanvas(tam = 256) {
  const f = caminosFlor();
  const c = lienzo(tam, tam), g = c.getContext('2d');
  const k = (tam * 0.46) / f.R;
  g.translate(tam / 2, tam / 2);
  g.scale(k, k);
  g.fillStyle = '#ffffff';
  g.fill(f.petalos);
  return c;
}
