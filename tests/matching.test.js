'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { load, sfacePerson, shot, rng } = require('./load');
const m = load(['engine/matching.js'], ['descriptorDistance', 'faceScoreFast', 'classifyScore', 'matchPolicy', 'matchProb', 'referenceSpread', 'MATCH_POLICIES', 'MATCH_MODEL', 'REF_SPREAD_WARN', 'expandSearch', 'levelOf']);

const alice = sfacePerson(1), bob = sfacePerson(2);
const refs = [shot(alice, 10), shot(alice, 11), shot(alice, 12)];

test('distanța: zero pentru același vector, infinit pentru lungimi diferite', () => {
  assert.equal(m.descriptorDistance(alice, alice), 0);
  assert.equal(m.descriptorDistance(alice, new Float32Array(64)), Infinity);
  assert.equal(m.descriptorDistance(null, alice), Infinity);
});

test('aceeași persoană este mult mai aproape decât persoane diferite', () => {
  assert.ok(m.descriptorDistance(refs[0], shot(alice, 20)) < .45);
  assert.ok(m.descriptorDistance(alice, bob) > 1.1);
});

test('matchProb: scade cu distanța, crește cu mărimea feței, 0 dincolo de maxD', () => {
  const p = (d, size = 100) => m.matchProb(d, d, size);
  assert.ok(p(.6) > .999);
  assert.ok(p(.9) > p(1.0) && p(1.0) > p(1.1));
  assert.ok(p(1.0, 160) > p(1.0, 40));
  assert.ok(p(1.2) < .05);
  assert.equal(m.matchProb(1.3, 1.3, 100), 0);
});

test('matchProb: la 0,7 e sigur, iar în jur de 1,05 e aproape de jumătate', () => {
  assert.ok(m.matchProb(.7, .7, 100) >= .999);
  const half = m.matchProb(1.05, 1.05, 100);
  assert.ok(half > .3 && half < .8, String(half));
});

test('faceScoreFast: aceeași persoană primește probabilitate mare, altă persoană este respinsă', () => {
  const same = m.faceScoreFast({ d: shot(alice, 30), m: 100 }, refs);
  assert.ok(same && same.best < .45 && same.prob > .999, JSON.stringify(same));
  assert.equal(m.faceScoreFast({ d: shot(bob, 31), m: 100 }, refs), null);
});

test('faceScoreFast: nevoie de cel puțin 2 referințe; scorul este media ponderată', () => {
  assert.equal(m.faceScoreFast({ d: alice }, [refs[0]]), null);
  const r = m.faceScoreFast({ d: shot(alice, 32), m: 100 }, refs);
  assert.ok(Math.abs(r.score - (r.best * .35 + r.support * .65)) < 1e-9);
  assert.ok(r.best <= r.support);
});

test('faceScoreFast: ignoră referințele cu altă lungime', () => {
  assert.ok(m.faceScoreFast({ d: shot(alice, 33), m: 100 }, [...refs, new Float32Array(10)]));
});

const row = (d, extra = {}) => ({ best: d, support: d, faceScore: .9, faceSize: 100, ...extra });
test('classifyScore: strong / review / none', () => {
  const p = m.matchPolicy('precise');
  assert.equal(m.classifyScore(row(.7), p), 'strong');
  assert.equal(m.classifyScore(row(1.04), p), 'review');
  assert.equal(m.classifyScore(row(1.15), p), 'none');
});

test('classifyScore: o față mică sau nesigură nu poate fi „strong”, ci doar de verificat', () => {
  const p = m.matchPolicy('precise');
  assert.equal(m.classifyScore(row(.7, { faceSize: 30 }), p), 'review');
  assert.equal(m.classifyScore(row(.7, { faceScore: .4 }), p), 'review');
  assert.equal(m.classifyScore(row(.7, { faceSize: 20 }), p), 'none');
});

test('modul extins acceptă strict mai mult decât cel precis', () => {
  const r = row(.985);   // P ≈ 0,96: sub pragul precis (0,97), peste cel extins (0,95)
  assert.equal(m.classifyScore(r, m.matchPolicy('precise')), 'review');
  assert.equal(m.classifyScore(r, m.matchPolicy('extended')), 'strong');
  const e = m.MATCH_POLICIES.extended, pr = m.MATCH_POLICIES.precise;
  assert.ok(e.strongP <= pr.strongP && e.reviewP <= pr.reviewP && e.strongMinSize <= pr.strongMinSize && e.reviewMinSize <= pr.reviewMinSize);
});

test('matchPolicy: un mod necunoscut cade pe precis', () => {
  assert.equal(m.matchPolicy('nimic'), m.MATCH_POLICIES.precise);
});

test('referenceSpread: mediana distanțelor; null pentru o singură referință', () => {
  assert.equal(m.referenceSpread([alice]), null);
  const s = m.referenceSpread(refs);
  assert.ok(s > .1 && s < .5, String(s));
});

test('avertismentul „referințe diferite”: nu apare pentru aceeași persoană, apare când una e altcineva', () => {
  assert.ok(m.referenceSpread(refs) < m.REF_SPREAD_WARN);
  assert.ok(m.referenceSpread([refs[0], refs[1], shot(bob, 5)]) > m.REF_SPREAD_WARN);
});

// ===== Extinderea profilului =====
// „Unghi”: aceeași persoană, deplasată pe o direcție fixă. shift=0 e ca referințele; shift mare = unghi tot mai diferit.
const dir = (() => { const r = rng(99); const v = Float32Array.from({ length: 128 }, () => r() - .5); const n = Math.hypot(...v); return v.map(x => x / n); })();
const atAngle = (base, shift, seed) => shot(Float32Array.from(base, (x, i) => x + dir[i] * shift), seed);
const entryOf = (d, key, s = .95, size = 120) => ({ key, faces: [{ d, s, m: size }] });
function scoreAll(entries, rs) {
  return entries.map(e => { const rows = []; for (const f of e.faces) { const mm = m.faceScoreFast(f, rs); if (mm) rows.push({ entry: e, ...mm, faceScore: f.s, faceSize: f.m, d: f.d }); } return rows; });
}
const levelsOf = (rows, policy) => rows.map(r => (r.length ? r.map(x => m.levelOf(x, policy)).sort()[0] : 'none'));

test('extindere: aceeași persoană din alt unghi e adusă la „de verificat”, nu la „sigur”', () => {
  const p = sfacePerson(5), other = sfacePerson(6);
  const rf = [atAngle(p, 0, 1), atAngle(p, 0, 2), atAngle(p, 0, 3)];
  const entries = [];
  for (let i = 0; i < 8; i++) entries.push(entryOf(atAngle(p, .30, 100 + i), 'near' + i));      // unghi apropiat: „sigur”, devin seed-uri
  for (let i = 0; i < 6; i++) entries.push(entryOf(atAngle(p, 1.10, 200 + i), 'far' + i));      // unghi îndepărtat: prima trecere le ratează
  for (let i = 0; i < 8; i++) entries.push(entryOf(shot(other, 300 + i), 'other' + i));          // altă persoană
  const rows = scoreAll(entries, rf), policy = m.matchPolicy('extended');
  const before = levelsOf(rows, policy);
  assert.equal(before.slice(8, 14).filter(l => l !== 'none').length, 0, 'prima trecere ratează unghiurile îndepărtate');
  assert.equal(before.slice(0, 8).filter(l => l === 'strong').length, 8);

  const strongBefore = rows.map((r, i) => before[i] === 'strong' ? i : -1).filter(i => i >= 0);
  const added = m.expandSearch(rows, rf, entries);
  const after = levelsOf(rows, policy);
  assert.ok(added >= 4, `extinderea a găsit ${added} fețe noi`);
  assert.ok(after.slice(8, 14).filter(l => l === 'review').length >= 4, 'unghiurile îndepărtate apar la „de verificat”');
  assert.equal(after.slice(8, 14).filter(l => l === 'strong').length, 0, 'extinderea nu produce „sigur”');
  assert.deepEqual(rows.map((r, i) => after[i] === 'strong' ? i : -1).filter(i => i >= 0), strongBefore, 'lista „sigure” rămâne identică');
  assert.equal(after.slice(14).filter(l => l !== 'none').length, 0, 'altă persoană nu e adusă de extindere');
});

test('extindere: fără fețe foarte sigure nu se întâmplă nimic', () => {
  const p = sfacePerson(7), rf = [atAngle(p, 0, 1), atAngle(p, 0, 2), atAngle(p, 0, 3)];
  const entries = [entryOf(shot(sfacePerson(8), 1), 'a'), entryOf(atAngle(p, 1.1, 2), 'b')];
  const rows = scoreAll(entries, rf);
  assert.equal(m.expandSearch(rows, rf, entries), 0);
});

test('extindere: nu folosește fețe mici sau nesigure ca referințe', () => {
  const p = sfacePerson(9), rf = [atAngle(p, 0, 1), atAngle(p, 0, 2), atAngle(p, 0, 3)];
  const entries = [];
  for (let i = 0; i < 6; i++) entries.push(entryOf(atAngle(p, .30, 400 + i), 'tiny' + i, .95, 30));   // aproape de ref, dar prea mici
  entries.push(entryOf(atAngle(p, 1.1, 500), 'far'));
  const rows = scoreAll(entries, rf);
  assert.equal(m.expandSearch(rows, rf, entries), 0);
});

test('extindere: „expanded” nu poate deveni „strong”, nici cu praguri largi', () => {
  const r = { expanded: true, best: .60, support: .65, faceScore: .9, faceSize: 100 };
  assert.equal(m.levelOf(r, m.matchPolicy('extended')), 'review');
  assert.equal(m.levelOf({ ...r, expanded: false }, m.matchPolicy('extended')), 'strong');
});
