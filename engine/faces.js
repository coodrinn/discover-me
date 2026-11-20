// discover.me — Detectarea fețelor (face-api) și indiciul de ținută (histogramă de culoare).
'use strict';

async function warmup(){try{const c=document.createElement('canvas');c.width=c.height=160;const x=c.getContext('2d');x.fillStyle='#888';x.fillRect(0,0,160,160);await faceapi.detectAllFaces(c,new faceapi.SsdMobilenetv1Options({minConfidence:.45}))}catch(e){}}
async function toCanvas(file,maxSide=1600){let b=await decodeImage(file);/* HEIC inclus: engine/heic.js */const s=Math.min(1,maxSide/Math.max(b.width,b.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(b.width*s));c.height=Math.max(1,Math.round(b.height*s));c.getContext('2d',{willReadFrequently:true}).drawImage(b,0,0,c.width,c.height);b.close?.();return c}
function faceBox(face){return face.detection.box}
// 5 repere (ochi stâng, ochi drept, nas, colț gură stâng, colț gură drept), în coordonatele imaginii. Folosite la alinierea fețelor.
function lm5Of(f,ox=0,oy=0){
  const P=f.landmarks&&f.landmarks.positions;if(!P||P.length<68)return null;
  const c=(a,b)=>{let x=0,y=0;for(let i=a;i<=b;i++){x+=P[i].x;y+=P[i].y}const n=b-a+1;return [x/n+ox,y/n+oy]};
  return [c(36,41),c(42,47),[P[30].x+ox,P[30].y+oy],[P[48].x+ox,P[48].y+oy],[P[54].x+ox,P[54].y+oy]].map(p=>[+p[0].toFixed(1),+p[1].toFixed(1)]);
}
// Amprenta veche (dlib) nu se mai calculează: decide SFace (engine/sface.js). Se poate reactiva pentru comparații (benchmark).
let DLIB_DESCRIPTORS=false;
async function detectOn(source,options){const t=faceapi.detectAllFaces(source,options).withFaceLandmarks();return DLIB_DESCRIPTORS?t.withFaceDescriptors():t}
// Detectare în două etape (rapidă):
//  1) SSD pe toată poza găsește fețele normale (cu repere faciale + descriptor).
//  2) Doar dacă pot exista fețe mici nedetectate, SSD caută DOAR poziții (fără descriptor) în 4 bucăți;
//     analiza completă (repere + descriptor) rulează numai pe bucățile în care apar fețe noi.
//  Înainte: 9 bucăți, fiecare cu analiză completă, pentru orice poză fără fețe sau cu fețe mici (de ~10x mai lent).
function overlapRatio(a,b){const ix=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)),iy=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));return ix*iy/Math.max(1,Math.min(a.width*a.height,b.width*b.height))}
async function findSmallFaces(c,known){
  const W=c.width,H=c.height,n=2,k=n-(n-1)*.25,tw=Math.ceil(W/k),th=Math.ceil(H/k),out=[];
  const tile=document.createElement('canvas');tile.width=tw;tile.height=th;const tx=tile.getContext('2d',{willReadFrequently:false});
  const opts=new faceapi.SsdMobilenetv1Options({minConfidence:.38});
  const edge=(b,x,y)=>(x>0&&b.x<4)||(x<n-1&&b.x+b.width>tw-4)||(y>0&&b.y<4)||(y<n-1&&b.y+b.height>th-4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const ox=Math.round(x*(W-tw)/(n-1)),oy=Math.round(y*(H-th)/(n-1));
    tx.clearRect(0,0,tw,th);tx.drawImage(c,ox,oy,tw,th,0,0,tw,th);
    const toCanvasBox=b=>({x:b.x+ox,y:b.y+oy,width:b.width,height:b.height});
    const seen=known.concat(out);
    const fresh=(await faceapi.detectAllFaces(tile,opts)).filter(d=>!edge(d.box,x,y)&&!seen.some(q=>overlapRatio(toCanvasBox(d.box),faceBox(q))>.35));
    if(!fresh.length)continue;                                   // nimic nou aici: fără analiză completă
    for(const f of await detectOn(tile,opts)){
      const b=faceBox(f),box=toCanvasBox(b);
      if(edge(b,x,y)||known.concat(out).some(q=>overlapRatio(box,faceBox(q))>.35))continue;
      out.push({detection:{score:f.detection.score,box},descriptor:f.descriptor,lm5:lm5Of(f,ox,oy)});
    }
  }
  return out;
}
// Reîncearcă pe imaginea cu chenar (×2, apoi ×1,5), dar pe o copie mică (max. 640 px; SSD oricum redimensionează la 512):
// costă puțin chiar și pentru poze fără fețe (peisaje, documente). Coordonatele se aduc înapoi pe imaginea originală.
async function findLargeFaces(c){
  const sc=Math.min(1,640/Math.max(c.width,c.height)),bw=Math.max(1,Math.round(c.width*sc)),bh=Math.max(1,Math.round(c.height*sc));
  let base=c;if(sc<1){base=document.createElement('canvas');base.width=bw;base.height=bh;base.getContext('2d',{willReadFrequently:true}).drawImage(c,0,0,bw,bh)}
  for(const k of [2,1.5]){
    const w=Math.round(bw*k),h=Math.round(bh*k),ox=(w-bw)/2,oy=(h-bh)/2;
    const p=document.createElement('canvas');p.width=w;p.height=h;const x=p.getContext('2d',{willReadFrequently:true});
    x.fillStyle='#808080';x.fillRect(0,0,w,h);x.drawImage(base,ox,oy);
    const found=(await detectOn(p,new faceapi.SsdMobilenetv1Options({minConfidence:.5}))).filter(f=>f.detection.score>=.6);
    if(found.length)return found.map(f=>{const b=faceBox(f),lm=lm5Of(f,-ox,-oy);return {detection:{score:f.detection.score,box:{x:(b.x-ox)/sc,y:(b.y-oy)/sc,width:b.width/sc,height:b.height/sc}},descriptor:f.descriptor,lm5:lm&&lm.map(([a,b2])=>[+(a/sc).toFixed(1),+(b2/sc).toFixed(1)])}});
  }
  return [];
}
async function detectFaces(file,deep=true,predecoded=null){
  const c=predecoded||await toCanvas(file,deep?2000:1400),W=c.width,H=c.height,m=Math.max(W,H);
  let all=await detectOn(c,new faceapi.SsdMobilenetv1Options({minConfidence:.42}));
  if(!all.length){const tiny=await detectOn(c,new faceapi.TinyFaceDetectorOptions({inputSize:512,scoreThreshold:.38}));if(tiny.length)all=tiny}
  // Fețe foarte mari în cadru (selfie, portret): SSD nu le vede. Cu un chenar gri în jur, aceeași față pare mai mică și e găsită.
  if(!all.length)all=await findLargeFaces(c);
  const minFace=all.length?Math.min(...all.map(f=>Math.min(faceBox(f).width,faceBox(f).height))):Infinity;
  // A doua etapă rulează când nu s-a găsit nimic sau când există fețe mici (pot fi și altele, mai mici).
  if(deep&&m>=850&&(!all.length||minFace<Math.min(W,H)*.10))all.push(...await findSmallFaces(c,all));
  all.sort((a,b)=>b.detection.score-a.detection.score);const unique=[];
  for(const f of all){const b=faceBox(f);if(!unique.some(q=>overlapRatio(b,faceBox(q))>.5))unique.push(f)}
  return {canvas:c,faces:unique.map(f=>{const b=faceBox(f);return {s:f.detection.score,m:Math.min(b.width,b.height),x:b.x,y:b.y,w:b.width,h:b.height,d:f.descriptor?Float32Array.from(f.descriptor):new Float32Array(0),lm:f.lm5||lm5Of(f)}})}
}
// ===== Îmbrăcăminte: histogramă de culoare a zonei de sub față (torace), folosită ca indiciu secundar =====
let _hc=null;
function clothHist(c,f){
  const W=c.width,H=c.height,w=f.w,h=f.h;
  const x0=Math.max(0,f.x-.8*w),x1=Math.min(W,f.x+1.8*w),y0=f.y+h*1.35,y1=Math.min(H,f.y+h*3.4);
  if(x1-x0<w*1.2||y1-y0<h*.8)return null;                       // fără torace vizibil
  const g=_hc||(_hc=document.createElement('canvas'));g.width=g.height=24;
  const cx=g.getContext('2d',{willReadFrequently:true});cx.imageSmoothingQuality='high';cx.drawImage(c,x0,y0,x1-x0,y1-y0,0,0,24,24);
  const d=cx.getImageData(0,0,24,24).data,bins=new Float32Array(53);let n=0;
  for(let i=0;i<d.length;i+=4){
    const r=d[i]/255,gr=d[i+1]/255,bl=d[i+2]/255,mx=Math.max(r,gr,bl),df=mx-Math.min(r,gr,bl),v=mx,s=mx?df/mx:0;
    let hue=0;if(df){hue=(mx===r?((gr-bl)/df)%6:mx===gr?(bl-r)/df+2:(r-gr)/df+4)*60;if(hue<0)hue+=360}
    let bi;
    if(s<.18||v<.18)bi=48+(v<.18?0:v<.4?1:v<.65?2:v<.85?3:4);
    else{if(hue<45&&s<.68&&v>=.3)continue;                      // pixeli de piele: ignorați
      bi=(Math.floor(hue/30)%12)*4+(s<.5?0:2)+(v<.6?0:1)}
    bins[bi]++;n++;
  }
  if(n<80)return null;
  for(let i=0;i<53;i++)bins[i]=Math.sqrt(bins[i]/n);              // vector unitar (Hellinger)
  return bins;
}
function clothDist(a,b){let d=0;for(let i=0;i<53;i++)d+=a[i]*b[i];return Math.sqrt(Math.max(0,1-d))}
// Ținutele se învață NUMAI din potrivirile foarte sigure, apoi ajută la cazurile incerte.
function attachClothing(rows){
  const seeds=[];
  for(const fr of rows){if(!fr||!fr.length)continue;let b=null;
    for(const r of fr)if(r.cloth&&matchProb(r.best,r.support,r.faceSize)>=.995&&r.faceScore>=.60&&r.faceSize>=60&&(!b||r.score<b.score))b=r;
    if(b)seeds.push(b.cloth)}
  const cl=[];
  if(seeds.length>=3)for(const h of seeds){
    let best=null,bd=.30;for(const c of cl){const d=clothDist(h,c.mean);if(d<bd){bd=d;best=c}}
    if(!best)cl.push({mean:Float32Array.from(h),n:1});
    else{let nn=0;for(let i=0;i<53;i++){best.mean[i]=(best.mean[i]*best.n+h[i])/(best.n+1);nn+=best.mean[i]**2}nn=Math.sqrt(nn)||1;for(let i=0;i<53;i++)best.mean[i]/=nn;best.n++}
  }
  rows.outfits=cl.filter(c=>c.n>=2).sort((a,b)=>b.n-a.n).slice(0,4);
  for(const fr of rows)if(fr)for(const r of fr)r.dc=(r.cloth&&rows.outfits.length)?Math.min(...rows.outfits.map(o=>clothDist(r.cloth,o.mean))):null;
}
// Ajustare mică (±0,04 în distanță ≈ ±2 în logit): indiciul hainelor e secundar, mai ales cu amprenta SFace, mult mai sigură decât cea veche.
const clothAdj=dc=>dc==null?0:Math.max(-.04,Math.min(.04,(dc-.34)*.24));
function cropThumb(canvas,f){const side=Math.max(f.w,f.h)*1.55,x=f.x+f.w/2-side/2,y=f.y+f.h/2-side/2,o=document.createElement('canvas');o.width=o.height=128;const ctx=o.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,128,128);ctx.drawImage(canvas,x,y,side,side,0,0,128,128);return o.toDataURL('image/jpeg',.84)}
function rotateCanvas(c,deg){const o=document.createElement('canvas');o.width=c.height;o.height=c.width;const x=o.getContext('2d',{willReadFrequently:true});x.translate(o.width/2,o.height/2);x.rotate(deg*Math.PI/180);x.drawImage(c,-c.width/2,-c.height/2);return o}

// Detectare + amprenta SFace. `d` devine amprenta SFace (128 numere, norma 1); fără ea o față nu poate fi potrivită, deci e omisă.
// Amprenta dlib din face-api rămâne doar în `dl` (pentru comparații); nu se folosește la potrivire.
async function detectFacesE(file,deep=true,predecoded=null){
  const r=await detectFaces(file,deep,predecoded),out=[];
  for(const f of r.faces){
    const e=await sfaceEmbed(r.canvas,f.lm);          // o eroare reală se propagă: poza NU se salvează ca „fără fețe”
    if(!e)continue;                                    // reperele nu permit alinierea: față inutilizabilă
    if(f.d.length)f.dl=f.d;f.d=e;delete f.lm;out.push(f);
  }
  r.faces=out;return r;
}
