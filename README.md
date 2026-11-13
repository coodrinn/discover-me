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
Prima pornire descarcă modelele de recunoaștere a fețelor (este nevoie de internet).

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
│       ├── settings.js     # Setări (mod, culoare), efecte la atingere
│       └── space.js        # Fundal animat (stele) și tutorialul de la prima pornire
└── engine/                 # Motorul (rulează local, în browser)
    ├── config.js           # Versiuni, modele, starea comună
    ├── storage.js          # IndexedDB: index, persoane, setări
    ├── album.js            # Citirea folderelor și a fișierelor imagine
    ├── faces.js            # Detectarea fețelor (face-api) și indiciul de ținută
    ├── matching.js         # Potrivirea fețelor: distanțe, scor de consens, praguri
    └── license.js          # Planuri, prețuri, verificarea cheilor de licență
tools/license/              # Generarea cheilor de licență (rulează doar la tine, cu Node.js)
```

Scripturile sunt încărcate în ordinea din `index.html`: întâi motorul, apoi interfața.

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

## Tehnologii

- [face-api.js](https://github.com/vladmandic/face-api) (TensorFlow.js) pentru detectarea și recunoașterea fețelor
- IndexedDB și File System Access API pentru stocare locală și acces la foldere
- JSZip pentru exportul pozelor găsite
