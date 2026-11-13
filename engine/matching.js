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

function classifyScore(row,policy){
  if(row.best<=policy.strongBest&&row.support<=policy.strongSupport&&row.faceScore>=.60&&row.faceSize>=48)return 'strong';
  if(row.best<=policy.reviewBest&&row.support<=policy.reviewSupport)return 'review';
  return 'none';
}
