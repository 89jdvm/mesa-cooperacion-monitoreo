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
