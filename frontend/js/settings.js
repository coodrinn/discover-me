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
    document.querySelectorAll('.ui-style').forEach(b=>{const on=b.dataset.ui===h.dataset.ui;b.setAttribute('aria-checked',String(on));b.classList.toggle('on',on)});
    const lt=$('liteToggle');if(lt)lt.checked=h.dataset.lite==='1';
    document.querySelectorAll('.sw').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.a===h.dataset.accent)));
    const t=document.querySelector('meta[name="theme-color"]');if(t)t.content=h.dataset.mode==='light'?'#f4f5f7':'#141414';
  }
  document.querySelectorAll('.seg-btn').forEach(b=>b.onclick=()=>{h.dataset.modePref=b.dataset.m;put('dm-mode',b.dataset.m);resolveMode();apply()});
  document.querySelectorAll('.ui-style').forEach(b=>b.onclick=()=>{h.dataset.ui=b.dataset.ui;put('dm-ui',b.dataset.ui);apply()});
  if($('liteToggle'))$('liteToggle').onchange=e=>{if(e.target.checked)h.dataset.lite='1';else delete h.dataset.lite;put('dm-lite',e.target.checked?'1':'0')};
  // Efecte la atingere: val (Clasic), elastic (Minimal), strălucire (Vibrant)
  document.addEventListener('pointerdown',e=>{
    const el=e.target.closest('.button,.nav button,.seg-btn,.sw,.person-chip,.ui-style,.teach-btn,.preview-nav');if(!el||el.disabled)return;
    if(navigator.vibrate&&e.pointerType==='touch')try{navigator.vibrate(8)}catch(_){}
    const ui=h.dataset.ui||'clasic';
    if(ui==='minimal'||h.dataset.lite==='1'){el.classList.remove('fx-spring');void el.offsetWidth;el.classList.add('fx-spring');return}
    const r=el.getBoundingClientRect(),size=Math.max(r.width,r.height)*2.2,clip=document.createElement('span'),dot=document.createElement('span');
    clip.className='fx-clip';dot.className=ui==='vibrant'?'fx-glow':'fx-ripple';
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
  // ghid rapid
  const T=[['1 / 3','♡  Adaugă persoana','3 poze clare cu fața celui pe care îl cauți.'],['2 / 3','▧  Alege albumul','Folderul cu poze. Pozele rămân pe dispozitivul tău.'],['3 / 3','⌕  Gata','Căutarea pornește singură. Bifează pozele bune și descarcă-le.']];
  let ti=0;const dlg=$('tourDlg');
  function draw(){const [n,t,x]=T[ti];$('tourNo').textContent=n;$('tourTitle').textContent=t;$('tourText').textContent=x;$('tourDots').replaceChildren(...T.map((_,i)=>{const e=document.createElement('i');if(i===ti)e.className='on';return e}));$('tourBack').disabled=ti===0;$('tourNext').textContent=ti===T.length-1?'Gata':'Înainte'}
  function open(){ti=0;draw();if(!dlg.open)dlg.showModal()}
  function close(){put('dm-tour','1');if(dlg.open)dlg.close()}
  $('tourNext').onclick=()=>{if(ti===T.length-1)close();else{ti++;draw()}};$('tourBack').onclick=()=>{if(ti>0){ti--;draw()}};$('tourSkip').onclick=close;dlg.addEventListener('cancel',()=>put('dm-tour','1'));
  $('tourBtn').onclick=open;$('tourBtn2').onclick=open;
  if(!get('dm-tour'))setTimeout(open,700);
  const syncAlbum=()=>{const n=($('albumName')||{}).textContent||'Niciun album',c=($('fileCount')||{}).textContent||'';$('abName').textContent=n;$('abCount').textContent=/^0\b/.test(c)?'Alege folderul cu fotografii':c};
  ['albumName','fileCount'].forEach(id=>{if($(id))new MutationObserver(syncAlbum).observe($(id),{childList:true,characterData:true,subtree:true})});syncAlbum();
  $('abChange').onclick=()=>{const b=$('chooseFolder');if(b)b.click()};
  const gate=document.querySelector('#searchGateCard .gate-copy'),pw=$('scanProgressWrap');if(gate&&pw)gate.append(pw);
  const sel=$('searchPersonSelect');
  if(sel){
    sel.addEventListener('change',e=>{if(e.isTrusted&&sel.value)setTimeout(()=>{const r=$('searchPageRun');if(r&&!r.disabled)r.click()},80)});
    new MutationObserver(()=>{if(!sel.value&&sel.options.length===2){sel.value=sel.options[1].value;sel.dispatchEvent(new Event('change'))}}).observe(sel,{childList:true});
  }
})();
