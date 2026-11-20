const { loadData } = require('./harness');const F=require('./features');
const data=loadData('lfw_both.json');const items=data.recs.filter(x=>x.orig);
const imp=[],gen=[];
for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j+=1){const a=items[i],b=items[j];const d=F.dist(a.orig.d,b.orig.d);if(d>1.25)continue;const same=!a.distractor&&!b.distractor&&a.id===b.id;(same?gen:imp).push(d)}
imp.sort((a,b)=>a-b);gen.sort((a,b)=>a-b);const nImp=items.length*(items.length-1)/2-gen.length;
for(const t of [.7,.75,.8,.85,.9,.95,1.0]){const fi=imp.filter(x=>x<t).length,g=gen.filter(x=>x<t).length;console.log('prag',t,'| același om acceptat',(100*g/(gen.length||1)).toFixed(1)+'%','| persoane diferite acceptate (FAR)',(fi/nImp*100).toFixed(4)+'%  ('+fi+' perechi)')}
