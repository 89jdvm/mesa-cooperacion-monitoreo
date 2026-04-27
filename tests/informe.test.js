import assert from 'node:assert/strict';
import { computeInformeStats } from '../shared/js/informe.js';

function act(o) {
  return {
    id: 'X', hito_operativo: 'Test', lidera_apoya: 'ST', trimestre: '2026 Q2',
    submesa: 'S1', estado: 'No iniciado', porcentaje: 0,
    fecha_limite: '2026-06-30', notas_bloqueador: '', ...o
  };
}

export function test_pct_is_count_based_not_porcentaje_average() {
  // 1 of 2 completadas = 50%, regardless of porcentaje field values
  const acts = [
    act({ estado: 'Completado', porcentaje: 80 }),
    act({ estado: 'En progreso', porcentaje: 60 })
  ];
  const stats = computeInformeStats(acts);
  assert.equal(stats.pct, 50);
}

export function test_groups_completadas_by_submesa() {
  const acts = [
    act({ id: 'A', estado: 'Completado', submesa: 'S1' }),
    act({ id: 'B', estado: 'Completado', submesa: 'S2' }),
    act({ id: 'C', estado: 'Completado', submesa: 'S1' }),
    act({ id: 'D', estado: 'En progreso', submesa: 'S1' })
  ];
  const stats = computeInformeStats(acts);
  assert.equal(stats.completadasBySubmesa['S1'].length, 2);
  assert.equal(stats.completadasBySubmesa['S2'].length, 1);
  assert.ok(!stats.completadasBySubmesa['S1'].find(a => a.id === 'D'));
}

export function test_riesgo_includes_atrasado_and_notas_bloqueador() {
  const acts = [
    act({ id: 'late', estado: 'Atrasado' }),
    act({ id: 'bloq', estado: 'En progreso', notas_bloqueador: 'Sin presupuesto' }),
    act({ id: 'ok',   estado: 'En progreso', notas_bloqueador: '' })
  ];
  const stats = computeInformeStats(acts);
  const riesgoIds = stats.riesgo.map(a => a.id);
  assert.ok(riesgoIds.includes('late'));
  assert.ok(riesgoIds.includes('bloq'));
  assert.ok(!riesgoIds.includes('ok'));
}
