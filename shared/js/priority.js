// priority.js
// Priority scoring for "Necesita atención" (Panel) and "Lo más urgente" (Mi trabajo).
// score = max(0, -days) * 10 + max(0, 14 - days) + (blocker ? 20 : 0)

import { daysBetween } from './utils.js';

const EXCLUDED_STATES = new Set(['Completado', 'Reportada — pendiente verificación ST', 'Rechazado']);

export function scoreActivity(a, today) {
  if (EXCLUDED_STATES.has(a.estado)) return 0;
  const days = daysBetween(today, new Date(a.fecha_limite));
  const overdue = Math.max(0, -days) * 10;
  const near = Math.max(0, 14 - days);
  const blocker = a.bloqueaOtras ? 20 : 0;
  return overdue + near + blocker;
}

export function topNeedsAttention(activities, today, n = 5) {
  return activities
    .filter(a => !EXCLUDED_STATES.has(a.estado))
    .map(a => ({ a, s: scoreActivity(a, today) }))
    .filter(x => x.s > 0)
    .sort((x, y) => y.s - x.s || new Date(x.a.fecha_limite) - new Date(y.a.fecha_limite))
    .slice(0, n)
    .map(x => x.a);
}
