// discover.me — Interfața și fluxul aplicației: album, indexare, persoane, căutare, rezultate.
'use strict';

// Pragurile vin din engine/matching.js; interfața alege doar modul.
function getMatchPolicy(){return matchPolicy($('searchAccuracy')?.value)}
const objectUrlCache=new Map(), searchScoreCache=new Map();
function setEngine(ok,label){$('engineDot').classList.toggle('ready',ok);$('engineStatus').textContent=label}
async function connectDirectory(){
  if(busy){toast('Indexarea este în curs. Pune-o pe pauză înainte să schimbi folderul.');return}
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
function afterAlbumLoad(){activeFiles.sort((a,b)=>a.path.localeCompare(b.path,'ro'));indexedEntries=[];latestHits=[];clearObjectUrls();updateStats();$('folderHeadline').textContent=`Album: ${currentAlbumName||'Folder conectat'}`;$('folderHelp').textContent='Poți schimba folderul oricând. Indexul folderelor folosite anterior rămâne salvat.';$('chooseFolder').textContent='Schimbă folderul';$('heroFolder').textContent='Schimbă albumul';$('albumName').textContent=currentAlbumName||'Album';$('fileCount').textContent=fmt(activeFiles.length)+' fotografii';$('settingsAlbum').textContent=currentAlbumName||'Album';$('resultsHead2').hidden=true;$('resultsGrid2').replaceChildren();$('resultsEmpty2').hidden=false;$('resultsEmpty2').textContent='Album conectat. După indexare, selectează o persoană salvată pentru a începe căutarea.';
  $('scanProgressWrap').hidden=false;$('scanLabel').textContent='Pregătit pentru indexare';$('scanPercent').textContent='0%';$('scanBar').style.width='0%';$('scanStatus').textContent=`${fmt(activeFiles.length)} fotografii pregătite.`;
  let start=$('startIndex');if(!start){start=document.createElement('button');start.id='startIndex';start.className='button primary small';start.textContent='▶ Indexează albumul';start.style.marginTop='12px';$('scanStatus').after(start);start.onclick=startIndex}
  start.hidden=!activeFiles.length;updateSearchControls();rebuildIndexedEntries().then(()=>{updateSearchControls();if(indexedEntries.length){const missing=Math.max(0,activeFiles.length-indexedEntries.length);$('scanLabel').textContent='Index local disponibil';$('scanPercent').textContent=Math.round(indexedEntries.length/Math.max(1,activeFiles.length)*100)+'%';$('scanBar').style.width=Math.round(indexedEntries.length/Math.max(1,activeFiles.length)*100)+'%';$('scanStatus').textContent=`${fmt(indexedEntries.length)} fotografii au index local · ${fmt(missing)} necesită indexare. Poți căuta în partea deja indexată.`;updateSearchControls()}autoIndex()}).catch(console.warn);toast(`${fmt(activeFiles.length)} fotografii găsite în „${currentAlbumName}”.`);}
function autoIndex(){if(engineReady&&!busy&&activeFiles.length&&indexedEntries.length<activeFiles.length){returnToSearchAfterIndex=true;startIndex()}}
function setStatusText(t){$('scanStatus').textContent=t}
$('chooseFolder').onclick=connectDirectory;$('heroFolder').onclick=connectDirectory;$('settingsFolder').onclick=connectDirectory;
$('photosFallback').addEventListener('change',e=>{const f=[...e.target.files||[]].filter(isImage);e.target.value='';if(!f.length)return;activeFiles=f.map(file=>({file,path:file.name}));currentAlbumName='Fotografii din galerie';directoryHandle=null;currentAlbumId=fallbackAlbumIdentity(f,'galerie');afterAlbumLoad()});
if(IS_TOUCH){$('folderHeadline').textContent='Alege fotografiile din galerie';$('folderHelp').textContent='Pe telefon selectezi fotografiile direct din galerie (poți bifa mai multe).';$('chooseFolder').textContent='Alege fotografiile'}
$('folderFallback').addEventListener('change',e=>{const f=[...e.target.files||[]];e.target.value='';if(!f.length)return;const root=(f[0].webkitRelativePath||f[0].name).split('/')[0]||'Album';const imageFiles=f.filter(isImage);activeFiles=imageFiles.map(file=>({file,path:file.webkitRelativePath?.split('/').slice(1).join('/')||file.name}));currentAlbumName=root;directoryHandle=null;currentAlbumId=fallbackAlbumIdentity(imageFiles,root);afterAlbumLoad()});
const dz=$('dropZone');dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('drag')});dz.addEventListener('dragleave',()=>dz.classList.remove('drag'));dz.addEventListener('drop',async e=>{e.preventDefault();dz.classList.remove('drag');if(busy){toast('Pune indexarea pe pauză înainte să schimbi folderul.');return}const items=[...(e.dataTransfer.items||[])];let selected=null;for(const it of items){const h=it.getAsFileSystemHandle?await it.getAsFileSystemHandle():null;if(h?.kind==='directory'){selected=h;break}}if(selected){const found=await listDirectory(selected);if(!found.length){toast('Folderul ales nu conține fotografii acceptate.');return}directoryHandle=selected;currentAlbumName=selected.name||'Album';currentAlbumId=await rememberAlbumHandle(selected,currentAlbumName);activeFiles=found;await storePut('settings',{id:'lastAlbum',name:currentAlbumName,handle:directoryHandle,albumId:currentAlbumId});afterAlbumLoad()}else{toast('Trage un folder aici sau folosește butonul „Alege folderul”.')}});
async function restoreAlbum(){try{const saved=await storeGet('settings','lastAlbum');if(!saved?.handle)return;directoryHandle=saved.handle;currentAlbumName=saved.name||saved.handle.name;currentAlbumId=await rememberAlbumHandle(directoryHandle,currentAlbumName,saved.albumId||currentAlbumName);if(saved.albumId!==currentAlbumId)await storePut('settings',{...saved,albumId:currentAlbumId});const p=await directoryHandle.queryPermission({mode:'read'});if(p==='granted'){activeFiles=await listDirectory(directoryHandle);afterAlbumLoad()}else{$('folderHeadline').textContent='Reconectează albumul salvat';$('folderHelp').textContent='Acordă din nou acces sau alege un alt folder.';$('chooseFolder').textContent='Alege folderul';$('albumName').textContent=currentAlbumName;$('fileCount').textContent='Accesul trebuie reconfirmat';$('scanStatus').textContent='Apasă „Alege folderul” pentru a acorda din nou acces.'}}catch(e){console.warn('Restaurare album indisponibilă',e)}}

async function initEngine(){try{if(!window.faceapi)throw new Error('Biblioteca foto nu s-a încărcat');await faceapi.tf.ready();await Promise.all([faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_BASE),faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE),faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE),faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE)]);engineReady=true;$('engineNote').textContent='Totul este pregătit. Prima analiză a albumului poate dura, iar apoi fotografiile deja verificate nu sunt analizate din nou.';setEngine(true,'Pregătit');await warmup();autoIndex()}catch(e){console.error(e);setEngine(false,'Nu s-a putut porni');$('engineNote').textContent='Verifică internetul și reîncarcă pagina pentru a pregăti aplicația.';toast('Nu am putut pregăti aplicația. Verifică conexiunea la internet și reîncarcă pagina.')}updateSearchControls()}
function binColor(i){
  if(i>=48)return ['#111','#555','#8a8a8a','#c4c4c4','#f4f4f4'][i-48];
  const h=((i>>2)%12)*30+15,s=(i&2)?.75:.35,v=(i&1)?.85:.45,k=n=>{const q=(n+h/60)%6;return v-v*s*Math.max(0,Math.min(q,4-q,1))};
  return `rgb(${Math.round(k(5)*255)},${Math.round(k(3)*255)},${Math.round(k(1)*255)})`;
}
function renderOutfits(outfits,on){
  const box=$('outfitInfo');if(!box)return;box.replaceChildren();
  if(!on&&outfits&&outfits.length&&$('useClothes')&&!$('useClothes').checked)return;
  const t=document.createElement('small');t.className='sub';
  if(!outfits||!outfits.length){t.textContent='Ținuta nu a putut fi învățată (prea puține potriviri foarte sigure).';box.append(t);return}
  t.textContent='Ținute învățate din potrivirile sigure:';box.append(t);
  for(const o of outfits){const g=document.createElement('span');g.className='outfit-grp';g.title=o.n+' fotografii';
    [...o.mean].map((v,i)=>[v,i]).sort((a,b)=>b[0]-a[0]).slice(0,4).filter(x=>x[0]>.25).forEach(([,i])=>{const d=document.createElement('span');d.className='outfit-dot';d.style.background=binColor(i);g.append(d)});box.append(g)}
}
async function startIndex(){if(!engineReady){toast('Aplicația încă se pregătește.');return}if(busy||!activeFiles.length)return;busy=true;$('deepScan').disabled=true;pauseRequested=false;$('pauseScan').disabled=false;$('pauseScan').textContent='Pauză după fotografia curentă';$('pauseScan').hidden=false;$('startIndex').hidden=true;const progress=$('scanProgressWrap');progress.hidden=false;
 try{const cached=await cacheMap();let done=0,reused=0,failed=0;const writes=[];const total=activeFiles.length;const root=currentAlbumName||'Album',deep=$('deepScan').checked;let started=performance.now();
  // Decodează următoarele două imagini în avans, dar păstrează inferența serială:
  // TensorFlow.js/WebGL este mai stabil fără sesiuni GPU concurente.
  const pending=new Map(),hasGoodCache=key=>{const value=cached.get(key);return !!value&&!value.error};const prefetch=i=>{if(i>=total||hasGoodCache(fileKey(activeFiles[i].file,activeFiles[i].path,root))||pending.has(i))return;pending.set(i,toCanvas(activeFiles[i].file,deep?2000:1400).then(canvas=>({canvas}),error=>({error})))};
  const prefetchAhead=i=>{let count=0;for(let k=i;k<total&&count<2;k++){const key=fileKey(activeFiles[k].file,activeFiles[k].path,root);if(!hasGoodCache(key)){prefetch(k);count++}}};prefetchAhead(0);
  for(let i=0;i<total;i++){if(pauseRequested)break;const item=activeFiles[i],key=fileKey(item.file,item.path,root);let entry=cached.get(key);if(entry?.error)entry=null;
   if(entry){reused++}else{try{setStatusText(`Analizez ${item.path} · ${i+1}/${fmt(total)}`);prefetchAhead(i+1);const prep=await pending.get(i);pending.delete(i);if(prep?.error)throw prep.error;const result=await detectFaces(item.file,deep,prep?.canvas);const faces=result.faces.map(f=>({...f,c:clothHist(result.canvas,f)}));entry={key,path:item.path,fileName:item.file.name,size:item.file.size,modified:item.file.lastModified,faces,processedAt:Date.now(),engine:ENGINE_VERSION};writes.push(entry);cached.set(key,entry);if(writes.length>=12)await storePutMany('photos',writes.splice(0))}catch(e){failed++;console.warn('Fotografie omisă',item.path,e);entry={key,path:item.path,fileName:item.file.name,size:item.file.size,faces:[],processedAt:Date.now(),engine:ENGINE_VERSION,error:true};writes.push(entry);cached.set(key,entry);if(writes.length>=12)await storePutMany('photos',writes.splice(0)).catch(()=>{})}}
   if(entry&&!entry.error)liveAdd({...entry,file:item.file,handle:item.handle});
   done++;if(done%5===0||i===total-1){liveFlush();const pct=Math.round((i+1)/total*100);$('scanPercent').textContent=pct+'%';$('scanBar').style.width=pct+'%';$('scanLabel').textContent=`Indexate ${fmt(i+1)} din ${fmt(total)}`;$('scanStatus').textContent=`${fmt(reused)} din cache · ${fmt(failed)} erori · ${Math.round((performance.now()-started)/1000)} secunde`;updateStats();await new Promise(r=>setTimeout(r,0))}
  }
  if(writes.length)await storePutMany('photos',writes);await rebuildIndexedEntries();if(pauseRequested){$('scanLabel').textContent='Indexare întreruptă';$('scanStatus').textContent=`Progres salvat. Apasă „Reia indexarea” pentru a continua.`;toast('Indexarea a fost pusă în pauză. Progresul este salvat.')}else{$('scanLabel').textContent='Indexare completă';$('scanPercent').textContent='100%';$('scanBar').style.width='100%';$('scanStatus').textContent=`${fmt(indexedEntries.length)} fotografii indexate · ${fmt(indexedEntries.reduce((n,p)=>n+p.faces.length,0))} fețe · ${fmt(reused)} rezultate reutilizate din cache · ${failed} erori.`;toast('Indexarea albumului s-a încheiat. Poți căuta acum.')}
 }catch(e){console.error(e);toast('A apărut o eroare la indexare. Progresul deja salvat nu se pierde.')}finally{busy=false;$('deepScan').disabled=false;$('pauseScan').hidden=true;$('startIndex').hidden=false;$('startIndex').textContent=pauseRequested?'▶ Reia indexarea':'↻ Verifică fotografiile noi';$('startIndex').onclick=startIndex;updateSearchControls();updateStats();if(returnToSearchAfterIndex&&!pauseRequested&&activeFiles.length&&indexedEntries.length>=activeFiles.length){returnToSearchAfterIndex=false;navigate('search')}if(!pauseRequested&&indexedEntries.length){if(selectedPersonId&&referenceDescriptors.length>=2)runSearch();else toast('Albumul este pregătit. Alege persoana.')}}}
$('pauseScan').onclick=()=>{pauseRequested=true;$('pauseScan').disabled=true;$('pauseScan').textContent='Se oprește după fotografia curentă…'};
async function rebuildIndexedEntries(){const all=await storeAll('photos');const activeKeys=new Set(activeFiles.map(x=>fileKey(x.file,x.path,currentAlbumName||'Album')));const map=new Map(all.filter(x=>activeKeys.has(x.key)).map(x=>[x.key,x]));indexedEntries=activeFiles.map(item=>{const key=fileKey(item.file,item.path,currentAlbumName||'Album'),row=map.get(key);return row?{...row,file:item.file,handle:item.handle}:null}).filter(Boolean);indexRevision++;searchScoreCache.clear();updateStats()}
function updateStats(){const faces=indexedEntries.reduce((n,p)=>n+(p.faces||[]).length,0);$('statPhotos').textContent=fmt(activeFiles.length);$('statAlbum').textContent=currentAlbumName||'Niciun album conectat';$('statFaces').textContent=fmt(faces);$('statPeople').textContent=fmt(people.length);$('statMatches').textContent=fmt(latestHits.length);$('settingsIndex').textContent=`${fmt(indexedEntries.length)} fotografii · ${fmt(faces)} fețe indexate`;}

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
      let r=await detectFaces(file,true),faces=r.faces.filter(f=>f.s>=.40&&f.m>=28);
      if(!faces.length)for(const deg of [90,270]){                  // poză rotită fără informații EXIF
        const rc=rotateCanvas(r.canvas,deg),rr=await detectFaces(file,false,rc),ff=rr.faces.filter(f=>f.s>=.40&&f.m>=28);
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
      problems.push([file.name,(e&&e.name==='InvalidStateError')||/\.(heic|heif)$/i.test(file.name)?'formatul nu poate fi citit de browser (HEIC?); convertește în JPG sau PNG':'eroare la analiză']);
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
    if(spread!==null&&spread>.62)$('refStatus').textContent='Atenție: unele fotografii de referință par destul de diferite. Verifică să fie aceeași persoană în toate înainte de salvare.';
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
  if(draftDescriptors.length<3){toast('Pentru a salva o persoană sunt necesare cel puțin 3 fotografii valide.');return}
  const name=$('personName').value.trim()||`Persoana ${people.length+1}`;
  const p={id:crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random(),name,thumb:draftThumbs[0],thumbs:draftThumbs.slice(0,16),descs:draftDescriptors.map(x=>Float32Array.from(x)),referenceSpread:referenceSpread(draftDescriptors),createdAt:Date.now()};
  await storePut('people',p);people.push(p);selectedPersonId=p.id;referenceDescriptors=p.descs.map(x=>Float32Array.from(x));referenceThumbs=[p.thumb];
  renderPeople();updateSearchControls();$('personName').value='';
  draftDescriptors=[];draftThumbs=[];draftFileKeys.clear();$('referenceFiles').value='';$('refPreview').hidden=true;$('refThumb').removeAttribute('src');$('refThumb').hidden=true;$('refChips').replaceChildren();$('referenceCount').textContent='0 / 3 fotografii valide';$('referenceRequirementText').textContent='Profilul a fost salvat. Poți crea altul.';$('refStatus').textContent=`Profilul „${name}” a fost salvat. Îl poți selecta acum în secțiunea „Caută fotografii”.`;$('savePerson').disabled=true;
  toast(`Profilul „${name}” a fost salvat.`);
  if(returnToSearchAfterPersonCreation){returnToSearchAfterPersonCreation=false;navigate('search')}
};
async function loadPeople(){people=await storeAll('people');renderPeople()}
function renderPeople(){
  const manage=$('managePeople');manage.replaceChildren();
  if(!people.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Nu ai salvat persoane încă. Creează primul profil folosind cel puțin 3 fotografii.';manage.append(empty)}
  people.forEach(p=>{
    const c=document.createElement('div');c.className='manage-card';
    const pic=document.createElement('img');pic.src=p.thumb;pic.alt=`Fotografie de profil pentru ${p.name}`;
    const d=document.createElement('div');d.className='details';const b=document.createElement('b');b.textContent=p.name;const sm=document.createElement('small');sm.textContent=`${p.descs.length} fotografii de referință${Number.isFinite(p.referenceSpread)&&p.referenceSpread>.62?' · verifică imaginile':''}`;d.append(b,sm);
    const acts=document.createElement('div');acts.className='actions';const use=document.createElement('button');use.className='button soft small';use.textContent='Caută';use.onclick=()=>{selectPerson(p.id);navigate('search')};const ed=document.createElement('button');ed.className='button soft small';ed.textContent='✎ Editează';ed.onclick=()=>openPersonEditor(p.id);
    const del=document.createElement('button');del.className='button danger small';del.textContent='Șterge';del.onclick=()=>deletePerson(p.id);acts.append(use,ed,del);c.append(pic,d,acts);manage.append(c);
  });
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
  selectedPersonId=id;referenceDescriptors=p.descs.map(x=>x instanceof Float32Array?x:Float32Array.from(x));referenceThumbs=[p.thumb];$('searchPersonSelect').value=id;updateSearchControls();toast(`Ai selectat „${p.name}”.`);
}
async function deletePerson(id){if(!confirm('Ștergi acest profil facial de pe dispozitiv?'))return;await storeDelete('people',id);people=people.filter(x=>x.id!==id);if(selectedPersonId===id){selectedPersonId=null;referenceDescriptors=[];referenceThumbs=[]}$('searchPersonSelect').value='';renderPeople();updateSearchControls();toast('Profil șters.')}
$('searchPersonSelect').onchange=e=>selectPerson(e.target.value);
function searchPrerequisiteState(){
  if(!engineReady)return $('engineStatus')?.textContent==='Nu s-a putut porni'?'engineError':'engine';
  if(!people.length)return 'people';
  if(!activeFiles.length)return 'album';
  if(!indexedEntries.length)return 'index';
  return 'ready';
}
function renderSearchFlow(){
  const state=searchPrerequisiteState();
  const gate=$('searchGateCard'),form=$('searchControlsCard');
  if(!gate||!form)return state;
  gate.hidden=state==='ready';form.hidden=!people.length||state==='engine'||state==='engineError';const bar=$('albumBar');if(bar)bar.hidden=!activeFiles.length;
  const steps={album:$('searchStepAlbum'),person:$('searchStepPerson'),find:$('searchStepFind')};
  Object.values(steps).forEach(el=>el.classList.remove('current','done'));
  const setDone=(key,done)=>steps[key].classList.toggle('done',done);
  const setCurrent=key=>steps[key].classList.add('current');
  const config={
    engine:{step:1,current:'album',symbol:'◌',kicker:'PREGĂTIM APLICAȚIA',title:'Mai avem puțin și putem începe',text:'Se încarcă instrumentele necesare pentru pregătirea albumului. Nu trebuie să faci nimic acum.',progress:'Așteaptă câteva momente…',action:'',secondary:''},
    engineError:{step:1,current:'album',symbol:'↻',kicker:'APLICAȚIA NU A PORNIT',title:'Nu am putut pregăti căutarea',text:'Verifică dacă ai conexiune la internet, apoi reîncarcă aplicația pentru a descărca din nou componentele necesare.',progress:'Fotografiile și profilurile tale locale nu sunt șterse.',action:'Reîncarcă aplicația',secondary:''},
    people:{step:1,current:'person',symbol:'♡',kicker:'PASUL 1 DIN 2',title:'Pe cine cauți?',text:'Adaugă 3 fotografii clare cu fața persoanei. Apoi alegi albumul în care o căutăm.',progress:'Durează mai puțin de un minut.',action:'Adaugă persoana',secondary:''},
    album:{step:2,current:'album',symbol:'▧',kicker:'PASUL 2 DIN 2',title:'Unde o căutăm?',text:'Alege folderul cu fotografii. Îl pregătim o singură dată, apoi căutarea pornește singură.',progress:'Fotografiile rămân pe dispozitivul tău.',action:'Alege albumul',secondary:''},
    index:{step:2,current:'album',symbol:'◷',kicker:'PASUL 2 DIN 2',title:'Pregătim albumul…',text:'Căutarea pornește automat când primele fotografii sunt gata. Fotografiile deja pregătite nu mai sunt analizate a doua oară.',progress:`${fmt(indexedEntries.length)} din ${fmt(activeFiles.length)} fotografii pregătite.`,action:'Pregătește albumul',secondary:''}
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
  $('searchPageRun').disabled=!(state==='ready'&&engineReady&&referenceDescriptors.length>=2&&!!selectedPersonId&&!busy);
  $('searchPersonSelect').disabled=!people.length||busy;
  const card=$('searchControlsCard');card.querySelectorAll('.search-control-actions,.search-options,.mini-note').forEach(el=>el.hidden=state!=='ready');
  if(state!=='ready'&&people.length){const who=people.find(p=>p.id===selectedPersonId)?.name;$('searchSelectionNote').textContent=who?`${who} e selectată. ${state==='index'?'Căutarea pornește când albumul e pregătit.':'Acum alege albumul mai jos.'}`:'Apasă pe persoana pe care o cauți.'}
  return state;
}
function updateSearchControls(){renderSearchFlow();renderPersonChips();
  const note=$('searchSelectionNote');if(note&&activeFiles.length&&indexedEntries.length&&indexedEntries.length<activeFiles.length)note.textContent=`Caut în ${fmt(indexedEntries.length)} din ${fmt(activeFiles.length)} fotografii${busy?' · restul se pregătesc acum':' · restul nu sunt încă pregătite'}.`}
function renderPersonChips(){
  const box=$('personChips');if(!box)return;box.replaceChildren();
  const ready=searchPrerequisiteState()==='ready';
  for(const p of people){
    const b=document.createElement('button');b.type='button';b.className='person-chip'+(p.id===selectedPersonId?' on':'');b.setAttribute('role','listitem');b.setAttribute('aria-pressed',p.id===selectedPersonId);b.disabled=busy&&ready;
    const im=document.createElement('img');im.src=p.thumb;im.alt='';const n=document.createElement('span');n.textContent=p.name;
    const sm=document.createElement('small');sm.textContent=p.descs.length+' ipostaze';n.append(sm);
    const pen=document.createElement('span');pen.className='chip-edit';pen.textContent='✎';pen.title='Editează';pen.setAttribute('role','button');pen.setAttribute('aria-label','Editează '+p.name);pen.onclick=e=>{e.stopPropagation();openPersonEditor(p.id)};
    b.append(im,n,pen);b.onclick=()=>{selectPerson(p.id);const st=searchPrerequisiteState();if(st==='ready'){if(!$('searchPageRun').disabled)runSearch()}else if(st==='album')connectDirectory();else if(st==='index')toast('Caut imediat ce albumul e pregătit.')};box.append(b);
  }
  const add=document.createElement('button');add.type='button';add.className='person-chip add';add.innerHTML='<span class="plus">＋</span><span>Persoană nouă<small>3 poze clare</small></span>';add.onclick=()=>{if(!canAddPerson()){openPaywall();return}returnToSearchAfterPersonCreation=true;navigate('people')};box.append(add);
}
// Învățare din confirmări: utilizatorul confirmă o potrivire, iar fața devine referință suplimentară.
async function teachProfile(hit){
  const p=people.find(x=>x.id===selectedPersonId);
  if(!p||!hit||!hit.d){toast('Selectează mai întâi persoana.');return}
  if((hit.rawBest??hit.best)>.62){toast('Fața este prea diferită ca să fie învățată în siguranță.');return}
  const d=Float32Array.from(hit.d),near=Math.min(...p.descs.map(x=>descriptorDistance(x,d)));
  hit.selected=true;
  if(near<.2){toast('Profilul cunoaște deja această ipostază. Am selectat fotografia.');updateResultSummary();return}
  if(p.descs.length>=16)p.descs.splice(3,1);   // păstrează primele 3 referințe originale
  p.descs.push(d);p.learned=(p.learned||0)+1;await storePut('people',p);
  referenceDescriptors=p.descs.map(x=>x instanceof Float32Array?x:Float32Array.from(x));
  renderPeople();toast(`Am învățat o ipostază nouă pentru „${p.name}”. Caut din nou…`);
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
  if(state==='people'){returnToSearchAfterPersonCreation=true;navigate('people');return}
};
$('searchGateSecondary').onclick=()=>navigate('search');
$('heroSearch').onclick=()=>navigate('search');$('goPeople').onclick=()=>navigate('people');$('searchPagePeople').onclick=()=>navigate('people');
$('deepScan').addEventListener('change',async()=>{if(busy)return;await rebuildIndexedEntries();updateSearchControls();setStatusText(indexedEntries.length?`${fmt(indexedEntries.length)} fotografii au un index compatibil cu această setare.`:'Pentru această setare nu există încă index. Rulează indexarea albumului.');});
function paintMatchProgress(percent,label){for(const suffix of ['', '2']){const wrap=$('matchProgressWrap'+suffix);if(wrap)wrap.hidden=false;const bar=$('matchProgressBar'+suffix),pct=$('matchProgressPct'+suffix),txt=$('matchProgressLabel'+suffix);if(bar)bar.style.width=percent+'%';if(pct)pct.textContent=percent+'%';if(txt)txt.textContent=label}}
// --- Potrivire: scor pe fiecare poză + alegerea rezultatelor (folosite de căutare și de rezultatele live) ---
function scoreEntry(p,refs){const rows=[];for(const face of p.faces||[]){const metric=faceScoreFast(face,refs);if(!metric)continue;rows.push({entry:p,...metric,faceScore:Number(face.s)||0,faceSize:Number(face.m)||0,cloth:face.c||null,d:face.d})}return rows}
function pickHits(scoreRows,policy,useC){
  const hits=[];
  for(const faceRows of scoreRows){
    if(!faceRows?.length)continue;
    const evaluated=faceRows.map(row=>{
      const rawLevel=classifyScore(row,policy),adj=useC?clothAdj(row.dc):0;
      if(!adj)return {...row,level:rawLevel,adj:0};
      const adjusted={...row,best:row.best+adj,support:row.support+adj,score:row.score+adj},lvl=classifyScore(adjusted,policy);let level=lvl,tag='';
      if(lvl==='strong'&&rawLevel!=='strong'){level='review';tag='rescued'}       // găsită doar datorită ținutei: verificare manuală
      else if(rawLevel==='strong'&&lvl!=='strong'){level='review';tag='demoted'}  // față sigură, dar ținută diferită
      return {...adjusted,rawBest:row.best,rawSupport:row.support,level,tag,adj};
    });
    const strong=evaluated.filter(row=>row.level==='strong').sort((a,b)=>a.score-b.score);
    const review=evaluated.filter(row=>row.level==='review'&&(policy.mode==='extended'||row.tag)).sort((a,b)=>a.score-b.score);
    const chosen=strong[0]||review[0];
    if(chosen)hits.push({...chosen,selected:chosen.level==='strong'});
  }
  hits.sort((a,b)=>(a.level==='strong'?0:1)-(b.level==='strong'?0:1)||a.score-b.score);
  return hits;
}
function keepSelections(hits){const prev=new Map(latestHits.map(h=>[h.entry.key,h.selected]));for(const h of hits)if(prev.has(h.entry.key))h.selected=prev.get(h.entry.key);return hits}
async function runSearch(){
  const readiness=searchPrerequisiteState();
  if(readiness!=='ready'){updateSearchControls();toast(readiness==='album'?'Alege mai întâi un album.':readiness==='index'?'Pregătește albumul înainte de căutare.':readiness==='people'?'Creează mai întâi un profil.':'Aplicația încă se pregătește.');return}
  if(busy||!referenceDescriptors.length||!indexedEntries.length)return;
  if(referenceDescriptors.length<2){toast('Acest profil are prea puține fotografii de referință. Adaugă cel puțin încă una pentru o potrivire mai sigură.');return}
  busy=true;updateSearchControls();
  const started=performance.now(),policy=getMatchPolicy(),refs=referenceDescriptors.map(x=>x instanceof Float32Array?x:Float32Array.from(x)),queryKey=`${MATCH_ALGORITHM_VERSION}|${indexRevision}|${querySignature()}`;
  let scoreRows=searchScoreCache.get(queryKey),fromCache=!!scoreRows;
  try{
    if(!scoreRows){
      scoreRows=new Array(indexedEntries.length);const total=indexedEntries.length;
      paintMatchProgress(0,`Compar fotografiile în ${fmt(total)} imagini…`);
      for(let i=0;i<total;i++){
        scoreRows[i]=scoreEntry(indexedEntries[i],refs);
        if((i+1)%2000===0||i===total-1){const pct=Math.round((i+1)/Math.max(1,total)*100);paintMatchProgress(pct,`Compar fotografiile · ${fmt(i+1)} din ${fmt(total)}`);await new Promise(resolve=>setTimeout(resolve,0))}
      }
      attachClothing(scoreRows);
      if(searchScoreCache.size>=6)searchScoreCache.delete(searchScoreCache.keys().next().value);
      searchScoreCache.set(queryKey,scoreRows);
    }else paintMatchProgress(100,'Am refolosit comparațiile acestei persoane.');
    const useC=$('useClothes')?.checked!==false&&!!scoreRows.outfits?.length;renderOutfits(scoreRows.outfits,useC);
    latestHits=keepSelections(pickHits(scoreRows,policy,useC));
    renderHits();updateStats();
    const strong=latestHits.filter(x=>x.level==='strong').length,review=latestHits.length-strong,elapsed=((performance.now()-started)/1000).toFixed(1);
    toast(`${strong} potriviri sigure${review?` și ${review} de verificat`:''} · ${elapsed} s${fromCache?' · comparații reutilizate':''}.`);
    paintMatchProgress(100,policy.mode==='precise'?'Căutare finalizată · afișate doar potrivirile sigure':'Căutare finalizată · variantele incerte sunt marcate separat');
  }catch(e){console.error(e);toast('Căutarea a întâmpinat o eroare. Reîncearcă.')}finally{busy=false;updateSearchControls()}
}
// --- Rezultate live: în timp ce albumul se indexează, pozele cu persoana apar imediat ---
const live={sig:'',rows:[],seen:new Set(),last:0,count:0};
function liveAdd(entry){
  if(!selectedPersonId||referenceDescriptors.length<2)return;
  const sig=querySignature();if(live.sig!==sig){live.sig=sig;live.rows=[];live.seen=new Set();live.count=0}
  if(live.seen.has(entry.key))return;live.seen.add(entry.key);
  live.rows.push(scoreEntry(entry,referenceDescriptors));
}
function liveFlush(force,label){
  if(!live.rows.length||!selectedPersonId)return;
  const now=performance.now();if(!force&&now-live.last<2500)return;live.last=now;
  attachClothing(live.rows);
  const useC=$('useClothes')?.checked!==false&&!!live.rows.outfits?.length;
  latestHits=keepSelections(pickHits(live.rows,getMatchPolicy(),useC));
  const n=latestHits.filter(h=>h.level==='strong').length;
  if(n!==live.count||force){live.count=n;renderHits()}
  paintMatchProgress(100,label||`Am găsit ${fmt(n)} ${n===1?'poză':'poze'} până acum · continui să caut…`);
}
$('useClothes').addEventListener('change',()=>{if(latestHits.length&&!busy)runSearch()});
$('searchAccuracy').addEventListener('change',()=>{if(selectedPersonId&&!busy&&indexedEntries.length)runSearch()});
$('searchPageRun').onclick=runSearch;
function currentFile(hit){return hit.entry.file}
function makeObjectUrl(hit){const k=hit.entry.key;if(objectUrlCache.has(k))return objectUrlCache.get(k);const u=URL.createObjectURL(currentFile(hit));objectUrlCache.set(k,u);return u}
const thumbCache=new Map();let thumbBusy=0;const thumbWait=[];
const thumbIO=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){thumbIO.unobserve(e.target);e.target._load&&e.target._load()}},{rootMargin:'500px'});
function thumbFor(hit){const k=hit.entry.key;if(thumbCache.has(k))return thumbCache.get(k);
  const run=()=>new Promise(async res=>{thumbBusy++;let url=null;
    try{const f=currentFile(hit);let b;try{b=await createImageBitmap(f,{imageOrientation:'from-image'})}catch(_){b=await createImageBitmap(f)}
      const sc=Math.min(1,520/Math.max(b.width,b.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(b.width*sc));c.height=Math.max(1,Math.round(b.height*sc));
      c.getContext('2d').drawImage(b,0,0,c.width,c.height);b.close&&b.close();
      url=await new Promise(r=>c.toBlob(bl=>r(bl?URL.createObjectURL(bl):null),'image/jpeg',.85))}catch(e){}
    thumbBusy--;const nx=thumbWait.shift();if(nx)nx();res(url)});
  const p=thumbBusy<3?run():new Promise(r=>thumbWait.push(()=>run().then(r)));thumbCache.set(k,p);return p}
function clearObjectUrls(){for(const p of thumbCache.values())p.then(u=>u&&URL.revokeObjectURL(u));thumbCache.clear();for(const u of objectUrlCache.values())URL.revokeObjectURL(u);objectUrlCache.clear()}
const RESULTS_PAGE_SIZE=120;let resultsShown=0;
function appendResultCards(grid,from,to){for(let i=from;i<to;i++){const h=latestHits[i],c=document.createElement('article');c.className='result';const im=document.createElement('img');im.alt=h.entry.fileName;im.decoding='async';im._load=()=>thumbFor(h).then(u=>{im.src=u||makeObjectUrl(h)});thumbIO.observe(im);im.onclick=()=>openPreview(h,i);const check=document.createElement('label');check.className='result-check';const cb=document.createElement('input');cb.type='checkbox';cb.checked=h.selected;cb.setAttribute('aria-label','Selectează '+h.entry.fileName);cb.onchange=()=>{h.selected=cb.checked;updateResultSummary()};check.append(cb);const tag=document.createElement('span');tag.className='match-tag '+(h.level==='strong'?'good':'review');tag.textContent=h.level==='strong'?'Potrivire susținută':h.tag==='rescued'?'Găsită după ținută · verifică':h.tag==='demoted'?'Ținută diferită · verifică':'Verifică manual';const info=document.createElement('div');info.className='result-info';const b=document.createElement('b');b.textContent=h.entry.fileName;const sm=document.createElement('small');sm.textContent=`Față: ${(h.rawBest??h.best).toFixed(3)} / ${(h.rawSupport??h.support).toFixed(3)}${h.adj?(h.adj<0?' · ținută asemănătoare':' · ținută diferită'):''}${h.level==='review'?' · nu este selectată automat':''}`;info.append(b,sm);c.append(im,check,tag,info);if(h.level==='review'){const ok=document.createElement('button');ok.type='button';ok.className='teach-btn';ok.textContent='✓ E persoana';ok.title='Confirmă și învață această ipostază';ok.onclick=e=>{e.stopPropagation();teachProfile(h)};info.append(ok)}grid.append(c)}}
function renderHits(){resultsShown=Math.min(RESULTS_PAGE_SIZE,latestHits.length);$('resultsGrid2').replaceChildren();appendResultCards($('resultsGrid2'),0,resultsShown);const empty=latestHits.length===0;$('resultsHead2').hidden=empty;$('resultsEmpty2').hidden=!empty;$('resultsGrid2').hidden=empty;$('moreWrap2').hidden=resultsShown>=latestHits.length;$('resultsEmpty2').innerHTML='<div class="big">✧</div><b>Nu am găsit potriviri</b><p>Încearcă alte fotografii de referință sau un mod de căutare mai permisiv. Verifică și dacă albumul este indexat complet.</p>';updateResultSummary()}
function loadMoreResults(){const from=resultsShown,to=Math.min(resultsShown+RESULTS_PAGE_SIZE,latestHits.length);appendResultCards($('resultsGrid2'),from,to);resultsShown=to;$('moreWrap2').hidden=resultsShown>=latestHits.length;$('more2').textContent=`Încarcă următoarele · ${fmt(Math.min(RESULTS_PAGE_SIZE,latestHits.length-resultsShown))}`}
$('more2').onclick=loadMoreResults;
function updateResultSummary(){const selected=latestHits.filter(x=>x.selected).length,strong=latestHits.filter(x=>x.level==='strong').length,review=latestHits.length-strong;$('resultSummary2').textContent=`${fmt(strong)} potriviri susținute${review?` · ${fmt(review)} de verificat`:''} · ${fmt(selected)} selectate pentru export`;$('exportZip2').disabled=!selected}
$('selectAll2').onclick=()=>{const all=latestHits.every(x=>x.selected);latestHits.forEach(x=>x.selected=!all);renderHits()};
async function exportZip(){const chosen=latestHits.filter(x=>x.selected);if(!chosen.length)return;toast('Pregătesc arhiva ZIP…');try{if(!window.JSZip){await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';s.onload=res;s.onerror=rej;document.head.append(s)})}const zip=new JSZip(),folder=zip.folder('discover.me - fotografii gasite');for(let i=0;i<chosen.length;i++){const h=chosen[i],file=currentFile(h);let name=file.name||`fotografie-${i+1}.jpg`;if(folder.file(name))name=`${String(i+1).padStart(4,'0')}-${name}`;folder.file(name,file);if(i%40===0){toast(`Adaug fotografiile în arhivă · ${i+1}/${chosen.length}`);await new Promise(r=>setTimeout(r,0))}}const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='discover-me-fotografii-gasite.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);toast(`Arhiva ZIP a fost creată cu ${chosen.length} fotografii.`)}catch(e){console.error(e);toast('Exportul ZIP nu a reușit. Verifică memoria disponibilă și încearcă din nou.')}}
$('exportZip2').onclick=exportZip;
let previewIndex=-1;
function updatePreview(index){if(!latestHits.length)return;previewIndex=Math.max(0,Math.min(index,latestHits.length-1));const hit=latestHits[previewIndex],url=makeObjectUrl(hit);$('previewTitle').textContent=hit.entry.fileName;$('previewImage').src=url;$('previewImage').alt=`Fotografia ${previewIndex+1} din ${latestHits.length}: ${hit.entry.fileName}`;$('previewCounter').textContent=`${fmt(previewIndex+1)} / ${fmt(latestHits.length)}`;$('previewMeta').textContent=hit.level==='review'?`Potrivire de verificat · distanțe: ${hit.best.toFixed(3)} și ${hit.support.toFixed(3)}.`:`Potrivire susținută · distanțe: ${hit.best.toFixed(3)} și ${hit.support.toFixed(3)}.`;$('previewDownload').href=url;$('previewDownload').download=hit.entry.fileName;$('previewPrev').disabled=previewIndex===0;$('previewNext').disabled=previewIndex===latestHits.length-1}
function openPreview(hit,i){const index=Number.isInteger(i)?i:latestHits.indexOf(hit);updatePreview(index<0?0:index);if(!$('previewDialog').open)$('previewDialog').showModal()}
function stepPreview(delta){if(!$('previewDialog').open)return;const next=previewIndex+delta;if(next<0||next>=latestHits.length)return;updatePreview(next)}
$('previewTeach').onclick=()=>teachProfile(latestHits[previewIndex]);$('previewPrev').onclick=()=>stepPreview(-1);$('previewNext').onclick=()=>stepPreview(1);
$('previewClose').onclick=()=>$('previewDialog').close();$('previewDialog').addEventListener('click',e=>{if(e.target===$('previewDialog'))$('previewDialog').close()});
document.addEventListener('keydown',e=>{if(!$('previewDialog').open)return;if(e.key==='ArrowLeft'){e.preventDefault();stepPreview(-1)}else if(e.key==='ArrowRight'){e.preventDefault();stepPreview(1)}else if(e.key==='Escape')$('previewDialog').close()});
let previewTouchStartX=null; $('previewImage').addEventListener('touchstart',e=>{previewTouchStartX=e.changedTouches?.[0]?.clientX??null},{passive:true});$('previewImage').addEventListener('touchend',e=>{if(previewTouchStartX===null)return;const dx=(e.changedTouches?.[0]?.clientX??previewTouchStartX)-previewTouchStartX;previewTouchStartX=null;if(Math.abs(dx)>45)stepPreview(dx<0?1:-1)},{passive:true});
$('clearIndex').onclick=async()=>{if(!confirm('Ștergi indexul de căutare? Fotografiile originale nu vor fi șterse.'))return;const d=await openDB(),t=d.transaction('photos','readwrite');t.objectStore('photos').clear();await idbDone(t);indexedEntries=[];latestHits=[];indexRevision++;searchScoreCache.clear();clearObjectUrls();$('resultsGrid2').replaceChildren();$('resultsHead2').hidden=true;$('resultsEmpty2').hidden=false;updateStats();updateSearchControls();toast('Indexul de căutare a fost șters.')};
$('clearAll').onclick=async()=>{if(!confirm('Ștergi toate profilurile, indexul și albumul salvat? Fotografiile originale nu vor fi șterse.'))return;const d=await openDB();for(const name of ['photos','people','settings']){const t=d.transaction(name,'readwrite');t.objectStore(name).clear();await idbDone(t)}people=[];activeFiles=[];indexedEntries=[];latestHits=[];indexRevision++;searchScoreCache.clear();selectedPersonId=null;referenceDescriptors=[];referenceThumbs=[];draftDescriptors=[];draftThumbs=[];draftFileKeys.clear();directoryHandle=null;currentAlbumName='';clearObjectUrls();renderPeople();updateStats();updateSearchControls();$('albumName').textContent='Niciun album selectat';$('fileCount').textContent='0 fotografii';$('resultsGrid2').replaceChildren();$('resultsHead2').hidden=true;$('resultsEmpty2').hidden=false;toast('Datele locale au fost șterse.')};
function navigate(page){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page));document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));const titles={home:'Bun venit la discover.me',search:'Căutare fotografii',people:'Persoane salvate',settings:'Setări'};$('pageTitle').textContent=titles[page]||'discover.me';if(page==='search')updateSearchControls();window.scrollTo({top:0,behavior:'smooth'})}
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
async function boot(){try{await openDB();await migrateLegacyPeople();await loadPeople();await loadLicense();renderPlan();updateSearchControls();await restoreAlbum()}catch(e){console.error(e);toast('Stocarea locală nu este disponibilă în acest browser.')}initEngine()}
window.addEventListener('beforeunload',clearObjectUrls);boot();

// ===== Planuri și plată =====
function planLabel(){const p=PLANS[license.plan]||PLANS.free;return `${p.name} · ${p.people===Infinity?'persoane nelimitate':p.people+(p.people===1?' persoană':' persoane')}`}
function renderPlan(){const s=$('planSummary');if(s)s.textContent=`${planLabel()} · folosești ${people.length}`;const b=$('planBtn');if(b)b.textContent=license.plan==='pro'?'Ai planul Pro ✓':'Vezi planurile';if(b)b.disabled=license.plan==='pro'}
function openPaywall(reason){
  const d=$('paywall'),box=$('pwPlans');box.replaceChildren();
  $('pwReason').textContent=reason||(people.length>=peopleLimit()?`Planul ${PLANS[license.plan].name} include ${peopleLimit()} ${peopleLimit()===1?'persoană':'persoane'}. Alege un plan ca să adaugi mai multe. Plătești o singură dată.`:'Plătești o singură dată, fără abonament.');
  for(const p of Object.values(PLANS)){
    const c=document.createElement('div');c.className='pw-plan'+(p.id==='plus'?' best':'')+(p.id===license.plan?' current':'');
    c.innerHTML=`${p.id==='plus'?'<span class="pw-badge">Recomandat</span>':''}<b>${p.name}</b><strong>${p.price}</strong><span>${p.people===Infinity?'Persoane nelimitate':p.people+(p.people===1?' persoană':' persoane')}</span><small>${p.note}</small>`;
    const btn=document.createElement('button');btn.type='button';btn.className='button '+(p.id==='plus'?'primary':'soft')+' small';
    if(p.id===license.plan){btn.textContent='Planul tău';btn.disabled=true}
    else if(p.id==='free'||(license.plan==='pro')){btn.textContent='—';btn.disabled=true}
    else{btn.textContent='Cumpără';btn.onclick=()=>{const url=CHECKOUT_LINKS[p.id];if(!url){toast('Plata online nu este încă activată. Revino curând.');return}window.open(url,'_blank','noopener');$('paywall').querySelector('.pw-key').open=true;$('pwKeyMsg').textContent='După plată primești cheia pe email. Lipește-o aici și apasă Activează.'}}
    c.append(btn);box.append(c);
  }
  $('pwKeyMsg').textContent='Cheia o primești pe email după plată.';
  if(!d.open)d.showModal();
}
$('pwClose').onclick=()=>$('paywall').close();
$('paywall').addEventListener('click',e=>{if(e.target===$('paywall'))$('paywall').close()});
$('planBtn').onclick=()=>openPaywall();
// După checkout, Lemon Squeezy poate trimite clientul înapoi la ?activate=1 (setare „Redirect URL”).
if(/[?&]activate=1/.test(location.search))setTimeout(()=>{openPaywall('Mulțumim pentru plată! Lipește cheia primită pe email.');$('paywall').querySelector('.pw-key').open=true;$('pwKey').focus()},600);
$('pwActivate').onclick=async()=>{
  const msg=$('pwKeyMsg'),btn=$('pwActivate');btn.disabled=true;msg.textContent='Verific cheia…';
  const l=await activateLicense($('pwKey').value);btn.disabled=false;
  if(!l||l.error){msg.textContent=l?.error||'Cheia nu este validă.';return}
  $('pwKey').value='';renderPlan();updateSearchControls();$('paywall').close();
  toast(`Mulțumim! Planul ${PLANS[l.plan].name} este activ.`);
};

// ===== Editare persoană: nume, poză de profil, poze de referință =====
let editingId=null,editThumb=null;
function faceThumbFromCanvas(canvas,faces){const f=faces.slice().sort((a,b)=>b.w*b.h-a.w*a.h)[0];return f?cropThumb(canvas,f):null}
function centerThumb(canvas){const side=Math.min(canvas.width,canvas.height),o=document.createElement('canvas');o.width=o.height=128;o.getContext('2d').drawImage(canvas,(canvas.width-side)/2,(canvas.height-side)/2,side,side,0,0,128,128);return o.toDataURL('image/jpeg',.86)}
function renderPersonEditor(){
  const p=people.find(x=>x.id===editingId);if(!p)return;
  $('peAvatar').src=editThumb||p.thumb;
  const thumbs=[...new Set([p.thumb,...(p.thumbs||[])])];
  $('peThumbs').replaceChildren(...thumbs.map(t=>{const b=document.createElement('button');b.type='button';b.className='pe-thumb'+(t===(editThumb||p.thumb)?' on':'');const im=new Image();im.src=t;im.alt='';b.append(im);b.onclick=()=>{editThumb=t;renderPersonEditor()};return b}));
  $('peRefs').textContent=`${p.descs.length} ${p.descs.length===1?'ipostază':'ipostaze'} în profil${p.learned?` · ${p.learned} învățate din confirmări`:''}`;
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
  try{const r=engineReady?await detectFaces(f,false):{canvas:await toCanvas(f,1400),faces:[]};editThumb=faceThumbFromCanvas(r.canvas,r.faces)||centerThumb(r.canvas);$('peMsg').textContent=r.faces.length?'Poza de profil e pregătită. Apasă Salvează.':'Nu am găsit o față, am folosit centrul pozei. Apasă Salvează.';renderPersonEditor()}
  catch(err){console.warn(err);$('peMsg').textContent='Nu am putut citi poza. Încearcă un JPG sau PNG.'}
});
$('peRefFiles').addEventListener('change',async e=>{
  const files=[...e.target.files||[]];e.target.value='';const p=people.find(x=>x.id===editingId);if(!files.length||!p)return;
  if(!engineReady){$('peMsg').textContent='Aplicația încă se pregătește.';return}
  let added=0,skipped=0;
  for(let i=0;i<files.length;i++){
    $('peMsg').textContent=`Analizez poza ${i+1} din ${files.length}…`;
    try{const r=await detectFaces(files[i],true);let faces=r.faces.filter(f=>f.s>=.5&&f.m>=40);if(!faces.length){skipped++;continue}
      let ref=faces[0];
      if(faces.length>1){const near=faces.map(f=>({f,d:Math.min(...p.descs.map(x=>descriptorDistance(x,f.d)))})).sort((a,b)=>a.d-b.d);
        if(near[0].d<.55)ref=near[0].f;else{ref=await pickFace(r.canvas,faces,files[i].name);if(!ref){skipped++;continue}}}
      const d=Float32Array.from(ref.d),closest=Math.min(...p.descs.map(x=>descriptorDistance(x,d)));
      if(closest>.68){skipped++;continue}                      // pare altă persoană: nu stricăm profilul
      if(p.descs.length>=16)p.descs.splice(3,1);
      p.descs.push(d);p.thumbs=[...(p.thumbs||[p.thumb]),cropThumb(r.canvas,ref)].slice(-16);added++;
    }catch(err){console.warn(err);skipped++}
  }
  if(added){await storePut('people',p);if(selectedPersonId===p.id)referenceDescriptors=p.descs.map(x=>x instanceof Float32Array?x:Float32Array.from(x));renderPeople();updateSearchControls()}
  $('peMsg').textContent=`${added?`Am adăugat ${added} ${added===1?'poză':'poze'}.`:'Nicio poză adăugată.'}${skipped?` ${skipped} ${skipped===1?'a fost sărită':'au fost sărite'} (fără față clară sau pare altă persoană).`:''}`;
  renderPersonEditor();
});
