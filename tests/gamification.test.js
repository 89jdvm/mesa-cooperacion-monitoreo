import assert from 'node:assert/strict';
import { computePodio, computeSubmesaRace, buscanApoyo, computeRacha } from '../shared/js/gamification.js';

function act(o) {
  return { id: 'A', estado: 'Completado', fecha_reporte: '2026-04-10', fecha_limite: '2026-04-12', lidera_apoya: 'Coord A', submesa: 'S1', ...o };
}

export function test_podio_top_3_by_on_time_completed_this_month() {
  const today = new Date('2026-04-20');
  const acts = [
    act({ lidera_apoya: 'Coord A', fecha_reporte: '2026-04-05', fecha_limite: '2026-04-10' }),
    act({ lidera_apoya: 'Coord A', fecha_reporte: '2026-04-12', fecha_limite: '2026-04-15' }),
    act({ lidera_apoya: 'Coord B', fecha_reporte: '2026-04-08', fecha_limite: '2026-04-20' }),
    act({ lidera_apoya: 'Coord C', fecha_reporte: '2026-03-28', fecha_limite: '2026-03-30' }), // previous month, excluded
  ];
  const p = computePodio(acts, today);
  assert.equal(p[0].actor, 'Coord A');
  assert.equal(p[0].count, 2);
  assert.equal(p[1].actor, 'Coord B');
  assert.equal(p.length, 2);
}

export function test_submesa_race_sorted_desc_with_crown() {
  const acts = [
    act({ submesa: 'S1', estado: 'Completado' }),
    act({ submesa: 'S1', estado: 'En progreso' }),
    act({ submesa: 'S2', estado: 'En progreso' }),
    act({ submesa: 'S2', estado: 'En progreso' })
  ];
  const r = computeSubmesaRace(acts);
  assert.equal(r[0].submesa, 'S1');
  assert.equal(r[0].leader, true);
  assert.equal(r[1].leader, false);
  assert.equal(r[0].pct, 50);
  assert.equal(r[1].pct, 0);
}

export function test_buscan_apoyo_reframes_atrasadas() {
  const acts = [
    act({ id: 'L1', estado: 'Atrasado', hito_operativo: 'Acta' }),
    act({ id: 'L2', estado: 'Atrasado', hito_operativo: 'Plan' }),
    act({ id: 'D1', estado: 'Completado' })
  ];
  const b = buscanApoyo(acts);
  assert.equal(b.length, 2);
  assert.ok(b.every(x => x.invitation.startsWith('Lleva') || x.invitation.includes('apoyo')));
}

export function test_racha_counts_consecutive_months_clean() {
  // Actor completed in Feb, Mar, Apr with no atrasadas → racha 3
  const today = new Date('2026-04-20');
  const acts = [
    act({ lidera_apoya: 'X', fecha_reporte: '2026-02-15', fecha_limite: '2026-02-20' }),
    act({ lidera_apoya: 'X', fecha_reporte: '2026-03-10', fecha_limite: '2026-03-15' }),
    act({ lidera_apoya: 'X', fecha_reporte: '2026-04-05', fecha_limite: '2026-04-10' })
  ];
  assert.equal(computeRacha('X', acts, today), 3);
}

export function test_racha_breaks_on_atrasada() {
  const today = new Date('2026-04-20');
  const acts = [
    act({ lidera_apoya: 'X', estado: 'Completado', fecha_reporte: '2026-02-15', fecha_limite: '2026-02-20' }),
    act({ lidera_apoya: 'X', estado: 'Atrasado', fecha_limite: '2026-03-15' }),
    act({ lidera_apoya: 'X', estado: 'Completado', fecha_reporte: '2026-04-05', fecha_limite: '2026-04-10' })
  ];
  assert.equal(computeRacha('X', acts, today), 1); // only April counts; March broke the chain
}
