// discover.me — Fundal animat pe tema pozelor și tutorialul de la prima pornire.
// Fundal: poze tip polaroid (desenate, fără poze reale) care plutesc lent; din când în când
// pe una dintre ele apare cadrul de recunoaștere în jurul unei fețe — exact ce face aplicația.
// Fiecare poză e desenată o singură dată (sprite), apoi doar mutată: cost foarte mic.
// ~30 cadre/s, oprit cât timp se indexează/caută sau fila nu e vizibilă, static în Modul economic.
(function(){
'use strict';
const $=id=>document.getElementById(id),root=document.documentElement;
const get=k=>{try{return localStorage.getItem(k)}catch(e){return null}},put=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
const rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)];

// ================= FUNDAL CU POZE =================
const cv=document.createElement('canvas');cv.id='photoBg';cv.setAttribute('aria-hidden','true');
document.body.prepend(cv);
const glow=document.createElement('div');glow.id='bgGlow';glow.setAttribute('aria-hidden','true');cv.after(glow);
const ctx=cv.getContext('2d');
let W=0,H=0,DPR=1,cards=[],raf=0,last=0,speed=1,targetSpeed=1,accent='#1ed760',light=false,mx=0,my=0,px=0,py=0;
let focus=null,nextFocusAt=performance.now()+2500;

const SCENES=[
  {sky:['#87b9e8','#d9ecf7'],ground:'#5f8f5a'},   // parc
  {sky:['#f6a96b','#fbe0b5'],ground:'#3c4b63'},   // apus
  {sky:['#7fd0e6','#e6f7fb'],ground:'#e9d6a8'},   // plajă
  {sky:['#2b3a67','#6b5b95'],ground:'#1f2638'},   // seară
  {sky:['#c9d6df','#f2f5f7'],ground:'#8a9aa6'},   // oraș
  {sky:['#f3c6d3','#fdeef2'],ground:'#b58ea0'}    // interior cald
];
const SKIN=['#f1c7a5','#d9a27c','#b97a56','#8d5a3b','#f5d6c0'],HAIR=['#2b1d14','#5a3a22','#a8763e','#1c1c1c','#d9b26f'],SHIRT=['#3d6fb6','#c0504d','#3b8f6b','#e0a43a','#6b4fa0','#e8e8e8','#2f2f2f'];

function readTheme(){accent=(getComputedStyle(root).getPropertyValue('--accent')||'#1ed760').trim()||'#1ed760';light=root.dataset.mode==='light'}

// Desenează o poză (o singură dată) și ține minte unde sunt fețele, pentru cadrul de recunoaștere.
function makeSprite(w,h){
  const pad=Math.round(w*.06),bottom=Math.round(w*.2),iw=w-pad*2,ih=h-pad-bottom;
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
  x.fillStyle='#f7f5f0';x.fillRect(0,0,w,h);                                  // rama polaroid
  const sc=pick(SCENES),g=x.createLinearGradient(0,pad,0,pad+ih);g.addColorStop(0,sc.sky[0]);g.addColorStop(1,sc.sky[1]);
  x.fillStyle=g;x.fillRect(pad,pad,iw,ih);
  x.fillStyle=sc.ground;x.beginPath();x.moveTo(pad,pad+ih*.72);
  x.quadraticCurveTo(pad+iw*.5,pad+ih*rnd(.6,.7),pad+iw,pad+ih*.74);x.lineTo(pad+iw,pad+ih);x.lineTo(pad,pad+ih);x.fill();
  if(Math.random()<.5){x.fillStyle='rgba(255,255,255,.75)';x.beginPath();x.arc(pad+iw*rnd(.15,.85),pad+ih*rnd(.12,.3),iw*.07,0,7);x.fill()}   // soare/lună
  const n=Math.random()<.3?0:Math.random()<.55?1:Math.floor(rnd(2,4)),faces=[];
  x.save();x.beginPath();x.rect(pad,pad,iw,ih);x.clip();
  for(let i=0;i<n;i++){                                                       // siluete de oameni
    const cx=pad+iw*(n===1?rnd(.38,.62):(i+.5)/n+rnd(-.05,.05)),r=iw*(n===1?rnd(.11,.14):rnd(.075,.095)),cy=pad+ih*rnd(.42,.52);
    x.fillStyle=pick(SHIRT);x.beginPath();x.ellipse(cx,cy+r*2.6,r*1.9,r*1.7,0,Math.PI,0);x.lineTo(cx+r*1.9,pad+ih);x.lineTo(cx-r*1.9,pad+ih);x.fill();
    x.fillStyle=pick(SKIN);x.beginPath();x.arc(cx,cy,r,0,7);x.fill();
    x.fillStyle=pick(HAIR);x.beginPath();x.arc(cx,cy-r*.15,r*1.04,Math.PI*1.02,Math.PI*1.98);x.fill();
    faces.push({x:cx/w,y:cy/h,r:r/w});
  }
  x.restore();
  x.fillStyle='rgba(0,0,0,.06)';x.fillRect(0,0,w,1);
  return {canvas:c,faces};
}
function makeCard(spread){
  const depth=rnd(0,1),w=Math.round(70+depth*90),h=Math.round(w*1.18),sp=makeSprite(w,h);
  return {...sp,w,h,depth,x:rnd(-.05,1.05)*W,y:spread?rnd(-.1,1.1)*H:H+h+rnd(0,H*.3),
    rot:rnd(-.22,.22),vr:rnd(-.02,.02),vy:-(6+depth*14),vx:rnd(-3,3),alpha:.10+depth*.16};
}
function resize(){
  DPR=Math.min(devicePixelRatio||1,1.5);W=innerWidth;H=innerHeight;
  cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0);
  const n=Math.max(7,Math.min(16,Math.round(W*H/90000)));
  while(cards.length<n)cards.push(makeCard(true));cards.length=n;
  cards.sort((a,b)=>a.depth-b.depth);
  if(!animating())draw(0);
}
function animating(){return !reduceMotion.matches&&root.dataset.lite!=='1'}

function drawFocus(card,cx,cy,t){
  // cadrul verde de recunoaștere, cu colțuri, în jurul feței; apare, stă, dispare
  const f=focus.face,life=(t-focus.t0)/1000;if(life>3.2){focus=null;return}
  const a=life<.35?life/.35:life>2.6?Math.max(0,(3.2-life)/.6):1,lock=Math.min(1,life/.5);
  const s=card.w/card.canvas.width,fx=(f.x-.5)*card.w,fy=(f.y-.5)*card.h,size=f.r*card.w*(2.9-lock*.6)*(1/s>0?1:1);
  ctx.save();ctx.translate(cx,cy);ctx.rotate(card.rot);ctx.globalAlpha=a*(light?.85:.95);
  ctx.strokeStyle=accent;ctx.lineWidth=2;const h=size/2,L=size*.28;
  for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){ctx.beginPath();ctx.moveTo(fx+sx*h,fy+sy*(h-L));ctx.lineTo(fx+sx*h,fy+sy*h);ctx.lineTo(fx+sx*(h-L),fy+sy*h);ctx.stroke()}
  if(lock>=1){ctx.fillStyle=accent;ctx.beginPath();ctx.arc(fx+h,fy-h,7,0,7);ctx.fill();ctx.strokeStyle='#000';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(fx+h-3.2,fy-h);ctx.lineTo(fx+h-.8,fy-h+2.4);ctx.lineTo(fx+h+3.4,fy-h-2.6);ctx.stroke()}
  ctx.restore();
}
function draw(dt){
  const t=performance.now();ctx.clearRect(0,0,W,H);
  px+=(mx-px)*.04;py+=(my-py)*.04;
  for(const c of cards){
    c.y+=c.vy*speed*dt;c.x+=c.vx*speed*dt;c.rot+=c.vr*dt;
    if(c.y<-c.h*1.2||c.x<-c.w*2||c.x>W+c.w*2){Object.assign(c,makeCard(false))}
    const cx=c.x+px*c.depth*16,cy=c.y+py*c.depth*16;
    ctx.save();ctx.globalAlpha=light?c.alpha*.85:c.alpha;ctx.translate(cx,cy);ctx.rotate(c.rot);
    ctx.shadowColor=light?'rgba(16,24,40,.12)':'rgba(0,0,0,.35)';ctx.shadowBlur=c.depth*14;ctx.shadowOffsetY=c.depth*6;
    ctx.drawImage(c.canvas,-c.w/2,-c.h/2,c.w,c.h);ctx.restore();
    if(focus&&focus.card===c)drawFocus(c,cx,cy,t);
  }
  if(!focus&&t>nextFocusAt){                                                  // alege o poză apropiată, cu o față vizibilă
    const options=cards.filter(c=>c.faces.length&&c.depth>.45&&c.y>H*.15&&c.y<H*.85&&c.x>W*.1&&c.x<W*.9);
    if(options.length){const card=pick(options);focus={card,face:pick(card.faces),t0:t}}
    nextFocusAt=t+rnd(3500,6000);
  }
}
function loop(now){
  raf=requestAnimationFrame(loop);
  if(typeof busy!=='undefined'&&busy&&!document.body.classList.contains('intro-open')){root.classList.add('bg-paused');return}
  root.classList.remove('bg-paused');
  if(now-last<33)return;
  const dt=Math.min(.1,(now-last)/1000);last=now;speed+=(targetSpeed-speed)*.06;
  draw(dt);
}
function start(){if(!raf&&animating()&&!document.hidden){last=performance.now();raf=requestAnimationFrame(loop)}}
function stop(){cancelAnimationFrame(raf);raf=0}
function refresh(){readTheme();if(animating())start();else{stop();draw(0)}}
addEventListener('resize',resize);
addEventListener('pointermove',e=>{mx=e.clientX/W*2-1;my=e.clientY/H*2-1},{passive:true});
document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
reduceMotion.addEventListener&&reduceMotion.addEventListener('change',refresh);
new MutationObserver(refresh).observe(root,{attributes:true,attributeFilter:['data-mode','data-accent','data-lite']});
readTheme();resize();start();
window.backdrop={calm(){targetSpeed=1},lively(){targetSpeed=2.2},nudge(){speed=Math.max(speed,4)}};

// ================= TUTORIAL (prima pornire) =================
const SLIDES=[
  {kick:'Bine ai venit',title:'Găsește pe oricine în mii de poze',text:'În câteva secunde. Direct în browser. Fără să urci nimic pe internet.',btn:'Începe'},
  {kick:'01 — Albumul',title:'Alege folderul cu poze',text:'Îl pregătim o singură dată, direct pe dispozitivul tău.',btn:'Înainte'},
  {kick:'02 — Oamenii',title:'Spune-ne cine e',text:'Îți arătăm fețele care apar în album. Scrii un nume și vezi toate pozele cu persoana.',btn:'Înainte'},
  {kick:'03 — Gata',title:'Bifează. Descarcă.',text:'Verifică rezultatele și descarcă-le pe toate într-o arhivă.',btn:'Hai să începem'}
];
const intro=$('intro');let si=0,touchX=null;
function render(dir){
  const s=SLIDES[si];
  $('introKick').textContent=s.kick;$('introTitle').textContent=s.title;$('introText').textContent=s.text;
  $('introNext').textContent=s.btn;$('introBack').hidden=si===0;
  $('introNum').textContent=`${String(si+1).padStart(2,'0')} / ${String(SLIDES.length).padStart(2,'0')}`;
  [...$('introProgress').children].forEach((el,i)=>{el.className=i<si?'done':i===si?'on':''});
  const body=intro.querySelector('.intro-body');body.classList.remove('in','in-back');void body.offsetWidth;body.classList.add(dir<0?'in-back':'in');
  intro.dataset.slide=si;
}
function go(d){const n=si+d;if(n<0)return;if(n>=SLIDES.length){finish();return}si=n;window.backdrop.nudge();render(d)}
function open(){
  if(!$('introProgress').children.length)$('introProgress').append(...SLIDES.map(()=>document.createElement('i')));
  si=0;intro.hidden=false;document.body.classList.add('intro-open');window.backdrop.lively();render(1);
  requestAnimationFrame(()=>intro.classList.add('show'));setTimeout(()=>$('introNext').focus(),60);
}
function finish(){
  put('dm-tour','1');intro.classList.remove('show');window.backdrop.calm();
  setTimeout(()=>{intro.hidden=true;document.body.classList.remove('intro-open')},450);
  // după tutorial: dacă nu există încă persoane, mergem direct la crearea primei persoane
  try{if(typeof people!=='undefined'&&!people.length&&typeof navigate==='function'){returnToSearchAfterPersonCreation=true;navigate('people')}}catch(e){}
}
$('introNext').onclick=()=>go(1);$('introBack').onclick=()=>go(-1);$('introSkip').onclick=finish;
intro.addEventListener('keydown',e=>{if(e.key==='ArrowRight')go(1);else if(e.key==='ArrowLeft')go(-1);else if(e.key==='Escape')finish()});
intro.addEventListener('touchstart',e=>{touchX=e.changedTouches[0].clientX},{passive:true});
intro.addEventListener('touchend',e=>{if(touchX===null)return;const dx=e.changedTouches[0].clientX-touchX;touchX=null;if(Math.abs(dx)>50)go(dx<0?1:-1)},{passive:true});
window.openIntro=open;
['tourBtn','tourBtn2'].forEach(id=>{const b=$(id);if(b)b.onclick=open});
if(!get('dm-tour'))setTimeout(open,350);
})();
