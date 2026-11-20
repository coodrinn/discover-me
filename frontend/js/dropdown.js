// discover.me — Liste derulante proprii (rotunjite, în culoarea de accent aleasă de utilizator).
// <select>-ul real rămâne în pagină (ascuns): restul aplicației îi citește și îi scrie `value` și ascultă `change`, ca înainte.
// Fereastra nativă a unui <select> e desenată de sistem (pătrată, fără culori proprii); aici o înlocuim doar vizual.
'use strict';
(function () {
  const CHEVRON = '<svg class="dd-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>';
  const CHECK = '<svg class="dd-check" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  const valueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  let openDd = null, uid = 0;

  function closeAll(focusBtn) { if (openDd) openDd.close(focusBtn); }
  document.addEventListener('pointerdown', e => { if (openDd && !openDd.wrap.contains(e.target)) closeAll(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openDd) { e.stopPropagation(); closeAll(true); } }, true);
  addEventListener('resize', () => closeAll(false));
  addEventListener('scroll', () => { if (openDd && !openDd.list.contains(document.activeElement)) closeAll(false); }, { passive: true, capture: true });

  function enhance(sel) {
    if (!sel || sel.dataset.dd) return;
    sel.dataset.dd = '1';
    const id = 'dd' + (++uid);
    const wrap = document.createElement('div'); wrap.className = 'dd ' + (sel.dataset.ddClass || '');
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'dd-btn';
    btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', id);
    const label = sel.getAttribute('aria-label') || (sel.id && document.querySelector(`label[for="${sel.id}"]`)?.textContent) || '';
    if (label) btn.setAttribute('aria-label', label.trim());
    const text = document.createElement('span'); text.className = 'dd-text';
    btn.append(text); btn.insertAdjacentHTML('beforeend', CHEVRON);
    const list = document.createElement('ul'); list.className = 'dd-list'; list.id = id; list.setAttribute('role', 'listbox'); list.hidden = true; list.tabIndex = -1;
    wrap.append(btn, list);
    sel.before(wrap); wrap.append(sel); sel.classList.add('dd-native'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');

    const items = () => [...list.children];
    function build() {
      list.replaceChildren();
      [...sel.options].forEach((o, i) => {
        const li = document.createElement('li'); li.setAttribute('role', 'option'); li.dataset.value = o.value; li.dataset.i = i; li.id = id + '-' + i;
        li.innerHTML = '<span class="dd-opt-text"></span>' + CHECK; li.firstChild.textContent = o.textContent;
        list.append(li);
      });
      sync();
    }
    function sync() {
      const cur = sel.selectedOptions[0]; text.textContent = cur ? cur.textContent : '';
      items().forEach(li => { const on = li.dataset.value === sel.value; li.setAttribute('aria-selected', String(on)); li.classList.toggle('on', on); });
      btn.disabled = sel.disabled;
    }
    // Când restul aplicației schimbă `value` din cod, eticheta se actualizează.
    Object.defineProperty(sel, 'value', { configurable: true, get() { return valueDesc.get.call(this); }, set(v) { valueDesc.set.call(this, v); sync(); } });
    sel.addEventListener('change', sync);
    new MutationObserver(build).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });

    let active = -1;
    function setActive(i) {
      const li = items(); if (!li.length) return; active = Math.max(0, Math.min(li.length - 1, i));
      li.forEach((x, k) => x.classList.toggle('act', k === active));
      list.setAttribute('aria-activedescendant', li[active].id); li[active].scrollIntoView({ block: 'nearest' });
    }
    function place() {
      list.style.left = list.style.right = list.style.top = list.style.bottom = '';
      const r = btn.getBoundingClientRect(), lw = list.offsetWidth, lh = list.offsetHeight, vw = innerWidth, vh = innerHeight;
      // sub buton dacă încape, altfel deasupra; aliniat la dreapta dacă ar ieși din ecran
      if (r.bottom + lh + 10 > vh - 80 && r.top > lh + 10) { list.style.bottom = 'calc(100% + 6px)'; wrap.classList.add('up'); } else { list.style.top = 'calc(100% + 6px)'; wrap.classList.remove('up'); }
      if (r.left + lw > vw - 8) list.style.right = '0'; else list.style.left = '0';
    }
    function open() {
      if (sel.disabled) return; closeAll(false);
      list.hidden = false; btn.setAttribute('aria-expanded', 'true'); wrap.classList.add('open'); place();
      const cur = items().findIndex(x => x.dataset.value === sel.value); setActive(cur < 0 ? 0 : cur); list.focus({ preventScroll: true });
      openDd = api;
    }
    function close(focusBtn) {
      list.hidden = true; btn.setAttribute('aria-expanded', 'false'); wrap.classList.remove('open');
      if (openDd === api) openDd = null; if (focusBtn) btn.focus();
    }
    function choose(i) {
      const li = items()[i]; if (!li) return;
      const changed = sel.value !== li.dataset.value; valueDesc.set.call(sel, li.dataset.value); sync(); close(true);
      if (changed) sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const api = { wrap, list, close };
    btn.addEventListener('click', () => (list.hidden ? open() : close(true)));
    btn.addEventListener('keydown', e => { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); open(); } });
    list.addEventListener('click', e => { const li = e.target.closest('li'); if (li) choose(+li.dataset.i); });
    list.addEventListener('pointermove', e => { const li = e.target.closest('li'); if (li) setActive(+li.dataset.i); });
    list.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
      else if (e.key === 'End') { e.preventDefault(); setActive(items().length - 1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
      else if (e.key === 'Tab') close(false);
    });
    build();
  }

  const init = () => document.querySelectorAll('select[data-dd-auto]').forEach(enhance);
  window.enhanceDropdown = enhance;
  init();
})();
