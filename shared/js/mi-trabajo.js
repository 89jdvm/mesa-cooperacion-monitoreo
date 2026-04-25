// shared/js/mi-trabajo.js
import { formatDate, daysBetween, actorBaseName, actorPersonName } from './utils.js';
import { topNeedsAttention } from './priority.js';
import { computePodio, computeRacha, computeSubmesaRace } from './gamification.js';
import { determineState } from './mi-trabajo-state.js';

export function renderMiTrabajo(mount, { activities, actor, today, formUrl }) {
  const baseName = actorBaseName(actor.name);
  const isST = actor.rol === 'ST' || (actor.rol || '').startsWith('ST');

  // ST manages the whole Mesa, so "mine" = activities where ST is the primary
  // (sole or first-listed) responsible party, not every activity that mentions ST.
  // This prevents ST from seeing 66 "personal" tasks that belong to Submesas.
  const mine = isST
    ? activities.filter(a => {
        const la = (a.lidera_apoya || '').trim();
        // ST is primary if the field starts with "Secretaría Técnica" or ST is
        // the only institution listed (no comma/slash separation with others).
        return la.startsWith(baseName) && !la.match(/^Secretaría Técnica[^,]*,/);
      })
    : activities.filter(a => (a.lidera_apoya || '').includes(baseName));

  const actionLink = (id, blocker) => {
    if (!formUrl) return '#';
    const u = new URL(formUrl);
    u.searchParams.set('id', id);
    u.searchParams.set('actor', actor.slug);
    u.searchParams.set('token', actor.token || '');
    if (blocker) u.searchParams.set('bloqueador', 'true');
    return u.toString();
  };
  const podio = computePodio(activities, today);
  const rank = (() => {
    const i = podio.findIndex(p => p.actor.includes(baseName));
    return i === -1 ? null : i + 1;
  })();
  const state = determineState(mine, today, { rankInPodio: rank });
  const racha = computeRacha(baseName, activities, today);
  const race = computeSubmesaRace(activities);
  // ST has rol='ST' not a submesa key — skip the submesa race card for ST.
  const mySub = isST ? null : race.find(r => r.submesa === actor.submesa);
  const mySubRank = mySub ? race.indexOf(mySub) + 1 : null;
  const urgent = topNeedsAttention(mine, today, 3);
  const qPct = mine.length ? Math.round((mine.filter(a => a.estado === 'Completado').length / mine.length) * 100) : 0;
  const completed = mine.filter(a => a.estado === 'Completado').length;
  const atrasadas = mine.filter(a => a.estado === 'Atrasado' || a.estado === 'Rechazado').length;

  const verifyQueue = isST ? activities.filter(a => a.estado === 'Reportada — pendiente verificación ST') : [];

  // Build verify/reject URLs using the ST's own (slug, token).
  const verifyUrl = (id, action) => {
    if (!formUrl) return '#';
    const u = new URL(formUrl);
    u.searchParams.set('id', id);
    u.searchParams.set('actor', actor.slug);
    u.searchParams.set('token', actor.token || '');
    u.searchParams.set('action', action);
    return u.toString();
  };

  mount.innerHTML = `
    ${renderHero(state, actor, mine, racha, { rank, mySubRank, mySub, isST, verifyCount: verifyQueue.length })}
    ${isST ? renderVerifyCenter(verifyQueue, verifyUrl) : ''}
    ${renderMetaQ(mine, completed, atrasadas, qPct, today)}
    ${renderUrgent(urgent, today, actionLink)}
    ${renderAgenda(mine, today, actionLink)}
    ${!isST ? renderSubmesaStanding(mySub, mySubRank, actor) : ''}
  `;
}

function renderVerifyCenter(items, verifyUrl) {
  if (!items.length) {
    return `
      <section class="panel" style="margin-bottom:16px;border-color:var(--blue-border);background:linear-gradient(135deg,var(--blue-bg),#dbeafe)">
        <h4 style="color:var(--blue-ink)">🛡️ Centro de verificación <span class="sub">Tu responsabilidad como ST</span></h4>
        <div style="font-size:13px;color:var(--ink-2)">No hay actividades pendientes de verificar. ✓</div>
      </section>
    `;
  }
  const rows = items.map(a => `
    <div style="padding:14px;border-radius:10px;background:#fff;border:1px solid var(--blue-border);margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px">
        <div style="flex:1">
          <div class="mono" style="font-size:10px;color:var(--muted)">${a.id}</div>
          <div style="font-size:14px;font-weight:600;color:var(--ink);margin-top:2px">${a.hito_operativo}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">
            Reportado por <b style="color:var(--ink-2)">${a.lidera_apoya.split(/[,(/]/)[0].trim()}</b> · ${a.fecha_reporte ? 'hace ' + daysSince(a.fecha_reporte) + ' días' : 'sin fecha'}
          </div>
        </div>
      </div>
      <div style="background:var(--bg);padding:10px 12px;border-radius:6px;font-size:12px;line-height:1.6;margin-bottom:10px">
        <div><b style="color:var(--ink-2)">Producto esperado:</b> <span style="color:var(--ink-3)">${a.producto_verificable || '—'}</span></div>
        <div><b style="color:var(--ink-2)">Evidencia mínima esperada:</b> <span style="color:var(--ink-3)">${a.evidencia_minima || '—'}</span></div>
        ${a.enlace_evidencia ? `<div style="margin-top:6px"><b style="color:var(--ink-2)">Evidencia recibida:</b> <a href="${a.enlace_evidencia}" target="_blank" rel="noopener" style="color:var(--blue-ink);font-weight:600">📎 Abrir →</a></div>` : '<div style="margin-top:6px;color:#dc2626"><b>⚠ Sin enlace de evidencia adjunto</b></div>'}
      </div>
      <div style="display:flex;gap:8px">
        <a href="${verifyUrl(a.id, 'verify')}" target="_blank" rel="noopener" style="background:#16a34a;color:#fff;padding:9px 16px;border-radius:7px;text-decoration:none;font-weight:600;font-size:13px">✓ Verificar</a>
        <a href="${verifyUrl(a.id, 'reject')}" target="_blank" rel="noopener" style="background:#fff;color:#b45309;border:1px solid #d97706;padding:9px 16px;border-radius:7px;text-decoration:none;font-weight:600;font-size:13px">✗ Pedir más info</a>
      </div>
    </div>
  `).join('');
  return `
    <section class="panel" style="margin-bottom:16px;border:2px solid var(--blue-border);background:linear-gradient(180deg,var(--blue-bg),var(--surface))">
      <h4 style="color:var(--blue-ink)">🛡️ Centro de verificación <span class="sub" style="color:var(--blue-ink);opacity:0.7">${items.length} actividad${items.length > 1 ? 'es' : ''} reportada${items.length > 1 ? 's' : ''} esperan tu validación</span></h4>
      <div style="font-size:12px;color:var(--ink-2);margin-bottom:12px;line-height:1.5">Compara lo recibido contra el producto esperado. Verificar marca como completada y publica en el dashboard. Pedir más info la devuelve al reportante con un mensaje. Tiempo promedio por ítem: 2 min.</div>
      ${rows}
    </section>
  `;
}

function daysSince(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  return Math.max(0, Math.round((today - d) / 86400000));
}

function renderHero(state, actor, mine, racha, ctx) {
  const greetingName = actorPersonName(actor.name).split(' ')[0];

  // ST gets a Mesa-health hero instead of the personal podio/racha framing.
  if (ctx.isST) {
    const verifyCount = ctx.verifyCount || 0;
    const bg = verifyCount > 0
      ? 'linear-gradient(135deg,#1e3a8a,#1e40af 60%,#3b82f6)'
      : 'linear-gradient(135deg,var(--primary-dark),var(--primary) 60%,var(--primary-accent))';
    return `
      <section style="background:${bg};color:#fff;border-radius:var(--r-xl);padding:24px 28px;display:grid;grid-template-columns:1.4fr 1fr;gap:24px;align-items:center;margin-bottom:16px;overflow:hidden">
        <div>
          <div style="font-size:10px;opacity:0.75;text-transform:uppercase;letter-spacing:0.08em">Hola, ${greetingName} 🛡️</div>
          <div style="font-size:21px;font-weight:700;margin-top:5px;line-height:1.3">${verifyCount > 0 ? `${verifyCount} actividad${verifyCount > 1 ? 'es' : ''} esperan tu verificación` : 'Todo verificado — no hay cola pendiente'}</div>
          <div style="font-size:13px;opacity:0.88;margin-top:7px;line-height:1.5">Tus actividades propias de gestión: ${mine.filter(a => a.estado === 'Completado').length} completadas de ${mine.length}.</div>
          <div style="background:rgba(255,255,255,0.13);border:1px solid rgba(255,255,255,0.22);padding:11px 14px;border-radius:8px;font-size:12px;margin-top:12px">
            🔒 El dashboard público solo muestra actividades que tú has verificado. Lo que no verificas no aparece como completado.
          </div>
        </div>
        <div style="background:rgba(255,255,255,0.13);border:1px solid rgba(255,255,255,0.2);border-radius:14px;padding:18px 20px">
          <div style="font-size:10px;opacity:0.85;text-transform:uppercase;letter-spacing:0.08em;font-weight:600">⏳ Cola de verificación</div>
          <div style="font-size:36px;font-weight:800;line-height:1;margin-top:6px">${verifyCount}</div>
          <div style="font-size:11px;opacity:0.85;margin-top:4px">${verifyCount === 0 ? 'sin pendientes' : `ítem${verifyCount > 1 ? 's' : ''} para revisar`}</div>
        </div>
      </section>
    `;
  }

  const configs = {
    A: {
      bg: 'linear-gradient(135deg,#78350f 0%,#b45309 40%,#d97706 100%)',
      label: `Hola, ${greetingName} 🏆`,
      title: `Estás en ${ctx.rank}° lugar del podio del mes`,
      sub: `Has completado ${mine.filter(a => a.estado === 'Completado').length} actividades a tiempo. Mantén el ritmo.`,
      social: 'Tu nombre aparece público en el Panel este mes. La Mesa completa te ve como referente.',
      socialIcon: '📣'
    },
    B: {
      bg: 'linear-gradient(135deg,var(--primary-dark),var(--primary) 50%,var(--primary-accent) 100%)',
      label: `Hola, ${greetingName} 👋`,
      title: 'Vas bien. Una completada más y <b>entras al podio</b>.',
      sub: `Tienes ${mine.filter(a => a.estado !== 'Completado').length} actividades activas. Tu submesa ${ctx.mySub ? `ocupa el ${ctx.mySubRank}° lugar` : 'está en la carrera'}.`,
      social: 'Una actividad completada a tiempo este mes te lleva al podio "Avanzadores del mes" en el Panel público.',
      socialIcon: '🎯'
    },
    C: {
      bg: 'linear-gradient(135deg,#1e293b,#334155 60%,#475569)',
      label: `Hola, ${greetingName}`,
      title: 'Este mes te has retrasado.',
      sub: `Tienes ${mine.filter(a => a.estado === 'Atrasado').length} actividades atrasadas${ctx.mySub ? ` y tu Submesa ${ctx.mySub.submesa} está en ${ctx.mySubRank}° lugar` : ''}.`,
      social: 'Lo que ven los demás: tu submesa en el ranking público. Tu nombre no aparece en ningún listado público, solo la ST lo sabe.',
      socialIcon: '👀',
      extra: { icon: '🤝', text: 'Camino de salida: 1 de tus actividades busca apoyo. La ST puede reasignar o acompañar.' }
    }
  };
  const c = configs[state];
  const rachaLabel = state === 'C' ? 'Racha en pausa' : 'Tu racha';
  const rachaNum = state === 'C' && racha === 0 ? '0 meses' : `${racha} meses`;

  return `
    <section style="background:${c.bg};color:#fff;border-radius:var(--r-xl);padding:24px 28px;display:grid;grid-template-columns:1.4fr 1fr;gap:24px;align-items:center;margin-bottom:16px;position:relative;overflow:hidden">
      <div>
        <div style="font-size:10px;opacity:0.75;text-transform:uppercase;letter-spacing:0.08em">${c.label}</div>
        <div style="font-size:21px;font-weight:700;margin-top:5px;line-height:1.3">${c.title}</div>
        <div style="font-size:13px;opacity:0.88;margin-top:7px;line-height:1.5">${c.sub}</div>
        <div style="background:rgba(255,255,255,0.13);border:1px solid rgba(255,255,255,0.22);padding:11px 14px;border-radius:8px;font-size:12px;margin-top:12px;display:flex;gap:10px;align-items:flex-start">
          <div style="font-size:16px">${c.socialIcon}</div>
          <div>${c.social}</div>
        </div>
        ${c.extra ? `<div style="background:rgba(34,197,94,0.15);border:1px solid rgba(134,239,172,0.35);padding:11px 14px;border-radius:8px;font-size:12px;margin-top:8px;display:flex;gap:10px"><div>${c.extra.icon}</div><div><b>Camino de salida:</b> ${c.extra.text} <a href="#actividades" style="color:#bbf7d0;text-decoration:underline;font-weight:600">Pedir apoyo</a></div></div>` : ''}
      </div>
      <div style="background:rgba(255,255,255,0.13);border:1px solid rgba(255,255,255,0.2);border-radius:14px;padding:18px 20px">
        <div style="font-size:10px;opacity:0.85;text-transform:uppercase;letter-spacing:0.08em;font-weight:600">🔥 ${rachaLabel}</div>
        <div style="font-size:30px;font-weight:800;line-height:1;margin-top:6px">${rachaNum}</div>
        <div style="font-size:11px;opacity:0.85;margin-top:4px">${state === 'C' ? 'reiniciar requiere 1 entrega a tiempo' : 'consecutivos a tiempo'}</div>
      </div>
    </section>
  `;
}

function renderMetaQ(mine, completed, atrasadas, pct, today) {
  const qStart = startOfQuarter(today);
  const qEnd = endOfQuarter(today);
  const daysLeft = Math.max(0, daysBetween(today, qEnd));
  const inQuarter = mine.filter(a => {
    const fl = new Date(a.fecha_limite);
    return fl >= qStart && fl <= qEnd;
  });
  const qCompleted = inQuarter.filter(a => a.estado === 'Completado').length;
  const qPct = inQuarter.length ? Math.round((qCompleted / inQuarter.length) * 100) : 0;
  const qLabel = quarterLabel(today);
  return `
    <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:16px 20px;display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-bottom:16px">
      <div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600">Meta de este trimestre (${qLabel})</div><div style="font-size:22px;font-weight:800;color:var(--primary);margin-top:3px">${qCompleted} de ${inQuarter.length}</div></div>
      <div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600">Total hoja de ruta</div><div style="font-size:22px;font-weight:800;margin-top:3px">${completed} / ${mine.length}</div></div>
      <div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600">Requieren acción</div><div style="font-size:22px;font-weight:800;color:var(--red);margin-top:3px">${atrasadas}</div></div>
      <div>
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600">Avance ${qLabel}</div>
        <div style="background:var(--line-2);height:8px;border-radius:4px;margin-top:8px;overflow:hidden"><div style="background:linear-gradient(90deg,var(--primary-dark),var(--primary-accent));height:100%;width:${qPct}%"></div></div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px">${qPct}% · quedan ${daysLeft} días</div>
      </div>
    </div>
  `;
}

function renderUrgent(items, today, actionLink) {
  if (!items.length) return '';
  return `
    <section class="panel" style="margin-bottom:16px">
      <h4>Lo más urgente <span class="sub">Priorizado por plazo y riesgo</span></h4>
      ${items.map(a => {
        const d = daysBetween(today, new Date(a.fecha_limite));
        const cls = d < 0 ? 'red' : d <= 3 ? 'orange' : 'amber';
        return `
          <div style="border-top:1px solid var(--line-2);padding:14px 0;display:grid;grid-template-columns:20px 1fr auto;gap:12px">
            <div class="pill-dot ${cls}" style="margin-top:6px"></div>
            <div>
              <div class="mono" style="font-size:10px;color:var(--muted)">${a.id}</div>
              <div style="font-size:13px;font-weight:600">${a.hito_operativo}</div>
              <div style="font-size:12px;color:var(--ink-3);margin-top:4px">${a.que_se_hace || ''}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:11px;color:var(--muted)"><b style="color:${d<0?'var(--red)':d<=3?'var(--orange)':'var(--amber)'};font-size:12px">${d<0?`−${-d} días`:`En ${d} días`}</b></div>
              ${actionLink && a.estado !== 'Reportada — pendiente verificación ST' ? `
                <div style="display:flex;gap:6px;margin-top:6px">
                  <a class="btn btn-done" href="${actionLink(a.id, false)}" target="_blank" rel="noopener" style="background:var(--green);color:#fff;padding:5px 11px;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none">✅ Completé</a>
                  <a class="btn btn-block" href="${actionLink(a.id, true)}" target="_blank" rel="noopener" style="background:var(--orange);color:#fff;padding:5px 11px;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none">⚠ Situación</a>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </section>
  `;
}

function renderAgenda(mine, today, actionLink) {
  if (!mine.length) return `<section class="panel" style="margin-bottom:16px"><h4>Mis actividades</h4><div style="font-size:13px;color:var(--muted)">No hay actividades asignadas a tu Submesa.</div></section>`;

  const sorted = [...mine].sort((a, b) => new Date(a.fecha_limite) - new Date(b.fecha_limite));

  const statusBadge = a => {
    if (a.estado === 'Completado')    return `<span style="background:#dcfce7;color:#15803d;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px">✓ Completada</span>`;
    if (a.estado === 'Atrasado')      return `<span style="background:#fee2e2;color:#b91c1c;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px">⚠ Atrasada</span>`;
    if (a.estado === 'En progreso')   return `<span style="background:#dbeafe;color:#1d4ed8;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px">En progreso</span>`;
    if (a.estado === 'Reportada — pendiente verificación ST') return `<span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px">⏳ Pendiente ST</span>`;
    if (a.estado === 'Rechazado')     return `<span style="background:#fee2e2;color:#b91c1c;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px">⛔ Devuelto por ST</span>`;
    return `<span style="background:#f1f5f9;color:#64748b;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px">Por iniciar</span>`;
  };

  const rows = sorted.map(a => {
    const d = daysBetween(today, new Date(a.fecha_limite));
    const done = a.estado === 'Completado';
    const plazoColor = d < 0 ? 'var(--red)' : d <= 7 ? 'var(--amber)' : 'var(--muted)';
    const plazoLabel = d < 0 ? `Venció hace ${-d}d` : d === 0 ? 'Vence hoy' : `Vence en ${d}d`;

    return `
      <div style="border-top:1px solid var(--line-2);padding:16px 0;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px">
          <div style="flex:1">
            <div style="font-family:monospace;font-size:10px;color:var(--muted);margin-bottom:4px">${a.id}</div>
            <div style="font-size:14px;font-weight:600;color:${done ? 'var(--muted)' : 'var(--ink)'};${done ? 'text-decoration:line-through' : ''}">${a.hito_operativo}</div>
            ${a.que_se_hace ? `<div style="font-size:12px;color:var(--ink-3);margin-top:4px;line-height:1.5">${a.que_se_hace}</div>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0">
            ${statusBadge(a)}
            <div style="font-size:11px;color:${plazoColor};font-weight:600;margin-top:6px">${plazoLabel}</div>
            <div style="font-size:11px;color:var(--muted)">${formatDate(new Date(a.fecha_limite), true)}</div>
          </div>
        </div>
        ${a.producto_verificable ? `<div style="font-size:12px;color:var(--ink-3);background:var(--bg);padding:8px 12px;border-radius:6px;margin-bottom:8px"><b style="color:var(--ink-2)">Producto esperado:</b> ${a.producto_verificable}</div>` : ''}
        ${a.estado === 'Rechazado' && a.notas_bloqueador ? `<div style="font-size:12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:8px 12px;margin-bottom:8px;color:#991b1b"><b>⛔ Devuelto por ST:</b> ${a.notas_bloqueador.replace(/^Devuelto por ST:\s*/i, '')}</div>` : ''}
        ${a.estado === 'Reportada — pendiente verificación ST' ? `<div style="font-size:12px;color:#92400e;background:#fef3c7;padding:8px 12px;border-radius:6px;margin-top:4px">⏳ Enviada a la ST para verificación. Recibirás un correo con el resultado.</div>` : ''}
        ${!done && a.estado !== 'Reportada — pendiente verificación ST' && actionLink ? `
          <div style="display:flex;gap:8px;margin-top:8px">
            <a href="${actionLink(a.id, false)}" target="_blank" rel="noopener" style="background:var(--green);color:#fff;padding:7px 14px;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">✅ Ya la completé</a>
            <a href="${actionLink(a.id, true)}" target="_blank" rel="noopener" style="background:#fff;color:var(--amber);border:1px solid var(--amber);padding:7px 14px;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">⚠ Reportar situación</a>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <section class="panel" style="margin-bottom:16px">
      <h4>Mis actividades <span class="sub">${mine.length} en total</span></h4>
      ${rows}
    </section>
  `;
}

function renderSubmesaStanding(mySub, rank, actor) {
  if (!mySub) return '';
  return `<section class="panel"><h4>Cómo va tu Submesa</h4>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:12px;font-weight:700;color:#14532d">${rank === 1 ? '🥇 ' : ''}${mySub.submesa} — ${rank === 1 ? 'líder de la mesa' : `${rank}° lugar`}</div>
        <div style="font-size:11px;color:#166534;margin-top:2px">${mySub.pct}% · ${mySub.done} de ${mySub.total}</div>
      </div>
      <div style="font-size:24px;font-weight:800;color:#14532d">${rank}°</div>
    </div>
  </section>`;
}

function endOfQuarter(d) {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3 + 3, 0);
}

function startOfQuarter(d) {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

function quarterLabel(d) {
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
}
