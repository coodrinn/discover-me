// discover.me — Funcții adăugate peste fluxul de bază:
//  • „✗ Nu e persoana” (pozele respinse nu mai apar pentru acel profil)
//  • sortare și filtru după data pozei (EXIF)
//  • căutare de grup: pozele în care apar împreună mai multe persoane
//  • trimitere directă a pozelor (meniul de partajare al sistemului)
//  • „Cine apare în album?”: profiluri create din fețele care apar des în album
//  • instalare ca aplicație (PWA) și funcționare fără internet
// Se încarcă înainte de app.js; folosește funcțiile din app.js doar la momentul apelului.
'use strict';

const toF32=x=>x instanceof Float32Array?x:Float32Array.from(x);
const tick=()=>new Promise(r=>setTimeout(r,0));
function rerunSearch(){return groupMode?runGroupSearch():runSearch()}
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

// Re-desenează rezultatele păstrând câte erau deja încărcate pe pagină.
function rerenderHitsKeepingScroll(){const shown=resultsShown;renderHits();if(shown>resultsShown){appendResultCards($('resultsGrid2'),resultsShown,Math.min(shown,latestHits.length));resultsShown=Math.min(shown,latestHits.length);$('moreWrap2').hidden=resultsShown>=latestHits.length}}

// „Nu e persoana”
const NEG_RADIUS=.55;   // fețe foarte apropiate de una respinsă, și doar dintre cele incerte
function dropRejected(hits,person){
  if(!person)return hits;
  const keys=new Set(person.rejected||[]),negs=(person.negs||[]).map(toF32);
  if(!keys.size&&!negs.length)return hits;
  return hits.filter(h=>{
    if(keys.has(h.entry.key))return false;
    if(h.level==='review'&&h.d&&negs.length)for(const n of negs)if(descriptorDistance(n,h.d)<NEG_RADIUS)return false;
    return true;
  });
}
async function rejectHit(hit){
  const p=people.find(x=>x.id===selectedPersonId);if(!p||!hit||hit.together)return;
  p.rejected=[...(p.rejected||[]).filter(k=>k!==hit.entry.key),hit.entry.key].slice(-3000);
  if(hit.d)p.negs=[...(p.negs||[]),Float32Array.from(hit.d)].slice(-40);
  await storePut('people',p);
  const inPreview=$('previewDialog').open,at=previewIndex;
  allHits=allHits.filter(h=>h!==hit);latestHits=latestHits.filter(h=>h!==hit);
  rerenderHitsKeepingScroll();updateStats();
  if(inPreview){if(latestHits.length)updatePreview(Math.min(at,latestHits.length-1));else $('previewDialog').close()}
  toast(`Am scos poza. Nu o mai arăt pentru „${p.name}”.`);
}

// Data pozei: sortare și filtru pe ani
const resultView={sort:store.get('dm-sort')||'match',year:'',level:''};
// entry.taken: număr = data din EXIF · null = poza nu are dată EXIF · undefined = încă necitită
function hitDate(h){const e=h.entry;return e.taken||e.modified||e.file?.lastModified||0}
function hitDateLabel(h){const t=h.entry.taken;return t?new Date(t).toLocaleDateString('ro-RO',{day:'numeric',month:'short',year:'numeric'}):''}
function viewOf(hits){
  let v=hits;
  if(resultView.level)v=v.filter(h=>(h.level==='strong')===(resultView.level==='strong'));
  if(resultView.year)v=v.filter(h=>{const d=hitDate(h);return d&&new Date(d).getFullYear()===+resultView.year});
  if(resultView.sort!=='match'){const dir=resultView.sort==='new'?-1:1;v=[...v].sort((a,b)=>dir*(hitDate(a)-hitDate(b)))}
  return v;
}
function applyResultView(hits){allHits=hits;ensureDates(hits);return viewOf(hits)}
function refreshView(){latestHits=viewOf(allHits);rerenderHitsKeepingScroll()}
let dateRun=0;
async function ensureDates(hits){
  const run=++dateRun,todo=hits.filter(h=>h.entry.taken===undefined&&h.entry.file);if(!todo.length)return;
  const updates=[];let found=0;
  for(let i=0;i<todo.length;i++){
    if(run!==dateRun)return;                                           // a pornit altă căutare
    const e=todo[i].entry;if(e.taken!==undefined)continue;
    e.taken=await readPhotoDate(e.file);if(e.taken)found++;updates.push(e);
    if(i%25===24)await tick();
  }
  // păstrăm data în index, ca să nu mai fie citită data viitoare
  try{const rows=[];for(const e of updates){const row=await storeGet('photos',e.key);if(row){row.taken=e.taken;rows.push(row)}}await storePutMany('photos',rows)}catch(err){console.warn('Datele pozelor nu au fost salvate',err)}
  if(run!==dateRun)return;
  if(found||resultView.sort!=='match'||resultView.year)refreshView();else renderResultTools();
}
let toolsFix=false;
function hitsCounts(){const strong=allHits.filter(h=>h.level==='strong').length;return{all:allHits.length,strong,review:allHits.length-strong}}
function renderChips(years,c){
  const box=$('resultChips');if(!box)return;
  const defs=[['level','','Toate · '+c.all]];
  if(c.review&&c.strong){defs.push(['level','strong','✓ Sigure · '+c.strong],['level','review','? De verificat · '+c.review])}
  years.forEach(y=>defs.push(['year',String(y),String(y)]));
  box.replaceChildren(...defs.map(([k,v,t])=>{
    const on=k==='level'?resultView.level===v:resultView.year===v&&v!=='';
    const b=document.createElement('button');b.type='button';b.className='chip'+(on?' on':'');b.textContent=t;b.setAttribute('aria-pressed',String(on));
    b.onclick=()=>{if(k==='level')resultView.level=v;else resultView.year=on?'':v;refreshView()};return b}));
  box.hidden=defs.length<3&&!resultView.year;
}
function renderResultTools(){
  const ys=$('resultYear'),so=$('resultSort');if(!ys||!so)return;
  const years=[...new Set(allHits.map(h=>{const d=hitDate(h);return d?new Date(d).getFullYear():null}).filter(Boolean))].sort((a,b)=>b-a);
  const cur=resultView.year;
  ys.replaceChildren(new Option('Toți anii',''),...years.map(y=>new Option(String(y),String(y))));
  ys.value=years.includes(+cur)?cur:'';ys.hidden=true;so.value=resultView.sort;
  $('shareSel').hidden=!canShareFiles();
  renderChips(years,hitsCounts());
  if(ys.value!==cur&&!toolsFix){toolsFix=true;resultView.year=ys.value;setTimeout(()=>{refreshView();toolsFix=false},0)}
}
$('resultSort').onchange=e=>{resultView.sort=e.target.value;store.set('dm-sort',resultView.sort);refreshView()};
$('resultYear').onchange=e=>{resultView.year=e.target.value;refreshView()};

// Trimitere directă
let shareOk=null;
function canShareFiles(){if(shareOk===null){try{shareOk=!!navigator.canShare&&navigator.canShare({files:[new File(['x'],'x.jpg',{type:'image/jpeg'})]})}catch(e){shareOk=false}}return shareOk}
const SHARE_MAX=40;
async function shareFiles(files){
  files=files.filter(Boolean);
  if(!files.length){toast('Selectează mai întâi pozele pe care vrei să le trimiți.');return}
  if(!canShareFiles()){toast('Browserul acesta nu poate trimite poze direct. Folosește „Export ZIP”.');return}
  const pick=files.slice(0,SHARE_MAX).map(f=>f.type?f:new File([f],f.name||'poza.jpg',{type:'image/jpeg'}));
  if(!navigator.canShare({files:pick})){toast('Pozele alese nu pot fi trimise direct (format sau mărime). Folosește „Export ZIP”.');return}
  try{await navigator.share({files:pick,title:'Poze găsite cu discover.me'});if(files.length>SHARE_MAX)toast(`Am trimis primele ${SHARE_MAX} poze. Pentru toate, folosește „Export ZIP”.`)}
  catch(e){if(e.name!=='AbortError')toast('Nu am putut trimite pozele.')}
}
$('shareSel').onclick=()=>shareFiles(latestHits.filter(h=>h.selected).map(h=>currentFile(h)));
$('previewShare').onclick=()=>{const h=latestHits[previewIndex];if(h)shareFiles([currentFile(h)])};
$('previewShare').hidden=!canShareFiles();
$('previewReject').onclick=()=>rejectHit(latestHits[previewIndex]);

// Căutare de grup
function syncGroupToggle(){
  const t=$('groupMode');if(!t)return;
  const show=people.length>=2;t.closest('label').hidden=!show;
  if(!show&&groupMode){groupMode=false;groupIds.clear()}
  t.checked=groupMode;t.disabled=busy;
  if(groupMode){for(const id of [...groupIds])if(!people.some(p=>p.id===id))groupIds.delete(id);
    const names=people.filter(p=>groupIds.has(p.id)).map(p=>p.name);
    $('searchSelectionNote').textContent=names.length>=2?`Caut pozele în care apar împreună: ${names.join(' + ')}.`:names.length?`${names[0]} e aleasă. Alege încă cel puțin o persoană.`:'Alege 2 sau mai multe persoane: caut pozele în care apar toate.'}
}
function clearResults(text){allHits=[];latestHits=[];$('resultsGrid2').replaceChildren();$('resultsHead2').hidden=true;$('moreWrap2').hidden=true;$('resultsEmpty2').hidden=false;$('resultsEmpty2').textContent=text;updateStats()}
$('groupMode').onchange=e=>{
  groupMode=e.target.checked;groupIds=new Set(groupMode&&selectedPersonId?[selectedPersonId]:[]);
  clearResults(groupMode?'Alege 2 sau mai multe persoane ca să vezi pozele în care apar împreună.':'Alege o persoană pentru a vedea rezultatele.');
  updateSearchControls();
  if(!groupMode&&selectedPersonId&&searchPrerequisiteState()==='ready')runSearch();
};
async function scoreRowsFor(person,label){
  const refs=person.descs.map(toF32),key=`${MATCH_ALGORITHM_VERSION}|${indexRevision}|person:${person.id}:${refs.length}`;
  let rows=searchScoreCache.get(key);if(rows)return rows;
  const total=indexedEntries.length;rows=new Array(total);
  for(let i=0;i<total;i++){rows[i]=scoreEntry(indexedEntries[i],refs);if((i+1)%2000===0||i===total-1){paintMatchProgress(Math.round((i+1)/Math.max(1,total)*100),`${label} · ${fmt(i+1)} din ${fmt(total)}`);await tick()}}
  attachClothing(rows);
  if(searchScoreCache.size>=6)searchScoreCache.delete(searchScoreCache.keys().next().value);
  searchScoreCache.set(key,rows);return rows;
}
async function runGroupSearch(){
  const chosen=people.filter(p=>groupIds.has(p.id));
  if(chosen.length<2){toast('Alege cel puțin două persoane.');return}
  const st=searchPrerequisiteState();if(st!=='ready'){toast(st==='album'?'Alege mai întâi un album.':'Pregătește albumul înainte de căutare.');return}
  if(chosen.some(p=>!isPersonUnlocked(p.id))){openPaywall();return}
  if(chosen.some(p=>p.model!=='sface')){toast('Un profil a fost creat cu o versiune veche. Adaugă din nou 3 poze de referință pentru el.');return}
  if(chosen.some(p=>p.descs.length<2)){toast('Unul dintre profiluri are prea puține poze de referință.');return}
  if(busy)return;busy=true;updateSearchControls();
  const started=performance.now(),policy=getMatchPolicy();
  try{
    const per=[];
    for(let k=0;k<chosen.length;k++){const p=chosen[k],rows=await scoreRowsFor(p,`Caut ${p.name} (${k+1}/${chosen.length})`);
      const useC=$('useClothes')?.checked!==false&&!!rows.outfits?.length;
      per.push(new Map(dropRejected(pickHits(rows,policy,useC),p).map(h=>[h.entry.key,h])))}
    const out=[],names=chosen.map(p=>p.name);
    for(const [key,first] of per[0]){
      const parts=[first];let ok=true;
      for(let k=1;k<per.length;k++){const x=per[k].get(key);if(!x||parts.some(q=>q.d===x.d)){ok=false;break}parts.push(x)}   // fețe diferite pentru fiecare persoană
      if(!ok)continue;
      const strong=parts.every(q=>q.level==='strong'),worst=parts.reduce((a,b)=>b.score>a.score?b:a);
      out.push({...worst,entry:first.entry,level:strong?'strong':'review',selected:strong,together:names,tag:'',adj:0});
    }
    out.sort((a,b)=>(a.level==='strong'?0:1)-(b.level==='strong'?0:1)||a.score-b.score);
    latestHits=applyResultView(keepSelections(out));renderHits();updateStats();
    const strongN=out.filter(h=>h.level==='strong').length;
    paintMatchProgress(100,`Căutare de grup finalizată · ${names.join(' + ')}`);
    if(!out.length)$('resultsEmpty2').innerHTML=`<div class="big">✧</div><b>Nicio poză cu toți împreună</b><p>Nu am găsit poze în care să apară ${names.join(' și ')} în același timp. Încearcă modul de căutare mai permisiv din „Opțiuni de căutare”.</p>`;
    toast(`${strongN} poze sigure cu ${names.join(' + ')}${out.length-strongN?` și ${out.length-strongN} de verificat`:''} · ${((performance.now()-started)/1000).toFixed(1)} s.`);
  }catch(e){console.error(e);toast('Căutarea de grup a întâmpinat o eroare. Reîncearcă.')}
  finally{busy=false;updateSearchControls()}
}

// „Cine apare în album?”
let albumGroups=null,albumGroupsRev=-1,albumGroupsShown=24;
const AF_KNOWN=.90;   // distanța dintre centrul grupului și o referință: sub ea, grupul e persoana salvată (FAR ≈ 1 la 1.000.000)
function openAlbumFaces(){setTimeout(()=>{$('albumFacesCard').scrollIntoView({behavior:'smooth',block:'start'});if(indexedEntries.length&&(!albumGroups||albumGroupsRev!==indexRevision))runAlbumFaces()},150)}
function openManualPerson(){setTimeout(()=>{const d=$('manualPerson');if(d)d.open=true;$('personName').scrollIntoView({behavior:'smooth',block:'center'});$('personName').focus({preventScroll:true})},150)}
function syncAlbumFacesIntro(){
  const n=indexedEntries.length;
  $('afSub').textContent=n?`Apasă „Vezi pozele” sub persoana pe care o cauți (din ${fmt(n)} poze pregătite). Numele îl poți adăuga și după.`:'Alege pozele: îți arătăm persoanele care apar în ele.';
  $('afRun').textContent=!n?'Alege albumul':albumGroups&&albumGroupsRev===indexRevision?'↻ Actualizează':'☺ Arată fețele';
  // fețele apar singure când intri pe pagină (fără să mai apeși un buton)
  if(n&&!afRunning&&(!albumGroups||albumGroupsRev!==indexRevision)&&$('page-people').classList.contains('active'))runAlbumFaces();
}
let afRunning=false;
async function runAlbumFaces(){
  if(!indexedEntries.length){connectDirectory();return}
  if(afRunning)return;afRunning=true;
  const btn=$('afRun');btn.disabled=true;$('afProgress').hidden=false;$('afGrid').replaceChildren();
  const paint=f=>{const p=Math.round(f*100);$('afBar').style.width=p+'%';$('afPct').textContent=p+'%'};
  $('afLabel').textContent=`Grupez fețele din ${fmt(indexedEntries.length)} poze…`;paint(0);
  try{albumGroups=await clusterAlbumFacesV2(indexedEntries,paint);albumGroupsRev=indexRevision;albumGroupsShown=24;renderAlbumFaces()}
  catch(e){console.error(e);toast('Nu am putut grupa fețele din album.')}
  finally{afRunning=false;btn.disabled=false;$('afProgress').hidden=true;syncAlbumFacesIntro()}
}
function knownPersonFor(g){let best=null,bd=AF_KNOWN;for(const p of people){if(p.model!=='sface')continue;for(const d of p.descs){const x=descriptorDistance(toF32(d),g.mean);if(x<bd){bd=x;best=p}}}return best}
// decupajele se fac pe rând (2 în paralel), ca să nu încarce memoria pe albume mari
let cropBusy=0;const cropQueue=[];
function queueCrop(fn){return new Promise(res=>{const run=async()=>{cropBusy++;try{res(await fn())}catch(e){res(null)}cropBusy--;const nx=cropQueue.shift();if(nx)nx()};cropBusy<2?run():cropQueue.push(run)})}
function groupThumb(g){if(!g.thumbP)g.thumbP=queueCrop(()=>faceCropFromEntry(g.cover.e,g.cover.f,160)).then(u=>(g.thumb=u,u));return g.thumbP}
// Blocare pe plan: persoanele deja salvate rămân vizibile (dacă intră în plan); din cele NOI din album se văd
// doar atâtea câte mai încap în plan (cele mai frecvente primele). Restul apar cu lacăt: fără poză, fără nume, fără pozele lor.
const LOCK_SVG='<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path d="M12 14.6v2.2"/></svg>';
function albumFaceAccess(groups){return lockAlbumGroups(groups,{limit:peopleLimit(),savedCount:people.length,knownFor:knownPersonFor,isUnlocked:p=>isPersonUnlocked(p.id)})}
function renderAlbumFaces(){
  const grid=$('afGrid'),note=$('afLockNote');grid.replaceChildren();if(note)note.hidden=true;
  if(!albumGroups?.length){const e=document.createElement('div');e.className='empty';e.textContent='Nu am găsit persoane care să apară în cel puțin 3 poze. Încearcă după ce se pregătește tot albumul.';grid.append(e);return}
  const rows=albumFaceAccess(albumGroups),lockedN=rows.filter(r=>r.locked).length;
  if(note&&lockedN){
    const lim=peopleLimit(),visible=rows.length-lockedN;
    $('afLockText').textContent=`În album apar ${fmt(rows.length)} persoane. Planul ${PLANS[license.plan].name} îți arată ${fmt(visible)}; celelalte ${fmt(lockedN)} se deblochează cu un abonament.`;
    note.hidden=false;
  }
  const unlock=()=>openPaywall(`În album apar ${fmt(rows.length)} persoane, dar planul ${PLANS[license.plan].name} include ${personsTxt(peopleLimit()).toLowerCase()}. Abonează-te ca să vezi și să cauți toate persoanele din album. Poți anula oricând.`);
  for(const {g,known,locked} of rows.slice(0,albumGroupsShown)){
    const c=document.createElement('div');c.className='af-card'+(known&&!locked?' known':'')+(locked?' locked':'');
    const meta=document.createElement('small');meta.textContent=`în ${fmt(g.photos)} ${g.photos===1?'poză':'poze'}`;
    if(locked){
      // Nicio decupare a feței nu se face pentru persoanele blocate.
      const lk=document.createElement('button');lk.type='button';lk.className='af-lock';lk.setAttribute('aria-label','Persoană blocată. Deblochează cu un abonament');lk.innerHTML=LOCK_SVG;lk.onclick=unlock;
      const b=document.createElement('b');b.textContent=known?known.name:'Persoană blocată';
      const go=document.createElement('button');go.type='button';go.className='button soft small';go.textContent='Deblochează';go.onclick=unlock;
      c.append(lk,meta,b,go);grid.append(c);continue;
    }
    const im=document.createElement('img');im.alt='';im.className='af-face';groupThumb(g).then(u=>{if(u)im.src=u});
    c.append(im,meta);
    if(known){
      const b=document.createElement('b');b.textContent=known.name;
      const go=document.createElement('button');go.type='button';go.className='button soft small';go.textContent='Vezi pozele →';
      go.onclick=()=>{if(groupMode){groupMode=false;groupIds.clear()}selectPerson(known.id);navigate('search');if(searchPrerequisiteState()==='ready')runSearch()};
      c.append(b,go);
    }else{
      // O singură apăsare: „Vezi pozele” (sau chiar pe poza feței). Numele e opțional și se poate schimba oricând.
      const f=document.createElement('form');f.className='af-name';
      const inp=document.createElement('input');inp.type='text';inp.maxLength=50;inp.placeholder='Nume';inp.setAttribute('aria-label','Numele persoanei, opțional');
      const ok=document.createElement('button');ok.type='submit';ok.className='button primary small';ok.textContent='Vezi pozele';
      f.onsubmit=async e=>{e.preventDefault();const name=inp.value.trim()||`Persoana ${people.length+1}`;ok.disabled=true;await saveGroupAsPerson(g,name);ok.disabled=false};
      im.classList.add('af-tap');im.title='Vezi pozele cu această persoană';im.onclick=()=>f.requestSubmit();
      f.append(inp,ok);c.append(f);
    }
    grid.append(c);
  }
  if(rows.length>albumGroupsShown){const more=document.createElement('button');more.type='button';more.className='button soft small af-more';more.textContent=`Arată încă ${fmt(Math.min(24,rows.length-albumGroupsShown))}`;more.onclick=()=>{albumGroupsShown+=24;renderAlbumFaces()};grid.append(more)}
}
async function saveGroupAsPerson(g,name){
  if(!canAddPerson()){openPaywall();return}
  if(!await requireConsent())return;
  const reps=g.reps.slice(0,8),descs=reps.map(r=>Float32Array.from(r.f.d));
  const thumbs=(await Promise.all(reps.slice(0,6).map(r=>queueCrop(()=>faceCropFromEntry(r.e,r.f))))).filter(Boolean);
  const cover=await groupThumb(g)||thumbs[0];
  const p={id:crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random(),name:name.slice(0,50),thumb:cover,thumbs:thumbs.length?thumbs:[cover],descs,referenceSpread:referenceSpread(descs),createdAt:Date.now(),fromAlbum:true,model:'sface'};
  await storePut('people',p);people.push(p);
  selectedPersonId=p.id;referenceDescriptors=p.descs.map(toF32);referenceThumbs=[p.thumb];
  renderPeople();updateSearchControls();renderAlbumFaces();
  toast(returnToSearchAfterPersonCreation?`Am salvat „${p.name}”. Caut pozele…`:`Am salvat „${p.name}”. Apasă „Vezi pozele” când vrei.`);
  if(returnToSearchAfterPersonCreation){returnToSearchAfterPersonCreation=false;navigate('search');if(searchPrerequisiteState()==='ready')runSearch()}
}
$('afRun').onclick=runAlbumFaces;
$('afUnlock').onclick=()=>navigate('plan');
$('afLockNote').querySelector('.af-lock-ico').innerHTML=LOCK_SVG;

// Instalare ca aplicație (PWA)
if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol))addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(e=>console.warn('Modul offline nu a pornit',e)));
let installPrompt=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('installRow').hidden=false});
addEventListener('appinstalled',()=>{installPrompt=null;$('installRow').hidden=true;toast('discover.me a fost instalată.')});
$('installBtn').onclick=async()=>{if(!installPrompt)return;installPrompt.prompt();try{await installPrompt.userChoice}catch(e){}installPrompt=null;$('installRow').hidden=true};

// Revezi intro-ul
$('introReplay').onclick=()=>{location.href=location.pathname+'?intro=1'};
