// discover.me — Planuri și licențe (verificate local, fără server).
// O cheie de licență ("DM1-...") este semnată cu cheia privată a vânzătorului (tools/license/issue.js)
// și verificată aici cu cheia publică. Fără cheia privată, nimeni nu poate genera chei valide.
'use strict';

const PLANS={
  free:{id:'free',name:'Gratuit',people:1,price:'0 €',note:'Ca să încerci'},
  plus:{id:'plus',name:'Plus',people:5,price:'4,99 €',note:'Plată unică'},
  pro:{id:'pro',name:'Pro',people:Infinity,price:'9,99 €',note:'Plată unică · persoane nelimitate'}
};

// Linkurile de plată (de ex. Stripe Payment Links / Lemon Squeezy). Lasă gol până le ai.
const CHECKOUT_LINKS={plus:'',pro:''};

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
async function loadLicense(){
  try{const row=await storeGet('settings','license');if(row?.key){const p=await verifyLicenseKey(row.key);if(p)license={plan:p.plan,people:p.people,key:p.key,email:p.email}}}catch(e){}
  return license;
}
async function activateLicense(raw){
  const p=await verifyLicenseKey(raw);if(!p)return null;
  license={plan:p.plan,people:p.people,key:p.key,email:p.email};
  await storePut('settings',{id:'license',key:p.key,activatedAt:Date.now()});
  return license;
}
