// discover.me — „Cine apare în album?”: grupează fețele din index pe persoane, fără profiluri create înainte.
// Grupare incrementală pe centre (fiecare față merge la cel mai apropiat grup sub prag), apoi unirea grupurilor apropiate.
'use strict';

const CLUSTER_JOIN=.47, CLUSTER_MERGE=.40, CLUSTER_MAX_FACES=6000, CLUSTER_MIN_PHOTOS=3;

// Distanță cu oprire timpurie: dacă depășește limita, nu mai calculează restul (mult mai rapid pe albume mari).
function distanceBelow(a,b,limit){const lim=limit*limit;let s=0;for(let k=0;k<a.length;k++){const d=a[k]-b[k];s+=d*d;if(s>lim)return Infinity}return Math.sqrt(s)}

async function clusterAlbumFaces(entries,onProgress){
  const faces=[];
  for(const e of entries)for(const f of e.faces||[])if(f.d&&f.d.length===128&&f.s>=.6&&f.m>=44)faces.push({e,f,q:f.s*Math.min(f.m,160)});
  faces.sort((a,b)=>b.q-a.q);                                         // fețele cele mai clare formează grupurile
  const list=faces.slice(0,CLUSTER_MAX_FACES),groups=[];
  for(let i=0;i<list.length;i++){
    const d=list[i].f.d;let best=null,bd=CLUSTER_JOIN;
    for(const g of groups){const x=distanceBelow(g.mean,d,bd);if(x<bd){bd=x;best=g}}
    if(best){best.items.push(list[i]);const n=best.items.length;for(let k=0;k<128;k++)best.mean[k]+=(d[k]-best.mean[k])/n}
    else groups.push({mean:Float32Array.from(d),items:[list[i]]});
    if(i%250===0){onProgress&&onProgress(i/list.length*.9);await new Promise(r=>setTimeout(r,0))}
  }
  // Unește grupurile care sunt de fapt aceeași persoană (ex. cu și fără ochelari).
  const big=groups.filter(g=>g.items.length>=2).sort((a,b)=>b.items.length-a.items.length);
  for(let i=0;i<big.length;i++){const a=big[i];if(a.dead)continue;
    for(let j=i+1;j<big.length;j++){const b=big[j];if(b.dead)continue;
      if(distanceBelow(a.mean,b.mean,CLUSTER_MERGE)<CLUSTER_MERGE){const na=a.items.length,nb=b.items.length;
        for(let k=0;k<128;k++)a.mean[k]=(a.mean[k]*na+b.mean[k]*nb)/(na+nb);a.items.push(...b.items);b.dead=true}}
    if(i%50===0)await new Promise(r=>setTimeout(r,0));
  }
  onProgress&&onProgress(1);
  return big.filter(g=>!g.dead).map(g=>{
    const photos=new Set(g.items.map(x=>x.e.key));
    const ranked=g.items.map(x=>({...x,dist:descriptorDistance(x.f.d,g.mean)})).sort((a,b)=>a.dist-b.dist);
    // reprezentanți: fețe apropiate de centru, din poze diferite, cât mai clare
    const reps=[],seen=new Set();for(const x of ranked){if(seen.has(x.e.key))continue;seen.add(x.e.key);reps.push(x);if(reps.length>=10)break}
    const cover=reps.slice(0,4).sort((a,b)=>b.q-a.q)[0];
    return {mean:g.mean,photos:photos.size,faces:g.items.length,reps,cover};
  }).filter(g=>g.photos>=CLUSTER_MIN_PHOTOS).sort((a,b)=>b.photos-a.photos);
}

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
