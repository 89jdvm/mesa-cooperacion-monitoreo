// shared/js/timeline.js
// Gantt-like timeline grouped by submesa. Columns = quarters Q2 2026 → Q1 2028.
// Bars position and span by fecha_inicio → fecha_limite, colored by estado.
// Click a row → dispatches open-activity event (caught by activity-modal.js).

const START_YEAR = 2026;
const START_MONTH = 3; // April = Q2 2026 (month index 3)
const QUARTERS = 8;

export function renderTimeline(mount, { activities, today }) {
  const cols = buildQuarterCols();
  const groups = groupBySubmesa(activities);
  const submesaOrder = Object.keys(groups).sort(submesaCompare);

  mount.innerHTML = `
    <div class="timeline-legend">
      <span class="leg"><span class="dot" style="background:var(--green)"></span>Completada</span>
      <span class="leg"><span class="dot" style="background:var(--blue)"></span>En progreso</span>
      <span class="leg"><span class="dot" style="background:#d97706"></span>Verificación</span>
      <span class="leg"><span class="dot" style="background:var(--red)"></span>Atrasada</span>
      <span class="leg"><span class="dot" style="background:var(--muted-2)"></span>Por iniciar</span>
      <span class="leg"><span class="dot" style="background:var(--red);width:2px;height:14px;border-radius:0"></span>Hoy</span>
    </div>
    <div class="timeline">
      <div class="tl-header">
        <div class="tl-label">Actividad</div>
        ${cols.map(c => `<div class="tl-q">${c.label}</div>`).join('')}
      </div>
      <div class="tl-body">
        ${submesaOrder.map(key => renderSubmesaSection(key, groups[key], today)).join('')}
        ${renderTodayLine(today)}
      </div>
    </div>
  `;

  mount.querySelectorAll('.tl-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.dataset.id;
      if (id) window.dispatchEvent(new CustomEvent('open-activity', { detail: { id } }));
    });
  });
}

function buildQuarterCols() {
  const cols = [];
  for (let i = 0; i < QUARTERS; i++) {
    const absMonth = START_MONTH + i * 3;
    const y = START_YEAR + Math.floor(absMonth / 12);
    const qInYear = Math.floor((absMonth % 12) / 3) + 1;
    cols.push({ label: `${y} Q${qInYear}`, year: y, quarter: qInYear });
  }
  return cols;
}

function quarterIndexOf(date) {
  const d = new Date(date);
  const monthsFromStart = (d.getFullYear() - START_YEAR) * 12 + d.getMonth() - START_MONTH;
  const idx = Math.floor(monthsFromStart / 3);
  return clamp(idx, 0, QUARTERS - 1);
}

function fractionalPosition(date) {
  // Returns a value in [0, QUARTERS] representing how far into the timeline `date` lies.
  // Used to place the "today" line.
  const d = new Date(date);
  const monthsFromStart = (d.getFullYear() - START_YEAR) * 12 + d.getMonth() - START_MONTH +
    (d.getDate() - 1) / 30;
  return clamp(monthsFromStart / 3, 0, QUARTERS);
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function groupBySubmesa(activities) {
  const groups = {};
  for (const a of activities) {
    const key = a.submesa || 'Mesa';
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  }
  // Sort each group by fecha_inicio so bars stack chronologically.
  for (const key of Object.keys(groups)) {
    groups[key].sort((x, y) => new Date(x.fecha_inicio) - new Date(y.fecha_inicio));
  }
  return groups;
}

function submesaCompare(a, b) {
  // S1, S2, S3... first, then Mesa, then anything else.
  const orderOf = s => {
    const m = /^S(\d+)/.exec(s);
    if (m) return parseInt(m[1], 10);
    if (s === 'Mesa') return 90;
    return 100;
  };
  return orderOf(a) - orderOf(b);
}

function renderSubmesaSection(submesaKey, acts, today) {
  const done = acts.filter(a => a.estado === 'Completado').length;
  const late = acts.filter(a => a.estado === 'Atrasado').length;
  const pct = acts.length ? Math.round((done / acts.length) * 100) : 0;

  return `
    <div class="tl-submesa-header">
      <div><b>${submesaKey}</b> · ${acts.length} actividades</div>
      <div class="meta">${pct}% completado${late ? ` · ${late} atrasada${late > 1 ? 's' : ''}` : ''}</div>
    </div>
    ${acts.map(a => renderActivityRow(a, today)).join('')}
  `;
}

function renderActivityRow(a, today) {
  const startIdx = quarterIndexOf(a.fecha_inicio || a.fecha_limite);
  const endIdx = quarterIndexOf(a.fecha_limite);
  const span = Math.max(1, endIdx - startIdx + 1);
  const leftPct = (startIdx / QUARTERS) * 100;
  const widthPct = (span / QUARTERS) * 100;
  const cls = estadoClass(a.estado, a.fecha_limite, today);
  const label = a.hito_operativo.length > 40 ? a.hito_operativo.slice(0, 38) + '…' : a.hito_operativo;

  return `
    <div class="tl-row" data-id="${a.id}" title="${escapeHtml(a.hito_operativo)} — ${a.lidera_apoya}">
      <div class="tl-label">
        <span class="id mono">${a.id.replace(/^[A-Z]{3}-/, '')}</span>
        <span class="name">${label}</span>
      </div>
      <div class="tl-grid">
        ${Array.from({ length: QUARTERS }, (_, i) => `<div class="tl-col"></div>`).join('')}
        <div class="tl-bar ${cls}" style="left:${leftPct}%;width:${widthPct}%;">${escapeHtml(a.hito_operativo.slice(0, 36))}</div>
      </div>
    </div>
  `;
}

function renderTodayLine(today) {
  const pos = fractionalPosition(today);
  const pct = (pos / QUARTERS) * 100;
  return `
    <div class="tl-today-line" style="left:calc(260px + ${pct}% - (${pct} / 100 * 260px));">
      <div class="tl-today-label">HOY</div>
    </div>
  `;
}

function estadoClass(estado, fechaLimite, today) {
  if (estado === 'Completado') return 'done';
  if (estado === 'Atrasado') return 'late';
  if (estado === 'Reportada — pendiente verificación ST') return 'verify';
  if (estado === 'En progreso') return 'prog';
  const d = new Date(fechaLimite);
  if (!isNaN(d) && d < today) return 'late';
  return 'pend';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
