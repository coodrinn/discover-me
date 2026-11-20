// Extrage descriptori cu motorul REAL al aplicației (face-api din vendor/) pentru un subset din LFW.
// Pentru fiecare poză: original, oglindit (flip) și o variantă „grea" (blur / întunecat / mică / rotită / mască / JPEG).
// Rulare: node extract.js <out.json> <maxPerPerson> <minPerPerson> <nPeopleCap> <nDistractors> [workers]
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const APP = path.resolve(__dirname, '..', '..');
const LFW = path.resolve(process.env.LFW_DIR || path.join(__dirname, 'lfw', 'lfw'));   // folderul „lfw” din arhiva LFW (lfw.tgz)
const [OUT, MAXPP = 20, MINPP = 8, NCAP = 150, NDIS = 600, WORKERS = 4] = process.argv.slice(2);

// ---- alegerea subsetului (determinist) ----
function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
const R = rng(12345);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const people = fs.readdirSync(LFW).map(n => ({ name: n, files: fs.readdirSync(path.join(LFW, n)).filter(f => f.endsWith('.jpg')).sort() }));
const many = shuffle(people.filter(p => p.files.length >= +MINPP)).slice(0, +NCAP);
const single = shuffle(people.filter(p => p.files.length <= 2 && !many.includes(p))).slice(0, +NDIS);
const items = [];
for (const p of many) for (const f of shuffle(p.files.slice()).slice(0, +MAXPP)) items.push({ id: p.name, file: `${p.name}/${f}`, distractor: false });
for (const p of single) items.push({ id: p.name, file: `${p.name}/${p.files[0]}`, distractor: true });
console.log(`persoane: ${many.length}, poze cu identitate: ${items.length - single.length}, distractori: ${single.length}`);

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.bin': 'application/octet-stream', '.onnx': 'application/octet-stream', '.wasm': 'application/wasm', '.mjs': 'text/javascript', '.webmanifest': 'application/json' };
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  let f = u.startsWith('/__lfw/') ? path.join(LFW, u.slice(7)) : path.join(APP, u === '/' ? 'index.html' : u);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
}).listen(0);

const PAGE_FN = async ({ url, seed }) => {
  const blob = await (await fetch(url)).blob(); const bmp = await createImageBitmap(blob);
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const base = mk(bmp.width, bmp.height); base.getContext('2d', { willReadFrequently: true }).drawImage(bmp, 0, 0);
  const flip = mk(base.width, base.height); { const x = flip.getContext('2d', { willReadFrequently: true }); x.translate(base.width, 0); x.scale(-1, 1); x.drawImage(base, 0, 0); }
  // variantă grea, aleasă determinist după seed
  let s = (Math.imul(seed, 2654435761) ^ 0x9e3779b9) >>> 0; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; rnd(); rnd(); rnd();
  const kinds = ['blur', 'dark', 'small', 'rot', 'mask', 'jpeg', 'glasses']; const kind = kinds[Math.floor(rnd() * kinds.length)];
  const W = base.width, H = base.height; let hard = mk(W, H); let x = hard.getContext('2d', { willReadFrequently: true });
  if (kind === 'blur') { x.filter = 'blur(2.2px)'; x.drawImage(base, 0, 0); }
  else if (kind === 'dark') { x.filter = 'brightness(0.45) contrast(0.8)'; x.drawImage(base, 0, 0); }
  else if (kind === 'small') { const k = 0.32; const t = mk(Math.round(W * k), Math.round(H * k)); t.getContext('2d').drawImage(base, 0, 0, t.width, t.height); x.imageSmoothingEnabled = true; x.drawImage(t, 0, 0, W, H); }
  else if (kind === 'rot') { const a = (rnd() < .5 ? -1 : 1) * (18 + rnd() * 14) * Math.PI / 180; x.fillStyle = '#777'; x.fillRect(0, 0, W, H); x.translate(W / 2, H / 2); x.rotate(a); x.drawImage(base, -W / 2, -H / 2); }
  else if (kind === 'mask') { x.drawImage(base, 0, 0); x.fillStyle = '#d8dde6'; x.fillRect(W * .30, H * .52, W * .40, H * .26); }
  else if (kind === 'glasses') { x.drawImage(base, 0, 0); x.fillStyle = '#111'; x.fillRect(W * .27, H * .36, W * .46, H * .09); }
  else { x.drawImage(base, 0, 0); const u = hard.toDataURL('image/jpeg', 0.12); const im = new Image(); im.src = u; await im.decode(); x.clearRect(0, 0, W, H); x.drawImage(im, 0, 0); }
  const run = async c => { const r = await detectFaces(null, false, c); const eo = []; for (const f of r.faces) { window.SFACE_BGR = false; const e = await sfaceEmbed(c, f.lm); let eb = null; if (window.WANT_BGR) { window.SFACE_BGR = true; eb = await sfaceEmbed(c, f.lm); } eo.push({ e, eb }); } return r.faces.map((f, i) => ({ lm: f.lm, e: eo[i].e ? Array.from(eo[i].e, v => +v.toFixed(5)) : null, eb: eo[i].eb ? Array.from(eo[i].eb, v => +v.toFixed(5)) : null, s: +f.s.toFixed(3), m: Math.round(f.m), x: Math.round(f.x), y: Math.round(f.y), w: Math.round(f.w), h: Math.round(f.h), d: Array.from(f.d, v => +v.toFixed(4)) })); };
  return { W, H, kind, orig: await run(base), flip: await run(flip), hard: await run(hard) };
};

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: process.env.GPU ? ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const port = server.address().port; const out = new Array(items.length); let next = 0, done = 0; const t0 = Date.now();
  const limit = process.env.LIMIT ? +process.env.LIMIT : items.length;
  async function worker(w) {
    const page = await (await browser.newContext()).newPage();
    page.on('pageerror', e => console.log('pageerror', e.message.slice(0, 120)));
    await page.goto(`http://localhost:${port}/`); await page.waitForFunction(() => typeof engineReady !== 'undefined' && engineReady, { timeout: 240000 });
    await page.addScriptTag({ url: '/engine/sface.js' }); await page.evaluate(() => { DLIB_DESCRIPTORS = true; }); await page.evaluate((b) => { window.WANT_BGR = b; return loadSFace(); }, !!process.env.BGR);
    for (;;) {
      const i = next++; if (i >= limit) return; const it = items[i];
      try { const r = await page.evaluate(PAGE_FN, { url: `/__lfw/${it.file}`, seed: 1000 + i }); out[i] = { ...it, ...r }; }
      catch (e) { out[i] = { ...it, error: e.message.slice(0, 100) }; }
      if (++done % 10 === 0) console.log(`${done}/${limit} · ${((Date.now() - t0) / 1000).toFixed(0)}s · ${(done / ((Date.now() - t0) / 1000)).toFixed(2)} poze/s`);
    }
  }
  await Promise.all(Array.from({ length: +WORKERS }, (_, w) => worker(w)));
  fs.writeFileSync(OUT, JSON.stringify(out.filter(Boolean)));
  console.log(`gata: ${out.filter(Boolean).length} poze în ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${OUT}`);
  await browser.close(); server.close();
})();
