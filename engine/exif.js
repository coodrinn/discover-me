// discover.me — Data la care a fost făcută poza (EXIF DateTimeOriginal), citită direct din fișier.
// Citește doar primii 256 KB din JPEG; pentru alte formate folosește data fișierului.
'use strict';

async function readPhotoDate(file){
  try{
    if(!file||!(/\.jpe?g$/i.test(file.name||'')||file.type==='image/jpeg'))return null;
    const buf=await file.slice(0,262144).arrayBuffer(),v=new DataView(buf);
    if(v.byteLength<4||v.getUint16(0)!==0xFFD8)return null;
    let o=2;
    while(o+10<v.byteLength){
      const marker=v.getUint16(o);if((marker&0xFF00)!==0xFF00)return null;
      const len=v.getUint16(o+2);
      if(marker===0xFFE1&&v.getUint32(o+4)===0x45786966)return exifTiffDate(v,o+10);   // „Exif”
      if(marker===0xFFDA||len<2)return null;                                           // începutul imaginii: fără EXIF
      o+=2+len;
    }
  }catch(e){}
  return null;
}
function exifTiffDate(v,t){
  if(t+8>v.byteLength)return null;
  const le=v.getUint16(t)===0x4949,u16=p=>v.getUint16(p,le),u32=p=>v.getUint32(p,le);
  const readIfd=(off,want)=>{
    const p=t+off,out={};if(p+2>v.byteLength)return out;const n=u16(p);
    for(let i=0;i<n;i++){const e=p+2+i*12;if(e+12>v.byteLength)break;const tag=u16(e);if(!want.includes(tag))continue;
      const type=u16(e+2),cnt=u32(e+4);out[tag]=type===2?{at:cnt<=4?e+8:t+u32(e+8),cnt}:u32(e+8)}
    return out;
  };
  const ifd0=readIfd(u32(t+4),[0x8769,0x0132]);
  let s=null;
  if(ifd0[0x8769]){const ex=readIfd(ifd0[0x8769],[0x9003,0x9004]);s=ex[0x9003]||ex[0x9004]||null}
  s=s||ifd0[0x0132];if(!s||typeof s!=='object')return null;
  let str='';for(let i=0;i<Math.min(19,s.cnt);i++){const p=s.at+i;if(p>=v.byteLength)break;str+=String.fromCharCode(v.getUint8(p))}
  const m=str.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);if(!m||+m[1]<1900)return null;
  const d=new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]).getTime();
  return Number.isFinite(d)?d:null;
}
