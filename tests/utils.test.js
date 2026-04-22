import assert from 'node:assert/strict';
import { actorBaseName, actorPersonName, slugify } from '../shared/js/utils.js';

export function test_baseName_strips_em_dash_person_suffix() {
  assert.equal(
    actorBaseName('Dirección Gestión Ambiental GADPS — Holger Salas'),
    'Dirección Gestión Ambiental GADPS'
  );
}

export function test_baseName_strips_legacy_apoyo_suffix() {
  assert.equal(
    actorBaseName('Secretaría Técnica (GADPS) - Apoyo'),
    'Secretaría Técnica (GADPS)'
  );
}

export function test_baseName_strips_legacy_numeric_suffix() {
  assert.equal(
    actorBaseName('Secretaría Técnica (GADPS) - 2'),
    'Secretaría Técnica (GADPS)'
  );
}

export function test_baseName_noop_when_no_suffix() {
  assert.equal(
    actorBaseName('CorpoSucumbíos'),
    'CorpoSucumbíos'
  );
}

export function test_baseName_handles_nulls() {
  assert.equal(actorBaseName(null), '');
  assert.equal(actorBaseName(''), '');
  assert.equal(actorBaseName(undefined), '');
}

export function test_personName_extracts_suffix() {
  assert.equal(
    actorPersonName('Dirección Gestión Ambiental GADPS — Holger Salas'),
    'Holger Salas'
  );
}

export function test_personName_falls_back_to_baseName_when_no_em_dash() {
  assert.equal(
    actorPersonName('CorpoSucumbíos'),
    'CorpoSucumbíos'
  );
}

export function test_personName_falls_back_for_legacy_apoyo() {
  assert.equal(
    actorPersonName('Secretaría Técnica (GADPS) - Apoyo'),
    'Secretaría Técnica (GADPS)'
  );
}

export function test_two_people_same_institution_get_distinct_slugs() {
  const gabriel = slugify('Dirección Nacionalidades y Turismo GADPS — Gabriel Calderón');
  const juan    = slugify('Dirección Nacionalidades y Turismo GADPS — Juan Cerda');
  assert.notEqual(gabriel, juan);
  assert.equal(gabriel, 'direccion-nacionalidades-y-turismo-gadps-gabriel-calderon');
  assert.equal(juan,    'direccion-nacionalidades-y-turismo-gadps-juan-cerda');
}

export function test_two_people_same_institution_share_baseName() {
  const gabriel = actorBaseName('Dirección Nacionalidades y Turismo GADPS — Gabriel Calderón');
  const juan    = actorBaseName('Dirección Nacionalidades y Turismo GADPS — Juan Cerda');
  assert.equal(gabriel, juan);
  assert.equal(gabriel, 'Dirección Nacionalidades y Turismo GADPS');
}

// Edge cases flagged in V1 review

export function test_baseName_double_suffix_em_dash_first_wins() {
  // "Inst — Persona - Apoyo": em-dash strip is greedy via .+$, eats everything after
  // first em-dash including the legacy "- Apoyo" tail.
  assert.equal(
    actorBaseName('Dirección X GADPS — Holger - Apoyo'),
    'Dirección X GADPS'
  );
}

export function test_baseName_only_suffix_returns_empty() {
  // Defensive: garbage input shouldn't blow up.
  assert.equal(actorBaseName('— Solo sufijo'), '');
}

export function test_personName_multiple_em_dashes_takes_first_split() {
  // Regex /—\s*(.+)$/ is greedy on .+, so for "A — B — C" it returns "B — C".
  // This is the intended behavior: the FIRST em-dash separates institution from person,
  // and a person's name might legitimately contain another em-dash.
  assert.equal(
    actorPersonName('Inst — Person — Apellido'),
    'Person — Apellido'
  );
}

export function test_baseName_realistic_lidera_apoya_match() {
  // Integration test: simulating the mi-trabajo.js filter logic.
  // For "Inst GADPS — Holger" actor, derive baseName, then check that an
  // activity with lidera_apoya="Inst GADPS, cooperantes" matches via .includes().
  const actorName = 'Dirección Gestión Ambiental GADPS — Holger Salas';
  const ladText  = 'Dirección Gestión Ambiental GADPS, cooperantes';
  assert.equal(ladText.includes(actorBaseName(actorName)), true);
}

export function test_baseName_substring_safety() {
  // If "Inst Foo" exists and "Inst Foo Bar" also exists, the includes() check
  // could over-match. Document current behavior: includes is substring-based.
  const ladForFooBar = 'Inst Foo Bar';
  // baseName of "Inst Foo" is "Inst Foo" — and YES it's a substring of "Inst Foo Bar"
  // This is a known limitation; our actual institutional names don't collide.
  assert.equal(ladForFooBar.includes(actorBaseName('Inst Foo — Persona')), true);
}
