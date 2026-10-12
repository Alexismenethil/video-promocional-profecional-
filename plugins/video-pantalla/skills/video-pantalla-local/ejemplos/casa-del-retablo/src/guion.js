// El guion: qué se dibuja en cada instante t. Apertura (la casa del logo se vuelve retablo, abre sus
// puertas y la cámara entra), los tableros con sus transiciones, y el cierre (la cámara sale, las
// puertas se cierran y vuelve el logo: el último cuadro empalma con el primero).
import { E, prog, lerp, clamp, vaiven } from './util.js';
import { DC, mezcla } from './letras.js';

const TRANS = window.CUES.trans;
const VENTANA = window.CUES.ventana;

function girar(v, ang) {
  const dx = v.mira[0] - v.pos[0], dz = v.mira[2] - v.pos[2];
  const c = Math.cos(ang), s = Math.sin(ang);
  return { ...v, mira: [v.pos[0] + dx * c + dz * s, v.mira[1], v.pos[2] - dx * s + dz * c] };
}
const acercar = (v, k, hacia = null) => {
  const m = hacia || v.mira;
  return { ...v, pos: v.pos.map((x, i) => m[i] + (x - m[i]) * k), foco: (v.foco || DC) * k };
};

export function crearGuion(motor, mundo, tr) {
  const { tableros, camA, camB, apertura } = mundo;
  const r = motor.renderer;
  const N = tableros.length;
  const T1 = tableros[0].def.t0;
  const FIN = tableros[N - 1].def.t0 + tableros[N - 1].def.dur;

  function tablero(n, t, v, k, K, destino = motor.rtMuestra, op = {}) {
    motor.colocar(camB, v, k, K);
    n.actualizar(t, v, { ...op, k, K });
    motor.limpiar(destino);
    r.setRenderTarget(destino);
    r.render(n.escena, camB);
  }
  const vistaDe = (n, t) => n.vista(t - n.def.t0);

  function enTableros(t, k, K) {
    for (let j = 1; j < N; j++) {
      const T = TRANS[j];
      if (!T) continue;
      const tb = tableros[j].def.t0;
      const [antes, despues] = VENTANA[T.tipo] || [0, 0];
      if (t >= tb - antes && t < tb + despues) return transicion(T, tableros[j - 1], tableros[j], tb, t, k, K);
    }
    let c = 0;
    for (let i = 0; i < N; i++) if (t >= tableros[i].def.t0) c = i;
    tablero(tableros[c], t, vistaDe(tableros[c], t), k, K);
  }

  function transicion(T, A, B, tb, t, k, K) {
    const vA = vistaDe(A, t), vB = vistaDe(B, t);
    const [antes, despues] = VENTANA[T.tipo];
    const u = prog(t, tb - antes, tb + despues);
    if (T.tipo === 'latigo') {
      const ang = 0.42;
      if (t < tb) tablero(A, t, girar(vA, -T.dir * ang * E.inQuart(prog(t, tb - antes, tb))), k, K);
      else tablero(B, t, girar(vB, T.dir * ang * (1 - E.outQuart(prog(t, tb, tb + despues)))), k, K);
      return;
    }
    if (T.tipo === 'tablas') {
      tablero(A, t, vA, k, K, motor.rtA);
      tablero(B, t, vB, k, K, motor.rtB);
      const fondo = mezcla(A.def.pal.oscuro, B.def.pal.oscuro, 0.5);
      tr.tablas(motor.rtA.texture, motor.rtB.texture, prog(t, tb - antes, tb), T.juego, T.desde, 0.62, mezcla(fondo, '#000000', 0.45));
      return;
    }
    if (T.tipo === 'empuje') {
      tablero(A, t, vA, k, K, motor.rtA);
      tablero(B, t, vB, k, K, motor.rtB);
      tr.empuje(motor.rtA.texture, motor.rtB.texture, E.inOutCubic(u), T.dir);
      return;
    }
    if (T.tipo === 'abrir') {
      if (u <= 0) return tablero(A, t, vA, k, K);
      if (u >= 1) return tablero(B, t, vB, k, K);
      tablero(A, t, vA, k, K, motor.rtA);
      // B entra desde un poco más atrás (la cámara avanza al abrirse las puertas)
      tablero(B, t, acercar(vB, lerp(1.12, 1, E.outCubic(u))), k, K, motor.rtB);
      tr.abrir(motor.rtA.texture, motor.rtB.texture, u);
      return;
    }
    if (T.tipo === 'casa') {
      // 0 → 0,35 la casita aparece; 0,35 → 0,55 queda; 0,55 → 0,92 la cámara entra; luego B
      const zoom = E.inExpo(prog(u, 0.55, 0.92));
      if (u >= 0.92) return tablero(B, t, vB, k, K);
      const aparece = E.outBack(prog(u, 0, 0.35), 1.5);
      const esc = 0.42 * aparece + zoom * (3.6 - 0.42);
      // B en miniatura adentro (cámara alejada lo justo para que quepa)
      tablero(B, t, acercar(vB, Math.max(1, 0.95 / Math.max(esc * 0.9, 0.02))), k, K, motor.rtB);
      tablero(A, t, acercar(vA, lerp(1.0, 0.9, E.inCubic(prog(u, 0.35, 0.92)))), k, K);
      tr.casa(motor.rtB.texture, esc, (1 - E.outCubic(prog(u, 0, 0.45))) * 0.5 * (T.dir || 1));
      return;
    }
    if (T.tipo === 'flores') {
      if (u < 0.5) tablero(A, t, acercar(vA, lerp(1, 0.94, E.inCubic(u * 2))), k, K);
      else tablero(B, t, acercar(vB, lerp(1.06, 1, E.outCubic(u * 2 - 1))), k, K);
      tr.flores(u, T.dir || 1);
      return;
    }
    if (T.tipo === 'zoom') {
      // la cámara se mete en el punto de A (un nicho) y sale del centro de B
      const hacia = T.hacia ? A.prods?.[T.hacia]?.piv.position.toArray() : null;
      if (u < 0.5) {
        const v = acercar(vA, lerp(1, 0.18, E.inExpo(u * 2)), hacia || vA.mira);
        tablero(A, t, v, k, K, motor.rtA);
        tablero(B, t, acercar(vB, 2.2), k, K, motor.rtB);
        tr.fundido(motor.rtA.texture, motor.rtB.texture, E.inCubic(clamp((u - 0.38) / 0.12)), 0.25 * E.inCubic(clamp((u - 0.3) / 0.2)));
      } else {
        tablero(B, t, acercar(vB, lerp(2.2, 1, E.outExpo(u * 2 - 1))), k, K, motor.rtB);
        tr.fundido(motor.rtB.texture, motor.rtB.texture, 0, 0.25 * (1 - E.outCubic(clamp((u - 0.5) / 0.25))));
      }
      return;
    }
    // corte seco
    if (t < tb) tablero(A, t, vA, k, K); else tablero(B, t, vB, k, K);
  }

  function ajustes(t) {
    const salon = t < T1 ? 1 - E.inOutSine(prog(t, T1 - 1.2, T1)) : E.inOutSine(prog(t, FIN - 0.2, FIN + 1.0));
    return { bloom: lerp(0.16, 0.24, salon), radio: 0.45, umbral: 1.08, vineta: lerp(0.22, 0.34, salon), saturacion: 1.04 };
  }

  return {
    dibujar(t, k, K) {
      if (apertura && t < T1) return apertura.dibujar(t, k, K, { camA, tablero: (dest) => tablero(tableros[0], t, vistaDe(tableros[0], t), k, K, dest) });
      if (apertura && t >= FIN) return apertura.dibujar(t - window.CUES.dur, k, K, { camA, tablero: (dest) => tablero(tableros[N - 1], t, vistaDe(tableros[N - 1], t), k, K, dest) });
      return enTableros(t, k, K);
    },
    ajustes, T1, FIN,
    slugsExtra: (t) => (t < T1 + 1 || t > FIN - 1.6 ? apertura?.slugs?.(t) || [] : []),
    texturas: (cache) => apertura?.texturas?.(cache),
    eventos(defs) {
      const ev = [];
      const panDe = (x) => Math.max(-0.8, Math.min(0.8, ((x - 960) / 960) * 0.9));
      defs.forEach((d, j) => {
        (d.prods || []).forEach((p) => {
          const tipo = p.entrada || 'quieto';
          const te = d.t0 + (p.t ?? 0);
          if (tipo !== 'quieto') ev.push({ t: +te.toFixed(4), tipo, tablero: j, pan: +panDe(p.cx).toFixed(2) });
          if (tipo === 'puertas') ev.push({ t: +(te + (p.abre ?? 0.5)).toFixed(4), tipo: 'abre', tablero: j, pan: +panDe(p.cx).toFixed(2) });
          if (['gira', 'voltea', 'cae', 'sube', 'desliza', 'acerca'].includes(tipo) && (p.abreAlCaer || p.abreAlSubir || p.abreAlLlegar || tipo === 'gira' || tipo === 'voltea'))
            ev.push({ t: +(te + 0.45).toFixed(4), tipo: 'abre', tablero: j, pan: +panDe(p.cx).toFixed(2) });
          (p.brillos || []).forEach((b) => ev.push({ t: +(d.t0 + b[2]).toFixed(4), tipo: 'destello', tablero: j, pan: +panDe(p.cx).toFixed(2) }));
        });
        (d.etiquetas || []).forEach((e) => ev.push({ t: +(d.t0 + (e.t ?? 0.9)).toFixed(4), tipo: 'etiqueta-' + (e.entrada || 'pop'), tablero: j, pan: +panDe(e.x).toFixed(2) }));
        const tit = (d.textos || []).find((x) => x.estilo?.px >= 80);
        if (tit) ev.push({ t: +(d.t0 + (tit.t ?? 0.3)).toFixed(4), tipo: 'titulo', tablero: j, pan: +panDe(tit.x).toFixed(2) });
        (d.eventos || []).forEach((e) => ev.push({ ...e, t: +(d.t0 + e.t).toFixed(4), tablero: j }));
      });
      return ev.sort((a, b) => a.t - b.t);
    },
  };
}
