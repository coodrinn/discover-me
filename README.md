# discover.me

Găsește toate fotografiile în care apare o persoană, direct în browser.
Alegi un album, adaugi 3 poze clare cu persoana, apeși pe ea și vezi pozele în care apare.

**Pozele nu părăsesc dispozitivul.** Recunoașterea fețelor, căutarea și salvarea rulează local,
în browser. Nu există server care să primească fotografii.

## Pornire

Aplicația este statică, deci nu are nevoie de instalare.

- Deschide `index.html` în Chrome sau Edge, **sau**
- pornește un server local din acest folder, de exemplu `python -m http.server 8080`,
  apoi deschide `http://localhost:8080`.

Pentru acces persistent la un folder de poze folosește Chrome sau Edge pe desktop.
Modelele de recunoaștere a fețelor sunt incluse în aplicație (`vendor/face-api/`, ~12 MB), deci nu depind de niciun CDN și, după
prima deschidere prin `http://localhost` sau `https://`, aplicația merge complet offline. Când `index.html` e deschis direct din folder
(`file://`), browserul nu permite citirea modelelor locale și aplicația folosește CDN-ul ca plan de rezervă.

**Instalare și mod offline** funcționează doar când aplicația e servită prin `http://localhost` sau `https://`
(de ex. GitHub Pages), nu când deschizi `index.html` direct din folder. După prima deschidere, aplicația
pornește și fără internet, iar în Setări apare butonul „Instalează aplicația”.

## Structură

```
discover-me/
├── index.html              # Structura paginii
├── frontend/               # Interfața
│   ├── css/styles.css      # Stiluri, teme, cele 3 variante de stil
│   └── js/
│       ├── theme-init.js   # Aplică tema salvată înainte de afișare
│       ├── helpers.js      # Utilitare de interfață ($, toast, fmt)
│       ├── app.js          # Fluxul aplicației: album, indexare, persoane, căutare, rezultate
│       ├── consent.js      # Acordul de confidențialitate (o dată, înainte de primul profil)
│       ├── extras.js       # Căutare de grup, „Nu e persoana”, sortare după dată, trimitere, „Cine apare în album?”, instalare
│       ├── settings.js     # Setări (mod, culoare), efecte la atingere
│       └── backdrop.js     # Fundal animat cu poze și tutorialul de la prima pornire
│   └── icons/              # Pictogramele aplicației (PWA)
├── vendor/face-api/        # face-api.js și modelele, incluse local (fără CDN)
├── tests/                  # Teste automate (Node) și test de fum în browser
└── engine/                 # Motorul (rulează local, în browser)
    ├── config.js           # Versiuni, modele, starea comună
    ├── storage.js          # IndexedDB: index, persoane, setări
    ├── album.js            # Citirea folderelor și a fișierelor imagine
    ├── faces.js            # Detectarea fețelor (face-api) și indiciul de ținută
    ├── matching.js         # Potrivirea fețelor: distanțe, scor de consens, praguri
    ├── links.js            # Album din linkuri directe către poze
    ├── exif.js             # Data la care a fost făcută poza (EXIF)
    ├── clusters.js         # Gruparea fețelor din album („Cine apare în album?”)
    └── license.js          # Planuri, prețuri, verificarea cheilor de licență
manifest.webmanifest        # Instalare ca aplicație
sw.js                       # Service worker: pornire fără internet
tools/license/              # Generarea cheilor de licență (rulează doar la tine, cu Node.js)
```

Scripturile sunt încărcate în ordinea din `index.html`: întâi motorul, apoi interfața.

## Ce mai poate face

- **Cine apare în album?** (pagina *Persoane salvate*): după indexare, fețele care apar în cel puțin 3 poze sunt
  grupate automat. Scrii un nume și profilul e creat din acele fețe, fără să mai cauți 3 poze de referință.
- **Mai multe persoane în aceeași poză**: bifează opțiunea din căutare și alege 2 sau mai multe persoane.
  Apar doar pozele în care sunt toate, pe fețe diferite.
- **✗ Nu e persoana**: scoate poza din rezultate și nu o mai arată pentru acel profil. Fețele foarte asemănătoare
  cu cea respinsă sunt ascunse și ele, dar doar dintre rezultatele incerte.
- **Sortare și filtru după dată**: cele mai noi sau cele mai vechi întâi, plus filtru pe an. Data vine din EXIF
  (pentru JPEG), altfel se folosește data fișierului.
- **↗ Trimite**: pozele selectate merg direct în meniul de partajare al sistemului (unde browserul permite).
- **Drag & drop**: tragi un folder (sau poze) oriunde în fereastră și devine albumul; în Chrome/Edge folderul e ținut minte, în alte browsere se citește o dată.
- **Indexare reluabilă**: progresul se salvează pe parcurs și se afișează timpul estimat. Dacă închizi pagina,
  „Reconectează albumul” continuă de unde a rămas.

## Album din linkuri

Pe lângă un folder de pe calculator, albumul poate fi o listă de **linkuri directe către poze**
(`https://…/poza.jpg`), lipite câte unul pe rând (butonul „🔗 Din linkuri”). Pozele se descarcă în browser
și sunt tratate exact ca un album din folder; lista se păstrează și albumul revine la următoarea deschidere.
Merge doar cu site-uri care permit descărcarea din alte pagini (CORS); linkurile care nu merg sunt afișate cu motivul.

## Cum funcționează căutarea

1. **Indexare.** Fiecare poză din album este analizată o singură dată. Fiecare față primește
   un descriptor de 128 de valori, salvat în IndexedDB.
2. **Profil.** Din 3 sau mai multe poze de referință se obțin descriptorii persoanei.
3. **Potrivire.** O față este considerată sigură doar dacă este apropiată de **cel puțin două**
   referințe (consens), ceea ce reduce rezultatele greșite.
4. **Ținuta**, adică culorile hainelor, este doar un indiciu secundar.
5. **Învățare.** Când confirmi un rezultat incert („✓ E persoana”), fața este adăugată în profil
   și căutarea găsește mai multe poze.

## Abonamente

| Plan | Persoane | Lunar | Anual |
|---|---|---|---|
| Gratuit | 1 | 0 € | 0 € |
| Plus | 3 | 1,99 € | 14,99 € (–37%) |
| Pro | nelimitat | 3,99 € | 29,99 € (–37%) |

Prețurile se schimbă în `engine/license.js` (`PLANS`). Când un abonament expiră, aplicația revine la Gratuit:
profilurile rămân salvate, dar cele peste limită apar blocate până la reînnoire.

### Activarea plăților (Lemon Squeezy)

Lemon Squeezy încasează abonamentele, se ocupă de TVA în UE, reînnoiește automat și trimite clientului
cheia de licență pe email. Aplicația verifică cheia direct la Lemon Squeezy, din browser, fără server.

1. Creează un cont pe [lemonsqueezy.com](https://www.lemonsqueezy.com) și un magazin.
2. Creează două produse de tip **Subscription**: **discover.me Plus** și **discover.me Pro**,
   fiecare cu două variante: **Lunar** și **Anual**. Activează **License keys** (de ex. limită de 3 activări).
3. Opțional: setează *Redirect URL* la adresa aplicației cu `?activate=1`
   (de ex. `https://NUMELE-TĂU.github.io/discover-me/?activate=1`).
4. Completează în `engine/license.js`, la `PAYMENTS`:
   - `storeId`: ID-ul magazinului (Settings → Stores);
   - `productIds`: ID-urile celor două produse;
   - `checkout`: linkul de checkout pentru fiecare variantă (lunar/anual).

Cheile sunt acceptate **doar** dacă vin din magazinul tău și din produsele configurate. Aplicația reverifică
abonamentul zilnic. Dacă e anulat, expirat sau rambursat, revine la Gratuit; fără internet, mai are 5 zile de grație.

### Chei emise manual (opțional)

Pentru vânzări directe sau cadouri poți emite chei semnate (`DM1-...`), verificate fără internet:

```bash
node tools/license/keygen.js                      # o singură dată: creează cheia privată în ~/.discover-me/
node tools/license/issue.js plus client@email.ro      # cheie fără expirare
node tools/license/issue.js pro client@email.ro 30    # cheie valabilă 30 de zile
```

**Cheia privată (`~/.discover-me/license-private.pem`) nu se pune niciodată pe GitHub.**
Fără ea nu mai poți emite chei care să funcționeze, iar dacă ajunge la altcineva, oricine poate genera chei.

## Teste

```bash
npm test                 # teste unitare (Node, fără dependențe): potrivire, grupare, EXIF
npm i --no-save puppeteer-core
PHOTOS=C:/cale/poze npm run test:e2e   # test în Edge/Chrome headless: modele locale, acord, detectare pe poze reale
node tools/bench-search.js 50000       # cât durează căutarea și gruparea pe 50.000 de poze
```

Referință de performanță (date sintetice, 50.000 de poze / 85.000 de fețe): căutarea după o persoană ~70 ms,
„Cine apare în album?” ~0,6 s. Timpul mare e la prima indexare (analiza fiecărei poze), nu la căutare.

## Limite cunoscute

- **Limita de persoane din abonament se verifică în browser.** Aplicația rulează 100% local, fără server propriu, așa că
  cineva cu cunoștințe tehnice o poate ocoli. Nu poate fi blocat altfel decât cu un server care ține datele; la prețurile
  actuale e un compromis asumat. Cheile sunt verificate criptografic (semnătură ECDSA / Lemon Squeezy), dar asta nu împiedică modificarea codului local.
- **Acuratețea depinde de modelul face-api (2018).** Pe copii mici, unghiuri laterale și lumină slabă greșește mai des decât modelele noi.
  Înlocuirea necesită un set etichetat pentru recalibrarea pragurilor din `engine/matching.js`; până atunci pragurile sunt conservatoare
  (rezultatele incerte merg în „de verificat”).
- Interfața este doar în română.

## Tehnologii

- [face-api.js](https://github.com/vladmandic/face-api) (TensorFlow.js) pentru detectarea și recunoașterea fețelor
- IndexedDB și File System Access API pentru stocare locală și acces la foldere
- JSZip pentru exportul pozelor găsite
