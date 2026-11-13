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
│       └── settings.js     # Setări (mod, culoare, stil), ghid rapid, efecte la atingere
└── engine/                 # Motorul (rulează local, în browser)
    ├── config.js           # Versiuni, modele, starea comună
    ├── storage.js          # IndexedDB: index, persoane, setări
    ├── album.js            # Citirea folderelor și a fișierelor imagine
    ├── faces.js            # Detectarea fețelor (face-api) și indiciul de ținută
    └── matching.js         # Potrivirea fețelor: distanțe, scor de consens, praguri
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

## Tehnologii

- [face-api.js](https://github.com/vladmandic/face-api) (TensorFlow.js) pentru detectarea și recunoașterea fețelor
- IndexedDB și File System Access API pentru stocare locală și acces la foldere
- JSZip pentru exportul pozelor găsite
