#!/usr/bin/env node
// Generează vendor/offline/*.js: modelele și biblioteca de recunoaștere împachetate ca scripturi (base64).
// De ce: când index.html e deschis direct din folder (file://), browserul nu lasă pagina să CITEASCĂ fișiere (fetch), dar lasă să încarce SCRIPTURI.
// engine/offline.js folosește aceste scripturi doar în modul file://. Fișierele generate NU intră în git (sunt ~90 MB și se refac oricând).
// Rulare:  node tools/make-offline.js      (rulează și la prima pornire din porneste.bat dacă lipsesc)
'use strict';
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'vendor', 'offline');
fs.mkdirSync(out, { recursive: true });

const files = [];
const walk = dir => { for (const n of fs.readdirSync(dir)) { const p = path.join(dir, n); if (fs.statSync(p).isDirectory()) walk(p); else files.push(p); } };
walk(path.join(root, 'vendor', 'face-api', 'model'));
files.push(path.join(root, 'vendor', 'sface', 'face_recognition_sface_2021dec.onnx'));
files.push(path.join(root, 'vendor', 'ort', 'ort-wasm-simd-threaded.mjs'));
files.push(path.join(root, 'vendor', 'ort', 'ort-wasm-simd-threaded.wasm'));

const index = {};
files.forEach((f, i) => {
  const key = path.relative(root, f).split(path.sep).join('/');
  const name = `f${i}.js`;
  fs.writeFileSync(path.join(out, name), `(window.DM_OFFLINE=window.DM_OFFLINE||{})[${JSON.stringify(key)}]=${JSON.stringify(fs.readFileSync(f).toString('base64'))};`);
  index[key] = name;
});
fs.writeFileSync(path.join(out, 'index.js'), `window.DM_OFFLINE_INDEX=${JSON.stringify(index)};`);
const mb = fs.readdirSync(out).reduce((n, f) => n + fs.statSync(path.join(out, f)).size, 0) / 1048576;
console.log(`vendor/offline: ${files.length} fișiere, ${mb.toFixed(0)} MB`);
