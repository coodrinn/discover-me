// discover.me — Service worker: aplicația pornește și fără internet după prima deschidere.
//  • fișierele aplicației: întâi rețeaua (ca să primești mereu versiunea nouă), apoi copia salvată dacă ești offline
//  • biblioteca și modelele de recunoaștere de pe CDN au versiune fixă: se descarcă o singură dată și se păstrează
// Pozele tale nu trec niciodată prin acest fișier: se citesc direct de pe disc.
'use strict';
const SHELL_CACHE='dm-shell-v25', CDN_CACHE='dm-cdn-v1';
const SHELL=['./','index.html','manifest.webmanifest','frontend/css/styles.css',
  'frontend/js/theme-init.js','frontend/js/splash.js','frontend/js/helpers.js','frontend/js/extras.js','frontend/js/consent.js','frontend/js/legal.js','frontend/js/dropfolder.js','frontend/js/app.js','frontend/js/settings.js','frontend/js/backdrop.js','frontend/js/dropdown.js',
  'engine/config.js','engine/offline.js','engine/storage.js','engine/album.js','engine/heic.js','engine/faces.js','engine/sface.js','engine/matching.js','engine/license.js','engine/links.js','engine/exif.js','engine/clusters.js',
  'frontend/icons/icon.svg','frontend/icons/icon-192.png','frontend/icons/icon-512.png'];
const VENDOR_CACHE='dm-vendor-v1';
const CDN_HOSTS=['cdn.jsdelivr.net'];

self.addEventListener('install',e=>{e.waitUntil(caches.open(SHELL_CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==SHELL_CACHE&&k!==CDN_CACHE&&k!==VENDOR_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});

self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin===self.location.origin&&url.pathname.includes('/vendor/')){e.respondWith(cacheFirst(req,VENDOR_CACHE));return}
  if(url.origin===self.location.origin){e.respondWith(networkFirst(req));return}
  if(CDN_HOSTS.includes(url.hostname)){e.respondWith(cacheFirst(req));return}
  // orice altceva (plăți, linkuri spre poze de pe alte site-uri) merge direct, fără copie
});
async function networkFirst(req){
  const cache=await caches.open(SHELL_CACHE);
  try{const res=await fetch(req);if(res.ok&&!new URL(req.url).search)cache.put(req,res.clone());return res}
  catch(err){const hit=await cache.match(req,{ignoreSearch:true})||(req.mode==='navigate'?await cache.match('index.html'):null);if(hit)return hit;throw err}
}
async function cacheFirst(req,name=CDN_CACHE){
  const cache=await caches.open(name),hit=await cache.match(req);if(hit)return hit;
  const res=await fetch(req);if(res.ok||res.type==='opaque')cache.put(req,res.clone());return res;
}
