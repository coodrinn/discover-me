// discover.me — Intro la pornire: povestea aplicației în ~4,5 secunde.
//  1. apare un album (grilă de poze estompate)
//  2. lupa din logo caută prin album; prin lentilă pozele se văd mărite și clare, fețele primesc cadrul de detectare
//  3. lupa găsește persoana: cadrul devine verde, ✓, puls
//  4. albumul dispare, lupa devine logoul, iar persoana găsită devine silueta din lentilă
//  5. apare numele, motoul se scrie literă cu literă și „regăsite” se aprinde
// Mișcarea folosește doar transform și opacity (Web Animations), care rulează pe placa video:
// rămâne fluidă chiar dacă pagina e ocupată cu încărcarea modelelor de recunoaștere.
// Se arată o dată pe sesiune; ?intro=1 îl forțează. Click, Esc, Enter sau Spațiu îl sar.
'use strict';
(function(){
  // window.dmIntro: promisiune rezolvată când intro-ul s-a închis (app.js pornește motorul abia atunci)
  // window.dmIntroStart: semnalul la care app.js pornește motorul (după ce lupa a devenit logo: restul intro-ului e ușor)
  let introDone,engineGo;window.dmIntro=new Promise(r=>introDone=r);window.dmIntroStart=new Promise(r=>engineGo=r);
  const root=document.getElementById('splash');if(!root){introDone();engineGo();return}
  const html=document.documentElement,force=/[?&]intro=1\b/.test(location.search);
  let seen=false;try{seen=sessionStorage.getItem('dm-splash')==='1';sessionStorage.setItem('dm-splash','1')}catch(e){}
  if(seen&&!force){root.remove();introDone();engineGo();return}
  if(force)try{history.replaceState(null,'',location.pathname+location.search.replace(/([?&])intro=1(&|$)/,'$1').replace(/[?&]$/,'')+location.hash)}catch(e){}

  html.classList.add('splash-on');
  let closed=false;const timers=[];
  function close(){
    if(closed)return;closed=true;timers.forEach(clearTimeout);
    root.classList.add('out');html.classList.remove('splash-on');removeEventListener('keydown',onKey);
    setTimeout(()=>root.remove(),750);introDone();engineGo();
  }
  function onKey(e){if(e.key==='Escape'||e.key==='Enter'||e.key===' '){e.preventDefault();close()}}
  addEventListener('keydown',onKey);root.addEventListener('click',close);
  const later=(ms,fn)=>timers.push(setTimeout(fn,ms));

  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Intro-ul se închide când a trecut durata minimă ȘI aplicația e gata; până atunci logoul rămâne, cu o bară de încărcare.
  let minDone=false,ready=!!window.dmEngineDone;const CAP=12000;
  const tryClose=()=>{if(minDone&&ready)close()};
  document.addEventListener('dm:engine',()=>{ready=true;tryClose()},{once:true});
  // în varianta animată, starea de așteptare e programată din start pe placa video (vezi mai jos), nu din acest temporizator:
  // dacă pornirea motorului ține pagina ocupată, temporizatorul ar întârzia și finalul ar părea înghețat
  const minReached=()=>{minDone=true;if(!ready&&!closed&&!root.classList.contains('anim'))root.querySelector('.sp-wait').classList.add('on');tryClose()};
  if(reduce||!root.animate){root.classList.add('static');engineGo();later(1300,minReached);later(1300+CAP,close);return}   // varianta statică: logo + nume + moto
  root.classList.add('anim');

  // ---------- scena: albumul ----------
  const narrow=innerWidth<640,cols=narrow?3:5,rows=narrow?4:3,n=cols*rows;
  const target=narrow?4:7,path=narrow?[0,8,6]:[0,11,3];          // pozele prin care trece lupa înainte s-o găsească
  const grid=root.querySelector('.sp-grid');
  grid.style.setProperty('--cols',cols);
  let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646},pick=a=>a[Math.floor(rnd()*a.length)];
  const SKY=[['#f6a96b','#fbe0b5'],['#87b9e8','#d9ecf7'],['#c9d6df','#f2f5f7'],['#b9a6e8','#efe6ff'],['#f2c4d0','#fff1f4'],['#9fd8c3','#e9fbf3'],['#f7d77c','#fff6d6']];
  const GROUND=['#3c4b63','#5f8f5a','#8a9aa6','#6b5a8e','#a35d6a','#3f7d6b','#b07a3c'];
  const SKIN=['#f1c7a5','#e7b894','#c98f6a','#a96f4c','#7a4d33','#f5d3b8'];
  const SHIRT=['#3d6fb6','#c0504d','#3b8f6b','#e0a43a','#7b5bb5','#2f3540','#d96f9a','#4aa3a0'];
  const HAIR=['#3a2618','#1d1a17','#6b4423','#c99a5b','#2b2b2b'];
  for(let i=0;i<n;i++){const t=document.createElement('div');t.className='sp-tile';t.dataset.i=i;grid.append(t)}
  const tiles=[...grid.children],tw=tiles[0].offsetWidth,th=tiles[0].offsetHeight;
  const faces=[];                                                   // fața principală din fiecare poză (px, în poză)
  const el=(cls,css)=>{const d=document.createElement('div');d.className=cls;Object.assign(d.style,css);return d};
  tiles.forEach((t,i)=>{
    const sky=pick(SKY),horizon=55+Math.round(rnd()*12);
    t.style.background=`${rnd()<.45?`radial-gradient(circle at ${15+rnd()*70}% ${18+rnd()*15}%,#fff8 0 ${4+rnd()*5}%,transparent ${6+rnd()*6}%),`:''}linear-gradient(${sky[0]},${sky[1]} ${horizon}%,${pick(GROUND)} ${horizon}%)`;
    const isT=i===target,count=isT?2:1+Math.floor(rnd()*3),people=[];
    for(let k=0;k<count;k++){
      const main=k===0,ph=th*(isT?(main?.78:.5):main?.62+rnd()*.2:.38+rnd()*.2);
      let cx=isT?(main?tw*.5:tw*.84):tw*(count===1?.3+rnd()*.4:(k+.5)/count+(rnd()-.5)*.12);
      people.push({cx,ph,main});
    }
    people.sort((a,b)=>a.ph-b.ph);                                    // cei mici în spate
    for(const p of people){
      const r=p.ph*.17,bw=p.ph*.62,bh=p.ph*.46,hy=th-bh-r*.9;
      t.append(el('sp-body',{left:p.cx-bw/2+'px',top:th-bh+'px',width:bw+'px',height:bh+'px',background:pick(SHIRT)}));
      const head=el('sp-head',{left:p.cx-r+'px',top:hy-r+'px',width:2*r+'px',height:2*r+'px',background:pick(SKIN)});
      head.style.boxShadow=`inset 0 ${r*.55}px 0 -${r*.12}px ${pick(HAIR)}`;t.append(head);
      if(p.main){const side=r*2.9;faces[i]={x:p.cx,y:hy,side};
        const box=el('sp-box',{left:p.cx-side/2+'px',top:hy-side/2+'px',width:side+'px',height:side+'px'});
        if(isT){box.classList.add('hit');box.append(el('sp-ok',{}))}
        t.append(box)}
    }
  });

  // ---------- lupa: geometrie ----------
  const lens=root.querySelector('.sp-lens'),glass=lens.querySelector('.sp-glass'),logo=lens.querySelector('.sp-logo');
  const g=grid.getBoundingClientRect(),gx=g.left,gy=g.top;
  const s=th*1.02/25,G=25*s,Z=1.5;                                 // s = px pe unitatea logoului (viewBox 48); G = diametrul lentilei
  Object.assign(logo.style,{left:-21*s+'px',top:-21*s+'px',width:48*s+'px',height:48*s+'px'});
  Object.assign(glass.style,{left:-G/2+'px',top:-G/2+'px',width:G+'px',height:G+'px'});
  lens.querySelectorAll('.sp-ping').forEach(p=>Object.assign(p.style,{left:-15*s+'px',top:-15*s+'px',width:30*s+'px',height:30*s+'px'}));
  const zoom=grid.cloneNode(true);zoom.className='sp-grid sp-zoom';zoom.style.width=g.width+'px';glass.append(zoom);
  const faceAt=i=>{const r=tiles[i].getBoundingClientRect();return {x:r.left+faces[i].x,y:r.top+faces[i].y}};
  const slot=root.querySelector('.sp-slot').getBoundingClientRect();
  const P=[...path.map(faceAt),faceAt(target)],PF={x:slot.left+slot.width*21/48,y:slot.top+slot.height*21/48},kF=slot.width/48/s;

  // ---------- cronologia (ms) ----------
  const D=2700,DL=250,at=o=>DL+o*D,EASE='cubic-bezier(.65,0,.35,1)';
  const way=[[0,P[0],.7],[.07,P[0],1],[.13,P[0],1],[.27,P[1],1],[.32,P[1],1],[.46,P[2],1],[.51,P[2],1],[.66,P[3],1],[.82,P[3],1],[1,PF,kF]];
  const stops=[[.07,.13],[.27,.32],[.46,.51]],found=at(.66),lockEnd=at(.82),landed=at(1);
  const opt=(delay,duration,extra)=>Object.assign({delay,duration,fill:'both',easing:'cubic-bezier(.16,1,.3,1)'},extra);
  lens.animate(way.map(([o,p,k])=>({offset:o,easing:EASE,transform:`translate(${p.x}px,${p.y}px) scale(${k})`})),{delay:DL,duration:D,fill:'both'});
  // conținutul mărit se mișcă invers față de lupă, cu aceeași curbă: lentila arată exact poza de sub ea
  zoom.animate(way.map(([o,p])=>({offset:o,easing:EASE,transform:`translate(${G/2-Z*(p.x-gx)}px,${G/2-Z*(p.y-gy)}px) scale(${Z})`})),{delay:DL,duration:D,fill:'both'});
  lens.animate([{opacity:0},{opacity:1}],opt(DL,300));

  // albumul apare din centru spre margini, apoi dispare pornind de la persoana găsită
  const tc=i=>[i%cols,Math.floor(i/cols)],dist=(a,b)=>{const[x1,y1]=tc(a),[x2,y2]=tc(b);return Math.hypot(x1-x2,y1-y2)},mid=Math.floor(n/2);
  tiles.forEach((t,i)=>{
    t.animate([{opacity:0,transform:'translateY(14px) scale(.96)'},{opacity:1,transform:'none'}],opt(dist(i,mid)*55,650));
    t.animate([{opacity:1,transform:'none'},{opacity:0,transform:`scale(.9) translate(${(tc(i)[0]-tc(target)[0])*8}px,${(tc(i)[1]-tc(target)[1])*8}px)`}],opt(lockEnd+dist(i,target)*28,320,{easing:'cubic-bezier(.7,0,.84,0)',fill:'forwards'}));
  });
  // cadrele de detectare: albe pe fețele verificate, verde pe persoana găsită (în album și în lentilă)
  const boxes=i=>root.querySelectorAll(`.sp-tile[data-i="${i}"] .sp-box`);
  stops.forEach(([a,b],k)=>{const t0=at(a)-60,len=at(b)-t0+260;
    boxes(path[k]).forEach(x=>x.animate([{opacity:0,transform:'scale(1.35)'},{opacity:1,transform:'scale(1)',offset:.3},{opacity:1,transform:'scale(1)',offset:.7},{opacity:0,transform:'scale(1)'}],opt(t0,len)))});
  boxes(target).forEach(x=>{x.animate([{opacity:0,transform:'scale(1.6)'},{opacity:1,transform:'scale(1)'}],opt(found-40,380));
    x.querySelector('.sp-ok').animate([{opacity:0,transform:'scale(0)'},{opacity:1,transform:'scale(1.25)',offset:.6},{opacity:1,transform:'scale(1)'}],opt(found+220,380))});
  lens.querySelectorAll('.sp-ping').forEach((p,k)=>p.animate([{opacity:.85,transform:'scale(1)'},{opacity:0,transform:'scale(1.9)'}],opt(found+230+k*170,800,{easing:'cubic-bezier(.2,.6,.3,1)',fill:'forwards'})));
  // lupa devine logoul: lentila se golește, persoana găsită devine silueta din logo
  glass.animate([{opacity:1},{opacity:0}],opt(lockEnd+120,380,{fill:'forwards'}));
  logo.querySelector('.sp-person').animate([{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'none'}],opt(lockEnd+260,520,{easing:'cubic-bezier(.34,1.56,.64,1)'}));
  // indicatorul de căutare de sub album: bara se umple cât caută lupa, apoi „Am găsit-o ✓”
  const hud=root.querySelector('.sp-hud');hud.style.top=g.bottom+26+'px';
  hud.animate([{opacity:0,transform:'translate(-50%,6px)'},{opacity:1,transform:'translate(-50%,0)'}],opt(DL+150,450));
  hud.querySelector('.sp-bar i').animate([{transform:'scaleX(0)'},{transform:'scaleX(.18)',offset:.2},{transform:'scaleX(.46)',offset:.48},{transform:'scaleX(.72)',offset:.78},{transform:'scaleX(1)'}],opt(DL+200,found-DL-200,{easing:'cubic-bezier(.4,0,.6,1)'}));
  hud.querySelector('.sp-bar b').animate([{opacity:0},{opacity:1}],opt(found,220));   // bara devine verde
  hud.querySelector('.sp-hud-a').animate([{opacity:1,transform:'none'},{opacity:0,transform:'translateY(-8px)'}],opt(found+60,260,{fill:'forwards'}));
  hud.querySelector('.sp-hud-b').animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],opt(found+160,320));
  hud.animate([{opacity:1},{opacity:0}],opt(lockEnd+80,320,{fill:'forwards'}));
  root.querySelector('.sp-glow').animate([{opacity:0,transform:'scale(.6)'},{opacity:1,transform:'none'}],opt(lockEnd,900));

  // ---------- numele și motoul ----------
  const letters=[...root.querySelectorAll('.sp-word span')];
  letters.forEach((l,i)=>{if(l.classList.contains('sp-dot'))return;
    l.animate([{opacity:0,transform:'translateY(.45em)'},{opacity:1,transform:'none'}],opt(landed-40+i*38,560))});
  root.querySelector('.sp-dot').animate([{opacity:0,transform:'translateY(-1.1em) scale(.4)'},{opacity:1,transform:'translateY(.06em) scale(1.3)',offset:.62},{opacity:1,transform:'none'}],opt(landed+260,560,{easing:'cubic-bezier(.3,0,.4,1)'}));
  // motoul se scrie literă cu literă, cu un cursor care merge odată cu textul
  const motto=root.querySelector('.sp-motto'),caret=motto.querySelector('.sp-caret'),chars=[];
  motto.querySelectorAll('.sp-type').forEach(part=>{const txt=part.textContent;part.textContent='';for(const c of txt){const sp=document.createElement('span');sp.textContent=c;part.append(sp);chars.push(sp)}});
  const typeStart=landed+300,STEP=28,mb=motto.getBoundingClientRect();
  chars.forEach((c,i)=>c.animate([{opacity:0},{opacity:1}],opt(typeStart+i*STEP,90,{easing:'linear'})));
  const xs=chars.map(c=>{const r=c.getBoundingClientRect();return r.right-mb.left});const typed=chars.length*STEP;
  caret.animate([{transform:'translateX(0)'},...xs.map((x,i)=>({offset:(i+1)/chars.length,transform:`translateX(${x}px)`}))],opt(typeStart,typed,{easing:'linear'}));
  caret.animate([{opacity:0},{opacity:1,offset:.05},{opacity:1,offset:.78},{opacity:0,offset:.82},{opacity:1,offset:.88},{opacity:0,offset:.94},{opacity:0}],opt(typeStart-60,typed+900,{easing:'steps(1,end)'}));
  // „regăsite” se aprinde: ca un rezultat găsit
  const doneTyping=typeStart+typed;
  motto.querySelector('.sp-hl').animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],opt(doneTyping+80,460));
  motto.querySelector('.sp-lit').animate([{opacity:0},{opacity:1}],opt(doneTyping+120,420,{easing:'ease'}));
  root.querySelector('.sp-skip').animate([{opacity:0},{opacity:1}],opt(700,400));
  later(landed,engineGo);                                        // lupa a devenit logo: pornește motorul
  // Dacă aplicația nu e gata la final: lupa pulsează lin, iar sub moto apare „Pregătesc aplicația…” cu o bară în mișcare.
  // Totul e programat acum, cu întârziere, ca animații pe placa video: pornesc la timp chiar dacă pagina e ocupată.
  // Dacă intro-ul se închide înainte, nu apucă să se vadă.
  const MIN=doneTyping+600;
  root.querySelector('.sp-wait').animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],opt(MIN+250,500));
  lens.querySelectorAll('.sp-ping').forEach((p,k)=>p.animate([{opacity:.55,transform:'scale(1)'},{opacity:0,transform:'scale(1.8)'}],{delay:MIN+250+k*800,duration:1600,iterations:Infinity,easing:'cubic-bezier(.2,.6,.3,1)'}));
  logo.animate([{transform:'scale(1)'},{transform:'scale(1.045)'},{transform:'scale(1)'}],{delay:MIN+250,duration:1600,iterations:Infinity,easing:'ease-in-out'});
  later(MIN,minReached);later(MIN+CAP,close);
})();
