// discover.me — Amprenta facială SFace (OpenCV Zoo, licență Apache-2.0), rulată local cu onnxruntime-web (MIT).
// Primește imaginea și cele 5 repere ale feței (din face-api), aliniază fața la 112×112 și întoarce un vector de 128 numere (norma 1).
// Două fețe ale aceleiași persoane au „distanța cosinus” mică; vezi matching.js.
'use strict';

// Șablonul standard (ArcFace) pe 112×112: ochi stâng, ochi drept, nas, colț gură stâng, colț gură drept.
const SFACE_TEMPLATE=[[38.2946,51.6963],[73.5318,51.5014],[56.0252,71.7366],[41.5493,92.3655],[70.7299,92.2041]];
let sfaceSession=null,sfaceLoading=null,_sfCanvas=null;

function sfaceLoadScript(u){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=u;s.onload=res;s.onerror=()=>{s.remove();rej(new Error('script '+u))};document.head.append(s)})}
// onProgress(0..1) se cheamă cât se descarcă modelul (~38 MB la prima pornire; apoi vine din memoria browserului).
function loadSFace(onProgress){
  if(sfaceSession)return Promise.resolve(sfaceSession);
  if(sfaceLoading)return sfaceLoading;
  sfaceLoading=(async()=>{
    if(!window.ort)await sfaceLoadScript(ORT_URL);
    ort.env.logLevel='error';
    // Adresă absolută: ONNX Runtime o folosește la import(). Din file:// import() din fișiere e interzis, deci dăm blob-uri (vezi engine/offline.js).
    let paths=new URL(ORT_BASE,document.baseURI).href;
    if(location.protocol==='file:'){
      const blob=async(f,t)=>URL.createObjectURL(new Blob([await (await fetch(ORT_BASE+f)).arrayBuffer()],{type:t}));
      paths={mjs:await blob('ort-wasm-simd-threaded.mjs','text/javascript'),wasm:await blob('ort-wasm-simd-threaded.wasm','application/wasm')};
    }
    ort.env.wasm.wasmPaths=paths;
    ort.env.wasm.numThreads=(self.crossOriginIsolated&&navigator.hardwareConcurrency>2)?Math.min(4,navigator.hardwareConcurrency>>1):1;
    const pre=self.dmSfaceFetch;self.dmSfaceFetch=null;                 // descărcarea pornită în timpul intro-ului (fără a doua descărcare)
    let res=pre?await pre:null;if(!res||!res.ok)res=await fetch(SFACE_MODEL);
    if(!res.ok)throw new Error('model SFace: '+res.status);
    const total=Number(res.headers.get('content-length'))||0;let buf;
    if(res.body&&total&&onProgress){
      const rd=res.body.getReader(),parts=[];let got=0;
      for(;;){const {done,value}=await rd.read();if(done)break;parts.push(value);got+=value.length;onProgress(Math.min(1,got/total))}
      buf=new Uint8Array(got);let o=0;for(const p of parts){buf.set(p,o);o+=p.length}buf=buf.buffer;
    }else buf=await res.arrayBuffer();
    sfaceSession=await ort.InferenceSession.create(buf,{executionProviders:['wasm'],graphOptimizationLevel:'all',logSeverityLevel:3});
    return sfaceSession;
  })().catch(e=>{sfaceLoading=null;throw e});
  return sfaceLoading;
}

// Transformare de similaritate (rotație + scară + translație), în sensul celor mai mici pătrate: repere → șablon.
function similarityToTemplate(lm){
  const n=5;let px=0,py=0,qx=0,qy=0;
  for(let i=0;i<n;i++){px+=lm[i][0];py+=lm[i][1];qx+=SFACE_TEMPLATE[i][0];qy+=SFACE_TEMPLATE[i][1]}
  px/=n;py/=n;qx/=n;qy/=n;
  let dot=0,cross=0,norm=0;
  for(let i=0;i<n;i++){const x=lm[i][0]-px,y=lm[i][1]-py,u=SFACE_TEMPLATE[i][0]-qx,v=SFACE_TEMPLATE[i][1]-qy;dot+=x*u+y*v;cross+=x*v-y*u;norm+=x*x+y*y}
  if(!(norm>1e-6))return null;
  const a=dot/norm,b=cross/norm;
  return {a,b,tx:qx-(a*px-b*py),ty:qy-(b*px+a*py)};
}
function alignFaceCanvas(src,lm,size=112){
  const t=similarityToTemplate(lm);if(!t)return null;
  const c=_sfCanvas||(_sfCanvas=document.createElement('canvas'));c.width=c.height=size;
  const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#000';x.fillRect(0,0,size,size);
  x.imageSmoothingQuality='high';x.setTransform(t.a,t.b,-t.b,t.a,t.tx,t.ty);x.drawImage(src,0,0);x.setTransform(1,0,0,1,0,0);
  return c;
}
function toNCHW(canvas){
  const s=canvas.width,d=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,s,s).data,out=new Float32Array(3*s*s),plane=s*s;
  const bgr=!!self.SFACE_BGR;   // doar pentru teste
  for(let i=0,p=0;i<plane;i++,p+=4){out[i]=d[bgr?p+2:p];out[plane+i]=d[p+1];out[2*plane+i]=d[bgr?p:p+2]}   // RGB, valori 0..255, fără normalizare
  return out;
}
// -> Float32Array(128) cu norma 1, sau null dacă fața nu poate fi aliniată
async function sfaceEmbed(src,lm){
  if(!lm||lm.length<5)return null;
  const s=await loadSFace(),crop=alignFaceCanvas(src,lm);if(!crop)return null;
  const input=new ort.Tensor('float32',toNCHW(crop),[1,3,112,112]);
  const out=await s.run({[s.inputNames[0]]:input});
  const v=Float32Array.from(out[s.outputNames[0]].data);let n=0;for(let i=0;i<v.length;i++)n+=v[i]*v[i];n=Math.sqrt(n)||1;
  for(let i=0;i<v.length;i++)v[i]/=n;
  return v;
}

// Prima rulare compilează programele WebAssembly; o facem înainte ca utilizatorul să aștepte rezultate.
async function warmupSFace(){try{const c=document.createElement('canvas');c.width=c.height=160;c.getContext('2d').fillStyle='#888';await sfaceEmbed(c,[[50,60],[110,60],[80,90],[55,120],[105,120]])}catch(e){}}
