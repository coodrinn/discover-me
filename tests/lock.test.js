'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { load } = require('./load');
const { lockAlbumGroups } = load(['engine/clusters.js'], ['lockAlbumGroups']);

const groups = [31, 22, 17, 9, 5].map(n => ({ photos: n }));
const none = () => null, yes = () => true;

test('plan Gratuit (1 persoană): se vede doar cea mai frecventă, restul sunt blocate', () => {
  const r = lockAlbumGroups(groups, { limit: 1, savedCount: 0, knownFor: none, isUnlocked: yes });
  assert.deepEqual(r.map(x => x.locked), [false, true, true, true, true]);
});
test('plan Gratuit cu o persoană deja salvată: nicio persoană nouă nu mai e vizibilă', () => {
  const r = lockAlbumGroups(groups, { limit: 1, savedCount: 1, knownFor: none, isUnlocked: yes });
  assert.ok(r.every(x => x.locked));
});
test('persoana salvată rămâne vizibilă, iar restul rămân blocate', () => {
  const ana = { id: 'a', name: 'Ana' };
  const r = lockAlbumGroups(groups, { limit: 1, savedCount: 1, knownFor: g => (g.photos === 22 ? ana : null), isUnlocked: yes });
  assert.deepEqual(r.map(x => x.locked), [true, false, true, true, true]);
  assert.equal(r[1].known, ana);
});
test('persoană salvată dar peste planul curent (abonament expirat): apare blocată', () => {
  const ana = { id: 'a', name: 'Ana' };
  const r = lockAlbumGroups(groups, { limit: 1, savedCount: 3, knownFor: g => (g.photos === 31 ? ana : null), isUnlocked: () => false });
  assert.equal(r[0].locked, true);
  assert.equal(r[0].known, ana);
});
test('plan Plus (3): primele 3 persoane noi sunt vizibile', () => {
  const r = lockAlbumGroups(groups, { limit: 3, savedCount: 0, knownFor: none, isUnlocked: yes });
  assert.deepEqual(r.map(x => x.locked), [false, false, false, true, true]);
});
test('plan Pro (nelimitat): nimic nu e blocat', () => {
  const r = lockAlbumGroups(groups, { limit: Infinity, savedCount: 7, knownFor: none, isUnlocked: yes });
  assert.ok(r.every(x => !x.locked));
});
