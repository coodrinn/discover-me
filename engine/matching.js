// discover.me — Potrivirea fețelor: distanțe între descriptori, scor de consens, praguri.
'use strict';

// Pragurile de potrivire. Modul implicit prioritizează precizia;
// modul extins adaugă o zonă separată de rezultate de verificat manual.
const MATCH_POLICIES={
  precise:{strongBest:.48,strongSupport:.54,reviewBest:.56,reviewSupport:.62,mode:'precise'},
  extended:{strongBest:.50,strongSupport:.56,reviewBest:.60,reviewSupport:.66,mode:'extended'}
};
function matchPolicy(mode){return MATCH_POLICIES[mode]||MATCH_POLICIES.precise}
function querySignature(){if(selectedPersonId)return 'person:'+selectedPersonId+':'+referenceDescriptors.length;let hash=2166136261;for(const descriptor of referenceDescriptors){const view=new DataView(descriptor.buffer,descriptor.byteOffset,descriptor.byteLength);for(let i=0;i<descriptor.length;i++){hash^=view.getInt32(i*4,true);hash=Math.imul(hash,16777619)}}return `refs:${referenceDescriptors.length}:${hash>>>0}`}
function descriptorDistance(a,b){if(!a||!b||a.length!==b.length)return Infinity;let sum=0;for(let k=0;k<a.length;k++){const delta=a[k]-b[k];sum+=delta*delta}return Math.sqrt(sum)}
function referenceSpread(descs){const distances=[];for(let i=0;i<descs.length;i++)for(let j=i+1;j<descs.length;j++){const d=descriptorDistance(descs[i],descs[j]);if(Number.isFinite(d))distances.push(d)}if(!distances.length)return null;distances.sort((a,b)=>a-b);return distances[Math.floor(distances.length/2)]}
function faceScoreFast(face,refs){
  // Aceleași valori ca înainte (cele mai apropiate două referințe), dar într-un singur pas și fără sortare.
  // Fețele cu distanța > 0.80 nu pot ajunge în nicio categorie (nici cu ajustarea ținutei), deci nu se mai calculează complet.
  const v=face.d;if(!v||refs.length<2)return null;
  const n=v.length,CUT=.8*.8;let b1=Infinity,b2=Infinity;
  for(let j=0;j<refs.length;j++){const r=refs[j];if(r.length!==n)continue;const lim=b2<CUT?b2:CUT;let sum=0,k=0;
    for(;k<n;k++){const d=v[k]-r[k];sum+=d*d;if(sum>lim)break}
    if(k<n)continue;
    if(sum<b1){b2=b1;b1=sum}else if(sum<b2)b2=sum}
  if(!(b2<Infinity)||b1>.72*.72)return null;
  const best=Math.sqrt(b1),support=Math.sqrt(b2);return {best,support,score:best*.35+support*.65};
}

// ===== Extinderea profilului (query expansion) =====
// Profilul are doar câteva referințe, făcute de obicei în aceeași poză/lumină. Aceeași persoană din alt unghi poate cădea puțin peste prag.
// După prima trecere, fețele FOARTE sigure găsite în album (praguri strânse) devin referințe suplimentare și se rescorează restul.
// Garanția de precizie: lista „sigure” nu se schimbă niciodată; ce apare doar datorită extinderii e marcat `expanded` și merge
// la „de verificat” (nebifat), unde îl confirmi tu cu ✓/✗. O singură extindere, fără lanț (seed-urile vin doar din referințele reale).
const EXPAND={seedBest:.42,seedSupport:.48,seedFaceScore:.80,seedFaceSize:80,maxSeeds:10,minNew:.15};
function pickExpansionSeeds(scoreRows,refs){
  const pool=refs.slice(),cand=[];
  for(const fr of scoreRows)if(fr)for(const r of fr)
    if(r.d&&r.best<=EXPAND.seedBest&&r.support<=EXPAND.seedSupport&&r.faceScore>=EXPAND.seedFaceScore&&r.faceSize>=EXPAND.seedFaceSize)cand.push(r);
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
  if(row.best<=policy.strongBest&&row.support<=policy.strongSupport&&row.faceScore>=.60&&row.faceSize>=48)return 'strong';
  if(row.best<=policy.reviewBest&&row.support<=policy.reviewSupport)return 'review';
  return 'none';
}
