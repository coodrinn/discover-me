// Test în browser: drag & drop de folder (handle Chrome, webkitGetAsEntry) și de poze, overlay, folder gol. Rulare: npm run test:e2e:drop
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const APP=path.join(__dirname,'..','..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);fs.readFile(path.join(APP,u==='/'?'index.html':u),(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':types[path.extname(u==='/'?'/index.html':u)]||'application/octet-stream'});r.end(d)})}).listen(0);
(async()=>{
 const b=await puppeteer.launch({executablePath:[process.env.BROWSER,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean).find(fs.existsSync),headless:'new',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const page=await b.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>m.type()==='error'&&errs.push(m.text()));
 await page.goto(`http://localhost:${server.address().port}/`,{waitUntil:'load'});
 await page.waitForFunction(()=>typeof engineReady!=='undefined'&&engineReady,{timeout:120000});
 // dezactivează indexarea automată ca să măsurăm doar încărcarea albumului
 await page.evaluate(()=>{window.autoIndex=()=>{}});
 const out=await page.evaluate(async()=>{
  const r={};r.introWasOpen=!document.getElementById('intro').hidden;document.getElementById('intro').hidden=true;const jpg=n=>new File([new Uint8Array([0xFF,0xD8,0xFF,0xD9])],n,{type:'image/jpeg'});
  const reset=()=>{activeFiles=[];currentAlbumName='';directoryHandle=null};
  // 1) overlay la tragere reală de fișiere
  const dt=new DataTransfer();dt.items.add(jpg('a.jpg'));
  window.dispatchEvent(new DragEvent('dragenter',{dataTransfer:dt,bubbles:true,cancelable:true}));
  r.overlayOn=document.getElementById('dropOverlay').classList.contains('on');
  window.dispatchEvent(new DragEvent('dragleave',{dataTransfer:dt,bubbles:true}));
  r.overlayOff=!document.getElementById('dropOverlay').classList.contains('on');
  // 2) drop real de poze (DataTransfer real)
  const dt2=new DataTransfer();dt2.items.add(jpg('x1.jpg'));dt2.items.add(jpg('x2.jpg'));dt2.items.add(new File(['t'],'note.txt',{type:'text/plain'}));
  reset();window.dispatchEvent(new DragEvent('drop',{dataTransfer:dt2,bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,500));
  r.loose={name:currentAlbumName,files:activeFiles.length,overlay:document.getElementById('dropOverlay').classList.contains('on')};
  // 3) folder prin webkitGetAsEntry (Firefox/Safari): subfoldere, loturi, fișiere ne-imagine
  const fileEntry=n=>({isDirectory:false,isFile:true,name:n,file:(ok)=>ok(jpg(n))});
  const dirEntry=(n,kids)=>({isDirectory:true,name:n,createReader(){let i=0;return{readEntries:(ok)=>{const b=kids.slice(i,i+2);i+=2;ok(b)}}}});
  const tree=dirEntry('Vacanta',[fileEntry('1.jpg'),fileEntry('2.png'),fileEntry('readme.txt'),dirEntry('Ziua2',[fileEntry('3.jpg'),fileEntry('4.heic'),fileEntry('5.jpg')])]);
  reset();await handleAlbumDrop({items:[{kind:'file',webkitGetAsEntry:()=>tree}],files:[]});
  r.entry={name:currentAlbumName,files:activeFiles.length,paths:activeFiles.map(x=>x.path).sort(),handle:!!directoryHandle};
  // 4) folder prin File System Access handle (Chrome/Edge)
  const fh=n=>({kind:'file',name:n,getFile:async()=>jpg(n)});
  const dh={kind:'directory',name:'AlbumChrome',entries:async function*(){yield['a.jpg',fh('a.jpg')];yield['b.jpg',fh('b.jpg')];yield['sub',{kind:'directory',name:'sub',entries:async function*(){yield['c.jpg',fh('c.jpg')]}}]}};
  reset();const _put=storePut;storePut=async()=>{};
  await handleAlbumDrop({items:[{kind:'file',getAsFileSystemHandle:async()=>dh}],files:[]}).catch(e=>r.err=String(e));
  storePut=_put;r.handle={name:currentAlbumName,files:activeFiles.length,hasHandle:directoryHandle===dh};
  // 5) folder gol -> mesaj, albumul anterior rămâne
  const before=activeFiles.length;
  await handleAlbumDrop({items:[{kind:'file',webkitGetAsEntry:()=>dirEntry('Gol',[])}],files:[]});
  r.empty={kept:activeFiles.length===before,toast:document.getElementById('toast').textContent};
  return r;
 });
 console.log(JSON.stringify(out,null,1));
 console.log('errors:',errs.length?errs:'none');
 await b.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
