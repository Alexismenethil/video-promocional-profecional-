/* Sabor a Retablo — pieza de 15 s para las pantallas del local.
   Todo cuadro sale de seek(t): nada depende del reloj real, así el render
   cuadro a cuadro y la reproducción en vivo dan exactamente lo mismo. */
(() => {
  const C = window.CUES;
  const D = window.DATOS;
  const W = 1920, H = 1080, DUR = C.dur;
  const DPR = window.devicePixelRatio || 1;   // 2 al exportar en 4K
  const $ = (id) => document.getElementById(id);

  /* ───────────── matemática ───────────── */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const E = {
    inQuad: (x) => x * x,
    outQuad: (x) => 1 - (1 - x) * (1 - x),
    inCubic: (x) => x * x * x,
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    inOutQuart: (x) => (x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2),
    outQuart: (x) => 1 - Math.pow(1 - x, 4),
    inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
    outBack: (x, s = 1.6) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
  };
  // Respuesta de un resorte amortiguado a un escalón (u en segundos).
  function spring(u, freq = 2, zeta = 0.5) {
    if (u <= 0) return 0;
    const w = 2 * Math.PI * freq, wd = w * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w * u) * (Math.cos(wd * u) + ((zeta * w) / wd) * Math.sin(wd * u));
  }
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const mix = (a, b, e) => ({ x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), s: lerp(a.s, b.s, e) });

  /* ───────────── geometría del retablo (px de la imagen original 1254²) ───────────── */
  const OBJ = { cx: 627.5, cy: 572 };
  const NICHO = { x0: 423, y0: 439, x1: 835, y1: 954 };
  const NC = { x: (NICHO.x0 + NICHO.x1) / 2, y: (NICHO.y0 + NICHO.y1) / 2 };
  const CASA = { x: 960, y: 548, s: 0.927 };
  const LADO = { x: 505, y: 548, s: 0.76 };
  const ZMAX = 5.6;            // la hornacina cubre la pantalla
  const SC_DENTRO = 0.4;       // escala de la escena vista dentro de la hornacina
  const nichoEnPantalla = (p) => ({ x: p.x + (NC.x - OBJ.cx) * p.s, y: p.y + (NC.y - OBJ.cy) * p.s });
  const N0 = nichoEnPantalla(CASA);

  function pose(t) {
    let p = CASA;
    if (t < 1.2) p = mix(LADO, CASA, E.inOutCubic(seg(t, ...C.retabloAlCentro)));
    else if (t >= 11.99) p = mix(CASA, LADO, E.inOutCubic(seg(t, ...C.retabloAlLado)));
    // respira apenas; periódico en 15 s para que el bucle no salte
    const f = 3.5 * Math.sin((2 * Math.PI * 2 * t) / DUR);
    return { x: p.x, y: p.y + f, s: p.s };
  }

  // Cámara: Z es el zoom de la pared, P dónde cae el centro de la hornacina.
  function camara(t) {
    let e = 0;
    if (t >= C.empuje[0] && t <= C.empuje[1]) e = E.inOutCubic(seg(t, ...C.empuje));
    else if (t > C.empuje[1] && t < C.retroceso[0]) e = 1;
    else if (t >= C.retroceso[0] && t < C.retroceso[1] + 0.001) e = 1 - E.outQuart(seg(t, ...C.retroceso));
    const Z = Math.exp(Math.log(ZMAX) * e);
    const P = { x: lerp(N0.x, W / 2, e), y: lerp(N0.y, H / 2, e) };
    return { Z, P, e };
  }

  function anguloApertura(t, t0) {
    const u = t - t0;
    if (u <= 0) return 0;
    const a = 180 * spring(u, 1.35, 0.72);
    return 180 - Math.abs(180 - a); // rebota contra el tope en vez de atravesar la pared
  }
  function anguloPuerta(t, t0) {
    if (t < C.cierre[0]) return anguloApertura(t, t0);
    const p = seg(t, ...C.cierre);
    if (t < C.cierre[1]) return 180 * (1 - E.inCubic(p));
    const u = t - C.cierre[1];
    return 6 * Math.exp(-u * 9) * Math.abs(Math.sin(u * 19));
  }

  /* ───────────── utilidades de DOM ───────────── */
  const tf = (el, s) => { el.style.transform = s; };
  const show = (el, v) => { el.style.display = v ? '' : 'none'; };
  function splitLetters(el) {
    const txt = el.textContent;
    el.textContent = '';
    const mask = document.createElement('span');
    mask.className = 'mask';
    const out = [];
    for (const ch of txt) {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = ch;
      mask.appendChild(s);
      out.push(s);
    }
    el.appendChild(mask);
    return out;
  }
  function archPath(x, y, w, h, rb) {
    const r = w / 2;
    return `M ${x + r} ${y + h} L ${x + rb} ${y + h} Q ${x} ${y + h} ${x} ${y + h - rb} L ${x} ${y + r} ` +
      `A ${r} ${r} 0 0 1 ${x + w} ${y + r} L ${x + w} ${y + h - rb} Q ${x + w} ${y + h} ${x + w - rb} ${y + h} Z`;
  }
  function styleArch(el, w, h, rb) {
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.borderRadius = `${w / 2}px ${w / 2}px ${rb}px ${rb}px / ${w / 2}px ${w / 2}px ${rb}px ${rb}px`;
  }
  function filete(svg, x, y, w, h, rb, prog) {
    const path = svg.firstElementChild;
    path.setAttribute('d', archPath(x, y, w, h, rb));
    const L = path.getTotalLength();
    path.style.strokeDasharray = `${L}`;
    path.style.strokeDashoffset = `${L * (1 - prog)}`;
    svg.style.opacity = prog > 0 ? 1 : 0;
  }

  /* ───────────── construcción ───────────── */
  const el = {};
  ['scCafe', 'scCrepe', 'scHelado', 'world', 'yeso', 'rayosCaja', 'rayos', 'retablo', 'luzNicho', 'puertaIzq', 'puertaDer',
    'firma', 'logo', 'lgFlor', 'lgNombre', 'lgBrillo', 'lgFilete', 'lgBajada', 'lema', 'marca', 'fx', 'grano',
    'cafeArco', 'cafeFoto', 'cafeVapor', 'cafeFilete', 'cafeKicker', 'cafeTitle', 'cafeList',
    'crepeArcoA', 'crepeArcoB', 'crepeFotoA', 'crepeFotoB', 'crepeFileteA', 'crepeFileteB', 'crepeKicker', 'crepeTitle',
    'banda', 'bandaTira', 'heladoKicker', 'heladoTitle', 'bolas'].forEach((id) => (el[id] = $(id)));

  const letras = {
    cafe: splitLetters(el.cafeTitle),
    crepe: splitLetters(el.crepeTitle),
    helado: splitLetters(el.heladoTitle),
  };
  const lemaW = [...el.lema.querySelectorAll('.w')];
  const caras = ['puertaIzq', 'puertaDer'].map((id) => ({
    frente: el[id].querySelector('.frente .sombreado'),
    dorso: el[id].querySelector('.dorso .sombreado'),
  }));

  // Café
  const CAFE = { w: 560, h: 720, rb: 22 };
  styleArch(el.cafeArco, CAFE.w, CAFE.h, CAFE.rb);
  // Pone la foto cubriendo el arco con el punto `foco` de la foto al centro.
  function encuadrar(marco, w, h, foto) {
    const img = marco.querySelector('img');
    img.src = foto.src;
    if (foto.src2x) img.srcset = `${foto.src} 1x, ${foto.src2x} 2x`;
    const lado = Math.max(w, h) * (foto.zoom || 1);
    let x = w / 2 - foto.foco[0] * lado, y = h / 2 - foto.foco[1] * lado;
    x = Math.min(0, Math.max(w - lado, x));
    y = Math.min(0, Math.max(h - lado, y));
    Object.assign(img.style, { left: x + 'px', top: y + 'px', width: lado + 'px', height: lado + 'px' });
    return { x, y, lado };
  }
  const cafeFoto = encuadrar(el.cafeFoto, CAFE.w, CAFE.h, D.fotos.cafe);
  {
    const it = D.cafe.map((n) => `<span class="it">${n}</span>`);
    const linea = (xs) => `<div class="ln">${xs.join('<span class="dot">·</span>')}</div>`;
    el.cafeList.innerHTML = linea(it.slice(0, 2)) + (it.length > 2 ? linea(it.slice(2)) : '');
  }
  el.cafeVapor.width = CAFE.w * DPR; el.cafeVapor.height = CAFE.h * DPR;
  const vctx = el.cafeVapor.getContext('2d');

  // Crepes
  const ARCO_A = { w: 452, h: 592, rb: 20, cx: 1196, cy: 494 };
  const ARCO_B = { w: 318, h: 420, rb: 18, cx: 1652, cy: 596 };
  styleArch(el.crepeArcoA, ARCO_A.w, ARCO_A.h, ARCO_A.rb);
  styleArch(el.crepeArcoB, ARCO_B.w, ARCO_B.h, ARCO_B.rb);
  encuadrar(el.crepeFotoA, ARCO_A.w, ARCO_A.h, D.fotos['crepe-dulce']);
  encuadrar(el.crepeFotoB, ARCO_B.w, ARCO_B.h, D.fotos['crepe-salado']);
  const tiraHTML = D.crepes.map((n) => `<span>${n}</span><img src="assets/flor.webp" alt="">`).join('');
  el.bandaTira.innerHTML = tiraHTML + tiraHTML;

  // Helados: la vitrina, primero los sabores de acá
  const SABORES = D.sabores;
  const BOLA_W = 236;
  const nArriba = SABORES.length > 5 ? Math.floor(SABORES.length / 2) : 0;
  const nAbajo = SABORES.length - nArriba;
  const paso = Math.min(322, 1760 / Math.max(nAbajo, 1));
  const bolas = SABORES.map(([slug, nombre], i) => {
    const r = nArriba && i < nArriba ? 0 : 1;
    const c = r === 0 ? i : i - nArriba;
    const enFila = r === 0 ? nArriba : nAbajo;
    const x = W / 2 + (c - (enFila - 1) / 2) * paso;
    const base = nArriba ? (r === 0 ? 606 : 928) : 760; // base = donde se apoya la bola
    const sombra = document.createElement('div'); sombra.className = 'sombra';
    const b = document.createElement('div'); b.className = 'bola';
    const img = document.createElement('img'); img.src = `assets/scoops/${slug}.png`; b.appendChild(img);
    const s = document.createElement('div'); s.className = 'sabor'; s.textContent = nombre;
    el.bolas.append(sombra, b, s);
    const orden = r === 1 ? c : nAbajo + c;
    return { slug, c, r, x, base, sombra, b, img, s, orden, L: C.bolaPrimera + orden * C.bolaPaso };
  });

  /* ───────────── partículas ───────────── */
  el.fx.width = W * DPR; el.fx.height = H * DPR;
  const fx = el.fx.getContext('2d');
  const PAL = { turq: '#2f93a8', teal: '#3b9d9b', verde: '#1f5c3d', coral: '#e8826b', ambar: '#e6b64a', crema: '#fbf4e4' };
  function hoja(ctx, s, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.62, -s * 0.5, s * 0.58, s * 0.5, 0, s);
    ctx.bezierCurveTo(-s * 0.58, s * 0.5, -s * 0.62, -s * 0.5, 0, -s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = Math.max(1, s * 0.09);
    ctx.beginPath(); ctx.moveTo(0, -s * 0.78); ctx.lineTo(0, s * 0.82); ctx.stroke();
  }
  function gota(ctx, s, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.75, -s * 0.15, s * 0.6, s * 0.85, 0, s * 0.85);
    ctx.bezierCurveTo(-s * 0.6, s * 0.85, -s * 0.75, -s * 0.15, 0, -s);
    ctx.fill();
  }
  function florecita(ctx, s, col) {
    ctx.fillStyle = col;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.52, Math.sin(a) * s * 0.52, s * 0.42, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = PAL.coral;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.34, 0, Math.PI * 2); ctx.fill();
  }
  function estrella(ctx, s, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s);
    ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s);
    ctx.fill();
  }
  const FORMAS = [
    [hoja, PAL.turq, 0.3], [hoja, PAL.teal, 0.14], [hoja, PAL.verde, 0.16], [gota, PAL.coral, 0.18],
    [florecita, PAL.ambar, 0.12], [hoja, PAL.crema, 0.1],
  ];
  function formaAl(r) {
    let acc = 0;
    for (const f of FORMAS) { acc += f[2]; if (r < acc) return f; }
    return FORMAS[0];
  }

  // Estallido de pétalos al abrir: física cerrada (gravedad + arrastre lineal), sin integrar paso a paso.
  const petalos = [];
  {
    const R = rng(7);
    for (let i = 0; i < 74; i++) {
      const [fn, col] = formaAl(R());
      const ang = R() * Math.PI * 2;
      const sp = 260 + R() * 520;
      petalos.push({
        t0: C.estallido + R() * 0.55,
        x: NC.x + (R() - 0.5) * 300, y: NC.y + (R() - 0.5) * 380, z: -60,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.8 - 260, vz: 240 + R() * 520,
        rot: R() * 6.28, w: (R() - 0.5) * 7, fl: R() * 6.28, fw: 3 + R() * 6,
        s: 12 + R() * 16, fn, col,
      });
    }
  }
  // Polvo y dos hojas al cerrar las puertas.
  const polvo = [];
  {
    const R = rng(21);
    for (let i = 0; i < 26; i++) {
      const lado = R() < 0.5 ? -1 : 1;
      polvo.push({
        y: 440 + R() * 560, vx: lado * (80 + R() * 260), vy: -40 - R() * 90,
        s: 2 + R() * 3.5, life: 0.5 + R() * 0.5, hoja: i < 3, rot: R() * 6, w: (R() - 0.5) * 8,
      });
    }
  }
  // Pétalos que caen sobre la firma; su reloj da la vuelta en t = 15 → 0.
  const ambiente = [];
  {
    const R = rng(33);
    for (let i = 0; i < 12; i++) {
      const [fn, col] = formaAl(R());
      ambiente.push({
        t0: 12.45 + i * 0.3 + R() * 0.2, x: 120 + R() * 1680, vy: 60 + R() * 55, amp: 26 + R() * 40,
        om: 0.9 + R() * 0.9, ph: R() * 6.28, rot: R() * 6.28, w: (R() - 0.5) * 1.6, fl: R() * 6.28, fw: 1.5 + R() * 2.5,
        s: 9 + R() * 8, fn, col,
      });
    }
  }
  // Destellos al caer cada bola.
  const destellos = [];
  {
    const R = rng(51);
    bolas.forEach((b, i) => {
      for (let k = 0; k < 4; k++) {
        const a = -Math.PI / 2 + (R() - 0.5) * 2.4;
        destellos.push({ t0: b.L + 0.02 + R() * 0.08, i, a, d: 110 + R() * 70, s: 7 + R() * 9 });
      }
    });
  }

  function dibujaPieza(ctx, p, x, y, s, rot, flip, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(Math.max(0.12, Math.abs(flip)), 1);
    p.fn(ctx, s, p.col);
    ctx.restore();
  }

  function particulas(t, cam) {
    fx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fx.clearRect(0, 0, W, H);
    // estallido: vive en coordenadas de pared y sufre la misma cámara
    if (t > C.estallido && t < 3.4) {
      const F = 1300, g = 520, k = 0.9;
      for (const p of petalos) {
        const u = t - p.t0;
        if (u <= 0) continue;
        const fk = (1 - Math.exp(-k * u)) / k;
        const x = p.x + p.vx * fk, y = p.y + p.vy * fk + (g / k) * (u - fk), z = p.z + p.vz * fk;
        const zc = z + cam.e * 900; // la cámara avanza hacia la hornacina
        if (zc > F - 120) continue;
        const sc = F / (F - zc);
        // de la imagen del retablo a la pared (pose CASA) y de ahí a pantalla
        const wx = CASA.x + (x - OBJ.cx) * CASA.s, wy = CASA.y + (y - OBJ.cy) * CASA.s;
        const px = N0.x + (wx - N0.x) * sc, py = N0.y + (wy - N0.y) * sc;
        const sx = cam.P.x + cam.Z * (px - N0.x), sy = cam.P.y + cam.Z * (py - N0.y);
        const a = Math.min(1, u * 6) * (1 - seg(t, 2.9, 3.35));
        dibujaPieza(fx, p, sx, sy, p.s * sc * cam.Z * CASA.s, p.rot + p.w * u, Math.cos(p.fl + p.fw * u), a);
      }
    }
    // polvo del portazo
    if (t >= C.cierre[1] - 0.02 && t < C.cierre[1] + 1.1) {
      const u = t - C.cierre[1];
      const ps = pose(t);
      for (const d of polvo) {
        if (u > d.life) continue;
        const fk = (1 - Math.exp(-2.4 * u)) / 2.4;
        const ix = 632 + d.vx * fk, iy = d.y + d.vy * fk + 60 * u * u;
        const sx = ps.x + (ix - OBJ.cx) * ps.s, sy = ps.y + (iy - OBJ.cy) * ps.s;
        const a = (1 - u / d.life) * 0.8;
        if (d.hoja) {
          dibujaPieza(fx, { fn: hoja, col: PAL.turq }, sx, sy, 11, d.rot + d.w * u, Math.cos(d.rot + 5 * u), a);
        } else {
          fx.fillStyle = `rgba(250,244,228,${a})`;
          fx.beginPath(); fx.arc(sx, sy, d.s, 0, Math.PI * 2); fx.fill();
        }
      }
    }
    // pétalos sobre la firma (continúan a través del corte del bucle)
    const tau = t < 7.5 ? t + DUR : t;
    if (tau > 12.4 && tau < 16.1) {
      for (const p of ambiente) {
        const u = tau - p.t0;
        if (u <= 0) continue;
        const y = -40 + p.vy * u, x = p.x + p.amp * Math.sin(p.om * u + p.ph);
        if (y > H + 40) continue;
        const a = Math.min(1, u * 2) * 0.9 * (1 - seg(tau, 15.55, 16.05));
        dibujaPieza(fx, p, x, y, p.s, p.rot + p.w * u, Math.cos(p.fl + p.fw * u), a);
      }
    }
    // destellos de las bolas
    if (t > C.bolaPrimera - 0.1 && t < 9.2) {
      for (const d of destellos) {
        const u = t - d.t0;
        if (u <= 0 || u > 0.5) continue;
        const b = bolas[d.i];
        const cx = b.x + Math.cos(d.a) * d.d * (0.8 + u), cy = b.base - 108 + Math.sin(d.a) * d.d * (0.8 + u) * 0.8;
        const k = Math.sin(Math.PI * clamp(u / 0.5));
        fx.save(); fx.globalAlpha = k; fx.translate(cx, cy); fx.rotate(u * 3);
        estrella(fx, d.s * (0.5 + k), '#fdf8ec'); fx.restore();
      }
    }
    // destellos de la flor al firmar
    if (t > C.flor && t < C.flor + 1.0) {
      const u = t - C.flor;
      const lp = logoPos();
      const fcx = lp.x + 507 * lp.s, fcy = lp.y + 116 * lp.s;
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + 0.3;
        const r = 110 + 150 * E.outCubic(clamp(u / 0.8));
        const al = Math.sin(Math.PI * clamp(u / 0.8));
        fx.save(); fx.globalAlpha = al * 0.9; fx.translate(fcx + Math.cos(a) * r, fcy + Math.sin(a) * r);
        fx.rotate(a + u * 2); estrella(fx, 9 * (1 - 0.5 * u), k % 2 ? PAL.ambar : PAL.turq); fx.restore();
      }
    }
  }

  /* ───────────── vapor del café ───────────── */
  function vapor(t, ks) {
    vctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    vctx.clearRect(0, 0, CAFE.w, CAFE.h);
    const v = D.fotos.cafe.vapor || [0.5, 0.35];
    const ox = CAFE.w / 2 + ks * (cafeFoto.x + v[0] * cafeFoto.lado - CAFE.w / 2);
    const oy = CAFE.h / 2 + ks * (cafeFoto.y + v[1] * cafeFoto.lado - CAFE.h / 2);
    vctx.filter = `blur(${7 * DPR}px)`;   // el desenfoque del lienzo va en píxeles reales
    vctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const ph = i * 2.1, x0 = ox + (i - 1) * 34;
      const grad = vctx.createLinearGradient(0, oy, 0, oy - 300);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.2, 'rgba(255,255,255,.5)');
      grad.addColorStop(0.65, 'rgba(255,255,255,.26)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      vctx.strokeStyle = grad;
      vctx.lineWidth = 20 - i * 3;
      vctx.beginPath();
      for (let j = 0; j <= 30; j++) {
        const y = oy - j * 10;
        const amp = 6 + j * 1.1;
        const x = x0 + amp * Math.sin(j * 0.32 - t * 2.4 + ph) + 10 * Math.sin(t * 0.9 + i);
        if (j === 0) vctx.moveTo(x, y); else vctx.lineTo(x, y);
      }
      vctx.stroke();
    }
    vctx.filter = 'none';
  }

  /* ───────────── grano ───────────── */
  const gctx = el.grano.getContext('2d');
  const ruidos = [];
  {
    const R = rng(99);
    for (let n = 0; n < 6; n++) {
      const c = document.createElement('canvas');
      c.width = 1024; c.height = 600;
      const cx = c.getContext('2d');
      const im = cx.createImageData(1024, 600);
      for (let i = 0; i < im.data.length; i += 4) {
        const v = 128 + (R() + R() + R() - 1.5) * 120;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
      }
      cx.putImageData(im, 0, 0);
      ruidos.push(c);
    }
  }
  function grano(t) {
    const f = Math.round(t * C.fps);
    const R = rng(1000 + f);
    gctx.drawImage(ruidos[f % ruidos.length], -Math.floor(R() * 60), -Math.floor(R() * 56));
  }

  /* ───────────── firma ───────────── */
  const LOGO = { x: 1268 - 507 * 0.8, y: 222, s: 0.8 };
  const logoPos = () => LOGO;

  /* ───────────── seek ───────────── */
  function seek(tIn) {
    let t = ((tIn % DUR) + DUR) % DUR;
    const cam = camara(t);
    const ps = pose(t);

    /* mundo: yeso + retablo */
    const verMundo = t < C.empuje[1] || t >= C.retroceso[0];
    show(el.world, verMundo);
    if (verMundo) {
      tf(el.world, `translate(${cam.P.x - cam.Z * N0.x}px, ${cam.P.y - cam.Z * N0.y}px) scale(${cam.Z})`);
      // hornacina calada en el yeso (en coords del yeso, que empieza en -120,-120)
      const x0 = ps.x + (NICHO.x0 + 4 - OBJ.cx) * ps.s + 120, x1 = ps.x + (NICHO.x1 - 4 - OBJ.cx) * ps.s + 120;
      const y0 = ps.y + (NICHO.y0 + 4 - OBJ.cy) * ps.s + 120, y1 = ps.y + (NICHO.y1 - 4 - OBJ.cy) * ps.s + 120;
      el.yeso.style.clipPath = el.rayosCaja.style.clipPath = `path(evenodd, "M0 0 H2160 V1320 H0 Z M${x0} ${y0} H${x1} V${y1} H${x0} Z")`;
      // portazo: la caja se aplasta un pelo contra su base y vuelve
      const us = t - C.cierre[1];
      const slam = us >= 0 && us < 0.6 ? Math.exp(-us * 10) * Math.sin(us * 30 + 1.2) : 0;
      const sxr = ps.s * (1 + 0.012 * slam), syr = ps.s * (1 - 0.02 * slam);
      tf(el.retablo, `translate(${ps.x - OBJ.cx * sxr}px, ${ps.y + (1030 - OBJ.cy) * ps.s - 1030 * syr}px) scale(${sxr}, ${syr})`);

      // puertas
      let aI = anguloPuerta(t, C.puertaIzq), aD = anguloPuerta(t, C.puertaDer);
      tf(el.puertaIzq, `rotateY(${-aI}deg)`);
      tf(el.puertaDer, `rotateY(${aD}deg)`);
      [aI, aD].forEach((a, i) => {
        const s = Math.sin((a * Math.PI) / 180);
        caras[i].frente.style.opacity = (0.42 * s).toFixed(3);
        caras[i].dorso.style.opacity = (0.42 * s).toFixed(3);
      });

      // luz de la hornacina y resplandor
      const abierta = Math.max(aI, aD) / 180;
      let luz = 0.8 * E.outCubic(seg(t, C.puertaIzq + 0.05, C.puertaIzq + 0.4)) * (1 - 0.85 * E.outQuad(seg(t, 1.42, 1.95))) * (1 - seg(t, 2.1, 2.6));
      if (t >= 10) luz = 0.35 * abierta * seg(t, 10.9, 11.3);
      el.luzNicho.style.opacity = luz.toFixed(3);
      let ray = 0.5 * E.outCubic(seg(t, 1.1, 1.5)) * (1 - E.inCubic(seg(t, 1.85, 2.6)));
      if (t >= 10) ray = 0.32 * seg(t, 10.95, 11.35) * (1 - seg(t, 11.55, 11.95));
      el.rayos.style.opacity = ray.toFixed(3);
      const nw = nichoEnPantalla(ps);
      tf(el.rayos, `translate(${nw.x - 800 + 120}px, ${nw.y - 800 + 120}px) rotate(${t * 7}deg)`);
    }

    /* 01 · café */
    const verCafe = t >= 1.0 && t < 5.24;
    show(el.scCafe, verCafe);
    if (verCafe) {
      const ew = E.inOutQuart(seg(t, ...C.latigo));
      if (t < C.empuje[1]) {
        const sc = Math.exp(lerp(Math.log(SC_DENTRO), 0, cam.e));
        tf(el.scCafe, `translate(${cam.P.x - sc * W / 2}px, ${cam.P.y - sc * H / 2}px) scale(${sc})`);
      } else {
        tf(el.scCafe, `translate(${-W * ew}px, 0px)`);
      }
      const m = E.inOutCubic(seg(t, 3.0, 3.62));
      const cx = lerp(W / 2, 1338, m), top = 180;
      el.cafeArco.style.left = cx - CAFE.w / 2 + 'px';
      el.cafeArco.style.top = top + 'px';
      const ks = lerp(1.18, 1.0, seg(t, 1.0, 5.2));
      tf(el.cafeFoto, `scale(${ks})`);
      filete(el.cafeFilete, cx - CAFE.w / 2 - 22, top - 22, CAFE.w + 44, CAFE.h + 44, CAFE.rb + 18, E.inOutCubic(seg(t, 3.12, 3.95)));
      vapor(t, ks);
      letras.cafe.forEach((s, k) => {
        const p = E.outCubic(seg(t, C.cafeTexto + 0.1 + k * 0.065, C.cafeTexto + 0.7 + k * 0.065));
        tf(s, `translateY(${(1 - p) * 112}%)`);
      });
      const pk = E.outCubic(seg(t, C.cafeTexto, C.cafeTexto + 0.6));
      el.cafeKicker.style.opacity = pk;
      el.cafeKicker.style.letterSpacing = `${lerp(0.7, 0.34, pk)}em`;
      el.cafeList.querySelectorAll('.it, .dot').forEach((s, k) => {
        const p = E.outCubic(seg(t, 3.5 + k * 0.06, 4.0 + k * 0.06));
        s.style.opacity = p;
        tf(s, `translateY(${(1 - p) * 26}px)`);
      });
    }

    /* 02 · crepes */
    const verCrepe = t >= 4.76 && t < 7.3;
    show(el.scCrepe, verCrepe);
    if (verCrepe) {
      const ew = E.inOutQuart(seg(t, ...C.latigo));
      tf(el.scCrepe, `translate(${W * (1 - ew)}px, 0px)`);
      const lagA = 150 * (1 - spring(t - 4.95, 1.5, 0.6));
      const lagB = 250 * (1 - spring(t - 4.99, 1.35, 0.6));
      const ax = ARCO_A.cx + lagA, bx = ARCO_B.cx + lagB;
      el.crepeArcoA.style.left = ax - ARCO_A.w / 2 + 'px'; el.crepeArcoA.style.top = ARCO_A.cy - ARCO_A.h / 2 + 'px';
      el.crepeArcoB.style.left = bx - ARCO_B.w / 2 + 'px'; el.crepeArcoB.style.top = ARCO_B.cy - ARCO_B.h / 2 + 'px';
      tf(el.crepeFotoA, `scale(${lerp(1.14, 1.0, seg(t, 4.8, 7.3))})`);
      tf(el.crepeFotoB, `scale(${lerp(1.0, 1.12, seg(t, 4.8, 7.3))})`);
      filete(el.crepeFileteA, ax - ARCO_A.w / 2 - 20, ARCO_A.cy - ARCO_A.h / 2 - 20, ARCO_A.w + 40, ARCO_A.h + 40, ARCO_A.rb + 16, E.inOutCubic(seg(t, 5.12, 5.9)));
      filete(el.crepeFileteB, bx - ARCO_B.w / 2 - 18, ARCO_B.cy - ARCO_B.h / 2 - 18, ARCO_B.w + 36, ARCO_B.h + 36, ARCO_B.rb + 14, E.inOutCubic(seg(t, 5.25, 6.0)));
      letras.crepe.forEach((s, k) => {
        const p = E.outCubic(seg(t, 5.16 + k * 0.055, 5.76 + k * 0.055));
        tf(s, `translateY(${(1 - p) * 112}%)`);
      });
      const pk = E.outCubic(seg(t, 5.1, 5.7));
      el.crepeKicker.style.opacity = pk;
      el.crepeKicker.style.letterSpacing = `${lerp(0.7, 0.34, pk)}em`;
      const pb = E.outCubic(seg(t, 5.3, 5.75));
      tf(el.banda, `translateY(${(1 - pb) * 150}px)`);
      const tira = el.bandaTira.scrollWidth / 2 || 1;
      tf(el.bandaTira, `translateX(${-(((t - 4.8) * 250) % tira)}px)`);
    }

    /* 03 · helados */
    const verHelado = t >= 6.82 && t < 12.02;
    show(el.scHelado, verHelado);
    if (verHelado) {
      const ri = E.inOutCubic(seg(t, ...C.iris));
      el.scHelado.style.clipPath = ri < 1 ? `circle(${ri * 1160}px at 960px 560px)` : 'none';
      if (t >= C.retroceso[0]) {
        const s2 = Math.exp(lerp(0, Math.log(SC_DENTRO), 1 - cam.e));
        tf(el.scHelado, `translate(${cam.P.x - s2 * W / 2}px, ${cam.P.y - s2 * H / 2}px) scale(${s2})`);
      } else tf(el.scHelado, 'none');
      letras.helado.forEach((s, k) => {
        const p = E.outCubic(seg(t, 7.1 + k * 0.05, 7.68 + k * 0.05));
        tf(s, `translateY(${(1 - p) * 112}%)`);
      });
      const pk = E.outCubic(seg(t, 7.05, 7.6));
      el.heladoKicker.style.opacity = pk;
      el.heladoKicker.style.letterSpacing = `${lerp(0.7, 0.34, pk)}em`;
      for (const b of bolas) {
        const F = C.bolaCaida;
        const u = t - b.L;
        let y = 0, sx = 1, sy = 1, vis = t > b.L - F;
        if (u < 0) {
          const p = seg(t, b.L - F, b.L);
          y = -(b.base + 60) * (1 - E.inQuad(p));
          const v = p; // estira al caer
          sx = 1 - 0.07 * v; sy = 1 + 0.1 * v;
        } else {
          const q = Math.exp(-u * 11) * Math.cos(2 * Math.PI * 3.1 * u);
          sx = 1 + 0.17 * q; sy = 1 - 0.2 * q;
          if (u > 0.03 && u < 0.26) y = -26 * Math.sin((Math.PI * (u - 0.03)) / 0.23);
          // baila a tiempo: columnas alternas en cada pulso
          if (t > 8.55 && t < 10.55) {
            const bt = (t - 7.0) / 0.5;
            const k = Math.floor(bt), fr = (bt - k) * 0.5;
            if ((k + b.c) % 2 === 0 && fr < 0.2) {
              y += -13 * Math.sin((Math.PI * fr) / 0.2);
            }
            if ((k + b.c) % 2 === 0 && fr >= 0.2 && fr < 0.32) {
              const qq = Math.sin((Math.PI * (fr - 0.2)) / 0.12);
              sx *= 1 + 0.05 * qq; sy *= 1 - 0.06 * qq;
            }
          }
        }
        b.b.style.display = vis ? '' : 'none';
        const h = b.img.naturalHeight * (BOLA_W / (b.img.naturalWidth || 1));
        b.b.style.left = b.x - BOLA_W / 2 + 'px';
        b.b.style.top = b.base - h + 'px';
        tf(b.b, `translateY(${y}px) scale(${sx}, ${sy})`);
        const cerca = u >= 0 ? 1 : clamp(1 + y / 700);
        b.sombra.style.left = b.x - 105 + 'px';
        b.sombra.style.top = b.base - 20 + 'px';
        b.sombra.style.opacity = vis ? (0.25 + 0.75 * cerca) * (u >= 0 ? 1 - Math.min(0.35, -y / 80) : 1) : 0;
        tf(b.sombra, `scale(${0.55 + 0.45 * cerca}, ${0.55 + 0.45 * cerca})`);
        const pn = E.outBack(seg(t, b.L + 0.05, b.L + 0.4));
        b.s.style.left = b.x - 150 + 'px';
        b.s.style.top = b.base + 22 + 'px';
        b.s.style.opacity = clamp(pn);
        tf(b.s, `translateY(${(1 - pn) * 18}px)`);
      }
    }

    /* firma */
    const verFirma = t < 0.62 || t >= 12.2;
    show(el.firma, verFirma);
    if (verFirma) {
      tf(el.logo, `translate(${LOGO.x}px, ${LOGO.y}px) scale(${LOGO.s})`);
      el.lema.style.left = LOGO.x + 507 * LOGO.s - 550 + 'px';
      el.lema.style.top = LOGO.y + 530 * LOGO.s + 70 + 'px';
      if (t < 1) {
        const o = 1 - E.inCubic(seg(t, 0.04, 0.5));
        el.logo.style.opacity = o;
        el.logo.style.filter = `blur(${(1 - o) * 10}px)`;
        tf(el.logo, `translate(${LOGO.x + (1 - o) * 80}px, ${LOGO.y}px) scale(${LOGO.s})`);
        el.lema.style.opacity = 1 - seg(t, 0.0, 0.3);
        lemaW.forEach((w) => { w.style.opacity = 1; tf(w, 'none'); w.style.filter = 'none'; });
        el.lgFlor.style.opacity = 1; tf(el.lgFlor, 'none');
        el.lgNombre.style.webkitMaskImage = el.lgNombre.style.maskImage = 'none';
        tf(el.lgNombre, 'none');
        tf(el.lgFilete, 'none');
        el.lgBajada.style.opacity = 1; tf(el.lgBajada, 'none');
        el.lgBrillo.style.opacity = 0;
      } else {
        el.logo.style.opacity = 1; el.logo.style.filter = 'none';
        el.lema.style.opacity = 1;
        const u = t - C.flor;
        const sF = spring(u, 1.7, 0.48);
        const rF = -150 * (1 - E.outCubic(seg(t, C.flor, C.flor + 0.9)));
        el.lgFlor.style.opacity = clamp(u / 0.08);
        tf(el.lgFlor, `rotate(${rF}deg) scale(${sF})`);
        const pn = E.inOutCubic(seg(t, ...C.nombre));
        const X = lerp(-4, 116, pn);
        const mk = `linear-gradient(90deg, #000 ${X - 14}%, rgba(0,0,0,0) ${X}%)`;
        el.lgNombre.style.webkitMaskImage = el.lgNombre.style.maskImage = pn >= 1 ? 'none' : mk;
        tf(el.lgNombre, `translateY(${(1 - E.outCubic(seg(t, ...C.nombre))) * 16}px)`);
        tf(el.lgFilete, `scaleX(${E.inOutCubic(seg(t, ...C.filete))})`);
        const pb = E.outCubic(seg(t, ...C.bajada));
        el.lgBajada.style.opacity = pb;
        tf(el.lgBajada, `translateY(${(1 - pb) * 14}px) scaleX(${lerp(1.06, 1, pb)})`);
        lemaW.forEach((w, k) => {
          const p = E.outCubic(seg(t, C.lema + k * 0.075, C.lema + 0.5 + k * 0.075));
          w.style.opacity = p;
          tf(w, `translateY(${(1 - p) * 20}px)`);
          w.style.filter = p < 1 ? `blur(${(1 - p) * 6}px)` : 'none';
        });
        const pbr = seg(t, ...C.brillo);
        el.lgBrillo.style.opacity = pbr > 0 && pbr < 1 ? 1 : 0;
        const Xb = lerp(-25, 125, E.inOutSine(pbr));
        el.lgBrillo.style.background = `linear-gradient(100deg, rgba(47,147,168,0) ${Xb - 11}%, rgba(61,163,184,.95) ${Xb}%, rgba(47,147,168,0) ${Xb + 11}%)`;
      }
    }

    /* flor de la casa en la esquina durante los productos */
    const vm = seg(t, 3.25, 3.7) * (1 - seg(t, 10.2, 10.5));
    el.marca.style.opacity = vm;
    show(el.marca, vm > 0);
    tf(el.marca, `rotate(${t * 12}deg)`);

    particulas(t, cam);
    grano(t);
  }

  /* ───────────── arranque ───────────── */
  const imgs = [...document.images];
  const listo = Promise.all([
    document.fonts.ready,
    ...imgs.map((im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.onload = im.onerror = r; }))),
    ...[D.fotos.cafe.src, D.fotos['crepe-dulce'].src, D.fotos['crepe-salado'].src, 'assets/yeso.webp'].map((src) => {
      const im = new Image(); im.src = src; return im.decode().catch(() => {});
    }),
  ]).then(() => Promise.all(imgs.map((im) => im.decode().catch(() => {}))))
    .then(() => { seek(0); return true; });

  window.seek = seek;
  window.listo = listo;

  // Vista previa en vivo: index.html?play (con sonido si existe audio/pista.wav)
  const q = new URLSearchParams(location.search);
  if (q.has('t')) listo.then(() => seek(parseFloat(q.get('t'))));
  if (q.has('play')) {
    listo.then(() => {
      const audio = new Audio('audio/pista.wav');
      audio.loop = true;
      let t0 = null;
      const tick = (now) => {
        if (t0 === null) t0 = now;
        const t = audio.currentTime > 0 ? audio.currentTime : (now - t0) / 1000;
        seek(t);
        requestAnimationFrame(tick);
      };
      document.addEventListener('click', () => audio.play(), { once: true });
      requestAnimationFrame(tick);
    });
  }
})();
