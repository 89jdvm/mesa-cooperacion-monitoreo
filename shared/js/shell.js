// shared/js/shell.js
// Renders the top bar + tabs + identity widget. Doesn't resolve identity —
// the entry point (dashboard.js) does that and passes `actor` in.

export function renderShell({ province, provinceLabel, actor, activeTab }) {
  const root = document.getElementById('app');
  root.innerHTML = '';
  root.appendChild(renderTop(provinceLabel, actor));
  root.appendChild(renderTabs(activeTab, province));
  const main = document.createElement('main');
  main.className = 'main';
  main.id = 'main-content';
  root.appendChild(main);
  return main;
}

function renderTop(provinceLabel, actor) {
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
      ${actor ? `
        <div class="avatar">${initials(actor.name)}</div>
        <div>
          <div class="nm" style="font-weight:600">${actor.name}</div>
          <div class="rl" style="font-size:11px;color:var(--muted)">${actor.submesa || 'Mesa'}</div>
        </div>
        <a href="#" class="change" data-action="change-actor" style="font-size:11px;color:var(--primary);margin-left:8px;text-decoration:none">Cambiar ▾</a>
      ` : `
        <a href="#" class="change" data-action="pick-actor" style="font-size:12px;color:var(--primary);text-decoration:none">Identificarme</a>
      `}
    </div>
  `;
  return el;
}

function renderTabs(activeTab, province) {
  const el = document.createElement('nav');
  el.className = 'tabs';
  const tabs = ['panel','actividades','mi-trabajo','timeline'];
  const labels = { panel: 'Panel', actividades: 'Actividades', 'mi-trabajo': 'Mi trabajo', timeline: 'Línea de Tiempo' };
  el.innerHTML = tabs.map(t =>
    `<a href="#${t}" class="tab ${t === activeTab ? 'active' : ''}" data-tab="${t}">${labels[t]}</a>`
  ).join('');
  return el;
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
}
