// discover.me — Utilitare de interfață folosite peste tot.
'use strict';

const $=id=>document.getElementById(id);
function toast(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3400)}
function fmt(n){return new Intl.NumberFormat('ro-RO').format(n||0)}
