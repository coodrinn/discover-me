// discover.me — Stocare locală în IndexedDB: fotografii indexate, persoane, setări.
'use strict';

function idbRequest(r){return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function idbDone(t){return new Promise((resolve,reject)=>{t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error)})}
function openDB(){if(db)return Promise.resolve(db);return new Promise((resolve,reject)=>{const q=indexedDB.open(DB_NAME,DB_VERSION);q.onupgradeneeded=()=>{const d=q.result;d.createObjectStore('photos',{keyPath:'key'});d.createObjectStore('people',{keyPath:'id'});d.createObjectStore('settings',{keyPath:'id'})};q.onsuccess=()=>{db=q.result;resolve(db)};q.onerror=()=>reject(q.error)})}
async function storeGet(store,key){const d=await openDB();return idbRequest(d.transaction(store).objectStore(store).get(key))}
async function storeAll(store){const d=await openDB();return idbRequest(d.transaction(store).objectStore(store).getAll())}
async function storePut(store,value){const d=await openDB(),t=d.transaction(store,'readwrite');t.objectStore(store).put(value);await idbDone(t)}
async function storePutMany(store,values){if(!values.length)return;const d=await openDB(),t=d.transaction(store,'readwrite'),st=t.objectStore(store);for(const value of values)st.put(value);await idbDone(t)}
async function storeDelete(store,key){const d=await openDB(),t=d.transaction(store,'readwrite');t.objectStore(store).delete(key);await idbDone(t)}
async function cacheMap(){const rows=await storeAll('photos');return new Map(rows.map(x=>[x.key,x]))}
function makeLocalId(){return (crypto.randomUUID?crypto.randomUUID():`album-${Date.now()}-${Math.random().toString(36).slice(2)}`)}
async function rememberAlbumHandle(handle,name,suggestedId=''){
  let rows=[];try{rows=(await storeGet('settings','albumRegistry'))?.items||[]}catch{}
  for(const row of rows){try{if(row.handle&&handle.isSameEntry&&await handle.isSameEntry(row.handle))return row.id}catch{}}
  const id=suggestedId||makeLocalId();rows.push({id,name,handle,usedAt:Date.now()});if(rows.length>30)rows=rows.slice(-30);
  try{await storePut('settings',{id:'albumRegistry',items:rows})}catch(e){console.warn('Nu am putut salva istoricul folderelor',e)}
  return id;
}
