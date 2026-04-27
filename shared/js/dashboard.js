// shared/js/dashboard.js — entry point
import { resolveActorFromBrowser, clearIdentityFromBrowser } from './identity.js';
import { renderShell } from './shell.js';
import { renderPanel } from './panel.js';
import { renderActividades } from './actividades.js';
import { renderMiTrabajo } from './mi-trabajo.js';
import { renderTimeline } from './timeline.js';
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
  activities.forEach(a => { if (!a.submesa || a.submesa === 'Mesa') a.submesa = inferSubmesa(a); });

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
    else if (state.tab === 'actividades') renderActividades(main, { activities, today, provinceLabel });
    else if (state.tab === 'mi-trabajo') renderMiTrabajo(main, { activities, actor, today, formUrl });
    else if (state.tab === 'timeline') renderTimeline(main, { activities, today });
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

export function inferSubmesa(a) {
  const text = (a.lidera_apoya || '').toLowerCase();

  // Orellana submesas
  if (a.provincia === 'Orellana') {
    if (text.includes('gestión ambiental')) return 'S1';
    if (text.includes('nacionalidades')) return 'S2';
    if (text.includes('fomento productivo')) return 'S3';
  }

  // Sucumbíos submesas
  if (a.provincia === 'Sucumbíos') {
    if (text.includes('gestión ambiental')) return 'S1';
    if (text.includes('corposucumbíos') || text.includes('corposucumbios')) return 'S2';
    if (text.includes('nacionalidades y turismo')) return 'S3';
    if (text.includes('sucumbíos solidario') || text.includes('sucumbios solidario')) return 'S4';
    if (text.includes('planificación') || text.includes('planificacion')) return 'S5';
  }

  // Explicit Sn in text
  const m = /\bS(\d+)\b/.exec(a.lidera_apoya || '');
  if (m) return `S${m[1]}`;

  return 'Mesa';
}
