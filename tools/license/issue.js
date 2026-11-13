#!/usr/bin/env node
// Emite o cheie de licență după o plată.
// Utilizare:  node tools/license/issue.js plus client@email.com        (fără expirare)
//             node tools/license/issue.js pro  client@email.com 30     (expiră în 30 de zile)
//             node tools/license/issue.js plus client@email.com 365    (un an)
// Trimite apoi clientului cheia afișată (începe cu "DM1-").
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PLANS = { plus: 3, pro: 0 }; // 0 = nelimitat (trebuie să corespundă cu engine/license.js)
const [plan, email = '', days = ''] = process.argv.slice(2);
if (!(plan in PLANS)) {
  console.error('Utilizare: node tools/license/issue.js <plus|pro> [email] [zile]');
  process.exit(1);
}
const file = path.join(os.homedir(), '.discover-me', 'license-private.pem');
if (!fs.existsSync(file)) {
  console.error(`Nu găsesc cheia privată (${file}). Rulează întâi: node tools/license/keygen.js`);
  process.exit(1);
}
const b64url = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const payload = { v: 1, plan, people: PLANS[plan], id: crypto.randomUUID(), email, iat: Math.floor(Date.now() / 1000) };
if (days) payload.exp = payload.iat + Math.round(Number(days) * 86400);
const body = b64url(JSON.stringify(payload));
const sig = crypto.sign('sha256', Buffer.from(body), { key: fs.readFileSync(file), dsaEncoding: 'ieee-p1363' });
const key = `DM1-${body}.${b64url(sig)}`;
console.log(key);
fs.appendFileSync(path.join(os.homedir(), '.discover-me', 'issued-licenses.csv'),
  `${new Date().toISOString()},${plan},${email},${payload.id},${payload.exp ? new Date(payload.exp * 1000).toISOString() : ''}\n`);
