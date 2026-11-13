#!/usr/bin/env node
// Generează perechea de chei pentru licențe (o singură dată).
//  - cheia PRIVATĂ se salvează în ~/.discover-me/license-private.pem (NU o pune niciodată pe GitHub)
//  - cheia PUBLICĂ se afișează și trebuie pusă în engine/license.js (LICENSE_PUBLIC_KEY)
// Utilizare: node tools/license/keygen.js
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const dir = path.join(os.homedir(), '.discover-me');
const file = path.join(dir, 'license-private.pem');
if (fs.existsSync(file)) {
  console.error(`Există deja o cheie privată în ${file}.\nDacă o înlocuiești, toate licențele vândute până acum nu vor mai fi valide.`);
  process.exit(1);
}
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(file, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
const jwk = publicKey.export({ format: 'jwk' });
console.log(`Cheia privată a fost salvată în: ${file}`);
console.log('Fă-i o copie de rezervă într-un loc sigur (de ex. un stick sau un manager de parole).\n');
console.log('Cheia publică (pune-o în engine/license.js):');
console.log(JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }));
