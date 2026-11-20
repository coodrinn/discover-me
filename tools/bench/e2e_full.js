// Test complet în aplicația reală (Edge): album din poze LFW -> indexare -> „Cine apare în album?” cu blocări -> profil din 3 poze -> căutare.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const APP = path.resolve(__dirname, '..', '..');
const LFW = path.resolve(process.env.LFW_DIR || path.join(__dirname, 'lfw', 'lfw'));
const OUT = process.argv[2] || require('os').tmpdir();
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.bin': 'application/octet-stream', '.onnx': 'application/octet-stream', '.wasm': 'application/wasm', '.mjs': 'text/javascript', '.webmanifest': 'application/json' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(APP, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);

function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
const R = rng(2024), shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const people = fs.readdirSync(LFW).map(n => ({ n, f: fs.readdirSync(path.join(LFW, n)).filter(x => x.endsWith('.jpg')) }));
const targets = shuffle(people.filter(p => p.f.length >= 18)).slice(0, 6);
const strangers = shuffle(people.filter(p => p.f.length === 1)).slice(0, 40);
const album = [], refsOf = {};
for (const t of targets) { const fs_ = shuffle(t.f); refsOf[t.n] = fs_.slice(0, 3).map(x => path.join(LFW, t.n, x)); for (const x of fs_.slice(3, 18)) album.push(path.join(LFW, t.n, x)); }
for (const s of strangers) album.push(path.join(LFW, s.n, s.f[0]));
console.log(`album: ${album.length} poze (${targets.length} persoane × 15 + ${strangers.length} străini). Persoane: ${targets.map(t => t.n).join(', ')}`);

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('C:' + m.text().slice(0, 160)); });
  const t0 = Date.now(); await page.goto(`http://localhost:${server.address().port}/`);
  for (let i = 0; i < 8; i++) { const b = await page.$('.intro-btn:visible'); if (!b) break; await b.click().catch(() => { }); await page.waitForTimeout(400); }
  await page.waitForFunction(() => typeof engineReady !== 'undefined' && engineReady, { timeout: 240000 });
  console.log(`motor pornit în ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // 1) albumul
  await page.setInputFiles('#photosFallback', album);
  const ti = Date.now();
  await page.waitForFunction(() => document.querySelector('.page.active')?.id === 'page-people' && document.querySelectorAll('#afGrid .af-card').length > 0, { timeout: 600000 });
  console.log(`indexare + grupare: ${((Date.now() - ti) / 1000).toFixed(0)}s`);
  await page.waitForTimeout(1500);
  const af = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#afGrid .af-card')];
    return { total: cards.length, locked: cards.filter(c => c.classList.contains('locked')).length, imgsInLocked: cards.filter(c => c.classList.contains('locked')).reduce((n, c) => n + c.querySelectorAll('img').length, 0),
      unlockedWithForm: cards.filter(c => !c.classList.contains('locked') && c.querySelector('form')).length, note: document.getElementById('afLockNote').hidden ? '(ascuns)' : document.getElementById('afLockText').textContent,
      photos: albumGroups.map(g => g.photos), indexed: indexedEntries.length, faces: indexedEntries.reduce((n, e) => n + e.faces.length, 0) };
  });
  console.log('grupuri în album:', JSON.stringify(af));
  await page.evaluate(() => document.getElementById('albumFacesCard').scrollIntoView()); await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/shots/e2e-groups.png` });

  // 2) corectitudinea grupurilor: ce persoană e în fiecare grup (după numele fișierului)
  const grp = await page.evaluate(() => albumGroups.map(g => { const c = {}; for (const it of g.items) { const n = it.e.path.split('/').pop().replace(/_\d+\.jpg$/i, ''); c[n] = (c[n] || 0) + 1; } return c; }));
  grp.forEach((c, i) => { const tot = Object.values(c).reduce((a, b) => a + b, 0), [n, k] = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; console.log(`  grup ${i + 1}: ${tot} fețe, majoritar ${n} (${(100 * k / tot).toFixed(0)}%)${Object.keys(c).length > 1 ? ' amestec: ' + JSON.stringify(c) : ''}`); });

  // 3) profil din 3 poze + căutare, pentru prima persoană țintă
  // tutorialul de la prima pornire acoperă aplicația: îl sărim
  for (let i = 0; i < 6; i++) { const vis = await page.evaluate(() => { const e = document.getElementById('intro'); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }); if (!vis) break; await page.click('.intro-btn', { timeout: 3000 }).catch(() => page.evaluate(() => document.getElementById('introSkip')?.click())); await page.waitForTimeout(600); }
  console.log('intro vizibil:', await page.evaluate(() => { const e = document.getElementById('intro'); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }));
  const who = targets[0].n;
  await page.evaluate(() => { navigate('people'); document.getElementById('manualPerson').open = true; document.getElementById('manualPerson').scrollIntoView(); });
  await page.waitForTimeout(800);
  console.log('pagina activă:', await page.evaluate(() => document.querySelector('.page.active').id + ' | details open=' + document.getElementById('manualPerson').open + ' | #personName vizibil=' + (document.getElementById('personName').offsetParent !== null)));
  await page.screenshot({ path: `${OUT}/shots/e2e-before-fill.png` });
  await page.fill('#personName', who);
  await page.setInputFiles('#referenceFiles', refsOf[who]);
  await page.waitForFunction(() => !document.getElementById('savePerson').disabled, { timeout: 120000 });
  console.log('referințe:', await page.evaluate(() => document.getElementById('referenceCount').textContent + ' | ' + document.getElementById('refStatus').textContent));
  await page.click('#savePerson'); await page.waitForTimeout(800);
  if (await page.evaluate(() => document.getElementById('consentDialog').open)) { await page.click('#consentOk'); await page.waitForTimeout(800); }
  await page.waitForFunction(() => people.length === 1, { timeout: 20000 });
  console.log('profil salvat:', await page.evaluate(() => people.map(p => p.name + ' model=' + p.model + ' refs=' + p.descs.length).join(';')));
  await page.evaluate(() => navigate('search')); await page.waitForTimeout(500);
  await page.evaluate(() => { selectPerson(people[0].id); });
  await page.waitForFunction(() => !document.getElementById('searchPageRun').disabled, { timeout: 30000 });
  await page.evaluate(() => runSearch());      // butonul „Caută din nou” e ascuns: căutarea pornește singură la alegerea persoanei
  await page.waitForFunction(() => allHits && allHits.length > 0, { timeout: 120000 });
  await page.waitForTimeout(1500);
  const res = await page.evaluate((who) => {
    const norm = h => h.entry.path.split('/').pop().replace(/_\d+\.jpg$/i, '');
    const strong = allHits.filter(h => h.level === 'strong'), review = allHits.filter(h => h.level !== 'strong');
    return { strong: strong.length, strongOk: strong.filter(h => norm(h) === who).length, review: review.length, reviewOk: review.filter(h => norm(h) === who).length, wrongStrong: strong.filter(h => norm(h) !== who).map(h => norm(h) + ' p=' + (h.score || 0).toFixed(2)) };
  }, who);
  console.log(`căutare „${who}” (15 poze în album): sigure ${res.strong} (corecte ${res.strongOk}), de verificat ${res.review} (corecte ${res.reviewOk}), greșite sigure: ${JSON.stringify(res.wrongStrong)}`);
  await page.screenshot({ path: `${OUT}/shots/e2e-search.png` });
  console.log('erori:', errs.filter(e => !/onnxruntime/.test(e)).slice(0, 6));
  await browser.close(); server.close();
})().catch(e => { console.error('EȘEC', e.message.slice(0, 400)); process.exit(1); });
