// discover.me — Citirea albumului: fișiere imagine, foldere, chei unice pentru index.
'use strict';

function fileKey(file,path,root){const albumScope=currentAlbumId||root;return `${albumScope}/${path}|${file.size}|${file.lastModified}|${ENGINE_VERSION}|${$('deepScan').checked?'deep':'standard'}`}
function isImage(file){return file&&((file.type||'').startsWith('image/')||/\.(jpe?g|png|webp|bmp|gif|avif|heic|tiff?)$/i.test(file.name||''))}
async function listDirectory(dir,prefix=''){const out=[];for await(const [name,handle] of dir.entries()){if(handle.kind==='file'){if(!/\.(jpe?g|png|webp|bmp|gif|avif|heic|tiff?)$/i.test(name))continue;try{const file=await handle.getFile();out.push({file,path:prefix+name,handle})}catch(e){console.warn('Nu am putut citi',name,e)}}else if(handle.kind==='directory'){const nested=await listDirectory(handle,prefix+name+'/');out.push(...nested)}}return out}
function fallbackAlbumIdentity(files,root){let h=2166136261;const rows=files.map(file=>`${file.webkitRelativePath||file.name}|${file.size}|${file.lastModified}`).sort();for(const row of rows){for(let i=0;i<row.length;i++){h^=row.charCodeAt(i);h=Math.imul(h,16777619)}}return `fallback-${root}-${(h>>>0).toString(16)}`}
