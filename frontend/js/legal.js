'use strict';
// Pagini legale: confidențialitate, cookie-uri, termeni. Se deschid într-o fereastră comună.
(() => {
  const PAGES = {
    privacy: {
      title: 'Politica de confidențialitate',
      html: `
<p>discover.me rulează în browserul tău. Nu are conturi și nu are un server propriu care să primească fotografii sau date despre persoane.</p>
<h4>Ce se prelucrează pe dispozitivul tău</h4>
<ul>
<li>Pozele din album sunt citite direct de pe disc și analizate local. Pozele originale nu sunt modificate sau trimise nicăieri.</li>
<li>Pentru fiecare față se păstrează o amprentă numerică (date biometrice), împreună cu profilurile pe care le creezi. Totul rămâne în spațiul de stocare al browserului (IndexedDB).</li>
<li>Le poți șterge oricând din Setări, la „Ștergere”.</li>
</ul>
<h4>Ce poate ieși din aplicație</h4>
<ul>
<li><b>Abonamente:</b> la plată ești dus pe pagina Lemon Squeezy, care încasează plata și prelucrează datele tale de facturare. Cheia de licență este verificată la Lemon Squeezy; se trimit cheia și un nume al instalării, nu poze.</li>
<li><b>Album din linkuri:</b> pozele se descarcă de la adresele pe care le introduci tu, deci site-urile respective văd cererea.</li>
</ul>
<h4>Drepturile tale</h4>
<p>Datele din aplicație sunt doar la tine și le controlezi complet: le poți vedea, retrage acordul și șterge. Pentru date legate de un abonament (facturare), te poți adresa și Lemon Squeezy. Întrebările despre aplicație se trimit din pagina Feedback.</p>
<p>Folosește aplicația doar pentru persoane care și-au dat acordul sau când ai un motiv legitim (familie, propriile evenimente).</p>`
    },
    cookies: {
      title: 'Cookie-uri și stocare locală',
      html: `
<p><b>discover.me nu folosește cookie-uri</b> și nu are reclame, analiză de trafic sau urmărire.</p>
<p>Aplicația păstrează în browserul tău doar ce îi trebuie ca să funcționeze:</p>
<ul>
<li><b>Stocare locală (localStorage):</b> tema și culoarea, acordul de folosire, planul activ, faptul că ai văzut tutorialul.</li>
<li><b>Stocare de sesiune:</b> o marcă prin care intro-ul nu se repetă în aceeași sesiune.</li>
<li><b>IndexedDB:</b> pregătirea albumului, persoanele salvate și setările de căutare.</li>
<li><b>Memorie cache (service worker):</b> fișierele aplicației și modelele, ca să pornească și fără internet.</li>
</ul>
<p>Sunt necesare funcționării și rămân pe dispozitivul tău; de aceea nu apare un banner de cookie-uri. Le ștergi din Setări sau din setările browserului.</p>
<p>Pagina de plată Lemon Squeezy este un site separat, cu propriile reguli de cookie-uri.</p>`
    },
    terms: {
      title: 'Termeni de utilizare',
      html: `
<ul>
<li>Aplicația este oferită „ca atare”, fără garanția că recunoașterea găsește toate pozele sau nu greșește. Verifică rezultatele înainte să te bazezi pe ele.</li>
<li>Folosești aplicația pe răspunderea ta și doar pentru persoane care și-au dat acordul sau pentru care ai un motiv legitim. Nu o folosi pentru urmărire sau identificare fără știrea persoanelor.</li>
<li>Planul Gratuit are limite (o persoană). Abonamentele Plus și Pro, plătite prin Lemon Squeezy, ridică limita. Anularea, rambursarea și facturarea urmează regulile Lemon Squeezy; la expirare, aplicația revine la Gratuit, iar profilurile rămân salvate.</li>
<li>Codul și aplicația sunt proprietatea autorului, toate drepturile rezervate. Modelele și bibliotecile incluse rămân sub licențele lor (MIT, Apache-2.0).</li>
<li>Termenii pot fi actualizați; varianta curentă este cea din aplicație.</li>
</ul>`
    }
  };

  const dlg = document.getElementById('legalDialog');
  if (!dlg || !dlg.showModal) return;
  const title = document.getElementById('legalTitle'), body = document.getElementById('legalBody');

  function open(key) {
    const p = PAGES[key];
    if (!p) return;
    title.textContent = p.title;
    body.innerHTML = p.html;
    body.scrollTop = 0;
    if (!dlg.open) dlg.showModal();
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-legal]');
    if (b) { e.preventDefault(); open(b.dataset.legal); }
  });
  document.getElementById('legalClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
})();
