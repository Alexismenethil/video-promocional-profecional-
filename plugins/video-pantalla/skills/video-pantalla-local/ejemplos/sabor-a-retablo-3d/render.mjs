// Genera los cuadros de la animación 3D determinista con Chrome sin cabeza (WebGL con la GPU).
//
// La página expone:
//   window.listo     → promesa: fuentes, texturas y mundo listos
//   window.seek(t,K) → dibuja el instante t promediando K submuestras (desenfoque de movimiento,
//                      profundidad de campo y antialias se hacen adentro, en la GPU)
//   window.CUES      → { dur, fps, muestras: [[desde, hasta, K], …] }
//
//   node render.mjs frames 0.5 1.3 2.7          → capturas sueltas en previa/
//   node render.mjs video [fps] [desde] [hasta] → cuadros/ (JPEG 97 4:4:4 en 4K, PNG en 1080)
//
// Variables: ESCALA=2 (4K) · K=n (fuerza submuestras) · SALIDA=dir · TRABAJADORES=n · PAGINA=index.html
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const CHROME = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome']
  .find((p) => fs.existsSync(p));
const W = 1920, H = 1080;
const ESCALA = Number(process.env.ESCALA || 1);
const PAGINA = process.env.PAGINA || 'index.html';
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };

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

const navegadores = [];
async function abrir() {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true, protocolTimeout: 900000,
    args: ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none', '--use-angle=metal',
      '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
  });
  navegadores.push(browser);
  const page = (await browser.pages())[0] || (await browser.newPage());
  await page.setViewport({ width: W, height: H, deviceScaleFactor: ESCALA });
  page.on('console', (m) => { if (['error', 'warn'].includes(m.type()) && !/404|GPU stall|ReadPixels/.test(m.text())) console.error('[página]', m.text()); });
  page.on('pageerror', (e) => console.error('[error en la página]', e.message));
  await page.goto(`http://127.0.0.1:${PORT}/${PAGINA}`, { waitUntil: 'load' });
  await page.evaluate(() => window.listo);
  return page;
}

async function captura(page, t, K) {
  await page.evaluate((t, K) => window.seek(t, K), t, K);
  if (ESCALA > 1) return page.screenshot({ type: 'jpeg', quality: 97, optimizeForSpeed: true, clip: { x: 0, y: 0, width: W, height: H } });
  return page.screenshot({ type: 'png', optimizeForSpeed: true, clip: { x: 0, y: 0, width: W, height: H } });
}

const [modo, ...args] = process.argv.slice(2);
if (modo === 'frames') {
  const dir = path.join(ROOT, process.env.SALIDA || 'previa');
  fs.mkdirSync(dir, { recursive: true });
  const page = await abrir();
  const K = Number(process.env.K || 8);
  for (const a of args) {
    const t = parseFloat(a);
    const t0 = Date.now();
    const buf = await captura(page, t, K);
    const f = path.join(dir, `t${t.toFixed(3)}${ESCALA > 1 ? '_4k' : ''}.${ESCALA > 1 ? 'jpg' : 'png'}`);
    fs.writeFileSync(f, buf);
    console.log(f, `${Date.now() - t0} ms`);
  }
} else if (modo === 'video') {
  const page0 = await abrir();
  const cues = await page0.evaluate(() => window.CUES || {});
  const fps = parseInt(args[0] || String(cues.fps || 60), 10);
  const DUR = cues.dur || 60;
  const desde = parseInt(args[1] || '0', 10);
  const hasta = parseInt(args[2] || String(Math.round(DUR * fps)), 10);
  const tramos = cues.muestras || [];
  const muestras = (t) => {
    if (process.env.K) return Number(process.env.K);
    let k = cues.muestrasBase || 8;
    for (const [a, b, K] of tramos) if (t >= a && t < b) k = Math.max(k, K);
    return k;
  };
  const dir = path.join(ROOT, process.env.SALIDA || `cuadros${fps}${ESCALA > 1 ? '_4k' : ''}`);
  fs.mkdirSync(dir, { recursive: true });
  const TRABAJADORES = Number(process.env.TRABAJADORES || 3);
  const pages = [page0];
  for (let i = 1; i < TRABAJADORES; i++) pages.push(await abrir());
  let siguiente = desde, hechos = 0;
  const t0 = Date.now();
  const ext = ESCALA > 1 ? 'jpg' : 'png';
  async function trabajador(page) {
    while (siguiente < hasta) {
      const n = siguiente++;
      const nombre = path.join(dir, String(n).padStart(5, '0') + '.' + ext);
      if (process.env.SEGUIR && fs.existsSync(nombre)) { hechos++; continue; }
      const t = n / fps;
      const buf = await captura(page, t, muestras(t));
      fs.writeFileSync(nombre, buf);
      hechos++;
      if (hechos % 60 === 0) {
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
server.closeAllConnections?.();
server.close();
process.exit(0);
