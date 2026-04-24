// shared/js/panel.js — public dashboard, no personal information
import { formatDate, daysBetween } from './utils.js';
import { computeSubmesaRace } from './gamification.js';

export function renderPanel(mount, { activities, today, provinceLabel }) {
  const totals = computeTotals(activities);
  const race   = computeSubmesaRace(activities);
  const proximos = upcomingBySubmesa(activities, today);

  mount.innerHTML = `
    ${renderHero(totals, today, provinceLabel)}
    ${renderSubmesaCards(race, activities, today)}
    ${renderProximos(proximos)}
    ${renderFooter()}
  `;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function computeTotals(acts) {
  const t = { total: acts.length, done: 0, progress: 0, late: 0, pending: 0 };
  for (const a of acts) {
    if (a.estado === 'Completado')   t.done++;
    else if (a.estado === 'Atrasado') t.late++;
    else if (a.estado === 'En progreso') t.progress++;
    else t.pending++;
  }
  t.pct = t.total ? Math.round((t.done / t.total) * 100) : 0;
  return t;
}

function upcomingBySubmesa(acts, today) {
  // Next pending/in-progress activity per submesa, sorted by fecha_limite
  const bySubmesa = new Map();
  for (const a of acts) {
    if (a.estado === 'Completado') continue;
    const key = a.submesa || 'Mesa';
    const d   = daysBetween(today, new Date(a.fecha_limite));
    const cur = bySubmesa.get(key);
    if (!cur || d < cur.d) bySubmesa.set(key, { a, d });
  }
  return [...bySubmesa.entries()]
    .sort((x, y) => x[1].d - y[1].d)
    .slice(0, 5);
}

// ── render ────────────────────────────────────────────────────────────────────

function renderHero(t, today, provinceLabel) {
  const barH = i => Math.max(8, Math.round(10 + i * (t.pct / 12)));
  const bars = Array.from({length: 8}, (_, i) =>
    `<div style="flex:1;background:rgba(255,255,255,0.35);border-radius:2px;height:${barH(i)}%"></div>`
  ).join('');

  return `
    <section class="hero">
      <div>
        <div class="pre">Avance global — Hoja de Ruta 2026–2028</div>
        <div class="big">${t.pct}%</div>
        <div class="caption">${t.done} de ${t.total} actividades completadas y verificadas · ${quarterLabel(today)}</div>
        <div style="display:flex;gap:3px;height:28px;align-items:flex-end;margin-top:12px;opacity:0.8">${bars}</div>
      </div>
      <div class="mini-grid">
        <div class="mini"><div class="l">Completadas</div><div class="n">${t.done}</div></div>
        <div class="mini"><div class="l">En progreso</div><div class="n">${t.progress}</div></div>
        <div class="mini"><div class="l">Por iniciar</div><div class="n">${t.pending}</div></div>
        <div class="mini"><div class="l">Submesas</div><div class="n">5</div></div>
      </div>
    </section>
  `;
}

function renderSubmesaCards(race, activities, today) {
  const SUBMESA_LABELS = {
    S1: 'S1 · Ambiental',
    S2: 'S2 · Agroproductivo',
    S3: 'S3 · Patrimonio',
    S4: 'S4 · Social',
    S5: 'S5 · Gobernanza',
  };

  const fillColor = pct => pct >= 60 ? 'var(--green)' : pct >= 30 ? 'var(--amber)' : 'var(--orange)';

  const submesaActs = submesa => activities.filter(a => a.submesa === submesa);

  // Only S1–S5
  const rows = ['S1','S2','S3','S4','S5'].map(key => {
    const r   = race.find(x => x.submesa === key) || { pct: 0, done: 0, total: 0, late: 0 };
    const acts = submesaActs(key);
    const next = acts
      .filter(a => a.estado !== 'Completado')
      .sort((a, b) => new Date(a.fecha_limite) - new Date(b.fecha_limite))[0];
    const label = SUBMESA_LABELS[key] || key;

    const nextHtml = next
      ? `<div style="font-size:12px;color:var(--muted);margin-top:8px;line-height:1.4">
           <span style="font-weight:600;color:var(--ink-2)">Próximo hito:</span>
           ${next.hito_operativo}
           <span style="color:var(--muted)"> · ${formatDate(new Date(next.fecha_limite), true)}</span>
         </div>`
      : `<div style="font-size:12px;color:var(--green);margin-top:8px">✓ Sin pendientes próximos</div>`;

    const lateHtml = r.late > 0
      ? `<span style="color:var(--red);font-weight:600;font-size:11px;margin-left:8px">⚠ ${r.late} atrasada${r.late > 1 ? 's' : ''}</span>`
      : '';

    return `
      <div class="panel" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-size:14px;font-weight:700;color:var(--ink)">${label}</div>
          <div style="font-size:16px;font-weight:800;color:var(--ink)">${r.pct}%${lateHtml}</div>
        </div>
        <div style="height:8px;background:var(--line-2);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${r.pct}%;background:${fillColor(r.pct)};border-radius:4px;transition:width 0.4s"></div>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px">${r.done} de ${r.total} actividades completadas</div>
        ${nextHtml}
      </div>
    `;
  }).join('');

  return `
    <div style="margin:20px 0 4px">
      <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted);margin-bottom:14px">Avance por Submesa</h3>
      ${rows}
    </div>
  `;
}

function renderProximos(items) {
  if (!items.length) return '';
  const SUBMESA_LABELS = { S1:'S1 Ambiental', S2:'S2 Agroproductivo', S3:'S3 Patrimonio', S4:'S4 Social', S5:'S5 Gobernanza' };
  const rows = items.map(([submesa, {a, d}]) => {
    const late = d < 0;
    return `
      <div style="display:grid;grid-template-columns:100px 1fr 80px;gap:12px;padding:10px 0;border-top:1px solid var(--line-2);align-items:center">
        <div style="font-size:11px;font-weight:700;color:var(--primary);text-transform:uppercase">${SUBMESA_LABELS[submesa] || submesa}</div>
        <div style="font-size:13px;color:var(--ink)">${a.hito_operativo}</div>
        <div style="text-align:right;font-size:11px;font-weight:700;color:${late ? 'var(--red)' : 'var(--muted)'}">
          ${late ? `−${-d}d` : `en ${d}d`}<br>
          <span style="font-weight:400">${formatDate(new Date(a.fecha_limite), true)}</span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <section class="panel" style="margin-top:8px">
      <h4>Próximos vencimientos por Submesa</h4>
      ${rows}
    </section>
  `;
}

function renderFooter() {
  return `
    <div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--line);font-size:11px;color:var(--muted);text-align:center">
      Datos actualizados desde el Google Sheet de seguimiento · Mesa de Cooperación de Sucumbíos
    </div>
  `;
}

function quarterLabel(d) {
  return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`;
}
