// Încarcă descriptorii extrași (LFW) și construiește scenarii de test: referințe + album.
'use strict';
const fs = require('fs');
const { load } = require('../../tests/load.js');

function rng(seed) { let s = (seed ^ 0x9e3779b9) >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const shuffleWith = (r, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Fața principală dintr-o poză LFW: cea mai apropiată de centru, dintre cele suficient de mari.
const KEY = process.env.KEY || 'd';   // d = dlib (face-api), e = SFace
function primary(faces, W, H) {
  let best = null, bd = Infinity;
  for (const f of faces || []) {
    if (f.m < 24 || !f[KEY]) continue;
    const d = Math.hypot(f.x + f.w / 2 - W / 2, f.y + f.h / 2 - H / 2);
    if (d < bd) { bd = d; best = f; }
  }
  return best && { s: best.s, m: best.m, x: best.x, y: best.y, w: best.w, h: best.h, d: Float32Array.from(best[KEY]), dl: best.d ? Float32Array.from(best.d) : null };
}

function loadData(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const recs = raw.filter(r => !r.error).map((r, i) => ({
    i, id: r.id, file: r.file, distractor: r.distractor, kind: r.kind,
    orig: primary(r.orig, r.W, r.H), flip: primary(r.flip, r.W, r.H), hard: primary(r.hard, r.W, r.H),
    origAll: r.orig.filter(f => f[KEY]).map(f => ({ ...f, d: Float32Array.from(f[KEY]) })),
  }));
  const byId = new Map();
  for (const r of recs) if (!r.distractor) { if (!byId.has(r.id)) byId.set(r.id, []); byId.get(r.id).push(r); }
  return { recs, byId, persons: [...byId.keys()].filter(k => byId.get(k).length >= 6) };
}

// Un „album”: fiecare poză apare o dată, ca original sau (cu probabilitatea pHard) ca variantă degradată.
// Întoarce {entries:[{key, rec, face}], truth: Map(key→id|null)}
function buildAlbum(data, exclude, seed, pHard = .35) {
  const r = rng(seed), entries = [];
  for (const rec of data.recs) {
    if (exclude.has(rec.i)) continue;
    const useHard = !rec.distractor && r() < pHard;
    const face = useHard ? rec.hard : rec.orig;
    entries.push({ key: rec.file + (useHard ? '|hard' : ''), rec, variant: useHard ? 'hard' : 'orig', faces: face ? [face] : [], detected: !!face });
  }
  return entries;
}

module.exports = { rng, shuffleWith, loadData, buildAlbum, load, primary };
