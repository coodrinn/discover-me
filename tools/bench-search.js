// Măsoară cât durează căutarea și gruparea pe albume mari (date sintetice, doar CPU).
// Rulare: node tools/bench-search.js [nrPoze=50000]
'use strict';
const { load, person, shot, rng } = require('../tests/load');
const m = load(['engine/matching.js', 'engine/clusters.js'], ['faceScoreFast', 'classifyScore', 'matchPolicy', 'clusterAlbumFaces']);

const photos = Number(process.argv[2]) || 50000, r = rng(7);
const people = Array.from({ length: 200 }, (_, i) => person(1000 + i));
const entries = Array.from({ length: photos }, (_, i) => ({
  key: 'k' + i,
  faces: Array.from({ length: 1 + (r() < .5 ? 1 : 0) + (r() < .2 ? 1 : 0) }, () => ({ s: .95, m: 100, x: 0, y: 0, w: 100, h: 100, d: shot(people[Math.floor(r() * people.length)], Math.floor(r() * 1e9)) }))
}));
const faces = entries.reduce((n, e) => n + e.faces.length, 0);
console.log(`${photos} poze, ${faces} fețe, ${(faces * 128 * 4 / 1048576).toFixed(0)} MB de descriptori`);

const refs = [0, 1, 2].map(i => shot(people[0], 50 + i));
let t = performance.now(), strong = 0;
for (const e of entries) for (const f of e.faces) { const s = m.faceScoreFast(f, refs); if (s && m.classifyScore({ ...s, faceScore: f.s, faceSize: f.m }, m.matchPolicy('precise')) === 'strong') strong++; }
console.log(`căutare după o persoană: ${(performance.now() - t).toFixed(0)} ms (${strong} potriviri puternice)`);

(async () => {
  t = performance.now();
  const groups = await m.clusterAlbumFaces(entries);
  console.log(`„Cine apare în album?”: ${(performance.now() - t).toFixed(0)} ms, ${groups.length} grupuri (plafon intern: 6000 fețe)`);
})();
