// shared/js/shell.js
// Renders the top bar + tabs + identity widget. Doesn't resolve identity —
// the entry point (dashboard.js) does that and passes `actor` in.
//
// Tabs visible to anonymous visitors: Panel, Actividades, Línea de Tiempo.
// Mi trabajo tab only appears once an actor is identified (via ?actor=X&token=Y).
import { actorBaseName } from './utils.js';

export function renderShell({ province, provinceLabel, actor, activeTab }) {
  const root = document.getElementById('app');
  root.innerHTML = '';
  root.appendChild(renderTop(provinceLabel, actor, activeTab));
  root.appendChild(renderTabs(activeTab, actor));
  const main = document.createElement('main');
  main.className = 'main';
  main.id = 'main-content';
  root.appendChild(main);
  return main;
}

function renderTop(provinceLabel, actor, activeTab) {
  // Show actor identity only in Mi trabajo — public tabs show "Vista pública"
  const showActor = actor && activeTab === 'mi-trabajo';
  const el = document.createElement('div');
  el.className = 'frame-top';
  el.innerHTML = `
    <div class="brand">
      <div class="dot"></div>
      <div>
        <div class="name">Mesa de Cooperación de ${provinceLabel}</div>
        <div class="sub">Hoja de Ruta 2026–2028</div>
      </div>
    </div>
    <div class="whoami">
      ${showActor ? `
        <div class="avatar">${initials(actor.name)}</div>
        <div>
          <div class="nm" style="font-weight:600">${actorBaseName(actor.name)}</div>
          <div class="rl" style="font-size:11px;color:var(--muted)">${actor.submesa || 'Mesa'}</div>
        </div>
        <a href="#" class="change" data-action="logout" style="font-size:11px;color:var(--muted);margin-left:8px;text-decoration:none">Cerrar sesión</a>
      ` : `
        <div style="font-size:11px;color:var(--muted)">Vista pública</div>
      `}
    </div>
  `;
  return el;
}

function renderTabs(activeTab, actor) {
  const el = document.createElement('nav');
  el.className = 'tabs';
  const allTabs = [
    { key: 'panel', label: 'Panel', requires: null },
    { key: 'actividades', label: 'Actividades', requires: null },
    { key: 'mi-trabajo', label: 'Mi trabajo', requires: 'actor' },
    { key: 'timeline', label: 'Línea de Tiempo', requires: null },
    { key: 'informe', label: 'Informe', requires: null }
  ];
  const visible = allTabs.filter(t => !t.requires || (t.requires === 'actor' && actor));
  el.innerHTML = visible.map(t =>
    `<a href="#${t.key}" class="tab ${t.key === activeTab ? 'active' : ''}" data-tab="${t.key}">${t.label}</a>`
  ).join('');
  return el;
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
}
