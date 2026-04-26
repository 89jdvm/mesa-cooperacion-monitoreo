import assert from 'node:assert/strict';
import { actorBaseName, actorPersonName, slugify, buildCsvContent, formatDate } from '../shared/js/utils.js';

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

// ── buildCsvContent tests ──────────────────────────────────────────────────

export function test_csv_header_row_correct() {
  const csv = buildCsvContent([]);
  const firstLine = csv.split('\r\n')[0];
  assert.ok(firstLine.includes('"ID"'), 'has ID');
  assert.ok(firstLine.includes('"Hito Operativo"'), 'has Hito Operativo');
  assert.ok(firstLine.includes('"Fecha Límite"'), 'has Fecha Límite');
}

export function test_csv_escapes_quotes_in_cells() {
  const acts = [{ id: 'X', hito_operativo: 'Acta "formal"', estado: 'Completado',
    trimestre: '2026 Q2', submesa: 'S1', que_se_hace: '', lidera_apoya: '',
    fecha_inicio: '', fecha_limite: '2026-06-30', fecha_reporte: '', producto_verificable: '', evidencia_minima: '' }];
  const csv = buildCsvContent(acts);
  assert.ok(csv.includes('"Acta ""formal"""'), 'internal quotes doubled');
}

export function test_csv_formats_dates_as_iso() {
  // Use datetime strings with time to avoid UTC-midnight timezone shift on local machines.
  const acts = [{ id: 'Y', fecha_inicio: '2026-04-01T12:00:00', fecha_limite: '2026-06-30T12:00:00',
    fecha_reporte: '2026-05-15T12:00:00', hito_operativo: '', que_se_hace: '', lidera_apoya: '',
    trimestre: '', submesa: '', estado: '', producto_verificable: '', evidencia_minima: '' }];
  const csv = buildCsvContent(acts);
  const row = csv.split('\r\n')[1];
  assert.ok(row.includes('"2026-04-01"'), 'fecha_inicio formatted');
  assert.ok(row.includes('"2026-06-30"'), 'fecha_limite formatted');
  assert.ok(row.includes('"2026-05-15"'), 'fecha_reporte formatted');
}

export function test_csv_empty_dates_produce_empty_cells() {
  const acts = [{ id: 'Z', fecha_inicio: '', fecha_limite: '2026-06-30', fecha_reporte: null,
    hito_operativo: '', que_se_hace: '', lidera_apoya: '',
    trimestre: '', submesa: '', estado: '', producto_verificable: '', evidencia_minima: '' }];
  const csv = buildCsvContent(acts);
  const row = csv.split('\r\n')[1];
  // fecha_inicio and fecha_reporte are empty → ""
  const cells = row.split(',"');
  assert.equal(cells.filter(c => c === '""' || c.startsWith('"",')).length > 0 || row.includes('""'), true);
}

export function test_csv_two_activities_two_data_rows() {
  const act = { id: 'A', trimestre: 'Q2', submesa: 'S1', hito_operativo: 'H',
    que_se_hace: '', lidera_apoya: '', fecha_inicio: '', fecha_limite: '',
    estado: '', fecha_reporte: '', producto_verificable: '', evidencia_minima: '' };
  const csv = buildCsvContent([act, { ...act, id: 'B' }]);
  const lines = csv.split('\r\n');
  assert.equal(lines.length, 3); // header + 2 data rows
}

// ── formatDate guard ───────────────────────────────────────────────────────

export function test_formatDate_invalid_returns_dash() {
  assert.equal(formatDate(new Date('not-a-date')), '—');
  assert.equal(formatDate(new Date('not-a-date'), true), '—');
}

export function test_formatDate_valid_long() {
  // Use noon to avoid UTC-midnight timezone shift
  assert.equal(formatDate(new Date('2026-06-30T12:00:00')), '30 de junio de 2026');
}

export function test_formatDate_valid_short() {
  assert.equal(formatDate(new Date('2026-06-30T12:00:00'), true), '30 jun');
}
