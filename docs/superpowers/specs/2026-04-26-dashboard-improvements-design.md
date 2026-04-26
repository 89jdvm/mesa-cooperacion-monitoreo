# Dashboard Improvements — Design Spec
**Date:** 2026-04-26  
**Project:** Mesa de Cooperación — Monitoreo Dashboard  
**Scope:** 6 improvements across UX, reporting, test coverage, and code hygiene

---

## Context

Static GitHub Pages dashboard (vanilla JS, no build step) serving two provinces — Sucumbíos (93 activities, 5 submesas) and Orellana (79 activities, 3 submesas). Data lives in JSON files loaded client-side. 47 tests passing. This spec covers 6 improvements selected for highest impact within one session.

---

## Item 1 — Deep-link `?open=<id>` to activity modal

### Problem
Email reminder links (from Apps Script) send actors to the province dashboard homepage. Actors must then find their activity manually in the table. Every reminder email = extra friction.

### Design
Add URL param handling in `shared/js/dashboard.js` after `paint()` resolves. If `?open=<id>` is present in the URL, fire a synthetic `open-activity` CustomEvent after the first paint so `activity-modal.js` opens the modal for that ID.

```
initDashboard() → paint() → (on first paint only) check URLSearchParams for 'open' → dispatchEvent('open-activity', { id })
```

The `open-activity` event is already listened for by `initActivityModal()` — no changes needed in `activity-modal.js`.

In `apps-script/Code.gs`, update `getFormUrl()` to append `&open=<id>` to the dashboard URL embedded in reminder emails, so actors land directly on their activity.

**Constraint:** Only fire the deep-link open on the first paint, not on tab switches. Use a `opened` flag in `initDashboard` scope.

**Files changed:**
- `shared/js/dashboard.js` — add `?open` param handling after first paint
- `apps-script/Code.gs` — update `getDashUrlForActor()` to include `open=<id>` when building reminder email links

---

## Item 2 — Print-ready informe trimestral

### Problem
`sucumbios/informe-q2.html` and `orellana/informe-q2.html` have a "Imprimir / Exportar PDF" button but no `@media print` CSS. The printed output includes nav bars, action buttons, and colored backgrounds that waste ink and break page flow.

### Design
Add a `@media print` block to both informe HTML files (inline `<style>` so no new CSS file needed):

```css
@media print {
  .informe-topbar, .btn-print, .btn-back { display: none !important; }
  body { background: #fff; }
  .hero-strip { background: #1e3a8a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .submesa-section { page-break-before: auto; break-inside: avoid; }
  .submesa-section:nth-child(2) { page-break-before: always; }
  .informe-wrap { padding: 0; max-width: 100%; }
  .print-header { display: block !important; }
}
```

The `.print-header` div already exists in both files (currently `display:none`) — it renders the CI/province header text for print. It will become visible only in print mode.

Page breaks: force a break before the second submesa section so each submesa starts on a new page when there are ≥3 submesas.

**Files changed:**
- `sucumbios/informe-q2.html` — add `@media print` block
- `orellana/informe-q2.html` — add `@media print` block

---

## Item 3 — Live "Informe" tab in both dashboards

### Problem
`sucumbios/informe-q2.html` and `orellana/informe-q2.html` are static HTML that must be manually updated when data changes. They duplicate the logic already in the dashboard's JSON-loaded data.

### Design
New module `shared/js/informe.js` — `renderInforme(mount, { activities, today, provinceLabel, submesaLabels })`.

Sections mirroring the static informe pages:
1. **Hero strip** — total %, completadas count, trimestre, province name
2. **Resumen de avance** — 4 stat cards (Completadas, En progreso, Atrasadas, No iniciadas)
3. **Avance por submesa** — one card per submesa: pct bar, done/total, next milestone, late count
4. **Tabla de completadas** — list of activities with `estado === 'Completado'`, grouped by submesa
5. **Situaciones de riesgo** — activities with `estado === 'Atrasado'` or `notas_bloqueador` present

Pct calculation: count-based (`done / total * 100`), same as the static pages.

Add `'informe'` to the `TABS` array in `dashboard.js`, wire `renderInforme` in the `paint()` dispatch, pass `submesaLabels` from the province's label table.

Add an "Informe" tab button in `shell.js`'s tab bar render.

**The static `informe-q2.html` files are kept** — they serve as standalone printable snapshots (Q2 specifically). The new tab shows live current-quarter data.

**Files changed:**
- `shared/js/informe.js` (new) — render function, ~120 lines
- `shared/js/dashboard.js` — add 'informe' to TABS, import renderInforme, wire in paint()
- `shared/js/shell.js` — add Informe tab button to tab bar

---

## Item 4 — Expand test suite

### New tests to add

**`tests/informe.test.js`** (new file, 3 tests):
- `test_informe_pct_is_count_based` — pct = done/total, not average of porcentaje field
- `test_informe_groups_completadas_by_submesa` — completadas correctly bucketed per submesa key
- `test_informe_riesgo_includes_atrasado_and_bloqueador` — both Atrasado and notas_bloqueador-present activities appear in risk section

Since `informe.js` is a pure render function (returns HTML string), tests import a data-extraction helper extracted from it.

**`tests/priority.test.js`** — 2 new tests:
- `test_atrasado_estado_scores_higher_than_en_progreso_same_date` — Atrasado activities aren't in EXCLUDED_STATES, so they score; confirm the formula treats them correctly
- `test_urgente_flag_does_not_affect_score` — the `urgente` boolean in the JSON has no effect on `scoreActivity()` (currently undocumented; make explicit)

**`tests/mi-trabajo-state.test.js`** — 2 new tests:
- `test_state_B_with_single_atrasada` — one Atrasado/Rechazado alone is not enough for state C (boundary: requires ≥2)
- `test_state_C_treats_rechazado_same_as_atrasado` — Rechazado counts toward the `atrasadas >= 2` threshold (already in code, not yet tested)

**Files changed:**
- `tests/informe.test.js` (new)
- `tests/priority.test.js` — append 2 tests
- `tests/mi-trabajo-state.test.js` — append 2 tests

---

## Item 5 — Live cross-province landing page

### Problem
`index.html` shows static hardcoded numbers (79, 93, 3, 5, 8). These will drift from reality as activities are completed.

### Design
Replace the hardcoded stat `<div>` blocks with `id`-tagged placeholders (`orl-total`, `orl-done-pct`, `orl-late`, `suc-total`, `suc-done-pct`, `suc-late`). Add an inline `<script type="module">` that fetches both JSONs in parallel, computes stats, and injects them.

```js
const [suc, orl] = await Promise.all([
  fetch('sucumbios/data/actividades.json').then(r => r.json()),
  fetch('orellana/data/actividades.json').then(r => r.json())
]);
// compute pct, late count, last-updated from data
// inject into DOM
```

Add a "Última actualización" line below each card showing the most recent `fecha_reporte` in that province's data. This gives visitors immediate confidence the data is current.

**No new files.** All logic is inline in `index.html`. Stats degrade gracefully if fetch fails (keep showing the hardcoded fallback text).

**Files changed:**
- `index.html` — add id tags to stat elements, add inline module script

---

## Item 6 — Delete dead legacy JS

### Problem
`sucumbios/js/dashboard.js` and `orellana/js/dashboard.js` are a prior implementation (~21 KB each) that no HTML file imports. They add confusion and maintenance surface.

### Verification before delete
- `grep -r "sucumbios/js/dashboard" .` — confirm no import
- `grep -r "orellana/js/dashboard" .` — confirm no import

### Action
Delete both files. Commit with message explaining the cleanup.

**Files deleted:**
- `sucumbios/js/dashboard.js`
- `orellana/js/dashboard.js`

---

## Architecture invariants (must not break)

- No build step — all JS is ES modules loaded directly by `<script type="module">`
- No external runtime deps — `node tests/run.js` must pass with zero npm installs
- `shared/js/` modules are imported by both provinces — changes there affect both simultaneously
- `formUrl` is empty for Orellana — any new code that uses `formUrl` must guard with `if (formUrl)`
- `escapeHtml` must be applied to all user-controlled fields before `innerHTML` injection

---

## Test gate

After all items are implemented:
```
node tests/run.js
```
Expected: all tests pass (47 existing + 7 new = 54 total), 0 failed.

---

## Implementation order

1. Item 6 (delete legacy JS) — 2 min, clears confusion
2. Item 4 (tests) — write tests first, some will fail until Item 3 ships
3. Item 1 (deep-link) — self-contained, no new files
4. Item 2 (print CSS) — self-contained, no new files
5. Item 3 (Informe tab) — new module, wires into dashboard
6. Item 5 (live landing) — inline script in index.html
7. Run full test suite, commit

---

## Out of scope

- Orellana `formUrl` — requires manual Apps Script browser deploy
- Orellana `guia.html` / `taller-lanzamiento.html` — no taller scheduled
- Email notification history UI — `logUrl` still empty; no Apps Script endpoint exposes the Log sheet as CSV
- Pagination / virtualization — 172 total activities is well within browser rendering limits
