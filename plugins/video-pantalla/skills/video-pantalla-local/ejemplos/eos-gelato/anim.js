// EOS Gelato · 15 s en bucle para la pantalla del local.
// `seek(t)` dibuja cualquier instante como función pura del tiempo: nada depende
// del cuadro anterior, así cada cuadro se puede generar suelto y con submuestras.
(() => {
  const C = window.CUES, D = window.DATOS, LG = window.LOGO;
  const DPR = window.devicePixelRatio || 1;
  const W = 1920, H = 1080;
  const $ = (s) => document.querySelector(s);

  // ───────────── matemática ─────────────
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const E = {
    inOutCubic: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
    inOutQuart: (u) => (u < 0.5 ? 8 * u ** 4 : 1 - Math.pow(-2 * u + 2, 4) / 2),
    outCubic: (u) => 1 - Math.pow(1 - u, 3),
    outQuart: (u) => 1 - Math.pow(1 - u, 4),
    outQuint: (u) => 1 - Math.pow(1 - u, 5),
    inCubic: (u) => u * u * u,
    inQuad: (u) => u * u,
    outQuad: (u) => 1 - (1 - u) * (1 - u),
    inOutSine: (u) => -(Math.cos(Math.PI * u) - 1) / 2,
    outSine: (u) => Math.sin((u * Math.PI) / 2),
    outBack: (u, s = 1.4) => 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2),
  };
  // Oscilación amortiguada: 0 al disparar, se apaga sola. `s` en segundos desde el golpe.
  const vaiven = (s, f, z) => (s <= 0 ? 0 : Math.exp(-z * s) * Math.sin(2 * Math.PI * f * s));

  // Afines 2D [a b c d e f]: x' = a·x + c·y + e ; y' = b·x + d·y + f
  const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3],
    A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  const T = (x, y) => [1, 0, 0, 1, x, y];
  const S = (sx, sy = sx) => [sx, 0, 0, sy, 0, 0];
  const ap = (A, x, y) => [A[0] * x + A[2] * y + A[4], A[1] * x + A[3] * y + A[5]];
  const sobre = (x, y, A) => mul(T(x, y), mul(A, T(-x, -y)));

  // Azar con semilla: el mismo cuadro sale igual en cualquier trabajador.
  function azar(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ───────────── el logo, letra por letra ─────────────
  const LW = LG.ancho, LH = LG.alto;
  const LET = {};
  for (const L of 'EOS') {
    const sps = LG.letras[L];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < sps[0].length; i += 2) {
      x0 = Math.min(x0, sps[0][i]); x1 = Math.max(x1, sps[0][i]);
      y0 = Math.min(y0, sps[0][i + 1]); y1 = Math.max(y1, sps[0][i + 1]);
    }
    const l = { sps, x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    if (sps[1]) {
      let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
      for (let i = 0; i < sps[1].length; i += 2) {
        a = Math.min(a, sps[1][i]); c = Math.max(c, sps[1][i]);
        b = Math.min(b, sps[1][i + 1]); d = Math.max(d, sps[1][i + 1]);
      }
      l.hueco = { x: (a + c) / 2, y: (b + d) / 2 };
    }
    LET[L] = l;
  }
  const f2 = (v) => (Math.round(v * 100) / 100).toString();
  function dSub(sp, A) {
    let p = ap(A, sp[0], sp[1]);
    let d = `M${f2(p[0])} ${f2(p[1])}`;
    for (let i = 2; i < sp.length; i += 6) {
      const a = ap(A, sp[i], sp[i + 1]), b = ap(A, sp[i + 2], sp[i + 3]), c = ap(A, sp[i + 4], sp[i + 5]);
      d += `C${f2(a[0])} ${f2(a[1])} ${f2(b[0])} ${f2(b[1])} ${f2(c[0])} ${f2(c[1])}`;
    }
    return d + 'Z';
  }
  function dLetra(L, A, hueco = 1) {
    const l = LET[L];
    let d = dSub(l.sps[0], A);
    if (l.sps[1] && hueco > 0.002) d += dSub(l.sps[1], mul(A, sobre(l.hueco.x, l.hueco.y, S(hueco))));
    return d;
  }
  // Caja de una letra ya transformada (por sus esquinas: alcanza para escalas y traslados).
  function caja(L, A) {
    const l = LET[L];
    const p = ap(A, l.x0, l.y0), q = ap(A, l.x1, l.y1);
    return { x0: Math.min(p[0], q[0]), y0: Math.min(p[1], q[1]), x1: Math.max(p[0], q[0]), y1: Math.max(p[1], q[1]) };
  }

  const K0 = 700 / LW, Y0 = 430;        // la firma
  const K1 = 1440 / LW, Y1 = 540;       // las letras como ventanas
  const matLogo = (cy, k) => mul(T(W / 2, cy), mul(S(k), T(-LW / 2, -LH / 2)));
  const ZIN = 7, ZOUT = 11;
  const centroO = ap(matLogo(Y1, K1), LET.O.cx, LET.O.cy);
  const nucleoS = ap(matLogo(Y1, K1), LG.nucleo.S[0], LG.nucleo.S[1]);

  // Escala y posición del logo. El tamaño cambia con una gelatina: cada letra
  // se aplasta y se estira sobre su base, con un pelo de retraso entre letras.
  function estadoLogo(t) {
    let k = K0, cy = Y0;
    const [c0, c1] = C.crece, [a0, a1] = C.asienta;
    if (t >= c0 && t < a0) {
      const u = E.outCubic(prog(t, c0, c1));
      k = lerp(K0, K1, u); cy = lerp(Y0, Y1, u);
    } else if (t >= a0) {
      const u = E.inOutCubic(prog(t, a0, a1));
      k = lerp(K1, K0, u); cy = lerp(Y1, Y0, u);
    }
    const jalea = {};
    [...'EOS'].forEach((L, i) => {
      const r = i * 0.045;
      // al crecer: se agacha y salta; al asentarse: rebota al llegar
      const g = vaiven(t - c0 - r, 2.6, 5.2) * 0.13 + vaiven(t - a1 + 0.12 - r, 3.0, 6.5) * 0.09
        - vaiven(t - C.cierraO[1] - r, 3.4, 7) * (L === 'O' ? 0.05 : 0.025);
      jalea[L] = sobre(LET[L].cx, LET[L].y1, S(1 - g * 0.55, 1 + g));
    });
    return { k, cy, jalea };
  }

  // La cámara: entra por la «O» y sale por la «S». La foto vive en un plano más
  // lejano que las letras y crece menos (paralaje), así el zoom tiene fondo.
  const LEJOS = 2.5;
  const zLejos = (z) => LEJOS / (LEJOS - (1 - 1 / z));
  function camara(t) {
    const [z0, z1] = C.zoom, [s0, s1] = C.salida;
    if (t >= z0 && t < z1 + 0.02) {
      const e = E.inOutCubic(prog(t, z0, z1));
      const z = Math.exp(Math.log(ZIN) * e);
      const cx = lerp(centroO[0], W / 2, e), cy = lerp(centroO[1], H / 2, e);
      return { z, M: mul(T(cx, cy), mul(S(z), T(-centroO[0], -centroO[1]))),
        Mf: mul(T(cx, cy), mul(S(zLejos(z)), T(-centroO[0], -centroO[1]))) };
    }
    if (t >= s0 && t < s1) {
      const e = E.outCubic(prog(t, s0, s1));
      const z = Math.exp(Math.log(ZOUT) * (1 - e));
      const cx = lerp(W / 2, nucleoS[0], e), cy = lerp(H / 2, nucleoS[1], e);
      return { z, M: mul(T(cx, cy), mul(S(z), T(-nucleoS[0], -nucleoS[1]))), Mf: null };
    }
    return { z: 1, M: [1, 0, 0, 1, 0, 0], Mf: [1, 0, 0, 1, 0, 0] };
  }

  // ───────────── fotos: encuadre ─────────────
  const FOTO = 1122;                           // lado de las fotos publicadas (cuadradas)
  const tam = (img) => img.naturalWidth || FOTO;
  // Encuadre = escala s (px de pantalla por px de foto) y dónde cae el foco en pantalla.
  function colocar(img, s, fx, fy, X, Y, lado) {
    const n = lado || tam(img) / (img.dataset.doble ? 2 : 1);
    const sc = s * (n / tam(img));
    const tx = X - s * fx * n, ty = Y - s * fy * n;
    img.style.width = tam(img) + 'px';
    img.style.transform = `translate(${f2(tx)}px,${f2(ty)}px) scale(${sc.toFixed(5)})`;
  }
  // La foto cubre la caja w×h entera: escala de cobertura y foco al centro hasta donde dejan los bordes.
  function encuadrarCaja(img, w, h, fx, fy, zoom = 1) {
    const s = (Math.max(w, h) / FOTO) * zoom, n = s * FOTO;
    const tx = clamp(w / 2 - s * fx * FOTO, w - n, 0), ty = clamp(h / 2 - s * fy * FOTO, h - n, 0);
    const sc = s * (FOTO / tam(img));
    img.style.width = tam(img) + 'px';
    img.style.transform = `translate(${f2(tx)}px,${f2(ty)}px) scale(${sc.toFixed(5)})`;
  }
  function usarFoto(img, item, doble) {
    img.src = doble && item.src2x ? item.src2x : item.src;
    if (doble && item.src2x) img.dataset.doble = '1';
  }

  const O = D.vitrina[0];                      // la foto que se abre: Maracuyá
  const fE = D.letras[0], fS = D.letras[2];
  const vE = $('#vE'), vO = $('#vO'), vS = $('#vS');
  const imgE = vE.querySelector('img'), imgO = vO.querySelector('img'), imgS = vS.querySelector('img');
  usarFoto(imgE, fE, true); usarFoto(imgO, O, true); usarFoto(imgS, fS, true);

  // La vitrina: arcos sobre verde bosque.
  const AW = 340, AH = 460, BORDE = 7, PASO = 384, FX0 = 740, FY0 = 292;
  const RT = AW / 2, rb = 14;
  const fila = $('#vitrinaFila');
  const piezas = D.vitrina.slice(0, 8).map((it, i) => {
    const p = document.createElement('div');
    p.className = 'pieza';
    p.innerHTML = `<div class="arco" style="width:${AW}px;height:${AH}px;border-radius:${RT}px ${RT}px ${rb}px ${rb}px">
      <div class="foto" style="border-radius:${RT - BORDE}px ${RT - BORDE}px ${rb - BORDE / 2}px ${rb - BORDE / 2}px"><img alt=""></div></div>
      <div class="etiqueta" style="top:${AH + 26}px;width:${AW + 120}px;left:-60px">
        <div class="nombre">${it.nombre}</div><div class="rotulo">${it.rotulo}</div></div>`;
    fila.appendChild(p);
    const img = p.querySelector('img');
    usarFoto(img, it, false);
    return { p, arco: p.querySelector('.arco'), img, et: p.querySelector('.etiqueta'), it };
  });
  const encuadreArco = (it) => ({ s: ((AH - 2 * BORDE) / FOTO) * (it.zoom || 1), fx: it.foco[0], fy: it.foco[1] });

  // Bebidas: carrusel de arcos en 3D.
  const BW = 430, BH = 580, R = 830, NB = D.bebidas.length, PASOANG = 360 / NB;
  const anillo = $('#anillo');
  const bebidas = D.bebidas.map((it, i) => {
    const a = document.createElement('div');
    a.className = 'arco';
    a.style.cssText = `width:${BW}px;height:${BH}px;margin:${-BH / 2}px 0 0 ${-BW / 2}px;border-radius:${BW / 2}px ${BW / 2}px 16px 16px;` +
      `transform:rotateY(${i * PASOANG}deg) translateZ(${R}px)`;
    a.innerHTML = `<div class="foto" style="border-radius:${BW / 2 - BORDE}px ${BW / 2 - BORDE}px 9px 9px"><img alt=""></div>`;
    anillo.appendChild(a);
    const img = a.querySelector('img');
    usarFoto(img, it, false);
    return { a, img, it };
  });

  // Hojas de la casa: la monstera asoma por la esquina, con su sombra en el muro.
  const hojas = $('#hojas');
  // `tallo` es dónde cae el nacimiento de las hojas en pantalla; giran desde ahí.
  const TALLO = [470, 915];
  const HOJAS = [
    { tallo: [1985, -45], s: 0.72, r: 222, vaiven: 1.6, sombra: [-34, 42] },
    { tallo: [-60, 1135], s: 0.5, r: 38, vaiven: -1.2, sombra: [30, -26] },
  ];
  const hojaEls = HOJAS.map((h) => {
    const sombra = new Image(); sombra.src = 'assets/hojas.png'; sombra.className = 'hoja sombra';
    const hoja = new Image(); hoja.src = 'assets/hojas.png'; hoja.className = 'hoja';
    hojas.appendChild(sombra); hojas.appendChild(hoja);
    return { h, sombra, hoja };
  });

  // Palabras que suben de su renglón, como en la carta.
  function sube(el, t, t0, dur = 0.62, salida = null) {
    const u = E.outQuint(prog(t, t0, t0 + dur));
    let y = (1 - u) * 110, o = clamp((t - t0) / 0.18), blur = (1 - u) * 6;
    if (salida) {
      const v = E.inCubic(prog(t, salida[0], salida[1]));
      y -= v * 110; o *= 1 - v; blur += v * 6;
    }
    el.style.transform = `translateY(${y.toFixed(2)}%)`;
    el.style.opacity = o.toFixed(3);
    el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none';
  }
  const palabras = (sel) => [...document.querySelectorAll(sel + ' .linea > span')];

  // ───────────── lienzos ─────────────
  function lienzo(id) {
    const c = $(id);
    c.width = W * DPR; c.height = H * DPR;
    const x = c.getContext('2d');
    return { c, x };
  }
  const goteo = lienzo('#goteo'), fx = lienzo('#fx'), bokeh = lienzo('#bokeh'), atras = lienzo('#virutas'),
    vVitrina = lienzo('#virutasVitrina'), vBebidas = lienzo('#virutasBebidas');
  const LUCES = [];
  {
    const rnd = azar(314);
    for (let i = 0; i < 22; i++) {
      LUCES.push({ x: rnd() * W, y: 120 + rnd() * 820, r: 26 + rnd() * 90, a: 0.05 + rnd() * 0.12,
        c: rnd() < 0.55 ? '255,196,150' : '255,160,190', fase: rnd() * 6.283, amp: 12 + rnd() * 30, prof: 0.3 + rnd() * 0.7 });
    }
  }
  function dibujaBokeh(t, giro) {
    const { c, x } = bokeh;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, c.width, c.height);
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
    x.globalCompositeOperation = 'lighter';
    for (const l of LUCES) {
      // se corren un poco con el giro del carrusel: están lejos, se mueven menos
      const X = ((l.x + giro * 2.2 * l.prof) % (W + 240) + W + 240) % (W + 240) - 120;
      const Y = l.y + l.amp * Math.sin((2 * Math.PI * t) / C.dur + l.fase);
      const g = x.createRadialGradient(X, Y, 0, X, Y, l.r);
      g.addColorStop(0, `rgba(${l.c},${l.a})`); g.addColorStop(0.72, `rgba(${l.c},${l.a * 0.8})`); g.addColorStop(1, `rgba(${l.c},0)`);
      x.fillStyle = g;
      x.beginPath(); x.arc(X, Y, l.r, 0, Math.PI * 2); x.fill();
    }
    x.globalCompositeOperation = 'source-over';
  }

  // Grano: seis cuadros de ruido fijos, elegidos por el tiempo.
  const grano = $('#grano').getContext('2d');
  const ruidos = [];
  {
    const rnd = azar(7);
    for (let k = 0; k < 6; k++) {
      const im = grano.createImageData(960, 540);
      for (let i = 0; i < im.data.length; i += 4) {
        const v = 128 + (rnd() + rnd() + rnd() - 1.5) * 120;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
      }
      ruidos.push(im);
    }
  }

  // Virutas: granos de color que flotan, periódicos en 15 s para que el bucle no salte.
  const VIRUTAS = [];
  {
    const rnd = azar(21);
    for (let i = 0; i < 34; i++) {
      VIRUTAS.push({ x: rnd() * W, y: rnd() * (H + 120), vueltas: 1 + Math.floor(rnd() * 2), amp: 10 + rnd() * 26,
        fase: rnd() * 6.283, giro: rnd() * 6.283, giros: (rnd() < 0.5 ? -1 : 1) * (1 + Math.floor(rnd() * 3)),
        largo: 10 + rnd() * 8, tono: Math.floor(rnd() * 3), prof: 0.55 + rnd() * 0.6 });
    }
  }
  const PALETAS = {
    marfil: ['rgba(176,125,54,0.42)', 'rgba(71,102,68,0.34)', 'rgba(210,140,160,0.42)'],
    verde: ['rgba(214,172,104,0.55)', 'rgba(255,236,200,0.35)', 'rgba(184,204,180,0.35)'],
    frambuesa: ['rgba(255,196,214,0.5)', 'rgba(255,236,210,0.38)', 'rgba(214,160,90,0.45)'],
  };

  // ───────────── el jarabe de frambuesa ─────────────
  // Cae desde arriba y chorrea: dedos de jarabe con la punta apenas abultada,
  // un filo de brillo en cada uno y alguna gota que se suelta y se adelanta.
  const GOTAS = [];
  {
    const rnd = azar(99);
    let x = -60;
    while (x < W + 80) {
      const w = 40 + rnd() * 80;
      // las finas bajan más que las gruesas
      const largo = (90 + rnd() * 380) * (1.25 - (w - 40) / 160);
      GOTAS.push({ x: x + w / 2, w, largo, vel: 0.8 + rnd() * 0.5, suelta: rnd() < 0.28 });
      x += w + 18 + rnd() * 110;
    }
  }
  function dibujaGoteo(t) {
    const { c, x } = goteo;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, c.width, c.height);
    const [g0, g1] = C.goteo;
    if (t < g0 || t > g1 + 0.1) return;
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
    const u = prog(t, g0, g1);
    const base = lerp(-150, H + 40, E.inOutCubic(u));
    const grad = x.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#5a1830'); grad.addColorStop(0.6, '#74213d'); grad.addColorStop(1, '#852946');
    x.fillStyle = grad;
    if (u >= 1) { x.fillRect(0, 0, W, H); return; }
    // el frente del jarabe ondula, lento
    const borde = (X) => base + 12 * Math.sin(X * 0.0085 + t * 2.2) + 5 * Math.sin(X * 0.023 - t * 1.7);
    const p = new Path2D();
    p.moveTo(-60, -60);
    p.lineTo(-60, borde(-60));
    const dedos = [];
    let xPrev = -60;
    const K = 0.5523;
    for (const g of GOTAS) {
      const L = g.largo * E.outSine(clamp(u * 1.7 * g.vel)) * (1 - 0.4 * E.inQuad(u));
      const w0 = g.w, Lmin = w0 * 1.5, kk = Math.max(0.1, clamp(L / Lmin));
      const w = w0 * kk;                          // ancho donde nace
      const cuello = w * 0.56, bola = w * 0.4;    // se afina y termina en una gota más ancha que el cuello
      const alto = w * 0.55;                      // alto del ensanche en la base
      const yb = borde(g.x);
      const tip = yb + Math.max(L, Lmin * kk);
      const xl = g.x - w / 2, xr = g.x + w / 2;
      for (let X = xPrev + 22; X < xl - w * 0.35; X += 22) p.lineTo(X, borde(X));
      p.lineTo(xl - w * 0.35, borde(xl - w * 0.35));
      // ensanche izquierdo → cuello
      p.bezierCurveTo(xl + w * 0.12, yb, g.x - cuello / 2, yb + alto * 0.35, g.x - cuello / 2, yb + alto);
      // cuello → gota
      const yg = tip - bola;                      // centro de la gota
      p.bezierCurveTo(g.x - cuello / 2, yg - bola * 1.2, g.x - bola, yg - bola * 0.9, g.x - bola, yg);
      p.bezierCurveTo(g.x - bola, yg + bola * K, g.x - bola * K, tip, g.x, tip);
      p.bezierCurveTo(g.x + bola * K, tip, g.x + bola, yg + bola * K, g.x + bola, yg);
      p.bezierCurveTo(g.x + bola, yg - bola * 0.9, g.x + cuello / 2, yg - bola * 1.2, g.x + cuello / 2, yb + alto);
      // cuello → ensanche derecho
      p.bezierCurveTo(g.x + cuello / 2, yb + alto * 0.35, xr - w * 0.12, yb, xr + w * 0.35, borde(xr + w * 0.35));
      xPrev = xr + w * 0.35;
      dedos.push({ g, yb, tip, bola, yg, cuello, largo: tip - yb });
    }
    for (let X = xPrev + 22; X < W + 60; X += 22) p.lineTo(X, borde(X));
    p.lineTo(W + 60, borde(W + 60));
    p.lineTo(W + 60, -60);
    p.closePath();
    x.save();
    x.shadowColor = 'rgba(25,0,8,0.4)';
    x.shadowBlur = 22 * DPR;
    x.shadowOffsetY = 8 * DPR;
    x.fill(p);
    x.restore();
    // brillo: una veta clara por dedo y un punto de luz en cada gota
    x.save();
    x.clip(p);
    x.lineCap = 'round';
    for (const d of dedos) {
      if (d.largo < d.bola * 3) continue;
      const xv = d.g.x - d.cuello * 0.22;
      const gv = x.createLinearGradient(0, d.yb, 0, d.yg);
      gv.addColorStop(0, 'rgba(255,205,222,0)'); gv.addColorStop(0.5, 'rgba(255,205,222,0.2)'); gv.addColorStop(1, 'rgba(255,205,222,0.28)');
      x.strokeStyle = gv;
      x.lineWidth = Math.max(2, d.cuello * 0.18);
      x.beginPath(); x.moveTo(xv, d.yb + d.bola); x.lineTo(xv, d.yg - d.bola * 0.4); x.stroke();
      x.fillStyle = 'rgba(255,222,232,0.45)';
      x.beginPath(); x.ellipse(d.g.x - d.bola * 0.38, d.yg - d.bola * 0.3, d.bola * 0.16, d.bola * 0.26, -0.5, 0, Math.PI * 2); x.fill();
    }
    x.strokeStyle = 'rgba(255,190,210,0.3)';
    x.lineWidth = 2.5;
    x.stroke(p);
    x.restore();
    // gotas que se sueltan y caen más rápido que el resto
    x.fillStyle = '#7a2340';
    for (const d of dedos) {
      if (!d.g.suelta || u < 0.3) continue;
      const v = (u - 0.3) / 0.7;
      const y = d.tip + 26 + v * v * 1100;
      const rg = Math.max(4, d.bola * 0.7);
      x.beginPath();
      x.moveTo(d.g.x, y - rg * 2.1);
      x.bezierCurveTo(d.g.x + rg * 0.3, y - rg * 1.2, d.g.x + rg, y - rg * 0.45, d.g.x + rg, y);
      x.arc(d.g.x, y, rg, 0, Math.PI);
      x.bezierCurveTo(d.g.x - rg, y - rg * 0.45, d.g.x - rg * 0.3, y - rg * 1.2, d.g.x, y - rg * 2.1);
      x.fill();
    }
  }

  // ───────────── ola: el nivel del líquido dentro de las letras ─────────────
  function dOla(x0, x1, nivel, amp, t, fase = 0, hacia = 1) {
    // hacia = 1: región bajo la ola (se llena); -1: región sobre la ola (se vacía)
    const pasos = Math.max(8, Math.ceil((x1 - x0) / 14));
    let d = '';
    for (let i = 0; i <= pasos; i++) {
      const x = lerp(x0, x1, i / pasos);
      const y = nivel + amp * (Math.sin(x * 0.017 + t * 7.5 + fase) * 0.7 + Math.sin(x * 0.043 - t * 5.1 + fase * 1.7) * 0.3);
      d += (i ? 'L' : 'M') + f2(x) + ' ' + f2(y);
    }
    const lejos = hacia > 0 ? 4000 : -4000;
    return d + `L${f2(x1)} ${lejos}L${f2(x0)} ${lejos}Z`;
  }
  const olaEn = (x, nivel, amp, t, fase = 0) =>
    nivel + amp * (Math.sin(x * 0.017 + t * 7.5 + fase) * 0.7 + Math.sin(x * 0.043 - t * 5.1 + fase * 1.7) * 0.3);

  // ───────────── seek ─────────────
  const logoPath = $('#logoPath'), logoClipPath = $('#logoClipPath'), brilloBanda = $('#brilloBanda');
  const heroeMarco = $('#heroeMarco'), heroeSombra = $('#heroeSombra'), heroeLuz = $('#heroeLuz'), heroeVelo = $('#heroeVelo');
  const vitrina = $('#vitrina'), bebidasEl = $('#bebidas'), bebidasNivel = $('#bebidasNivel');
  const frente = $('#frente'), frenteNombre = frente.querySelector('.nombre'), frenteRotulo = frente.querySelector('.rotulo');
  const filete = $('#filete'), rombo = $('#rombo'), viñeta = $('#viñeta'), fondo = $('#fondo');
  const pHeroe = palabras('#heroeTexto'), pVitrina = palabras('#vitrinaTexto'), pBebidas = palabras('#bebidasTexto'),
    pLema = palabras('#lema');

  function dArco(x0, y0, x1, y1, rt, rbb) {
    // rectángulo con las esquinas de arriba de radio rt y las de abajo de radio rbb
    rt = Math.min(rt, (x1 - x0) / 2, (y1 - y0) / 2); rbb = Math.min(rbb, (x1 - x0) / 2);
    const k = 0.5523;
    return `M${f2(x0)} ${f2(y0 + rt)}C${f2(x0)} ${f2(y0 + rt - rt * k)} ${f2(x0 + rt - rt * k)} ${f2(y0)} ${f2(x0 + rt)} ${f2(y0)}` +
      `L${f2(x1 - rt)} ${f2(y0)}C${f2(x1 - rt + rt * k)} ${f2(y0)} ${f2(x1)} ${f2(y0 + rt - rt * k)} ${f2(x1)} ${f2(y0 + rt)}` +
      `L${f2(x1)} ${f2(y1 - rbb)}C${f2(x1)} ${f2(y1 - rbb + rbb * k)} ${f2(x1 - rbb + rbb * k)} ${f2(y1)} ${f2(x1 - rbb)} ${f2(y1)}` +
      `L${f2(x0 + rbb)} ${f2(y1)}C${f2(x0 + rbb - rbb * k)} ${f2(y1)} ${f2(x0)} ${f2(y1 - rbb + rbb * k)} ${f2(x0)} ${f2(y1 - rbb)}Z`;
  }
  const clip = (el, d, evenodd = false) => {
    el.style.clipPath = d ? `path(${evenodd ? 'evenodd, ' : ''}'${d}')` : 'none';
  };
  const ver = (el, o) => {
    el.style.opacity = o <= 0.001 ? '0' : o >= 0.999 ? '1' : o.toFixed(3);
    el.style.visibility = o <= 0.001 ? 'hidden' : 'visible';
  };

  // Scroll de la vitrina: un paso por pulso, con un pelo de rebote, y deriva lenta.
  function scrollVitrina(t) {
    let s = (t - C.encoge[1]) * 14;
    for (const p of C.vitrinaPasos) s += PASO * E.outBack(prog(t, p, p + 0.42), 1.15);
    return s;
  }
  function posPieza(i, t) {
    return FX0 + i * PASO - scrollVitrina(t);
  }
  // Giro del carrusel: entra girando, luego un paso por pulso.
  function giroCarrusel(t) {
    const [c0, c1] = C.carrusel;
    let g = -200 * (1 - E.outCubic(prog(t, c0, c1)));
    for (const p of C.carruselPasos) g -= PASOANG * E.outBack(prog(t, p, p + 0.4), 1.25);
    g -= Math.max(0, t - C.carruselPasos[C.carruselPasos.length - 1] - 0.4) * 9;
    return g;
  }

  function seek(t) {
    t = ((t % C.dur) + C.dur) % C.dur;
    const lg = estadoLogo(t);
    const cam = camara(t);
    const base = matLogo(lg.cy, lg.k);
    const A = {};
    for (const L of 'EOS') A[L] = mul(cam.M, mul(base, lg.jalea[L]));

    // ── muro, hojas y logo verde ──
    const zFondo = 1 + (cam.z - 1) * 0.05;
    const mFondo = cam.z !== 1 ? `scale(${zFondo.toFixed(4)})` : 'none';
    fondo.style.transform = mFondo; hojas.style.transform = mFondo;
    const vaivenHojas = Math.sin((2 * Math.PI * t) / 7.5);
    hojaEls.forEach(({ h, sombra, hoja }) => {
      const r = h.r + vaivenHojas * h.vaiven;
      const tr = (dx, dy) => `translate(${h.tallo[0] + dx}px,${h.tallo[1] + dy}px) rotate(${r.toFixed(3)}deg) scale(${h.s}) translate(${-TALLO[0]}px,${-TALLO[1]}px)`;
      hoja.style.transform = tr(0, 0);
      sombra.style.transform = tr(h.sombra[0] + vaivenHojas * 6, h.sombra[1]);
    });
    const muro = t < C.zoom[1] || t >= C.salida[0];
    ver(hojas, muro ? 1 : 0); ver(fondo, muro ? 1 : 0);

    const dLogo = dLetra('E', A.E) + dLetra('O', A.O) + dLetra('S', A.S);
    const logoVisible = t < C.llenado.S[1] + 0.02 || t >= C.drenaje.E[0] - 0.02;
    logoPath.setAttribute('d', logoVisible ? dLogo : '');
    logoClipPath.setAttribute('d', logoVisible ? dLogo : '');

    // brillo final
    {
      const [b0, b1] = C.brillo;
      const u = prog(t, b0, b1);
      const bx = caja('E', A.E).x0, bx1 = caja('S', A.S).x1;
      const x = lerp(bx - 320, bx1 + 60, E.inOutSine(u));
      brilloBanda.setAttribute('transform', `translate(${f2(x)} -160) skewX(-18)`);
      brilloBanda.style.opacity = u > 0 && u < 1 ? '1' : '0';
    }

    // ── ventanas de las letras ──
    const [z0, z1] = C.zoom;
    const enVentanas = t >= C.llenado.E[0] - 0.01 && t < z1 + 0.02;
    ver(vE, enVentanas && t < z1 ? 1 : 0);
    ver(vS, enVentanas && t < z1 ? 1 : 0);

    // encuadres base con el logo en K1 (sin gelatina): la foto llena la letra
    const baseK1 = matLogo(Y1, K1);
    const Mf = cam.Mf || [1, 0, 0, 1, 0, 0];
    const escalaLogo = lg.k / K1, dy = lg.cy - Y1;
    const encuadreLetra = (L, it, img, foco, extra) => {
      const bx = caja(L, baseK1);
      const s = ((bx.y1 - bx.y0) / FOTO) * extra;
      const c0 = [(bx.x0 + bx.x1) / 2, (bx.y0 + bx.y1) / 2];
      // sigue al logo mientras crece y al plano lejano durante el zoom
      const cL = [W / 2 + (c0[0] - W / 2) * escalaLogo, lg.cy + (c0[1] - Y1) * escalaLogo];
      const p = ap(Mf, cL[0], cL[1]);
      colocar(img, s * escalaLogo * Mf[0], foco[0], foco[1], p[0], p[1]);
    };
    if (enVentanas) {
      encuadreLetra('E', fE, imgE, [0.52, 0.365], 2.25);
      encuadreLetra('S', fS, imgS, [0.43, 0.355], 2.25);
      clip(vE, dLetra('E', A.E));
      clip(vS, dLetra('S', A.S));
    }
    // nivel del gelato que sube dentro de cada letra
    const llenar = (L, el, fase) => {
      const [l0, l1] = C.llenado[L];
      const nivel = el.querySelector('.nivel');
      if (t >= l1 || t < l0) { clip(nivel, t >= l1 ? null : 'M0 0Z'); return null; }
      const bx = caja(L, A[L]);
      const u = E.inOutSine(prog(t, l0, l1));
      const y = lerp(bx.y1 + 24, bx.y0 - 30, u);
      const amp = 14 * Math.sin(Math.PI * u) + 2;
      clip(nivel, dOla(bx.x0 - 30, bx.x1 + 30, y, amp, t, fase, 1));
      return { bx, y, amp, fase };
    };
    const olas = {};
    olas.E = llenar('E', vE, 0);
    olas.O = llenar('O', vO, 2.1);
    olas.S = llenar('S', vS, 4.2);

    // ── la O: de ventana a pantalla completa, a amanecer, a arco de la vitrina ──
    const [e0, e1] = C.encoge;
    const enHeroe = t >= C.llenado.O[0] - 0.01 && t < e1 + 0.001;
    ver(vO, enHeroe ? 1 : 0);
    // Encuadre por cobertura: la foto cubre siempre el rectángulo que la recorta,
    // con el foco al centro hasta donde lo permiten sus bordes.
    const cubrir = (r, fx, fy, zf) => {
      const w = r.x1 - r.x0, h = r.y1 - r.y0, s = (Math.max(w, h) / FOTO) * zf, n = s * FOTO;
      const tx = clamp((r.x0 + r.x1) / 2 - s * fx * FOTO, r.x1 - n, r.x0);
      const ty = clamp((r.y0 + r.y1) / 2 - s * fy * FOTO, r.y1 - n, r.y0);
      return { s, tx, ty };
    };
    const PANT = { x0: 0, y0: 0, x1: W, y1: H };
    const heroeEnVitrina = { x0: posPieza(0, e1) + BORDE, y0: FY0 + BORDE, x1: posPieza(0, e1) + AW - BORDE, y1: FY0 + AH - BORDE };
    const ea = encuadreArco(O);
    const FOCO1 = [0.5, 0.3375], FOCO2 = [0.52, 0.37], ZF1 = 1.08, ZF2 = 1.16;
    let F;
    if (t < z1) {
      // F0 es la pantalla completa vista antes del zoom: el plano lejano la agranda justo hasta ahí
      const F1 = cubrir(PANT, FOCO1[0], FOCO1[1], ZF1);
      const Mend = mul(T(W / 2, H / 2), mul(S(zLejos(ZIN)), T(-centroO[0], -centroO[1])));
      const inv = (x, y) => [(x - Mend[4]) / Mend[0], (y - Mend[5]) / Mend[3]];
      const o0 = inv(F1.tx, F1.ty), sF0 = F1.s / Mend[0];
      const m = cam.Mf || [1, 0, 0, 1, 0, 0];
      // mientras crece el logo, la foto acompaña a la O
      const cO = [W / 2 + (o0[0] - W / 2) * escalaLogo, lg.cy + (o0[1] - Y1) * escalaLogo];
      const p = ap(m, cO[0], cO[1]);
      F = { s: sF0 * escalaLogo * m[0], tx: p[0], ty: p[1] };
    } else if (t < e0) {
      // el amanecer: la cámara se acerca despacio al gelato, el cielo sigue arriba
      const u = E.inOutSine(prog(t, z1, e0));
      F = cubrir(PANT, lerp(FOCO1[0], FOCO2[0], u), lerp(FOCO1[1], FOCO2[1], u), lerp(ZF1, ZF2, u));
    } else {
      const u = E.inOutCubic(prog(t, e0, e1));
      const r = {
        x0: lerp(0, heroeEnVitrina.x0, u), y0: lerp(0, heroeEnVitrina.y0, u),
        x1: lerp(W, heroeEnVitrina.x1, u), y1: lerp(H, heroeEnVitrina.y1, u),
      };
      F = { ...cubrir(r, lerp(FOCO2[0], ea.fx, u), lerp(FOCO2[1], ea.fy, u), lerp(ZF2, O.zoom || 1, u)), r, u };
    }
    if (enHeroe) {
      const sc = F.s * (FOTO / tam(imgO));
      imgO.style.width = tam(imgO) + 'px';
      imgO.style.transform = `translate(${f2(F.tx)}px,${f2(F.ty)}px) scale(${sc.toFixed(5)})`;
      if (t < z1) {
        const hueco = 1 - E.inOutCubic(prog(t, C.cierraO[0], C.cierraO[1]));
        // cuando la O ya cubre la pantalla, sin recorte
        clip(vO, cam.z > 6.2 ? null : dLetra('O', A.O, hueco), true);
      } else if (t < e0) {
        clip(vO, null);
      } else {
        const u = F.u, r = F.r;
        const rt = lerp(0, RT - BORDE, E.outCubic(u)), rbb = lerp(0, rb - BORDE / 2, u);
        clip(vO, dArco(r.x0, r.y0, r.x1, r.y1, rt, rbb));
      }
    }
    // marco de crema y sombra del arco mientras se encoge
    {
      const u = t >= e0 && t < e1 ? prog(t, e0, e1) : 0;
      const m = E.inOutSine(prog(u, 0.45, 1));
      if (u > 0 && F && F.r) {
        const r = F.r, b = BORDE * m;
        const rt = lerp(0, RT - BORDE, E.outCubic(u));
        clip(heroeMarco, dArco(r.x0 - b, r.y0 - b, r.x1 + b, r.y1 + b, rt + b, lerp(0, rb, u)));
        // la misma sombra que dejan los arcos de la vitrina (box-shadow 0 34px 60px -28px)
        clip(heroeSombra.firstElementChild, dArco(r.x0 + 21, r.y0 + 55, r.x1 - 21, r.y1 + 13, Math.max(0, rt - 21), 4));
        ver(heroeMarco, m); ver(heroeSombra, m * 0.9);
      } else { ver(heroeMarco, 0); ver(heroeSombra, 0); }
    }
    // luz del sol y velo para el texto
    {
      const x = F.tx + F.s * 0.89 * FOTO, y = F.ty + F.s * 0.03 * FOTO;
      heroeLuz.style.transform = `translate(${f2(x)}px,${f2(y)}px) scale(${(1 + 0.06 * Math.sin(t * 3)).toFixed(3)})`;
      heroeLuz.style.opacity = (prog(t, C.cierraO[0], z1) * (1 - prog(t, 3.3, 4.2))).toFixed(3);
      heroeVelo.style.opacity = (prog(t, 2.7, 3.1) * (1 - prog(t, 4.05, 4.45))).toFixed(3);
    }
    pHeroe.forEach((el, i) => sube(el, t, C.heroeTexto[0] + i * 0.13, 0.7, [C.heroeTexto[1] + i * 0.05, C.heroeTexto[1] + 0.3 + i * 0.05]));
    ver($('#heroeTexto'), t > C.heroeTexto[0] - 0.05 && t < C.heroeTexto[1] + 0.45 ? 1 : 0);

    // ── vitrina ──
    const enVitrina = t >= e0 - 0.01 && t < C.goteo[1] + 0.02;
    ver(vitrina, enVitrina ? 1 : 0);
    if (enVitrina) {
      piezas.forEach((pz, i) => {
        const x = posPieza(i, t);
        let dyE = 0, o = 1;
        if (i === 0) o = t >= e1 ? 1 : 0;                         // es la O que acaba de aterrizar
        else if (i <= 3) {
          const t0 = C.vitrinaEntra[i - 1];
          const u = prog(t, t0, t0 + 0.6);
          dyE = 300 * (1 - E.outBack(u, 1.3)); o = clamp((t - t0) / 0.2);
        }
        pz.p.style.transform = `translate(${f2(x)}px,${f2(FY0 + dyE)}px)`;
        pz.p.style.opacity = o.toFixed(3);
        pz.p.style.visibility = o > 0 && x > 400 && x < W + 20 ? 'visible' : 'hidden';
        encuadrarCaja(pz.img, AW - 2 * BORDE, AH - 2 * BORDE, pz.it.foco[0], pz.it.foco[1], pz.it.zoom || 1);
        const te = i === 0 ? e1 - 0.05 : i <= 3 ? C.vitrinaEntra[i - 1] + 0.18 : 0;
        const ue = E.outCubic(prog(t, te, te + 0.5));
        pz.et.style.opacity = ue.toFixed(3);
        pz.et.style.transform = `translateY(${f2((1 - ue) * 18)}px)`;
      });
      pVitrina.forEach((el, i) => sube(el, t, C.vitrinaTitulo + i * 0.12, 0.7));
    }

    // ── jarabe ──
    dibujaGoteo(t);

    // ── bebidas ──
    const [s0, s1b] = C.salida;
    const enBebidas = t >= C.goteo[1] - 0.12 && t < C.drenaje.S[1] + 0.02;
    ver(bebidasEl, enBebidas ? (t < C.goteo[1] ? prog(t, C.goteo[1] - 0.12, C.goteo[1]) : 1) : 0);
    if (enBebidas) {
      const [c0, c1] = C.carrusel;
      const g = giroCarrusel(t);
      dibujaBokeh(t, g);
      const escala = lerp(0.72, 1, E.outCubic(prog(t, c0, c1)));
      anillo.style.transform = `scale(${escala.toFixed(4)}) translateZ(${-R}px) rotateY(${g.toFixed(3)}deg)`;
      for (const b of bebidas) encuadrarCaja(b.img, BW - 2 * BORDE, BH - 2 * BORDE, b.it.foco[0], b.it.foco[1], b.it.zoom || 1);
      // la de adelante lleva su nombre
      const idx = ((Math.round(-g / PASOANG) % NB) + NB) % NB;
      const it = D.bebidas[idx];
      if (frenteNombre.textContent !== it.nombre) frenteNombre.textContent = it.nombre;
      if (frenteRotulo.textContent !== it.rotulo) frenteRotulo.textContent = it.rotulo;
      const resto = Math.abs(-g / PASOANG - Math.round(-g / PASOANG));   // 0 de frente, 0.5 a medio camino
      const oF = clamp(1 - resto * 4) * prog(t, c1 - 0.1, c1 + 0.25) * (1 - prog(t, 11.05, 11.3));
      frente.style.opacity = oF.toFixed(3);
      frente.style.transform = `translateY(${f2((1 - oF) * 10)}px)`;
      pBebidas.forEach((el, i) => sube(el, t, C.bebidasTitulo + i * 0.14, 0.7, [11.02 + i * 0.05, 11.3 + i * 0.05]));
      // la salida: las letras recortan la escena
      if (t >= s0 && t < s1b + 0.9) {
        const dLetras = dLetra('E', A.E) + dLetra('O', A.O) + dLetra('S', A.S);
        clip(bebidasEl, t < s0 + 0.03 && cam.z > ZOUT * 0.9 ? null : dLetras, true);
      } else clip(bebidasEl, null);
      // se vacían de arriba abajo, una letra tras otra
      if (t >= C.drenaje.E[0]) {
        let d = '';
        [...'EOS'].forEach((L, i) => {
          const [d0, d1] = C.drenaje[L];
          const bx = caja(L, A[L]);
          const u = E.inOutSine(prog(t, d0, d1));
          const y = lerp(bx.y0 - 30, bx.y1 + 30, u);
          const amp = 12 * Math.sin(Math.PI * u) + 1.5;
          d += dOla(bx.x0 - 12, bx.x1 + 12, y, amp, t, i * 2.1, 1);
          olas['d' + L] = { bx, y, amp, fase: i * 2.1, u };
        });
        clip(bebidasNivel, d);
      } else clip(bebidasNivel, null);
    }

    // ── firma ──
    {
      const [f0] = C.firma;
      const sale = [C.rotuloSale[0], C.rotuloSale[1]];
      const entra = E.outQuart(prog(t, f0, f0 + 0.55));
      const va = E.inCubic(prog(t, sale[0], sale[1] - 0.05));
      const w = t < 5 ? 1 - va : entra;
      filete.style.transform = `scaleX(${w.toFixed(4)})`;
      filete.style.opacity = w.toFixed(3);
      const r = t < 5 ? 1 - E.inCubic(prog(t, sale[0], sale[0] + 0.2)) : E.outBack(prog(t, f0 + 0.2, f0 + 0.5), 2.2);
      rombo.style.transform = `rotate(45deg) scale(${Math.max(0, r).toFixed(3)})`;
      pLema.forEach((el, i) => {
        if (t < 5) {
          const v = E.inCubic(prog(t, sale[0] + i * 0.04, sale[1] + i * 0.04));
          el.style.transform = `translateY(${f2(v * 110)}%)`; el.style.opacity = (1 - v).toFixed(3);
          el.style.filter = v > 0.02 ? `blur(${(v * 5).toFixed(2)}px)` : 'none';
        } else sube(el, t, f0 + 0.12 + i * 0.13, 0.75);
      });
      ver($('#firma'), t < sale[1] + 0.1 || t > f0 - 0.05 ? 1 : 0);
    }

    // ── viñeta ──
    {
      const oscuro = prog(t, C.zoom[0] + 0.2, C.zoom[1]) * (1 - prog(t, C.salida[0], C.salida[0] + 0.5));
      viñeta.style.opacity = (0.16 + 0.54 * oscuro).toFixed(3);
    }

    dibujaFx(t, olas, lg, A);

    const k = Math.floor(t * 30) % ruidos.length;
    grano.putImageData(ruidos[k], 0, 0);
  }

  // ───────────── virutas, meniscos y destellos ─────────────
  function pesosTema(t) {
    const marfil = t < C.zoom[0] + 0.5 ? 1 - prog(t, C.zoom[0], C.zoom[0] + 0.5) : prog(t, C.salida[0], C.salida[1]);
    const verde = prog(t, C.encoge[0], C.encoge[1]) * (1 - prog(t, C.goteo[0] + 0.2, C.goteo[1]));
    const framb = prog(t, C.goteo[0] + 0.3, C.goteo[1] + 0.1) * (1 - prog(t, C.salida[0], C.salida[0] + 0.4));
    const heroe = prog(t, C.zoom[1] - 0.2, C.zoom[1]) * (1 - prog(t, C.encoge[0], C.encoge[1])) * 0.35;
    return { marfil, verde, frambuesa: framb, heroe };
  }
  function dibujaFx(t, olas, lg, A) {
    const { c, x } = fx;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, c.width, c.height);
    x.setTransform(DPR, 0, 0, DPR, 0, 0);

    // brillo del menisco: el borde del gelato que sube (o baja) en cada letra
    for (const k of Object.keys(olas)) {
      const o = olas[k];
      if (!o) continue;
      const L = k.length > 1 ? k[1] : k;
      x.save();
      x.clip(new Path2D(dLetra(L, A[L])));
      x.beginPath();
      for (let X = o.bx.x0 - 10; X <= o.bx.x1 + 10; X += 8) {
        const Y = olaEn(X, o.y, o.amp, t, o.fase);
        X === o.bx.x0 - 10 ? x.moveTo(X, Y) : x.lineTo(X, Y);
      }
      x.strokeStyle = 'rgba(255,250,235,0.75)';
      x.lineWidth = 3;
      x.shadowColor = 'rgba(255,240,210,0.9)';
      x.shadowBlur = 10 * DPR;
      x.stroke();
      x.restore();
    }

    // virutas: las del muro van detrás del logo; las de las escenas oscuras, delante
    const pes = pesosTema(t);
    atras.x.setTransform(1, 0, 0, 1, 0, 0);
    atras.x.clearRect(0, 0, atras.c.width, atras.c.height);
    atras.x.setTransform(DPR, 0, 0, DPR, 0, 0);
    virutas(atras.x, t, [['marfil', pes.marfil]]);
    for (const [lz, tema, peso] of [[vVitrina, 'verde', pes.verde], [vBebidas, 'frambuesa', pes.frambuesa]]) {
      lz.x.setTransform(1, 0, 0, 1, 0, 0);
      lz.x.clearRect(0, 0, lz.c.width, lz.c.height);
      lz.x.setTransform(DPR, 0, 0, DPR, 0, 0);
      virutas(lz.x, t, [[tema, Math.min(1, peso * 1.6)]]);
    }
  }
  function virutas(x, t, temas) {
    for (const [tema, peso] of temas) {
      if (peso < 0.01) continue;
      const pal = PALETAS[tema];
      x.globalAlpha = peso;
      for (const v of VIRUTAS) {
        const ciclo = (H + 120);
        const y = ((v.y - (t / C.dur) * ciclo * v.vueltas) % ciclo + ciclo) % ciclo - 60;
        const X = v.x + v.amp * Math.sin((2 * Math.PI * t) / C.dur * 2 + v.fase);
        const ang = v.giro + (2 * Math.PI * t * v.giros) / C.dur;
        x.save();
        x.translate(X, y);
        x.rotate(ang);
        x.scale(v.prof, v.prof);
        x.fillStyle = pal[v.tono];
        const L = v.largo, A2 = 4.2;
        x.beginPath();
        x.moveTo(-A2 / 2, -L / 2 + A2 / 2);
        x.arc(0, -L / 2 + A2 / 2, A2 / 2, Math.PI, 0);
        x.lineTo(A2 / 2, L / 2 - A2 / 2);
        x.arc(0, L / 2 - A2 / 2, A2 / 2, 0, Math.PI);
        x.closePath();
        x.fill();
        x.restore();
      }
    }
    x.globalAlpha = 1;
  }

  // ───────────── listo ─────────────
  const imagenes = [...document.images];
  window.listo = (async () => {
    await Promise.all([
      document.fonts.load('500 60px Cormorant'), document.fonts.load('italic 500 60px Cormorant'),
      document.fonts.load('700 20px Manrope'),
    ]);
    await document.fonts.ready;
    await Promise.all([...document.images].map((im) => (im.decode ? im.decode().catch(() => {}) : null)));
    seek(0);
    return true;
  })();
  window.seek = seek;

  const q = new URLSearchParams(location.search);
  if (q.has('t')) window.listo.then(() => seek(parseFloat(q.get('t'))));
  if (q.has('play')) {
    window.listo.then(() => {
      const audio = new Audio('audio/pista.wav');
      let t0 = performance.now();
      document.body.addEventListener('click', () => { t0 = performance.now(); audio.currentTime = 0; audio.play(); });
      const tick = () => { seek(((performance.now() - t0) / 1000) % C.dur); requestAnimationFrame(tick); };
      tick();
    });
  }
})();
