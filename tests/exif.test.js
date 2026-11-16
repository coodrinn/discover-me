'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { load } = require('./load');
const { readPhotoDate } = load(['engine/exif.js'], ['readPhotoDate']);

// Construiește un JPEG minimal cu EXIF (DateTimeOriginal), big-endian sau little-endian.
function jpegWithDate(str, le = false) {
  const date = Buffer.from(str + '\0', 'latin1');
  const tiff = Buffer.alloc(44 + date.length);
  const w16 = (o, v) => le ? tiff.writeUInt16LE(v, o) : tiff.writeUInt16BE(v, o);
  const w32 = (o, v) => le ? tiff.writeUInt32LE(v, o) : tiff.writeUInt32BE(v, o);
  tiff.write(le ? 'II' : 'MM', 0, 'latin1'); w16(2, 42); w32(4, 8);
  w16(8, 1); w16(10, 0x8769); w16(12, 4); w32(14, 1); w32(18, 26);          // IFD0 → Exif IFD la offset 26
  w32(22, 0);
  w16(26, 1); w16(28, 0x9003); w16(30, 2); w32(32, date.length); w32(36, 44); // Exif IFD → data la offset 44
  w32(40, 0); date.copy(tiff, 44);
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const app1 = Buffer.alloc(4); app1.writeUInt16BE(0xFFE1, 0); app1.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([Buffer.from([0xFF, 0xD8]), app1, body, Buffer.from([0xFF, 0xDA, 0, 2, 0xFF, 0xD9])]);
}
const asFile = (buf, name = 'x.jpg', type = 'image/jpeg') => ({
  name, type,
  slice: (a, b) => ({ arrayBuffer: async () => { const u = buf.subarray(a, Math.min(b, buf.length)); return u.buffer.slice(u.byteOffset, u.byteOffset + u.length); } })
});

for (const le of [false, true])
  test(`citește data din EXIF (${le ? 'little' : 'big'}-endian)`, async () => {
    const d = await readPhotoDate(asFile(jpegWithDate('2021:07:15 14:30:05', le)));
    assert.equal(d, new Date(2021, 6, 15, 14, 30, 5).getTime());
  });

test('întoarce null pentru fișiere non-JPEG, fără EXIF sau cu date invalide', async () => {
  assert.equal(await readPhotoDate(null), null);
  assert.equal(await readPhotoDate(asFile(jpegWithDate('2021:07:15 14:30:05'), 'x.png', 'image/png')), null);
  assert.equal(await readPhotoDate(asFile(Buffer.from([0xFF, 0xD8, 0xFF, 0xDA, 0, 2, 0xFF, 0xD9]))), null);
  assert.equal(await readPhotoDate(asFile(jpegWithDate('0000:00:00 00:00:00'))), null);
  assert.equal(await readPhotoDate(asFile(Buffer.from('nu e jpeg'))), null);
});
