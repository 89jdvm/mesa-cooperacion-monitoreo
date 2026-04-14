// shared/js/mi-trabajo.js
import { formatDate, daysBetween } from './utils.js';
import { topNeedsAttention } from './priority.js';
import { computePodio, computeRacha, computeSubmesaRace } from './gamification.js';
import { determineState } from './mi-trabajo-state.js';

export function renderMiTrabajo(mount, { activities, actor, today, formUrl }) {
  const mine = activities.filter(a => (a.lidera_apoya || '').includes(actor.name));
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
    const i = podio.findIndex(p => p.actor.includes(actor.name));
    return i === -1 ? null : i + 1;
  })();
  const state = determineState(mine, today, { rankInPodio: rank });
  const racha = computeRacha(actor.name, activities, today);
  const race = computeSubmesaRace(activities);
  const mySub = race.find(r => r.submesa === actor.submesa);
  const mySubRank = mySub ? race.indexOf(mySub) + 1 : null;
  const urgent = topNeedsAttention(mine, today, 3);
  const qPct = mine.length ? Math.round((mine.filter(a => a.estado === 'Completado').length / mine.length) * 100) : 0;
  const completed = mine.filter(a => a.estado === 'Completado').length;
  const atrasadas = mine.filter(a => a.estado === 'Atrasado').length;

  mount.innerHTML = `
    ${renderHero(state, actor, mine, racha, { rank, mySubRank, mySub })}
    ${renderMetaQ(mine, completed, atrasadas, qPct, today)}
    ${renderUrgent(urgent, today)}
    ${renderAgenda(mine, today)}
    ${renderSubmesaStanding(mySub, mySubRank, actor)}
  `;
}

function renderHero(state, actor, mine, racha, ctx) {
  const configs = {
    A: {
      bg: 'linear-gradient(135deg,#78350f 0%,#b45309 40%,#d97706 100%)',
      label: `Hola, ${actor.name.split(' ')[0]} 🏆`,
      title: `Estás en ${ctx.rank}° lugar del podio del mes`,
      sub: `Has completado ${mine.filter(a => a.estado === 'Completado').length} actividades a tiempo. Mantén el ritmo.`,
      social: 'Tu nombre aparece público en el Panel este mes. La Mesa completa te ve como referente.',
      socialIcon: '📣'
    },
    B: {
      bg: 'linear-gradient(135deg,var(--primary-dark),var(--primary) 50%,var(--primary-accent) 100%)',
      label: `Hola, ${actor.name.split(' ')[0]} 👋`,
      title: 'Vas bien. Una completada más y <b>entras al podio</b>.',
      sub: `Tienes ${mine.filter(a => a.estado !== 'Completado').length} actividades activas. Tu submesa ${ctx.mySub ? `ocupa el ${ctx.mySubRank}° lugar` : 'está en la carrera'}.`,
      social: 'La carrera del podio es visible en el Panel. Tu nombre no aparece todavía — está a un paso de aparecer.',
      socialIcon: '🎯'
    },
    C: {
      bg: 'linear-gradient(135deg,#1e293b,#334155 60%,#475569)',
      label: `Hola, ${actor.name.split(' ')[0]}`,
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
  const qEnd = endOfQuarter(today);
  const daysLeft = Math.max(0, daysBetween(today, qEnd));
  return `
    <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:16px 20px;display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-bottom:16px">
      <div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600">Meta del trimestre</div><div style="font-size:22px;font-weight:800;color:var(--primary);margin-top:3px">${completed} de ${mine.length}</div></div>
      <div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600">Completadas (todo)</div><div style="font-size:22px;font-weight:800;margin-top:3px">${completed}</div></div>
      <div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600">Requieren acción</div><div style="font-size:22px;font-weight:800;color:var(--red);margin-top:3px">${atrasadas}</div></div>
      <div>
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600">Avance Q</div>
        <div style="background:var(--line-2);height:8px;border-radius:4px;margin-top:8px;overflow:hidden"><div style="background:linear-gradient(90deg,var(--primary-dark),var(--primary-accent));height:100%;width:${pct}%"></div></div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px">${pct}% · quedan ${daysLeft} días</div>
      </div>
    </div>
  `;
}

function renderUrgent(items, today) {
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
              ${formUrl ? `
                <div style="display:flex;gap:6px;margin-top:6px">
                  <a class="btn btn-done" href="${actionLink(a.id, false)}" target="_blank" rel="noopener" style="background:var(--green);color:#fff;padding:5px 11px;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none">✅ Completé</a>
                  <a class="btn btn-block" href="${actionLink(a.id, true)}" target="_blank" rel="noopener" style="background:var(--orange);color:#fff;padding:5px 11px;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none">⚠ Bloqueador</a>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </section>
  `;
}

function renderAgenda(mine, today) {
  const items = mine
    .filter(a => a.estado !== 'Completado')
    .map(a => ({ a, d: daysBetween(today, new Date(a.fecha_limite)) }))
    .filter(x => x.d >= 0 && x.d <= 30)
    .sort((x, y) => x.d - y.d);
  if (!items.length) return '';
  return `<section class="panel" style="margin-bottom:16px"><h4>Mi agenda — próximos 30 días</h4>
    ${items.map(({a, d}) => `
      <div style="display:grid;grid-template-columns:80px 1fr 80px;gap:12px;padding:9px 0;border-top:1px solid var(--line-2);font-size:12px;align-items:center">
        <div style="color:var(--primary);font-weight:700;font-size:11px;text-transform:uppercase">${formatDate(new Date(a.fecha_limite), true)}</div>
        <div>${a.hito_operativo}</div>
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;text-align:right;font-weight:600">EN ${d} DÍAS</div>
      </div>`).join('')}
  </section>`;
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
