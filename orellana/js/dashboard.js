/* ============================================================
   Mesa de Cooperación — Dashboard Engine
   Reads local JSON, renders UI, filters, modal, Gantt
   ============================================================ */

// ---- State ----
let DATA = [];
let FILTERED = [];
let ACTORS = [];
let QUARTERS = [];
let CURRENT_VIEW = 'resumen';

const QUARTER_LABELS = {
  '2026 Q2': 'Abr–Jun 2026',
  '2026 Q3': 'Jul–Sep 2026',
  '2026 Q4': 'Oct–Dic 2026',
  '2027 Q1': 'Ene–Mar 2027',
  '2027 Q2': 'Abr–Jun 2027',
  '2027 Q3': 'Jul–Sep 2027',
  '2027 Q4': 'Oct–Dic 2027',
  '2028 Q1': 'Ene–Mar 2028'
};

const STATUS_LABELS = {
  'No iniciado': { class: 'no-iniciado', icon: '○' },
  'En progreso': { class: 'en-progreso', icon: '◐' },
  'Completado': { class: 'completado', icon: '●' },
  'Atrasado': { class: 'atrasado', icon: '!' },
  'Reportada — pendiente verificación ST': { class: 'reportado', icon: '◑' }
};

const TIPO_CLASS = {
  'Gestión': 'gestion',
  'Submesa': 'submesa',
  'Sostenibilidad': 'sostenibilidad',
  'Seguimiento': 'seguimiento'
};

// ---- Init ----
async function initDashboard(dataPath) {
  showLoading(true);
  try {
    const resp = await fetch(dataPath);
    DATA = await resp.json();
    computeDerivedState();
    populateFilters();
    applyFilters();
    renderStats();
    bindEvents();
    navigateTo('resumen');
  } catch (e) {
    console.error('Error cargando datos:', e);
    document.getElementById('main-content').innerHTML =
      '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Error al cargar los datos. Verifica que el archivo de datos esté disponible.</p></div>';
  }
  showLoading(false);
}

function computeDerivedState() {
  // Determine status based on dates
  const today = new Date();
  DATA.forEach(a => {
    if (a.estado === 'Completado' || a.estado === 'Reportada — pendiente verificación ST') return;
    if (a.fecha_limite) {
      const deadline = new Date(a.fecha_limite);
      if (today > deadline && a.estado !== 'Completado') {
        a.estado = 'Atrasado';
      }
    }
  });

  // Extract unique NORMALIZED actors and quarters
  const actorSet = new Set();
  const quarterSet = new Set();
  DATA.forEach(a => {
    if (a.actores_normalizados && a.actores_normalizados.length > 0) {
      a.actores_normalizados.forEach(act => actorSet.add(act));
    } else {
      actorSet.add(a.lidera_apoya);
    }
    quarterSet.add(a.trimestre);
  });
  ACTORS = [...actorSet].sort();
  QUARTERS = [...quarterSet].sort();
  FILTERED = [...DATA];
}

// ---- Filters ----
function populateFilters() {
  const actorSelect = document.getElementById('filter-actor');
  const tipoSelect = document.getElementById('filter-tipo');
  const quarterSelect = document.getElementById('filter-quarter');
  const statusSelect = document.getElementById('filter-status');
  const ambitoSelect = document.getElementById('filter-ambito');

  // Actors
  if (actorSelect) {
    actorSelect.innerHTML = '<option value="">Todos los actores</option>';
    ACTORS.forEach(a => {
      actorSelect.innerHTML += `<option value="${escHtml(a)}">${truncate(a, 50)}</option>`;
    });
  }

  // Tipo
  if (tipoSelect) {
    tipoSelect.innerHTML = '<option value="">Todos los tipos</option>';
    ['Gestión', 'Submesa', 'Sostenibilidad', 'Seguimiento'].forEach(t => {
      tipoSelect.innerHTML += `<option value="${t}">${t}</option>`;
    });
  }

  // Quarters
  if (quarterSelect) {
    quarterSelect.innerHTML = '<option value="">Todos los trimestres</option>';
    QUARTERS.forEach(q => {
      quarterSelect.innerHTML += `<option value="${q}">${QUARTER_LABELS[q] || q}</option>`;
    });
  }

  // Status
  if (statusSelect) {
    statusSelect.innerHTML = '<option value="">Todos los estados</option>';
    Object.keys(STATUS_LABELS).forEach(s => {
      statusSelect.innerHTML += `<option value="${s}">${s}</option>`;
    });
  }

  // Ambito
  if (ambitoSelect) {
    const ambitos = [...new Set(DATA.map(a => a.ambito))].filter(a => !a.startsWith('20')).sort();
    ambitoSelect.innerHTML = '<option value="">Todos los ámbitos</option>';
    ambitos.forEach(a => {
      ambitoSelect.innerHTML += `<option value="${escHtml(a)}">${a}</option>`;
    });
  }
}

function applyFilters() {
  const actor = document.getElementById('filter-actor')?.value || '';
  const tipo = document.getElementById('filter-tipo')?.value || '';
  const quarter = document.getElementById('filter-quarter')?.value || '';
  const status = document.getElementById('filter-status')?.value || '';
  const ambito = document.getElementById('filter-ambito')?.value || '';
  const search = (document.getElementById('filter-search')?.value || '').toLowerCase();

  FILTERED = DATA.filter(a => {
    if (actor) {
      const actores = a.actores_normalizados || [a.lidera_apoya];
      if (!actores.includes(actor)) return false;
    }
    if (tipo && a.tipo !== tipo) return false;
    if (quarter && a.trimestre !== quarter) return false;
    if (status && a.estado !== status) return false;
    if (ambito && a.ambito !== ambito) return false;
    if (search) {
      const haystack = (a.hito_operativo + ' ' + a.que_se_hace + ' ' + a.lidera_apoya + ' ' + a.ambito).toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  renderCurrentView();
  renderStats();
}

function clearFilters() {
  document.querySelectorAll('.filter-select').forEach(s => s.value = '');
  const searchEl = document.getElementById('filter-search');
  if (searchEl) searchEl.value = '';
  applyFilters();
}

// ---- Stats ----
function renderStats() {
  const total = FILTERED.length;
  const completed = FILTERED.filter(a => a.estado === 'Completado').length;
  const delayed = FILTERED.filter(a => a.estado === 'Atrasado').length;
  const inProgress = FILTERED.filter(a => a.estado === 'En progreso').length;
  const reported = FILTERED.filter(a => a.estado === 'Reportada — pendiente verificación ST').length;
  const pending = total - completed - delayed - inProgress - reported;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-completed').textContent = completed;
  document.getElementById('stat-delayed').textContent = delayed;
  document.getElementById('stat-pending').textContent = pending + inProgress;

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  document.getElementById('stat-progress-pct').textContent = pct + '%';

  // Progress bar
  const bar = document.getElementById('progress-bar');
  if (bar) {
    const pctCompleted = total > 0 ? (completed / total * 100) : 0;
    const pctInProgress = total > 0 ? (inProgress / total * 100) : 0;
    const pctDelayed = total > 0 ? (delayed / total * 100) : 0;
    const pctPending = 100 - pctCompleted - pctInProgress - pctDelayed;

    bar.innerHTML = '';
    if (pctCompleted > 0)
      bar.innerHTML += `<div class="progress-segment completed" style="width:${pctCompleted}%">${pctCompleted > 8 ? Math.round(pctCompleted) + '%' : ''}</div>`;
    if (pctInProgress > 0)
      bar.innerHTML += `<div class="progress-segment in-progress" style="width:${pctInProgress}%">${pctInProgress > 8 ? Math.round(pctInProgress) + '%' : ''}</div>`;
    if (pctDelayed > 0)
      bar.innerHTML += `<div class="progress-segment delayed" style="width:${pctDelayed}%">${pctDelayed > 8 ? Math.round(pctDelayed) + '%' : ''}</div>`;
    if (pctPending > 0)
      bar.innerHTML += `<div class="progress-segment pending" style="width:${pctPending}%">${pctPending > 8 ? Math.round(pctPending) + '%' : ''}</div>`;
  }
}

// ---- Render Views ----
function renderCurrentView() {
  switch (CURRENT_VIEW) {
    case 'resumen': renderResumen(); break;
    case 'actividades': renderActividades(); break;
    case 'timeline': renderTimeline(); break;
    case 'mi-vista': renderMiVista(); break;
    default: renderResumen();
  }
}

function renderResumen() {
  const container = document.getElementById('main-content');
  if (!container) return;

  // Group by quarter
  let html = '';
  QUARTERS.forEach(q => {
    const items = FILTERED.filter(a => a.trimestre === q);
    if (items.length === 0) return;

    const completed = items.filter(a => a.estado === 'Completado').length;
    const delayed = items.filter(a => a.estado === 'Atrasado').length;
    const label = QUARTER_LABELS[q] || q;

    html += `
      <div class="quarter-section">
        <div class="quarter-header" onclick="toggleQuarter(this)">
          <h3>${q} — ${label}</h3>
          <div class="quarter-stats">
            <span class="qs-badge completed">✓ ${completed}</span>
            ${delayed > 0 ? `<span class="qs-badge delayed">! ${delayed}</span>` : ''}
            <span class="qs-badge pending">${items.length} actividades</span>
          </div>
        </div>
        <div class="quarter-body">
          ${items.map(a => renderActivityCard(a)).join('')}
        </div>
      </div>`;
  });

  if (!html) {
    html = '<div class="empty-state"><div class="empty-icon">🔍</div><p>No se encontraron actividades con los filtros seleccionados.</p></div>';
  }

  container.innerHTML = html;
}

function renderActividades() {
  const container = document.getElementById('main-content');
  if (!container) return;

  if (FILTERED.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>No se encontraron actividades con los filtros seleccionados.</p></div>';
    return;
  }

  let html = '<div class="quarter-body">';
  FILTERED.forEach(a => { html += renderActivityCard(a); });
  html += '</div>';
  container.innerHTML = html;
}

function renderActivityCard(a) {
  const tipoClass = TIPO_CLASS[a.tipo] || 'gestion';
  const statusInfo = STATUS_LABELS[a.estado] || STATUS_LABELS['No iniciado'];
  const isUrgent = a.urgente;

  return `
    <div class="activity-card" onclick="showModal('${a.id}')">
      <div class="activity-stripe ${tipoClass}"></div>
      <div class="activity-content">
        <div class="activity-title">
          ${escHtml(a.hito_operativo)}
          ${isUrgent ? '<span class="urgent-badge">Urgente</span>' : ''}
        </div>
        <div class="activity-desc">${escHtml(truncate(a.que_se_hace, 120))}</div>
        <div class="activity-meta">
          <span class="meta-tag tipo-${tipoClass}">${a.tipo}</span>
          <span class="meta-tag actor">👤 ${escHtml((a.actores_normalizados || [a.lidera_apoya]).join(', '))}</span>
          <span class="meta-tag fecha">📅 ${formatQuarter(a.trimestre)}</span>
          ${a.ambito && !a.ambito.startsWith('20') ? `<span class="meta-tag ambito">${escHtml(a.ambito)}</span>` : ''}
        </div>
      </div>
      <div class="activity-status">
        <span class="status-badge ${statusInfo.class}">${statusInfo.icon} ${a.estado}</span>
      </div>
    </div>`;
}

function renderTimeline() {
  const container = document.getElementById('main-content');
  if (!container) return;

  const months = [];
  for (let y = 2026; y <= 2028; y++) {
    const maxM = y === 2028 ? 3 : 12;
    const startM = y === 2026 ? 4 : 1;
    for (let m = startM; m <= maxM; m++) {
      months.push({ year: y, month: m, label: getMonthShort(m) + ' ' + (y % 100) });
    }
  }

  const colW = 48;
  const labelW = 280;
  const totalW = labelW + months.length * colW;
  const now = new Date();
  const currentMonthIdx = months.findIndex(m => m.year === now.getFullYear() && m.month === (now.getMonth() + 1));

  let html = `<div class="gantt-container" style="min-width:${totalW}px">`;

  // Header
  html += `<div class="gantt-header" style="grid-template-columns: ${labelW}px repeat(${months.length}, ${colW}px)">`;
  html += `<div class="gh-cell" style="text-align:left;padding-left:1rem">Actividad</div>`;
  months.forEach((m, i) => {
    html += `<div class="gh-cell ${i === currentMonthIdx ? 'current' : ''}">${m.label}</div>`;
  });
  html += '</div>';

  // Rows
  FILTERED.forEach(a => {
    const tipoClass = TIPO_CLASS[a.tipo] || 'gestion';
    const qStart = getQuarterStartMonth(a.trimestre);
    const qEnd = getQuarterEndMonth(a.trimestre);

    html += `<div class="gantt-row" style="grid-template-columns: ${labelW}px repeat(${months.length}, ${colW}px)" onclick="showModal('${a.id}')">`;
    html += `<div class="gantt-cell" style="padding:0.4rem 0.6rem;font-size:0.72rem;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${escHtml(truncate(a.hito_operativo, 35))}</div>`;

    months.forEach(m => {
      const mIdx = m.year * 12 + m.month;
      const inRange = mIdx >= qStart && mIdx <= qEnd;
      html += `<div class="gantt-cell">${inRange ? `<div class="gantt-bar ${tipoClass}"></div>` : ''}</div>`;
    });

    html += '</div>';
  });

  html += '</div>';

  // Legend
  html += `<div class="progress-legend" style="margin-top:0.5rem">
    <span><span class="legend-dot" style="background:var(--tipo-gestion)"></span> Gestión</span>
    <span><span class="legend-dot" style="background:var(--tipo-submesa)"></span> Submesa</span>
    <span><span class="legend-dot" style="background:var(--tipo-sostenibilidad)"></span> Sostenibilidad</span>
    <span><span class="legend-dot" style="background:var(--tipo-seguimiento)"></span> Seguimiento</span>
  </div>`;

  container.innerHTML = html;
}

function renderMiVista() {
  const container = document.getElementById('main-content');
  if (!container) return;

  let html = `
    <div class="mi-vista-select">
      <h3>Selecciona tu nombre o rol</h3>
      <p style="color:var(--gray);font-size:0.85rem;margin-bottom:1rem">Verás únicamente las actividades asignadas a ti.</p>
      <select id="mi-vista-actor" class="filter-select" onchange="filterMiVista()">
        <option value="">— Seleccionar actor —</option>
        ${ACTORS.map(a => `<option value="${escHtml(a)}">${escHtml(a)}</option>`).join('')}
      </select>
    </div>
    <div id="mi-vista-content"></div>`;

  container.innerHTML = html;
}

function filterMiVista() {
  const actor = document.getElementById('mi-vista-actor')?.value;
  const content = document.getElementById('mi-vista-content');
  if (!content) return;

  if (!actor) {
    content.innerHTML = '';
    return;
  }

  const items = DATA.filter(a => {
    const actores = a.actores_normalizados || [a.lidera_apoya];
    return actores.includes(actor);
  });

  if (items.length === 0) {
    content.innerHTML = '<div class="empty-state"><p>No hay actividades asignadas a este actor.</p></div>';
    return;
  }

  const completed = items.filter(a => a.estado === 'Completado').length;
  const delayed = items.filter(a => a.estado === 'Atrasado').length;
  const pct = Math.round((completed / items.length) * 100);

  let html = `
    <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr)">
      <div class="stat-card"><div class="stat-label">Total asignadas</div><div class="stat-value">${items.length}</div></div>
      <div class="stat-card green"><div class="stat-label">Completadas</div><div class="stat-value">${completed}</div></div>
      <div class="stat-card red"><div class="stat-label">Atrasadas</div><div class="stat-value">${delayed}</div></div>
      <div class="stat-card blue"><div class="stat-label">Avance</div><div class="stat-value">${pct}%</div></div>
    </div>
    <div class="quarter-body">`;

  items.forEach(a => { html += renderActivityCard(a); });
  html += '</div>';

  content.innerHTML = html;
}

// ---- Modal ----
function showModal(id) {
  const a = DATA.find(x => x.id === id);
  if (!a) return;

  const statusInfo = STATUS_LABELS[a.estado] || STATUS_LABELS['No iniciado'];

  document.getElementById('modal-title').textContent = a.hito_operativo;
  document.getElementById('modal-body-content').innerHTML = `
    <div class="modal-field">
      <div class="field-label">ID</div>
      <div class="field-value" style="font-family:var(--font-mono);font-size:0.8rem">${a.id}</div>
    </div>
    <div class="modal-field">
      <div class="field-label">Estado</div>
      <div class="field-value"><span class="status-badge ${statusInfo.class}">${statusInfo.icon} ${a.estado}</span></div>
    </div>
    <div class="modal-field">
      <div class="field-label">Trimestre</div>
      <div class="field-value">${a.trimestre} — ${QUARTER_LABELS[a.trimestre] || ''}</div>
    </div>
    <div class="modal-field">
      <div class="field-label">Qué se hace</div>
      <div class="field-value">${escHtml(a.que_se_hace)}</div>
    </div>
    <div class="modal-field">
      <div class="field-label">Producto verificable</div>
      <div class="field-value">${escHtml(a.producto_verificable)}</div>
    </div>
    <div class="modal-field">
      <div class="field-label">Evidencia mínima</div>
      <div class="field-value">${escHtml(a.evidencia_minima)}</div>
    </div>
    <div class="modal-field">
      <div class="field-label">Lidera / Apoya</div>
      <div class="field-value">${escHtml(a.lidera_apoya)}</div>
    </div>
    <div class="modal-field">
      <div class="field-label">Tipo</div>
      <div class="field-value"><span class="meta-tag tipo-${TIPO_CLASS[a.tipo] || 'gestion'}">${a.tipo}</span></div>
    </div>
    <div class="modal-field">
      <div class="field-label">Ámbito</div>
      <div class="field-value">${escHtml(a.ambito)}</div>
    </div>
    ${a.enlace_evidencia ? `<div class="modal-field"><div class="field-label">Evidencia adjunta</div><div class="field-value"><a href="${escHtml(a.enlace_evidencia)}" target="_blank">Ver evidencia</a></div></div>` : ''}
    ${a.notas_bloqueador ? `<div class="modal-field"><div class="field-label">Notas / Obstáculo</div><div class="field-value">${escHtml(a.notas_bloqueador)}</div></div>` : ''}
  `;

  document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

// ---- Navigation ----
function navigateTo(view) {
  CURRENT_VIEW = view;

  // Update active nav
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  const activeLink = document.querySelector(`[data-view="${view}"]`);
  if (activeLink) activeLink.classList.add('active');

  // Update header
  const titles = {
    'resumen': 'Resumen General',
    'actividades': 'Todas las Actividades',
    'timeline': 'Línea de Tiempo (24 meses)',
    'mi-vista': 'Mi Vista'
  };
  const subtitles = {
    'resumen': 'Vista por trimestre con estado de cada actividad',
    'actividades': 'Lista completa filtrable de todas las actividades',
    'timeline': 'Visualización Gantt de la hoja de ruta completa',
    'mi-vista': 'Filtra por actor para ver tus responsabilidades'
  };

  document.getElementById('view-title').textContent = titles[view] || '';
  document.getElementById('view-subtitle').textContent = subtitles[view] || '';

  renderCurrentView();
}

function toggleQuarter(el) {
  const body = el.nextElementSibling;
  body.classList.toggle('hidden');
}

// ---- Events ----
function bindEvents() {
  // Filters
  document.querySelectorAll('.filter-select').forEach(s => {
    s.addEventListener('change', applyFilters);
  });

  const search = document.getElementById('filter-search');
  if (search) {
    let debounce;
    search.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(applyFilters, 250);
    });
  }

  // Modal close
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Mobile sidebar
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Close sidebar on nav click (mobile)
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    a.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.remove('open');
    });
  });
}

// ---- Helpers ----
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '…' : str;
}

function formatQuarter(q) {
  return QUARTER_LABELS[q] || q;
}

function getMonthShort(m) {
  return ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][m];
}

function getQuarterStartMonth(q) {
  const match = q.match(/(\d{4})\s*Q(\d)/);
  if (!match) return 0;
  const y = parseInt(match[1]);
  const qn = parseInt(match[2]);
  const m = (qn - 1) * 3 + 1;
  return y * 12 + m;
}

function getQuarterEndMonth(q) {
  const match = q.match(/(\d{4})\s*Q(\d)/);
  if (!match) return 0;
  const y = parseInt(match[1]);
  const qn = parseInt(match[2]);
  const m = qn * 3;
  return y * 12 + m;
}

function showLoading(show) {
  const el = document.getElementById('loading');
  if (el) el.classList.toggle('hidden', !show);
}

function getCurrentQuarter() {
  const now = new Date();
  const y = now.getFullYear();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${y} Q${q}`;
}
