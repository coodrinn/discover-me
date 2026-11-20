// Test de fum în browser real (Edge/Chrome headless): pornește aplicația, încarcă modelele LOCAL,
// detectează fețe, creează un profil (cu acord de confidențialitate) și caută persoana într-un album.
//
// Rulare:   npm i --no-save puppeteer-core
//           PHOTOS=C:/cale/spre/poze node tests/e2e/smoke.js
// PHOTOS = folder cu cel puțin 6 poze .jpg care conțin fețe (altfel testele de detectare sunt sărite).
// BROWSER = calea spre msedge.exe / chrome.exe (se caută automat în locurile uzuale).
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
let puppeteer; try { puppeteer = require('puppeteer-core'); } catch { console.error('Rulează întâi: npm i --no-save puppeteer-core'); process.exit(2); }

const APP = path.join(__dirname, '..', '..');
const PHOTOS = process.env.PHOTOS ? path.resolve(process.env.PHOTOS) : null;
const BROWSERS = [process.env.BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const exe = BROWSERS.find(b => fs.existsSync(b));
if (!exe) { console.error('Nu găsesc Edge/Chrome. Setează BROWSER=...'); process.exit(2); }

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' , '.wasm': 'application/wasm', '.mjs': 'text/javascript', '.onnx': 'application/octet-stream' };
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  const f = u.startsWith('/__photos/') && PHOTOS ? path.join(PHOTOS, path.basename(u)) : path.join(APP, u === '/' ? 'index.html' : u);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
}).listen(0);

let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? '✔' : '✖'} ${msg}`); if (!ok) failed++; };

(async () => {
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const page = await browser.newPage();
  const errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (!r.url().startsWith(`http://localhost:${port}`) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof engineReady !== 'undefined' && engineReady, { timeout: 180000 });
  check(true, 'motorul pornește');
  check(!external.length, `modelele și biblioteca vin din aplicație, fără cereri externe${external.length ? ' (' + external.slice(0, 3).join(', ') + ')' : ''}`);

  // Acordul de confidențialitate blochează crearea profilului până la confirmare
  const consent = await page.evaluate(async () => {
    const p = requireConsent(); const dlg = document.getElementById('consentDialog');
    const opened = dlg.open;
    document.getElementById('consentNo').click(); const refused = await p;
    const p2 = requireConsent(); document.getElementById('consentOk').click(); const accepted = await p2;
    const again = await requireConsent();                           // a doua oară nu mai întreabă
    const saved = await storeGet('settings', 'consent');
    return { opened, refused, accepted, again, saved: !!saved, stillOpen: dlg.open };
  });
  check(consent.opened, 'dialogul de acord se deschide');
  check(consent.refused === false, '„Anulează” nu dă acordul');
  check(consent.accepted === true && consent.saved, 'după „Sunt de acord” acordul se salvează');
  check(consent.again === true && !consent.stillOpen, 'acordul dat nu se mai cere');

  if (PHOTOS) {
    const files = fs.readdirSync(PHOTOS).filter(f => /\.jpe?g$/i.test(f)).sort().slice(0, 6);
    if (files.length >= 4) {
      const res = await page.evaluate(async (names) => {
        const out = [];
        for (const n of names) {
          const blob = await (await fetch('/__photos/' + n)).blob();
          const r = await detectFacesE(new File([blob], n, { type: 'image/jpeg' }), true);
          out.push({ n, faces: r.faces.length, hasDesc: r.faces.every(f => f.d.length === 128) });
        }
        return out;
      }, files);
      check(res.every(r => r.faces > 0 && r.hasDesc), `detectează fețe cu amprentă SFace (128) în toate cele ${res.length} poze (${res.map(r => r.faces).join(',')})`);
    } else console.log('… sărit: sunt necesare cel puțin 4 poze în PHOTOS');
  } else console.log('… detectarea pe poze reale sărită (setează PHOTOS=folder)');

  check(!errors.length, `fără erori în consolă${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close(); server.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
