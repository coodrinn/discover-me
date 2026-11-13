// discover.me — Album din linkuri directe către poze (ex. https://site.ro/poza.jpg).
// Pozele se descarcă în browser și sunt tratate exact ca un album din folder.
// Funcționează doar dacă site-ul care găzduiește pozele permite descărcarea din alte pagini (CORS).
'use strict';
const LINK_MAX_BYTES=40*1024*1024, LINK_CONCURRENCY=4, LINK_TIMEOUT_MS=30000;

// Extrage linkurile http(s) dintr-un text lipit (câte unul pe rând, separate prin spații sau virgule).
function parseLinks(text){
  const seen=new Set(),out=[];
  for(const raw of String(text||'').split(/[\s,;]+/)){
    const t=raw.trim().replace(/^[<("']+|[>)"']+$/g,'');if(!t)continue;
    let u;try{u=new URL(t)}catch(e){continue}
    if(!/^https?:$/.test(u.protocol))continue;
    const key=u.href;if(!seen.has(key)){seen.add(key);out.push(key)}
  }
  return out;
}
function fileNameFromUrl(url,type,i){
  let name='';try{name=decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop()||'')}catch(e){}
  name=name.replace(/[\\/:*?"<>|]+/g,'_').slice(-80);
  const ext=(type.split('/')[1]||'jpg').replace('jpeg','jpg').replace('svg+xml','svg');
  if(!/\.(jpe?g|png|webp|gif|bmp|avif|heic|tiff?)$/i.test(name))name=(name||`poza-${i+1}`)+'.'+ext;
  return name;
}
async function fetchImage(url,i){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),LINK_TIMEOUT_MS);
  try{
    let res;
    try{res=await fetch(url,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',signal:ctrl.signal})}
    catch(e){return {url,error:e.name==='AbortError'?'durează prea mult (timeout)':'site-ul nu permite descărcarea din alte pagini'}}
    if(!res.ok)return {url,error:res.status===404?'pagina nu există (404)':res.status===403?'acces interzis (403)':`eroare ${res.status}`};
    const type=(res.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
    if(type&&!type.startsWith('image/'))return {url,error:type.includes('html')?'e o pagină web, nu o imagine — folosește linkul direct către poză':'nu este o imagine'};
    const len=+res.headers.get('content-length')||0;if(len>LINK_MAX_BYTES)return {url,error:'imaginea e prea mare (peste 40 MB)'};
    const blob=await res.blob();if(blob.size>LINK_MAX_BYTES)return {url,error:'imaginea e prea mare (peste 40 MB)'};
    const realType=blob.type||type||'image/jpeg';
    if(!realType.startsWith('image/'))return {url,error:'nu este o imagine'};
    const lm=Date.parse(res.headers.get('last-modified')||'')||0;     // stabil: poza nu se reindexează la fiecare încărcare
    return {url,file:new File([blob],fileNameFromUrl(url,realType,i),{type:realType,lastModified:lm})};
  }finally{clearTimeout(timer)}
}
// Descarcă toate linkurile, câte LINK_CONCURRENCY deodată. onProgress(done,total).
async function downloadLinks(urls,onProgress){
  const ok=[],failed=[];let next=0,done=0;
  async function worker(){while(next<urls.length){const i=next++;const r=await fetchImage(urls[i],i);(r.file?ok:failed).push({...r,i});done++;onProgress&&onProgress(done,urls.length)}}
  await Promise.all(Array.from({length:Math.min(LINK_CONCURRENCY,urls.length)},worker));
  ok.sort((a,b)=>a.i-b.i);failed.sort((a,b)=>a.i-b.i);
  return {ok,failed};
}
