// discover.me — Drag & drop: trage un folder (sau poze) oriunde în fereastră ca să devină albumul.
//  • Chrome/Edge: folderul rămâne ținut minte între sesiuni (File System Access).
//  • Firefox/Safari: folderul se citește o singură dată (webkitGetAsEntry), ca la „Alege folderul”.
//  • Poze trase direct (fără folder): devin un album din acele poze.
'use strict';
(function () {
  const overlay = $('dropOverlay'), zone = $('dropZone');
  let depth = 0;

  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  // Nu preluăm tragerea când utilizatorul e într-un dialog sau pe intro.
  const blocked = e => !!(e.target.closest && e.target.closest('dialog[open]')) || (($('intro') && !$('intro').hidden));
  const show = on => { overlay.classList.toggle('on', on); zone?.classList.toggle('drag', on); };

  addEventListener('dragenter', e => { if (!hasFiles(e) || blocked(e)) return; e.preventDefault(); depth++; show(true); });
  addEventListener('dragover', e => { if (!hasFiles(e) || blocked(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  addEventListener('dragleave', e => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) show(false); });
  addEventListener('drop', e => { if (!hasFiles(e) || blocked(e)) { depth = 0; show(false); return; } e.preventDefault(); depth = 0; show(false); handleDrop(e.dataTransfer); });

  function readEntries(reader) { return new Promise((res, rej) => reader.readEntries(res, rej)); }
  const entryFile = entry => new Promise((res, rej) => entry.file(res, rej));
  // Citește recursiv un director (readEntries întoarce rezultatele în loturi, până la lista goală).
  async function walk(dirEntry, prefix, out) {
    const reader = dirEntry.createReader();
    for (;;) {
      const batch = await readEntries(reader);
      if (!batch.length) break;
      for (const en of batch) {
        if (en.isDirectory) await walk(en, prefix + en.name + '/', out);
        else if (/\.(jpe?g|png|webp|bmp|gif|avif|heic|tiff?)$/i.test(en.name)) {
          try { out.push({ file: await entryFile(en), path: prefix + en.name }); } catch (err) { console.warn('Nu am putut citi', en.name, err); }
        }
      }
    }
  }

  async function handleDrop(dt) {
    if (busy) { toast('Pune pregătirea pe pauză înainte să schimbi folderul.'); return; }
    // IMPORTANT: lista de elemente nu mai e validă după primul await, deci cerem tot ce ne trebuie acum.
    const items = [...(dt.items || [])].filter(it => it.kind === 'file');
    const handles = items.map(it => (it.getAsFileSystemHandle ? it.getAsFileSystemHandle().catch(() => null) : Promise.resolve(null)));
    const entries = items.map(it => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null));
    const looseFiles = [...(dt.files || [])];
    try {
      const resolved = await Promise.all(handles);
      const dirHandle = resolved.find(h => h && h.kind === 'directory');
      if (dirHandle) {
        setStatusText(`Citesc folderul „${dirHandle.name}”…`);
        const found = await listDirectory(dirHandle);
        if (!found.length) { toast('Folderul tras nu conține fotografii acceptate.'); return; }
        directoryHandle = dirHandle; currentAlbumName = dirHandle.name || 'Album';
        currentAlbumId = await rememberAlbumHandle(dirHandle, currentAlbumName);
        activeFiles = found;
        await storeDelete('settings', 'lastLinks').catch(() => {});
        await storePut('settings', { id: 'lastAlbum', name: currentAlbumName, handle: directoryHandle, albumId: currentAlbumId });
        afterAlbumLoad(); return;
      }
      const dirEntry = entries.find(en => en && en.isDirectory);
      if (dirEntry) {
        setStatusText(`Citesc folderul „${dirEntry.name}”…`);
        const found = []; await walk(dirEntry, '', found);
        if (!found.length) { toast('Folderul tras nu conține fotografii acceptate.'); return; }
        directoryHandle = null; currentAlbumName = dirEntry.name || 'Album';
        currentAlbumId = fallbackAlbumIdentity(found.map(x => x.file), currentAlbumName);
        activeFiles = found; afterAlbumLoad(); return;
      }
      const images = looseFiles.filter(isImage);
      if (images.length) {
        directoryHandle = null; currentAlbumName = images.length === 1 ? 'Fotografie' : 'Fotografii trase';
        currentAlbumId = fallbackAlbumIdentity(images, 'trase');
        activeFiles = images.map(file => ({ file, path: file.name })); afterAlbumLoad(); return;
      }
      toast('Trage un folder cu fotografii (sau fotografii) aici.');
    } catch (err) {
      console.error(err); toast('Nu am putut citi ce ai tras. Încearcă butonul „Alege folderul”.');
    }
  }
  window.handleAlbumDrop = handleDrop;      // folosit și de teste
})();
