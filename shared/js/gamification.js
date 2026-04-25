import { daysBetween, actorBaseName, actorPersonName } from './utils.js';

const sameMonth = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const onTime = a =>
  a.estado === 'Completado' &&
  a.fecha_reporte &&
  new Date(a.fecha_reporte) <= new Date(a.fecha_limite);

export function computePodio(activities, today) {
  // Key by institutional base name so "Dir. X — Person A" and "Dir. X — Person B"
  // aggregate together. Display the person name when available for human-readable podio.
  const counts = new Map();
  const displayNames = new Map();
  for (const a of activities) {
    if (!onTime(a)) continue;
    if (!sameMonth(new Date(a.fecha_reporte), today)) continue;
    const key = actorBaseName(a.lidera_apoya);
    counts.set(key, (counts.get(key) || 0) + 1);
    if (!displayNames.has(key)) displayNames.set(key, actorPersonName(a.lidera_apoya));
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ actor: key, displayName: displayNames.get(key) || key, count }))
    .sort((x, y) => y.count - x.count || x.actor.localeCompare(y.actor))
    .slice(0, 3);
}

export function computeSubmesaRace(activities) {
  const grouped = new Map();
  for (const a of activities) {
    const key = a.submesa || '—';
    const g = grouped.get(key) || { submesa: key, total: 0, done: 0, late: 0 };
    g.total++;
    if (a.estado === 'Completado') g.done++;
    if (a.estado === 'Atrasado') g.late++;
    grouped.set(key, g);
  }
  const rows = [...grouped.values()]
    .map(g => ({ ...g, pct: g.total ? Math.round((g.done / g.total) * 100) : 0 }))
    .sort((x, y) => y.pct - x.pct);
  if (rows.length) rows[0].leader = true;
  rows.slice(1).forEach(r => r.leader = false);
  return rows;
}

export function buscanApoyo(activities) {
  return activities
    .filter(a => a.estado === 'Atrasado')
    .map(a => ({
      id: a.id,
      title: a.hito_operativo,
      submesa: a.submesa,
      invitation: buildInvitation(a)
    }));
}

function buildInvitation(a) {
  const d = Math.abs(daysBetween(new Date(), new Date(a.fecha_limite)));
  return `Lleva ${d} días pendiente. Si algún miembro puede acompañar o facilitar, el Grupo Gestor lo agradece.`;
}

export function computeRacha(actor, activities, today) {
  // Count consecutive months ending at "today's month", going backwards, where:
  //   - at least 1 on-time completion by `actor`
  //   - no 'Atrasado' activity of `actor` with fecha_limite in that month
  // `actor` is an institutional baseName — match against baseName of lidera_apoya.
  const mine = activities.filter(a => actorBaseName(a.lidera_apoya || '') === actor);
  let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
  let streak = 0;
  while (streak < 48) { // safety cap
    const inMonth = mine.filter(a => sameMonth(new Date(a.fecha_limite), cursor));
    const hasLate = inMonth.some(a => a.estado === 'Atrasado');
    const hasOnTime = mine.some(a =>
      onTime(a) && a.fecha_reporte && sameMonth(new Date(a.fecha_reporte), cursor)
    );
    if (hasLate || !hasOnTime) break;
    streak++;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
  }
  return streak;
}
