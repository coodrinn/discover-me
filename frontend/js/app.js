// discover.me — Interfața și fluxul aplicației: album, indexare, persoane, căutare, rezultate.
'use strict';

// Pragurile vin din engine/matching.js; interfața alege doar modul.
function getMatchPolicy(){return matchPolicy($('searchAccuracy')?.value)}
const objectUrlCache=new Map(), searchScoreCache=new Map();
function setEngine(ok,label){$('engineDot').classList.toggle('ready',ok);$('engineStatus').textContent=label}
async function connectDirectory(){
  if(busy){toast('Albumul se pregătește acum. Pune pe pauză înainte să schimbi folderul.');return}
  // Albumul salvat așteaptă doar reconfirmarea accesului: îl redeschidem direct, iar indexarea continuă de unde a rămas.
  if(pendingReconnect&&directoryHandle){
    pendingReconnect=false;
    try{if(await directoryHandle.requestPermission({mode:'read'})==='granted'){setStatusText(`Citesc folderul „${currentAlbumName}”…`);activeFiles=await listDirectory(directoryHandle);if(activeFiles.length){$('chooseFolder').textContent='Schimbă folderul';afterAlbumLoad();return}}}catch(e){console.warn('Reconectarea albumului nu a reușit',e)}
  }
  // Deschide întotdeauna selectorul. Nu reconecta automat folderul anterior când utilizatorul cere altul.
  if('showDirectoryPicker'in window){
    try{
      const nextHandle=await window.showDirectoryPicker({id:'discover-me-album',mode:'read'});
      const nextName=nextHandle.name||'Album';
      setStatusText(`Citesc folderul „${nextName}”…`);
      const nextFiles=await listDirectory(nextHandle);
      if(!nextFiles.length){toast('Folderul ales nu conține fotografii acceptate. Albumul anterior a rămas selectat.');return}
      const nextId=await rememberAlbumHandle(nextHandle,nextName);
      directoryHandle=nextHandle;currentAlbumName=nextName;currentAlbumId=nextId;activeFiles=nextFiles;
      await storeDelete('settings','lastLinks').catch(()=>{});
      await storePut('settings',{id:'lastAlbum',name:currentAlbumName,handle:directoryHandle,albumId:currentAlbumId});
      afterAlbumLoad();
    }catch(e){
      if(e.name==='AbortError')return;
      console.error(e);toast('Nu am putut deschide folderul. Încearcă selectarea clasică.');
      openFallbackPicker();
    }
    return;
  }
  openFallbackPicker();
}
const IS_TOUCH=matchMedia('(pointer:coarse)').matches&&!('showDirectoryPicker'in window);
function openFallbackPicker(){const el=IS_TOUCH?$('photosFallback'):$('folderFallback');el.value='';el.click()}   // pe telefon nu există alegere de folder: se aleg fotografii din galerie
function afterAlbumLoad(){activeFiles.sort((a,b)=>a.path.localeCompare(b.path,'ro'));indexedEntries=[];latestHits=[];allHits=[];clearObjectUrls();updateStats();$('folderHeadline').textContent=`Album: ${currentAlbumName||'Folder conectat'}`;$('folderHelp').textContent='Poți schimba folderul oricând. Pozele deja pregătite rămân ținute minte.';$('chooseFolder').textContent='Schimbă folderul';$('heroFolder').textContent='Schimbă albumul';$('albumName').textContent=currentAlbumName||'Album';$('fileCount').textContent=fmt(activeFiles.length)+' fotografii';$('settingsAlbum').textContent=currentAlbumName||'Album';$('resultsHead2').hidden=true;$('resultsGrid2').replaceChildren();$('resultsEmpty2').hidden=false;$('resultsEmpty2').textContent='Album conectat. După pregătire îți arătăm cine apare în el.';
  $('scanProgressWrap').hidden=false;$('scanLabel').textContent='Gata de pregătit';$('scanPercent').textContent='0%';$('scanBar').style.width='0%';$('scanStatus').textContent=`${fmt(activeFiles.length)} fotografii pregătite.`;
  let start=$('startIndex');if(!start){start=document.createElement('button');start.id='startIndex';start.className='button primary small';start.textContent='▶ Pregătește albumul';start.style.marginTop='12px';$('scanStatus').after(start);start.onclick=startIndex}
  start.hidden=!activeFiles.length;updateSearchControls();rebuildIndexedEntries().then(()=>{updateSearchControls();if(indexedEntries.length){const missing=Math.max(0,activeFiles.length-indexedEntries.length);$('scanLabel').textContent='Album pregătit parțial';$('scanPercent').textContent=Math.round(indexedEntries.length/Math.max(1,activeFiles.length)*100)+'%';$('scanBar').style.width=Math.round(indexedEntries.length/Math.max(1,activeFiles.length)*100)+'%';$('scanStatus').textContent=`${fmt(indexedEntries.length)} poze sunt deja pregătite · ${fmt(missing)} mai trebuie pregătite. Poți căuta deja în cele pregătite.`;updateSearchControls()}autoIndex()}).catch(console.warn);toast(`${fmt(activeFiles.length)} fotografii găsite în „${currentAlbumName}”.`);}
function autoIndex(){if(engineReady&&!busy&&activeFiles.length&&indexedEntries.length<activeFiles.length){returnToSearchAfterIndex=true;startIndex()}}
function setStatusText(t){$('scanStatus').textContent=t}
$('chooseFolder').onclick=connectDirectory;$('heroFolder').onclick=connectDirectory;$('settingsFolder').onclick=connectDirectory;
$('photosFallback').addEventListener('change',e=>{const f=[...e.target.files||[]].filter(isImage);e.target.value='';if(!f.length)return;activeFiles=f.map(file=>({file,path:file.name}));currentAlbumName='Fotografii din galerie';directoryHandle=null;currentAlbumId=fallbackAlbumIdentity(f,'galerie');afterAlbumLoad()});
if(IS_TOUCH){$('folderHeadline').textContent='Alege fotografiile din galerie';$('folderHelp').textContent='Pe telefon selectezi fotografiile direct din galerie (poți bifa mai multe).';$('chooseFolder').textContent='Alege fotografiile'}
$('folderFallback').addEventListener('change',e=>{const f=[...e.target.files||[]];e.target.value='';if(!f.length)return;const root=(f[0].webkitRelativePath||f[0].name).split('/')[0]||'Album';const imageFiles=f.filter(isImage);activeFiles=imageFiles.map(file=>({file,path:file.webkitRelativePath?.split('/').slice(1).join('/')||file.name}));currentAlbumName=root;directoryHandle=null;currentAlbumId=fallbackAlbumIdentity(imageFiles,root);afterAlbumLoad()});
async function restoreAlbum(){try{const saved=await storeGet('settings','lastAlbum');if(!saved?.handle)return;directoryHandle=saved.handle;currentAlbumName=saved.name||saved.handle.name;currentAlbumId=await rememberAlbumHandle(directoryHandle,currentAlbumName,saved.albumId||currentAlbumName);if(saved.albumId!==currentAlbumId)await storePut('settings',{...saved,albumId:currentAlbumId});const p=await directoryHandle.queryPermission({mode:'read'});if(p==='granted'){activeFiles=await listDirectory(directoryHandle);afterAlbumLoad()}else{pendingReconnect=true;$('folderHeadline').textContent='Reconectează albumul salvat';$('folderHelp').textContent='Browserul cere din nou acces la folder. Pregătirea continuă de unde a rămas.';$('chooseFolder').textContent='Reconectează albumul';$('albumName').textContent=currentAlbumName;$('fileCount').textContent='Accesul trebuie reconfirmat';$('scanStatus').textContent='Apasă „Reconectează albumul” pentru a continua.'}}catch(e){console.warn('Restaurare album indisponibilă',e)}}

// Cât rulează intro-ul se descarcă doar fișierele (rețea, fără efort pentru procesor); pornirea grea vine după.
function prefetchEngine(){if(location.protocol==='file:')return;   // din folder, fișierele se încarcă o singură dată, când sunt cerute
  const get=u=>fetch(u).then(r=>r.ok?r:null).catch(()=>null);get(FACEAPI_URL);window.dmSfaceFetch=fetch(SFACE_MODEL).catch(()=>null);get(ORT_URL);get(ORT_BASE+'ort-wasm-simd-threaded.mjs');get(ORT_BASE+'ort-wasm-simd-threaded.wasm');
  for(const m of MODEL_FILES)get(MODEL_BASE+m+'-weights_manifest.json').then(r=>r&&r.json()).then(man=>{for(const g of man||[])for(const p of g.paths||[])get(MODEL_BASE+p)}).catch(()=>{})}
function loadScript(u){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=u;s.onload=res;s.onerror=()=>{s.remove();rej(new Error('script'))};document.head.append(s)})}
function loadFaceApi(){if(window.faceapi)return Promise.resolve();return loadScript(FACEAPI_URL).catch(()=>loadScript(FACEAPI_URL_CDN)).catch(()=>{throw new Error('Biblioteca foto nu s-a încărcat')})}
// Anunță intro-ul că motorul e gata (sau a eșuat), ca utilizatorul să intre direct în aplicația pregătită.
function engineSettled(){if(window.dmEngineDone)return;window.dmEngineDone=true;document.dispatchEvent(new Event('dm:engine'))}
const FILE_MODE_HELP='Aplicația nu poate rula direct din folder (adresa începe cu file://): browserul nu lasă paginile să citească modelele de recunoaștere. Pornește-o cu dublu-click pe „porneste.bat”, sau rulează „python -m http.server 8080” în folderul aplicației și deschide http://localhost:8080.';
async function initEngine(){
  // Din folder (file://) merge doar dacă există vendor/offline (generat cu tools/make-offline.js); altfel spunem ce să facă utilizatorul.
  if(location.protocol==='file:'&&!(await window.dmOfflineAvailable())){setEngine(false,'Pornește printr-un server');$('engineNote').textContent=FILE_MODE_HELP;toast('Deschide aplicația prin „porneste.bat” (nu direct din folder).');renderSearchFlow();updateSearchControls();engineSettled();return}
  try{engineProgress='Descarc componentele de recunoaștere…';renderSearchFlow();await loadFaceApi();performance.mark('dm:faceapi');if(!window.faceapi)throw new Error('Biblioteca foto nu s-a încărcat');
  // Programele pentru placa video sunt refolosite pentru imagini de mărimi diferite: mult mai puține compilări
  // (încălzirea la rece: ~6,5s → ~2,8s pe o placă Intel; și indexarea pozelor de mărimi diferite e mai fluidă).
  try{faceapi.tf.env().set('WEBGL_USE_SHAPES_UNIFORMS',true)}catch(e){}
  await faceapi.tf.ready();performance.mark('dm:tf');
  // Progres vizibil: la prima pornire se descarcă ~12 MB de modele; apoi vin din memoria browserului.
  const nets=[faceapi.nets.ssdMobilenetv1,faceapi.nets.tinyFaceDetector,faceapi.nets.faceLandmark68Net,faceapi.nets.faceRecognitionNet];let loaded=0;
  const showLoad=()=>{engineProgress=`Descarc componentele de recunoaștere · ${loaded} din ${nets.length}`;setEngine(false,`Pregătesc · ${loaded}/${nets.length}`);renderSearchFlow()};showLoad();
  const slow=setTimeout(()=>{if(!engineReady)engineProgress+=' · prima pornire durează mai mult, apoi e instantă';renderSearchFlow()},6000);
  await Promise.all(nets.map(n=>n.loadFromUri(MODEL_BASE).catch(()=>n.loadFromUri(MODEL_BASE_CDN)).then(()=>{loaded++;showLoad()})));clearTimeout(slow);performance.mark('dm:models');
  // Modelul de recunoaștere SFace (~38 MB, o singură dată): el decide „e aceeași persoană?”.
  await loadSFace(p=>{const pct=Math.round(p*100);engineProgress=`Descarc modelul de recunoaștere · ${pct}% (o singură dată)`;setEngine(false,`Pregătesc · model ${pct}%`);renderSearchFlow()});
  engineProgress='Pregătesc recunoașterea…';renderSearchFlow();await warmupSFace();performance.mark('dm:sface');engineReady=true;$('engineNote').textContent='Totul este pregătit. Prima analiză a albumului poate dura, iar apoi fotografiile deja verificate nu sunt analizate din nou.';setEngine(true,'Pregătit');await warmup();performance.mark('dm:warm');engineSettled();autoIndex();migrateProfiles().catch(console.warn);purgeOldIndex().catch(console.warn)}catch(e){console.error(e);setEngine(false,'Nu s-a putut porni');$('engineNote').textContent='Verifică internetul și reîncarcă pagina pentru a pregăti aplicația.';toast('Nu am putut pregăti aplicația. Verifică conexiunea la internet și reîncarcă pagina.')}updateSearchControls();engineSettled()}
function binColor(i){
  if(i>=48)return ['#111','#555','#8a8a8a','#c4c4c4','#f4f4f4'][i-48];
  const h=((i>>2)%12)*30+15,s=(i&2)?.75:.35,v=(i&1)?.85:.45,k=n=>{const q=(n+h/60)%6;return v-v*s*Math.max(0,Math.min(q,4-q,1))};
  return `rgb(${Math.round(k(5)*255)},${Math.round(k(3)*255)},${Math.round(k(1)*255)})`;
}
function renderOutfits(outfits,on){
  const box=$('outfitInfo');if(!box)return;box.replaceChildren();
  if(!on&&outfits&&outfits.length&&$('useClothes')&&!$('useClothes').checked)return;
  const t=document.createElement('small');t.className='sub';
  if(!outfits||!outfits.length){t.textContent='Hainele nu au putut fi recunoscute (prea puține poze sigure).';box.append(t);return}
  t.textContent='Haine recunoscute în pozele sigure:';box.append(t);
  for(const o of outfits){const g=document.createElement('span');g.className='outfit-grp';g.title=o.n+' fotografii';
    [...o.mean].map((v,i)=>[v,i]).sort((a,b)=>b[0]-a[0]).slice(0,4).filter(x=>x[0]>.25).forEach(([,i])=>{const d=document.createElement('span');d.className='outfit-dot';d.style.background=binColor(i);g.append(d)});box.append(g)}
}
async function startIndex(){if(!engineReady){toast('Aplicația încă se pregătește.');return}if(busy||!activeFiles.length)return;busy=true;keepAwake(true);$('deepScan').disabled=true;pauseRequested=false;$('pauseScan').disabled=false;$('pauseScan').textContent='Pauză după fotografia curentă';$('pauseScan').hidden=false;$('startIndex').hidden=true;const progress=$('scanProgressWrap');progress.hidden=false;
 try{const cached=await cacheMap();let done=0,reused=0,failed=0;const writes=[];const total=activeFiles.length;const root=currentAlbumName||'Album',deep=$('deepScan').checked;let started=performance.now();
  // Decodează următoarele două imagini în avans, dar păstrează inferența serială:
  // TensorFlow.js/WebGL este mai stabil fără sesiuni GPU concurente.
  const pending=new Map(),hasGoodCache=key=>{const value=cached.get(key);return !!value&&!value.error};const prefetch=i=>{if(i>=total||hasGoodCache(fileKey(activeFiles[i].file,activeFiles[i].path,root))||pending.has(i))return;pending.set(i,toCanvas(activeFiles[i].file,deep?2000:1400).then(canvas=>({canvas}),error=>({error})))};
  const prefetchAhead=i=>{let count=0;for(let k=i;k<total&&count<2;k++){const key=fileKey(activeFiles[k].file,activeFiles[k].path,root);if(!hasGoodCache(key)){prefetch(k);count++}}};prefetchAhead(0);
  // Timp estimat: doar pozele care chiar trebuie analizate (cele din cache sunt instant).
  let toProcess=0,processedNew=0,newStarted=0;for(const it of activeFiles)if(!hasGoodCache(fileKey(it.file,it.path,root)))toProcess++;
  const etaText=()=>{if(processedNew<3||toProcess-processedNew<=0)return '';const sec=(performance.now()-newStarted)/processedNew*(toProcess-processedNew);return sec<60?' · mai puțin de un minut rămas':` · ~${Math.round(sec/60)} min rămase`};
  for(let i=0;i<total;i++){if(pauseRequested)break;const item=activeFiles[i],key=fileKey(item.file,item.path,root);let entry=cached.get(key);if(entry?.error)entry=null;
   if(entry){reused++}else{if(!newStarted)newStarted=performance.now();processedNew++;try{setStatusText(`Analizez ${item.path} · ${i+1}/${fmt(total)}${etaText()}`);prefetchAhead(i+1);const prep=await pending.get(i);pending.delete(i);if(prep?.error)throw prep.error;const result=await detectFacesE(item.file,deep,prep?.canvas);const faces=result.faces.map(f=>({...f,c:clothHist(result.canvas,f)}));const taken=await readPhotoDate(item.file);entry={key,path:item.path,fileName:item.file.name,size:item.file.size,modified:item.file.lastModified,taken,faces,processedAt:Date.now(),engine:ENGINE_VERSION};writes.push(entry);cached.set(key,entry);if(writes.length>=12)await storePutMany('photos',writes.splice(0))}catch(e){failed++;console.warn('Fotografie omisă',item.path,e);entry={key,path:item.path,fileName:item.file.name,size:item.file.size,faces:[],processedAt:Date.now(),engine:ENGINE_VERSION,error:true};writes.push(entry);cached.set(key,entry);if(writes.length>=12)await storePutMany('photos',writes.splice(0)).catch(()=>{})}}
   if(entry&&!entry.error)liveAdd({...entry,file:item.file,handle:item.handle});
   done++;if(done%5===0||i===total-1){liveFlush();const pct=Math.round((i+1)/total*100);$('scanPercent').textContent=pct+'%';$('scanBar').style.width=pct+'%';$('scanLabel').textContent=`Am pregătit ${fmt(i+1)} din ${fmt(total)} poze`;$('scanStatus').textContent=`${etaText().replace(/^ · /,'')||'Calculez cât mai durează…'}${failed?` · ${fmt(failed)} ${failed===1?'poză nu a putut fi citită':'poze nu au putut fi citite'}`:''} · progresul se salvează, poți închide pagina și continua mai târziu`;updateStats();await new Promise(r=>setTimeout(r,0))}
  }
  if(writes.length)await storePutMany('photos',writes);await rebuildIndexedEntries();if(pauseRequested){$('scanLabel').textContent='Pregătire pusă pe pauză';$('scanStatus').textContent=`Progres salvat. Apasă „Continuă pregătirea” când vrei.`;toast('Am pus pe pauză. Progresul e salvat.')}else{$('scanLabel').textContent='Albumul e pregătit';$('scanPercent').textContent='100%';$('scanBar').style.width='100%';$('scanStatus').textContent=`${fmt(indexedEntries.length)} poze pregătite · ${fmt(indexedEntries.reduce((n,p)=>n+p.faces.length,0))} fețe găsite${failed?` · ${fmt(failed)} ${failed===1?'poză nu a putut fi citită':'poze nu au putut fi citite'}`:''}.`;if(people.length)toast('Albumul e pregătit.')}
 }catch(e){console.error(e);toast('A apărut o eroare la pregătirea albumului. Progresul salvat nu se pierde.')}finally{busy=false;keepAwake(false);$('deepScan').disabled=false;$('pauseScan').hidden=true;$('startIndex').hidden=false;$('startIndex').textContent=pauseRequested?'▶ Continuă pregătirea':'↻ Verifică fotografiile noi';$('startIndex').onclick=startIndex;updateSearchControls();updateStats();if(returnToSearchAfterIndex&&!pauseRequested&&activeFiles.length&&indexedEntries.length>=activeFiles.length){returnToSearchAfterIndex=false;navigate('search')}if(!pauseRequested&&indexedEntries.length){if(groupMode&&groupIds.size>=2)runGroupSearch();else if(selectedPersonId&&referenceDescriptors.length>=2)runSearch();else{returnToSearchAfterPersonCreation=true;navigate('people');openAlbumFaces();toast('Albumul e pregătit. Iată persoanele care apar în el.')}}}}
$('pauseScan').onclick=()=>{pauseRequested=true;$('pauseScan').disabled=true;$('pauseScan').textContent='Se oprește după fotografia curentă…'};
async function rebuildIndexedEntries(){const all=await storeAll('photos');const activeKeys=new Set(activeFiles.map(x=>fileKey(x.file,x.path,currentAlbumName||'Album')));const map=new Map(all.filter(x=>activeKeys.has(x.key)).map(x=>[x.key,x]));indexedEntries=activeFiles.map(item=>{const key=fileKey(item.file,item.path,currentAlbumName||'Album'),row=map.get(key);return row?{...row,file:item.file,handle:item.handle}:null}).filter(Boolean);indexRevision++;searchScoreCache.clear();updateStats()}
function updateStats(){const faces=indexedEntries.reduce((n,p)=>n+(p.faces||[]).length,0);$('statPhotos').textContent=fmt(activeFiles.length);$('statAlbum').textContent=currentAlbumName||'Niciun album conectat';$('statFaces').textContent=fmt(faces);$('statPeople').textContent=fmt(people.length);$('statMatches').textContent=fmt(latestHits.length);const si=$('settingsIndex');if(si)si.textContent=`${fmt(indexedEntries.length)} poze pregătite · ${fmt(faces)} fețe găsite`;}

$('referenceFiles').addEventListener('change',async e=>{const files=[...e.target.files||[]];e.target.value='';if(!files.length)return;if(!canAddPerson()){openPaywall();return}if(!engineReady){toast('Aplicația încă se pregătește.');return}await processReferences(files)});
// Când într-o poză sunt mai multe fețe, utilizatorul alege persoana (în loc ca poza să fie respinsă).
function pickFace(canvas,faces,name){
  return new Promise(resolve=>{
    const dlg=document.createElement('dialog');dlg.className='pick-face';let done=false;
    const finish=v=>{if(done)return;done=true;dlg.close();dlg.remove();resolve(v)};
    const h=document.createElement('h3');h.textContent='Care este persoana?';
    const p=document.createElement('p');p.className='sub';p.textContent=`În „${name}” am găsit ${faces.length} fețe. Apasă pe fața persoanei pentru profil.`;
    const row=document.createElement('div');row.style.cssText='display:flex;flex-wrap:wrap;gap:10px;margin:14px 0';
    faces.slice(0,16).forEach((f,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label','Fața '+(i+1));b.style.cssText='border:2px solid var(--line);border-radius:12px;padding:0;background:none;cursor:pointer';
      const im=new Image();im.src=cropThumb(canvas,f);im.width=im.height=110;im.alt='Față detectată '+(i+1);im.style.cssText='border-radius:10px;display:block';b.append(im);b.onclick=()=>finish(f);row.append(b)});
    const skip=document.createElement('button');skip.type='button';skip.className='button soft small';skip.textContent='Omite această fotografie';skip.onclick=()=>finish(null);
    dlg.append(h,p,row,skip);dlg.addEventListener('cancel',e=>{e.preventDefault();finish(null)});document.body.append(dlg);dlg.showModal();
  });
}
async function processReferences(files){
  $('savePerson').disabled=true;$('refStatus').textContent=`Verific ${files.length} fotografii noi…`;
  $('referenceRequirementText').textContent=`Ai deja ${draftDescriptors.length} fotografii valide. Verific imaginile noi…`;
  const problems=[];let duplicates=0,added=0;
  for(let i=0;i<files.length;i++){
    const file=files[i],fileKey=[file.name,file.size,file.lastModified].join('|');
    if(draftFileKeys.has(fileKey)){duplicates++;continue}          // cheia se reține doar după succes: o poză eșuată poate fi reîncercată
    $('refStatus').textContent=`Verific fotografia ${i+1} din ${files.length}…`;
    try{
      let r=await detectFacesE(file,true),faces=r.faces.filter(f=>f.s>=.40&&f.m>=28);
      if(!faces.length)for(const deg of [90,270]){                  // poză rotită fără informații EXIF
        const rc=rotateCanvas(r.canvas,deg),rr=await detectFacesE(file,false,rc),ff=rr.faces.filter(f=>f.s>=.40&&f.m>=28);
        if(ff.length){r={canvas:rc,faces:rr.faces};faces=ff;break}
      }
      if(!faces.length){problems.push([file.name,'nu am găsit nicio față']);continue}
      let ref=faces[0];
      if(faces.length>1){
        faces.sort((a,b)=>a.x-b.x);
        const bySize=[...faces].sort((a,b)=>b.w*b.h-a.w*a.h);
        if(bySize[0].w*bySize[0].h>=3*bySize[1].w*bySize[1].h)ref=bySize[0];   // o față clar dominantă
        else{ref=await pickFace(r.canvas,faces,file.name);if(!ref){problems.push([file.name,'nu ai ales o față']);continue}}
      }
      if(ref.s<.50||ref.m<40){problems.push([file.name,'fața e prea mică sau neclară']);continue}
      draftDescriptors.push(Float32Array.from(ref.d));draftThumbs.push(cropThumb(r.canvas,ref));draftFileKeys.add(fileKey);added++;
    }catch(e){
      console.warn('Referință omisă',file.name,e);
      problems.push([file.name,/convertor/i.test(e&&e.message||'')?e.message:(e&&e.name==='InvalidStateError')?'formatul nu poate fi citit de browser':'eroare la analiză']);
    }
  }
  const why=problems.length?problems.slice(0,3).map(x=>`${x[0]}: ${x[1]}`).join(' · ')+(problems.length>3?` · încă ${problems.length-3}`:''):'';
  const count=draftDescriptors.length,ready=count>=3,remaining=Math.max(0,3-count);
  $('referenceCount').textContent=`${count} / 3 fotografii valide`;
  $('referenceRequirementText').textContent=ready?'Numărul minim este îndeplinit.':`Mai ai nevoie de ${remaining} ${remaining===1?'fotografie':'fotografii'} valide.`;
  if(count){
    $('refPreview').hidden=false;$('refThumb').hidden=false;$('refThumb').src=draftThumbs[0];$('refTitle').textContent=`${count} fotografii valide`;
    $('refDescription').textContent=`${why||'Toate fotografiile verificate au fost acceptate'}${duplicates?' · '+duplicates+' duplicate ignorate':''}`;
    $('refChips').replaceChildren(...draftDescriptors.map((_,i)=>{const chip=document.createElement('span');chip.className='ref-chip';chip.textContent=`Fotografia ${i+1} ✓`;return chip}));
    $('refStatus').textContent=ready?'Perfect. Poți salva profilul.':`Am găsit ${count} fotografii valide. Mai ai nevoie de ${remaining}. Poți adăuga și alte fotografii.`;
    const spread=count>=3?referenceSpread(draftDescriptors):null;
    if(spread!==null&&spread>REF_SPREAD_WARN)$('refStatus').textContent='Atenție: unele fotografii de referință par destul de diferite. Verifică să fie aceeași persoană în toate înainte de salvare.';
  }else{
    $('refPreview').hidden=true;$('refThumb').removeAttribute('src');$('refThumb').hidden=true;
    $('refStatus').textContent=`Nu am găsit fotografii valide. ${why||''} Alege portrete clare; dacă într-o poză sunt mai multe persoane, vei putea alege fața potrivită.`;
  }
  $('savePerson').disabled=!ready;
  if(ready)toast(`${count} fotografii valide. Profilul poate fi salvat.`);
  else toast(added?`Sunt necesare cel puțin 3 fotografii valide; momentan ai ${count}.`:`Nicio fotografie nouă acceptată. ${problems[0]?problems[0][1]:''}`);
}
$('clearRefs').onclick=()=>{draftDescriptors=[];draftThumbs=[];draftFileKeys.clear();$('referenceFiles').value='';$('refPreview').hidden=true;$('refThumb').removeAttribute('src');$('refThumb').hidden=true;$('refChips').replaceChildren();$('referenceCount').textContent='0 / 3 fotografii valide';$('referenceRequirementText').textContent='Mai adaugă cel puțin 3 fotografii.';$('refStatus').textContent='Selectează minimum 3 fotografii pentru a crea profilul.';$('savePerson').disabled=true};
$('savePerson').onclick=async()=>{
  if(!canAddPerson()){openPaywall();return}
  if(!await requireConsent())return;
  if(draftDescriptors.length<3){toast('Pentru a salva o persoană sunt necesare cel puțin 3 fotografii valide.');return}
  const name=$('personName').value.trim()||`Persoana ${people.length+1}`;
  const p={id:crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random(),name,thumb:draftThumbs[0],thumbs:draftThumbs.slice(0,16),descs:draftDescriptors.map(x=>Float32Array.from(x)),referenceSpread:referenceSpread(draftDescriptors),createdAt:Date.now(),model:'sface'};
  await storePut('people',p);people.push(p);selectedPersonId=p.id;referenceDescriptors=p.descs.map(x=>Float32Array.from(x));referenceThumbs=[p.thumb];
  renderPeople();updateSearchControls();$('personName').value='';
  draftDescriptors=[];draftThumbs=[];draftFileKeys.clear();$('referenceFiles').value='';$('refPreview').hidden=true;$('refThumb').removeAttribute('src');$('refThumb').hidden=true;$('refChips').replaceChildren();$('referenceCount').textContent='0 / 3 fotografii valide';$('referenceRequirementText').textContent='Profilul a fost salvat. Poți crea altul.';$('refStatus').textContent=`Profilul „${name}” a fost salvat. Îl poți selecta acum în secțiunea „Caută fotografii”.`;$('savePerson').disabled=true;
  toast(`Profilul „${name}” a fost salvat.`);
  if(returnToSearchAfterPersonCreation){returnToSearchAfterPersonCreation=false;navigate('search')}
};
async function loadPeople(){people=await storeAll('people');renderPeople()}
// Profilele create cu motorul vechi (amprentă dlib) nu se pot compara cu amprenta SFace. Le refacem din fețele decupate salvate;
// dacă nu ajung 2 referințe valide, profilul e marcat „stale” și utilizatorul îl reface din poze noi.
async function migrateProfiles(){
  let changed=false;
  for(const p of people){
    if(p.model==='sface'||p.stale)continue;
    const descs=[],srcs=(p.thumbs&&p.thumbs.length?p.thumbs:[p.thumb]).filter(Boolean);
    for(const src of srcs){
      try{
        const img=new Image();img.src=src;await img.decode();
        const c=document.createElement('canvas');c.width=img.width*2;c.height=img.height*2;c.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0,c.width,c.height);
        const r=await detectFacesE(null,false,c),f=r.faces.sort((a,b)=>b.w*b.h-a.w*a.h)[0];
        if(f&&f.s>=.5)descs.push(f.d);
      }catch(e){}
    }
    if(descs.length>=2){p.descs=descs;p.model='sface';p.stale=false;p.referenceSpread=referenceSpread(descs)}
    else p.stale=true;
    await storePut('people',p);changed=true;
  }
  if(changed){if(selectedPersonId){const sp=people.find(x=>x.id===selectedPersonId);if(sp&&!sp.stale)referenceDescriptors=sp.descs.map(x=>x instanceof Float32Array?x:Float32Array.from(x))}renderPeople();updateSearchControls()}
}
function renderPeople(){
  const manage=$('managePeople');manage.replaceChildren();
  if(!people.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Nu ai salvat încă pe nimeni. Apasă „Vezi pozele” sub una dintre fețele de mai sus.';manage.append(empty)}
  manage.classList.add('pgrid');
  const qEl=$('peopleFilter'),q=((qEl&&qEl.value)||'').trim().toLowerCase();
  if(qEl)qEl.hidden=people.length<=8;
  people.filter(p=>!q||p.name.toLowerCase().includes(q)).forEach(p=>{
    const c=document.createElement('div');c.className='pcard';
    const open=document.createElement('button');open.type='button';open.className='pcard-main';open.title=`Vezi pozele cu ${p.name}`;
    const pic=document.createElement('img');pic.src=p.thumb;pic.alt=`Fotografie de profil pentru ${p.name}`;
    const b=document.createElement('b');b.textContent=p.name;
    const sm=document.createElement('small');const n=p.descs.length;sm.textContent=Number.isFinite(p.referenceSpread)&&p.referenceSpread>REF_SPREAD_WARN?'⚠ verifică pozele':`${n} ${n===1?'poză':'poze'} de referință`;
    open.append(pic,b,sm);open.onclick=()=>{selectPerson(p.id);navigate('search')};
    const m=document.createElement('details');m.className='pcard-menu';const sum=document.createElement('summary');sum.textContent='⋯';sum.setAttribute('aria-label',`Opțiuni pentru ${p.name}`);
    const box=document.createElement('div');const ed=document.createElement('button');ed.type='button';ed.textContent='✎ Editează';ed.onclick=()=>{m.open=false;openPersonEditor(p.id)};
    const del=document.createElement('button');del.type='button';del.className='del';del.textContent='Șterge';del.onclick=()=>{m.open=false;deletePerson(p.id)};
    box.append(ed,del);m.append(sum,box);c.append(open,m);manage.append(c);
  });
  if(people.length&&!manage.children.length){const e=document.createElement('div');e.className='empty';e.textContent='Nicio persoană cu acest nume.';manage.append(e)}
  if(typeof renderPlan==='function'&&typeof license!=='undefined')renderPlan();
  $('peopleCount').textContent=`${people.length} ${people.length===1?'persoană':'persoane'}`;
  const sel=$('searchPersonSelect'),old=sel.value;sel.replaceChildren(new Option('Selectează o persoană salvată…',''));
  people.forEach(person=>sel.add(new Option(person.name,person.id)));
  if(selectedPersonId&&people.some(person=>person.id===selectedPersonId))sel.value=selectedPersonId;
  else if(old&&people.some(person=>person.id===old))sel.value=old;
  updateStats();
}
function selectPerson(id){
  const p=people.find(x=>x.id===id);
  if(!p){selectedPersonId=null;referenceDescriptors=[];referenceThumbs=[];$('searchPersonSelect').value='';updateSearchControls();return}
  if(p.model!=='sface'){selectedPersonId=id;referenceDescriptors=[];referenceThumbs=[p.thumb];$('searchPersonSelect').value=id;updateSearchControls();toast(p.stale?`Profilul „${p.name}” a fost creat cu o versiune veche. Adaugă din nou 3 poze de referință ca să îl poți căuta.`:'Pregătesc profilul pentru noul motor de recunoaștere…');return}
  selectedPersonId=id;referenceDescriptors=p.descs.map(x=>x instanceof Float32Array?x:Float32Array.from(x));referenceThumbs=[p.thumb];$('searchPersonSelect').value=id;updateSearchControls();toast(`Ai selectat „${p.name}”.`);
}
async function deletePerson(id){if(!confirm('Ștergi acest profil facial de pe dispozitiv?'))return;await storeDelete('people',id);people=people.filter(x=>x.id!==id);if(selectedPersonId===id){selectedPersonId=null;referenceDescriptors=[];referenceThumbs=[]}$('searchPersonSelect').value='';renderPeople();updateSearchControls();toast('Profil șters.')}
$('searchPersonSelect').onchange=e=>selectPerson(e.target.value);
function searchPrerequisiteState(){
  if(!engineReady)return ['Nu s-a putut porni','Pornește printr-un server'].includes($('engineStatus')?.textContent)?'engineError':'engine';
  if(!activeFiles.length)return 'album';          // întâi albumul…
  if(!indexedEntries.length)return 'index';
  if(!people.length)return 'people';              // …apoi alegi persoana dintre fețele din album
  return 'ready';
}
function renderSearchFlow(){
  const state=searchPrerequisiteState();
  const gate=$('searchGateCard'),form=$('searchControlsCard');
  if(!gate||!form)return state;
  $('page-search').dataset.flow=state;
  gate.hidden=state==='ready';form.hidden=!people.length||state==='engine'||state==='engineError';const bar=$('albumBar');if(bar)bar.hidden=!activeFiles.length;
  const steps={album:$('searchStepAlbum'),person:$('searchStepPerson'),find:$('searchStepFind')};
  Object.values(steps).forEach(el=>el.classList.remove('current','done'));
  const setDone=(key,done)=>steps[key].classList.toggle('done',done);
  const setCurrent=key=>steps[key].classList.add('current');
  const config={
    engine:{step:1,current:'album',symbol:'◌',kicker:'PREGĂTIM APLICAȚIA',title:'Mai avem puțin și putem începe',text:'Se încarcă instrumentele necesare pentru pregătirea albumului. Nu trebuie să faci nimic acum.',progress:engineProgress||'Așteaptă câteva momente…',action:'',secondary:''},
    engineError:{step:1,current:'album',symbol:'↻',kicker:'APLICAȚIA NU A PORNIT',title:'Nu am putut pregăti căutarea',text:location.protocol==='file:'?FILE_MODE_HELP:'Verifică dacă ai conexiune la internet, apoi reîncarcă aplicația pentru a descărca din nou componentele necesare.',progress:'Fotografiile și profilurile tale locale nu sunt șterse.',action:'Reîncarcă aplicația',secondary:''},
    album:{step:1,current:'album',symbol:'▧',kicker:'PASUL 1 DIN 3',title:IS_TOUCH?'Alege pozele':'Unde sunt pozele?',text:IS_TOUCH?'Alege pozele din galerie (poți bifa mai multe). Le pregătim o singură dată, apoi îți arătăm cine apare în ele.':'Alege folderul cu poze. Îl pregătim o singură dată, apoi îți arătăm cine apare în el.',progress:'Pozele rămân pe dispozitivul tău.',action:IS_TOUCH?'Alege pozele':'Alege albumul',secondary:'🔗 Din linkuri'},
    index:{step:1,current:'album',symbol:'◷',kicker:'PASUL 1 DIN 3',title:'Pregătim pozele…',text:'Căutăm fețele din poze. Când terminăm, îți arătăm cine apare în album.',progress:`${fmt(indexedEntries.length)} din ${fmt(activeFiles.length)} poze pregătite.`,action:'Pregătește albumul',secondary:''},
    people:{step:2,current:'person',symbol:'☺',kicker:'PASUL 2 DIN 3',title:'Pe cine cauți?',text:'Am găsit fețele din poze. Alege persoana și scrie-i numele: durează câteva secunde.',progress:'',action:'☺ Vezi cine apare în album',secondary:'Adaug-o din pozele mele'}
  };
  const c=config[state];
  if(state==='ready'){
    setDone('album',true);setDone('person',true);setCurrent('find');
    $('searchSelectionNote').textContent=selectedPersonId?`Persoană selectată: ${people.find(p=>p.id===selectedPersonId)?.name||'profil salvat'}. Poți porni căutarea.`:'Albumul este pregătit. Acum alege o persoană din listă.';
  }else{
    setCurrent(c.current);
    if(state==='index'||state==='people')setDone('album',state==='people');
    if(state==='people')setCurrent('person');
    $('searchGateSymbol').textContent=c.symbol;
    $('searchGateKicker').textContent=c.kicker;
    $('searchGateTitle').textContent=c.title;
    $('searchGateText').textContent=c.text;
    $('searchGateProgress').textContent=c.progress;
    $('searchGateAction').textContent=c.action||'Se pregătește…';
    $('searchGateAction').hidden=!c.action;
    $('searchGateAction').disabled=state==='engine'||busy;
    $('searchGateSecondary').hidden=!c.secondary;
    $('searchGateSecondary').textContent=c.secondary||'';
    $('searchGateAction').dataset.action=state;
  }
  $('searchPageRun').disabled=!(state==='ready'&&engineReady&&!busy&&(groupMode?groupIds.size>=2:(referenceDescriptors.length>=2&&!!selectedPersonId)));
  $('searchPersonSelect').disabled=!people.length||busy;
  const card=$('searchControlsCard');card.querySelectorAll('.search-control-actions,.search-options,.mini-note').forEach(el=>el.hidden=state!=='ready');
  if(state!=='ready'&&people.length){const who=people.find(p=>p.id===selectedPersonId)?.name;$('searchSelectionNote').textContent=who?`${who} e selectată. ${state==='index'?'Căutarea pornește când albumul e pregătit.':'Acum alege albumul mai jos.'}`:'Apasă pe persoana pe care o cauți.'}
  return state;
}
function updateSearchControls(){renderSearchFlow();renderPersonChips();syncGroupToggle();
  const note=$('searchSelectionNote');if(note&&activeFiles.length&&indexedEntries.length&&indexedEntries.length<activeFiles.length)note.textContent=`Caut în ${fmt(indexedEntries.length)} din ${fmt(activeFiles.length)} fotografii${busy?' · restul se pregătesc acum':' · restul nu sunt încă pregătite'}.`}
function renderPersonChips(){
  const box=$('personChips');if(!box)return;box.replaceChildren();
  const ready=searchPrerequisiteState()==='ready';
  for(const p of people){
    const locked=!isPersonUnlocked(p.id),on=groupMode?groupIds.has(p.id):p.id===selectedPersonId;const b=document.createElement('button');b.type='button';b.className='person-chip'+(on?' on':'')+(locked?' locked':'');b.setAttribute('role','listitem');b.setAttribute('aria-pressed',on);b.disabled=busy&&ready;
    const im=document.createElement('img');im.src=p.thumb;im.alt='';const n=document.createElement('span');n.textContent=p.name;
    const sm=document.createElement('small');sm.textContent=locked?'🔒 necesită abonament':'gata de căutat';n.append(sm);
    const pen=document.createElement('span');pen.className='chip-edit';pen.textContent='✎';pen.title='Editează';pen.setAttribute('role','button');pen.setAttribute('aria-label','Editează '+p.name);pen.onclick=e=>{e.stopPropagation();openPersonEditor(p.id)};
    b.append(im,n,pen);b.onclick=()=>{if(locked){openPaywall(`„${p.name}” nu e inclusă în planul ${PLANS[license.plan].name}. Abonează-te ca să o cauți din nou; profilul a rămas salvat.`);return}
      if(groupMode){if(groupIds.has(p.id))groupIds.delete(p.id);else groupIds.add(p.id);updateSearchControls();if(groupIds.size>=2&&searchPrerequisiteState()==='ready')runGroupSearch();else if(groupIds.size<2)toast('Alege încă o persoană: caut pozele în care apar toate cele selectate.');return}
      selectPerson(p.id);const st=searchPrerequisiteState();if(st==='ready'){if(!$('searchPageRun').disabled)runSearch()}else if(st==='album')connectDirectory();else if(st==='index')toast('Caut imediat ce albumul e pregătit.')};box.append(b);
  }
  const add=document.createElement('button');add.type='button';add.className='person-chip add';add.innerHTML=`<span class="plus">＋</span><span>Persoană nouă<small>${indexedEntries.length?'din fețele albumului':'din pozele tale'}</small></span>`;add.onclick=()=>{if(!canAddPerson()){openPaywall();return}returnToSearchAfterPersonCreation=true;navigate('people');if(indexedEntries.length)openAlbumFaces();else openManualPerson()};box.append(add);
}
// Învățare din confirmări: utilizatorul confirmă o potrivire, iar fața devine referință suplimentară.
async function teachProfile(hit){
  const p=people.find(x=>x.id===selectedPersonId);
  if(!p||!hit||!hit.d){toast('Selectează mai întâi persoana.');return}
  if((hit.rawBest??hit.best)>TEACH_MAX_DIST){toast('Fața este prea diferită ca să fie învățată în siguranță.');return}
  const d=Float32Array.from(hit.d),near=Math.min(...p.descs.map(x=>descriptorDistance(x,d)));
  hit.selected=true;
  if(near<.35){toast('O recunosc deja în poze ca asta. Am bifat fotografia.');updateResultSummary();return}
  if(p.descs.length>=16)p.descs.splice(3,1);   // păstrează primele 3 referințe originale
  p.descs.push(d);p.learned=(p.learned||0)+1;await storePut('people',p);
  referenceDescriptors=p.descs.map(x=>x instanceof Float32Array?x:Float32Array.from(x));
  renderPeople();toast(`Mulțumesc! Acum o recunosc mai bine pe „${p.name}”. Caut din nou…`);
  if($('previewDialog').open)$('previewDialog').close();
  await runSearch();
}
$('searchGateAction').onclick=()=>{
  const state=$('searchGateAction').dataset.action;
  if(state==='album'){connectDirectory();return}
  if(state==='index'){
    returnToSearchAfterIndex=true;navigate('search');
    if(engineReady)startIndex();else toast('Aplicația încă se pregătește.');
    return;
  }
  if(state==='people'){returnToSearchAfterPersonCreation=true;navigate('people');openAlbumFaces();return}
};
$('searchGateSecondary').onclick=()=>{const a=$('searchGateAction').dataset.action;if(a==='album')openLinkDialog();else if(a==='people'){returnToSearchAfterPersonCreation=true;navigate('people');openManualPerson()}else navigate('search')};
$('heroSearch').onclick=()=>navigate('search');$('goPeople').onclick=()=>navigate('people');$('searchPagePeople').onclick=()=>navigate('people');
$('deepScan').addEventListener('change',async()=>{if(busy)return;await rebuildIndexedEntries();updateSearchControls();setStatusText(indexedEntries.length?`${fmt(indexedEntries.length)} poze sunt deja pregătite cu această setare.`:'Cu această setare albumul trebuie pregătit din nou.');});
function paintMatchProgress(percent,label){for(const suffix of ['', '2']){const wrap=$('matchProgressWrap'+suffix);if(wrap)wrap.hidden=false;const bar=$('matchProgressBar'+suffix),pct=$('matchProgressPct'+suffix),txt=$('matchProgressLabel'+suffix);if(bar)bar.style.width=percent+'%';if(pct)pct.textContent=percent+'%';if(txt)txt.textContent=label}}
// Potrivire: scor pe fiecare poză + alegerea rezultatelor (folosite de căutare și de rezultatele live)
function scoreEntry(p,refs){const rows=[];for(const face of p.faces||[]){const metric=faceScoreFast(face,refs);if(!metric)continue;rows.push({entry:p,...metric,faceScore:Number(face.s)||0,faceSize:Number(face.m)||0,cloth:face.c||null,d:face.d})}return rows}
function pickHits(scoreRows,policy,useC){
  const hits=[];
  for(const faceRows of scoreRows){
    if(!faceRows?.length)continue;
    const evaluated=faceRows.map(row=>{
      const rawLevel=levelOf(row,policy),adj=useC?clothAdj(row.dc):0;
      if(!adj)return {...row,level:rawLevel,adj:0};
      const adjusted={...row,best:row.best+adj,support:row.support+adj,score:row.score+adj},lvl=levelOf(adjusted,policy);let level=lvl,tag='';
      if(lvl==='strong'&&rawLevel!=='strong'){level='review';tag='rescued'}       // găsită doar datorită ținutei: verificare manuală
      else if(rawLevel==='strong'&&lvl!=='strong'){level='review';tag='demoted'}  // față sigură, dar ținută diferită
      return {...adjusted,rawBest:row.best,rawSupport:row.support,level,tag,adj};
    });
    const strong=evaluated.filter(row=>row.level==='strong').sort((a,b)=>a.score-b.score);
    const review=evaluated.filter(row=>row.level==='review'&&(policy.mode==='extended'||row.tag||row.expanded)).sort((a,b)=>a.score-b.score);
    const chosen=strong[0]||review[0];
    if(chosen)hits.push({...chosen,selected:chosen.level==='strong'});
  }
  hits.sort((a,b)=>(a.level==='strong'?0:1)-(b.level==='strong'?0:1)||a.score-b.score);
  return hits;
}
function keepSelections(hits){const prev=new Map((allHits.length?allHits:latestHits).map(h=>[h.entry.key,h.selected]));for(const h of hits)if(prev.has(h.entry.key))h.selected=prev.get(h.entry.key);return hits}
async function runSearch(){
  const readiness=searchPrerequisiteState();
  if(readiness!=='ready'){updateSearchControls();toast(readiness==='album'?'Alege mai întâi un album.':readiness==='index'?'Pregătește albumul înainte de căutare.':readiness==='people'?'Creează mai întâi un profil.':'Aplicația încă se pregătește.');return}
  if(busy||!referenceDescriptors.length||!indexedEntries.length)return;
  if(selectedPersonId&&!isPersonUnlocked(selectedPersonId)){openPaywall();return}
  if(referenceDescriptors.length<2){toast('Acest profil are prea puține fotografii de referință. Adaugă cel puțin încă una pentru o potrivire mai sigură.');return}
  busy=true;updateSearchControls();
  const started=performance.now(),policy=getMatchPolicy(),refs=referenceDescriptors.map(x=>x instanceof Float32Array?x:Float32Array.from(x)),queryKey=`${MATCH_ALGORITHM_VERSION}|${indexRevision}|${querySignature()}`;
  let scoreRows=searchScoreCache.get(queryKey),fromCache=!!scoreRows;
  try{
    if(!scoreRows){
      scoreRows=new Array(indexedEntries.length);const total=indexedEntries.length;
      paintMatchProgress(0,`Caut în ${fmt(total)} poze…`);
      for(let i=0;i<total;i++){
        scoreRows[i]=scoreEntry(indexedEntries[i],refs);
        if((i+1)%2000===0||i===total-1){const pct=Math.round((i+1)/Math.max(1,total)*100);paintMatchProgress(pct,`Caut · ${fmt(i+1)} din ${fmt(total)} poze`);await new Promise(resolve=>setTimeout(resolve,0))}
      }
      attachClothing(scoreRows);
      try{expandSearch(scoreRows,refs,indexedEntries)}catch(e){console.warn('Extinderea profilului a eșuat',e)}
      if(searchScoreCache.size>=6)searchScoreCache.delete(searchScoreCache.keys().next().value);
      searchScoreCache.set(queryKey,scoreRows);
    }else paintMatchProgress(100,'Gata.');
    const useC=$('useClothes')?.checked!==false&&!!scoreRows.outfits?.length;renderOutfits(scoreRows.outfits,useC);
    latestHits=applyResultView(keepSelections(dropRejected(pickHits(scoreRows,policy,useC),people.find(p=>p.id===selectedPersonId))));
    renderHits();updateStats();
    const strongAll=allHits.filter(x=>x.level==='strong').length,reviewAll=allHits.length-strongAll;
    const who=people.find(p=>p.id===selectedPersonId)?.name||'persoana';toast(strongAll||reviewAll?`Am găsit ${fmt(strongAll)} ${strongAll===1?'poză':'poze'} cu ${who}${reviewAll?` (+${fmt(reviewAll)} de verificat)`:''}.`:`Nu am găsit poze cu ${who}.`);
    paintMatchProgress(100,policy.mode==='precise'?'Gata · doar pozele sigure':'Gata · pozele incerte sunt marcate „Poate”');
  }catch(e){console.error(e);toast('Căutarea a întâmpinat o eroare. Reîncearcă.')}finally{busy=false;updateSearchControls()}
}
// Rezultate live: în timp ce albumul se indexează, pozele cu persoana apar imediat
const live={sig:'',rows:[],seen:new Set(),last:0,count:0};
function liveAdd(entry){
  if(groupMode||!selectedPersonId||referenceDescriptors.length<2||!isPersonUnlocked(selectedPersonId))return;
  const sig=querySignature();if(live.sig!==sig){live.sig=sig;live.rows=[];live.seen=new Set();live.count=0}
  if(live.seen.has(entry.key))return;live.seen.add(entry.key);
  live.rows.push(scoreEntry(entry,referenceDescriptors));
}
function liveFlush(force,label){
  if(!live.rows.length||!selectedPersonId)return;
  const now=performance.now();if(!force&&now-live.last<2500)return;live.last=now;
  attachClothing(live.rows);
  const useC=$('useClothes')?.checked!==false&&!!live.rows.outfits?.length;
  latestHits=applyResultView(keepSelections(dropRejected(pickHits(live.rows,getMatchPolicy(),useC),people.find(p=>p.id===selectedPersonId))));
  const n=allHits.filter(h=>h.level==='strong').length;
  if(n!==live.count||force){live.count=n;renderHits()}
  paintMatchProgress(100,label||`Am găsit ${fmt(n)} ${n===1?'poză':'poze'} până acum · continui să caut…`);
}
$('useClothes').addEventListener('change',()=>{if(allHits.length&&!busy)rerunSearch()});
$('searchAccuracy').addEventListener('change',()=>{if((selectedPersonId||groupMode)&&!busy&&indexedEntries.length)rerunSearch()});
$('searchPageRun').onclick=()=>groupMode?runGroupSearch():runSearch();
function currentFile(hit){return hit.entry.file}
function makeObjectUrl(hit){const k=hit.entry.key;if(objectUrlCache.has(k))return objectUrlCache.get(k);const u=URL.createObjectURL(currentFile(hit));objectUrlCache.set(k,u);return u}
const thumbCache=new Map();let thumbBusy=0;const thumbWait=[];
const thumbIO=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){thumbIO.unobserve(e.target);e.target._load&&e.target._load()}},{rootMargin:'500px'});
function thumbFor(hit){const k=hit.entry.key;if(thumbCache.has(k))return thumbCache.get(k);
  const run=()=>new Promise(async res=>{thumbBusy++;let url=null;
    try{const f=currentFile(hit);const b=await decodeImage(f);
      const sc=Math.min(1,520/Math.max(b.width,b.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(b.width*sc));c.height=Math.max(1,Math.round(b.height*sc));
      c.getContext('2d').drawImage(b,0,0,c.width,c.height);b.close&&b.close();
      url=await new Promise(r=>c.toBlob(bl=>r(bl?URL.createObjectURL(bl):null),'image/jpeg',.85))}catch(e){}
    thumbBusy--;const nx=thumbWait.shift();if(nx)nx();res(url)});
  const p=thumbBusy<3?run():new Promise(r=>thumbWait.push(()=>run().then(r)));thumbCache.set(k,p);return p}
function clearObjectUrls(){for(const p of thumbCache.values())p.then(u=>u&&URL.revokeObjectURL(u));thumbCache.clear();for(const u of objectUrlCache.values())URL.revokeObjectURL(u);objectUrlCache.clear()}
const RESULTS_PAGE_SIZE=120;let resultsShown=0;
function appendResultCards(grid,from,to){for(let i=from;i<to;i++){const h=latestHits[i],c=document.createElement('article');c.className='result';const im=document.createElement('img');im.alt=h.entry.fileName;im.decoding='async';im._load=()=>thumbFor(h).then(u=>{im.src=u||makeObjectUrl(h)});thumbIO.observe(im);im.onclick=()=>openPreview(h,i);const check=document.createElement('label');check.className='result-check';const cb=document.createElement('input');cb.type='checkbox';cb.checked=h.selected;cb.setAttribute('aria-label','Selectează '+h.entry.fileName);cb.onchange=()=>{h.selected=cb.checked;updateResultSummary()};check.append(cb);const tag=document.createElement('span');tag.className='match-tag '+(h.level==='strong'?'good':'review');tag.textContent=h.together?`Împreună · ${h.together.join(' + ')}`:h.level==='strong'?'✓ Sigur':h.tag==='rescued'?'Poate · după haine':h.tag==='demoted'?'Poate · haine diferite':'Poate · verifică';const info=document.createElement('div');info.className='result-info';const when=hitDateLabel(h),b=document.createElement('b');b.textContent=when||h.entry.fileName;b.title=h.entry.fileName;const sm=document.createElement('small');sm.textContent=h.together?(h.level==='strong'?'Toți sunt în poză':'Unul dintre ei e de verificat'):h.level==='review'?'E persoana? Confirmă mai jos':(when?h.entry.fileName:'');info.append(b,sm);c.append(im,check,tag,info);
  if(!h.together){const acts=document.createElement('div');acts.className='result-acts';
    if(h.level==='review'){const ok=document.createElement('button');ok.type='button';ok.className='teach-btn';ok.textContent='✓ E persoana';ok.title='Da, e persoana: aplicația învață și găsește mai multe poze';ok.onclick=e=>{e.stopPropagation();teachProfile(h)};acts.append(ok)}
    const no=document.createElement('button');no.type='button';no.className='teach-btn reject-btn';no.textContent='✗ Nu e';no.title='Nu e persoana: scoate poza și nu o mai arăta';no.onclick=e=>{e.stopPropagation();rejectHit(h)};acts.append(no);info.append(acts)}
  grid.append(c)}}
function renderHits(){resultsShown=Math.min(RESULTS_PAGE_SIZE,latestHits.length);$('resultsGrid2').replaceChildren();appendResultCards($('resultsGrid2'),0,resultsShown);const empty=latestHits.length===0,filtered=empty&&allHits.length>0;$('resultsHead2').hidden=empty&&!filtered;$('resultsEmpty2').hidden=!empty;$('resultsGrid2').hidden=empty;$('moreWrap2').hidden=resultsShown>=latestHits.length;$('resultsEmpty2').innerHTML=filtered?'<div class="big">✧</div><b>Nicio poză pentru filtrul ales</b><p>Apasă „Toate” ca să vezi toate rezultatele.</p>':'<div class="big">✧</div><b>Nu am găsit poze cu această persoană</b><p>Încearcă „Și pe cele de verificat” din Opțiuni de căutare sau adaugă persoanei alte poze de referință.</p>';updateResultSummary();renderResultTools()}
function loadMoreResults(){const from=resultsShown,to=Math.min(resultsShown+RESULTS_PAGE_SIZE,latestHits.length);appendResultCards($('resultsGrid2'),from,to);resultsShown=to;$('moreWrap2').hidden=resultsShown>=latestHits.length;$('more2').textContent=`Încarcă următoarele · ${fmt(Math.min(RESULTS_PAGE_SIZE,latestHits.length-resultsShown))}`}
$('more2').onclick=loadMoreResults;
function updateResultSummary(){const selected=latestHits.filter(x=>x.selected).length,strong=latestHits.filter(x=>x.level==='strong').length,review=latestHits.length-strong;$('resultSummary2').textContent=`${fmt(strong)} ${strong===1?'poză sigură':'poze sigure'}${review?` · ${fmt(review)} de verificat`:''} · ${fmt(selected)} ${selected===1?'selectată':'selectate'}`;$('exportZip2').disabled=!selected}
$('selectAll2').onclick=()=>{const all=latestHits.every(x=>x.selected);latestHits.forEach(x=>x.selected=!all);renderHits()};
async function exportZip(){const chosen=latestHits.filter(x=>x.selected);if(!chosen.length)return;toast('Pregătesc arhiva ZIP…');try{if(!window.JSZip){await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';s.onload=res;s.onerror=rej;document.head.append(s)})}const zip=new JSZip(),folder=zip.folder('discover.me - fotografii gasite');for(let i=0;i<chosen.length;i++){const h=chosen[i],file=currentFile(h);let name=file.name||`fotografie-${i+1}.jpg`;if(folder.file(name))name=`${String(i+1).padStart(4,'0')}-${name}`;folder.file(name,file);if(i%40===0){toast(`Adaug fotografiile în arhivă · ${i+1}/${chosen.length}`);await new Promise(r=>setTimeout(r,0))}}const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='discover-me-fotografii-gasite.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);toast(`Arhiva ZIP a fost creată cu ${chosen.length} fotografii.`)}catch(e){console.error(e);toast('Exportul ZIP nu a reușit. Verifică memoria disponibilă și încearcă din nou.')}}
$('exportZip2').onclick=exportZip;
let previewIndex=-1;
function updatePreview(index){if(!latestHits.length)return;previewIndex=Math.max(0,Math.min(index,latestHits.length-1));const hit=latestHits[previewIndex],url=makeObjectUrl(hit);$('previewTitle').textContent=hitDateLabel(hit)||hit.entry.fileName;$('previewTitle').title=hit.entry.fileName;const img=$('previewImage'),tok=img.dataset.tok=String(Math.random());if(looksHeic(currentFile(hit))){img.removeAttribute('src');displayBlob(currentFile(hit)).then(b=>{if(img.dataset.tok!==tok)return;if(img._heicUrl)URL.revokeObjectURL(img._heicUrl);img._heicUrl=URL.createObjectURL(b);img.src=img._heicUrl}).catch(()=>toast('Nu am putut afișa această poză HEIC.'))}else img.src=url;$('previewImage').alt=`Fotografia ${previewIndex+1} din ${latestHits.length}: ${hit.entry.fileName}`;$('previewCounter').textContent=`${fmt(previewIndex+1)} / ${fmt(latestHits.length)}`;const who=people.find(p=>p.id===selectedPersonId)?.name||'persoana';$('previewMeta').textContent=hit.together?`Împreună: ${hit.together.join(' + ')}${hit.level==='review'?' · unul e de verificat':''}`:hit.level==='review'?`Poate e ${who}. Confirmă cu „Da” sau „Nu e”.`:`Sigur e ${who}.`;$('previewTeach').hidden=!!hit.together;$('previewReject').hidden=!!hit.together;$('previewDownload').href=url;$('previewDownload').download=hit.entry.fileName;$('previewPrev').disabled=previewIndex===0;$('previewNext').disabled=previewIndex===latestHits.length-1}
function openPreview(hit,i){const index=Number.isInteger(i)?i:latestHits.indexOf(hit);updatePreview(index<0?0:index);if(!$('previewDialog').open)$('previewDialog').showModal()}
function stepPreview(delta){if(!$('previewDialog').open)return;const next=previewIndex+delta;if(next<0||next>=latestHits.length)return;updatePreview(next)}
$('previewTeach').onclick=()=>teachProfile(latestHits[previewIndex]);$('previewPrev').onclick=()=>stepPreview(-1);$('previewNext').onclick=()=>stepPreview(1);
$('previewClose').onclick=()=>$('previewDialog').close();$('previewDialog').addEventListener('click',e=>{if(e.target===$('previewDialog'))$('previewDialog').close()});
document.addEventListener('keydown',e=>{if(!$('previewDialog').open)return;if(e.key==='ArrowLeft'){e.preventDefault();stepPreview(-1)}else if(e.key==='ArrowRight'){e.preventDefault();stepPreview(1)}else if(e.key==='Escape')$('previewDialog').close()});
let previewTouchStartX=null; $('previewImage').addEventListener('touchstart',e=>{previewTouchStartX=e.changedTouches?.[0]?.clientX??null},{passive:true});$('previewImage').addEventListener('touchend',e=>{if(previewTouchStartX===null)return;const dx=(e.changedTouches?.[0]?.clientX??previewTouchStartX)-previewTouchStartX;previewTouchStartX=null;if(Math.abs(dx)>45)stepPreview(dx<0?1:-1)},{passive:true});
$('clearIndex').onclick=async()=>{if(!confirm('Ștergi pregătirea albumului? Va trebui pregătit din nou. Pozele tale nu sunt atinse.'))return;const d=await openDB(),t=d.transaction('photos','readwrite');t.objectStore('photos').clear();await idbDone(t);indexedEntries=[];latestHits=[];allHits=[];indexRevision++;searchScoreCache.clear();clearObjectUrls();$('resultsGrid2').replaceChildren();$('resultsHead2').hidden=true;$('resultsEmpty2').hidden=false;updateStats();updateSearchControls();toast('Am șters pregătirea albumului.')};
$('clearAll').onclick=async()=>{if(!confirm('Ștergi toate persoanele salvate și albumul pregătit? Pozele tale nu sunt atinse.'))return;const d=await openDB();for(const name of ['photos','people','settings']){const t=d.transaction(name,'readwrite');t.objectStore(name).clear();await idbDone(t)}people=[];activeFiles=[];indexedEntries=[];latestHits=[];allHits=[];indexRevision++;searchScoreCache.clear();selectedPersonId=null;referenceDescriptors=[];referenceThumbs=[];draftDescriptors=[];draftThumbs=[];draftFileKeys.clear();directoryHandle=null;currentAlbumName='';clearObjectUrls();renderPeople();updateStats();updateSearchControls();$('albumName').textContent='Niciun album selectat';$('fileCount').textContent='0 fotografii';$('resultsGrid2').replaceChildren();$('resultsHead2').hidden=true;$('resultsEmpty2').hidden=false;toast('Datele locale au fost șterse.')};
function navigate(page,fromHistory){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page));document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));const titles={home:'Bun venit la discover.me',search:'Căutare fotografii',people:'Oameni',plan:'Abonament',guide:'Cum folosești aplicația',feedback:'Feedback',settings:'Setări'};$('pageTitle').textContent=titles[page]||'discover.me';
  try{if(!fromHistory&&history.state?.p!==page)history.pushState({p:page},'','#'+page)}catch(e){}if(page==='search')updateSearchControls();if(page==='people')syncAlbumFacesIntro();if(page==='plan'){renderPlan();renderPlanPage()}window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>navigate(b.dataset.page));

// Tema discover.me este fixă: grafit-verzui și verde frunză.
// Nu mai există controale de personalizare; preferințele vizuale vechi sunt ignorate.
(function applyFixedDiscoverTheme(){
  const root=document.documentElement;
  root.dataset.skin='spotify';
  root.dataset.scene='spotify';
  root.dataset.anim='on';
  
  document.body.dataset.wallpaper='none';
})();
async function migrateLegacyPeople(){try{if((await storeAll('people')).length)return;const raw=localStorage.getItem('ch_people');if(!raw)return;const old=JSON.parse(raw);if(!Array.isArray(old))return;let migrated=0;for(const p of old){const list=Array.isArray(p.descs)&&p.descs.length?p.descs:[p.desc??p.descriptor??p.faceDescriptor??p.embedding];const descs=list.map(x=>Float32Array.from(x||[],Number)).filter(x=>x.length===128&&Array.from(x).every(Number.isFinite));if(!descs.length||!p.thumb)continue;await storePut('people',{id:String(p.id??('legacy-'+migrated)),name:String(p.name||('Persoana '+(migrated+1))),thumb:p.thumb,descs,createdAt:Date.now(),migratedFrom:'discover.me 1.x'});migrated++}if(migrated)$('engineNote').textContent=`Am transferat ${migrated} profiluri de persoane din versiunea anterioară. Indexul albumului trebuie creat separat în versiunea 2.0.`}catch(e){console.warn('Migrarea profilurilor vechi nu a reușit',e)}}
async function boot(){if(window.dmIntro)prefetchEngine();try{await openDB();await migrateLegacyPeople();await loadPeople();await loadLicense();await loadConsent();renderPlan();updateSearchControls();await restoreAlbum();if(!activeFiles.length)await restoreLinkAlbum()}catch(e){console.error(e);toast('Stocarea locală nu este disponibilă în acest browser.')}if(window.dmIntroStart)await window.dmIntroStart;initEngine()}
window.addEventListener('beforeunload',clearObjectUrls);boot();

// Planuri și plată
let billing='monthly';   // întâi lunar, apoi anual
const personsTxt=n=>n===Infinity?'Persoane nelimitate':n+(n===1?' persoană':' persoane');
function renderPlan(){
  const pl=PLANS[license.plan]||PLANS.free,lim=peopleLimit(),used=people.length;
  const until=license.plan!=='free'&&license.expiresAt?` · activ până pe ${fmtDate(license.expiresAt)}`:'';
  if($('planName'))$('planName').textContent=pl.name;
  if($('planSummary'))$('planSummary').textContent=`${personsTxt(lim)}${until}`;
  if($('planMeterFill'))$('planMeterFill').style.width=(lim===Infinity?Math.min(100,used*8):Math.min(100,used/lim*100))+'%';
  if($('planMeterText'))$('planMeterText').textContent=lim===Infinity?`${used} ${used===1?'persoană salvată':'persoane salvate'} · fără limită`:`${used} din ${lim} ${lim===1?'persoană folosită':'persoane folosite'}`;
  if($('navPlanSub'))$('navPlanSub').textContent=`${pl.name} · ${personsTxt(lim).toLowerCase()}`;
  if($('page-plan')?.classList.contains('active'))renderPlanPage();
}
function onLicenseChanged(){renderPlan();renderPeople();updateSearchControls();if(albumGroups)renderAlbumFaces()}
// Construiește cardurile de planuri (folosite în pagina Abonament și în fereastra care apare la limită).
function buildPlans(box,onBuy){
  box.replaceChildren();
  for(const p of Object.values(PLANS)){
    const c=document.createElement('div');c.className='pw-plan'+(p.id==='plus'?' best':'')+(p.id===license.plan?' current':'');
    const per=p.id==='free'?'':billing==='yearly'?' / an':' / lună';
    const sub=p.id==='free'?'pentru totdeauna':billing==='yearly'?`adică ${(parseFloat(p.price.yearly.replace(',','.'))/12).toFixed(2).replace('.',',')} € / lună`:'facturat lunar';
    c.innerHTML=`${p.id==='plus'?'<span class="pw-badge">Recomandat</span>':''}<b>${p.name}</b><strong>${p.price[billing]}<em>${per}</em></strong><small class="pw-sub">${sub}</small><span>${personsTxt(p.people)}</span><small>${p.note}</small>`;
    const btn=document.createElement('button');btn.type='button';btn.className='button '+(p.id==='plus'?'primary':'soft')+' small';
    if(p.id===license.plan){btn.textContent=p.id==='free'?'Planul tău':'Abonamentul tău ✓';btn.disabled=true}
    else if(p.id==='free'){btn.textContent='—';btn.disabled=true}
    else{btn.textContent=license.plan==='free'?'Abonează-te':'Schimbă pe '+p.name;btn.onclick=()=>{
      const url=PAYMENTS.checkout[p.id]?.[billing];if(!url){toast('Plata online nu este încă activată. Revino curând.');return}
      window.open(url,'_blank','noopener');onBuy&&onBuy()}}
    c.append(btn);box.append(c);
  }
}
const keyHint=()=>license.plan!=='free'&&license.expiresAt?`Abonament activ până pe ${fmtDate(license.expiresAt)}; se reînnoiește automat dacă nu îl anulezi.`:'Cheia o primești automat pe email după abonare.';
function renderPlanPage(){
  document.querySelectorAll('#ppBilling button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.billing===billing)));
  buildPlans($('ppPlans'),()=>{$('ppKeyMsg').textContent='După plată primești cheia pe email. Lipește-o mai jos și apasă Activează.';$('ppKey').focus()});
  if(!$('ppKey').value)$('ppKeyMsg').textContent=keyHint();
}
function openPaywall(reason){
  const d=$('paywall');
  $('pwReason').textContent=reason||(people.length>=peopleLimit()&&license.plan!=='pro'?`Planul ${PLANS[license.plan].name} include ${personsTxt(peopleLimit()).toLowerCase()}. Abonează-te ca să cauți mai multe persoane. Poți anula oricând.`:'Abonament lunar sau anual. Poți anula oricând.');
  document.querySelectorAll('#pwBilling button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.billing===billing)));
  buildPlans($('pwPlans'),()=>{$('paywall').querySelector('.pw-key').open=true;$('pwKeyMsg').textContent='După plată primești cheia pe email. Lipește-o aici și apasă Activează.'});
  $('pwKeyMsg').textContent=keyHint();
  if(!d.open)d.showModal();
}
document.querySelectorAll('#pwBilling button').forEach(b=>b.onclick=()=>{billing=b.dataset.billing;openPaywall($('pwReason').textContent)});
document.querySelectorAll('#ppBilling button').forEach(b=>b.onclick=()=>{billing=b.dataset.billing;renderPlanPage()});
async function activateFrom(input,msg,btn){
  btn.disabled=true;msg.textContent='Verific cheia…';
  const l=await activateLicense(input.value);btn.disabled=false;
  if(!l||l.error){msg.textContent=l?.error||'Cheia nu este validă.';return false}
  input.value='';onLicenseChanged();msg.textContent=keyHint();
  toast(`Mulțumim! Abonamentul ${PLANS[l.plan].name} este activ.`);return true;
}
$('ppActivate').onclick=()=>activateFrom($('ppKey'),$('ppKeyMsg'),$('ppActivate'));
$('ppKey').addEventListener('keydown',e=>{if(e.key==='Enter')$('ppActivate').click()});
$('pwClose').onclick=()=>$('paywall').close();
$('paywall').addEventListener('click',e=>{if(e.target===$('paywall'))$('paywall').close()});
// După checkout, Lemon Squeezy poate trimite clientul înapoi la ?activate=1 (setare „Redirect URL”).
if(/[?&]activate=1/.test(location.search))setTimeout(()=>{openPaywall('Mulțumim pentru plată! Lipește cheia primită pe email.');$('paywall').querySelector('.pw-key').open=true;$('pwKey').focus()},600);
$('pwActivate').onclick=async()=>{if(await activateFrom($('pwKey'),$('pwKeyMsg'),$('pwActivate')))$('paywall').close()};

// Editare persoană: nume, poză de profil, poze de referință
let editingId=null,editThumb=null;
function faceThumbFromCanvas(canvas,faces){const f=faces.slice().sort((a,b)=>b.w*b.h-a.w*a.h)[0];return f?cropThumb(canvas,f):null}
function centerThumb(canvas){const side=Math.min(canvas.width,canvas.height),o=document.createElement('canvas');o.width=o.height=128;o.getContext('2d').drawImage(canvas,(canvas.width-side)/2,(canvas.height-side)/2,side,side,0,0,128,128);return o.toDataURL('image/jpeg',.86)}
function renderPersonEditor(){
  const p=people.find(x=>x.id===editingId);if(!p)return;
  $('peAvatar').src=editThumb||p.thumb;
  const thumbs=[...new Set([p.thumb,...(p.thumbs||[])])];
  $('peThumbs').replaceChildren(...thumbs.map(t=>{const b=document.createElement('button');b.type='button';b.className='pe-thumb'+(t===(editThumb||p.thumb)?' on':'');const im=new Image();im.src=t;im.alt='';b.append(im);b.onclick=()=>{editThumb=t;renderPersonEditor()};return b}));
  $('peRefs').textContent=`Recunoscută din ${p.descs.length} ${p.descs.length===1?'poză':'poze'}${p.learned?` · ${p.learned} ${p.learned===1?'învățată':'învățate'} din confirmările tale`:''}`;
}
function openPersonEditor(id){
  const p=people.find(x=>x.id===id);if(!p)return;
  editingId=id;editThumb=null;$('peName').value=p.name;$('peMsg').textContent='';
  renderPersonEditor();$('personEditor').showModal();setTimeout(()=>$('peName').focus(),50);
}
async function savePersonEdits(){
  const p=people.find(x=>x.id===editingId);if(!p)return;
  const name=$('peName').value.trim();if(!name){$('peMsg').textContent='Scrie un nume.';$('peName').focus();return}
  p.name=name.slice(0,50);if(editThumb)p.thumb=editThumb;
  await storePut('people',p);renderPeople();updateSearchControls();
  if(selectedPersonId===p.id)referenceThumbs=[p.thumb];
  $('personEditor').close();toast(`Am salvat modificările pentru „${p.name}”.`);
}
$('peSave').onclick=savePersonEdits;
$('peName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();savePersonEdits()}});
$('peClose').onclick=()=>$('personEditor').close();
$('peDelete').onclick=async()=>{const id=editingId;$('personEditor').close();await deletePerson(id)};
$('peAvatarFile').addEventListener('change',async e=>{
  const f=e.target.files?.[0];e.target.value='';if(!f)return;
  $('peMsg').textContent='Pregătesc poza…';
  try{const r=engineReady?await detectFacesE(f,false):{canvas:await toCanvas(f,1400),faces:[]};editThumb=faceThumbFromCanvas(r.canvas,r.faces)||centerThumb(r.canvas);$('peMsg').textContent=r.faces.length?'Poza de profil e pregătită. Apasă Salvează.':'Nu am găsit o față, am folosit centrul pozei. Apasă Salvează.';renderPersonEditor()}
  catch(err){console.warn(err);$('peMsg').textContent='Nu am putut citi poza. Încearcă un JPG sau PNG.'}
});
$('peRefFiles').addEventListener('change',async e=>{
  const files=[...e.target.files||[]];e.target.value='';const p=people.find(x=>x.id===editingId);if(!files.length||!p)return;
  if(!engineReady){$('peMsg').textContent='Aplicația încă se pregătește.';return}
  let added=0,skipped=0;
  // Profil creat cu motorul vechi (amprentă dlib): referințele vechi nu se pot compara cu SFace, deci pornim de la poze noi.
  const legacy=p.model!=='sface';let descs=legacy?[]:p.descs,thumbs=legacy?[]:(p.thumbs||[p.thumb]);
  for(let i=0;i<files.length;i++){
    $('peMsg').textContent=`Analizez poza ${i+1} din ${files.length}…`;
    try{const r=await detectFacesE(files[i],true);let faces=r.faces.filter(f=>f.s>=.5&&f.m>=40);if(!faces.length){skipped++;continue}
      let ref=faces[0];
      if(faces.length>1){const near=faces.map(f=>({f,d:descs.length?Math.min(...descs.map(x=>descriptorDistance(x,f.d))):0})).sort((a,b)=>a.d-b.d);
        if(near[0].d<.95)ref=near[0].f;else{ref=await pickFace(r.canvas,faces,files[i].name);if(!ref){skipped++;continue}}}
      const d=Float32Array.from(ref.d),closest=descs.length?Math.min(...descs.map(x=>descriptorDistance(x,d))):0;
      if(closest>1.10){skipped++;continue}                      // pare altă persoană (SFace: aceeași persoană rar depășește 1,1): nu stricăm profilul
      if(descs.length>=16)descs.splice(3,1);
      descs.push(d);thumbs=[...thumbs,cropThumb(r.canvas,ref)].slice(-16);added++;
    }catch(err){console.warn(err);skipped++}
  }
  if(added){p.descs=descs;p.thumbs=thumbs;if(legacy){p.model='sface';p.stale=false;p.thumb=thumbs[0]||p.thumb}p.referenceSpread=descs.length>=3?referenceSpread(descs):null;await storePut('people',p);if(selectedPersonId===p.id)referenceDescriptors=p.descs.map(x=>x instanceof Float32Array?x:Float32Array.from(x));renderPeople();updateSearchControls()}
  $('peMsg').textContent=`${added?`Am adăugat ${added} ${added===1?'poză':'poze'}.`:'Nicio poză adăugată.'}${skipped?` ${skipped} ${skipped===1?'a fost sărită':'au fost sărite'} (fără față clară sau pare altă persoană).`:''}`;
  renderPersonEditor();
});

// Album din linkuri directe
let linkAlbumUrls=[];
function updateLinkCount(){const n=parseLinks($('ldText').value).length;$('ldCount').textContent=`${n} ${n===1?'link':'linkuri'}`;$('ldGo').disabled=!n||busy}
function openLinkDialog(){
  if(busy){toast('Albumul se pregătește acum. Pune pe pauză înainte să schimbi albumul.');return}
  $('ldErrors').hidden=true;$('ldProgressWrap').hidden=true;
  $('ldAppend').parentElement.hidden=!linkAlbumUrls.length;$('ldAppend').checked=false;
  updateLinkCount();$('linkDialog').showModal();setTimeout(()=>$('ldText').focus(),50);
}
async function loadLinkAlbum(urls,{silent=false}={}){
  const wrap=$('ldProgressWrap'),bar=$('ldProgressBar'),pct=$('ldProgressPct'),lbl=$('ldProgressLabel');
  if(!silent){wrap.hidden=false;$('ldErrors').hidden=true;$('ldGo').disabled=true}
  const {ok,failed}=await downloadLinks(urls,(d,t)=>{if(silent)return;const p=Math.round(d/t*100);bar.style.width=p+'%';pct.textContent=p+'%';lbl.textContent=`Descarc pozele · ${d} din ${t}`});
  if(!silent&&failed.length){
    const box=$('ldErrors');box.hidden=false;box.replaceChildren();
    const h=document.createElement('b');h.textContent=`${failed.length} ${failed.length===1?'link nu a mers':'linkuri nu au mers'}:`;box.append(h);
    for(const x of failed.slice(0,8)){const r=document.createElement('div');const u=document.createElement('span');u.textContent=x.url.length>70?x.url.slice(0,67)+'…':x.url;const e=document.createElement('small');e.textContent=' — '+x.error;r.append(u,e);box.append(r)}
    if(failed.length>8){const m=document.createElement('small');m.textContent=`și încă ${failed.length-8}`;box.append(m)}
  }
  if(!ok.length){if(!silent){lbl.textContent='Nicio poză nu a putut fi descărcată.';$('ldGo').disabled=false}return false}
  const keep=ok.map(x=>x.url);linkAlbumUrls=keep;
  let host='linkuri';try{const hs=[...new Set(keep.map(u=>new URL(u).hostname.replace(/^www\./,'')))];host=hs.length===1?hs[0]:'mai multe site-uri'}catch(e){}
  activeFiles=ok.map(x=>({file:x.file,path:x.url}));
  currentAlbumName=`Poze din linkuri (${host})`;directoryHandle=null;currentAlbumId='links-'+fallbackAlbumIdentity(activeFiles.map(x=>x.file),'links');
  await storePut('settings',{id:'lastLinks',urls:keep});
  afterAlbumLoad();
  if(!silent){lbl.textContent=`Gata: ${ok.length} ${ok.length===1?'poză descărcată':'poze descărcate'}${failed.length?`, ${failed.length} sărite`:''}.`;if(!failed.length)setTimeout(()=>$('linkDialog').open&&$('linkDialog').close(),700)}
  return true;
}
// La pornire: dacă ultimul album a fost din linkuri, îl descărcăm din nou (indexul salvat se refolosește).
async function restoreLinkAlbum(){
  try{const row=await storeGet('settings','lastLinks');if(!row?.urls?.length)return;
    $('abName').textContent='Poze din linkuri';$('abCount').textContent='Se descarcă din nou…';
    await loadLinkAlbum(row.urls,{silent:true});
  }catch(e){console.warn('Albumul din linkuri nu a putut fi restaurat',e)}
}
$('ldText').addEventListener('input',updateLinkCount);
$('ldClose').onclick=()=>$('linkDialog').close();
$('ldGo').onclick=async()=>{
  let urls=parseLinks($('ldText').value);if(!urls.length)return;
  if($('ldAppend').checked&&linkAlbumUrls.length)urls=[...new Set([...linkAlbumUrls,...urls])];
  await loadLinkAlbum(urls);updateLinkCount();
};
$('abLinks').onclick=openLinkDialog;

// Butonul „Înapoi” (telefon sau browser) duce la pagina anterioară din aplicație, nu iese din ea.
addEventListener('popstate',e=>{const pg=e.state?.p||'search';if($('page-'+pg)){document.querySelectorAll('dialog[open]').forEach(d=>d.close());navigate(pg,true)}});
try{history.replaceState({p:'search'},'','#search')}catch(e){}

// Pe telefon ecranul se stinge după câteva secunde și indexarea s-ar opri: cerem ecranului să rămână aprins cât lucrăm.
let wakeLock=null;
async function keepAwake(on){
  try{
    if(on){if('wakeLock'in navigator&&!wakeLock){wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>{wakeLock=null})}}
    else if(wakeLock){await wakeLock.release();wakeLock=null}
  }catch(e){wakeLock=null}
}
document.addEventListener('visibilitychange',()=>{if(busy&&document.visibilityState==='visible')keepAwake(true)});
