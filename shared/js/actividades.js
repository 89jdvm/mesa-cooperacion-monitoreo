// shared/js/actividades.js
import { formatDate, daysBetween, exportCsv } from './utils.js';

export function renderActividades(mount, { activities, today, provinceLabel = '' }) {
  const state = { filter: 'todas', search: '' };

  // Single delegated listener on mount — avoids re-attaching on every paint().
  mount.addEventListener('click', e => {
    const pill = e.target.closest('.pill, [data-filter]');
    if (pill) { e.preventDefault(); state.filter = pill.dataset.filter; paint(); return; }
    if (e.target.closest('.btn-export-csv')) { exportCsv(filter(), state.filter, provinceLabel); return; }
    const row = e.target.closest('.tbl .row');
    if (row) window.dispatchEvent(new CustomEvent('open-activity', { detail: { id: row.dataset.id } }));
  });
  mount.addEventListener('input', e => {
    if (e.target.id === 'act-search') { state.search = e.target.value; paint(); }
  });

  const filter = () => {
    const txt = state.search.toLowerCase();
    return activities.filter(a => {
      if (state.filter === 'atrasadas' && a.estado !== 'Atrasado') return false;
      if (state.filter === 'verificar' && a.estado !== 'Reportada — pendiente verificación ST') return false;
      if (state.filter === 'mes') {
        const d = daysBetween(today, new Date(a.fecha_limite));
        if (d < 0 || d > 30) return false;
      }
      if (txt && !(a.id + ' ' + a.hito_operativo + ' ' + a.lidera_apoya).toLowerCase().includes(txt)) return false;
      return true;
    });
  };

  const paint = () => {
    const verifyCount = activities.filter(a => a.estado === 'Reportada — pendiente verificación ST').length;
    const lateCount = activities.filter(a => a.estado === 'Atrasado').length;
    const monthCount = activities.filter(a => {
      const d = daysBetween(today, new Date(a.fecha_limite));
      return d >= 0 && d <= 30;
    }).length;
    const rows = filter().map(a => rowHtml(a, today)).join('');
    mount.innerHTML = `
      ${verifyCount ? `
        <div style="background:linear-gradient(135deg,var(--blue-bg),#dbeafe);border:1px solid var(--blue-border);border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--blue-ink);text-transform:uppercase;letter-spacing:.06em">Cola de verificación</div>
            <div style="font-size:14px;font-weight:700;color:#0c4a6e;margin-top:4px">${verifyCount} actividad${verifyCount>1?'es':''} reportada${verifyCount>1?'s':''} como completadas</div>
            <div style="font-size:12px;color:var(--ink-2);margin-top:4px">Revisa evidencia y valida para cerrar el ciclo.</div>
          </div>
          <a href="#" data-filter="verificar" style="background:var(--blue-ink);color:#fff;padding:10px 16px;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none">Verificar ahora →</a>
        </div>` : ''}
      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
        ${pill('todas', 'Todas', activities.length, state.filter)}
        ${pill('atrasadas', 'Atrasadas', lateCount, state.filter, 'red')}
        ${pill('verificar', 'Verificación pendiente', verifyCount, state.filter)}
        ${pill('mes', 'Este mes', monthCount, state.filter)}
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <input id="act-search" placeholder="Buscar por ID, título o responsable…" value="${state.search}" style="flex:1;max-width:320px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:12px" />
        <div><button class="btn-sec btn-export-csv" style="background:var(--surface);border:1px solid var(--line);padding:7px 12px;border-radius:7px;font-size:12px;color:var(--ink-3);cursor:pointer">Exportar CSV</button></div>
      </div>
      <div class="tbl">
        <div class="thead"><div>ID</div><div>Actividad</div><div>Responsable</div><div>Plazo</div><div>Estado</div><div></div></div>
        ${rows || '<div style="padding:40px;text-align:center;color:var(--muted);font-size:12px">Sin resultados con ese filtro.</div>'}
      </div>
      <div style="font-size:11px;color:var(--muted);text-align:right;margin-top:10px">Mostrando ${filter().length} de ${activities.length}</div>
    `;

  };

  paint();
}

function pill(key, label, count, active, style='') {
  return `<span class="pill ${active===key?'active':''} ${style}" data-filter="${key}">${label} <span style="background:rgba(15,23,42,0.08);padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700">${count}</span></span>`;
}

function rowHtml(a, today) {
  const d = daysBetween(today, new Date(a.fecha_limite));
  const statusMap = {
    'Completado': ['done', 'Completada'],
    'Atrasado': ['late', 'Atrasada'],
    'En progreso': ['prog', 'En progreso'],
    'No iniciado': ['pend', 'Por iniciar'],
    'Reportada — pendiente verificación ST': ['verify', 'Verificar'],
    'Rechazado': ['late', 'Devuelto por ST']
  };
  const [cls, label] = statusMap[a.estado] || ['pend', a.estado];
  const rowCls = cls === 'late' ? 'late' : cls === 'verify' ? 'verify' : '';
  const plazoCls = d < 0 ? 'color:var(--red);font-weight:700' : d <= 7 ? 'color:var(--orange);font-weight:600' : '';
  return `
    <div class="row ${rowCls}" data-id="${a.id}">
      <div class="mono" style="font-size:11px;color:var(--muted)">${a.id}</div>
      <div>
        <div style="font-weight:500">${a.hito_operativo}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${a.que_se_hace ? a.que_se_hace.slice(0, 80) + (a.que_se_hace.length > 80 ? '…' : '') : ''}</div>
      </div>
      <div style="font-size:11px;color:var(--ink-3)">${a.lidera_apoya}</div>
      <div style="font-size:11px;${plazoCls}">${formatDate(new Date(a.fecha_limite), true)}${d<0?` · −${-d}d`:d<=14?` · en ${d}d`:''}</div>
      <div><span class="badge ${cls}">${label}</span></div>
      <div style="color:var(--muted-2);text-align:center">⋯</div>
    </div>
  `;
}
