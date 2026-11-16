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
