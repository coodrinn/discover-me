# Benchmark de recunoaștere facială

Măsoară cât de bine găsește motorul persoanele corecte și cât de rar greșește. Rulează **motorul real al aplicației** (face-api + SFace)
în Edge/Chrome pe poze cu identitate cunoscută din [LFW](http://vis-www.cs.umass.edu/lfw/) și salvează amprentele; evaluările rulează apoi
doar în Node, rapid, pe amprentele salvate.

## Pregătire

```
npm i --no-save playwright          # Edge/Chrome instalat în sistem; scripturile folosesc channel: 'msedge'
# descarcă LFW (lfw.tgz) și extrage-l în tools/bench/lfw/  (rezultă tools/bench/lfw/lfw/<Nume_Persoană>/*.jpg)
# sau setează LFW_DIR=calea/spre/folderul/lfw
```

## 1. Extragerea amprentelor (~15 minute)

```
GPU=1 node tools/bench/extract.js tools/bench/lfw_both.json 20 8 150 600 6
#                                  fișier ieșire        │  │  │   │   └ procese paralele
#                                  max poze/persoană ───┘  │  │   └ străini (distractori)
#                                  min poze/persoană ──────┘  └ nr. persoane
```

Pentru fiecare poză: original, oglindită și o variantă degradată (blur, întuneric, mică, rotită, mască peste gură, bandă peste ochi, JPEG
slab). Salvează amprenta SFace (`e`) și pe cea veche dlib (`d`), pentru comparații.

## 2. Evaluări (secunde)

```
KEY=e node tools/bench/pairs.js ./tools/bench/lfw_both.json d,e          # amprenta veche (d) vs SFace (e): perechi aceeași/altă persoană
KEY=e node tools/bench/eval_search.js tools/bench/lfw_both.json 3 current      # căutare cu 3 referințe: recall/precizie
KEY=e node tools/bench/eval_search.js tools/bench/lfw_both.json 3 current_ext  # la fel, modul „extins” (cel implicit în aplicație)
KEY=e node tools/bench/eval_cluster.js tools/bench/lfw_both.json v2 140        # „Cine apare în album?”: dubluri, puritate
KEY=e node tools/bench/fit_model.js tools/bench/lfw_both.json 2 d1,d2,q        # reantrenează regula (coeficienții din MATCH_MODEL)
KEY=e node tools/bench/spread.js ; KEY=e node tools/bench/farthr.js            # pragurile secundare
node tools/bench/e2e_full.js                                                   # tot fluxul în aplicație: album → grupuri → profil → căutare
```

Variabile utile: `POLICY=strongP,reviewP[,minScore,minSize]` și `POLICYX=...` (mod extins) suprascriu pragurile; `EXPAND='{"seedP":0.98}'`;
`CL='{"join":0.86,"merge":0.80,"attach":0.88}'` pentru gruparea din album.

## Rezultate (LFW: 150 de persoane, ~2.000 de poze + 600 de străini; 35% din poze degradate)

| | amprenta veche (dlib) | SFace (actual) |
|---|---|---|
| separare aceeași/altă persoană, poze normale, la 1 alarmă falsă la 10.000 | 58,3% | **98,2%** |
| aceeași, poză normală vs degradată, la 1 la 1.000 | 52,5% | **92,3%** |
| căutare, rezultate „sigure”: precizie | 89,9% | **99,9%** |
| căutare, „sigure”: recall (poze normale / toate) | 82,7% / 65,4% | **96,8% / 86,2%** (mod extins) |
| căutare, „sigure” + „de verificat”: recall | 82,2% | **94,0%** |
| „Cine apare în album?”: dubluri / grupuri amestecate (60 persoane) | 3,3 / 7,7 | **0 / 0,3** |

**Limite.** LFW sunt poze de presă, mai ușoare decât un album de familie în unele privințe (frontale, lumină bună) și mai grele în altele
(multe persoane care seamănă între ele). Degradările sunt simulate. Pragurile sunt alese conservator (precizie înainte de recall), dar
numerele din aplicația ta pot diferi: la poze foarte mici, profil, ochelari de soare sau copii, recall-ul scade, iar rezultatele
„de verificat” (✓ / ✗) rămân importante.
