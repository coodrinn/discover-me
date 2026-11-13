// Aplică tema salvată înainte de afișare (evită clipirea între moduri).
try{
  var h=document.documentElement,g=function(k){return localStorage.getItem(k)},m=g("dm-mode")||"dark",a=g("dm-accent"),u=g("dm-ui"),l=g("dm-lite");h.dataset.modePref=m;if(m==="auto")m=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";if(m==="light"||m==="dark")h.dataset.mode=m;if(a)h.dataset.accent=a;h.dataset.ui=(u==="minimal"||u==="vibrant")?u:"clasic";if(l==="1"||(l===null&&((navigator.hardwareConcurrency||8)<=4||(navigator.deviceMemory||8)<=4)))h.dataset.lite="1"
}catch(e){}
