// discover.me — Potrivirea fețelor: distanțe între descriptori, scor de consens, praguri.
'use strict';

// Potrivirea fețelor pe amprente SFace (vectori cu norma 1; distanța euclidiană între doi vectori)
// Decizia „e aceeași persoană?” este o PROBABILITATE dată de o regresie logistică antrenată pe fețe cu identitate cunoscută
// (LFW: 150 de persoane, ~2.000 de poze + 600 de străini; poze normale și degradate: blur, întuneric, rotite, mici, mască, ochelari, JPEG).
// Trăsături: d1 = distanța până la cea mai apropiată referință, d2 = până la a doua, q = mărimea feței (log).
// Cu 3 referințe, la P ≥ 0,99 s-au obținut 99,96% precizie și ~87% din pozele corecte (97% din cele normale); vezi tools/bench.
const MATCH_MODEL={d1:-28.1265,d2:-24.1805,q:.3464,b:54.5801,maxD:1.2};
// precise: „sigure” = potriviri cu P ≥ 0,97 (în test: 100% precizie, 1 greșeală în 300 de căutări); „de verificat” de la P ≥ 0,50.
// extended: coboară pragurile (mai multe rezultate, dintre care unele greșite) și le marchează „de verificat”.
const MATCH_POLICIES={
  precise:{strongP:.97,reviewP:.50,strongMinScore:.55,strongMinSize:36,reviewMinSize:28,mode:'precise'},
  extended:{strongP:.95,reviewP:.40,strongMinScore:.50,strongMinSize:30,reviewMinSize:24,mode:'extended'}
};
// Praguri secundare (măsurate pe același benchmark)
const REF_SPREAD_WARN=1.08;     // mediana distanțelor dintre referințe: peste ea, probabil nu e aceeași persoană în toate pozele
const TEACH_MAX_DIST=.85;       // o față confirmată de utilizator devine referință doar dacă e suficient de apropiată
function matchPolicy(mode){return MATCH_POLICIES[mode]||MATCH_POLICIES.precise}
// Probabilitatea (0..1) din distanțe și mărimea feței.
function matchProb(best,support,faceSize){
  if(!(best<=MATCH_MODEL.maxD))return 0;
  const q=Math.log(Math.max(20,Math.min(220,faceSize||0))/60),t=MATCH_MODEL.d1*best+MATCH_MODEL.d2*support+MATCH_MODEL.q*q+MATCH_MODEL.b;
  return 1/(1+Math.exp(-t));
}
function querySignature(){if(selectedPersonId)return 'person:'+selectedPersonId+':'+referenceDescriptors.length;let hash=2166136261;for(const descriptor of referenceDescriptors){const view=new DataView(descriptor.buffer,descriptor.byteOffset,descriptor.byteLength);for(let i=0;i<descriptor.length;i++){hash^=view.getInt32(i*4,true);hash=Math.imul(hash,16777619)}}return `refs:${referenceDescriptors.length}:${hash>>>0}`}
function descriptorDistance(a,b){if(!a||!b||a.length!==b.length)return Infinity;let sum=0;for(let k=0;k<a.length;k++){const delta=a[k]-b[k];sum+=delta*delta}return Math.sqrt(sum)}
function referenceSpread(descs){const distances=[];for(let i=0;i<descs.length;i++)for(let j=i+1;j<descs.length;j++){const d=descriptorDistance(descs[i],descs[j]);if(Number.isFinite(d))distances.push(d)}if(!distances.length)return null;distances.sort((a,b)=>a-b);return distances[Math.floor(distances.length/2)]}
function faceScoreFast(face,refs){
  // Cele mai apropiate două referințe, într-un singur pas și fără sortare. Cu distanța > maxD față de toate referințele, fața nu poate fi
  // potrivire (P≈0), deci calculul se oprește devreme.
  const v=face.d;if(!v||refs.length<2)return null;
  const n=v.length,CUT=MATCH_MODEL.maxD*MATCH_MODEL.maxD;let b1=Infinity,b2=Infinity;
  for(let j=0;j<refs.length;j++){const r=refs[j];if(r.length!==n)continue;const lim=b2<CUT?b2:CUT;let sum=0,k=0;
    for(;k<n;k++){const d=v[k]-r[k];sum+=d*d;if(sum>lim)break}
    if(k<n)continue;
    if(sum<b1){b2=b1;b1=sum}else if(sum<b2)b2=sum}
  if(!(b2<Infinity)||b1>CUT)return null;
  const best=Math.sqrt(b1),support=Math.sqrt(b2);return {best,support,score:best*.35+support*.65,prob:matchProb(best,support,Number(face.m)||0)};
}

// Extinderea profilului (query expansion)
// Profilul are doar câteva referințe, făcute de obicei în aceeași poză/lumină. Aceeași persoană din alt unghi poate cădea puțin peste prag.
// După prima trecere, fețele FOARTE sigure găsite în album (praguri strânse) devin referințe suplimentare și se rescorează restul.
// Garanția de precizie: lista „sigure” nu se schimbă niciodată; ce apare doar datorită extinderii e marcat `expanded` și merge
// la „de verificat” (nebifat), unde îl confirmi tu cu ✓/✗. O singură extindere, fără lanț (seed-urile vin doar din referințele reale).
const EXPAND={seedP:.995,seedFaceScore:.80,seedFaceSize:80,maxSeeds:10,minNew:.30};
function pickExpansionSeeds(scoreRows,refs){
  const pool=refs.slice(),cand=[];
  for(const fr of scoreRows)if(fr)for(const r of fr)
    if(r.d&&matchProb(r.best,r.support,r.faceSize)>=EXPAND.seedP&&r.faceScore>=EXPAND.seedFaceScore&&r.faceSize>=EXPAND.seedFaceSize)cand.push(r);
  cand.sort((a,b)=>b.score-a.score);                  // întâi cele de la marginea zonei sigure: aduc cea mai multă informație nouă
  const seeds=[];
  for(const r of cand){if(seeds.length>=EXPAND.maxSeeds)break;
    if(pool.every(p=>descriptorDistance(p,r.d)>=EXPAND.minNew)){seeds.push(r.d);pool.push(r.d)}}
  return seeds;
}
// scoreRows[i] corespunde lui entries[i]. Modifică scoreRows pe loc și întoarce numărul de rânduri aduse de extindere.
// Se calculează cu pragul cel mai larg (extended), pentru că scorurile se păstrează în cache indiferent de modul ales;
// la afișare, `levelOf` aplică pragul modului curent.
function expandSearch(scoreRows,refs,entries){
  const seeds=pickExpansionSeeds(scoreRows,refs);if(!seeds.length)return 0;
  const wide=refs.concat(seeds),policy=MATCH_POLICIES.extended;let added=0;
  for(let i=0;i<scoreRows.length;i++){
    const entry=entries[i];if(!entry)continue;
    const known=new Map((scoreRows[i]||[]).map(r=>[r.d,r])),orig=scoreRows[i]||[];let changed=false;const rows=[];
    for(const face of entry.faces||[]){
      const o=known.get(face.d);
      if(o&&classifyScore(o,policy)==='strong'){rows.push(o);continue}
      const m=faceScoreFast(face,wide);
      if(m&&classifyScore({...m,faceScore:Number(face.s)||0,faceSize:Number(face.m)||0},policy)!=='none'){
        rows.push({entry,...m,faceScore:Number(face.s)||0,faceSize:Number(face.m)||0,cloth:face.c||null,d:face.d,expanded:true});changed=true;added++;
      }else if(o)rows.push(o);
    }
    if(changed)scoreRows[i]=rows;
  }
  return added;
}
// Un rând adus de extindere nu poate fi „sigur”: cel mult „de verificat”.
function levelOf(row,policy){const l=classifyScore(row,policy);return row.expanded&&l==='strong'?'review':l}

function classifyScore(row,policy){
  const p=matchProb(row.best,row.support,row.faceSize);
  if(p>=policy.strongP&&row.faceScore>=policy.strongMinScore&&row.faceSize>=policy.strongMinSize)return 'strong';
  if(p>=policy.reviewP&&row.faceSize>=policy.reviewMinSize)return 'review';
  return 'none';
}
