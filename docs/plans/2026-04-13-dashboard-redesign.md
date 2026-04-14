# Dashboard Redesign & Notifications Rollout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Mesa de Cooperación dashboard with an Executive-Scorecard visual direction, role-aware IA (Panel / Actividades / Mi trabajo / Timeline), URL-based personalization, and a respectful gamification system; harden and deploy the existing notifications Apps Script.

**Architecture:** Static HTML/CSS/JS on GitHub Pages; per-province JSON as source of truth; shared renderer modules per view; pure-function utilities (identity, priority, gamification, state) testable with plain Node `assert`. Apps Script unchanged in shape — small hardening + test helper only.

**Tech Stack:** HTML5 · CSS3 (tokens + BEM-ish classes) · Vanilla ES2020 JS (ES modules) · Node-native `assert` for pure-function tests (no framework) · Google Apps Script (existing).

**Spec:** [docs/specs/2026-04-13-dashboard-redesign.md](../specs/2026-04-13-dashboard-redesign.md)

---

## File Structure

New / rewritten files:

| File | Responsibility |
|---|---|
| `apps-script/Code.gs` | Existing — add `testEnviarTodosLosTipos()`, fix `obtenerEmailsActor` substring bug |
| `tests/run.js` | Minimal Node test runner (plain `assert`, no deps) |
| `tests/identity.test.js` | URL param + localStorage + fallback resolution |
| `tests/priority.test.js` | "Necesita atención" scoring |
| `tests/gamification.test.js` | Podio, submesa race, buscan apoyo, racha computations |
| `tests/mi-trabajo-state.test.js` | State A/B/C determination |
| `shared/js/identity.js` | `resolveActor({url, storage, activities}) → {slug, name, submesa}` |
| `shared/js/priority.js` | `scoreActivity(activity, today) → number`; `topNeedsAttention(activities, today, n=5)` |
| `shared/js/gamification.js` | `computePodio`, `computeSubmesaRace`, `buscanApoyo`, `computeRacha` |
| `shared/js/mi-trabajo-state.js` | `determineState(myActivities, today) → 'A' \| 'B' \| 'C'` |
| `shared/js/identity-picker.js` | Modal + dropdown UI; writes to localStorage |
| `shared/js/shell.js` | Top bar (brand + identity widget + cambiar) + tab nav + province theming |
| `shared/js/panel.js` | Panel view renderer (hero, stats, atención, submesa, agenda, gamification, footer) |
| `shared/js/actividades.js` | Actividades view renderer (verify banner, pills, controls, table, ⋯ menu) |
| `shared/js/mi-trabajo.js` | Mi trabajo view renderer (3-state hero, meta Q, urgente, agenda, submesa) |
| `shared/js/activity-modal.js` | Shared activity modal (description, meta, historial, actions) |
| `shared/js/timeline.js` | Gantt renderer — grouped by submesa, status-colored |
| `shared/js/dashboard.js` | Entry point — orchestrates identity, fetches data, mounts views by tab |
| `shared/js/utils.js` | `formatDate`, `daysBetween`, `slugify`, `fetchJSON` |
| `shared/css/tokens.css` | Colors, spacing scale, type scale, shadows, radii |
| `shared/css/dashboard.css` | All component classes (cards, pills, badges, hero, table, etc.) |
| `shared/css/mobile.css` | Responsive overrides (≤ 768px) |
| `orellana/index.html` | Minimal shell; imports shared modules; sets `--primary` tokens |
| `sucumbios/index.html` | Minimal shell; sets `--primary` to blue |
| `index.html` (root landing) | Minor polish only |

Modified:
- `apps-script/Code.gs` (lines ~706–724 for `obtenerEmailsActor`; append test helper)

---

## Task 1 — Add `testEnviarTodosLosTipos()` helper + fix substring bug in Code.gs

**Files:**
- Modify: `apps-script/Code.gs`

- [ ] **Step 1: Read current `obtenerEmailsActor` (lines ~706–724) to confirm substring logic.**

Run: open `apps-script/Code.gs` and locate `function obtenerEmailsActor(ss, actorTexto, provincia)`.

- [ ] **Step 2: Replace `obtenerEmailsActor` with token-based exact matching.**

Replace:
```javascript
function obtenerEmailsActor(ss, actorTexto, provincia) {
  const hoja = ss.getSheetByName('Actores');
  if (!hoja) return [];

  const datos = hoja.getDataRange().getValues();
  const emails = [];

  for (let i = 1; i < datos.length; i++) {
    const nombre = datos[i][0];
    const email = datos[i][1];
    const prov = datos[i][3];

    if (email && prov === provincia && actorTexto.includes(nombre)) {
      emails.push(email);
    }
  }

  return emails;
}
```

With:
```javascript
function obtenerEmailsActor(ss, actorTexto, provincia) {
  const hoja = ss.getSheetByName('Actores');
  if (!hoja) return [];

  // Tokenize the "Lidera / Apoya" text on common separators, trim, drop empties.
  const tokens = String(actorTexto || '')
    .split(/[,;·]| y | and /i)
    .map(t => t.trim())
    .filter(Boolean);

  const datos = hoja.getDataRange().getValues();
  const emails = [];

  for (let i = 1; i < datos.length; i++) {
    const nombre = String(datos[i][0] || '').trim();
    const email = datos[i][1];
    const prov = datos[i][3];

    if (!email || prov !== provincia || !nombre) continue;
    // Strip the " - Apoyo" / " - 2" suffixes used in actores_plantilla.csv to
    // distinguish lead vs apoyo contacts for the same actor label.
    const base = nombre.replace(/\s*-\s*(Apoyo|\d+)$/i, '').trim();

    if (tokens.some(t => t === base || t === nombre)) {
      emails.push(email);
    }
  }

  return emails;
}
```

- [ ] **Step 3: Append `testEnviarTodosLosTipos()` at end of file (before the last `}` if any, otherwise at EOF).**

```javascript
/**
 * TEST helper — envía un email de cada tipo al usuario que ejecuta,
 * usando la primera actividad de cada provincia. Útil para validar
 * maquetación de emails sin depender de fechas reales.
 */
function testEnviarTodosLosTipos() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const myEmail = Session.getActiveUser().getEmail();
  if (!myEmail) throw new Error('No se pudo detectar tu email. Ejecuta autenticado.');

  ['Orellana', 'Sucumbíos'].forEach(provincia => {
    const hoja = ss.getSheetByName(provincia);
    if (!hoja) return;
    const datos = hoja.getDataRange().getValues();
    if (datos.length < 2) return;
    const headers = datos[0];
    const cols = getColumnIndices(headers);
    const fila = datos[1];

    const base = {
      provincia,
      actividad: fila[cols.hito_operativo],
      que: fila[cols.que_se_hace],
      producto: fila[cols.producto_verificable],
      evidencia: fila[cols.evidencia_minima],
      actorTexto: fila[cols.lidera_apoya],
      fechaLimite: new Date(),
      dashUrl: provincia === 'Orellana' ? CONFIG.DASHBOARD_URL_ORELLANA : CONFIG.DASHBOARD_URL_SUCUMBIOS,
      formUrl: getFormUrl(fila[cols.id])
    };

    ['recordatorio', 'vencimiento', 'atraso_warning', 'escalacion'].forEach(tipo => {
      const diasRestantes = tipo === 'recordatorio' ? 7
        : tipo === 'vencimiento' ? 0
        : tipo === 'atraso_warning' ? -3
        : -7;
      enviarEmail([myEmail], {
        asunto: `[TEST · ${tipo.toUpperCase()}] ${provincia} — ${base.actividad}`,
        cuerpo: generarEmailRecordatorio({ ...base, diasRestantes, tipo })
      });
    });
  });

  Logger.log('testEnviarTodosLosTipos: 8 emails enviados a ' + myEmail);
}
```

- [ ] **Step 4: In Apps Script editor, run `testEnviarTodosLosTipos` manually; confirm 8 emails land at `delftjd@gmail.com`.**

Expected: 4 emails per province (recordatorio, vencimiento, atraso_warning, escalacion) = 8 total.

- [ ] **Step 5: Commit.**

```bash
git add apps-script/Code.gs
git commit -m "Harden Code.gs: token-exact actor matching + testEnviarTodosLosTipos helper"
```

---

## Task 2 — Test runner scaffolding

**Files:**
- Create: `tests/run.js`
- Create: `tests/_smoke.test.js`

- [ ] **Step 1: Write `tests/run.js` — minimal runner.**

```javascript
// tests/run.js — minimal test runner. No deps.
// Discovers *.test.js in tests/ and runs them.
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const here = new URL('.', import.meta.url).pathname;
const files = readdirSync(here).filter(f => f.endsWith('.test.js'));

let passed = 0, failed = 0;
for (const f of files) {
  const mod = await import(pathToFileURL(join(here, f)).href);
  for (const [name, fn] of Object.entries(mod)) {
    if (!name.startsWith('test_')) continue;
    try {
      await fn();
      console.log(`  ✓ ${f} :: ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ ${f} :: ${name}\n    ${e.message}`);
      failed++;
    }
  }
}
console.log(`\n${passed} passed · ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Write `tests/_smoke.test.js` to verify runner works.**

```javascript
import assert from 'node:assert/strict';
export function test_smoke_runner_works() {
  assert.equal(1 + 1, 2);
}
```

- [ ] **Step 3: Run and confirm.**

Run: `node tests/run.js`
Expected output includes: `✓ _smoke.test.js :: test_smoke_runner_works` and `1 passed · 0 failed`.

- [ ] **Step 4: Commit.**

```bash
git add tests/
git commit -m "Add Node-native test runner for pure-function modules"
```

---

## Task 3 — Identity resolver

**Files:**
- Create: `shared/js/identity.js`
- Create: `tests/identity.test.js`

- [ ] **Step 1: Write failing tests at `tests/identity.test.js`.**

```javascript
import assert from 'node:assert/strict';
import { resolveActor } from '../shared/js/identity.js';

const actors = [
  { slug: 'coord-ambiental', name: 'Coord. Ambiental', submesa: 'S1' },
  { slug: 'st-gadpo', name: 'Secretaría Técnica (GADPO)', submesa: 'Mesa' }
];

export function test_resolves_from_url_param() {
  const storage = { get: () => null, set: () => {} };
  const url = new URL('https://x/?actor=coord-ambiental');
  const r = resolveActor({ url, storage, actors });
  assert.equal(r.slug, 'coord-ambiental');
  assert.equal(r.name, 'Coord. Ambiental');
}

export function test_url_wins_over_storage_and_persists() {
  let stored = null;
  const storage = { get: () => 'st-gadpo', set: v => { stored = v; } };
  const url = new URL('https://x/?actor=coord-ambiental');
  const r = resolveActor({ url, storage, actors });
  assert.equal(r.slug, 'coord-ambiental');
  assert.equal(stored, 'coord-ambiental');
}

export function test_falls_back_to_storage_when_no_url() {
  const storage = { get: () => 'st-gadpo', set: () => {} };
  const url = new URL('https://x/');
  const r = resolveActor({ url, storage, actors });
  assert.equal(r.slug, 'st-gadpo');
}

export function test_returns_null_when_no_url_no_storage() {
  const storage = { get: () => null, set: () => {} };
  const url = new URL('https://x/');
  const r = resolveActor({ url, storage, actors });
  assert.equal(r, null);
}

export function test_ignores_unknown_slug() {
  const storage = { get: () => null, set: () => {} };
  const url = new URL('https://x/?actor=ghost');
  const r = resolveActor({ url, storage, actors });
  assert.equal(r, null);
}
```

- [ ] **Step 2: Run — expect all to fail ("resolveActor not a function").**

Run: `node tests/run.js`
Expected: 5 failing tests.

- [ ] **Step 3: Implement `shared/js/identity.js`.**

```javascript
// shared/js/identity.js
// resolveActor({ url: URL, storage: {get,set}, actors: [{slug,name,submesa}] }) → {slug,name,submesa} | null
// URL param > storage > null. URL always writes back to storage.

const STORAGE_KEY = 'mesaActor';

export function resolveActor({ url, storage, actors }) {
  const fromUrl = url.searchParams.get('actor');
  let slug = fromUrl || storage.get(STORAGE_KEY);
  if (!slug) return null;

  const hit = actors.find(a => a.slug === slug);
  if (!hit) return null;

  if (fromUrl) storage.set(STORAGE_KEY, fromUrl);
  return hit;
}

// Browser wrapper — used from pages, not from tests.
export function resolveActorFromBrowser(actors) {
  return resolveActor({
    url: new URL(window.location.href),
    storage: {
      get: k => window.localStorage.getItem(k),
      set: (k, v) => window.localStorage.setItem(k, v)
    },
    actors
  });
}

export const IDENTITY_STORAGE_KEY = STORAGE_KEY;
```

- [ ] **Step 4: Run — expect all 5 to pass.**

Run: `node tests/run.js`
Expected: 6 passed · 0 failed.

- [ ] **Step 5: Commit.**

```bash
git add shared/js/identity.js tests/identity.test.js
git commit -m "Add identity resolver: URL param > localStorage > null"
```

---

## Task 4 — Priority scorer for "Necesita atención"

**Files:**
- Create: `shared/js/priority.js`
- Create: `tests/priority.test.js`

- [ ] **Step 1: Write failing tests.**

```javascript
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
```

- [ ] **Step 2: Run — expect failures.**

Run: `node tests/run.js`
Expected: priority tests fail.

- [ ] **Step 3: Implement `shared/js/priority.js`.**

```javascript
// shared/js/priority.js
// Priority scoring for "Necesita atención" (Panel) and "Lo más urgente" (Mi trabajo).
// score = max(0, -days) * 10 + max(0, 14 - days) + (blocker ? 20 : 0)

import { daysBetween } from './utils.js';

const EXCLUDED_STATES = new Set(['Completado', 'Reportada — pendiente verificación ST']);

export function scoreActivity(a, today) {
  if (EXCLUDED_STATES.has(a.estado)) return 0;
  const days = daysBetween(today, new Date(a.fecha_limite));
  const overdue = Math.max(0, -days) * 10;
  const near = Math.max(0, 14 - days);
  const blocker = a.bloqueaOtras ? 20 : 0;
  return overdue + near + blocker;
}

export function topNeedsAttention(activities, today, n = 5) {
  return activities
    .filter(a => !EXCLUDED_STATES.has(a.estado))
    .map(a => ({ a, s: scoreActivity(a, today) }))
    .filter(x => x.s > 0)
    .sort((x, y) => y.s - x.s || new Date(x.a.fecha_limite) - new Date(y.a.fecha_limite))
    .slice(0, n)
    .map(x => x.a);
}
```

- [ ] **Step 4: Create `shared/js/utils.js` (used here and later).**

```javascript
// shared/js/utils.js
export function daysBetween(from, to) {
  const ms = new Date(to).setHours(0,0,0,0) - new Date(from).setHours(0,0,0,0);
  return Math.round(ms / 86400000);
}

export function slugify(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

export function formatDate(d, short = false) {
  const x = new Date(d);
  const meses = short ? MESES_CORTOS : MESES;
  return short ? `${x.getDate()} ${meses[x.getMonth()]}` : `${x.getDate()} de ${meses[x.getMonth()]} de ${x.getFullYear()}`;
}

export async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url}: ${r.status}`);
  return r.json();
}
```

- [ ] **Step 5: Run — expect priority tests pass.**

Run: `node tests/run.js`
Expected: all passing.

- [ ] **Step 6: Commit.**

```bash
git add shared/js/priority.js shared/js/utils.js tests/priority.test.js
git commit -m "Add priority scorer for Necesita atención and Lo más urgente"
```

---

## Task 5 — Gamification computations

**Files:**
- Create: `shared/js/gamification.js`
- Create: `tests/gamification.test.js`

- [ ] **Step 1: Write failing tests.**

```javascript
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
```

- [ ] **Step 2: Run — expect failures.**

Run: `node tests/run.js`

- [ ] **Step 3: Implement `shared/js/gamification.js`.**

```javascript
// shared/js/gamification.js
import { daysBetween } from './utils.js';

const sameMonth = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const onTime = a =>
  a.estado === 'Completado' &&
  a.fecha_reporte &&
  new Date(a.fecha_reporte) <= new Date(a.fecha_limite);

export function computePodio(activities, today) {
  const counts = new Map();
  for (const a of activities) {
    if (!onTime(a)) continue;
    if (!sameMonth(new Date(a.fecha_reporte), today)) continue;
    counts.set(a.lidera_apoya, (counts.get(a.lidera_apoya) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([actor, count]) => ({ actor, count }))
    .sort((x, y) => y.count - x.count || x.actor.localeCompare(y.actor))
    .slice(0, 3);
}

export function computeSubmesaRace(activities) {
  const grouped = new Map();
  for (const a of activities) {
    const key = a.submesa || '—';
    const g = grouped.get(key) || { submesa: key, total: 0, done: 0, late: 0 };
    g.total++;
    if (a.estado === 'Completado') g.done++;
    if (a.estado === 'Atrasado') g.late++;
    grouped.set(key, g);
  }
  const rows = [...grouped.values()]
    .map(g => ({ ...g, pct: g.total ? Math.round((g.done / g.total) * 100) : 0 }))
    .sort((x, y) => y.pct - x.pct);
  if (rows.length) rows[0].leader = true;
  rows.slice(1).forEach(r => r.leader = false);
  return rows;
}

export function buscanApoyo(activities) {
  return activities
    .filter(a => a.estado === 'Atrasado')
    .map(a => ({
      id: a.id,
      title: a.hito_operativo,
      submesa: a.submesa,
      invitation: buildInvitation(a)
    }));
}

function buildInvitation(a) {
  const d = Math.abs(daysBetween(new Date(), new Date(a.fecha_limite)));
  return `Lleva ${d} días pendiente. Si algún miembro puede acompañar o facilitar, el Grupo Gestor lo agradece.`;
}

export function computeRacha(actor, activities, today) {
  // Count consecutive months ending at "today's month", going backwards, where:
  //   - at least 1 on-time completion by `actor`
  //   - no 'Atrasado' activity of `actor` with fecha_limite in that month
  const mine = activities.filter(a => a.lidera_apoya === actor);
  let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
  let streak = 0;
  while (streak < 48) { // safety cap
    const inMonth = mine.filter(a => sameMonth(new Date(a.fecha_limite), cursor));
    const hasLate = inMonth.some(a => a.estado === 'Atrasado');
    const hasOnTime = mine.some(a =>
      onTime(a) && a.fecha_reporte && sameMonth(new Date(a.fecha_reporte), cursor)
    );
    if (hasLate || !hasOnTime) break;
    streak++;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
  }
  return streak;
}
```

- [ ] **Step 4: Run — expect all green.**

Run: `node tests/run.js`

- [ ] **Step 5: Commit.**

```bash
git add shared/js/gamification.js tests/gamification.test.js
git commit -m "Add gamification: podio, submesa race, buscan apoyo, racha"
```

---

## Task 6 — Mi trabajo state determination

**Files:**
- Create: `shared/js/mi-trabajo-state.js`
- Create: `tests/mi-trabajo-state.test.js`

- [ ] **Step 1: Failing tests.**

```javascript
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
```

- [ ] **Step 2: Run — expect failures.**

- [ ] **Step 3: Implement.**

```javascript
// shared/js/mi-trabajo-state.js
import { daysBetween } from './utils.js';

export function determineState(myActivities, today, meta = {}) {
  const { rankInPodio = null } = meta;
  if (rankInPodio !== null && rankInPodio <= 3) return 'A';

  const atrasadas = myActivities.filter(a => a.estado === 'Atrasado').length;
  if (atrasadas >= 2) return 'C';

  const completedLast30 = myActivities.filter(a =>
    a.estado === 'Completado' &&
    a.fecha_reporte &&
    daysBetween(new Date(a.fecha_reporte), today) <= 30
  ).length;
  const activeLoad = myActivities.filter(a =>
    a.estado === 'En progreso' || a.estado === 'No iniciado'
  ).length;
  if (completedLast30 === 0 && activeLoad >= 3) return 'C';

  return 'B';
}
```

- [ ] **Step 4: Run — expect green.**

- [ ] **Step 5: Commit.**

```bash
git add shared/js/mi-trabajo-state.js tests/mi-trabajo-state.test.js
git commit -m "Add Mi trabajo state resolver (A podium / B on-track / C behind)"
```

---

## Task 7 — Design tokens + shared CSS rewrite

**Files:**
- Create: `shared/css/tokens.css`
- Rewrite: `shared/css/dashboard.css`

- [ ] **Step 1: Write `shared/css/tokens.css`.**

```css
/* shared/css/tokens.css — design tokens */
:root {
  /* Primary (overridden per-province via --primary/--primary-dark) */
  --primary: #1a6b3c;
  --primary-dark: #0d4a25;
  --primary-accent: #2d8f55;
  --primary-light: #e8f5ec;

  /* Semantic */
  --red: #dc2626; --red-bg: #fef2f2; --red-border: #fecaca; --red-ink: #991b1b;
  --orange: #ea580c;
  --amber: #ca8a04;
  --blue: #2563eb; --blue-bg: #eff6ff; --blue-ink: #1e40af; --blue-border: #93c5fd;
  --green: #16a34a; --green-bg: #dcfce7; --green-ink: #166534;
  --yellow-bg: #fef3c7; --yellow-ink: #92400e;

  /* Neutrals */
  --ink: #0f172a;
  --ink-2: #334155;
  --ink-3: #475569;
  --muted: #64748b;
  --muted-2: #94a3b8;
  --line: #e5e7eb;
  --line-2: #f1f5f9;
  --bg: #f7f8fa;
  --surface: #fff;

  /* Type scale */
  --fs-10: 10px; --fs-11: 11px; --fs-12: 12px; --fs-13: 13px; --fs-14: 14px;
  --fs-16: 16px; --fs-20: 20px; --fs-22: 22px; --fs-28: 28px; --fs-60: 60px;

  /* Spacing */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px;
  --s-6: 24px; --s-7: 32px;

  /* Radii */
  --r-sm: 6px; --r: 8px; --r-md: 10px; --r-lg: 12px; --r-xl: 14px;

  /* Shadows */
  --sh-sm: 0 2px 6px -2px rgba(15,23,42,0.08);
  --sh: 0 4px 14px -6px rgba(15,23,42,0.12);
  --sh-lg: 0 20px 50px -20px rgba(15,23,42,0.20);
}
```

- [ ] **Step 2: Back up existing `shared/css/dashboard.css` then replace with component classes listed below. This is the single largest change — keep it scoped to classes the renderers will use.**

```bash
mv shared/css/dashboard.css shared/css/dashboard.css.bak
```

Create new `shared/css/dashboard.css` (abridged skeleton — fill sections for each component as the renderers in later tasks require them; classes below are the minimum surface):

```css
@import './tokens.css';

* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
       background: var(--bg); color: var(--ink); min-height: 100vh; }
code, .mono { font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace; }

/* Shell */
.frame-top { background: var(--surface); border-bottom: 1px solid var(--line); padding: var(--s-3) var(--s-6); display: flex; justify-content: space-between; align-items: center; }
.brand { display: flex; align-items: center; gap: var(--s-2); }
.brand .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--primary); }
.brand .name { font-weight: 700; font-size: var(--fs-14); }
.brand .sub { font-size: var(--fs-11); color: var(--muted); }
.tabs { background: var(--surface); border-bottom: 1px solid var(--line); padding: 0 var(--s-6); display: flex; gap: 4px; }
.tab { padding: 14px 16px; font-size: var(--fs-13); font-weight: 500; color: var(--muted); border-bottom: 2px solid transparent; cursor: pointer; text-decoration: none; }
.tab.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
.whoami { display: flex; align-items: center; gap: var(--s-2); font-size: var(--fs-12); color: var(--ink-3); }
.whoami .avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--primary); color: #fff; font-weight: 700; font-size: var(--fs-12); display: flex; align-items: center; justify-content: center; }

/* Hero */
.hero { background: linear-gradient(135deg, var(--primary-dark), var(--primary) 60%, var(--primary-accent)); color: #fff; border-radius: var(--r-xl); padding: var(--s-6) 28px; display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-6); align-items: center; }
.hero .big { font-size: var(--fs-60); font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
.hero .pre { font-size: var(--fs-11); opacity: .7; text-transform: uppercase; letter-spacing: .1em; margin-bottom: var(--s-2); }
.hero .caption { font-size: var(--fs-13); opacity: .85; margin-top: var(--s-2); }
.hero .mini-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-4) var(--s-5); font-size: var(--fs-12); }
.hero .mini .l { opacity: .65; text-transform: uppercase; letter-spacing: .05em; font-size: var(--fs-10); }
.hero .mini .n { font-size: var(--fs-22); font-weight: 700; margin-top: 2px; }

/* Stat cards */
.cards-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s-3); margin-top: var(--s-4); }
.card-stat { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); padding: var(--s-4); }
.card-stat.warn { border-left: 3px solid var(--red); }
.card-stat .lbl { font-size: var(--fs-10); color: var(--muted); text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
.card-stat .num { font-size: var(--fs-28); font-weight: 800; line-height: 1; letter-spacing: -0.02em; margin-top: 4px; }
.card-stat.warn .num { color: var(--red); }
.card-stat .foot { font-size: var(--fs-11); color: var(--muted); margin-top: 6px; }

/* Panels (generic) */
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 18px 20px; }
.panel h4 { font-size: var(--fs-12); font-weight: 700; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 14px; display: flex; justify-content: space-between; }
.panel h4 .sub { font-size: var(--fs-11); color: var(--muted); font-weight: 500; text-transform: none; letter-spacing: 0; }

/* Pills */
.pill { padding: 7px 13px; border-radius: 20px; font-size: var(--fs-12); font-weight: 500; background: var(--surface); border: 1px solid var(--line); color: var(--ink-3); cursor: pointer; display: inline-flex; gap: 6px; }
.pill.active { background: var(--ink); color: #fff; border-color: var(--ink); }
.pill.red { border-color: var(--red-border); background: var(--red-bg); color: var(--red-ink); font-weight: 600; }

/* Badges */
.badge { padding: 3px 9px; border-radius: 5px; font-size: var(--fs-10); font-weight: 700; text-transform: uppercase; letter-spacing: .02em; display: inline-block; }
.badge.pend { background: var(--line-2); color: var(--muted); }
.badge.prog { background: var(--blue-bg); color: var(--blue-ink); }
.badge.done { background: var(--green-bg); color: var(--green-ink); }
.badge.late { background: var(--red-bg); color: var(--red-ink); }
.badge.verify { background: var(--yellow-bg); color: var(--yellow-ink); }

/* Table */
.tbl { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); overflow: hidden; }
.tbl .thead, .tbl .row { display: grid; grid-template-columns: 80px 1fr 180px 110px 130px 40px; gap: var(--s-4); padding: 12px 16px; align-items: center; font-size: var(--fs-12); }
.tbl .thead { background: #f8fafc; border-bottom: 1px solid var(--line); font-size: var(--fs-10); font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
.tbl .row { border-top: 1px solid var(--line-2); cursor: pointer; }
.tbl .row:first-of-type { border-top: 0; }
.tbl .row:hover { background: #f8fafc; }
.tbl .row.late { background: var(--red-bg); }
.tbl .row.verify { background: var(--blue-bg); }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); display: none; align-items: center; justify-content: center; z-index: 100; }
.modal-overlay.open { display: flex; }
.modal { background: var(--surface); border-radius: var(--r-xl); max-width: 680px; width: 92vw; max-height: 88vh; overflow: auto; padding: 24px 28px; }

/* Utilities */
.grid-2 { display: grid; grid-template-columns: 1.4fr 1fr; gap: var(--s-4); margin-top: 18px; }
.hidden { display: none !important; }
```

- [ ] **Step 3: Open `orellana/index.html` in browser (existing content) and confirm old file is backed up; new dashboard.css now loads but is incomplete — layout will be broken until renderers swap in. This is expected.**

- [ ] **Step 4: Commit.**

```bash
git add shared/css/tokens.css shared/css/dashboard.css shared/css/dashboard.css.bak
git commit -m "Introduce design tokens and rewrite shared CSS skeleton"
```

---

## Task 8 — Shell renderer (top bar + tabs + identity widget)

**Files:**
- Create: `shared/js/shell.js`

- [ ] **Step 1: Write `shared/js/shell.js`.**

```javascript
// shared/js/shell.js
import { resolveActorFromBrowser } from './identity.js';

export function renderShell({ province, provinceLabel, actor, activeTab }) {
  const root = document.getElementById('app');
  root.innerHTML = '';
  root.appendChild(renderTop(provinceLabel, actor));
  root.appendChild(renderTabs(activeTab, province));
  const main = document.createElement('main');
  main.className = 'main';
  main.id = 'main-content';
  root.appendChild(main);
  return main;
}

function renderTop(provinceLabel, actor) {
  const el = document.createElement('div');
  el.className = 'frame-top';
  el.innerHTML = `
    <div class="brand">
      <div class="dot"></div>
      <div>
        <div class="name">Mesa de Cooperación de ${provinceLabel}</div>
        <div class="sub">Hoja de Ruta 2026–2028</div>
      </div>
    </div>
    <div class="whoami">
      ${actor ? `
        <div class="avatar">${initials(actor.name)}</div>
        <div>
          <div class="nm" style="font-weight:600">${actor.name}</div>
          <div class="rl" style="font-size:11px;color:var(--muted)">${actor.submesa || 'Mesa'}</div>
        </div>
        <a href="#" class="change" data-action="change-actor" style="font-size:11px;color:var(--primary);margin-left:8px;text-decoration:none">Cambiar ▾</a>
      ` : `
        <a href="#" class="change" data-action="pick-actor" style="font-size:12px;color:var(--primary);text-decoration:none">Identificarme</a>
      `}
    </div>
  `;
  return el;
}

function renderTabs(activeTab, province) {
  const el = document.createElement('nav');
  el.className = 'tabs';
  const tabs = ['panel','actividades','mi-trabajo','timeline'];
  const labels = { panel: 'Panel', actividades: 'Actividades', 'mi-trabajo': 'Mi trabajo', timeline: 'Línea de Tiempo' };
  el.innerHTML = tabs.map(t =>
    `<a href="#${t}" class="tab ${t === activeTab ? 'active' : ''}" data-tab="${t}">${labels[t]}</a>`
  ).join('');
  return el;
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
}
```

- [ ] **Step 2: Commit.**

```bash
git add shared/js/shell.js
git commit -m "Add shell renderer: top bar, tabs, identity widget"
```

---

## Task 9 — Panel view renderer

**Files:**
- Create: `shared/js/panel.js`

- [ ] **Step 1: Implement `shared/js/panel.js`.**

```javascript
// shared/js/panel.js
import { formatDate, daysBetween } from './utils.js';
import { topNeedsAttention } from './priority.js';
import { computePodio, computeSubmesaRace, buscanApoyo } from './gamification.js';

export function renderPanel(mount, { activities, today, provinceLabel }) {
  const totals = computeTotals(activities);
  const atencion = topNeedsAttention(activities, today, 5);
  const race = computeSubmesaRace(activities);
  const podio = computePodio(activities, today);
  const apoyo = buscanApoyo(activities).slice(0, 3);
  const proximos = activities
    .filter(a => a.estado !== 'Completado')
    .map(a => ({ a, d: daysBetween(today, new Date(a.fecha_limite)) }))
    .filter(x => x.d >= 0 && x.d <= 30)
    .sort((x, y) => x.d - y.d)
    .slice(0, 5);

  mount.innerHTML = `
    ${renderHero(totals, today)}
    ${renderStatCards(totals)}
    <div class="grid-2">
      ${renderAtencion(atencion, today)}
      <div>
        ${renderSubmesaPanel(race)}
        ${renderProximos(proximos)}
      </div>
    </div>
    ${renderGamificationRow(podio, race, apoyo)}
    ${renderFooter()}
  `;
}

function computeTotals(acts) {
  const t = { total: acts.length, done: 0, progress: 0, late: 0, pending: 0 };
  for (const a of acts) {
    if (a.estado === 'Completado') t.done++;
    else if (a.estado === 'Atrasado') t.late++;
    else if (a.estado === 'En progreso') t.progress++;
    else t.pending++;
  }
  t.pct = t.total ? Math.round((t.done / t.total) * 100) : 0;
  return t;
}

function renderHero(t, today) {
  // 8 buckets of 3 months each for the sparkline; omitted trend source — render static proportional bars to pct
  const bars = Array.from({length: 8}, (_, i) => Math.max(8, (i + 1) * 10 * (t.pct / 70)))
    .map(h => `<div class="b" style="width:100%;background:rgba(255,255,255,0.3);border-radius:2px;height:${h}%"></div>`).join('');
  return `
    <section class="hero">
      <div>
        <div class="pre">Avance global</div>
        <div class="big">${t.pct}%</div>
        <div class="caption">${t.done} de ${t.total} actividades verificadas · Trimestre activo: ${quarterLabel(today)}</div>
        <div style="display:flex;gap:4px;height:32px;align-items:flex-end;margin-top:10px;opacity:0.85">${bars}</div>
      </div>
      <div class="mini-grid">
        <div class="mini"><div class="l">Trimestres restantes</div><div class="n">${quartersRemaining(today)}</div></div>
        <div class="mini"><div class="l">Actividades este Q</div><div class="n">${t.progress}</div></div>
        <div class="mini"><div class="l">Actores activos</div><div class="n">—</div></div>
        <div class="mini"><div class="l">Submesas</div><div class="n">—</div></div>
      </div>
    </section>
  `;
}

function renderStatCards(t) {
  return `
    <div class="cards-4">
      <div class="card-stat warn"><div class="lbl">Atrasadas</div><div class="num">${t.late}</div><div class="foot">Requieren atención</div></div>
      <div class="card-stat"><div class="lbl">En progreso</div><div class="num">${t.progress}</div><div class="foot">Ventana activa</div></div>
      <div class="card-stat"><div class="lbl">Completadas</div><div class="num">${t.done}</div><div class="foot">Verificadas ST</div></div>
      <div class="card-stat"><div class="lbl">Por iniciar</div><div class="num">${t.pending}</div><div class="foot">Próximo Q</div></div>
    </div>
  `;
}

function renderAtencion(items, today) {
  const dotClass = d => d < 0 ? 'red' : d <= 3 ? 'orange' : 'amber';
  const rows = items.map(a => {
    const d = daysBetween(today, new Date(a.fecha_limite));
    return `
      <div class="atn-item" data-id="${a.id}">
        <div class="pill-dot ${dotClass(d)}"></div>
        <div>
          <div style="font-size:13px;font-weight:500">${a.hito_operativo}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px">${a.lidera_apoya}${a.notas_bloqueador ? ' · ' + a.notas_bloqueador : ''}</div>
        </div>
        <div style="text-align:right;font-size:11px;color:var(--muted)">
          <div style="font-weight:700;color:${d < 0 ? 'var(--red)' : 'var(--ink)'}">${d < 0 ? `−${-d} días` : `en ${d} días`}</div>
          <div>${formatDate(new Date(a.fecha_limite), true)}</div>
        </div>
      </div>
    `;
  }).join('');
  return `<section class="panel"><h4>Necesita tu atención <a class="sub" href="#actividades">ver todas →</a></h4>${rows || '<div style="font-size:12px;color:var(--muted)">Nada urgente ahora mismo. ✓</div>'}</section>`;
}

function renderSubmesaPanel(race) {
  const fillColor = pct => pct >= 60 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--orange)';
  const rows = race.map(r => `
    <div class="submesa">
      <div style="display:flex;justify-content:space-between"><div style="font-size:12px;font-weight:600">${r.leader ? '🥇 ' : ''}${r.submesa}</div><div style="font-weight:700">${r.pct}%</div></div>
      <div style="height:6px;background:var(--line-2);border-radius:3px;margin-top:6px;overflow:hidden"><div style="height:100%;width:${r.pct}%;background:${fillColor(r.pct)};border-radius:3px"></div></div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">${r.done} de ${r.total} · ${r.late} atrasadas</div>
    </div>
  `).join('');
  return `<section class="panel"><h4>Avance por Submesa</h4>${rows}</section>`;
}

function renderProximos(items) {
  const rows = items.map(({a, d}) => `
    <div style="display:grid;grid-template-columns:70px 1fr 70px;gap:12px;padding:9px 0;border-top:1px solid var(--line-2);font-size:12px;align-items:center">
      <div style="color:var(--primary);font-weight:700;font-size:11px;text-transform:uppercase">${formatDate(new Date(a.fecha_limite), true)}</div>
      <div>${a.hito_operativo}</div>
      <div style="color:var(--muted);font-size:11px;text-align:right">${a.lidera_apoya.split(/[,(]/)[0].trim()}</div>
    </div>
  `).join('');
  return `<section class="panel" style="margin-top:14px"><h4>Próximos 30 días</h4>${rows || '<div style="font-size:12px;color:var(--muted)">Sin vencimientos próximos.</div>'}</section>`;
}

function renderGamificationRow(podio, race, apoyo) {
  return `<section style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:18px">
    ${renderPodio(podio)}
    ${renderRaceCard(race)}
    ${renderApoyo(apoyo)}
  </section>`;
}

function renderPodio(podio) {
  if (!podio.length) return `<div class="panel"><h4>🏅 Avanzadores del mes</h4><div style="font-size:12px;color:var(--muted)">Aún sin completadas este mes.</div></div>`;
  const medals = ['🥇','🥈','🥉'];
  const items = podio.map((p, i) => `
    <div style="padding:10px 0;border-top:1px solid var(--line-2);display:grid;grid-template-columns:24px 1fr auto;gap:10px;align-items:center">
      <div>${medals[i]}</div>
      <div style="font-size:12px;font-weight:600">${p.actor}</div>
      <div style="font-size:11px;color:var(--muted)"><b style="color:var(--ink);font-size:14px">${p.count}</b> a tiempo</div>
    </div>
  `).join('');
  return `<div class="panel"><h4>🏅 Avanzadores del mes</h4>${items}</div>`;
}

function renderRaceCard(race) {
  return `<div class="panel"><h4>🏁 Submesas en carrera</h4>
    ${race.slice(0,4).map(r => `
      <div style="display:grid;grid-template-columns:1fr 40px;gap:8px;align-items:center;padding:6px 0">
        <div><div style="font-size:12px;font-weight:600">${r.leader ? '👑 ' : ''}${r.submesa}</div>
          <div style="height:6px;background:var(--line-2);border-radius:3px;margin-top:4px;overflow:hidden"><div style="height:100%;width:${r.pct}%;background:var(--primary);border-radius:3px"></div></div></div>
        <div style="font-size:12px;font-weight:700;text-align:right">${r.pct}%</div>
      </div>`).join('')}
  </div>`;
}

function renderApoyo(items) {
  if (!items.length) return `<div class="panel"><h4>🤝 Buscan apoyo</h4><div style="font-size:12px;color:var(--muted)">Sin pendientes. ✓</div></div>`;
  return `<div class="panel"><h4>🤝 Buscan apoyo</h4>
    ${items.map(x => `
      <div style="border-left:3px solid var(--green);padding:4px 0 10px 12px;margin-bottom:8px">
        <div style="font-size:12px;font-weight:600">${x.title}</div>
        <div style="font-size:11px;color:var(--ink-3);margin-top:3px">${x.invitation}</div>
      </div>`).join('')}
  </div>`;
}

function renderFooter() {
  return `<div style="margin-top:18px;display:flex;justify-content:space-between;padding-top:14px;border-top:1px solid var(--line);font-size:11px;color:var(--muted)">
    <div>Datos actualizados automáticamente desde el Google Sheet</div>
    <div>Exportar CSV · Exportar PDF</div>
  </div>`;
}

function quarterLabel(d) {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()} Q${q}`;
}
function quartersRemaining(d) {
  const end = new Date(2028, 2, 31); // Q1 2028
  const months = (end.getFullYear() - d.getFullYear()) * 12 + (end.getMonth() - d.getMonth());
  return Math.max(0, Math.ceil(months / 3));
}
```

- [ ] **Step 2: Add `.pill-dot`, `.atn-item`, `.submesa` styles to `shared/css/dashboard.css` (append):**

```css
.atn-item { display: grid; grid-template-columns: 18px 1fr 130px; gap: 10px; padding: 11px 0; border-top: 1px solid var(--line-2); align-items: start; cursor: pointer; }
.atn-item:first-of-type { border-top: 0; }
.pill-dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 5px; background: var(--muted); }
.pill-dot.red { background: var(--red); }
.pill-dot.orange { background: var(--orange); }
.pill-dot.amber { background: var(--amber); }
.submesa { margin-bottom: 14px; }
.submesa:last-child { margin-bottom: 0; }
```

- [ ] **Step 3: Commit.**

```bash
git add shared/js/panel.js shared/css/dashboard.css
git commit -m "Add Panel view renderer + supporting styles"
```

---

## Task 10 — Actividades view renderer

**Files:**
- Create: `shared/js/actividades.js`

- [ ] **Step 1: Implement.**

```javascript
// shared/js/actividades.js
import { formatDate, daysBetween } from './utils.js';

export function renderActividades(mount, { activities, today }) {
  const state = { filter: 'todas', search: '' };

  const filter = () => {
    const txt = state.search.toLowerCase();
    return activities.filter(a => {
      if (state.filter === 'atrasadas' && a.estado !== 'Atrasado') return false;
      if (state.filter === 'verificar' && a.estado !== 'Reportada — pendiente verificación ST') return false;
      if (state.filter === 'mes') {
        const d = daysBetween(today, new Date(a.fecha_limite));
        if (d < 0 || d > 30) return false;
      }
      if (txt && !(a.id + ' ' + a.hito_operativo + ' ' + a.lidera_apoya).toLowerCase().includes(txt)) return false;
      return true;
    });
  };

  const paint = () => {
    const verifyCount = activities.filter(a => a.estado === 'Reportada — pendiente verificación ST').length;
    const lateCount = activities.filter(a => a.estado === 'Atrasado').length;
    const monthCount = activities.filter(a => {
      const d = daysBetween(today, new Date(a.fecha_limite));
      return d >= 0 && d <= 30;
    }).length;
    const rows = filter().map(a => rowHtml(a, today)).join('');
    mount.innerHTML = `
      ${verifyCount ? `
        <div style="background:linear-gradient(135deg,var(--blue-bg),#dbeafe);border:1px solid var(--blue-border);border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--blue-ink);text-transform:uppercase;letter-spacing:.06em">Cola de verificación</div>
            <div style="font-size:14px;font-weight:700;color:#0c4a6e;margin-top:4px">${verifyCount} actividad${verifyCount>1?'es':''} reportada${verifyCount>1?'s':''} como completadas</div>
            <div style="font-size:12px;color:var(--ink-2);margin-top:4px">Revisa evidencia y valida para cerrar el ciclo.</div>
          </div>
          <a href="#" data-filter="verificar" style="background:var(--blue-ink);color:#fff;padding:10px 16px;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none">Verificar ahora →</a>
        </div>` : ''}
      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
        ${pill('todas', 'Todas', activities.length, state.filter)}
        ${pill('atrasadas', 'Atrasadas', lateCount, state.filter, 'red')}
        ${pill('verificar', 'Verificación pendiente', verifyCount, state.filter)}
        ${pill('mes', 'Este mes', monthCount, state.filter)}
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <input id="act-search" placeholder="Buscar por ID, título o responsable…" value="${state.search}" style="flex:1;max-width:320px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:12px" />
        <div><button class="btn-sec">Exportar CSV</button></div>
      </div>
      <div class="tbl">
        <div class="thead"><div>ID</div><div>Actividad</div><div>Responsable</div><div>Plazo</div><div>Estado</div><div></div></div>
        ${rows || '<div style="padding:40px;text-align:center;color:var(--muted);font-size:12px">Sin resultados con ese filtro.</div>'}
      </div>
      <div style="font-size:11px;color:var(--muted);text-align:right;margin-top:10px">Mostrando ${filter().length} de ${activities.length}</div>
    `;

    mount.querySelectorAll('[data-filter]').forEach(el => el.addEventListener('click', e => {
      e.preventDefault(); state.filter = el.dataset.filter; paint();
    }));
    mount.querySelectorAll('.pill').forEach(el => el.addEventListener('click', e => {
      state.filter = el.dataset.filter; paint();
    }));
    mount.querySelector('#act-search').addEventListener('input', e => {
      state.search = e.target.value; paint();
    });
    mount.querySelectorAll('.tbl .row').forEach(el => el.addEventListener('click', e => {
      window.dispatchEvent(new CustomEvent('open-activity', { detail: { id: el.dataset.id } }));
    }));
  };

  paint();
}

function pill(key, label, count, active, style='') {
  return `<span class="pill ${active===key?'active':''} ${style}" data-filter="${key}">${label} <span style="background:rgba(15,23,42,0.08);padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700">${count}</span></span>`;
}

function rowHtml(a, today) {
  const d = daysBetween(today, new Date(a.fecha_limite));
  const statusMap = {
    'Completado': ['done', 'Completada'],
    'Atrasado': ['late', 'Atrasada'],
    'En progreso': ['prog', 'En progreso'],
    'No iniciado': ['pend', 'Por iniciar'],
    'Reportada — pendiente verificación ST': ['verify', 'Verificar']
  };
  const [cls, label] = statusMap[a.estado] || ['pend', a.estado];
  const rowCls = cls === 'late' ? 'late' : cls === 'verify' ? 'verify' : '';
  const plazoCls = d < 0 ? 'color:var(--red);font-weight:700' : d <= 7 ? 'color:var(--orange);font-weight:600' : '';
  return `
    <div class="row ${rowCls}" data-id="${a.id}">
      <div class="mono" style="font-size:11px;color:var(--muted)">${a.id}</div>
      <div>
        <div style="font-weight:500">${a.hito_operativo}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${a.que_se_hace ? a.que_se_hace.slice(0, 80) + (a.que_se_hace.length > 80 ? '…' : '') : ''}</div>
      </div>
      <div style="font-size:11px;color:var(--ink-3)">${a.lidera_apoya}</div>
      <div style="font-size:11px;${plazoCls}">${formatDate(new Date(a.fecha_limite), true)}${d<0?` · −${-d}d`:d<=14?` · en ${d}d`:''}</div>
      <div><span class="badge ${cls}">${label}</span></div>
      <div style="color:var(--muted-2);text-align:center">⋯</div>
    </div>
  `;
}
```

- [ ] **Step 2: Commit.**

```bash
git add shared/js/actividades.js
git commit -m "Add Actividades view renderer (verify banner, pills, table)"
```

---

## Task 11 — Identity picker modal

**Files:**
- Create: `shared/js/identity-picker.js`

- [ ] **Step 1: Implement.**

```javascript
// shared/js/identity-picker.js
import { IDENTITY_STORAGE_KEY } from './identity.js';

export function showPicker(actors) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.innerHTML = `
      <div class="modal" style="max-width:420px">
        <h3 style="font-size:18px;margin-bottom:6px">¿Quién eres en la Mesa?</h3>
        <p style="font-size:13px;color:var(--muted);margin-bottom:18px">Selecciona tu rol. Se guardará en tu navegador; puedes cambiarlo luego desde el menú superior.</p>
        <select id="actor-select" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;font-size:14px;margin-bottom:16px">
          <option value="">— elige —</option>
          ${actors.map(a => `<option value="${a.slug}">${a.name}${a.submesa ? ' — ' + a.submesa : ''}</option>`).join('')}
        </select>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button data-action="cancel" style="background:none;border:1px solid var(--line);padding:10px 16px;border-radius:8px;font-size:13px;cursor:pointer">Cancelar</button>
          <button data-action="ok" style="background:var(--primary);color:#fff;border:0;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Continuar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = val => { document.body.removeChild(overlay); resolve(val); };
    overlay.querySelector('[data-action="cancel"]').onclick = () => close(null);
    overlay.querySelector('[data-action="ok"]').onclick = () => {
      const slug = overlay.querySelector('#actor-select').value;
      if (!slug) return;
      localStorage.setItem(IDENTITY_STORAGE_KEY, slug);
      const a = actors.find(x => x.slug === slug);
      close(a);
    };
  });
}
```

- [ ] **Step 2: Commit.**

```bash
git add shared/js/identity-picker.js
git commit -m "Add identity picker modal (first-time + Cambiar flow)"
```

---

## Task 12 — Mi trabajo view renderer

**Files:**
- Create: `shared/js/mi-trabajo.js`

- [ ] **Step 1: Implement.**

```javascript
// shared/js/mi-trabajo.js
import { formatDate, daysBetween } from './utils.js';
import { topNeedsAttention } from './priority.js';
import { computePodio, computeRacha, computeSubmesaRace } from './gamification.js';
import { determineState } from './mi-trabajo-state.js';

export function renderMiTrabajo(mount, { activities, actor, today }) {
  const mine = activities.filter(a => (a.lidera_apoya || '').includes(actor.name));
  const podio = computePodio(activities, today);
  const rank = (() => {
    const i = podio.findIndex(p => p.actor.includes(actor.name));
    return i === -1 ? null : i + 1;
  })();
  const state = determineState(mine, today, { rankInPodio: rank });
  const racha = computeRacha(actor.name, activities, today);
  const race = computeSubmesaRace(activities);
  const mySub = race.find(r => r.submesa === actor.submesa);
  const mySubRank = mySub ? race.indexOf(mySub) + 1 : null;
  const urgent = topNeedsAttention(mine, today, 3);
  const qPct = mine.length ? Math.round((mine.filter(a => a.estado === 'Completado').length / mine.length) * 100) : 0;
  const completed = mine.filter(a => a.estado === 'Completado').length;
  const atrasadas = mine.filter(a => a.estado === 'Atrasado').length;

  mount.innerHTML = `
    ${renderHero(state, actor, mine, racha, { rank, mySubRank, mySub })}
    ${renderMetaQ(mine, completed, atrasadas, qPct, today)}
    ${renderUrgent(urgent, today)}
    ${renderAgenda(mine, today)}
    ${renderSubmesaStanding(mySub, mySubRank, actor)}
  `;
}

function renderHero(state, actor, mine, racha, ctx) {
  const configs = {
    A: {
      bg: 'linear-gradient(135deg,#78350f 0%,#b45309 40%,#d97706 100%)',
      label: `Hola, ${actor.name.split(' ')[0]} 🏆`,
      title: `Estás en ${ctx.rank}° lugar del podio del mes`,
      sub: `Has completado ${mine.filter(a => a.estado === 'Completado').length} actividades a tiempo. Mantén el ritmo.`,
      social: 'Tu nombre aparece público en el Panel este mes. La Mesa completa te ve como referente.',
      socialIcon: '📣'
    },
    B: {
      bg: 'linear-gradient(135deg,var(--primary-dark),var(--primary) 50%,var(--primary-accent) 100%)',
      label: `Hola, ${actor.name.split(' ')[0]} 👋`,
      title: 'Vas bien. Una completada más y <b>entras al podio</b>.',
      sub: `Tienes ${mine.filter(a => a.estado !== 'Completado').length} actividades activas. Tu submesa ${ctx.mySub ? `ocupa el ${ctx.mySubRank}° lugar` : 'está en la carrera'}.`,
      social: 'La carrera del podio es visible en el Panel. Tu nombre no aparece todavía — está a un paso de aparecer.',
      socialIcon: '🎯'
    },
    C: {
      bg: 'linear-gradient(135deg,#1e293b,#334155 60%,#475569)',
      label: `Hola, ${actor.name.split(' ')[0]}`,
      title: 'Este mes te has retrasado.',
      sub: `Tienes ${mine.filter(a => a.estado === 'Atrasado').length} actividades atrasadas${ctx.mySub ? ` y tu Submesa ${ctx.mySub.submesa} está en ${ctx.mySubRank}° lugar` : ''}.`,
      social: 'Lo que ven los demás: tu submesa en el ranking público. Tu nombre **no aparece** en ningún listado público, solo la ST lo sabe.',
      socialIcon: '👀',
      extra: { icon: '🤝', text: 'Camino de salida: 1 de tus actividades busca apoyo. La ST puede reasignar o acompañar.' }
    }
  };
  const c = configs[state];
  const rachaLabel = state === 'C' ? 'Racha en pausa' : 'Tu racha';
  const rachaNum = state === 'C' && racha === 0 ? '0 meses' : `${racha} meses`;

  return `
    <section style="background:${c.bg};color:#fff;border-radius:var(--r-xl);padding:24px 28px;display:grid;grid-template-columns:1.4fr 1fr;gap:24px;align-items:center;margin-bottom:16px;position:relative;overflow:hidden">
      <div>
        <div style="font-size:10px;opacity:0.75;text-transform:uppercase;letter-spacing:0.08em">${c.label}</div>
        <div style="font-size:21px;font-weight:700;margin-top:5px;line-height:1.3">${c.title}</div>
        <div style="font-size:13px;opacity:0.88;margin-top:7px;line-height:1.5">${c.sub}</div>
        <div style="background:rgba(255,255,255,0.13);border:1px solid rgba(255,255,255,0.22);padding:11px 14px;border-radius:8px;font-size:12px;margin-top:12px;display:flex;gap:10px;align-items:flex-start">
          <div style="font-size:16px">${c.socialIcon}</div>
          <div>${c.social.replaceAll('**', '')}</div>
        </div>
        ${c.extra ? `<div style="background:rgba(34,197,94,0.15);border:1px solid rgba(134,239,172,0.35);padding:11px 14px;border-radius:8px;font-size:12px;margin-top:8px;display:flex;gap:10px"><div>${c.extra.icon}</div><div><b>Camino de salida:</b> ${c.extra.text} <a href="#actividades" style="color:#bbf7d0;text-decoration:underline;font-weight:600">Pedir apoyo</a></div></div>` : ''}
      </div>
      <div style="background:rgba(255,255,255,0.13);border:1px solid rgba(255,255,255,0.2);border-radius:14px;padding:18px 20px">
        <div style="font-size:10px;opacity:0.85;text-transform:uppercase;letter-spacing:0.08em;font-weight:600">🔥 ${rachaLabel}</div>
        <div style="font-size:30px;font-weight:800;line-height:1;margin-top:6px">${rachaNum}</div>
        <div style="font-size:11px;opacity:0.85;margin-top:4px">${state === 'C' ? 'reiniciar requiere 1 entrega a tiempo' : 'consecutivos a tiempo'}</div>
      </div>
    </section>
  `;
}

function renderMetaQ(mine, completed, atrasadas, pct, today) {
  const qEnd = endOfQuarter(today);
  const daysLeft = Math.max(0, daysBetween(today, qEnd));
  return `
    <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:16px 20px;display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-bottom:16px">
      <div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600">Meta del trimestre</div><div style="font-size:22px;font-weight:800;color:var(--primary);margin-top:3px">${completed} de ${mine.length}</div></div>
      <div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600">Completadas (todo)</div><div style="font-size:22px;font-weight:800;margin-top:3px">${completed}</div></div>
      <div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600">Requieren acción</div><div style="font-size:22px;font-weight:800;color:var(--red);margin-top:3px">${atrasadas}</div></div>
      <div>
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600">Avance Q</div>
        <div style="background:var(--line-2);height:8px;border-radius:4px;margin-top:8px;overflow:hidden"><div style="background:linear-gradient(90deg,var(--primary-dark),var(--primary-accent));height:100%;width:${pct}%"></div></div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px">${pct}% · quedan ${daysLeft} días</div>
      </div>
    </div>
  `;
}

function renderUrgent(items, today) {
  if (!items.length) return '';
  return `
    <section class="panel" style="margin-bottom:16px">
      <h4>Lo más urgente <span class="sub">Priorizado por plazo y riesgo</span></h4>
      ${items.map(a => {
        const d = daysBetween(today, new Date(a.fecha_limite));
        const cls = d < 0 ? 'red' : d <= 3 ? 'orange' : 'amber';
        return `
          <div style="border-top:1px solid var(--line-2);padding:14px 0;display:grid;grid-template-columns:20px 1fr auto;gap:12px">
            <div class="pill-dot ${cls}" style="margin-top:6px"></div>
            <div>
              <div class="mono" style="font-size:10px;color:var(--muted)">${a.id}</div>
              <div style="font-size:13px;font-weight:600">${a.hito_operativo}</div>
              <div style="font-size:12px;color:var(--ink-3);margin-top:4px">${a.que_se_hace || ''}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:11px;color:var(--muted)"><b style="color:${d<0?'var(--red)':d<=3?'var(--orange)':'var(--amber)'};font-size:12px">${d<0?`−${-d} días`:`En ${d} días`}</b></div>
              <div style="display:flex;gap:6px;margin-top:6px">
                <button class="btn btn-done" data-id="${a.id}" style="background:var(--green);color:#fff;padding:5px 11px;border-radius:6px;font-size:11px;font-weight:600;border:0">✅ Completé</button>
                <button class="btn btn-block" data-id="${a.id}" style="background:var(--orange);color:#fff;padding:5px 11px;border-radius:6px;font-size:11px;font-weight:600;border:0">⚠ Bloqueador</button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </section>
  `;
}

function renderAgenda(mine, today) {
  const items = mine
    .filter(a => a.estado !== 'Completado')
    .map(a => ({ a, d: daysBetween(today, new Date(a.fecha_limite)) }))
    .filter(x => x.d >= 0 && x.d <= 30)
    .sort((x, y) => x.d - y.d);
  if (!items.length) return '';
  return `<section class="panel" style="margin-bottom:16px"><h4>Mi agenda — próximos 30 días</h4>
    ${items.map(({a, d}) => `
      <div style="display:grid;grid-template-columns:80px 1fr 80px;gap:12px;padding:9px 0;border-top:1px solid var(--line-2);font-size:12px;align-items:center">
        <div style="color:var(--primary);font-weight:700;font-size:11px;text-transform:uppercase">${formatDate(new Date(a.fecha_limite), true)}</div>
        <div>${a.hito_operativo}</div>
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;text-align:right;font-weight:600">EN ${d} DÍAS</div>
      </div>`).join('')}
  </section>`;
}

function renderSubmesaStanding(mySub, rank, actor) {
  if (!mySub) return '';
  return `<section class="panel"><h4>Cómo va tu Submesa</h4>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:12px;font-weight:700;color:#14532d">${rank === 1 ? '🥇 ' : ''}${mySub.submesa} — ${rank === 1 ? 'líder de la mesa' : `${rank}° lugar`}</div>
        <div style="font-size:11px;color:#166534;margin-top:2px">${mySub.pct}% · ${mySub.done} de ${mySub.total}</div>
      </div>
      <div style="font-size:24px;font-weight:800;color:#14532d">${rank}°</div>
    </div>
  </section>`;
}

function endOfQuarter(d) {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3 + 3, 0);
}
```

- [ ] **Step 2: Commit.**

```bash
git add shared/js/mi-trabajo.js
git commit -m "Add Mi trabajo view with 3-state hero and personal gamification"
```

---

## Task 13 — Shared activity modal

**Files:**
- Create: `shared/js/activity-modal.js`

- [ ] **Step 1: Implement.**

```javascript
// shared/js/activity-modal.js
import { formatDate } from './utils.js';

let activities = [];
let actor = null;
let logUrl = null;

export function initActivityModal({ activities: acts, actor: a, logUrl: l }) {
  activities = acts; actor = a; logUrl = l;
  window.addEventListener('open-activity', e => open(e.detail.id));
  document.addEventListener('click', e => {
    if (e.target.classList?.contains('modal-overlay')) close();
  });
}

async function open(id) {
  const a = activities.find(x => x.id === id);
  if (!a) return;

  let overlay = document.getElementById('activity-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'activity-modal';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }
  overlay.className = 'modal-overlay open';
  overlay.innerHTML = `<div class="modal"><div id="modal-body" style="font-size:14px;color:var(--ink-2)">Cargando…</div></div>`;

  const log = await loadLog(id);

  overlay.querySelector('#modal-body').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:14px">
      <div>
        <div class="mono" style="font-size:10px;color:var(--muted)">${a.id}</div>
        <h3 style="font-size:20px;margin-top:4px;letter-spacing:-0.01em">${a.hito_operativo}</h3>
      </div>
      <button data-close style="background:none;border:0;font-size:24px;color:var(--muted);cursor:pointer">×</button>
    </div>
    <div style="font-size:13px;line-height:1.6;color:var(--ink-3)">${a.que_se_hace || ''}</div>
    <div style="margin-top:16px;padding:14px;background:var(--bg);border-radius:8px;font-size:12px;line-height:1.7">
      <div><b>Producto:</b> ${a.producto_verificable || '—'}</div>
      <div><b>Evidencia:</b> ${a.evidencia_minima || '—'}</div>
      <div><b>Responsable:</b> ${a.lidera_apoya}</div>
      <div><b>Plazo:</b> ${formatDate(new Date(a.fecha_limite))}</div>
      <div><b>Submesa:</b> ${a.submesa || '—'} · <b>Tipo:</b> ${a.tipo || '—'}</div>
    </div>
    <div style="margin-top:18px">
      <h4 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink);margin-bottom:10px">Historial de notificaciones</h4>
      ${log.length ? log.map(l => `
        <div style="font-size:12px;color:var(--ink-3);padding:6px 0;border-bottom:1px solid var(--line-2)">
          <span class="mono" style="color:var(--muted);font-size:11px">${l.fecha}</span> · ${l.accion}${l.detalle ? ' — ' + l.detalle : ''}
        </div>`).join('') : '<div style="font-size:12px;color:var(--muted)">Sin historial registrado.</div>'}
    </div>
    ${renderActions(a)}
  `;
  overlay.querySelector('[data-close]').onclick = close;
}

function close() {
  const overlay = document.getElementById('activity-modal');
  if (overlay) overlay.className = 'modal-overlay';
}

function renderActions(a) {
  const isActorResponsible = actor && a.lidera_apoya.includes(actor.name);
  if (isActorResponsible && a.estado !== 'Completado') {
    return `<div style="margin-top:18px;display:flex;gap:8px">
      <button style="background:var(--green);color:#fff;border:0;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">✅ Reportar completada</button>
      <button style="background:var(--orange);color:#fff;border:0;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">⚠ Reportar bloqueador</button>
    </div>`;
  }
  return '';
}

async function loadLog(id) {
  if (!logUrl) return [];
  try {
    const r = await fetch(logUrl);
    if (!r.ok) return [];
    const text = await r.text();
    return parseLogCsv(text).filter(l => l.id === id);
  } catch { return []; }
}

function parseLogCsv(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const cells = splitCsvLine(line);
    const o = {};
    headers.forEach((h, i) => o[h] = cells[i] || '');
    return o;
  });
}

function splitCsvLine(line) {
  const out = []; let cur = ''; let inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}
```

- [ ] **Step 2: Commit.**

```bash
git add shared/js/activity-modal.js
git commit -m "Add shared activity modal with notification history"
```

---

## Task 14 — Entry point: wire it all up

**Files:**
- Create: `shared/js/dashboard.js` (replace existing)
- Rewrite: `orellana/index.html`, `sucumbios/index.html`

- [ ] **Step 1: Write `shared/js/dashboard.js`.**

```javascript
// shared/js/dashboard.js — entry point
import { resolveActorFromBrowser, IDENTITY_STORAGE_KEY } from './identity.js';
import { renderShell } from './shell.js';
import { renderPanel } from './panel.js';
import { renderActividades } from './actividades.js';
import { renderMiTrabajo } from './mi-trabajo.js';
import { showPicker } from './identity-picker.js';
import { initActivityModal } from './activity-modal.js';
import { fetchJSON, slugify } from './utils.js';

const TABS = ['panel', 'actividades', 'mi-trabajo', 'timeline'];

export async function initDashboard({ dataUrl, actorsUrl, logUrl, province, provinceLabel }) {
  const app = document.getElementById('app');
  app.innerHTML = '<div style="padding:60px;text-align:center;color:var(--muted)">Cargando…</div>';

  const [activities, actors] = await Promise.all([
    fetchJSON(dataUrl),
    loadActors(actorsUrl, province)
  ]);
  activities.forEach(a => { if (!a.submesa) a.submesa = inferSubmesa(a); });

  let actor = resolveActorFromBrowser(actors);

  const state = { tab: currentTab() };

  const paint = async () => {
    const main = renderShell({ province, provinceLabel, actor, activeTab: state.tab });
    if (state.tab === 'mi-trabajo' && !actor) {
      const picked = await showPicker(actors);
      if (!picked) { state.tab = 'panel'; history.replaceState(null, '', '#panel'); return paint(); }
      actor = picked;
      return paint();
    }
    const today = new Date();
    if (state.tab === 'panel') renderPanel(main, { activities, today, provinceLabel });
    else if (state.tab === 'actividades') renderActividades(main, { activities, today });
    else if (state.tab === 'mi-trabajo') renderMiTrabajo(main, { activities, actor, today });
    else main.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Línea de Tiempo — próximamente.</div>';
  };

  app.addEventListener('click', e => {
    const tabEl = e.target.closest('[data-tab]');
    if (tabEl) { state.tab = tabEl.dataset.tab; history.replaceState(null, '', '#' + state.tab); paint(); return; }
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'change-actor' || action === 'pick-actor') {
      showPicker(actors).then(a => { if (a) { actor = a; paint(); } });
    }
  });

  window.addEventListener('hashchange', () => {
    state.tab = currentTab(); paint();
  });

  initActivityModal({ activities, actor, logUrl });
  paint();
}

function currentTab() {
  const h = (location.hash || '#panel').slice(1);
  return TABS.includes(h) ? h : 'panel';
}

async function loadActors(url, province) {
  if (!url) return [];
  const text = await fetch(url).then(r => r.text());
  return text.trim().split('\n').slice(1).map(line => {
    const [name, email, rol, prov] = line.split(',').map(x => x.trim());
    return { name, email, rol, provincia: prov, slug: slugify(name), submesa: rol };
  }).filter(a => a.provincia === province);
}

function inferSubmesa(a) {
  // Falls back to parsing "Submesa S1 · Ambiente" from actor text if present.
  const m = /S(\d+)/.exec(a.lidera_apoya || '');
  return m ? `S${m[1]}` : 'Mesa';
}
```

- [ ] **Step 2: Rewrite `orellana/index.html`.**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mesa de Cooperación — Orellana</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../shared/css/dashboard.css">
  <link rel="stylesheet" href="../shared/css/mobile.css">
  <style>
    :root { --primary: #1a6b3c; --primary-dark: #0d4a25; --primary-accent: #2d8f55; }
    #app { padding: 0; }
    main.main { padding: 22px 24px 30px; max-width: 1240px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module">
    import { initDashboard } from '../shared/js/dashboard.js';
    initDashboard({
      dataUrl: 'data/actividades.json',
      actorsUrl: '../apps-script/actores_plantilla.csv',
      logUrl: '', // set once Log sheet is published-to-web as CSV
      province: 'Orellana',
      provinceLabel: 'Orellana'
    });
  </script>
</body>
</html>
```

- [ ] **Step 3: Rewrite `sucumbios/index.html`** (same as above; change primary colors + `province`/`provinceLabel`):

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mesa de Cooperación — Sucumbíos</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../shared/css/dashboard.css">
  <link rel="stylesheet" href="../shared/css/mobile.css">
  <style>
    :root { --primary: #1e40af; --primary-dark: #1e3a8a; --primary-accent: #3b82f6; }
    #app { padding: 0; }
    main.main { padding: 22px 24px 30px; max-width: 1240px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module">
    import { initDashboard } from '../shared/js/dashboard.js';
    initDashboard({
      dataUrl: 'data/actividades.json',
      actorsUrl: '../apps-script/actores_plantilla.csv',
      logUrl: '',
      province: 'Sucumbíos',
      provinceLabel: 'Sucumbíos'
    });
  </script>
</body>
</html>
```

- [ ] **Step 4: Commit.**

```bash
git add shared/js/dashboard.js orellana/index.html sucumbios/index.html
git commit -m "Wire entry point: shell + views + activity modal + identity picker"
```

---

## Task 15 — Mobile responsive pass

**Files:**
- Create: `shared/css/mobile.css`

- [ ] **Step 1: Write responsive overrides.**

```css
/* shared/css/mobile.css */
@media (max-width: 768px) {
  .tabs { overflow-x: auto; padding: 0 12px; }
  .tab { padding: 12px; font-size: 13px; white-space: nowrap; }
  .frame-top { padding: 10px 14px; }
  .hero { grid-template-columns: 1fr !important; padding: 20px; }
  .hero .big { font-size: 44px !important; }
  .cards-4 { grid-template-columns: 1fr 1fr !important; }
  .grid-2 { grid-template-columns: 1fr !important; }
  main.main { padding: 14px !important; }
  .tbl .thead, .tbl .row {
    grid-template-columns: 1fr !important;
    gap: 6px !important;
  }
  .tbl .thead { display: none; }
  .tbl .row > div::before { content: attr(data-label); display: block; font-size: 10px; color: var(--muted); text-transform: uppercase; font-weight: 600; margin-bottom: 2px; }
  .atn-item { grid-template-columns: 18px 1fr !important; }
  .atn-item > div:last-child { grid-column: 2; }
}
```

- [ ] **Step 2: Test manually by resizing browser to 375px width. Verify no horizontal scroll at any tab.**

- [ ] **Step 3: Commit.**

```bash
git add shared/css/mobile.css
git commit -m "Responsive overrides for ≤768px"
```

---

## Task 16 — Local QA + export + deploy

**Files:**
- None (verification only)

- [ ] **Step 1: Serve locally.**

Run: `cd mesa-cooperacion-dashboard && python3 -m http.server 8080`
Open: `http://localhost:8080/orellana/` and `http://localhost:8080/sucumbios/`.

- [ ] **Step 2: Run full manual QA checklist.**

Click through each verification:
- [ ] Panel renders with hero, 4 stat cards, Atención, Submesa, Próximos, Gamification, Footer.
- [ ] Actividades shows pills with correct counts; clicking filters.
- [ ] Mi trabajo triggers picker modal first time; selecting persists to localStorage.
- [ ] Visiting `/orellana/?actor=secretaria-tecnica-gadpo#mi-trabajo` lands on Mi trabajo filled.
- [ ] Row click opens activity modal with description, meta, historial (empty if no logUrl).
- [ ] Mobile at 375px: tabs scroll, hero stacks, cards 2×2, table becomes card-like.
- [ ] Both provinces (different primary colors) render correctly.
- [ ] `node tests/run.js` passes all tests.

- [ ] **Step 3: Commit any fixes discovered, then tag.**

```bash
git add -A
git commit -m "QA pass: minor fixes" || true
git tag redesign-v1
```

- [ ] **Step 4: Push to GitHub Pages.**

```bash
git push origin main --tags
```

Wait ~2 min, verify:
- `https://89jdvm.github.io/mesa-cooperacion/orellana/`
- `https://89jdvm.github.io/mesa-cooperacion/sucumbios/`

- [ ] **Step 5: Final commit with deploy note.**

```bash
git commit --allow-empty -m "Deploy redesign v1 to GitHub Pages"
git push
```

---

## Post-implementation (out of plan scope)

After real actor emails are collected:
1. Update Actores tab in the TEST Google Sheet with real emails.
2. Run `crearTriggers()` in Apps Script to enable automated daily/weekly/monthly triggers.
3. Publish the Log sheet as CSV to the web (Archivo → Publicar → seleccionar "Log" → CSV).
4. Paste Log CSV URL into `logUrl` parameter in both `index.html` files; redeploy.

## Success validation

- `node tests/run.js` shows all tests passing.
- Visiting each province URL renders all 4 tabs without console errors.
- Visiting `?actor=<slug>#mi-trabajo` from an email link lands on a filled Mi trabajo page in <1s.
- Responsive at 375px, 768px, 1280px.
- Lighthouse accessibility score ≥ 90.
