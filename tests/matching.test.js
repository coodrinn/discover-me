'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { load, person, shot } = require('./load');
const m = load(['engine/matching.js'], ['descriptorDistance', 'faceScoreFast', 'classifyScore', 'matchPolicy', 'referenceSpread', 'MATCH_POLICIES']);

const alice = person(1), bob = person(2);
const refs = [shot(alice, 10), shot(alice, 11), shot(alice, 12)];

test('distanța: zero pentru același vector, infinit pentru lungimi diferite', () => {
  assert.equal(m.descriptorDistance(alice, alice), 0);
  assert.equal(m.descriptorDistance(alice, new Float32Array(64)), Infinity);
  assert.equal(m.descriptorDistance(null, alice), Infinity);
});

test('aceeași persoană este mult mai aproape decât persoane diferite', () => {
  assert.ok(m.descriptorDistance(refs[0], shot(alice, 20)) < .45);
  assert.ok(m.descriptorDistance(alice, bob) > .9);
});

test('faceScoreFast: aceeași persoană primește scor bun, altă persoană este respinsă', () => {
  const same = m.faceScoreFast({ d: shot(alice, 30) }, refs);
  assert.ok(same && same.best < .45 && same.support < .5, JSON.stringify(same));
  assert.equal(m.faceScoreFast({ d: shot(bob, 31) }, refs), null);
});

test('faceScoreFast: nevoie de cel puțin 2 referințe; scorul este media ponderată', () => {
  assert.equal(m.faceScoreFast({ d: alice }, [refs[0]]), null);
  const r = m.faceScoreFast({ d: shot(alice, 32) }, refs);
  assert.ok(Math.abs(r.score - (r.best * .35 + r.support * .65)) < 1e-9);
  assert.ok(r.best <= r.support);
});

test('faceScoreFast: ignoră referințele cu altă lungime', () => {
  assert.ok(m.faceScoreFast({ d: shot(alice, 33) }, [...refs, new Float32Array(10)]));
});

const strong = { best: .40, support: .45, faceScore: .9, faceSize: 100 };
test('classifyScore: strong / review / none', () => {
  const p = m.matchPolicy('precise');
  assert.equal(m.classifyScore(strong, p), 'strong');
  assert.equal(m.classifyScore({ ...strong, best: .52, support: .58 }, p), 'review');
  assert.equal(m.classifyScore({ ...strong, best: .70, support: .75 }, p), 'none');
});

test('classifyScore: o față mică sau nesigură nu poate fi „strong”, ci doar de verificat', () => {
  const p = m.matchPolicy('precise');
  assert.equal(m.classifyScore({ ...strong, faceSize: 30 }, p), 'review');
  assert.equal(m.classifyScore({ ...strong, faceScore: .5 }, p), 'review');
});

test('modul extins acceptă strict mai mult decât cel precis', () => {
  const row = { best: .49, support: .55, faceScore: .9, faceSize: 100 };
  assert.equal(m.classifyScore(row, m.matchPolicy('precise')), 'review');
  assert.equal(m.classifyScore(row, m.matchPolicy('extended')), 'strong');
  for (const k of ['strongBest', 'strongSupport', 'reviewBest', 'reviewSupport'])
    assert.ok(m.MATCH_POLICIES.extended[k] >= m.MATCH_POLICIES.precise[k]);
});

test('matchPolicy: un mod necunoscut cade pe precis', () => {
  assert.equal(m.matchPolicy('nimic'), m.MATCH_POLICIES.precise);
});

test('referenceSpread: mediana distanțelor; null pentru o singură referință', () => {
  assert.equal(m.referenceSpread([alice]), null);
  const s = m.referenceSpread(refs);
  assert.ok(s > .1 && s < .5, String(s));
});

// ===== Extinderea profilului =====
const ex = load(['engine/matching.js'], ['faceScoreFast', 'classifyScore', 'matchPolicy', 'expandSearch', 'levelOf', 'MATCH_POLICIES']);
const { rng } = require('./load');
// „Unghi”: aceeași persoană, deplasată pe o direcție fixă. t=0 e ca referințele; t mare = unghi tot mai diferit.
const dir = (() => { const r = rng(99); const v = Float32Array.from({ length: 128 }, () => r() - .5); const n = Math.hypot(...v); return v.map(x => x / n); })();
const atAngle = (base, t, seed) => { const moved = Float32Array.from(base, (x, i) => x + dir[i] * t * .7); return shot(moved, seed); };
const entryOf = (d, key, s = .95, size = 120) => ({ key, faces: [{ d, s, m: size }] });
function scoreAll(entries, refs) {
  return entries.map(e => { const rows = []; for (const f of e.faces) { const mm = ex.faceScoreFast(f, refs); if (mm) rows.push({ entry: e, ...mm, faceScore: f.s, faceSize: f.m, d: f.d }); } return rows; });
}
const levelsOf = (rows, policy) => rows.map(r => (r.length ? r.map(x => ex.levelOf(x, policy)).sort()[0] : 'none'));

test('extindere: aceeași persoană din alt unghi e adusă la „de verificat”, nu la „sigur”', () => {
  const p = person(5), other = person(6);
  const rf = [atAngle(p, 0, 1), atAngle(p, 0, 2), atAngle(p, 0, 3)];
  const entries = [];
  for (let i = 0; i < 8; i++) entries.push(entryOf(atAngle(p, .35, 100 + i), 'near' + i));      // unghi apropiat: „sigur”, devin seed-uri
  for (let i = 0; i < 6; i++) entries.push(entryOf(atAngle(p, .9, 200 + i), 'far' + i));        // unghi îndepărtat: prima trecere le ratează
  for (let i = 0; i < 8; i++) entries.push(entryOf(shot(other, 300 + i), 'other' + i));          // altă persoană
  const rows = scoreAll(entries, rf), policy = ex.matchPolicy('extended');
  const before = levelsOf(rows, policy);
  assert.equal(before.slice(8, 14).filter(l => l !== 'none').length, 0, 'prima trecere ratează unghiurile îndepărtate');

  const strongBefore = rows.map((r, i) => before[i] === 'strong' ? i : -1).filter(i => i >= 0);
  const added = ex.expandSearch(rows, rf, entries);
  const after = levelsOf(rows, policy);
  assert.ok(added >= 4, `extinderea a găsit ${added} fețe noi`);
  assert.ok(after.slice(8, 14).filter(l => l === 'review').length >= 4, 'unghiurile îndepărtate apar la „de verificat”');
  assert.equal(after.slice(8, 14).filter(l => l === 'strong').length, 0, 'extinderea nu produce „sigur”');
  assert.deepEqual(rows.map((r, i) => after[i] === 'strong' ? i : -1).filter(i => i >= 0), strongBefore, 'lista „sigure” rămâne identică');
  assert.equal(after.slice(14).filter(l => l !== 'none').length, 0, 'altă persoană nu e adusă de extindere');
});

test('extindere: fără fețe foarte sigure nu se întâmplă nimic', () => {
  const p = person(7), rf = [atAngle(p, 0, 1), atAngle(p, 0, 2), atAngle(p, 0, 3)];
  const entries = [entryOf(shot(person(8), 1), 'a'), entryOf(atAngle(p, .9, 2), 'b')];
  const rows = scoreAll(entries, rf);
  assert.equal(ex.expandSearch(rows, rf, entries), 0);
});

test('extindere: nu folosește fețe mici sau nesigure ca referințe', () => {
  const p = person(9), rf = [atAngle(p, 0, 1), atAngle(p, 0, 2), atAngle(p, 0, 3)];
  const entries = [];
  for (let i = 0; i < 6; i++) entries.push(entryOf(atAngle(p, .35, 400 + i), 'tiny' + i, .95, 30));   // aproape de ref, dar prea mici
  entries.push(entryOf(atAngle(p, .9, 500), 'far'));
  const rows = scoreAll(entries, rf);
  assert.equal(ex.expandSearch(rows, rf, entries), 0);
});

test('extindere: „expanded” nu poate deveni „strong”, nici cu praguri largi', () => {
  const row = { expanded: true, best: .30, support: .35, faceScore: .9, faceSize: 100 };
  assert.equal(ex.levelOf(row, ex.matchPolicy('extended')), 'review');
  assert.equal(ex.levelOf({ ...row, expanded: false }, ex.matchPolicy('extended')), 'strong');
});
