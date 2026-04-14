// shared/js/dashboard.js — entry point
import { resolveActorFromBrowser, IDENTITY_STORAGE_KEY } from './identity.js';
import { renderShell } from './shell.js';
import { renderPanel } from './panel.js';
import { renderActividades } from './actividades.js';
import { renderMiTrabajo } from './mi-trabajo.js';
import { showPicker } from './identity-picker.js';
import { initActivityModal } from './activity-modal.js';
import { fetchJSON, slugify } from './utils.js';

const TABS = ['panel', 'actividades', 'mi-trabajo', 'timeline'];

export async function initDashboard({ dataUrl, actorsUrl, logUrl, province, provinceLabel }) {
  const app = document.getElementById('app');
  app.innerHTML = '<div style="padding:60px;text-align:center;color:var(--muted)">Cargando…</div>';

  const [activities, actors] = await Promise.all([
    fetchJSON(dataUrl),
    loadActors(actorsUrl, province)
  ]);
  activities.forEach(a => { if (!a.submesa) a.submesa = inferSubmesa(a); });

  let actor = resolveActorFromBrowser(actors);

  const state = { tab: currentTab() };

  const paint = async () => {
    const main = renderShell({ province, provinceLabel, actor, activeTab: state.tab });
    if (state.tab === 'mi-trabajo' && !actor) {
      const picked = await showPicker(actors);
      if (!picked) { state.tab = 'panel'; history.replaceState(null, '', '#panel'); return paint(); }
      actor = picked;
      return paint();
    }
    const today = new Date();
    if (state.tab === 'panel') renderPanel(main, { activities, today, provinceLabel });
    else if (state.tab === 'actividades') renderActividades(main, { activities, today });
    else if (state.tab === 'mi-trabajo') renderMiTrabajo(main, { activities, actor, today });
    else main.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Línea de Tiempo — próximamente.</div>';
  };

  app.addEventListener('click', e => {
    const tabEl = e.target.closest('[data-tab]');
    if (tabEl) { state.tab = tabEl.dataset.tab; history.replaceState(null, '', '#' + state.tab); paint(); return; }
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'change-actor' || action === 'pick-actor') {
      showPicker(actors).then(a => { if (a) { actor = a; paint(); } });
    }
  });

  window.addEventListener('hashchange', () => {
    state.tab = currentTab(); paint();
  });

  initActivityModal({ activities, actor, logUrl });
  paint();
}

function currentTab() {
  const h = (location.hash || '#panel').slice(1);
  return TABS.includes(h) ? h : 'panel';
}

async function loadActors(url, province) {
  if (!url) return [];
  const text = await fetch(url).then(r => r.text());
  return text.trim().split('\n').slice(1).map(line => {
    const [name, email, rol, prov] = line.split(',').map(x => x.trim());
    return { name, email, rol, provincia: prov, slug: slugify(name), submesa: rol };
  }).filter(a => a.provincia === province);
}

function inferSubmesa(a) {
  const m = /S(\d+)/.exec(a.lidera_apoya || '');
  return m ? `S${m[1]}` : 'Mesa';
}
