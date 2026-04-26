# Dashboard Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 6 improvements to the Mesa de Cooperación dashboard: delete dead legacy JS, expand tests, add `?open=ID` deep-linking, add a live Informe tab (new module), and make the landing page show live cross-province stats.

**Architecture:** Static GitHub Pages site — vanilla ES modules, no build step, no npm runtime deps. Two province dashboards (`sucumbios/`, `orellana/`) share all logic via `shared/js/`. Data is fetched client-side from JSON files. Tests run with `node tests/run.js` (zero deps, custom runner auto-discovers `*.test.js`).

**Tech Stack:** Vanilla JS ES modules, HTML/CSS, Node.js 22 (tests only), Google Apps Script (Code.gs — deployed separately in browser)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `sucumbios/js/dashboard.js` | **Delete** | Dead legacy file, not imported anywhere |
| `orellana/js/dashboard.js` | **Delete** | Dead legacy file, not imported anywhere |
| `tests/informe.test.js` | **Create** | Tests for `computeInformeStats()` data helper |
| `tests/priority.test.js` | **Modify** | +2 tests: Atrasado scoring, urgente flag |
| `tests/mi-trabajo-state.test.js` | **Modify** | +2 tests: single-atrasada boundary, Rechazado counts |
| `tests/dashboard.test.js` | **Create** | Tests for `inferSubmesa()` exported helper |
| `shared/js/dashboard.js` | **Modify** | Add `?open` deep-link + export `inferSubmesa` for tests |
| `shared/js/informe.js` | **Create** | New module: `renderInforme()` + exported `computeInformeStats()` |
| `shared/js/shell.js` | **Modify** | Add "Informe" tab to tab bar |
| `shared/js/panel.js` | **Read-only ref** | `SUBMESA_LABELS_BY_PROVINCE` pattern to copy into informe.js |
| `index.html` | **Modify** | Live stats from both JSON files via inline module script |
| `apps-script/Code.gs` | **Modify** | `getDashUrlForActor()` appends `?open=<id>` to reminder links |

---

## Task 1: Delete dead legacy JS files

**Files:**
- Delete: `sucumbios/js/dashboard.js`
- Delete: `orellana/js/dashboard.js`

- [ ] **Step 1: Verify neither file is imported**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
grep -r "sucumbios/js/dashboard\|orellana/js/dashboard" --include="*.html" --include="*.js" .
```

Expected output: only matches in `.superpowers/` brainstorm files (not in any real HTML or JS).

- [ ] **Step 2: Delete the files**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
rm sucumbios/js/dashboard.js orellana/js/dashboard.js
```

- [ ] **Step 3: Run tests to confirm nothing broke**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
node tests/run.js
```

Expected: `47 passed · 0 failed`

- [ ] **Step 4: Commit**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
git add -u
git commit -m "chore: delete unused legacy dashboard JS files

sucumbios/js/dashboard.js and orellana/js/dashboard.js were a prior
implementation not imported by any HTML file.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Expand test suite — priority and mi-trabajo-state boundaries

**Files:**
- Modify: `tests/priority.test.js`
- Modify: `tests/mi-trabajo-state.test.js`

- [ ] **Step 1: Add 2 tests to priority.test.js**

Append to the end of `tests/priority.test.js`:

```js
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
```

- [ ] **Step 2: Run to verify new tests pass**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
node tests/run.js
```

Expected: `49 passed · 0 failed`

- [ ] **Step 3: Add 2 tests to mi-trabajo-state.test.js**

Append to the end of `tests/mi-trabajo-state.test.js`:

```js
export function test_state_B_with_single_atrasada() {
  // One Atrasado/Rechazado alone is not enough to trigger state C.
  // Threshold is >= 2.
  const me = [
    make({ estado: 'Atrasado', fecha_limite: '2026-04-01' }),
    make({ estado: 'En progreso', fecha_limite: '2026-05-01' }),
    make({ estado: 'Completado', fecha_reporte: '2026-04-10', fecha_limite: '2026-04-12' })
  ];
  assert.equal(determineState(me, today, { rankInPodio: null }), 'B');
}

export function test_state_C_treats_rechazado_same_as_atrasado() {
  // Rechazado counts toward the atrasadas >= 2 threshold just like Atrasado.
  const me = [
    make({ estado: 'Atrasado', fecha_limite: '2026-04-01' }),
    make({ estado: 'Rechazado', fecha_limite: '2026-04-03' }),
    make({ estado: 'En progreso', fecha_limite: '2026-05-01' })
  ];
  assert.equal(determineState(me, today, { rankInPodio: null }), 'C');
}
```

- [ ] **Step 4: Run to verify all pass**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
node tests/run.js
```

Expected: `51 passed · 0 failed`

- [ ] **Step 5: Commit**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
git add tests/priority.test.js tests/mi-trabajo-state.test.js
git commit -m "test: add boundary tests for priority scoring and mi-trabajo state

- urgente flag has no effect on score (only bloqueaOtras does)
- Atrasado estado scores same as En progreso at same date
- single Atrasado alone stays state B (threshold is >= 2)
- Rechazado counts toward atrasadas same as Atrasado

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Export inferSubmesa + add inferSubmesa tests

The `inferSubmesa` function in `shared/js/dashboard.js` is the most brittle piece of logic in the codebase — it keyword-matches institutional names to submesa IDs. It has zero tests. We export it and test it.

**Files:**
- Modify: `shared/js/dashboard.js` — add `export` to `inferSubmesa`
- Create: `tests/dashboard.test.js`

- [ ] **Step 1: Export inferSubmesa from dashboard.js**

In `shared/js/dashboard.js`, change line 92 from:

```js
function inferSubmesa(a) {
```

to:

```js
export function inferSubmesa(a) {
```

That's the only change — the function body is unchanged.

- [ ] **Step 2: Create tests/dashboard.test.js**

```js
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
```

- [ ] **Step 3: Run tests**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
node tests/run.js
```

Expected: `61 passed · 0 failed`

- [ ] **Step 4: Commit**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
git add shared/js/dashboard.js tests/dashboard.test.js
git commit -m "test: export inferSubmesa and add 10 keyword-matching tests

inferSubmesa is the most brittle logic in the codebase — it maps
institutional name strings to submesa IDs. Tests document both
provinces and the Mesa fallback.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Deep-link `?open=<id>` to activity modal

When actors click an email reminder link, they land on the dashboard homepage. Adding `?open=SUC-2026-Q2-007` opens the activity modal automatically on first load.

**Files:**
- Modify: `shared/js/dashboard.js` — handle `?open` param after first paint
- Modify: `apps-script/Code.gs` — append `&open=<id>` to reminder email dashboard links

- [ ] **Step 1: Update shared/js/dashboard.js**

In `initDashboard`, after the `paint()` call at the bottom, add a one-time deep-link opener. The full updated `initDashboard` function (replace from line 13 to line 75):

```js
export async function initDashboard({ dataUrl, actorsUrl, logUrl, formUrl, province, provinceLabel }) {
  const app = document.getElementById('app');
  app.innerHTML = '<div style="padding:60px;text-align:center;color:var(--muted)">Cargando…</div>';

  const [activities, actors] = await Promise.all([
    fetchJSON(dataUrl),
    loadActors(actorsUrl, province)
  ]);
  activities.forEach(a => { if (!a.submesa || a.submesa === 'Mesa') a.submesa = inferSubmesa(a); });

  let actor = resolveActorFromBrowser(actors);

  const state = { tab: currentTab() };

  const paint = async () => {
    // Gate Mi trabajo tab: anonymous visitors can't access it.
    if (state.tab === 'mi-trabajo' && !actor) {
      state.tab = 'panel';
      history.replaceState(null, '', '#panel');
    }

    const main = renderShell({ province, provinceLabel, actor, activeTab: state.tab });
    const today = new Date();

    if (state.tab === 'panel') renderPanel(main, { activities, today, provinceLabel });
    else if (state.tab === 'actividades') renderActividades(main, { activities, today, provinceLabel });
    else if (state.tab === 'mi-trabajo') renderMiTrabajo(main, { activities, actor, today, formUrl });
    else if (state.tab === 'timeline') renderTimeline(main, { activities, today });
    else if (state.tab === 'informe') renderInforme(main, { activities, today, provinceLabel });
  };

  app.addEventListener('click', e => {
    const tabEl = e.target.closest('[data-tab]');
    if (tabEl) {
      e.preventDefault();
      state.tab = tabEl.dataset.tab;
      history.replaceState(null, '', '#' + state.tab);
      paint();
      return;
    }
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'logout') {
      e.preventDefault();
      clearIdentityFromBrowser();
      actor = null;
      const clean = new URL(window.location.href);
      clean.searchParams.delete('actor');
      clean.searchParams.delete('token');
      history.replaceState(null, '', clean.pathname + clean.hash);
      state.tab = 'panel';
      history.replaceState(null, '', '#panel');
      paint();
    }
  });

  window.addEventListener('hashchange', () => {
    state.tab = currentTab();
    paint();
  });

  initActivityModal({ activities, actor, logUrl, formUrl });
  await paint();

  // Deep-link: open activity modal on first paint only if ?open=<id> is in URL.
  const openId = new URLSearchParams(location.search).get('open');
  if (openId) {
    window.dispatchEvent(new CustomEvent('open-activity', { detail: { id: openId } }));
  }
}
```

Also add the `renderInforme` import at the top of `shared/js/dashboard.js` (alongside the other imports):

```js
import { renderInforme } from './informe.js';
```

Note: `renderInforme` is imported here even though `informe.js` doesn't exist yet — it will be created in Task 6. If you want to avoid a load error before Task 6 is done, implement Tasks 5 and 6 before testing in the browser.

- [ ] **Step 2: Update apps-script/Code.gs — getDashUrlForActor**

In `Code.gs`, find `getDashUrlForActor` (line ~1178). Replace:

```js
function getDashUrlForActor(provincia, actorSlug, token) {
  const base = CONFIG.DASHBOARD_URL_SUCUMBIOS;
  if (!actorSlug || !token) return base;
  const sep = base.includes('?') ? '&' : '?';
  return base + sep + 'actor=' + encodeURIComponent(actorSlug) + '&token=' + encodeURIComponent(token) + '#mi-trabajo';
}
```

With:

```js
function getDashUrlForActor(provincia, actorSlug, token, openId) {
  const base = CONFIG.DASHBOARD_URL_SUCUMBIOS;
  if (!actorSlug || !token) return base;
  let url = base + '?actor=' + encodeURIComponent(actorSlug) + '&token=' + encodeURIComponent(token);
  if (openId) url += '&open=' + encodeURIComponent(openId);
  url += '#mi-trabajo';
  return url;
}
```

Then update the two call sites in `enviarRecordatoriosDiarios` where `getDashUrlForActor` is called (around line 98):

```js
// Before (existing):
const dashUrl = CONFIG.DASHBOARD_URL_SUCUMBIOS;

// After — pass the activity id so the email link opens that specific activity:
// Inside the per-actor forEach loops, replace dashUrl with:
const dashUrl = getDashUrlForActor(provincia, a.slug, a.token, id);
```

Specifically, the `dashUrl` constant near line 98 is used for all actors of that activity. Change it to be computed per actor inside each `actores.forEach(a => { ... })` block. The `generarEmailRecordatorio` call receives `dashUrl` as a param — pass `getDashUrlForActor(provincia, a.slug, a.token, id)` instead of the shared `dashUrl`.

- [ ] **Step 3: Run tests**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
node tests/run.js
```

Expected: `61 passed · 0 failed` (no new tests for this item — it's a behaviour change, not a pure-function addition)

- [ ] **Step 4: Commit**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
git add shared/js/dashboard.js apps-script/Code.gs
git commit -m "feat: deep-link ?open=<id> opens activity modal on first load

Email reminder links now include ?open=<activity-id> so actors land
directly on the activity modal instead of the homepage. One-time
dispatch via open-activity CustomEvent after first paint.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Add Informe tab to shell.js

Add the "Informe" tab button to the navigation bar. This must happen before `informe.js` is created so the tab wiring is in place.

**Files:**
- Modify: `shared/js/shell.js`

- [ ] **Step 1: Add Informe to the allTabs array**

In `shared/js/shell.js`, find the `renderTabs` function (line ~50). Replace the `allTabs` array:

```js
const allTabs = [
  { key: 'panel', label: 'Panel', requires: null },
  { key: 'actividades', label: 'Actividades', requires: null },
  { key: 'mi-trabajo', label: 'Mi trabajo', requires: 'actor' },
  { key: 'timeline', label: 'Línea de Tiempo', requires: null }
];
```

With:

```js
const allTabs = [
  { key: 'panel', label: 'Panel', requires: null },
  { key: 'actividades', label: 'Actividades', requires: null },
  { key: 'mi-trabajo', label: 'Mi trabajo', requires: 'actor' },
  { key: 'timeline', label: 'Línea de Tiempo', requires: null },
  { key: 'informe', label: 'Informe', requires: null }
];
```

- [ ] **Step 2: Add 'informe' to TABS in dashboard.js**

In `shared/js/dashboard.js` line 11, change:

```js
const TABS = ['panel', 'actividades', 'mi-trabajo', 'timeline'];
```

To:

```js
const TABS = ['panel', 'actividades', 'mi-trabajo', 'timeline', 'informe'];
```

- [ ] **Step 3: Run tests**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
node tests/run.js
```

Expected: `61 passed · 0 failed`

- [ ] **Step 4: Commit**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
git add shared/js/shell.js shared/js/dashboard.js
git commit -m "feat: add Informe tab to dashboard navigation

Tab is public (no actor required). renderInforme() wired in
dashboard.js paint() — implementation follows in next commit.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Create shared/js/informe.js — Live Informe tab

New module with two exports: `computeInformeStats()` (pure, testable) and `renderInforme()` (DOM render). The render function mirrors the static `informe-q2.html` structure but is always live.

**Files:**
- Create: `shared/js/informe.js`
- Create: `tests/informe.test.js`

- [ ] **Step 1: Write failing tests first**

Create `tests/informe.test.js`:

```js
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
```

- [ ] **Step 2: Run tests — they must FAIL**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
node tests/run.js
```

Expected: 3 failures (`informe.js` doesn't exist yet).

- [ ] **Step 3: Create shared/js/informe.js**

```js
// shared/js/informe.js — Live Informe tab
import { escapeHtml, formatDate, daysBetween } from './utils.js';

const SUBMESA_LABELS_BY_PROVINCE = {
  'Sucumbíos': {
    S1: 'S1 · Gestión Ambiental',
    S2: 'S2 · Agroproductivo',
    S3: 'S3 · Patrimonio Cultural',
    S4: 'S4 · Social',
    S5: 'S5 · Gobernanza',
  },
  'Orellana': {
    S1: 'S1 · Gestión Ambiental',
    S2: 'S2 · Nacionalidades',
    S3: 'S3 · Fomento Productivo',
  },
};

// ── Pure data helper — exported for tests ─────────────────────────────────────

export function computeInformeStats(activities) {
  const total = activities.length;
  const completadas = activities.filter(a => a.estado === 'Completado');
  const atrasadas   = activities.filter(a => a.estado === 'Atrasado');
  const enProgreso  = activities.filter(a =>
    a.estado === 'En progreso' || a.estado.startsWith('Reportada')
  );
  const noIniciadas = activities.filter(a => a.estado === 'No iniciado');
  const pct = total > 0 ? Math.round((completadas.length / total) * 100) : 0;

  // Group completadas by submesa
  const completadasBySubmesa = {};
  for (const a of completadas) {
    const key = a.submesa || 'Mesa';
    if (!completadasBySubmesa[key]) completadasBySubmesa[key] = [];
    completadasBySubmesa[key].push(a);
  }

  // Risk: overdue or has a blocker note
  const riesgo = activities.filter(a =>
    a.estado === 'Atrasado' || (a.notas_bloqueador && a.notas_bloqueador.trim())
  );

  return { total, completadas, atrasadas, enProgreso, noIniciadas, pct, completadasBySubmesa, riesgo };
}

// ── Render ────────────────────────────────────────────────────────────────────

export function renderInforme(mount, { activities, today, provinceLabel }) {
  const labels = SUBMESA_LABELS_BY_PROVINCE[provinceLabel] || SUBMESA_LABELS_BY_PROVINCE['Sucumbíos'];
  const submesaKeys = Object.keys(labels);
  const stats = computeInformeStats(activities);

  mount.innerHTML = `
    <div style="max-width:860px;margin:0 auto">
      ${renderHero(stats, today, provinceLabel)}
      ${renderResumen(stats)}
      ${renderSubmesaAvance(stats, activities, submesaKeys, labels)}
      ${renderCompletadas(stats, submesaKeys, labels)}
      ${renderRiesgo(stats, today)}
      <div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--line);font-size:11px;color:var(--muted);text-align:center">
        Datos en tiempo real · Mesa de Cooperación de ${escapeHtml(provinceLabel)} · Hoja de Ruta 2026–2028
      </div>
    </div>
  `;
}

// ── Section renderers ─────────────────────────────────────────────────────────

function renderHero(stats, today, provinceLabel) {
  const q = `${today.getFullYear()} Q${Math.floor(today.getMonth() / 3) + 1}`;
  return `
    <div style="background:linear-gradient(135deg,var(--primary-dark,#1e3a8a),var(--primary,#1e40af) 60%,var(--primary-accent,#3b82f6));
      color:#fff;border-radius:var(--r-xl,12px);padding:28px 32px;
      display:grid;grid-template-columns:auto 1fr;gap:32px;align-items:center;margin-bottom:20px">
      <div style="text-align:center">
        <div style="font-size:64px;font-weight:800;letter-spacing:-0.04em;line-height:1">${stats.pct}%</div>
        <div style="font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:.1em;margin-top:4px">Avance general</div>
      </div>
      <div>
        <div style="font-size:14px;opacity:.9;font-weight:500;margin-bottom:16px">
          ${stats.completadas.length} de ${stats.total} actividades completadas y verificadas · ${q}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${pill(stats.completadas.length, 'Completadas', false)}
          ${pill(stats.enProgreso.length, 'En progreso', false)}
          ${pill(stats.atrasadas.length, 'Atrasadas', stats.atrasadas.length > 0)}
          ${pill(stats.noIniciadas.length, 'Por iniciar', false)}
        </div>
      </div>
    </div>
  `;
}

function pill(n, label, warn) {
  const bg = warn ? 'rgba(220,38,38,0.35)' : 'rgba(255,255,255,0.18)';
  const border = warn ? 'rgba(220,38,38,0.5)' : 'rgba(255,255,255,0.28)';
  return `<div style="background:${bg};border:1px solid ${border};border-radius:20px;
    padding:7px 14px;display:flex;flex-direction:column;align-items:center;min-width:80px">
    <span style="font-size:22px;font-weight:800;line-height:1.1">${n}</span>
    <span style="font-size:10px;opacity:.8;text-transform:uppercase;letter-spacing:.06em;margin-top:2px">${escapeHtml(label)}</span>
  </div>`;
}

function renderResumen(stats) {
  const cards = [
    { n: stats.completadas.length, l: 'Completadas',  color: 'var(--green,#16a34a)',   bg: 'var(--green-bg,#f0fdf4)' },
    { n: stats.enProgreso.length,  l: 'En progreso',  color: 'var(--primary,#1e40af)', bg: '#eff6ff' },
    { n: stats.atrasadas.length,   l: 'Atrasadas',    color: 'var(--red,#dc2626)',      bg: 'var(--red-bg,#fef2f2)' },
    { n: stats.noIniciadas.length, l: 'No iniciadas', color: 'var(--muted,#6b7280)',    bg: 'var(--line-2,#f1f5f9)' },
  ];
  return `
    <section style="margin-bottom:20px">
      <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:12px">
        Resumen de avance
      </h3>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
        ${cards.map(c => `
          <div style="background:${c.bg};border-radius:10px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:800;color:${c.color};letter-spacing:-0.02em">${c.n}</div>
            <div style="font-size:11px;color:${c.color};font-weight:600;margin-top:4px">${escapeHtml(c.l)}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderSubmesaAvance(stats, activities, submesaKeys, labels) {
  const fillColor = pct => pct >= 60 ? 'var(--green,#16a34a)' : pct >= 30 ? 'var(--amber,#ca8a04)' : 'var(--orange,#ea580c)';

  const cards = submesaKeys.map(key => {
    const acts = activities.filter(a => a.submesa === key);
    const done = acts.filter(a => a.estado === 'Completado').length;
    const late = acts.filter(a => a.estado === 'Atrasado').length;
    const total = acts.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const next = acts.filter(a => a.estado !== 'Completado')
      .sort((a, b) => new Date(a.fecha_limite) - new Date(b.fecha_limite))[0];

    return `
      <div style="background:var(--surface,#fff);border:1px solid var(--line,#e2e8f0);
        border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="font-size:13px;font-weight:700;color:var(--ink)">${escapeHtml(labels[key] || key)}</div>
          <div style="font-size:18px;font-weight:800;color:var(--ink)">${pct}%
            ${late > 0 ? `<span style="font-size:11px;color:var(--red,#dc2626);margin-left:4px">⚠ ${late}</span>` : ''}
          </div>
        </div>
        <div style="height:7px;background:var(--line-2,#f1f5f9);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${fillColor(pct)};border-radius:4px"></div>
        </div>
        <div style="font-size:11px;color:var(--muted)">${done} de ${total} completadas</div>
        ${next ? `<div style="font-size:11px;color:var(--ink-3);border-top:1px solid var(--line-2);padding-top:8px">
          <span style="color:var(--muted);font-size:10px;text-transform:uppercase">Próximo:</span><br>
          ${escapeHtml(next.hito_operativo)}
          <span style="color:var(--muted)"> · ${formatDate(new Date(next.fecha_limite), true)}</span>
        </div>` : ''}
      </div>
    `;
  }).join('');

  return `
    <section style="margin-bottom:20px">
      <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:12px">
        Avance por submesa
      </h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px">
        ${cards}
      </div>
    </section>
  `;
}

function renderCompletadas(stats, submesaKeys, labels) {
  if (stats.completadas.length === 0) {
    return `<section style="margin-bottom:20px">
      <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:12px">
        Actividades completadas y verificadas
      </h3>
      <div style="font-size:13px;color:var(--muted);padding:16px 0">Sin actividades completadas aún.</div>
    </section>`;
  }

  const groups = submesaKeys
    .map(key => ({ key, acts: (stats.completadasBySubmesa[key] || []) }))
    .filter(g => g.acts.length > 0);

  const rows = groups.map(g => `
    <div style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:8px;background:var(--line-2,#f1f5f9);
        border-radius:6px;padding:7px 12px;margin-bottom:8px">
        <span style="font-size:11px;font-weight:700;color:var(--primary)">${escapeHtml(labels[g.key] || g.key)}</span>
        <span style="font-size:11px;color:var(--muted);margin-left:auto">${g.acts.length} actividad${g.acts.length > 1 ? 'es' : ''}</span>
      </div>
      ${g.acts.map(a => `
        <div style="display:grid;grid-template-columns:110px 1fr 110px;gap:12px;
          padding:8px 10px;font-size:12px;border-bottom:1px solid var(--line-2);align-items:center">
          <span style="font-family:monospace;font-size:10px;color:var(--primary);font-weight:600">${escapeHtml(a.id)}</span>
          <span style="color:var(--ink-2);font-weight:500">${escapeHtml(a.hito_operativo)}</span>
          <span style="font-size:11px;color:var(--muted);white-space:nowrap;text-align:right">
            ${a.fecha_reporte ? formatDate(new Date(a.fecha_reporte), true) : '—'}
          </span>
        </div>
      `).join('')}
    </div>
  `).join('');

  return `
    <section style="margin-bottom:20px">
      <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:12px">
        Actividades completadas y verificadas <span style="font-weight:400;color:var(--muted)">(${stats.completadas.length})</span>
      </h3>
      ${rows}
    </section>
  `;
}

function renderRiesgo(stats, today) {
  const header = `
    <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:12px">
      Situaciones de riesgo
    </h3>
  `;
  if (stats.riesgo.length === 0) {
    return `<section style="margin-bottom:20px">${header}
      <div style="display:flex;align-items:center;gap:7px;font-size:13px;color:var(--green-ink,#166534);
        background:var(--green-bg,#f0fdf4);border-radius:6px;padding:10px 14px">
        ✓ Sin actividades en riesgo en este momento.
      </div>
    </section>`;
  }

  const rows = stats.riesgo.map(a => {
    const daysLate = daysBetween(new Date(a.fecha_limite), today);
    const isLate = a.estado === 'Atrasado';
    return `
      <div style="padding:12px 14px;margin-bottom:8px;background:var(--surface,#fff);
        border:1px solid ${isLate ? 'var(--red,#dc2626)' : 'var(--amber,#ca8a04)'};
        border-left-width:3px;border-radius:8px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div>
            <div style="font-size:10px;font-family:monospace;color:var(--primary);font-weight:600">${escapeHtml(a.id)}</div>
            <div style="font-size:13px;font-weight:600;color:var(--ink);margin-top:2px">${escapeHtml(a.hito_operativo)}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:3px">${escapeHtml(a.lidera_apoya)}</div>
          </div>
          ${isLate ? `<div style="font-size:11px;font-weight:700;color:var(--red,#dc2626);white-space:nowrap">
            ⚠ ${daysLate}d de atraso
          </div>` : ''}
        </div>
        ${a.notas_bloqueador ? `<div style="font-size:12px;color:var(--ink-3);margin-top:8px;
          padding-top:8px;border-top:1px solid var(--line-2)">
          <b>Situación:</b> ${escapeHtml(a.notas_bloqueador)}
        </div>` : ''}
      </div>
    `;
  }).join('');

  return `<section style="margin-bottom:20px">${header}${rows}</section>`;
}
```

- [ ] **Step 4: Run tests — they must pass**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
node tests/run.js
```

Expected: `64 passed · 0 failed`

- [ ] **Step 5: Commit**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
git add shared/js/informe.js tests/informe.test.js
git commit -m "feat: live Informe tab with computeInformeStats + renderInforme

New shared/js/informe.js module — 3 sections: hero strip, avance
por submesa, completadas grouped by submesa, situaciones de riesgo.
computeInformeStats() is pure and tested independently of DOM.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Live cross-province landing page (index.html)

Replace static hardcoded numbers in `index.html` with live stats fetched from both JSON files.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add id attributes to the stat elements**

In `index.html`, find the Orellana card stats block (around line 227):

```html
<div class="stats">
  <div class="stat"><div class="n orellana-n">79</div><div class="l">Actividades</div></div>
  <div class="stat"><div class="n orellana-n">3</div><div class="l">Submesas</div></div>
  <div class="stat"><div class="n orellana-n">8</div><div class="l">Trimestres</div></div>
</div>
```

Replace with:

```html
<div class="stats">
  <div class="stat"><div class="n orellana-n" id="orl-total">79</div><div class="l">Actividades</div></div>
  <div class="stat"><div class="n orellana-n" id="orl-pct">—%</div><div class="l">Completadas</div></div>
  <div class="stat"><div class="n orellana-n" id="orl-late" style="color:var(--red,#dc2626)">—</div><div class="l">Atrasadas</div></div>
</div>
```

Find the Sucumbíos card stats block (around line 248):

```html
<div class="stats">
  <div class="stat"><div class="n sucumbios-n">93</div><div class="l">Actividades</div></div>
  <div class="stat"><div class="n sucumbios-n">5</div><div class="l">Submesas</div></div>
  <div class="stat"><div class="n sucumbios-n">8</div><div class="l">Trimestres</div></div>
</div>
```

Replace with:

```html
<div class="stats">
  <div class="stat"><div class="n sucumbios-n" id="suc-total">93</div><div class="l">Actividades</div></div>
  <div class="stat"><div class="n sucumbios-n" id="suc-pct">—%</div><div class="l">Completadas</div></div>
  <div class="stat"><div class="n sucumbios-n" id="suc-late" style="color:var(--red,#dc2626)">—</div><div class="l">Atrasadas</div></div>
</div>
```

Also add an "última actualización" placeholder just before the `<div class="cta">` in each card. In the Orellana card, before `<div class="cta">`:

```html
<div class="submesas" id="orl-updated" style="padding-top:10px;border-top:1px solid var(--line-2)"></div>
```

In the Sucumbíos card, before `<div class="cta">`:

```html
<div class="submesas" id="suc-updated" style="padding-top:10px;border-top:1px solid var(--line-2)"></div>
```

- [ ] **Step 2: Add inline module script before `</body>`**

Add just before the closing `</body>` tag in `index.html`:

```html
<script type="module">
  const MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  function fmtShort(iso) {
    if (!iso) return null;
    const d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return null;
    return d.getDate() + ' ' + MESES_CORTOS[d.getMonth()] + ' ' + d.getFullYear();
  }
  function calcStats(acts) {
    const total = acts.length;
    const done  = acts.filter(a => a.estado === 'Completado').length;
    const late  = acts.filter(a => a.estado === 'Atrasado').length;
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
    const lastReport = acts
      .map(a => a.fecha_reporte).filter(Boolean)
      .sort().at(-1);
    return { total, pct, late, lastReport };
  }
  function inject(prefix, stats) {
    const q = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    q(prefix + '-total', stats.total);
    q(prefix + '-pct',   stats.pct + '%');
    q(prefix + '-late',  stats.late);
    const upd = document.getElementById(prefix + '-updated');
    if (upd) {
      const d = fmtShort(stats.lastReport);
      upd.textContent = d ? 'Actualizado: ' + d : '';
    }
  }
  try {
    const [suc, orl] = await Promise.all([
      fetch('sucumbios/data/actividades.json').then(r => r.json()),
      fetch('orellana/data/actividades.json').then(r => r.json())
    ]);
    inject('suc', calcStats(suc));
    inject('orl', calcStats(orl));
  } catch (e) {
    // Silently fall back to hardcoded values already in HTML
  }
</script>
```

- [ ] **Step 3: Run tests (no new tests — pure DOM change)**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
node tests/run.js
```

Expected: `64 passed · 0 failed`

- [ ] **Step 4: Commit**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
git add index.html
git commit -m "feat: live cross-province stats on landing page

index.html now fetches both province JSONs and injects real
completion %, late count, and last-updated date into the cards.
Falls back to hardcoded values if fetch fails.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Final test run and push

- [ ] **Step 1: Run full test suite**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
node tests/run.js
```

Expected output:
```
64 passed · 0 failed
```

If any test fails, fix it before proceeding.

- [ ] **Step 2: Verify file count of deleted files**

```bash
ls "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard/sucumbios/js/" 2>&1
ls "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard/orellana/js/" 2>&1
```

Expected: both directories are gone or contain no `dashboard.js`.

- [ ] **Step 3: Push to origin**

```bash
cd "/Users/jdlovesyou/Agentic Workflows/Entregable 5/mesa-cooperacion-dashboard"
git push origin main
```

Expected: push succeeds, GitHub Pages rebuilds in ~60s.

---

## Self-Review

**Spec coverage check:**

| Spec item | Task |
|-----------|------|
| Delete legacy JS | Task 1 |
| Expand tests — priority + mi-trabajo-state | Task 2 |
| inferSubmesa tests (brittle logic, 0 tests) | Task 3 (added — spec mentioned this implicitly under test expansion) |
| Deep-link `?open=ID` — dashboard.js | Task 4 |
| Deep-link `?open=ID` — Code.gs | Task 4 |
| Informe tab — shell.js + dashboard.js wiring | Task 5 |
| Informe tab — informe.js module | Task 6 |
| Informe tests — computeInformeStats | Task 6 |
| Live landing page | Task 7 |
| Final test gate + push | Task 8 |
| Print CSS for informes | **Not needed** — both files already have complete @media print blocks (verified by grep) |

**Placeholder scan:** No TBDs, all code blocks complete, all commands have expected output.

**Type consistency:** `computeInformeStats` is defined in Task 6 and imported in `tests/informe.test.js` (same task). `renderInforme` imported in `dashboard.js` in Task 4 — `informe.js` created in Task 6. Note: if running tasks strictly in order, the browser will error on the Informe tab between Task 4 and Task 6 (import of non-existent module). Workaround: do Tasks 5 and 6 before opening the browser, or temporarily comment out the import in Task 4 and add it back in Task 6.

**Test count:** 47 existing + 2 (priority) + 2 (mi-trabajo-state) + 10 (inferSubmesa) + 3 (informe) = **64 total**.
