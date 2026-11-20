'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { load } = require('./load');
const m = load(['engine/sface.js'], ['similarityToTemplate', 'SFACE_TEMPLATE']);

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('reperele egale cu șablonul dau transformarea identitate', () => {
  const t = m.similarityToTemplate(m.SFACE_TEMPLATE);
  near(t.a, 1); near(t.b, 0); near(t.tx, 0); near(t.ty, 0);
});

test('recuperează scara, rotația și translația (față mărită, rotită și mutată)', () => {
  const s = 2.5, ang = 20 * Math.PI / 180, ox = 300, oy = 120;
  // reperele „din poză” = șablonul, rotit, scalat și mutat; transformarea căutată le readuce la șablon
  const lm = m.SFACE_TEMPLATE.map(([x, y]) => [s * (Math.cos(ang) * x - Math.sin(ang) * y) + ox, s * (Math.sin(ang) * x + Math.cos(ang) * y) + oy]);
  const t = m.similarityToTemplate(lm);
  near(Math.hypot(t.a, t.b), 1 / s, 1e-6);
  near(Math.atan2(t.b, t.a), -ang, 1e-6);
  // aplicată pe repere, trebuie să cadă pe șablon
  for (let i = 0; i < 5; i++) {
    const [x, y] = lm[i];
    near(t.a * x - t.b * y + t.tx, m.SFACE_TEMPLATE[i][0], 1e-4);
    near(t.b * x + t.a * y + t.ty, m.SFACE_TEMPLATE[i][1], 1e-4);
  }
});

test('reperele degenerate (toate în același punct) nu produc transformare', () => {
  assert.equal(m.similarityToTemplate([[5, 5], [5, 5], [5, 5], [5, 5], [5, 5]]), null);
});
