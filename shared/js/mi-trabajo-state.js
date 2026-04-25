import { daysBetween } from './utils.js';

export function determineState(myActivities, today, meta = {}) {
  const { rankInPodio = null } = meta;
  if (rankInPodio !== null && rankInPodio <= 3) return 'A';

  const atrasadas = myActivities.filter(a => a.estado === 'Atrasado' || a.estado === 'Rechazado').length;
  if (atrasadas >= 2) return 'C';

  const completedLast30 = myActivities.filter(a => {
    if (a.estado !== 'Completado' || !a.fecha_reporte) return false;
    const d = new Date(a.fecha_reporte);
    return !isNaN(d) && daysBetween(d, today) <= 30;
  }).length;
  const activeLoad = myActivities.filter(a =>
    a.estado === 'En progreso' || a.estado === 'No iniciado'
  ).length;
  if (completedLast30 === 0 && activeLoad >= 3) return 'C';

  return 'B';
}
