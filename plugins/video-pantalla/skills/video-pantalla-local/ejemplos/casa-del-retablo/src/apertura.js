// Apertura y cierre: una sola escena con su reloj tw ∈ [−6, 6) (negativo = cierre, que termina justo donde
// empieza la apertura: el bucle no salta).
//   apertura  el logo en crema sobre el rojo de la marca; las letras se van, el techo y la flor viajan
//             hasta un retablo de verdad que sube cerrado desde abajo (su frontón calza con el techo del
//             logo), abre sus puertas con un golpe de luz y flores, y la cámara entra por el nicho de
//             arriba, que ya muestra el primer tablero.
//   cierre    lo mismo al revés: la cámara sale del nicho (el último tablero adentro), las puertas se
//             cierran, el retablo baja y la casa vuelve a ser el logo.
import * as THREE from 'three';
import { crearTablero } from './tablero.js';
import { crearRetablo3D, texVacia } from './retablo3d.js';
import { logoCanvas, florCanvas } from './marca.js';
import { DC, FOV, aMundo, tamMundo, CREMA } from './letras.js';
import { E, clamp, lerp, prog, azar, vaiven } from './util.js';
import { PAL } from './tableros.js';

const SLUG = 'nac-jarana-500';
const NICHO = [705, 450, 1665, 1010];            // nicho de arriba, en px de la foto
const FLOR_FRONTON = [1180, 300];                // la flor pintada del frontón
const TAN = Math.tan((FOV * Math.PI) / 360);

export function crearApertura(motor, R) {
  const P0 = R.productos[SLUG];
  // geometría del logo (px ×3 de logo.js)
  const cont = { x0: 132, y0: 408, x1: 2601, y1: 2076 };
  const apice = [1710, 408], extIzq = [948, 955], extDer = [2589, 1137], florL = [1677, 950];
  const anchoLogo = 1040;
  const f = anchoLogo / (cont.x1 - cont.x0);
  const cxL = (cont.x0 + cont.x1) / 2, cyL = (cont.y0 + cont.y1) / 2;
  const L2D = ([X, Y]) => [960 + (X - cxL) * f, 560 + (Y - cyL) * f];
  const zLogo = 0.25;

  let extra = null;
  const def = { id: 'apertura', t0: 0, dur: 6, pal: PAL.rojo, flor: [960, 520, 860], pared: -3.2, semilla: 99, hud: false,
    florcitas: { n: 26, delante: 6 }, luz: { blando: 0.06, sombra: 0.42 },
    extra: (ctx) => (extra = armar(ctx)) };
  const n = crearTablero(motor, R, def);

  function armar(ctx) {
    const { raiz } = ctx;
    // ── logo: letras, techo y flor, tres planos con el mismo marco ──
    const lado = window.LOGO.w;
    const mkPlano = (canvas, z) => {
      const tex = motor.texturaCanvas(canvas);
      const w = tamMundo(lado * f, z);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
      const [x, y] = aMundo(...L2D([lado / 2, lado / 2]), z);
      m.position.set(x, y, z);
      m.renderOrder = 50;
      raiz.add(m);
      return m;
    };
    const letras = mkPlano(logoCanvas({ ancho: 2048, tinta: CREMA, margen: 0, sinTecho: true, sinFlor: true }), zLogo);
    const techo = mkPlano(logoCanvas({ ancho: 2048, tinta: CREMA, margen: 0, soloTecho: true, sinFlor: true }), zLogo + 0.01);
    const flor = (() => {
      const tex = motor.texturaCanvas(florCanvas(512, { rojo: CREMA, verde: CREMA, naranja: '#f6c453' }, 0.02));
      const s = tamMundo(760 * f, zLogo + 0.02);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
      m.renderOrder = 51;
      raiz.add(m);
      return m;
    })();
    const techo0 = techo.position.clone();

    // ── el retablo: su frontón calza con el techo del logo ──
    const [axD, ayD] = L2D(apice);
    const [ex0] = L2D(extIzq), [ex1] = L2D(extDer);
    const mitadTecho = ((axD - ex0) + (ex1 - axD)) / 2;            // px de diseño
    const mitadFronton = (NICHO[2] - NICHO[0]) / 2 + 10;            // px de la foto (el frontón es como el nicho)
    const kDis = (mitadTecho * 0.98) / mitadFronton;                 // px de diseño por px de foto
    const k = tamMundo(kDis, 0);
    const ret = crearRetablo3D(P0, { k, fondoRel: 0.42 });
    const piv = new THREE.Group();
    const apiceTex = P0.centro[1];
    const [awx, awy] = aMundo(axD, ayD, 0);
    piv.position.set(awx, awy - (P0.apoyo - apiceTex) * k, 0);
    piv.add(ret.grupo);
    raiz.add(piv);
    const cxTex = (P0.bisagras[0] + P0.bisagras[1]) / 2;
    const deTex = (x, y) => new THREE.Vector3((x - cxTex) * k, (P0.apoyo - y) * k, 0);
    const altoRet = (P0.apoyo - P0.caja[1]) * k;
    const centroRet = new THREE.Vector3(awx, piv.position.y + altoRet / 2, 0);

    // portal: el tablero de adentro (muestreado en pantalla) sobre el nicho
    const nichoC = deTex((NICHO[0] + NICHO[2]) / 2, (NICHO[1] + NICHO[3]) / 2);
    const anchoP = (NICHO[2] - NICHO[0]) * k, altoP = anchoP / (16 / 9);
    const matPortal = new THREE.ShaderMaterial({
      uniforms: { t: { value: null }, res: { value: new THREE.Vector2(motor.pw, motor.ph) }, opacidad: { value: 0 } },
      vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D t; uniform vec2 res; uniform float opacidad;
        void main(){ gl_FragColor = vec4(texture2D(t, gl_FragCoord.xy / res).rgb, opacidad); }`,
      transparent: true, depthWrite: false,
    });
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(anchoP, altoP), matPortal);
    portal.position.set(nichoC.x, nichoC.y, 0.012);
    portal.renderOrder = 45;
    ret.grupo.add(portal);
    // el golpe de luz al abrir
    const brillo = new THREE.Mesh(new THREE.PlaneGeometry(anchoP * 2.4, anchoP * 2.4), new THREE.ShaderMaterial({
      uniforms: { a: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float a; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float v = exp(-d * d * 5.0) * a; gl_FragColor = vec4(vec3(1.0, 0.86, 0.6) * v * 0.9, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    brillo.position.set(nichoC.x, nichoC.y, 0.05);
    brillo.renderOrder = 46;
    ret.grupo.add(brillo);
    // flores que salen del nicho al abrir
    const rf = azar(1234);
    const PALETA = [CREMA, '#f6c453', '#3a9a48', '#ffffff', '#f39b2b'];
    const texF = motor.texturaCanvas(florCanvas(256, { rojo: '#ffffff', verde: '#ffffff', naranja: '#ffffff' }));
    const chispas = Array.from({ length: 40 }, (_, i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texF, color: new THREE.Color(PALETA[i % PALETA.length]), transparent: true, depthWrite: false, toneMapped: false }));
      m.renderOrder = 47;
      ret.grupo.add(m);
      const ang = rf() * Math.PI * 2;
      return { m, dir: new THREE.Vector3(Math.cos(ang) * rf.entre(0.4, 1), Math.sin(ang) * rf.entre(0.3, 1) + 0.2, rf.entre(0.6, 1.6)), vel: rf.entre(3, 7), tam: rf.entre(0.12, 0.32), giro: rf.entre(-6, 6), dt: rf.entre(0, 0.25) };
    });

    // ── cámaras ──
    const vLogo = { pos: [0, 0, DC], mira: [0, 0, 0] };
    const dRet = (altoRet * 1.16) / (2 * TAN);
    const vRet = { pos: [centroRet.x, centroRet.y, dRet], mira: [centroRet.x, centroRet.y, 0] };
    const nichoW = new THREE.Vector3().copy(nichoC).add(piv.position);
    const dFin = (altoP * 0.985) / (2 * TAN);
    const vNicho = { pos: [nichoW.x, nichoW.y, dFin + 0.012], mira: [nichoW.x, nichoW.y, 0] };
    const mezclaV = (a, b, u) => ({ pos: a.pos.map((x, i) => lerp(x, b.pos[i], u)), mira: a.mira.map((x, i) => lerp(x, b.mira[i], u)) });

    // estado según tw (apertura ≥ 0, cierre < 0: se espeja con tiempos propios)
    function estado(tw) {
      const s = {};
      if (tw >= 0) {
        s.letras = 1 - E.inOutCubic(prog(tw, 0.45, 1.25));
        s.letrasY = E.inCubic(prog(tw, 0.45, 1.25));
        s.viaje = E.inOutCubic(prog(tw, 0.6, 2.1));            // techo y flor hacia el retablo
        s.techo = 1 - E.inOutSine(prog(tw, 2.0, 2.7));
        s.flor = 1 - E.inOutSine(prog(tw, 1.7, 2.2));
        s.sube = E.outCubic(prog(tw, 0.85, 2.3));
        s.cierre = 1 - E.outBack(prog(tw, 3.5, 4.6), 1.25);
        s.brillo = Math.max(0, Math.sin(Math.PI * prog(tw, 3.45, 4.5))) ** 2 * (1 - prog(tw, 3.7, 4.5) * 0.5);
        s.chispas = tw - 3.6;
        s.portal = E.inOutSine(prog(tw, 4.8, 5.6));
        const a = E.inOutCubic(prog(tw, 1.0, 2.7)), b = E.inExpo(prog(tw, 4.3, 5.88));
        s.vista = mezclaV(mezclaV(vLogo, vRet, a), vNicho, b);
        s.push = prog(tw, 2.7, 4.4);
      } else {
        const u = tw + 6;                                        // 0 … 6 del cierre
        s.portal = 1 - E.inOutSine(prog(u, 0.35, 1.15));
        const a = 1 - E.outExpo(prog(u, 0.12, 1.75));
        s.cierre = E.inCubic(prog(u, 1.75, 2.35)) - vaiven(prog(u, 2.35, 2.9), 2.2, 6) * 0.04;
        s.brillo = 0;
        s.chispas = -1;
        s.sube = 1 - E.inCubic(prog(u, 3.0, 4.2));
        s.viaje = 1 - E.inOutCubic(prog(u, 3.3, 4.6));
        s.techo = E.inOutSine(prog(u, 2.9, 3.5));
        s.flor = E.inOutSine(prog(u, 3.6, 4.1));
        s.letras = E.inOutCubic(prog(u, 4.25, 5.05));
        s.letrasY = 1 - E.outCubic(prog(u, 4.25, 5.05));
        const c = 1 - E.inOutCubic(prog(u, 2.9, 4.6));
        s.vista = mezclaV(mezclaV(vLogo, vRet, c), vNicho, a);
        s.push = 1 - prog(u, 1.7, 2.9);
      }
      return s;
    }

    const techoApice = new THREE.Vector3(...aMundo(axD, ayD, zLogo + 0.01));
    const florIni = new THREE.Vector3(...aMundo(...L2D(florL), zLogo + 0.02));
    const florFin = deTex(...FLOR_FRONTON).add(piv.position).setZ(0.06);
    let ultimo = null;
    return {
      slugs: [SLUG],
      texturas(cache) { ret.ponerTextura(cache[SLUG] || texVacia()); },
      portal: matPortal,
      estado,
      actualizar(tl, t) {
        const s = estado(tl);
        ultimo = s;
        letras.material.opacity = s.letras;
        letras.position.y = techo0.y - s.letrasY * tamMundo(30, zLogo);
        letras.visible = s.letras > 0.001;
        // techo: escala alrededor de su ápice hasta calzar con el frontón (ya está calzado en escala; sube con el retablo)
        techo.material.opacity = s.techo;
        techo.visible = s.techo > 0.001;
        const off = (1 - s.sube) * -altoRet * 0.9;
        techo.position.set(techo0.x, techo0.y + 0 * s.viaje, techo0.z);
        // la flor viaja al frontón y se achica
        const fp = florIni.clone().lerp(florFin.clone().add(new THREE.Vector3(0, off, 0)), s.viaje);
        flor.position.copy(fp);
        flor.scale.setScalar(lerp(1, 0.42, s.viaje));
        flor.rotation.z = s.viaje * -Math.PI * 0.5 + t * 0.15;
        flor.material.opacity = s.flor;
        flor.visible = s.flor > 0.001;
        // el retablo sube cerrado
        ret.grupo.position.y = off;
        ret.grupo.visible = s.sube > 0.001;
        ret.puertasA(clamp(s.cierre, 0, 1.02));
        brillo.material.uniforms.a.value = s.brillo;
        brillo.visible = s.brillo > 0.001;
        chispas.forEach((c) => {
          const u = s.chispas - c.dt;
          const vis = u > 0 && u < 1.4;
          c.m.visible = vis;
          if (!vis) return;
          const d = c.dir.clone().multiplyScalar(c.vel * (1 - Math.exp(-u * 2.2)) * 0.9);
          d.y -= u * u * 0.6;
          c.m.position.set(nichoC.x + d.x, nichoC.y + d.y, 0.1 + d.z);
          c.m.rotation.z = c.giro * u;
          const sc = c.tam * (1 + u * 0.8) * (1 - prog(u, 0.9, 1.4));
          c.m.scale.set(sc, sc, 1);
        });
        matPortal.uniforms.opacidad.value = s.portal;
        portal.visible = s.portal > 0.001;
      },
      vista(tl) {
        const s = estado(tl);
        const v = s.vista;
        // un empujón suave y un giro mínimo mientras el retablo está cerrado
        const az = Math.sin(s.push * Math.PI) * 0.035;
        const pos = v.pos.slice();
        pos[0] += Math.sin(az) * (pos[2] - v.mira[2]);
        const foco = Math.hypot(pos[0] - v.mira[0], pos[1] - v.mira[1], pos[2] - v.mira[2]);
        return { pos, mira: v.mira, fov: FOV, foco, apertura: 0.035, cerca: 0.01 };
      },
    };
  }

  const r = motor.renderer;
  return {
    slugs: () => [SLUG],
    texturas: (cache) => n.texturas(cache),
    // tw ∈ [−6, 6); ctx.tablero(tt, destino) dibuja el tablero de adentro (el primero o el último)
    dibujar(tw, k, K, ctx) {
      const s = extra.estado(tw);
      if ((tw > 0 && tw >= 5.88) || (tw < 0 && tw + 6 < 0.12)) return ctx.tablero(motor.rtMuestra);
      if (s.portal > 0.001) {
        ctx.tablero(motor.rtB);
        extra.portal.uniforms.t.value = motor.rtB.texture;
      }
      const v = n.vista(tw);
      motor.colocar(ctx.camA, v, k, K);
      n.actualizar(tw, v, { k, K });
      motor.limpiar(motor.rtMuestra);
      r.setRenderTarget(motor.rtMuestra);
      r.render(n.escena, ctx.camA);
    },
  };
}
