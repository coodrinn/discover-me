// Antrenează regula „probabilitate că e aceeași persoană” (regresie logistică pe d1, d2, q), cu validare încrucișată pe persoane.
// KEY=e node fit_model.js lfw_both.json [trials=2] [features=d1,d2,q]
'use strict';
const { loadData, buildAlbum, shuffleWith, rng } = require('./harness');
const F = require('./features');
const [FILE, TRIALS = 2, FEATS = 'd1,d2,q'] = process.argv.slice(2);
const names = FEATS.split(',');
const PRE = +process.env.PRE || 1.2;
const data = loadData(FILE);

const rows = [];
let totalPos = 0;
for (let t = 0; t < +TRIALS; t++) {
  const r = rng(300 + t);
  for (const pid of data.persons) {
    const recs = data.byId.get(pid).filter(x => x.orig);
    if (recs.length < 5) continue;
    const refRecs = shuffleWith(r, recs).slice(0, 3), ex = new Set(refRecs.map(x => x.i));
    const refs = refRecs.map(x => x.orig.d);
    const album = buildAlbum(data, ex, 4000 + t * 1000 + data.persons.indexOf(pid));
    for (const e of album) {
      const y = (!e.rec.distractor && e.rec.id === pid) ? 1 : 0;
      if (y) totalPos++;
      if (!e.faces.length) continue;
      const f = F.features(refs, e.faces[0]);
      if (f.d1 > PRE) continue;
      rows.push({ pid, y, x: names.map(n => f[n]), kind: e.variant === 'hard' ? e.rec.kind : 'orig' });
    }
  }
}
console.log(`rânduri ${rows.length}, pozitive totale ${totalPos} (în rânduri: ${rows.filter(r => r.y).length})`);

const persons = [...new Set(rows.map(r => r.pid))], fold = new Map();
shuffleWith(rng(1), persons).forEach((p, i) => fold.set(p, i % 5));
const oof = [];
for (let k = 0; k < 5; k++) {
  const tr = rows.filter(r => fold.get(r.pid) !== k), te = rows.filter(r => fold.get(r.pid) === k);
  const m = F.trainLogistic(tr.map(r => r.x), tr.map(r => r.y), { l2: 1e-5 });
  for (const r of te) oof.push({ y: r.y, p: F.predict(m, r.x), kind: r.kind, pid: r.pid });
}
const T = [.5, .8, .9, .95, .98, .99, .995, .999];
console.log('prag P  | precizie | recall | greșite/căutare | căutări cu ≥1 greșeală');
const nSearch = +TRIALS * data.persons.length;
for (const t of T) {
  const sel = oof.filter(x => x.p >= t), tp = sel.filter(x => x.y).length, fp = sel.length - tp;
  const wrongSearches = new Set(sel.filter(x => !x.y).map(x => x.pid)).size;   // aproximare: persoane (nu căutări) cu ≥1 greșeală
  console.log(`${String(t).padEnd(7)} | ${(100 * tp / Math.max(1, sel.length)).toFixed(2)}% | ${(100 * tp / totalPos).toFixed(1)}% | ${(fp / nSearch).toFixed(3)} | ~${(100 * wrongSearches / data.persons.length).toFixed(0)}% persoane`);
}
const kinds = [...new Set(oof.map(x => x.kind))];
console.log('recall pe tip la P≥.99 | P≥.9:', kinds.map(k => { const all = rows.filter(r => r.kind === k && r.y).length; const a = oof.filter(x => x.kind === k && x.y && x.p >= .99).length, b = oof.filter(x => x.kind === k && x.y && x.p >= .9).length; return `${k} ${(100 * a / Math.max(1, all)).toFixed(0)}|${(100 * b / Math.max(1, all)).toFixed(0)}%`; }).join('  '));

// model final, pe tot
const m = F.trainLogistic(rows.map(r => r.x), rows.map(r => r.y), { l2: 1e-5 });
const p = names.length, wRaw = names.map((_, j) => m.w[j] / m.sd[j]), bRaw = m.w[p] - names.reduce((s, _, j) => s + m.w[j] * m.mu[j] / m.sd[j], 0);
console.log('MODEL FINAL (brut):', JSON.stringify({ names, w: wRaw.map(v => +v.toFixed(4)), b: +bRaw.toFixed(4) }));
