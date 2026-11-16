'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { load, person, shot } = require('./load');
const c = load(['engine/matching.js', 'engine/clusters.js'], ['clusterAlbumFaces']);

// Un album sintetic: fiecare poză are o cheie și fețe {s: încredere, m: mărime, d: descriptor}
const face = d => ({ s: .95, m: 120, x: 0, y: 0, w: 120, h: 120, d });
function album(spec) {            // spec: [[persoană, nrPoze], ...]
  const entries = []; let seed = 100;
  for (const [base, n] of spec) for (let i = 0; i < n; i++) entries.push({ key: `p${seed}`, faces: [face(shot(base, seed++))] });
  return entries;
}
const names = [person(1), person(2), person(3)];

test('separă persoanele diferite în grupuri distincte', async () => {
  const groups = await c.clusterAlbumFaces(album([[names[0], 8], [names[1], 5], [names[2], 4]]));
  assert.equal(groups.length, 3);
  assert.deepEqual([...groups.map(g => g.photos)], [8, 5, 4]);          // sortate după nr. de poze
});

test('ignoră persoanele care apar în mai puțin de 3 poze', async () => {
  const groups = await c.clusterAlbumFaces(album([[names[0], 6], [names[1], 2]]));
  assert.equal(groups.length, 1);
});

test('ignoră fețele mici sau cu încredere mică', async () => {
  const entries = [];
  for (let i = 0; i < 6; i++) entries.push({ key: `a${i}`, faces: [{ ...face(shot(names[0], 200 + i)), m: 20 }] });
  for (let i = 0; i < 6; i++) entries.push({ key: `b${i}`, faces: [{ ...face(shot(names[1], 300 + i)), s: .4 }] });
  assert.equal((await c.clusterAlbumFaces(entries)).length, 0);
});

test('o poză cu aceeași față de mai multe ori numără ca o singură poză', async () => {
  const e = { key: 'x', faces: [face(shot(names[0], 1)), face(shot(names[0], 2)), face(shot(names[0], 3))] };
  assert.equal((await c.clusterAlbumFaces([e])).length, 0);
});

test('fiecare grup are reprezentanți din poze diferite și o copertă', async () => {
  const [g] = await c.clusterAlbumFaces(album([[names[0], 12]]));
  assert.ok(g.cover && g.reps.length >= 3 && g.reps.length <= 10);
  assert.equal(new Set(g.reps.map(r => r.e.key)).size, g.reps.length);
});

test('raportează progresul până la 1', async () => {
  const seen = []; await c.clusterAlbumFaces(album([[names[0], 5]]), p => seen.push(p));
  assert.equal(seen.at(-1), 1);
});
