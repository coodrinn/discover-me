// Trăsături pentru decizia „aceeași persoană?” între o față din album și profilul (referințele) unei persoane.
'use strict';
function dist(a, b) { let s = 0; for (let k = 0; k < a.length; k++) { const d = a[k] - b[k]; s += d * d; } return Math.sqrt(s); }
function centroid(vs) { const c = new Float32Array(vs[0].length); for (const v of vs) for (let k = 0; k < c.length; k++) c[k] += v[k] / vs.length; return c; }

// refs: Float32Array[] (aici pot intra și variantele oglindite). face: {d,s,m}
function features(refs, face, opt = {}) {
  const ds = refs.map(r => dist(face.d, r)).sort((a, b) => a - b);
  const d1 = ds[0], d2 = ds[Math.min(1, ds.length - 1)], dmean = ds.reduce((a, b) => a + b, 0) / ds.length;
  const dc = dist(face.d, centroid(refs));
  const q = Math.log(Math.max(20, Math.min(220, face.m)) / 60);
  return { d1, d2, dmean, dc, q, s: face.s };
}
const NAMES = ['d1', 'd2', 'dmean', 'dc', 'q', 's'];
const vec = (f, names = NAMES) => names.map(n => f[n]);

// Regresie logistică (IRLS / Newton cu regularizare L2), cu standardizare.
function trainLogistic(X, y, { l2 = 1e-3, iters = 25, w0 = null } = {}) {
  const n = X.length, p = X[0].length;
  const mu = new Float64Array(p), sd = new Float64Array(p);
  for (const x of X) for (let j = 0; j < p; j++) mu[j] += x[j] / n;
  for (const x of X) for (let j = 0; j < p; j++) sd[j] += (x[j] - mu[j]) ** 2 / n;
  for (let j = 0; j < p; j++) sd[j] = Math.sqrt(sd[j]) || 1;
  const Z = X.map(x => Float64Array.from(x, (v, j) => (v - mu[j]) / sd[j]));
  let w = new Float64Array(p + 1);
  for (let it = 0; it < iters; it++) {
    const g = new Float64Array(p + 1), H = Array.from({ length: p + 1 }, () => new Float64Array(p + 1));
    for (let i = 0; i < n; i++) {
      const z = Z[i]; let t = w[p]; for (let j = 0; j < p; j++) t += w[j] * z[j];
      const pr = 1 / (1 + Math.exp(-t)), r = pr - y[i], h = Math.max(1e-6, pr * (1 - pr));
      for (let j = 0; j < p; j++) { g[j] += r * z[j]; for (let k = 0; k <= j; k++) H[j][k] += h * z[j] * z[k]; H[j][p] += h * z[j]; }
      g[p] += r; H[p][p] += h;
    }
    for (let j = 0; j <= p; j++) for (let k = j + 1; k <= p; k++) H[j][k] = H[k][j];
    for (let j = 0; j < p; j++) { g[j] += l2 * n * w[j]; H[j][j] += l2 * n; }
    // rezolvă H·delta = g (Gauss)
    const A = H.map((row, i) => [...row, g[i]]);
    for (let c = 0; c <= p; c++) { let piv = c; for (let r = c + 1; r <= p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r; [A[c], A[piv]] = [A[piv], A[c]]; const d = A[c][c] || 1e-9; for (let k = c; k <= p + 1; k++) A[c][k] /= d; for (let r = 0; r <= p; r++) if (r !== c) { const f = A[r][c]; if (f) for (let k = c; k <= p + 1; k++) A[r][k] -= f * A[c][k]; } }
    let step = 0; for (let j = 0; j <= p; j++) { w[j] -= A[j][p + 1]; step += Math.abs(A[j][p + 1]); }
    if (step < 1e-7) break;
  }
  return { w: Array.from(w), mu: Array.from(mu), sd: Array.from(sd) };
}
function predict(model, x) { const p = x.length; let t = model.w[p]; for (let j = 0; j < p; j++) t += model.w[j] * (x[j] - model.mu[j]) / model.sd[j]; return 1 / (1 + Math.exp(-t)); }

module.exports = { dist, centroid, features, NAMES, vec, trainLogistic, predict };
