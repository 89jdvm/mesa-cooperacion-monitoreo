// shared/js/panel.js
import { formatDate, daysBetween } from './utils.js';
import { topNeedsAttention } from './priority.js';
import { computePodio, computeSubmesaRace, buscanApoyo } from './gamification.js';

export function renderPanel(mount, { activities, today, provinceLabel }) {
  const totals = computeTotals(activities);
  const atencion = topNeedsAttention(activities, today, 5);
  const race = computeSubmesaRace(activities);
  const podio = computePodio(activities, today);
  const apoyo = buscanApoyo(activities).slice(0, 3);
  const proximos = activities
    .filter(a => a.estado !== 'Completado')
    .map(a => ({ a, d: daysBetween(today, new Date(a.fecha_limite)) }))
    .filter(x => x.d >= 0 && x.d <= 30)
    .sort((x, y) => x.d - y.d)
    .slice(0, 5);

  mount.innerHTML = `
    ${renderHero(totals, today)}
    ${renderStatCards(totals)}
    <div class="grid-2">
      ${renderAtencion(atencion, today)}
      <div>
        ${renderSubmesaPanel(race)}
        ${renderProximos(proximos)}
      </div>
    </div>
    ${renderGamificationRow(podio, race, apoyo)}
    ${renderFooter()}
  `;
}

function computeTotals(acts) {
  const t = { total: acts.length, done: 0, progress: 0, late: 0, pending: 0 };
  for (const a of acts) {
    if (a.estado === 'Completado') t.done++;
    else if (a.estado === 'Atrasado') t.late++;
    else if (a.estado === 'En progreso') t.progress++;
    else t.pending++;
  }
  t.pct = t.total ? Math.round((t.done / t.total) * 100) : 0;
  return t;
}

function renderHero(t, today) {
  const bars = Array.from({length: 8}, (_, i) => Math.max(8, (i + 1) * 10 * (t.pct / 70)))
    .map(h => `<div class="b" style="width:100%;background:rgba(255,255,255,0.3);border-radius:2px;height:${h}%"></div>`).join('');
  return `
    <section class="hero">
      <div>
        <div class="pre">Avance global</div>
        <div class="big">${t.pct}%</div>
        <div class="caption">${t.done} de ${t.total} actividades verificadas · Trimestre activo: ${quarterLabel(today)}</div>
        <div style="display:flex;gap:4px;height:32px;align-items:flex-end;margin-top:10px;opacity:0.85">${bars}</div>
      </div>
      <div class="mini-grid">
        <div class="mini"><div class="l">Trimestres restantes</div><div class="n">${quartersRemaining(today)}</div></div>
        <div class="mini"><div class="l">Actividades este Q</div><div class="n">${t.progress}</div></div>
        <div class="mini"><div class="l">Actores activos</div><div class="n">—</div></div>
        <div class="mini"><div class="l">Submesas</div><div class="n">—</div></div>
      </div>
    </section>
  `;
}

function renderStatCards(t) {
  return `
    <div class="cards-4">
      <div class="card-stat warn"><div class="lbl">Atrasadas</div><div class="num">${t.late}</div><div class="foot">Requieren atención</div></div>
      <div class="card-stat"><div class="lbl">En progreso</div><div class="num">${t.progress}</div><div class="foot">Ventana activa</div></div>
      <div class="card-stat"><div class="lbl">Completadas</div><div class="num">${t.done}</div><div class="foot">Verificadas ST</div></div>
      <div class="card-stat"><div class="lbl">Por iniciar</div><div class="num">${t.pending}</div><div class="foot">Próximo Q</div></div>
    </div>
  `;
}

function renderAtencion(items, today) {
  const dotClass = d => d < 0 ? 'red' : d <= 3 ? 'orange' : 'amber';
  const rows = items.map(a => {
    const d = daysBetween(today, new Date(a.fecha_limite));
    return `
      <div class="atn-item" data-id="${a.id}">
        <div class="pill-dot ${dotClass(d)}"></div>
        <div>
          <div style="font-size:13px;font-weight:500">${a.hito_operativo}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px">${a.lidera_apoya}${a.notas_bloqueador ? ' · ' + a.notas_bloqueador : ''}</div>
        </div>
        <div style="text-align:right;font-size:11px;color:var(--muted)">
          <div style="font-weight:700;color:${d < 0 ? 'var(--red)' : 'var(--ink)'}">${d < 0 ? `−${-d} días` : `en ${d} días`}</div>
          <div>${formatDate(new Date(a.fecha_limite), true)}</div>
        </div>
      </div>
    `;
  }).join('');
  return `<section class="panel"><h4>Necesita tu atención <a class="sub" href="#actividades">ver todas →</a></h4>${rows || '<div style="font-size:12px;color:var(--muted)">Nada urgente ahora mismo. ✓</div>'}</section>`;
}

function renderSubmesaPanel(race) {
  const fillColor = pct => pct >= 60 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--orange)';
  const rows = race.map(r => `
    <div class="submesa">
      <div style="display:flex;justify-content:space-between"><div style="font-size:12px;font-weight:600">${r.leader ? '🥇 ' : ''}${r.submesa}</div><div style="font-weight:700">${r.pct}%</div></div>
      <div style="height:6px;background:var(--line-2);border-radius:3px;margin-top:6px;overflow:hidden"><div style="height:100%;width:${r.pct}%;background:${fillColor(r.pct)};border-radius:3px"></div></div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">${r.done} de ${r.total} · ${r.late} atrasadas</div>
    </div>
  `).join('');
  return `<section class="panel"><h4>Avance por Submesa</h4>${rows}</section>`;
}

function renderProximos(items) {
  const rows = items.map(({a, d}) => `
    <div style="display:grid;grid-template-columns:70px 1fr 70px;gap:12px;padding:9px 0;border-top:1px solid var(--line-2);font-size:12px;align-items:center">
      <div style="color:var(--primary);font-weight:700;font-size:11px;text-transform:uppercase">${formatDate(new Date(a.fecha_limite), true)}</div>
      <div>${a.hito_operativo}</div>
      <div style="color:var(--muted);font-size:11px;text-align:right">${a.lidera_apoya.split(/[,(]/)[0].trim()}</div>
    </div>
  `).join('');
  return `<section class="panel" style="margin-top:14px"><h4>Próximos 30 días</h4>${rows || '<div style="font-size:12px;color:var(--muted)">Sin vencimientos próximos.</div>'}</section>`;
}

function renderGamificationRow(podio, race, apoyo) {
  return `<section style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:18px">
    ${renderPodio(podio)}
    ${renderRaceCard(race)}
    ${renderApoyo(apoyo)}
  </section>`;
}

function renderPodio(podio) {
  if (!podio.length) return `<div class="panel"><h4>🏅 Avanzadores del mes</h4><div style="font-size:12px;color:var(--muted)">Aún sin completadas este mes.</div></div>`;
  const medals = ['🥇','🥈','🥉'];
  const items = podio.map((p, i) => `
    <div style="padding:10px 0;border-top:1px solid var(--line-2);display:grid;grid-template-columns:24px 1fr auto;gap:10px;align-items:center">
      <div>${medals[i]}</div>
      <div style="font-size:12px;font-weight:600">${p.actor}</div>
      <div style="font-size:11px;color:var(--muted)"><b style="color:var(--ink);font-size:14px">${p.count}</b> a tiempo</div>
    </div>
  `).join('');
  return `<div class="panel"><h4>🏅 Avanzadores del mes</h4>${items}</div>`;
}

function renderRaceCard(race) {
  return `<div class="panel"><h4>🏁 Submesas en carrera</h4>
    ${race.slice(0,4).map(r => `
      <div style="display:grid;grid-template-columns:1fr 40px;gap:8px;align-items:center;padding:6px 0">
        <div><div style="font-size:12px;font-weight:600">${r.leader ? '👑 ' : ''}${r.submesa}</div>
          <div style="height:6px;background:var(--line-2);border-radius:3px;margin-top:4px;overflow:hidden"><div style="height:100%;width:${r.pct}%;background:var(--primary);border-radius:3px"></div></div></div>
        <div style="font-size:12px;font-weight:700;text-align:right">${r.pct}%</div>
      </div>`).join('')}
  </div>`;
}

function renderApoyo(items) {
  if (!items.length) return `<div class="panel"><h4>🤝 Buscan apoyo</h4><div style="font-size:12px;color:var(--muted)">Sin pendientes. ✓</div></div>`;
  return `<div class="panel"><h4>🤝 Buscan apoyo</h4>
    ${items.map(x => `
      <div style="border-left:3px solid var(--green);padding:4px 0 10px 12px;margin-bottom:8px">
        <div style="font-size:12px;font-weight:600">${x.title}</div>
        <div style="font-size:11px;color:var(--ink-3);margin-top:3px">${x.invitation}</div>
      </div>`).join('')}
  </div>`;
}

function renderFooter() {
  return `<div style="margin-top:18px;display:flex;justify-content:space-between;padding-top:14px;border-top:1px solid var(--line);font-size:11px;color:var(--muted)">
    <div>Datos actualizados automáticamente desde el Google Sheet</div>
    <div>Exportar CSV · Exportar PDF</div>
  </div>`;
}

function quarterLabel(d) {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()} Q${q}`;
}
function quartersRemaining(d) {
  const end = new Date(2028, 2, 31); // Q1 2028
  const months = (end.getFullYear() - d.getFullYear()) * 12 + (end.getMonth() - d.getMonth());
  return Math.max(0, Math.ceil(months / 3));
}
