// Evaluare căutare: 3 referințe (poze normale) -> caută în albumul cu tot restul (normal + degradat + străini).
// Rulare: node eval_search.js lfw_desc.json [trials=3] [algo=current]
'use strict';
const { loadData, buildAlbum, shuffleWith, rng, load } = require('./harness');
const path = require('path');
const [FILE, TRIALS = 3, ALGO = 'current'] = process.argv.slice(2);
const data = loadData(FILE);

const algos = require('./algos');
const A = algos[ALGO];
if (!A) { console.error('algo necunoscut', Object.keys(algos)); process.exit(1); }

const people = data.persons;
let tp = { strong: 0, review: 0 }, fp = { strong: 0, review: 0 }, pos = 0, posDetected = 0, searches = 0, strongWrongSearches = 0;
const perKind = {};   // recall pe tipuri de degradare
const wrongList = [];
for (let t = 0; t < +TRIALS; t++) {
  const r = rng(100 + t);
  for (const pid of people) {
    const recs = data.byId.get(pid).filter(x => x.orig);
    if (recs.length < 5) continue;
    const refRecs = shuffleWith(r, recs).slice(0, 3), exclude = new Set(refRecs.map(x => x.i));
    const refs = refRecs.map(x => x.orig.d);
    const album = buildAlbum(data, exclude, 7000 + t * 1000 + people.indexOf(pid));
    const res = A.search(refs, album, refRecs.map(x => x.orig));      // [{entry, level:'strong'|'review'|'none', score}]
    searches++;
    let wrongStrong = 0;
    for (let k = 0; k < album.length; k++) {
      const e = album[k], isPos = !e.rec.distractor && e.rec.id === pid, lvl = res[k].level;
      if (isPos) { pos++; if (e.detected) posDetected++; const kk = e.variant === 'hard' ? e.rec.kind : 'orig'; (perKind[kk] ||= { n: 0, strong: 0, any: 0 }).n++; if (lvl === 'strong') { perKind[kk].strong++; perKind[kk].any++ } else if (lvl === 'review') perKind[kk].any++; }
      if (lvl === 'strong') { if (isPos) tp.strong++; else { fp.strong++; wrongStrong++; if (wrongList.length < 12) wrongList.push(`${pid} <- ${e.rec.id}${e.variant === 'hard' ? '(' + e.rec.kind + ')' : ''} score=${res[k].score?.toFixed(3)}`); } }
      if (lvl === 'strong' || lvl === 'review') { if (isPos) tp.review++; else fp.review++; }
    }
    if (wrongStrong) strongWrongSearches++;
  }
}
const pct = x => (100 * x).toFixed(1) + '%';
console.log(`algo=${ALGO}  căutări=${searches}  poze-țintă=${pos} (detectate ${pct(posDetected / pos)})`);
console.log(`SIGURE      : recall ${pct(tp.strong / pos)}  precizie ${pct(tp.strong / Math.max(1, tp.strong + fp.strong))}  greșite/căutare ${(fp.strong / searches).toFixed(2)}  căutări cu ≥1 greșeală sigură ${pct(strongWrongSearches / searches)}`);
console.log(`SIGURE+VERIF: recall ${pct(tp.review / pos)}  precizie ${pct(tp.review / Math.max(1, tp.review + fp.review))}  greșite/căutare ${(fp.review / searches).toFixed(2)}`);
console.log('recall pe tip (sigure | sigure+verif):', Object.entries(perKind).map(([k, v]) => `${k} ${pct(v.strong / v.n)}|${pct(v.any / v.n)}`).join('  '));
if (process.env.SHOWWRONG) console.log(wrongList.join('\n'));
