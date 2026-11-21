// discover.me — Abonamente și licențe (verificate din browser, fără server propriu).
// Abonamentele se vând prin Lemon Squeezy: clientul plătește lunar sau anual și primește automat
// o cheie de licență. Cheia rămâne activă cât timp abonamentul e plătit; apoi aplicația revine la Gratuit.
// Cheile "DM1-..." sunt emise manual (tools/license/issue.js), semnate cu cheia privată a vânzătorului.
'use strict';

// PLANURI ȘI PREȚURI (modifică aici)
const PLANS={
  free:{id:'free',name:'Gratuit',people:1,price:{monthly:'0 €',yearly:'0 €'},note:'Ca să încerci'},
  plus:{id:'plus',name:'Plus',people:3,price:{monthly:'1,99 €',yearly:'14,99 €'},note:'Pentru familie și prieteni'},
  pro:{id:'pro',name:'Pro',people:Infinity,price:{monthly:'3,99 €',yearly:'29,99 €'},note:'Pentru fotografi și evenimente'}
};

// PLĂȚI: Lemon Squeezy
// 1. Creează produsele „discover.me Plus” și „discover.me Pro” ca SUBSCRIPTION, fiecare cu 2 variante: Lunar și Anual,
//    și cu „License keys” activat.
// 2. Completează mai jos ID-ul magazinului, ID-urile produselor și linkurile de checkout pentru fiecare variantă.
const PAYMENTS={
  storeId:0,                                   // OBLIGATORIU: Settings → Stores. Doar cheile din magazinul tău sunt acceptate.
  productIds:{plus:[],pro:[]},                 // OBLIGATORIU: ex. plus:[123456], pro:[123457]
  checkout:{                                   // ex.: 'https://discoverme.lemonsqueezy.com/buy/xxxxxxxx'
    plus:{monthly:'',yearly:''},
    pro:{monthly:'',yearly:''}
  }
};
const CHECK_EVERY_MS=24*3600e3;     // reverificare zilnică (abonament anulat / expirat / rambursat)
const OFFLINE_GRACE_MS=5*24*3600e3; // fără internet, licența rămâne activă încă 5 zile după expirare

const LICENSE_PUBLIC_KEY={"kty":"EC","crv":"P-256","x":"lQjc8eF3Kyyzv6V6_ZJKZjpolkYnGP8j3D7r_4ZQ3eY","y":"auJF39tCsX-h2LRzK-dPK1MT43q352ixzf1Oml5ig9M"};

const FREE_LICENSE={plan:'free',people:PLANS.free.people,key:null,expiresAt:null};
let license={...FREE_LICENSE};

function b64urlToBytes(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const bin=atob(s);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}

// Chei DM1 (emise manual). Returnează {plan, people, exp, ...} dacă semnătura e validă și nu a expirat.
async function verifyLicenseKey(raw){
  try{
    const key=String(raw||'').trim().replace(/\s+/g,'');
    const m=/^DM1-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(key);if(!m)return null;
    const pub=await crypto.subtle.importKey('jwk',LICENSE_PUBLIC_KEY,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    const ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},pub,b64urlToBytes(m[2]),new TextEncoder().encode(m[1]));
    if(!ok)return null;
    const p=JSON.parse(new TextDecoder().decode(b64urlToBytes(m[1])));
    if(p.v!==1||!PLANS[p.plan]||p.plan==='free')return null;
    if(p.exp&&p.exp*1000<Date.now())return {expired:true};
    return {...p,people:PLANS[p.plan].people,key,expiresAt:p.exp?p.exp*1000:null};
  }catch(e){console.warn('Verificarea licenței a eșuat',e);return null}
}

function peopleLimit(){return license.people}
function canAddPerson(){return people.length<peopleLimit()}
// Persoanele incluse în plan: primele N, în ordinea creării. Celelalte rămân salvate, dar blocate.
function isPersonUnlocked(id){
  if(peopleLimit()===Infinity)return true;
  const order=[...people].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)).map(p=>p.id);
  return order.indexOf(id)<peopleLimit();
}
function fmtDate(ms){return new Date(ms).toLocaleDateString('ro-RO',{day:'numeric',month:'long',year:'numeric'})}

// Lemon Squeezy License API (public, fără cheie secretă, permis din browser)
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
const lsExpiry=lk=>lk?.expires_at?Date.parse(lk.expires_at):null;
const lsActive=lk=>!lk||!/expired|disabled/i.test(lk.status||'');

async function activateLemonKey(key){
  if(!paymentsConfigured())return {error:'Plata online nu este încă activată în această versiune.'};
  const res=await lsCall('activate',{license_key:key,instance_name:`discover.me · ${navigator.platform||'browser'}`});
  if(!res?.activated&&!(res?.valid&&res?.instance)){
    const err=`${res?.error||''} ${res?.license_key?.status||''}`;
    return {error:/limit/i.test(err)?'Cheia a fost deja activată pe numărul maxim de dispozitive.':/expired|disabled/i.test(err)?'Abonamentul acestei chei a expirat. Reînnoiește-l ca să continui.':'Cheia nu este validă.'};
  }
  const plan=lsPlanFor(res.meta);
  if(!plan){if(res.instance?.id)lsCall('deactivate',{license_key:key,instance_id:res.instance.id}).catch(()=>{});return {error:'Cheia nu aparține discover.me.'}}
  if(!lsActive(res.license_key))return {error:'Abonamentul acestei chei a expirat. Reînnoiește-l ca să continui.'};
  return {plan,key,provider:'ls',instanceId:res.instance?.id,email:res.meta?.customer_email,expiresAt:lsExpiry(res.license_key),variant:res.meta?.variant_name||''};
}

async function dropLicense(){license={...FREE_LICENSE};await storeDelete('settings','license').catch(()=>{});if(typeof onLicenseChanged==='function')onLicenseChanged()}

async function loadLicense(){
  try{
    const row=await storeGet('settings','license');if(!row?.key)return license;
    if(row.provider==='ls'){
      if(!PLANS[row.plan]||!paymentsConfigured())return license;
      const graceOver=row.expiresAt&&Date.now()>row.expiresAt+OFFLINE_GRACE_MS;
      if(!graceOver)license={plan:row.plan,people:PLANS[row.plan].people,key:row.key,email:row.email,expiresAt:row.expiresAt||null,variant:row.variant||''};
      const due=Date.now()-(row.checkedAt||0)>CHECK_EVERY_MS||(row.expiresAt&&Date.now()>row.expiresAt);
      if(due)lsCall('validate',{license_key:row.key,instance_id:row.instanceId||''}).then(async v=>{
        if(!v)return;
        if(v.valid===false||!lsActive(v.license_key)){if(/expired|disabled|not found|invalid/i.test(`${v.error||''} ${v.license_key?.status||''}`)||v.valid===false)await dropLicense();return}
        const expiresAt=lsExpiry(v.license_key);                     // reînnoirea abonamentului mută data de expirare
        await storePut('settings',{...row,expiresAt,checkedAt:Date.now()});
        license={plan:row.plan,people:PLANS[row.plan].people,key:row.key,email:row.email,expiresAt,variant:row.variant||''};
        if(typeof onLicenseChanged==='function')onLicenseChanged();
      }).catch(()=>{});
    }else{
      const p=await verifyLicenseKey(row.key);
      if(p&&!p.expired)license={plan:p.plan,people:p.people,key:p.key,email:p.email,expiresAt:p.expiresAt};
      else if(p?.expired)await storeDelete('settings','license');
    }
  }catch(e){}
  return license;
}

// Acceptă chei Lemon Squeezy (primite automat după abonare) și chei DM1- (emise manual).
async function activateLicense(raw){
  const key=String(raw||'').trim();if(!key)return {error:'Lipește cheia de licență.'};
  if(/^DM1-/.test(key)){
    const p=await verifyLicenseKey(key);
    if(!p)return {error:'Cheia nu este validă. Verifică să o fi copiat complet.'};
    if(p.expired)return {error:'Această cheie a expirat.'};
    license={plan:p.plan,people:p.people,key:p.key,email:p.email,expiresAt:p.expiresAt};
    await storePut('settings',{id:'license',provider:'dm',key:p.key,activatedAt:Date.now()});return license;
  }
  let r;try{r=await activateLemonKey(key)}catch(e){return {error:'Nu mă pot conecta la serverul de plăți. Verifică internetul și încearcă din nou.'}}
  if(r.error)return r;
  license={plan:r.plan,people:PLANS[r.plan].people,key:r.key,email:r.email,expiresAt:r.expiresAt,variant:r.variant};
  await storePut('settings',{id:'license',provider:'ls',key:r.key,plan:r.plan,instanceId:r.instanceId,email:r.email,expiresAt:r.expiresAt,variant:r.variant,activatedAt:Date.now(),checkedAt:Date.now()});
  return license;
}
