// Pantalla del local · plantilla de 15 s en bucle.
//
// `seek(t)` dibuja cualquier instante como función PURA del tiempo: nada depende del
// cuadro anterior, así cada cuadro se genera suelto, en paralelo y con submuestras
// (desenfoque de movimiento). Regla de oro: todo lo que seek toca, lo vuelve a fijar en
// CADA llamada (el DOM persiste entre seeks del mismo trabajador).
//
// Estructura:  MOTOR (librería reutilizable) · ESCENAS (se reescriben en cada video) · ARRANQUE
(() => {
  const C = window.CUES, D = window.DATOS;
  const DPR = window.devicePixelRatio || 1;
  const W = 1920, H = 1080;
  const $ = (s) => document.querySelector(s);

  // ═════════════════════════════ MOTOR ═════════════════════════════
  // ── matemática ──
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const prog = (t, a, b) => clamp((t - a) / (b - a));          // 0→1 entre a y b
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
  // Oscilación amortiguada (gelatina, rebotes): 0 al disparar, se apaga sola. s = segundos desde el golpe.
  const vaiven = (s, f, z) => (s <= 0 ? 0 : Math.exp(-z * s) * Math.sin(2 * Math.PI * f * s));
  // Periódico en la duración del bucle: fase que da `vueltas` vueltas exactas en C.dur.
  const ciclo = (t, vueltas = 1) => (2 * Math.PI * t * vueltas) / C.dur;

  // ── afines 2D [a b c d e f]: x' = a·x + c·y + e ; y' = b·x + d·y + f ──
  const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3],
    A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  const T = (x, y) => [1, 0, 0, 1, x, y];
  const S = (sx, sy = sx) => [sx, 0, 0, sy, 0, 0];
  const ap = (A, x, y) => [A[0] * x + A[2] * y + A[4], A[1] * x + A[3] * y + A[5]];
  const sobre = (x, y, A) => mul(T(x, y), mul(A, T(-x, -y)));   // A aplicada alrededor de (x, y)

  // ── azar con semilla: el mismo cuadro sale igual en cualquier trabajador ──
  function azar(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── caminos para clip-path: path() (en px del escenario) ──
  const f2 = (v) => (Math.round(v * 100) / 100).toString();
  // Rectángulo con esquinas de arriba de radio rt y de abajo rb: con rt = ancho/2 es un arco.
  function dArco(x0, y0, x1, y1, rt, rb) {
    rt = Math.min(rt, (x1 - x0) / 2, (y1 - y0) / 2); rb = Math.min(rb, (x1 - x0) / 2);
    const k = 0.5523;
    return `M${f2(x0)} ${f2(y0 + rt)}C${f2(x0)} ${f2(y0 + rt - rt * k)} ${f2(x0 + rt - rt * k)} ${f2(y0)} ${f2(x0 + rt)} ${f2(y0)}` +
      `L${f2(x1 - rt)} ${f2(y0)}C${f2(x1 - rt + rt * k)} ${f2(y0)} ${f2(x1)} ${f2(y0 + rt - rt * k)} ${f2(x1)} ${f2(y0 + rt)}` +
      `L${f2(x1)} ${f2(y1 - rb)}C${f2(x1)} ${f2(y1 - rb + rb * k)} ${f2(x1 - rb + rb * k)} ${f2(y1)} ${f2(x1 - rb)} ${f2(y1)}` +
      `L${f2(x0 + rb)} ${f2(y1)}C${f2(x0 + rb - rb * k)} ${f2(y1)} ${f2(x0)} ${f2(y1 - rb + rb * k)} ${f2(x0)} ${f2(y1 - rb)}Z`;
  }
  // Región bajo (o sobre) una ola: el nivel de un líquido que sube o baja dentro de algo.
  const olaEn = (x, nivel, amp, t, fase = 0) =>
    nivel + amp * (Math.sin(x * 0.017 + t * 7.5 + fase) * 0.7 + Math.sin(x * 0.043 - t * 5.1 + fase * 1.7) * 0.3);
  function dOla(x0, x1, nivel, amp, t, fase = 0, bajo = true) {
    const pasos = Math.max(8, Math.ceil((x1 - x0) / 14));
    let d = '';
    for (let i = 0; i <= pasos; i++) {
      const x = lerp(x0, x1, i / pasos);
      d += (i ? 'L' : 'M') + f2(x) + ' ' + f2(olaEn(x, nivel, amp, t, fase));
    }
    const lejos = bajo ? 4000 : -4000;
    return d + `L${f2(x1)} ${lejos}L${f2(x0)} ${lejos}Z`;
  }

  // ── estilos: siempre se fijan todos, en cada seek ──
  const clip = (el, d, evenodd = false) => { el.style.clipPath = d ? `path(${evenodd ? 'evenodd, ' : ''}'${d}')` : 'none'; };
  const ver = (el, o) => {
    el.style.opacity = o <= 0.001 ? '0' : o >= 0.999 ? '1' : o.toFixed(3);
    el.style.visibility = o <= 0.001 ? 'hidden' : 'visible';
  };
  // Palabra que sube de su renglón (el renglón .linea tiene overflow: hidden). `salida` = [t0, t1].
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

  // ── fotos: encuadre por cobertura ──
  // La foto cubre la caja w×h entera, con su `foco` (0–1) al centro hasta donde dejan los bordes.
  // Nunca queda una franja sin foto (el error típico: calcular la escala por el alto y olvidar el ancho).
  function encuadrarCaja(img, w, h, fx, fy, zoom = 1) {
    const nw = img.naturalWidth || 1000, nh = img.naturalHeight || 1000;
    const s = Math.max(w / nw, h / nh) * zoom;
    const tx = clamp(w / 2 - s * fx * nw, w - s * nw, 0), ty = clamp(h / 2 - s * fy * nh, h - s * nh, 0);
    img.style.transform = `translate(${f2(tx)}px,${f2(ty)}px) scale(${s.toFixed(5)})`;
  }
  // Para 4K: si el item trae src2x (foto ampliada con Lanczos), se usa esa.
  const fuente = (it) => (DPR > 1 && it.src2x ? it.src2x : it.src);

  // ── lienzos a la densidad del escenario (en 4K, DPR = 2) ──
  function lienzo(id) {
    const c = $(id);
    c.width = W * DPR; c.height = H * DPR;
    return { c, x: c.getContext('2d') };
  }
  function limpiar(l) {
    l.x.setTransform(1, 0, 0, 1, 0, 0);
    l.x.clearRect(0, 0, l.c.width, l.c.height);
    l.x.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // Grano: seis cuadros de ruido fijos, elegidos por el tiempo (periódico en el bucle).
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

  // Virutas: granos de color que flotan. Todo lo que se mueve da vueltas enteras en C.dur,
  // así el último cuadro empalma con el primero.
  const VIRUTAS = [];
  {
    const rnd = azar(21);
    for (let i = 0; i < 34; i++) {
      VIRUTAS.push({ x: rnd() * W, y: rnd() * (H + 120), vueltas: 1 + Math.floor(rnd() * 2), amp: 10 + rnd() * 26,
        fase: rnd() * 6.283, giro: rnd() * 6.283, giros: (rnd() < 0.5 ? -1 : 1) * (1 + Math.floor(rnd() * 3)),
        largo: 10 + rnd() * 8, tono: Math.floor(rnd() * 3), prof: 0.55 + rnd() * 0.6 });
    }
  }
  function virutas(x, t, paleta, peso) {
    if (peso < 0.01) return;
    x.globalAlpha = peso;
    for (const v of VIRUTAS) {
      const alto = H + 120;
      const y = ((v.y - (t / C.dur) * alto * v.vueltas) % alto + alto) % alto - 60;
      const X = v.x + v.amp * Math.sin(ciclo(t, 2) + v.fase);
      x.save();
      x.translate(X, y);
      x.rotate(v.giro + ciclo(t, v.giros));
      x.scale(v.prof, v.prof);
      x.fillStyle = paleta[v.tono];
      const L = v.largo, A = 4.2;
      x.beginPath();
      x.moveTo(-A / 2, -L / 2 + A / 2);
      x.arc(0, -L / 2 + A / 2, A / 2, Math.PI, 0);
      x.lineTo(A / 2, L / 2 - A / 2);
      x.arc(0, L / 2 - A / 2, A / 2, 0, Math.PI);
      x.closePath();
      x.fill();
      x.restore();
    }
    x.globalAlpha = 1;
  }

  // Jarabe: cae desde arriba y chorrea (dedos que se afinan y terminan en gota). u de 0 a 1.
  const GOTAS = [];
  {
    const rnd = azar(99);
    let x = -60;
    while (x < W + 80) {
      const w = 40 + rnd() * 80;
      GOTAS.push({ x: x + w / 2, w, largo: (90 + rnd() * 380) * (1.25 - (w - 40) / 160), vel: 0.8 + rnd() * 0.5, suelta: rnd() < 0.28 });
      x += w + 18 + rnd() * 110;
    }
  }
  function jarabe(l, t, u, colores) {
    limpiar(l);
    if (u <= 0) return;
    const x = l.x;
    const base = lerp(-150, H + 40, E.inOutCubic(u));
    const grad = x.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, colores[0]); grad.addColorStop(0.6, colores[1]); grad.addColorStop(1, colores[2]);
    x.fillStyle = grad;
    if (u >= 1) { x.fillRect(0, 0, W, H); return; }
    const borde = (X) => base + 12 * Math.sin(X * 0.0085 + t * 2.2) + 5 * Math.sin(X * 0.023 - t * 1.7);
    const p = new Path2D();
    p.moveTo(-60, -60);
    p.lineTo(-60, borde(-60));
    const dedos = [];
    let xPrev = -60;
    const K = 0.5523;
    for (const g of GOTAS) {
      const L = g.largo * E.outSine(clamp(u * 1.7 * g.vel)) * (1 - 0.4 * E.inQuad(u));
      const Lmin = g.w * 1.5, kk = Math.max(0.1, clamp(L / Lmin));   // una gota corta es un bulto: se achica entera
      const w = g.w * kk, cuello = w * 0.56, bola = w * 0.4, alto = w * 0.55;
      const yb = borde(g.x), tip = yb + Math.max(L, Lmin * kk);
      const xl = g.x - w / 2, xr = g.x + w / 2, yg = tip - bola;
      for (let X = xPrev + 22; X < xl - w * 0.35; X += 22) p.lineTo(X, borde(X));
      p.lineTo(xl - w * 0.35, borde(xl - w * 0.35));
      p.bezierCurveTo(xl + w * 0.12, yb, g.x - cuello / 2, yb + alto * 0.35, g.x - cuello / 2, yb + alto);
      p.bezierCurveTo(g.x - cuello / 2, yg - bola * 1.2, g.x - bola, yg - bola * 0.9, g.x - bola, yg);
      p.bezierCurveTo(g.x - bola, yg + bola * K, g.x - bola * K, tip, g.x, tip);
      p.bezierCurveTo(g.x + bola * K, tip, g.x + bola, yg + bola * K, g.x + bola, yg);
      p.bezierCurveTo(g.x + bola, yg - bola * 0.9, g.x + cuello / 2, yg - bola * 1.2, g.x + cuello / 2, yb + alto);
      p.bezierCurveTo(g.x + cuello / 2, yb + alto * 0.35, xr - w * 0.12, yb, xr + w * 0.35, borde(xr + w * 0.35));
      xPrev = xr + w * 0.35;
      dedos.push({ g, yb, tip, bola, yg, cuello });
    }
    for (let X = xPrev + 22; X < W + 60; X += 22) p.lineTo(X, borde(X));
    p.lineTo(W + 60, borde(W + 60));
    p.lineTo(W + 60, -60);
    p.closePath();
    x.save();
    x.shadowColor = 'rgba(25,0,8,0.4)'; x.shadowBlur = 22 * DPR; x.shadowOffsetY = 8 * DPR;
    x.fill(p);
    x.restore();
    x.save();
    x.clip(p);
    x.lineCap = 'round';
    for (const d of dedos) {
      if (d.tip - d.yb < d.bola * 3) continue;
      const xv = d.g.x - d.cuello * 0.22;
      const gv = x.createLinearGradient(0, d.yb, 0, d.yg);
      gv.addColorStop(0, 'rgba(255,215,225,0)'); gv.addColorStop(1, 'rgba(255,215,225,0.26)');
      x.strokeStyle = gv; x.lineWidth = Math.max(2, d.cuello * 0.18);
      x.beginPath(); x.moveTo(xv, d.yb + d.bola); x.lineTo(xv, d.yg - d.bola * 0.4); x.stroke();
      x.fillStyle = 'rgba(255,225,235,0.45)';
      x.beginPath(); x.ellipse(d.g.x - d.bola * 0.38, d.yg - d.bola * 0.3, d.bola * 0.16, d.bola * 0.26, -0.5, 0, Math.PI * 2); x.fill();
    }
    x.strokeStyle = 'rgba(255,200,215,0.3)'; x.lineWidth = 2.5; x.stroke(p);
    x.restore();
    x.fillStyle = colores[1];
    for (const d of dedos) {
      if (!d.g.suelta || u < 0.3) continue;
      const v = (u - 0.3) / 0.7, y = d.tip + 26 + v * v * 1100, rg = Math.max(4, d.bola * 0.7);
      x.beginPath();
      x.moveTo(d.g.x, y - rg * 2.1);
      x.bezierCurveTo(d.g.x + rg * 0.3, y - rg * 1.2, d.g.x + rg, y - rg * 0.45, d.g.x + rg, y);
      x.arc(d.g.x, y, rg, 0, Math.PI);
      x.bezierCurveTo(d.g.x - rg, y - rg * 0.45, d.g.x - rg * 0.3, y - rg * 1.2, d.g.x, y - rg * 2.1);
      x.fill();
    }
  }

  // ═════════════════════════════ ESCENAS ═════════════════════════════
  // Todo lo de abajo es de esta pieza de muestra: se reescribe en cada video.
  const firma = $('#firma'), escenaB = $('#escenaB'), escenaC = $('#escenaC'), viñeta = $('#viñeta');
  const nombre = $('#nombre'), brilloNombre = nombre.querySelector('.brillo');
  nombre.querySelector('.texto').textContent = D.marca.nombre;
  brilloNombre.textContent = D.marca.nombre;
  $('#lema1').textContent = D.marca.lema;
  $('#lema2').textContent = D.marca.lemaAcento;
  $('#rotuloB').textContent = D.escenaB.rotulo; $('#tituloB').textContent = D.escenaB.titulo; $('#acentoB').textContent = D.escenaB.acento;
  $('#rotuloC').textContent = D.escenaC.rotulo; $('#tituloC').textContent = D.escenaC.titulo; $('#acentoC').textContent = D.escenaC.acento;
  const filete = $('#filete'), rombo = $('#rombo');
  const pLema = [...document.querySelectorAll('#lema .linea > span')];
  const pB = [...document.querySelectorAll('#textoB .linea > span')];
  const pC = [...document.querySelectorAll('#textoC .linea > span')];

  // B · la vitrina: una fila de arcos que entra con resorte y corre un lugar por paso.
  const AW = 340, AH = 460, BORDE = 7, PASO = 384, FX0 = 740, FY0 = 292, RT = AW / 2, RB = 14;
  const fila = $('#fila');
  const piezas = D.vitrina.map((it) => {
    const p = document.createElement('div');
    p.className = 'pieza';
    p.innerHTML = `<div class="arco" style="width:${AW}px;height:${AH}px;border-radius:${RT}px ${RT}px ${RB}px ${RB}px">
      <div class="foto" style="border-radius:${RT - BORDE}px ${RT - BORDE}px ${RB - BORDE / 2}px ${RB - BORDE / 2}px"><img alt=""></div></div>
      <div class="etiqueta" style="top:${AH + 26}px;width:${AW + 120}px;left:-60px">
        <div class="nombre">${it.nombre}</div><div class="rotulo">${it.rotulo}</div></div>`;
    fila.appendChild(p);
    const img = p.querySelector('img');
    img.src = fuente(it);
    return { p, img, et: p.querySelector('.etiqueta'), it };
  });
  const scrollFila = (t) => {
    let s = Math.max(0, t - C.arcos[2]) * 12;                     // deriva lenta: siempre hay vida
    for (const p of C.pasosB) s += PASO * E.outBack(prog(t, p, p + 0.42), 1.15);
    return s;
  };

  // C · el carrusel 3D: arcos alrededor de un eje vertical, un paso por pulso.
  const BW = 430, BH = 580, R = 830, NB = D.bebidas.length, ANG = 360 / NB;
  const anillo = $('#anillo');
  const bebidas = D.bebidas.map((it, i) => {
    const a = document.createElement('div');
    a.className = 'arco';
    a.style.cssText = `width:${BW}px;height:${BH}px;margin:${-BH / 2}px 0 0 ${-BW / 2}px;border-radius:${BW / 2}px ${BW / 2}px 16px 16px;` +
      `transform:rotateY(${i * ANG}deg) translateZ(${R}px)`;
    a.innerHTML = `<div class="foto" style="border-radius:${BW / 2 - BORDE}px ${BW / 2 - BORDE}px 9px 9px"><img alt=""></div>`;
    anillo.appendChild(a);
    const img = a.querySelector('img');
    img.src = fuente(it);
    return { a, img, it };
  });
  const frente = $('#frente'), frenteNombre = frente.querySelector('.nombre'), frenteRotulo = frente.querySelector('.rotulo');
  const giro = (t) => {
    const [c0, c1] = C.carrusel;
    let g = -200 * (1 - E.outCubic(prog(t, c0, c1)));
    for (const p of C.carruselPasos) g -= ANG * E.outBack(prog(t, p, p + 0.4), 1.25);
    return g - Math.max(0, t - C.carrusel[1]) * 4;
  };

  const vA = lienzo('#virutasA'), vB = lienzo('#virutasB'), vC = lienzo('#virutasC'), goteo = lienzo('#goteo');
  const PAL = {
    muro: ['rgba(176,125,54,0.42)', 'rgba(71,102,68,0.34)', 'rgba(210,140,160,0.42)'],
    B: ['rgba(214,172,104,0.6)', 'rgba(255,236,200,0.4)', 'rgba(184,204,180,0.4)'],
    C: ['rgba(255,196,214,0.55)', 'rgba(255,236,210,0.4)', 'rgba(214,160,90,0.5)'],
  };
  const CENTRO = [960, 430];                                      // de donde abre y adonde cierra el iris

  function seek(t) {
    t = ((t % C.dur) + C.dur) % C.dur;

    // ── A · firma ──
    const [s0, s1] = C.firmaSale, [f0] = C.firma;
    const tardeA = t > 5;                                          // la mitad final: la firma entra
    const creceNombre = E.inOutCubic(prog(t, C.iris[0], C.iris[1])) * (1 - prog(t, C.cierre[0], C.cierre[1]));
    const golpe = vaiven(t - C.iris[0], 2.6, 5) * 0.06 + vaiven(t - C.cierre[1] + 0.05, 3, 6) * 0.05;
    nombre.style.transform = `translateY(${f2(-30 * creceNombre)}px) scale(${(1 + 0.25 * creceNombre + golpe).toFixed(4)})`;
    const wFil = tardeA ? E.outQuart(prog(t, f0, f0 + 0.55)) : 1 - E.inCubic(prog(t, s0, s1 - 0.05));
    filete.style.transform = `scaleX(${wFil.toFixed(4)})`; filete.style.opacity = wFil.toFixed(3);
    const r = tardeA ? E.outBack(prog(t, f0 + 0.2, f0 + 0.5), 2.2) : 1 - E.inCubic(prog(t, s0, s0 + 0.2));
    rombo.style.transform = `rotate(45deg) scale(${Math.max(0, r).toFixed(3)})`;
    pLema.forEach((el, i) => {
      if (tardeA) sube(el, t, f0 + 0.12 + i * 0.13, 0.75);
      else {
        const v = E.inCubic(prog(t, s0 + i * 0.04, s1 + i * 0.04));
        el.style.transform = `translateY(${f2(v * 110)}%)`; el.style.opacity = (1 - v).toFixed(3);
        el.style.filter = v > 0.02 ? `blur(${(v * 5).toFixed(2)}px)` : 'none';
      }
    });
    const [b0, b1] = C.brillo, ub = prog(t, b0, b1);
    brilloNombre.style.opacity = ub > 0 && ub < 1 ? '1' : '0';
    brilloNombre.style.backgroundPosition = `${f2(lerp(100, 0, E.inOutSine(ub)))}% 0`;
    const enA = t < C.iris[1] + 0.02 || t >= C.cierre[0] - 0.02;
    ver(firma, enA ? 1 : 0);

    // ── B · vitrina (se abre en un iris desde el nombre) ──
    const [i0, i1] = C.iris;
    const enB = t >= i0 && t < C.goteo[1] + 0.02;
    ver(escenaB, enB ? 1 : 0);
    if (enB) {
      const u = E.inOutCubic(prog(t, i0, i1));
      clip(escenaB, u < 1 ? circulo(CENTRO[0], CENTRO[1], u * 1250) : null);
      piezas.forEach((pz, i) => {
        const x = FX0 + i * PASO - scrollFila(t);
        let dy = 0, o = 1;
        if (i < 3) {
          const t0 = C.arcos[i], ua = prog(t, t0, t0 + 0.6);
          dy = 300 * (1 - E.outBack(ua, 1.3)); o = clamp((t - t0) / 0.2);
        }
        pz.p.style.transform = `translate(${f2(x)}px,${f2(FY0 + dy)}px)`;
        pz.p.style.opacity = o.toFixed(3);
        pz.p.style.visibility = o > 0 && x > 400 && x < W + 20 ? 'visible' : 'hidden';
        encuadrarCaja(pz.img, AW - 2 * BORDE, AH - 2 * BORDE, pz.it.foco[0], pz.it.foco[1], pz.it.zoom || 1);
        const te = i < 3 ? C.arcos[i] + 0.18 : 0, ue = E.outCubic(prog(t, te, te + 0.5));
        pz.et.style.opacity = ue.toFixed(3);
        pz.et.style.transform = `translateY(${f2((1 - ue) * 18)}px)`;
      });
      pB.forEach((el, i) => sube(el, t, C.tituloB + i * 0.12, 0.7));
      limpiar(vB);
      virutas(vB.x, t, PAL.B, 1);
    }

    // ── jarabe de la escena B a la C ──
    const [g0, g1] = C.goteo;
    jarabe(goteo, t, t >= g0 && t <= g1 + 0.1 ? prog(t, g0, g1) : 0, ['#5a1830', '#74213d', '#852946']);

    // ── C · carrusel (cierra en un iris hacia la firma) ──
    const enC = t >= g1 - 0.12 && t < C.cierre[1] + 0.02;
    ver(escenaC, enC ? (t < g1 ? prog(t, g1 - 0.12, g1) : 1) : 0);
    if (enC) {
      const g = giro(t);
      const esc = lerp(0.72, 1, E.outCubic(prog(t, C.carrusel[0], C.carrusel[1])));
      anillo.style.transform = `scale(${esc.toFixed(4)}) translateZ(${-R}px) rotateY(${g.toFixed(3)}deg)`;
      for (const b of bebidas) encuadrarCaja(b.img, BW - 2 * BORDE, BH - 2 * BORDE, b.it.foco[0], b.it.foco[1], b.it.zoom || 1);
      const idx = ((Math.round(-g / ANG) % NB) + NB) % NB;
      if (frenteNombre.textContent !== D.bebidas[idx].nombre) frenteNombre.textContent = D.bebidas[idx].nombre;
      if (frenteRotulo.textContent !== D.bebidas[idx].rotulo) frenteRotulo.textContent = D.bebidas[idx].rotulo;
      const resto = Math.abs(-g / ANG - Math.round(-g / ANG));
      const oF = clamp(1 - resto * 4) * prog(t, C.carrusel[1] - 0.1, C.carrusel[1] + 0.25) * (1 - prog(t, C.cierre[0] - 0.3, C.cierre[0]));
      frente.style.opacity = oF.toFixed(3);
      frente.style.transform = `translateY(${f2((1 - oF) * 10)}px)`;
      pC.forEach((el, i) => sube(el, t, C.tituloC + i * 0.14, 0.7, [C.cierre[0] - 0.3, C.cierre[0]]));
      const u = E.inOutCubic(prog(t, C.cierre[0], C.cierre[1]));
      clip(escenaC, u > 0 ? circulo(CENTRO[0], CENTRO[1], (1 - u) * 1250) : null);
      limpiar(vC);
      virutas(vC.x, t, PAL.C, 1);
    }

    // ── partículas del muro, viñeta y grano ──
    limpiar(vA);
    virutas(vA.x, t, PAL.muro, enA ? 1 : 0);
    const oscuro = prog(t, i0, i1) * (1 - prog(t, C.cierre[0], C.cierre[1]));
    viñeta.style.opacity = (0.16 + 0.54 * oscuro).toFixed(3);
    grano.putImageData(ruidos[Math.floor(t * 30) % ruidos.length], 0, 0);
  }
  // Círculo como camino (para clip-path: path()), sentido horario.
  function circulo(cx, cy, r) {
    r = Math.max(0.01, r);
    return `M${f2(cx - r)} ${f2(cy)}A${f2(r)} ${f2(r)} 0 1 0 ${f2(cx + r)} ${f2(cy)}A${f2(r)} ${f2(r)} 0 1 0 ${f2(cx - r)} ${f2(cy)}Z`;
  }

  // ═════════════════════════════ ARRANQUE ═════════════════════════════
  // `listo`: fuentes cargadas e imágenes decodificadas antes de la primera captura.
  window.listo = (async () => {
    await Promise.all([
      document.fonts.load('600 60px Display'), document.fonts.load('italic 500 60px Display'), document.fonts.load('700 20px Texto'),
    ]).catch(() => {});
    await document.fonts.ready;
    await Promise.all([...document.images].map((im) => (im.decode ? im.decode().catch(() => {}) : null)));
    seek(0);
    return true;
  })();
  window.seek = seek;

  // index.html?t=3.2 → congela ese instante · index.html?play → en vivo (clic: con sonido)
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
