// discover.me — Poze HEIC/HEIF (formatul implicit al iPhone-ului).
// Chrome, Edge și Firefox nu pot afișa sau analiza HEIC, așa că le convertim direct în browser (pozele nu pleacă nicăieri).
// Convertorul (~2 MB, libheif) se descarcă doar când apare prima poză HEIC; Safari le citește singur și nu are nevoie de el.
'use strict';
const HEIC_LIB='https://cdn.jsdelivr.net/npm/heic-to@1.6.4/dist/iife/heic-to.js';

function looksHeic(file){return !!file&&(/\.(heic|heif)$/i.test(file.name||'')||/^image\/hei[cf]/i.test(file.type||''))}
let heicLibPromise=null,heicNative=null;
function loadHeicLib(){
  if(window.HeicTo)return Promise.resolve(window.HeicTo);
  return heicLibPromise||(heicLibPromise=new Promise((res,rej)=>{
    const s=document.createElement('script');s.src=HEIC_LIB;
    s.onload=()=>window.HeicTo?res(window.HeicTo):rej(new Error('Convertorul HEIC nu a pornit'));
    s.onerror=()=>{heicLibPromise=null;rej(new Error('Nu am putut descărca convertorul HEIC. Verifică internetul.'))};
    document.head.append(s);
  }));
}
// Browserul decodează singur HEIC? (Safari da; Chrome/Edge/Firefox nu.) Se verifică o singură dată.
async function heicDecodesNatively(file){
  if(heicNative!==null)return heicNative;
  try{const b=await createImageBitmap(file);b.close?.();heicNative=true}catch(e){heicNative=false}
  return heicNative;
}
async function heicConvert(file,type,quality){
  const lib=await loadHeicLib(),fn=typeof lib==='function'?lib:lib.heicTo;
  return fn({blob:file,type,quality});
}
// Imagine gata de desenat pentru orice poză. JPEG/PNG respectă rotirea din EXIF; HEIC e convertit dacă e nevoie.
async function decodeImage(file){
  if(looksHeic(file)&&!(await heicDecodesNatively(file)))return heicConvert(file,'bitmap');
  try{return await createImageBitmap(file,{imageOrientation:'from-image'})}catch(e){return await createImageBitmap(file)}
}
// Fișier afișabil într-un <img>: originalul, sau un JPEG pentru HEIC. Ultimele câteva conversii rămân în memorie.
const heicJpegCache=new Map();
async function displayBlob(file){
  if(!looksHeic(file)||await heicDecodesNatively(file))return file;
  const key=`${file.name}|${file.size}|${file.lastModified}`;
  if(!heicJpegCache.has(key)){heicJpegCache.set(key,heicConvert(file,'image/jpeg',.9));if(heicJpegCache.size>6)heicJpegCache.delete(heicJpegCache.keys().next().value)}
  return heicJpegCache.get(key);
}
