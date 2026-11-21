# discover.me

**Găsește toate fotografiile în care apare o persoană, direct în browser.**

Alegi un album, adaugi 3 poze clare cu persoana, apeși pe ea și vezi toate pozele în care apare.

> 🔒 **Pozele nu părăsesc dispozitivul.** Detectarea și recunoașterea fețelor, căutarea și salvarea rulează local, în browser.
> Nu există server care să primească fotografii.

## Caracteristici

- **Recunoaștere locală** cu SFace (ONNX) rulat prin WebAssembly, fără cont și fără încărcare de poze
- **Cine apare în album?** grupează automat fețele și creează profiluri dintr-un nume
- **Căutare de grup**: pozele în care apar împreună 2 sau mai multe persoane
- **„Sigure” și „de verificat”**: rezultatele incerte se confirmă cu ✓ / ✗, iar aplicația învață din ele
- **Album din folder, drag & drop sau linkuri directe** către poze
- **Indexare reluabilă** cu timp estimat; progresul se salvează pe parcurs
- **Sortare și filtru după dată** (EXIF), export ZIP și trimitere prin meniul de partajare
- **PWA**: se instalează și merge offline după prima deschidere
- Teme și culori configurabile

## Pornire rapidă

Aplicația este statică, nu are nevoie de instalare sau build.

**Windows:** dublu-click pe `porneste.bat` (deschide `http://localhost:8080`; lasă fereastra deschisă cât o folosești).

**Orice sistem:**

```bash
python -m http.server 8080
# apoi deschide http://localhost:8080
```

**Dublu-click pe `index.html`** (din `file://`) funcționează doar dacă generezi local pachetul offline (~80 MB, nu e în git):

```bash
node tools/make-offline.js
```

Pentru acces persistent la un folder de poze folosește Chrome sau Edge pe desktop. La prima pornire se descarcă
~60 MB de modele (incluse în proiect, fără CDN), apoi se păstrează în memoria browserului.
Pentru utilizatori reali, publică aplicația pe un hosting static cu HTTPS (de ex. GitHub Pages).

## Cum se folosește

1. **Începe** → **Alege pozele** (galerie pe telefon, folder pe desktop sau drag & drop).
2. Pozele se pregătesc singure (indexare, o singură dată pe poză).
3. **Cine apare?** Apeși **Vezi pozele** sub persoana căutată (numele e opțional).
4. Bifezi și descarci. Pe planul Gratuit se vede o persoană; celelalte au lacăt.

## Cum funcționează

1. **Indexare.** face-api detectează fețele și reperele; **SFace** (OpenCV Zoo, Apache-2.0) dă fiecărei fețe o amprentă de 128 de valori, salvată în IndexedDB.
2. **Profil.** Din 3 sau mai multe poze de referință se obțin amprentele persoanei.
3. **Potrivire.** O regresie logistică (distanța până la cele mai apropiate două referințe + mărimea feței) dă fiecărei fețe o probabilitate.
   „Sigure” = P ≥ 0,95 (mod extins) sau 0,97 (mod precis); „de verificat” = P ≥ 0,40 / 0,50.
4. **Extinderea profilului.** Fețele foarte sigure devin referințe suplimentare; ce se găsește doar așa apare mereu la „de verificat”.
5. **Învățare.** Când confirmi un rezultat incert, fața se adaugă în profil.

Acuratețe măsurată pe LFW (cu degradări simulate): pozele „sigure” sunt corecte în **99,9%** din cazuri și se găsesc ~86% din pozele țintă
(94% cu „de verificat”). Detalii în [`tools/bench/README.md`](tools/bench/README.md).
Performanță (50.000 de poze sintetice): căutare ~70 ms, grupare ~0,6 s. Timpul mare e la prima indexare.

## Structură

```
discover-me/
├── index.html              # Structura paginii
├── sw.js, manifest.webmanifest   # PWA: pornire fără internet, instalare
├── porneste.bat            # Pornire server local pe Windows
├── frontend/               # Interfața (css, js, icons)
│   └── js/                 # app, consent, extras, settings, backdrop, helpers, theme-init
├── engine/                 # Motorul (rulează în browser)
│   ├── config.js           # Versiuni, modele, stare comună
│   ├── storage.js          # IndexedDB: index, persoane, setări
│   ├── album.js, links.js  # Citirea folderelor / linkurilor
│   ├── faces.js, sface.js  # Detectare și amprentă facială
│   ├── matching.js         # Potrivire: probabilitate, praguri
│   ├── clusters.js         # „Cine apare în album?”
│   ├── exif.js, heic.js    # Data pozei, suport HEIC
│   ├── offline.js          # Încărcare din file://
│   └── license.js          # Planuri și verificarea licențelor
├── vendor/                 # face-api, SFace, onnxruntime-web (incluse local)
├── tests/                  # Teste Node și test de fum în browser
└── tools/                  # Benchmark, pachet offline, generare chei de licență
```

Scripturile se încarcă în ordinea din `index.html`: întâi motorul, apoi interfața.

## Teste

```bash
npm test                              # teste unitare (Node, fără dependențe)
npm i --no-save puppeteer-core
PHOTOS=C:/cale/poze npm run test:e2e  # test în Edge/Chrome headless
node tools/bench-search.js 50000      # performanță căutare și grupare
```

## Abonamente (opțional)

| Plan | Persoane | Lunar | Anual |
|---|---|---|---|
| Gratuit | 1 | 0 € | 0 € |
| Plus | 3 | 1,99 € | 14,99 € |
| Pro | nelimitat | 3,99 € | 29,99 € |

Prețurile se schimbă în `engine/license.js` (`PLANS`). Plățile pot fi încasate prin [Lemon Squeezy](https://www.lemonsqueezy.com):
completezi `PAYMENTS` din `engine/license.js` (`storeId`, `productIds`, linkurile de checkout), iar aplicația verifică cheia direct la Lemon Squeezy, fără server.
Pentru vânzări directe poți emite chei semnate cu `tools/license/` (`keygen.js`, `issue.js`).

> ⚠️ **Cheia privată (`~/.discover-me/license-private.pem`) nu se pune niciodată pe GitHub.** Este deja exclusă prin `.gitignore`.

## Limite cunoscute

- Limita de persoane din abonament se verifică în browser, deci poate fi ocolită de cineva cu cunoștințe tehnice (aplicația nu are server).
- Recunoașterea e mai slabă pe poze foarte mici, de profil, cu ochelari de soare sau cu copii; de aceea există „de verificat”.
- **iPhone:** necesită WebAssembly SIMD (iOS 16.4+).
- Instalarea și modul offline merg doar prin `http://localhost` sau `https://`, nu din `file://`.
- Interfața este doar în română.
- Licența modelelor: SFace (Apache-2.0), onnxruntime-web (MIT), face-api (MIT). Verifică condițiile datelor de antrenare înainte de uz comercial.

## Licență

Copyright © 2026 Toia_Codrin. Toate drepturile rezervate. Codul este public doar pentru consultare; nu poate fi copiat, modificat,
distribuit sau folosit fără acordul scris al autorului. Componentele din `vendor/` rămân sub licențele lor originale. Vezi [`LICENSE`](LICENSE).

## Tehnologii

- [face-api.js](https://github.com/vladmandic/face-api) (TensorFlow.js): detectarea fețelor și a reperelor
- [SFace](https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface) + [onnxruntime-web](https://www.npmjs.com/package/onnxruntime-web): recunoaștere
- IndexedDB și File System Access API: stocare locală și acces la foldere
- JSZip: exportul pozelor găsite
