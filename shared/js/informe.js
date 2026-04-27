// shared/js/informe.js — Live Informe tab
import { escapeHtml, formatDate, daysBetween } from './utils.js';

const SUBMESA_LABELS_BY_PROVINCE = {
  'Sucumbíos': {
    S1: 'S1 · Gestión Ambiental',
    S2: 'S2 · Agroproductivo',
    S3: 'S3 · Patrimonio Cultural',
    S4: 'S4 · Social',
    S5: 'S5 · Gobernanza',
  },
  'Orellana': {
    S1: 'S1 · Gestión Ambiental',
    S2: 'S2 · Nacionalidades',
    S3: 'S3 · Fomento Productivo',
  },
};

// ── Pure data helper — exported for tests ─────────────────────────────────────

export function computeInformeStats(activities) {
  const total = activities.length;
  const completadas = activities.filter(a => a.estado === 'Completado');
  const atrasadas   = activities.filter(a => a.estado === 'Atrasado');
  const enProgreso  = activities.filter(a =>
    a.estado === 'En progreso' || a.estado.startsWith('Reportada')
  );
  const noIniciadas = activities.filter(a => a.estado === 'No iniciado');
  const pct = total > 0 ? Math.round((completadas.length / total) * 100) : 0;

  // Group completadas by submesa
  const completadasBySubmesa = {};
  for (const a of completadas) {
    const key = a.submesa || 'Mesa';
    if (!completadasBySubmesa[key]) completadasBySubmesa[key] = [];
    completadasBySubmesa[key].push(a);
  }

  // Risk: overdue or has a blocker note
  const riesgo = activities.filter(a =>
    a.estado === 'Atrasado' || (a.notas_bloqueador && a.notas_bloqueador.trim())
  );

  return { total, completadas, atrasadas, enProgreso, noIniciadas, pct, completadasBySubmesa, riesgo };
}

// ── Render ────────────────────────────────────────────────────────────────────

export function renderInforme(mount, { activities, today, provinceLabel }) {
  const labels = SUBMESA_LABELS_BY_PROVINCE[provinceLabel] || SUBMESA_LABELS_BY_PROVINCE['Sucumbíos'];
  const submesaKeys = Object.keys(labels);
  const stats = computeInformeStats(activities);

  mount.innerHTML = `
    <div style="max-width:860px;margin:0 auto">
      ${renderHero(stats, today, provinceLabel)}
      ${renderResumen(stats)}
      ${renderSubmesaAvance(stats, activities, submesaKeys, labels)}
      ${renderCompletadas(stats, submesaKeys, labels)}
      ${renderRiesgo(stats, today)}
      <div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--line);font-size:11px;color:var(--muted);text-align:center">
        Datos en tiempo real · Mesa de Cooperación de ${escapeHtml(provinceLabel)} · Hoja de Ruta 2026–2028
      </div>
    </div>
  `;
}

// ── Section renderers ─────────────────────────────────────────────────────────

function renderHero(stats, today, provinceLabel) {
  const q = `${today.getFullYear()} Q${Math.floor(today.getMonth() / 3) + 1}`;
  return `
    <div style="background:linear-gradient(135deg,var(--primary-dark,#1e3a8a),var(--primary,#1e40af) 60%,var(--primary-accent,#3b82f6));
      color:#fff;border-radius:var(--r-xl,12px);padding:28px 32px;
      display:grid;grid-template-columns:auto 1fr;gap:32px;align-items:center;margin-bottom:20px">
      <div style="text-align:center">
        <div style="font-size:64px;font-weight:800;letter-spacing:-0.04em;line-height:1">${stats.pct}%</div>
        <div style="font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:.1em;margin-top:4px">Avance general</div>
      </div>
      <div>
        <div style="font-size:14px;opacity:.9;font-weight:500;margin-bottom:16px">
          ${stats.completadas.length} de ${stats.total} actividades completadas y verificadas · ${q}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${pill(stats.completadas.length, 'Completadas', false)}
          ${pill(stats.enProgreso.length, 'En progreso', false)}
          ${pill(stats.atrasadas.length, 'Atrasadas', stats.atrasadas.length > 0)}
          ${pill(stats.noIniciadas.length, 'Por iniciar', false)}
        </div>
      </div>
    </div>
  `;
}

function pill(n, label, warn) {
  const bg = warn ? 'rgba(220,38,38,0.35)' : 'rgba(255,255,255,0.18)';
  const border = warn ? 'rgba(220,38,38,0.5)' : 'rgba(255,255,255,0.28)';
  return `<div style="background:${bg};border:1px solid ${border};border-radius:20px;
    padding:7px 14px;display:flex;flex-direction:column;align-items:center;min-width:80px">
    <span style="font-size:22px;font-weight:800;line-height:1.1">${n}</span>
    <span style="font-size:10px;opacity:.8;text-transform:uppercase;letter-spacing:.06em;margin-top:2px">${escapeHtml(label)}</span>
  </div>`;
}

function renderResumen(stats) {
  const cards = [
    { n: stats.completadas.length, l: 'Completadas',  color: 'var(--green,#16a34a)',   bg: 'var(--green-bg,#f0fdf4)' },
    { n: stats.enProgreso.length,  l: 'En progreso',  color: 'var(--primary,#1e40af)', bg: '#eff6ff' },
    { n: stats.atrasadas.length,   l: 'Atrasadas',    color: 'var(--red,#dc2626)',      bg: 'var(--red-bg,#fef2f2)' },
    { n: stats.noIniciadas.length, l: 'No iniciadas', color: 'var(--muted,#6b7280)',    bg: 'var(--line-2,#f1f5f9)' },
  ];
  return `
    <section style="margin-bottom:20px">
      <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:12px">
        Resumen de avance
      </h3>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
        ${cards.map(c => `
          <div style="background:${c.bg};border-radius:10px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:800;color:${c.color};letter-spacing:-0.02em">${c.n}</div>
            <div style="font-size:11px;color:${c.color};font-weight:600;margin-top:4px">${escapeHtml(c.l)}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderSubmesaAvance(stats, activities, submesaKeys, labels) {
  const fillColor = pct => pct >= 60 ? 'var(--green,#16a34a)' : pct >= 30 ? 'var(--amber,#ca8a04)' : 'var(--orange,#ea580c)';

  const cards = submesaKeys.map(key => {
    const acts = activities.filter(a => a.submesa === key);
    const done = acts.filter(a => a.estado === 'Completado').length;
    const late = acts.filter(a => a.estado === 'Atrasado').length;
    const total = acts.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const next = acts.filter(a => a.estado !== 'Completado')
      .sort((a, b) => new Date(a.fecha_limite) - new Date(b.fecha_limite))[0];

    return `
      <div style="background:var(--surface,#fff);border:1px solid var(--line,#e2e8f0);
        border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="font-size:13px;font-weight:700;color:var(--ink)">${escapeHtml(labels[key] || key)}</div>
          <div style="font-size:18px;font-weight:800;color:var(--ink)">${pct}%
            ${late > 0 ? `<span style="font-size:11px;color:var(--red,#dc2626);margin-left:4px">⚠ ${late}</span>` : ''}
          </div>
        </div>
        <div style="height:7px;background:var(--line-2,#f1f5f9);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${fillColor(pct)};border-radius:4px"></div>
        </div>
        <div style="font-size:11px;color:var(--muted)">${done} de ${total} completadas</div>
        ${next ? `<div style="font-size:11px;color:var(--ink-3);border-top:1px solid var(--line-2);padding-top:8px">
          <span style="color:var(--muted);font-size:10px;text-transform:uppercase">Próximo:</span><br>
          ${escapeHtml(next.hito_operativo)}
          <span style="color:var(--muted)"> · ${formatDate(new Date(next.fecha_limite), true)}</span>
        </div>` : ''}
      </div>
    `;
  }).join('');

  return `
    <section style="margin-bottom:20px">
      <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:12px">
        Avance por submesa
      </h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px">
        ${cards}
      </div>
    </section>
  `;
}

function renderCompletadas(stats, submesaKeys, labels) {
  if (stats.completadas.length === 0) {
    return `<section style="margin-bottom:20px">
      <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:12px">
        Actividades completadas y verificadas
      </h3>
      <div style="font-size:13px;color:var(--muted);padding:16px 0">Sin actividades completadas aún.</div>
    </section>`;
  }

  const groups = submesaKeys
    .map(key => ({ key, acts: (stats.completadasBySubmesa[key] || []) }))
    .filter(g => g.acts.length > 0);

  const rows = groups.map(g => `
    <div style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:8px;background:var(--line-2,#f1f5f9);
        border-radius:6px;padding:7px 12px;margin-bottom:8px">
        <span style="font-size:11px;font-weight:700;color:var(--primary)">${escapeHtml(labels[g.key] || g.key)}</span>
        <span style="font-size:11px;color:var(--muted);margin-left:auto">${g.acts.length} actividad${g.acts.length > 1 ? 'es' : ''}</span>
      </div>
      ${g.acts.map(a => `
        <div style="display:grid;grid-template-columns:110px 1fr 110px;gap:12px;
          padding:8px 10px;font-size:12px;border-bottom:1px solid var(--line-2);align-items:center">
          <span style="font-family:monospace;font-size:10px;color:var(--primary);font-weight:600">${escapeHtml(a.id)}</span>
          <span style="color:var(--ink-2);font-weight:500">${escapeHtml(a.hito_operativo)}</span>
          <span style="font-size:11px;color:var(--muted);white-space:nowrap;text-align:right">
            ${a.fecha_reporte ? formatDate(new Date(a.fecha_reporte), true) : '—'}
          </span>
        </div>
      `).join('')}
    </div>
  `).join('');

  return `
    <section style="margin-bottom:20px">
      <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:12px">
        Actividades completadas y verificadas <span style="font-weight:400;color:var(--muted)">(${stats.completadas.length})</span>
      </h3>
      ${rows}
    </section>
  `;
}

function renderRiesgo(stats, today) {
  const header = `
    <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:12px">
      Situaciones de riesgo
    </h3>
  `;
  if (stats.riesgo.length === 0) {
    return `<section style="margin-bottom:20px">${header}
      <div style="display:flex;align-items:center;gap:7px;font-size:13px;color:var(--green-ink,#166534);
        background:var(--green-bg,#f0fdf4);border-radius:6px;padding:10px 14px">
        ✓ Sin actividades en riesgo en este momento.
      </div>
    </section>`;
  }

  const rows = stats.riesgo.map(a => {
    const daysLate = daysBetween(new Date(a.fecha_limite), today);
    const isLate = a.estado === 'Atrasado';
    return `
      <div style="padding:12px 14px;margin-bottom:8px;background:var(--surface,#fff);
        border:1px solid ${isLate ? 'var(--red,#dc2626)' : 'var(--amber,#ca8a04)'};
        border-left-width:3px;border-radius:8px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div>
            <div style="font-size:10px;font-family:monospace;color:var(--primary);font-weight:600">${escapeHtml(a.id)}</div>
            <div style="font-size:13px;font-weight:600;color:var(--ink);margin-top:2px">${escapeHtml(a.hito_operativo)}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:3px">${escapeHtml(a.lidera_apoya)}</div>
          </div>
          ${isLate ? `<div style="font-size:11px;font-weight:700;color:var(--red,#dc2626);white-space:nowrap">
            ⚠ ${daysLate}d de atraso
          </div>` : ''}
        </div>
        ${a.notas_bloqueador ? `<div style="font-size:12px;color:var(--ink-3);margin-top:8px;
          padding-top:8px;border-top:1px solid var(--line-2)">
          <b>Situación:</b> ${escapeHtml(a.notas_bloqueador)}
        </div>` : ''}
      </div>
    `;
  }).join('');

  return `<section style="margin-bottom:20px">${header}${rows}</section>`;
}
