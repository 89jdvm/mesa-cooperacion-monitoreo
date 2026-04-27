import assert from 'node:assert/strict';
import { scoreActivity, topNeedsAttention } from '../shared/js/priority.js';

const today = new Date('2026-04-13');

function make(over) {
  return { id: 'X', hito_operativo: 't', fecha_limite: '2026-04-13', estado: 'En progreso', lidera_apoya: 'ST', ...over };
}

export function test_score_overdue_is_highest() {
  const s1 = scoreActivity(make({ fecha_limite: '2026-04-01' }), today); // -12 days
  const s2 = scoreActivity(make({ fecha_limite: '2026-04-20' }), today); // +7
  assert.ok(s1 > s2, `overdue ${s1} should outscore soon ${s2}`);
}

export function test_score_zero_for_far_future() {
  const s = scoreActivity(make({ fecha_limite: '2027-01-01' }), today);
  assert.equal(s, 0);
}

export function test_completed_is_excluded_from_top() {
  const acts = [
    make({ id: 'A', estado: 'Completado', fecha_limite: '2026-04-01' }),
    make({ id: 'B', estado: 'En progreso', fecha_limite: '2026-04-01' })
  ];
  const top = topNeedsAttention(acts, today, 5);
  assert.equal(top.length, 1);
  assert.equal(top[0].id, 'B');
}

export function test_top_sorted_by_urgency() {
  const acts = [
    make({ id: 'soon', fecha_limite: '2026-04-20' }),    // +7
    make({ id: 'late', fecha_limite: '2026-04-05' }),    // -8
    make({ id: 'soon2', fecha_limite: '2026-04-18' })    // +5
  ];
  const top = topNeedsAttention(acts, today, 5);
  assert.deepEqual(top.map(a => a.id), ['late', 'soon2', 'soon']);
}

export function test_blocker_of_others_boosts_score() {
  const plain = scoreActivity(make({ fecha_limite: '2026-04-20' }), today);
  const blocker = scoreActivity(make({ fecha_limite: '2026-04-20', bloqueaOtras: true }), today);
  assert.ok(blocker > plain);
}

export function test_atrasado_estado_scores_like_en_progreso() {
  // 'Atrasado' is NOT in EXCLUDED_STATES, so it scores.
  // Same date, both overdue by 5 days → same formula output.
  const late = make({ estado: 'Atrasado', fecha_limite: '2026-04-08' }); // -5 days
  const prog = make({ estado: 'En progreso', fecha_limite: '2026-04-08' }); // -5 days
  assert.equal(scoreActivity(late, today), scoreActivity(prog, today));
}

export function test_urgente_flag_does_not_affect_score() {
  // The `urgente` field in the JSON is a boolean marker but scoreActivity()
  // does not read it — only `bloqueaOtras` triggers the bonus.
  const plain   = scoreActivity(make({ fecha_limite: '2026-04-20' }), today);
  const urgente = scoreActivity(make({ fecha_limite: '2026-04-20', urgente: true }), today);
  assert.equal(urgente, plain);
}
