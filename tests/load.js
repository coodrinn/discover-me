// Încarcă fișierele din engine/ într-un context izolat (ca în browser, dar fără DOM) și întoarce ce ceri.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');

function load(files, exportNames, globals = {}) {
  const ctx = vm.createContext({ console, Math, Float32Array, Uint8Array, DataView, Set, Map, Promise, setTimeout, ...globals });
  const src = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
  return vm.runInContext(`${src}\n;({${exportNames.join(',')}})`, ctx, { filename: files.join('+') });
}

// Generator pseudo-aleator cu sămânță: testele dau aceleași rezultate de fiecare dată.
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function gauss(r) { return Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r()); }
// „Persoană” sintetică: un descriptor de bază de normă ~0.75 (două persoane diferite ajung la ~1.06 distanță).
function person(seed) { const r = rng(seed), v = Float32Array.from({ length: 128 }, () => gauss(r)); const n = Math.hypot(...v); return v.map(x => x / n * .75); }
// Aceeași persoană în altă poză: baza + zgomot. noise=.019 → distanță ~0.30 între două poze.
function shot(base, seed, noise = .019) { const r = rng(seed); return Float32Array.from(base, x => x + gauss(r) * noise); }

module.exports = { load, person, shot, rng };
