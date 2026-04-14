// shared/js/dashboard.js — entry point
import { resolveActorFromBrowser, clearIdentityFromBrowser } from './identity.js';
import { renderShell } from './shell.js';
import { renderPanel } from './panel.js';
import { renderActividades } from './actividades.js';
import { renderMiTrabajo } from './mi-trabajo.js';
import { initActivityModal } from './activity-modal.js';
import { fetchJSON, slugify } from './utils.js';

const TABS = ['panel', 'actividades', 'mi-trabajo', 'timeline'];

export async function initDashboard({ dataUrl, actorsUrl, logUrl, formUrl, province, provinceLabel }) {
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
    // Gate Mi trabajo tab: anonymous visitors can't access it.
    if (state.tab === 'mi-trabajo' && !actor) {
      state.tab = 'panel';
      history.replaceState(null, '', '#panel');
    }

    const main = renderShell({ province, provinceLabel, actor, activeTab: state.tab });
    const today = new Date();

    if (state.tab === 'panel') renderPanel(main, { activities, today, provinceLabel });
    else if (state.tab === 'actividades') renderActividades(main, { activities, today });
    else if (state.tab === 'mi-trabajo') renderMiTrabajo(main, { activities, actor, today, formUrl });
    else main.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Línea de Tiempo — próximamente.</div>';
  };

  app.addEventListener('click', e => {
    const tabEl = e.target.closest('[data-tab]');
    if (tabEl) {
      e.preventDefault();
      state.tab = tabEl.dataset.tab;
      history.replaceState(null, '', '#' + state.tab);
      paint();
      return;
    }
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'logout') {
      e.preventDefault();
      clearIdentityFromBrowser();
      actor = null;
      // Strip actor/token from URL so the page stays anonymous on reload
      const clean = new URL(window.location.href);
      clean.searchParams.delete('actor');
      clean.searchParams.delete('token');
      history.replaceState(null, '', clean.pathname + clean.hash);
      state.tab = 'panel';
      history.replaceState(null, '', '#panel');
      paint();
    }
  });

  window.addEventListener('hashchange', () => {
    state.tab = currentTab();
    paint();
  });

  initActivityModal({ activities, actor, logUrl, formUrl });
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
    const cells = line.split(',').map(x => x.trim());
    const [name, email, rol, prov, token] = cells;
    return { name, email, rol, provincia: prov, token: token || '', slug: slugify(name), submesa: rol };
  }).filter(a => a.provincia === province);
}

function inferSubmesa(a) {
  const m = /S(\d+)/.exec(a.lidera_apoya || '');
  return m ? `S${m[1]}` : 'Mesa';
}
