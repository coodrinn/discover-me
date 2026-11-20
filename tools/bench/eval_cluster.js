// Evaluare „Cine apare în album?”: câte grupuri iese, cât de pure sunt, câte dubluri (aceeași persoană în 2 grupuri).
// Rulare: node eval_cluster.js lfw_desc.json [algo=v2] [nPeople=60]
'use strict';
const { loadData, buildAlbum, shuffleWith, rng, load } = require('./harness');
const [FILE, ALGO = 'v2', NP = 60] = process.argv.slice(2);
const data = loadData(FILE);
const algos = {   // v2 = gruparea din aplicație (clusterAlbumFacesV2)
  v2: () => { const f = load(['engine/matching.js', 'engine/clusters.js'], ['clusterAlbumFacesV2']).clusterAlbumFacesV2; const cfg = process.env.CL ? JSON.parse(process.env.CL) : {}; return (e, p) => f(e, p, cfg); },
};
const cluster = algos[ALGO]();

(async () => {
  const pct = x => (100 * x).toFixed(1) + '%';
  const agg = { runs: 0, truePeople: 0, clusters: 0, dup: 0, impure: 0, faces: 0, clustered: 0, pureFaces: 0, pairP: 0, pairR: 0, over: 0 };
  for (let run = 0; run < 3; run++) {
    const r = rng(500 + run);
    const pick = new Set(shuffleWith(r, data.persons).slice(0, +NP));
    const recs = data.recs.filter(x => x.distractor || pick.has(x.id));
    const sub = { ...data, recs };
    const album = buildAlbum(sub, new Set(), 900 + run).filter(e => e.faces.length);
    const truth = new Map(album.map(e => [e.key, e.rec.distractor ? 'S:' + e.rec.id : e.rec.id]));
    const groups = await cluster(album);
    // identități „adevărate” prezente în ≥3 poze
    const cnt = new Map(); for (const e of album) { const id = truth.get(e.key); cnt.set(id, (cnt.get(id) || 0) + 1); }
    const trueBig = [...cnt].filter(([id, n]) => !id.startsWith('S:') && n >= 3).length;
    const majority = groups.map(g => { const c = new Map(); for (const it of g.items || g.reps) { const id = truth.get(it.e.key); c.set(id, (c.get(id) || 0) + 1); } const [id, n] = [...c].sort((a, b) => b[1] - a[1])[0]; return { id, n, total: [...c.values()].reduce((a, b) => a + b, 0) }; });
    const ids = new Set(majority.map(x => x.id));
    const nFaces = album.length;
    // perechi: precizie/recall la nivel de față (doar identități cu ≥2 poze)
    let tpP = 0, fpP = 0, fnP = 0;
    const assign = new Map(); groups.forEach((g, gi) => (g.items || []).forEach(it => assign.set(it.e.key, gi)));
    const byTruth = new Map(); for (const e of album) { const id = truth.get(e.key); if (id.startsWith('S:')) continue; (byTruth.get(id) || byTruth.set(id, []).get(id)).push(e.key); }
    for (const [id, keys] of byTruth) { const c = new Map(); for (const k of keys) { const g = assign.has(k) ? assign.get(k) : -1; c.set(g, (c.get(g) || 0) + 1); } const tot = keys.length; for (const [g, n] of c) if (g !== -1) tpP += n * (n - 1) / 2; fnP += tot * (tot - 1) / 2; }
    for (const g of groups) { const n = (g.items || []).length; const c = new Map(); for (const it of g.items || []) { const id = truth.get(it.e.key); c.set(id, (c.get(id) || 0) + 1); } let same = 0; for (const [id, k] of c) if (!id.startsWith('S:')) same += k * (k - 1) / 2; fpP += n * (n - 1) / 2 - same; }
    agg.runs++; agg.truePeople += trueBig; agg.clusters += groups.length; agg.dup += groups.length - ids.size;
    agg.impure += majority.filter(x => x.n / x.total < .9).length;
    agg.faces += album.filter(e => !truth.get(e.key).startsWith('S:')).length;
    agg.clustered += groups.reduce((a, g) => a + (g.items || []).length, 0);
    agg.pureFaces += majority.reduce((a, x) => a + x.n, 0);
    agg.pairP += tpP / Math.max(1, tpP + fpP); agg.pairR += tpP / Math.max(1, fnP);
  }
  const n = agg.runs;
  console.log(`algo=${ALGO}  persoane reale (≥3 poze): ${(agg.truePeople / n).toFixed(0)}  grupuri afișate: ${(agg.clusters / n).toFixed(1)}  dubluri (aceeași persoană în >1 grup): ${(agg.dup / n).toFixed(1)}  grupuri amestecate(<90% pure): ${(agg.impure / n).toFixed(1)}`);
  console.log(`puritate fețe: ${pct(agg.pureFaces / agg.clustered)}  acoperire (fețe din persoane reale puse în grupuri): ${pct(agg.clustered / agg.faces)}  perechi precizie ${pct(agg.pairP / n)} recall ${pct(agg.pairR / n)}`);
})();
