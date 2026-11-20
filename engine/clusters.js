// discover.me — „Cine apare în album?”: grupează fețele din index pe persoane, fără profiluri create înainte.
// Vezi clusterAlbumFacesV2 mai jos (grupare pe amprente SFace, cu regula „aceeași persoană nu apare de două ori în aceeași poză”).
'use strict';

// Distanță cu oprire timpurie: dacă depășește limita, nu mai calculează restul (mult mai rapid pe albume mari).
function distanceBelow(a,b,limit){const lim=limit*limit;let s=0;for(let k=0;k<a.length;k++){const d=a[k]-b[k];s+=d*d;if(s>lim)return Infinity}return Math.sqrt(s)}

// Decupează fața dintr-o poză indexată. Coordonatele din index sunt pe imaginea micșorată la indexare.
async function faceCropFromEntry(entry,face,size=128){
  const file=entry.file;if(!file)return null;
  const b=await decodeImage(file);
  const maxSide=/\|deep$/.test(entry.key)?2000:1400,s=Math.min(1,maxSide/Math.max(b.width,b.height));
  const side=Math.max(face.w,face.h)*1.55/s,cx=(face.x+face.w/2)/s,cy=(face.y+face.h/2)/s;
  const o=document.createElement('canvas');o.width=o.height=size;const x=o.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,size,size);
  x.drawImage(b,cx-side/2,cy-side/2,side,side,0,0,size,size);b.close?.();
  return o.toDataURL('image/jpeg',.84);
}

// Blocare pe plan („Cine apare în album?”): persoanele deja salvate rămân vizibile (dacă intră în plan);
// din cele NOI se văd doar atâtea câte mai încap în plan, cele mai frecvente primele. Restul sunt blocate.
// groups: grupurile sortate după numărul de poze. Întoarce [{g, known, locked}] în aceeași ordine.
function lockAlbumGroups(groups,{limit,savedCount,knownFor,isUnlocked}){
  const slots=limit===Infinity?Infinity:Math.max(0,limit-savedCount);let used=0;
  return groups.map(g=>{
    const known=knownFor(g)||null;
    if(known)return {g,known,locked:!isUnlocked(known)};
    const locked=used>=slots;if(!locked)used++;
    return {g,known:null,locked};
  });
}

// ===== V2: „Cine apare în album?” pe amprente SFace (vectori cu norma 1, distanță euclidiană) =====
// Față de V1: (1) o persoană nu apare de două ori în aceeași poză, deci două grupuri care au fețe în aceleași poze NU se unesc;
// (2) grupurile mici se atașează la cele mari dacă sunt suficient de apropiate (mai puține grupuri duplicate, acoperire mai bună);
// (3) unirea folosește distanța dintre centre ȘI cea mai mică distanță dintre membri, ca să nu lege persoane diferite printr-o singură față.
// Pragurile (join/merge/attach) vin din benchmark: 140 de persoane + 600 de străini, poze normale și degradate:
// 0 dubluri, ~1% grupuri amestecate, puritate 99,4%, ~86% din fețe puse în grupuri. Vezi tools/bench.
const CL2={join:.86,merge:.80,attach:.88,minPhotos:3,maxFaces:6000,minScore:.6,minSize:44};
function sharePhoto(a,b){const [s,l]=a.keys.size<b.keys.size?[a.keys,b.keys]:[b.keys,a.keys];for(const k of s)if(l.has(k))return true;return false}
function mergeInto(a,b){const na=a.items.length,nb=b.items.length;for(let k=0;k<a.mean.length;k++)a.mean[k]=(a.mean[k]*na+b.mean[k]*nb)/(na+nb);for(const it of b.items)a.items.push(it);for(const k of b.keys)a.keys.add(k);b.dead=true}
async function clusterAlbumFacesV2(entries,onProgress,cfg){
  const C={...CL2,...(cfg||{})},faces=[];
  for(const e of entries)for(const f of e.faces||[])if(f.d&&f.d.length>=64&&f.s>=C.minScore&&f.m>=C.minSize)faces.push({e,f,q:f.s*Math.min(f.m,160)});
  faces.sort((a,b)=>b.q-a.q);
  const list=faces.slice(0,C.maxFaces),groups=[];
  for(let i=0;i<list.length;i++){
    const d=list[i].f.d,key=list[i].e.key;let best=null,bd=C.join;
    for(const g of groups){if(g.keys.has(key))continue;const x=distanceBelow(g.mean,d,bd);if(x<bd){bd=x;best=g}}
    if(best){best.items.push(list[i]);best.keys.add(key);const n=best.items.length;for(let k=0;k<d.length;k++)best.mean[k]+=(d[k]-best.mean[k])/n}
    else groups.push({mean:Float32Array.from(d),items:[list[i]],keys:new Set([key])});
    if(i%100===0){onProgress&&onProgress(i/list.length*.8);await new Promise(r=>setTimeout(r,0))}
  }
  // unire: grupurile mari apropiate, dacă nu au poze comune
  const big=groups.filter(g=>g.items.length>=3).sort((a,b)=>b.items.length-a.items.length);
  for(let i=0;i<big.length;i++){const a=big[i];if(a.dead)continue;
    for(let j=i+1;j<big.length;j++){const b=big[j];if(b.dead||sharePhoto(a,b))continue;
      if(distanceBelow(a.mean,b.mean,C.merge)<C.merge)mergeInto(a,b)}
    if(i%40===0){onProgress&&onProgress(.8+i/big.length*.1);await new Promise(r=>setTimeout(r,0))}
  }
  // atașare: grupurile mici (1–2 fețe) la cel mai apropiat grup mare, fără poze comune
  const anchors=big.filter(g=>!g.dead),small=groups.filter(g=>g.items.length<3);
  for(const s of small){let best=null,bd=C.attach;
    for(const a of anchors){if(sharePhoto(a,s))continue;const x=distanceBelow(a.mean,s.mean,bd);if(x<bd){bd=x;best=a}}
    if(best)mergeInto(best,s)}
  onProgress&&onProgress(1);
  return anchors.filter(g=>!g.dead).map(g=>{
    const photos=g.keys.size;
    const ranked=g.items.map(x=>({...x,dist:descriptorDistance(x.f.d,g.mean)})).sort((a,b)=>a.dist-b.dist);
    const reps=[],seen=new Set();for(const x of ranked){if(seen.has(x.e.key))continue;seen.add(x.e.key);reps.push(x);if(reps.length>=10)break}
    const cover=reps.slice(0,4).sort((a,b)=>b.q-a.q)[0];
    return {mean:g.mean,photos,faces:g.items.length,items:g.items,reps,cover};
  }).filter(g=>g.photos>=C.minPhotos).sort((a,b)=>b.photos-a.photos);
}
