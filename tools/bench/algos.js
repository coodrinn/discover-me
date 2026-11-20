// Algoritmi de căutare comparați. Fiecare: search(refs: Float32Array[], album: entries[]) -> [{level, score}] (aliniat cu album)
'use strict';
const { load } = require('./harness');
const m = load(['engine/matching.js'], ['faceScoreFast', 'classifyScore', 'matchPolicy', 'expandSearch', 'levelOf', 'descriptorDistance', 'MATCH_POLICIES', 'EXPAND']);
if (process.env.POLICY) { const [sp, rp, ms, sz] = process.env.POLICY.split(',').map(Number); Object.assign(m.MATCH_POLICIES.precise, { strongP: sp, reviewP: rp }); if (ms) m.MATCH_POLICIES.precise.strongMinScore = ms; if (sz) m.MATCH_POLICIES.precise.strongMinSize = sz; }
if (process.env.POLICYX) { const [sp, rp] = process.env.POLICYX.split(',').map(Number); Object.assign(m.MATCH_POLICIES.extended, { strongP: sp, reviewP: rp }); }
if (process.env.EXPAND) { const o = JSON.parse(process.env.EXPAND); Object.assign(m.EXPAND, o); }

// ===== ALGORITMUL CURENT din aplicație (fără indiciul de ținută): scor pe față + extindere a profilului =====
function currentSearch(refs, album, { expand = true, policyName = 'precise' } = {}) {
  const policy = m.matchPolicy(policyName);
  const rows = album.map(e => { const out = []; for (const f of e.faces) { const s = m.faceScoreFast(f, refs); if (s) out.push({ entry: e, ...s, faceScore: f.s, faceSize: f.m, d: f.d }); } return out; });
  if (expand) m.expandSearch(rows, refs, album);
  return rows.map(fr => {
    let best = null, lvl = 'none';
    for (const r of fr) {
      const l = m.levelOf(r, policy);
      const eff = l === 'review' && !(policy.mode === 'extended' || r.expanded) ? 'none' : l;
      if (eff === 'strong' && (lvl !== 'strong' || r.score < best.score)) { lvl = 'strong'; best = r; }
      else if (eff === 'review' && lvl !== 'strong' && (!best || r.score < best.score)) { lvl = 'review'; best = r; }
    }
    return { level: lvl, score: best ? best.score : Infinity };
  });
}

module.exports = {
  current: { search: (refs, album) => currentSearch(refs, album) },
  current_noexp: { search: (refs, album) => currentSearch(refs, album, { expand: false }) },
  current_ext: { search: (refs, album) => currentSearch(refs, album, { policyName: 'extended' }) },
  _m: m, currentSearch,
};
