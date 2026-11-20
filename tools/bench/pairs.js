// Verificare pe perechi: AUC și TAR la FAR fix, pentru fiecare tip de amprentă.
const d=require(process.argv[2]);const keys=process.argv[3]?process.argv[3].split(','):['d','e','eb'];
function prim(faces,W,H){let b=null,bd=1e9;for(const f of faces||[]){if(f.m<24)continue;const dd=Math.hypot(f.x+f.w/2-W/2,f.y+f.h/2-H/2);if(dd<bd){bd=dd;b=f}}return b}
const items=d.filter(r=>!r.error).map(r=>({id:r.id,dis:r.distractor,o:prim(r.orig,r.W,r.H),h:prim(r.hard,r.W,r.H),kind:r.kind})).filter(x=>x.o);
const dist=(a,b,cos)=>{let s=0;if(cos){for(let k=0;k<a.length;k++)s+=a[k]*b[k];return 1-s}for(let k=0;k<a.length;k++){const t=a[k]-b[k];s+=t*t}return Math.sqrt(s)};
function evalKey(key,qa,qb,label){
  const cos=key!=='d';const gen=[],imp=[];
  for(let i=0;i<items.length;i++){const a=qa(items[i]);if(!a||!a[key])continue;for(let j=i+1;j<items.length;j++){const b=qb(items[j]);if(!b||!b[key])continue;
    const same=!items[i].dis&&!items[j].dis&&items[i].id===items[j].id;const dd=dist(a[key],b[key],cos);(same?gen:imp).push(dd)}}
  gen.sort((x,y)=>x-y);imp.sort((x,y)=>x-y);
  // AUC = P(gen < imp)
  let j=0,auc=0;for(const g of gen){while(j<imp.length&&imp[j]<g)j++;auc+=(imp.length-j)/imp.length}auc/=gen.length;
  const tar=far=>{const thr=imp[Math.floor(far*imp.length)];let k=0;while(k<gen.length&&gen[k]<thr)k++;return k/gen.length};
  console.log(`${label.padEnd(22)} ${key.padEnd(3)} gen=${gen.length} imp=${imp.length}  AUC ${auc.toFixed(5)}  TAR@FAR1e-2 ${(100*tar(1e-2)).toFixed(1)}%  @1e-3 ${(100*tar(1e-3)).toFixed(1)}%  @1e-4 ${(100*tar(1e-4)).toFixed(1)}%`);
}
for(const k of keys){evalKey(k,x=>x.o,x=>x.o,'orig vs orig');}
for(const k of keys){evalKey(k,x=>x.o,x=>x.h||null,'orig vs degradat');}
