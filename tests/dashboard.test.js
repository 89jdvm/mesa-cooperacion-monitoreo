import assert from 'node:assert/strict';
import { inferSubmesa } from '../shared/js/dashboard.js';

function act(provincia, lidera_apoya, submesa = '') {
  return { provincia, lidera_apoya, submesa };
}

// ── Sucumbíos ────────────────────────────────────────────────────

export function test_sucumbios_gestión_ambiental_is_S1() {
  assert.equal(inferSubmesa(act('Sucumbíos', 'Dirección Gestión Ambiental GADPS')), 'S1');
}

export function test_sucumbios_corposucumbios_is_S2() {
  assert.equal(inferSubmesa(act('Sucumbíos', 'CorpoSucumbíos')), 'S2');
  assert.equal(inferSubmesa(act('Sucumbíos', 'Corposucumbios')), 'S2'); // ASCII fallback
}

export function test_sucumbios_nacionalidades_turismo_is_S3() {
  assert.equal(inferSubmesa(act('Sucumbíos', 'Dirección Nacionalidades y Turismo GADPS')), 'S3');
}

export function test_sucumbios_solidario_is_S4() {
  assert.equal(inferSubmesa(act('Sucumbíos', 'Sucumbíos Solidario')), 'S4');
}

export function test_sucumbios_planificacion_is_S5() {
  assert.equal(inferSubmesa(act('Sucumbíos', 'Dirección de Planificación GADPS')), 'S5');
  assert.equal(inferSubmesa(act('Sucumbíos', 'Planificacion')), 'S5'); // without accent
}

// ── Orellana ────────────────────────────────────────────────────

export function test_orellana_gestión_ambiental_is_S1() {
  assert.equal(inferSubmesa(act('Orellana', 'Dirección Gestión Ambiental GADPO')), 'S1');
}

export function test_orellana_nacionalidades_is_S2() {
  assert.equal(inferSubmesa(act('Orellana', 'Dirección Nacionalidades GADPO')), 'S2');
}

export function test_orellana_fomento_productivo_is_S3() {
  assert.equal(inferSubmesa(act('Orellana', 'Fomento Productivo GADPO')), 'S3');
}

// ── Fallbacks ───────────────────────────────────────────────────

export function test_unknown_returns_Mesa() {
  assert.equal(inferSubmesa(act('Sucumbíos', 'Secretaría Técnica (GADPS)')), 'Mesa');
}

export function test_already_set_submesa_is_not_re_inferred() {
  // inferSubmesa is only called when submesa is '' or 'Mesa'.
  // The dashboard.js guard is: if (!a.submesa || a.submesa === 'Mesa') a.submesa = inferSubmesa(a)
  // This test documents that the function itself doesn't read the existing submesa field.
  const a = act('Sucumbíos', 'Secretaría Técnica (GADPS)', 'S5');
  // inferSubmesa ignores the existing submesa field — it re-infers from lidera_apoya.
  // ST doesn't match any keyword → returns Mesa (caller decides whether to overwrite).
  assert.equal(inferSubmesa(a), 'Mesa');
}
