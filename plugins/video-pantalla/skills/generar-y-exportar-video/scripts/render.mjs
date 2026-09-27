// Genera los cuadros de una animación HTML determinista con Chrome sin cabeza.
//
// La página tiene que exponer:
//   window.listo  → promesa que se resuelve cuando fuentes e imágenes están listas
//   window.seek(t) → dibuja el instante t (segundos) como función pura del tiempo
//   window.CUES   → { dur, fps, muestras: [[desde, hasta, K], …] } (muestras es opcional)
//
// Uso (desde la carpeta del proyecto, donde está index.html):
//   node render.mjs frames 0.5 1.3 2.7          → capturas sueltas en previa/
//   node render.mjs video [fps] [desde] [hasta] → cuadros/ con desenfoque de movimiento
//
// Variables de entorno:
//   ESCALA=2      deviceScaleFactor: 2 → 3840×2160 (4K). 1 → 1920×1080.
//   MUESTRAS=1    fuerza K submuestras por cuadro (1 = previa rápida sin desenfoque)
//   SALIDA=dir    carpeta de salida del modo video (por defecto cuadros{fps}[_4k])
//   TRABAJADORES  cuántos Chrome en paralelo (por defecto 6 en 4K, 4 en 1080)
//   CHROME        ruta del ejecutable de Chrome
//   PAGINA        archivo HTML a abrir (por defecto index.html)
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const CHROME = process.env.CHROME || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find((p) => fs.existsSync(p));
const W = 1920, H = 1080;
const ESCALA = Number(process.env.ESCALA || 1);
const PAGINA = process.env.PAGINA || 'index.html';
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.json': 'application/json', '.wav': 'audio/wav' };

if (!CHROME) {
  console.error('No encontré Google Chrome. Pasa su ruta en CHROME=/ruta/al/chrome');
  process.exit(1);
}

// Servidor estático mínimo: la página se abre por http para que carguen fuentes e imágenes.
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(0);
const PORT = server.address().port;

// Un navegador por trabajador: Chrome frena las pestañas de fondo y las capturas se cuelgan
// (ProtocolError: Runtime.callFunctionOn timed out). Con un navegador cada uno, no pasa.
const navegadores = [];
async function abrir() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    protocolTimeout: 600000,
    args: ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none',
      '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
  });
  navegadores.push(browser);
  const page = (await browser.pages())[0] || (await browser.newPage());
  await page.setViewport({ width: W, height: H, deviceScaleFactor: ESCALA });
  page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.error('[página]', m.text()); });
  page.on('pageerror', (e) => console.error('[error en la página]', e.message));
  await page.goto(`http://127.0.0.1:${PORT}/${PAGINA}`, { waitUntil: 'load' });
  await page.evaluate(() => window.listo);
  return page;
}

async function captura(page, t) {
  await page.evaluate((t) => window.seek(t), t);
  // En 4K las submuestras viajan en JPEG 95: se promedian entre sí y el video final es 4:2:0 igual.
  if (ESCALA > 1) return page.screenshot({ type: 'jpeg', quality: 95, optimizeForSpeed: true, clip: { x: 0, y: 0, width: W, height: H } });
  return page.screenshot({ type: 'png', optimizeForSpeed: true, clip: { x: 0, y: 0, width: W, height: H } });
}

const [modo, ...args] = process.argv.slice(2);

if (modo === 'frames') {
  const dir = path.join(ROOT, 'previa');
  fs.mkdirSync(dir, { recursive: true });
  const page = await abrir();
  for (const a of args) {
    const t = parseFloat(a);
    const buf = await captura(page, t);
    const f = path.join(dir, `t${t.toFixed(3)}${ESCALA > 1 ? '_4k' : ''}.png`);
    if (ESCALA > 1) await sharp(buf).png().toFile(f); else fs.writeFileSync(f, buf);
    console.log(f);
  }
} else if (modo === 'video') {
  const page0 = await abrir();
  const cues = await page0.evaluate(() => window.CUES || {});
  const fps = parseInt(args[0] || String(cues.fps || 60), 10);
  const DUR = cues.dur || 15;
  const desde = parseInt(args[1] || '0', 10);
  const hasta = parseInt(args[2] || String(Math.round(DUR * fps)), 10);
  const tramos = cues.muestras || [];
  // Submuestras por cuadro (obturador de 180°): más donde la cámara o las piezas corren.
  const muestras = (t) => {
    if (process.env.MUESTRAS) return Number(process.env.MUESTRAS);
    let k = 2;
    for (const [a, b, K] of tramos) if (t >= a && t < b) k = Math.max(k, K);
    return k;
  };
  const shutter = 0.5;
  const dir = path.join(ROOT, process.env.SALIDA || `cuadros${fps}${ESCALA > 1 ? '_4k' : ''}`);
  fs.mkdirSync(dir, { recursive: true });
  const TRABAJADORES = Number(process.env.TRABAJADORES || (ESCALA > 1 ? 6 : 4));
  const pages = [page0];
  for (let i = 1; i < TRABAJADORES; i++) pages.push(await abrir());
  let siguiente = desde, hechos = 0;
  const t0 = Date.now();
  async function trabajador(page) {
    while (siguiente < hasta) {
      const n = siguiente++;
      const tc = n / fps;
      const K = muestras(tc);
      const w = W * ESCALA, h = H * ESCALA;
      const acc = new Float32Array(w * h * 3);
      for (let k = 0; k < K; k++) {
        const off = K === 1 ? 0 : ((k + 0.5) / K - 0.5) * (shutter / fps);
        const img = await captura(page, tc + off);
        const { data } = await sharp(img).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        for (let i = 0; i < data.length; i++) acc[i] += data[i];
      }
      const out = Buffer.alloc(w * h * 3);
      for (let i = 0; i < out.length; i++) out[i] = Math.min(255, Math.round(acc[i] / K));
      const im = sharp(out, { raw: { width: w, height: h, channels: 3 } });
      const nombre = path.join(dir, String(n).padStart(5, '0'));
      // En 4K cada PNG pesaría ~20 MB: se guarda JPEG 97 4:4:4, invisible tras el HEVC.
      if (ESCALA > 1) await im.jpeg({ quality: 97, chromaSubsampling: '4:4:4', mozjpeg: true }).toFile(nombre + '.jpg');
      else await im.png({ compressionLevel: 1 }).toFile(nombre + '.png');
      hechos++;
      if (hechos % 30 === 0) {
        const s = (Date.now() - t0) / 1000;
        console.log(`${hechos}/${hasta - desde} cuadros · ${s.toFixed(0)} s · ~${((s / hechos) * (hasta - desde - hechos)).toFixed(0)} s restantes`);
      }
    }
  }
  await Promise.all(pages.map(trabajador));
  console.log(`listo en ${((Date.now() - t0) / 1000).toFixed(1)} s → ${path.relative(ROOT, dir)}/`);
} else {
  console.log('uso: node render.mjs frames t1 t2 …   |   node render.mjs video [fps] [desde] [hasta]');
}

await Promise.all(navegadores.map((b) => b.close()));
// Sin esto el proceso puede quedarse minutos esperando conexiones abiertas.
server.closeAllConnections?.();
server.close();
process.exit(0);
