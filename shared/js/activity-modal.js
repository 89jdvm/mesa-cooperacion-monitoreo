// shared/js/activity-modal.js
import { formatDate, actorBaseName } from './utils.js';

let activities = [];
let actor = null;
let logUrl = null;
let formUrl = null;

export function initActivityModal({ activities: acts, actor: a, logUrl: l, formUrl: f }) {
  activities = acts; actor = a; logUrl = l; formUrl = f;
  window.addEventListener('open-activity', e => open(e.detail.id));
  document.addEventListener('click', e => {
    if (e.target.classList?.contains('modal-overlay')) close();
  });
}

async function open(id) {
  const a = activities.find(x => x.id === id);
  if (!a) return;

  let overlay = document.getElementById('activity-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'activity-modal';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }
  overlay.className = 'modal-overlay open';
  overlay.innerHTML = `<div class="modal"><div id="modal-body" style="font-size:14px;color:var(--ink-2)">Cargando…</div></div>`;

  const log = await loadLog(id);

  overlay.querySelector('#modal-body').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:14px">
      <div>
        <div class="mono" style="font-size:10px;color:var(--muted)">${a.id}</div>
        <h3 style="font-size:20px;margin-top:4px;letter-spacing:-0.01em">${a.hito_operativo}</h3>
      </div>
      <button data-close style="background:none;border:0;font-size:24px;color:var(--muted);cursor:pointer">×</button>
    </div>
    <div style="font-size:13px;line-height:1.6;color:var(--ink-3)">${a.que_se_hace || ''}</div>
    <div style="margin-top:16px;padding:14px;background:var(--bg);border-radius:8px;font-size:12px;line-height:1.7">
      <div><b>Producto:</b> ${a.producto_verificable || '—'}</div>
      <div><b>Evidencia:</b> ${a.evidencia_minima || '—'}</div>
      <div><b>Responsable:</b> ${a.lidera_apoya}</div>
      <div><b>Plazo:</b> ${formatDate(new Date(a.fecha_limite))}</div>
      <div><b>Submesa:</b> ${a.submesa || '—'} · <b>Tipo:</b> ${a.tipo || '—'}</div>
    </div>
    <div style="margin-top:18px">
      <h4 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink);margin-bottom:10px">Historial de notificaciones</h4>
      ${log.length ? log.map(l => `
        <div style="font-size:12px;color:var(--ink-3);padding:6px 0;border-bottom:1px solid var(--line-2)">
          <span class="mono" style="color:var(--muted);font-size:11px">${l.fecha}</span> · ${l.accion}${l.detalle ? ' — ' + l.detalle : ''}
        </div>`).join('') : '<div style="font-size:12px;color:var(--muted)">Sin historial registrado.</div>'}
    </div>
    ${renderActions(a)}
  `;
  overlay.querySelector('[data-close]').onclick = close;
}

function close() {
  const overlay = document.getElementById('activity-modal');
  if (overlay) overlay.className = 'modal-overlay';
}

function renderActions(a) {
  // Match the activity's lidera_apoya against the actor's institutional base
  // so users with " — <Person>" suffix still see the action buttons.
  const isActorResponsible = actor && a.lidera_apoya.includes(actorBaseName(actor.name));
  if (!isActorResponsible || a.estado === 'Completado') return '';
  if (!formUrl) return '';
  const buildUrl = (blocker) => {
    const u = new URL(formUrl);
    u.searchParams.set('id', a.id);
    u.searchParams.set('actor', actor.slug);
    u.searchParams.set('token', actor.token || '');
    if (blocker) u.searchParams.set('bloqueador', 'true');
    return u.toString();
  };
  return `<div style="margin-top:18px;display:flex;gap:8px">
    <a href="${buildUrl(false)}" target="_blank" rel="noopener" style="background:var(--green);color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none">✅ Reportar completada</a>
    <a href="${buildUrl(true)}" target="_blank" rel="noopener" style="background:var(--orange);color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none">⚠ Reportar bloqueador</a>
  </div>`;
}

async function loadLog(id) {
  if (!logUrl) return [];
  try {
    const r = await fetch(logUrl);
    if (!r.ok) return [];
    const text = await r.text();
    return parseLogCsv(text).filter(l => l.id === id);
  } catch { return []; }
}

function parseLogCsv(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const cells = splitCsvLine(line);
    const o = {};
    headers.forEach((h, i) => o[h] = cells[i] || '');
    return o;
  });
}

function splitCsvLine(line) {
  const out = []; let cur = ''; let inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}
