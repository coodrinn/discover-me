// discover.me — Planuri și licențe (verificate local, fără server).
// O cheie de licență ("DM1-...") este semnată cu cheia privată a vânzătorului (tools/license/issue.js)
// și verificată aici cu cheia publică. Fără cheia privată, nimeni nu poate genera chei valide.
'use strict';

const PLANS={
  free:{id:'free',name:'Gratuit',people:1,price:'0 €',note:'Ca să încerci'},
  plus:{id:'plus',name:'Plus',people:5,price:'4,99 €',note:'Plată unică'},
  pro:{id:'pro',name:'Pro',people:Infinity,price:'9,99 €',note:'Plată unică · persoane nelimitate'}
};

// ===== PLĂȚI: Lemon Squeezy =====
// 1. Creează în Lemon Squeezy două produse („discover.me Plus” și „discover.me Pro”) cu „License keys” activat.
// 2. Copiază aici linkul de checkout al fiecăruia (Share → Checkout link) și ID-ul produsului.
// Clientul plătește, primește automat cheia pe email, iar aplicația o verifică direct la Lemon Squeezy.
const PAYMENTS={
  storeId:0,                                 // OBLIGATORIU: ID-ul magazinului tău (Settings → Stores). Doar cheile din magazinul tău sunt acceptate.
  checkout:{plus:'',pro:''},                 // ex.: 'https://discoverme.lemonsqueezy.com/buy/xxxxxxxx'
  productIds:{plus:[],pro:[]}                // OBLIGATORIU: ex. plus:[123456], pro:[123457]
};
const CHECKOUT_LINKS=PAYMENTS.checkout;

const LICENSE_PUBLIC_KEY={"kty":"EC","crv":"P-256","x":"lQjc8eF3Kyyzv6V6_ZJKZjpolkYnGP8j3D7r_4ZQ3eY","y":"auJF39tCsX-h2LRzK-dPK1MT43q352ixzf1Oml5ig9M"};

let license={plan:'free',people:PLANS.free.people,key:null};

function b64urlToBytes(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const bin=atob(s);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}

// Returnează {plan, people, ...} dacă cheia e validă, altfel null.
async function verifyLicenseKey(raw){
  try{
    const key=String(raw||'').trim().replace(/\s+/g,'');
    const m=/^DM1-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(key);if(!m)return null;
    const pub=await crypto.subtle.importKey('jwk',LICENSE_PUBLIC_KEY,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    const ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},pub,b64urlToBytes(m[2]),new TextEncoder().encode(m[1]));
    if(!ok)return null;
    const p=JSON.parse(new TextDecoder().decode(b64urlToBytes(m[1])));
    if(p.v!==1||!PLANS[p.plan]||p.plan==='free')return null;
    return {...p,people:p.people>0?p.people:Infinity,key};
  }catch(e){console.warn('Verificarea licenței a eșuat',e);return null}
}
function peopleLimit(){return license.people}
function canAddPerson(){return people.length<peopleLimit()}
// ---- Lemon Squeezy License API (public, fără cheie secretă, permis din browser) ----
const LS_API='https://api.lemonsqueezy.com/v1/licenses/';
async function lsCall(action,params){
  const r=await fetch(LS_API+action,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});
  return r.json();
}
// Cheia e acceptată DOAR dacă vine din magazinul tău și dintr-unul din produsele configurate.
function lsPlanFor(meta){
  if(!PAYMENTS.storeId||Number(meta?.store_id)!==Number(PAYMENTS.storeId))return null;
  const pid=Number(meta?.product_id);
  for(const plan of ['pro','plus'])if((PAYMENTS.productIds[plan]||[]).map(Number).includes(pid))return plan;
  return null;
}
const paymentsConfigured=()=>!!(PAYMENTS.storeId&&(PAYMENTS.productIds.plus.length||PAYMENTS.productIds.pro.length));
async function activateLemonKey(key){
  if(!paymentsConfigured())return {error:'Plata online nu este încă activată în această versiune.'};
  const res=await lsCall('activate',{license_key:key,instance_name:`discover.me · ${navigator.platform||'browser'}`});
  if(!res?.activated&&!(res?.valid&&res?.instance)){return {error:/limit/i.test(res?.error||'')?'Cheia a fost deja activată pe numărul maxim de dispozitive.':'Cheia nu este validă.'}}
  const plan=lsPlanFor(res.meta);
  if(!plan){if(res.instance?.id)lsCall('deactivate',{license_key:key,instance_id:res.instance.id}).catch(()=>{});return {error:'Cheia nu aparține discover.me.'}}
  return {plan,people:PLANS[plan].people,key,provider:'ls',instanceId:res.instance?.id,email:res.meta?.customer_email};
}
async function loadLicense(){
  try{
    const row=await storeGet('settings','license');if(!row?.key)return license;
    if(row.provider==='ls'){
      if(PLANS[row.plan]&&paymentsConfigured())license={plan:row.plan,people:PLANS[row.plan].people,key:row.key,email:row.email};
      // Reverificare în fundal o dată pe săptămână (o rambursare dezactivează cheia). Fără internet, licența rămâne.
      if(Date.now()-(row.checkedAt||0)>7*864e5)lsCall('validate',{license_key:row.key,instance_id:row.instanceId||''}).then(async v=>{
        if(v&&v.valid===false&&/disabled|expired|not found/i.test(`${v.error||''} ${v.license_key?.status||''}`)){license={plan:'free',people:PLANS.free.people,key:null};await storeDelete('settings','license');if(typeof renderPlan==='function'){renderPlan();updateSearchControls()}}
        else if(v?.valid)await storePut('settings',{...row,checkedAt:Date.now()});
      }).catch(()=>{});
    }else{const p=await verifyLicenseKey(row.key);if(p)license={plan:p.plan,people:p.people,key:p.key,email:p.email}}
  }catch(e){}
  return license;
}
// Acceptă chei Lemon Squeezy (primite automat după plată) și chei DM1- (emise manual cu tools/license/issue.js).
async function activateLicense(raw){
  const key=String(raw||'').trim();if(!key)return {error:'Lipește cheia de licență.'};
  if(/^DM1-/.test(key)){
    const p=await verifyLicenseKey(key);if(!p)return {error:'Cheia nu este validă. Verifică să o fi copiat complet.'};
    license={plan:p.plan,people:p.people,key:p.key,email:p.email};
    await storePut('settings',{id:'license',provider:'dm',key:p.key,activatedAt:Date.now()});return license;
  }
  let r;try{r=await activateLemonKey(key)}catch(e){return {error:'Nu mă pot conecta la serverul de plăți. Verifică internetul și încearcă din nou.'}}
  if(r.error)return r;
  license={plan:r.plan,people:r.people,key:r.key,email:r.email};
  await storePut('settings',{id:'license',provider:'ls',key:r.key,plan:r.plan,instanceId:r.instanceId,email:r.email,activatedAt:Date.now(),checkedAt:Date.now()});
  return license;
}
