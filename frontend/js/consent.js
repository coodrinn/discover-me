// discover.me — Acord de confidențialitate: o singură dată, înainte de a crea primul profil facial.
// Fața unei persoane este dată biometrică; aplicația o procesează doar pe acest dispozitiv, dar utilizatorul
// trebuie să știe că folosirea ei pe fotografii ale altor persoane are reguli (GDPR). Acordul se păstrează local.
'use strict';

const CONSENT_VERSION = 1;
let consentGiven = false;

async function loadConsent() {
  try { const row = await storeGet('settings', 'consent'); consentGiven = !!row && row.v >= CONSENT_VERSION; } catch (e) { consentGiven = false; }
  renderConsentState();
}
function renderConsentState() {
  const el = $('consentState'), btn = $('consentWithdraw');
  if (el) el.textContent = consentGiven ? 'Acord dat' : 'Neconfirmat încă';
  if (btn) btn.hidden = !consentGiven;
}
// Întoarce true dacă utilizatorul a confirmat (acum sau înainte). Altfel false și nu se creează nimic.
function requireConsent() {
  if (consentGiven) return Promise.resolve(true);
  const dlg = $('consentDialog');
  if (!dlg || !dlg.showModal) return Promise.resolve(true);        // browser vechi: nu blocăm utilizatorul
  return new Promise(resolve => {
    const ok = $('consentOk'), no = $('consentNo');
    const done = async (value) => {
      ok.onclick = no.onclick = dlg.oncancel = null;
      if (dlg.open) dlg.close();
      if (value) {
        consentGiven = true;
        try { await storePut('settings', { id: 'consent', v: CONSENT_VERSION, at: Date.now() }); } catch (e) { console.warn('Acordul nu a putut fi salvat', e); }
        renderConsentState();
      }
      resolve(value);
    };
    ok.onclick = () => done(true);
    no.onclick = () => done(false);
    dlg.oncancel = () => done(false);
    dlg.showModal();
  });
}
async function withdrawConsent() {
  consentGiven = false;
  try { await storeDelete('settings', 'consent'); } catch (e) { /* nimic de șters */ }
  renderConsentState();
  toast('Acordul a fost retras. Îl vei confirma din nou la următorul profil creat.');
}
document.addEventListener('DOMContentLoaded', () => { const w = $('consentWithdraw'); if (w) w.onclick = withdrawConsent; });
