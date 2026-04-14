import assert from 'node:assert/strict';
import { determineState } from '../shared/js/mi-trabajo-state.js';

const today = new Date('2026-04-15');

function make(o) {
  return { estado: 'En progreso', fecha_reporte: null, fecha_limite: '2026-05-01', ...o };
}

export function test_state_A_when_in_monthly_podio() {
  const me = [
    make({ estado: 'Completado', fecha_reporte: '2026-04-03', fecha_limite: '2026-04-10' }),
    make({ estado: 'Completado', fecha_reporte: '2026-04-07', fecha_limite: '2026-04-09' }),
    make({ estado: 'Completado', fecha_reporte: '2026-04-10', fecha_limite: '2026-04-12' })
  ];
  assert.equal(determineState(me, today, { rankInPodio: 1 }), 'A');
}

export function test_state_C_when_2_or_more_atrasadas() {
  const me = [
    make({ estado: 'Atrasado', fecha_limite: '2026-04-01' }),
    make({ estado: 'Atrasado', fecha_limite: '2026-04-03' }),
    make({ estado: 'En progreso', fecha_limite: '2026-05-01' })
  ];
  assert.equal(determineState(me, today, { rankInPodio: null }), 'C');
}

export function test_state_C_when_idle_with_active_load() {
  const me = [
    make({ estado: 'En progreso', fecha_limite: '2026-05-01' }),
    make({ estado: 'En progreso', fecha_limite: '2026-05-10' }),
    make({ estado: 'En progreso', fecha_limite: '2026-05-15' })
  ]; // no completions in last 30 days, 3 active
  assert.equal(determineState(me, today, { rankInPodio: null }), 'C');
}

export function test_state_B_default_on_track() {
  const me = [
    make({ estado: 'Completado', fecha_reporte: '2026-04-08', fecha_limite: '2026-04-10' }),
    make({ estado: 'En progreso', fecha_limite: '2026-05-01' })
  ];
  assert.equal(determineState(me, today, { rankInPodio: 4 }), 'B');
}
