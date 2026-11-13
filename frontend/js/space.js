// discover.me — Fundal spațial animat (câmp de stele) și tutorialul de la prima pornire.
// Fundalul e un singur <canvas>: ~30 cadre/s, se oprește când fila nu e vizibilă,
// iar în Modul economic sau cu „reduce motion” desenează un singur cadru static.
(function(){
'use strict';
const $=id=>document.getElementById(id),root=document.documentElement;
const get=k=>{try{return localStorage.getItem(k)}catch(e){return null}},put=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');

// ================= CÂMP DE STELE =================
const cv=document.createElement('canvas');cv.id='spaceBg';cv.setAttribute('aria-hidden','true');
document.body.prepend(cv);
const ctx=cv.getContext('2d',{alpha:true});
let W=0,H=0,DPR=1,stars=[],raf=0,last=0,t0=performance.now();
let speed=.018,target=.018,burst=0,mx=0,my=0,px=0,py=0;
let accent='#1ed760',light=false;

function readTheme(){
  const cs=getComputedStyle(root);
  accent=(cs.getPropertyValue('--accent')||'#1ed760').trim()||'#1ed760';
  light=root.dataset.mode==='light';
}
function hexToRgb(c){
  const m=/^#?([0-9a-f]{6})$/i.exec(c);if(m){const n=parseInt(m[1],16);return [n>>16&255,n>>8&255,n&255]}
  const r=/(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(c);return r?[+r[1],+r[2],+r[3]]:[30,215,96];
}
function makeStar(fresh){return {x:(Math.random()*2-1),y:(Math.random()*2-1),z:fresh?Math.random()*.9+.1:1,tw:Math.random()*6.28}}
function resize(){
  DPR=Math.min(devicePixelRatio||1,1.5);W=innerWidth;H=innerHeight;
  cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0);
  const n=Math.min(260,Math.round(W*H/7000));
  while(stars.length<n)stars.push(makeStar(true));stars.length=n;
  if(!animating())draw(0);
}
function animating(){return !reduceMotion.matches&&root.dataset.lite!=='1'}

// Nebuloasele sunt un strat CSS separat (animat pe placa grafică), nu se redesenează pe canvas.
const neb=document.createElement('div');neb.id='spaceNebula';neb.setAttribute('aria-hidden','true');cv.after(neb);
function draw(dt){
  const t=(performance.now()-t0)/1000;
  ctx.clearRect(0,0,W,H);
  // stele care vin încet spre privitor (accelerează în tutorial)
  px+=(mx-px)*.04;py+=(my-py)*.04;
  const cx=W/2,cy=H/2,scale=Math.max(W,H)*.6,v=(speed+burst)*dt;
  for(const s of stars){
    const pz=s.z;s.z-=v;
    if(s.z<=.03){Object.assign(s,makeStar(false));continue}
    const k=1/s.z,sx=cx+s.x*scale*k+px*(1-s.z)*28,sy=cy+s.y*scale*k+py*(1-s.z)*28;
    if(sx<-20||sx>W+20||sy<-20||sy>H+20){Object.assign(s,makeStar(false));continue}
    const near=1-s.z,size=.35+near*1.9,alpha=Math.min(1,.15+near*1.1)*(.8+.2*Math.sin(t*2+s.tw));
    ctx.fillStyle=light?`rgba(40,52,70,${alpha*.45})`:`rgba(255,255,255,${alpha})`;
    if(burst>.05&&dt){                                   // dâre de lumină la „salt”
      const k0=1/pz,ox=cx+s.x*scale*k0,oy=cy+s.y*scale*k0;
      ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=size;ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(sx,sy);ctx.stroke();
    }else if(size<1.2)ctx.fillRect(sx,sy,size*1.6,size*1.6);   // stelele mici: pătrățel, mult mai ieftin decât un cerc
    else{ctx.beginPath();ctx.arc(sx,sy,size,0,6.283);ctx.fill()}
  }
}
function loop(now){
  raf=requestAnimationFrame(loop);
  // În timpul indexării/căutării animația stă pe loc: procesorul grafic lucrează doar la recunoașterea fețelor.
  if(typeof busy!=='undefined'&&busy&&!document.body.classList.contains('intro-open')){root.classList.add('space-paused');return}
  root.classList.remove('space-paused');
  if(now-last<33)return;                                // ~30 cadre/s
  const dt=Math.min(.1,(now-last)/1000);last=now;
  speed+=(target-speed)*.05;burst*=.92;if(burst<.002)burst=0;
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

window.space={
  cruise(){target=.018},
  intro(){target=.07},
  warp(){if(animating())burst=.9}
};

// ================= TUTORIAL (prima pornire) =================
const SLIDES=[
  {kick:'Bine ai venit',title:'Găsește pe oricine în mii de poze',text:'În câteva secunde. Direct în browser. Fără să urci nimic pe internet.',icon:'◎',btn:'Începe'},
  {kick:'01 — Persoana',title:'Adaugă 3 poze cu fața ei',text:'Clare, din unghiuri diferite. Le folosim ca să o recunoaștem.',icon:'♡',btn:'Înainte'},
  {kick:'02 — Albumul',title:'Alege folderul cu poze',text:'Pozele apar pe măsură ce le găsim. Nu trebuie să aștepți până la final.',icon:'▧',btn:'Înainte'},
  {kick:'03 — Gata',title:'Bifează. Descarcă.',text:'Verifică rezultatele și descarcă-le pe toate într-o arhivă.',icon:'✓',btn:'Hai să începem'}
];
const intro=$('intro');let si=0,touchX=null;
function render(dir){
  const s=SLIDES[si];
  $('introKick').textContent=s.kick;$('introTitle').textContent=s.title;$('introText').textContent=s.text;
  $('introIcon').textContent=s.icon;$('introNext').textContent=s.btn;$('introBack').hidden=si===0;
  $('introNum').textContent=`${String(si+1).padStart(2,'0')} / ${String(SLIDES.length).padStart(2,'0')}`;
  [...$('introProgress').children].forEach((el,i)=>{el.className=i<si?'done':i===si?'on':''});
  const body=intro.querySelector('.intro-body');body.classList.remove('in','in-back');void body.offsetWidth;body.classList.add(dir<0?'in-back':'in');
  intro.dataset.slide=si;
}
function go(d){const n=si+d;if(n<0)return;if(n>=SLIDES.length){finish();return}si=n;window.space.warp();render(d)}
function open(){
  if(!$('introProgress').children.length)$('introProgress').append(...SLIDES.map(()=>document.createElement('i')));
  si=0;intro.hidden=false;document.body.classList.add('intro-open');window.space.intro();render(1);
  requestAnimationFrame(()=>intro.classList.add('show'));setTimeout(()=>$('introNext').focus(),60);
}
function finish(){
  put('dm-tour','1');intro.classList.remove('show');window.space.cruise();window.space.warp();
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
