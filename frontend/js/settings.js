// discover.me — Setări (mod, culoare, stil), ghid rapid, efecte la atingere.
(function(){
  const $=id=>document.getElementById(id),h=document.documentElement;
  const get=k=>{try{return localStorage.getItem(k)}catch(e){return null}},put=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
  const ACC={green:['Verde','#1ed760'],blue:['Albastru','#3d8bff'],purple:['Mov','#9b6bff'],pink:['Roz','#ff5c9d'],red:['Roșu','#ff4d5e'],orange:['Portocaliu','#ff8a2b'],yellow:['Galben','#f5c518']};
  const mq=matchMedia('(prefers-color-scheme: light)');
  function resolveMode(){const pref=h.dataset.modePref||'dark';h.dataset.mode=pref==='auto'?(mq.matches?'light':'dark'):pref}
  mq.addEventListener&&mq.addEventListener('change',()=>{if(h.dataset.modePref==='auto'){resolveMode();apply()}});
  function apply(){
    document.querySelectorAll('.seg-btn').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.m===(h.dataset.modePref||h.dataset.mode))));
    const lt=$('liteToggle');if(lt)lt.checked=h.dataset.lite==='1';
    document.querySelectorAll('.sw').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.a===h.dataset.accent)));
    const t=document.querySelector('meta[name="theme-color"]');if(t)t.content=h.dataset.mode==='light'?'#f4f5f7':'#141414';
  }
  document.querySelectorAll('.seg-btn').forEach(b=>b.onclick=()=>{h.dataset.modePref=b.dataset.m;put('dm-mode',b.dataset.m);resolveMode();apply()});
  if($('liteToggle'))$('liteToggle').onchange=e=>{if(e.target.checked)h.dataset.lite='1';else delete h.dataset.lite;put('dm-lite',e.target.checked?'1':'0')};
  // Efecte la atingere: val (Clasic), elastic (Minimal), strălucire (Vibrant)
  document.addEventListener('pointerdown',e=>{
    const el=e.target.closest('.button,.nav button,.seg-btn,.sw,.person-chip,.teach-btn,.preview-nav,.pe-thumb');if(!el||el.disabled)return;
    if(navigator.vibrate&&e.pointerType==='touch')try{navigator.vibrate(8)}catch(_){}
    if(h.dataset.lite==='1'){el.classList.remove('fx-spring');void el.offsetWidth;el.classList.add('fx-spring');return}
    const r=el.getBoundingClientRect(),size=Math.max(r.width,r.height)*2.2,clip=document.createElement('span'),dot=document.createElement('span');
    clip.className='fx-clip';dot.className='fx-glow';
    dot.style.cssText=`width:${size}px;height:${size}px;left:${e.clientX-r.left-size/2}px;top:${e.clientY-r.top-size/2}px`;
    if(getComputedStyle(el).position==='static')el.classList.add('fx-host');
    clip.append(dot);el.append(clip);setTimeout(()=>clip.remove(),650);
  },{passive:true});
  document.addEventListener('animationend',e=>{if(e.animationName==='fxSpring')e.target.classList.remove('fx-spring')});
  const box=$('accentSwatches');
  for(const [k,[n,c]] of Object.entries(ACC)){const b=document.createElement('button');b.type='button';b.className='sw';b.dataset.a=k;b.title=n;b.setAttribute('aria-label','Culoarea '+n);b.style.background=c;b.onclick=()=>{h.dataset.accent=k;put('dm-accent',k);apply()};box.append(b)}
  if(!ACC[h.dataset.accent])h.dataset.accent='green';apply();
  // bug: butonul de indexare nu avea handler cand exista deja in pagina
  const si=$('startIndex');if(si&&typeof startIndex==='function')si.onclick=startIndex;
  // pasii din dashboard se bifeaza singuri
  const num=id=>parseInt(String(($(id)||{}).textContent||'0').replace(/\D/g,''),10)||0;
  function steps(){
    const d=[num('statPeople')>0,num('statPhotos')>0,num('statMatches')>0];
    d.forEach((v,i)=>{const el=$('step'+(i+1));if(el){el.classList.toggle('done',v);el.classList.toggle('current',!v&&d.slice(0,i).every(Boolean))}});
  }
  ['statPhotos','statPeople','statMatches'].forEach(id=>{if($(id))new MutationObserver(steps).observe($(id),{childList:true,characterData:true,subtree:true})});steps();
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{const n=document.querySelector('.nav button[data-page="'+b.dataset.go+'"]');if(n)n.click()});
  // tutorialul de la prima pornire este în frontend/js/space.js
  const syncAlbum=()=>{const n=($('albumName')||{}).textContent||'Niciun album',c=($('fileCount')||{}).textContent||'';$('abName').textContent=n;$('abCount').textContent=/^0\b/.test(c)?'Alege folderul cu fotografii':c};
  ['albumName','fileCount'].forEach(id=>{if($(id))new MutationObserver(syncAlbum).observe($(id),{childList:true,characterData:true,subtree:true})});syncAlbum();
  $('abChange').onclick=()=>{const b=$('chooseFolder');if(b)b.click()};
  const gate=document.querySelector('#searchGateCard .gate-copy'),pw=$('scanProgressWrap');if(gate&&pw)gate.append(pw);
  const sel=$('searchPersonSelect');
  if(sel){
    sel.addEventListener('change',e=>{if(e.isTrusted&&sel.value)setTimeout(()=>{const r=$('searchPageRun');if(r&&!r.disabled)r.click()},80)});
    new MutationObserver(()=>{if(!sel.value&&sel.options.length===2){sel.value=sel.options[1].value;sel.dispatchEvent(new Event('change'))}}).observe(sel,{childList:true});
  }
  // Setări: rezumat album + date
  (function(){
    const fmtB=n=>n<1048576?Math.round(n/1024)+' KB':n<1073741824?(n/1048576).toFixed(n<1.05e7?1:0)+' MB':(n/1073741824).toFixed(1)+' GB';
    const txt=(id,v)=>{const e=$(id);if(e&&e.textContent!==v)e.textContent=v};
    async function sync(){
      const n=($('albumName')||{}).textContent||'',c=($('fileCount')||{}).textContent||'';
      const has=n&&!/^Niciun/.test(n);
      txt('settingsAlbum',has?n:'Niciun album conectat');
      txt('settingsAlbumCount',has&&!/^0 /.test(c)?c:'Alege un folder cu fotografii');
      const m=String(($('settingsIndex')||{}).textContent||'').match(/^\s*(\S+)\s+poze.*?(\S+)\s+fe/);
      txt('setStatPhotos',m?m[1].trim():'0');txt('setStatFaces',m?m[2].trim():'0');
      txt('setStatPeople',($('statPeople')||{}).textContent||'0');
      try{const e=await navigator.storage.estimate();txt('setStatSize',e&&e.usage!=null?fmtB(e.usage):'–')}catch(_){}
    }
    ['albumName','fileCount','settingsIndex','statPeople'].forEach(id=>{if($(id))new MutationObserver(sync).observe($(id),{childList:true,characterData:true,subtree:true})});
    const nb=document.querySelector('.nav button[data-page="settings"]');if(nb)nb.addEventListener('click',sync);
    if($('settingsLinks'))$('settingsLinks').onclick=()=>{const b=$('abLinks');if(b)b.click()};
    sync();
  })();
  // Căutare: câte poze sunt pregătite, în bara albumului
  (function(){
    const prep=()=>{const e=$('abPrep'),t=String(($('settingsIndex')||{}).textContent||''),m=t.match(/^\s*(\S+)\s+poze/),n=m?m[1]:'0',has=!/^0$/.test(n);
      if(e){e.hidden=!has;e.textContent=has?'✓ '+n+' poze pregătite':''}};
    if($('settingsIndex'))new MutationObserver(prep).observe($('settingsIndex'),{childList:true,characterData:true,subtree:true});prep();
  })();
  // Feedback (pagina Abonament): trimis prin email. Completează adresa mai jos.
  (function(){
    const FEEDBACK_EMAIL='';
    let type='Idee';
    document.querySelectorAll('.fb-type').forEach(b=>b.onclick=()=>{type=b.dataset.t;document.querySelectorAll('.fb-type').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))});
    const send=$('fbSend');if(!send)return;
    send.onclick=async()=>{
      const t=($('fbText').value||'').trim(),msg=$('fbMsg');
      if(t.length<3){msg.textContent='Scrie câteva cuvinte mai întâi.';return}
      const body=t+'\n\n— discover.me 2.0 beta';
      if(FEEDBACK_EMAIL){location.href='mailto:'+FEEDBACK_EMAIL+'?subject='+encodeURIComponent('discover.me · '+type)+'&body='+encodeURIComponent(body);msg.textContent='Se deschide aplicația de email. Mulțumim!';return}
      try{await navigator.clipboard.writeText('['+type+'] '+body);msg.textContent='Mesajul a fost copiat. Adresa de feedback nu este setată încă.'}catch(_){msg.textContent='Adresa de feedback nu este setată încă.'}
    };
  })();
  if($('peopleFilter'))$('peopleFilter').oninput=()=>{if(typeof renderPeople==='function')renderPeople()};
  // ===== Căutare cu cât mai puține click-uri =====
  // intri în Căutare → persoana folosită ultima e aleasă și căutarea pornește singură
  (function(){
    const LAST='dm-last-person';let lastAuto='',timer=0;
    const sp=window.selectPerson,uc=window.updateSearchControls,rs=window.runSearch,rp=window.renderPeople;
    if(!sp||!uc||!rs||!rp)return;
    window.selectPerson=function(id){
      if(id){put(LAST,id);const p=people.find(x=>x.id===id);if(p){p.lastUsed=Date.now();try{storePut('people',p)}catch(e){}}}
      return sp.apply(this,arguments);
    };
    window.runSearch=function(){lastAuto=(selectedPersonId||'')+'|'+indexRevision;return rs.apply(this,arguments)};
    window.renderPeople=function(){people.sort((a,b)=>(b.lastUsed||0)-(a.lastUsed||0)||String(a.name).localeCompare(String(b.name),'ro'));return rp.apply(this,arguments)};
    function auto(){
      const page=$('page-search');if(!page||!page.classList.contains('active'))return;
      if(searchPrerequisiteState()!=='ready'||busy||groupMode)return;
      if(!selectedPersonId){
        const ok=x=>x&&isPersonUnlocked(x.id),p=[people.find(x=>x.id===get(LAST)),...people].find(ok);
        if(p)window.selectPerson(p.id);return;
      }
      const key=selectedPersonId+'|'+indexRevision;if(key===lastAuto)return;
      const r=$('searchPageRun');if(r&&!r.disabled)window.runSearch();
    }
    window.updateSearchControls=function(){
      const r=uc.apply(this,arguments);
      const page=$('page-search');if(page)page.classList.toggle('is-ready',searchPrerequisiteState()==='ready');
      clearTimeout(timer);timer=setTimeout(auto,250);return r;
    };
  })();
  if($('guideTour'))$('guideTour').onclick=()=>{const b=$('tourBtn2')||$('tourBtn');if(b)b.click()};
})();
