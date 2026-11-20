const { loadData, shuffleWith, rng } = require('./harness');const F=require('./features');
const data=loadData('lfw_both.json');const r=rng(5);const gen=[],mix=[];
const med=a=>a.slice().sort((x,y)=>x-y)[1];
const all=data.recs.filter(x=>x.orig&&!x.distractor);
for(const pid of data.persons){const recs=data.byId.get(pid).filter(x=>x.orig);for(let t=0;t<6;t++){const s=shuffleWith(r,recs).slice(0,3);if(s.length<3)continue;const d=[F.dist(s[0].orig.d,s[1].orig.d),F.dist(s[0].orig.d,s[2].orig.d),F.dist(s[1].orig.d,s[2].orig.d)];gen.push(med(d));
 let o;do{o=all[Math.floor(r()*all.length)]}while(o.id===pid);const m=[s[0],s[1],o];const d2=[F.dist(m[0].orig.d,m[1].orig.d),F.dist(m[0].orig.d,m[2].orig.d),F.dist(m[1].orig.d,m[2].orig.d)];mix.push(med(d2))}}
const q=(a,p)=>a.slice().sort((x,y)=>x-y)[Math.floor(p*(a.length-1))].toFixed(3);
console.log('mediană distanțe — aceleași persoane: p50',q(gen,.5),'p90',q(gen,.9),'p95',q(gen,.95),'p99',q(gen,.99),'max',q(gen,1));
console.log('o poză de altă persoană:  p1',q(mix,.01),'p5',q(mix,.05),'p10',q(mix,.1),'p50',q(mix,.5));
for(const t of [.9,.95,1.0,1.05,1.1]){console.log('prag',t,'alarmă la corecte',(100*gen.filter(x=>x>t).length/gen.length).toFixed(1)+'%','prinde greșite',(100*mix.filter(x=>x>t).length/mix.length).toFixed(1)+'%')}
