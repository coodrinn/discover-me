// discover.me — Modul „deschis din folder” (file://).
// Din file:// browserul nu lasă pagina să citească fișiere (fetch), dar lasă să încarce scripturi. Dacă există vendor/offline/ (generat cu
// tools/make-offline.js), cererile spre vendor/... sunt servite din acele scripturi, deci aplicația pornește la dublu-click pe index.html.
// În http://localhost și https:// nu face nimic.
'use strict';
(function () {
  if (location.protocol !== 'file:') return;
  const realFetch = window.fetch.bind(window);
  const MIME = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.onnx': 'application/octet-stream', '.bin': 'application/octet-stream' };
  let indexP = null;
  const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = () => { s.remove(); res(); }; s.onerror = () => { s.remove(); rej(new Error('lipsește ' + src)); }; document.head.append(s); });
  const getIndex = () => indexP || (indexP = loadScript('vendor/offline/index.js').then(() => window.DM_OFFLINE_INDEX).catch(() => null));
  // true dacă pachetul offline există (altfel aplicația arată cum se pornește prin server)
  window.dmOfflineAvailable = async () => !!(await getIndex());

  window.fetch = async function (input, init) {
    let url = typeof input === 'string' ? input : (input && input.url) || '';
    try { url = new URL(url, document.baseURI).href; } catch (e) { /* adresă ciudată: o lăsăm cum e */ }
    const at = url.indexOf('vendor/');
    if (url.startsWith('file:') && at >= 0) {
      const key = decodeURIComponent(url.slice(at).split('?')[0]), idx = await getIndex();
      if (idx && idx[key]) {
        await loadScript('vendor/offline/' + idx[key]);
        const b64 = window.DM_OFFLINE[key]; delete window.DM_OFFLINE[key];            // eliberăm șirul mare imediat după folosire
        const ext = key.slice(key.lastIndexOf('.'));
        const r = await realFetch('data:' + (MIME[ext] || 'application/octet-stream') + ';base64,' + b64);   // decodare nativă, rapidă
        return new Response(await r.arrayBuffer(), { status: 200, headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' } });
      }
    }
    return realFetch(input, init);
  };
})();
