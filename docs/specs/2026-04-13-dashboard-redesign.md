# Mesa de Cooperación — Dashboard Redesign & Notifications Rollout
**Design spec · 2026-04-13**

## Context

The Mesa de Cooperación dashboard already exists as a static HTML/CSS/JS system (GitHub Pages) with a companion Google Apps Script notifications engine. Both provinces (Orellana · 79 activities, Sucumbíos · 93 activities) have been seeded. Round 2 of Entregable 5 closed 2026-04-07 and handover events to the GAD Provinciales have concluded.

Three gaps motivate this redesign:

1. **Visual polish** — current pages are functional but generic; they don't feel like a tool the director *wants* to open.
2. **Personas served** — the same layout tries to serve the busy director, the daily-user ST, and individual actors. None of them are served well.
3. **Notifications not yet in production** — Apps Script is written but not deployed; no emails flow yet.

## Goals

- The **Coordinador / Prefect** opens the dashboard and in 3 seconds knows: overall avance, what needs his attention, which submesa leads.
- The **ST staffer** opens it daily and has a control room: verification queue, filtered lists, per-row actions.
- The **individual actor** clicks a link in their weekly email and lands on their personal page: their tasks, their streak, their submesa's standing.
- Social signals motivate without shaming: celebrate publicly, pressure privately, compare only between teams.
- Deploy the notifications engine as a self-test first (all emails to `delftjd@gmail.com`), then swap in real actors.

## Non-goals

- No authentication/login system. Identity via URL param + localStorage picker.
- No server; stays static HTML on GitHub Pages. Data lives in JSON files, updated manually or by a sync script pulling from the Google Sheet.
- No mobile app. Responsive web only.
- No "cadencia" vocabulary anywhere. Use "frecuencia" or "calendario".

## Personas served

| Persona | Frequency | Default landing | Key need |
|---|---|---|---|
| Coordinador / Prefect (director) | Weekly | **Panel** | Scorecard, "necesita atención" |
| Secretaría Técnica | Daily | **Actividades** | Verification queue, filters, per-row actions |
| Actor (e.g. Coord. Ambiental) | When linked from email | **Mi trabajo** | Personal tasks, racha, agenda, submesa standing |
| Grupo Gestor member | Monthly | **Panel** | Overview, gamification |

Tab remembered in localStorage → director naturally stays on Panel, ST stays on Actividades.

## Visual direction

**"Executive scorecard" — warm institutional, confident, clear at 3 seconds.**

- Typography: **Inter** (already loaded), -0.02em letter-spacing on headings.
- Primary per-province: Orellana green `#1a6b3c` (deep forest), Sucumbíos blue `#1e40af`.
- Hero block: gradient from `--primary-dark` to `--primary` to a lighter accent; white type; one big number.
- Cards: white `#fff` background, 1px `#e5e7eb` border, 10–12px radius, subtle shadow `0 4px 18px -8px rgba(15,23,42,0.15)`.
- Stat numbers: 28px, 800 weight, -0.02em tracking.
- Status colors: atrasada `#dc2626` · en progreso `#2563eb` · completada `#16a34a` · verificación pendiente `#92400e` · por iniciar `#64748b`.
- Monospace (`JetBrains Mono`) only for IDs (`ORL-2026-Q2-001`) — gives them a "code-like" recognizability.

Rejected: minimalist editorial (too precious for government users), control-room dark mode (too developer-y for directors).

## Information architecture

Four tabs, sidebar or top nav (top works better for mobile):

1. **Panel** (Resumen General → renamed)
2. **Actividades** (ST control room)
3. **Mi trabajo** (personalized)
4. **Línea de Tiempo** (Gantt-like Q view)

Remove "Resumen" label — just "Panel". Remove "Mi Vista" — becomes "Mi trabajo".

## Identity & personalization

Decision: URL param → localStorage → picker (option C from brainstorm).

Resolution order on page load:
1. If URL has `?actor=<slug>`, use it and write to localStorage.
2. Else if localStorage has `mesaActor`, use it.
3. Else if on a tab that requires identity (Mi trabajo), show picker modal "¿Quién eres en la Mesa?" with dropdown of actors from `actores_plantilla.csv`.
4. Else (Panel/Actividades without identity), show aggregate view — no filtering.

Actor slug format: lowercase-hyphenated of the actor name. E.g. `coord-ambiental-gadpo`. Must match the `actores_plantilla.csv` mapping.

"Cambiar" link top-right on all pages → reopens picker.

Magic links in emails use the slug: `https://89jdvm.github.io/mesa-cooperacion/orellana/?actor=coord-ambiental-gadpo#mi-trabajo`.

## Panel (director landing)

**Sections, top-to-bottom:**

### Hero
- Gradient block, full width.
- Left: "Avance global" label, **47%** big (60px), caption "37 de 79 actividades · Trimestre activo: Q2 2026", mini 8-bar sparkline trend.
- Right: 2×2 grid of mini stats: trimestres restantes, actividades este Q, actores activos, submesas.

### Stat cards (4)
- Atrasadas (red left-border), En progreso, Completadas, Por iniciar.
- Each: label, big number, one-line footer ("Requieren atención", "Ventana activa", "Verificadas ST", "Próximo Q").

### Two-column grid
**Left (wider): "Necesita tu atención"**
- Top 5 prioritized items. Priority score = `max(0, -daysToDeadline) × 10 + max(0, 14 - daysToDeadline) + (activity.bloqueaOtras ? 20 : 0)`. Higher = more urgent. Ties broken by fecha_limite ascending.
- Dot color: red if overdue, orange if ≤ 3 days to deadline, amber if ≤ 14 days, otherwise skipped from list.
- Each row: colored dot, title, actor + context line (uses `notas_bloqueador` if present), right-side days-overdue pill.
- Click row → activity modal (see Shared modal below).

**Right: "Avance por Submesa"** + **"Próximos 30 días"**
- Submesa: name, %, progress bar, "N de M · X atrasadas" caption. One row per submesa. Traffic-light colored fills (green ≥ 60%, amber 40–59%, red <40%).
- Próximos 30 días: mini agenda, 4–5 rows, date + activity name + actor.

### Gamification row
- **Avanzadores del mes** (podio cards, gold/silver/bronze).
- **Submesas en carrera** (bar race by submesa, crown on leader).
- **Buscan apoyo** (reframe of atrasos as invitations).

Cert (mechanism 5 from brainstorm) excluded per user.

### Footer row
- "Datos actualizados · hace N min · Actualizado automáticamente desde el Google Sheet"
- Links: Exportar CSV · Exportar PDF · Ver cambios

## Actividades (ST control room)

### Verify banner (conditional)
Shows when there are activities in state "Reportada — pendiente verificación ST". Blue gradient banner. Count + "Verificar ahora →" button opens filtered view.

### Quick-filter pills
- **Todas** (79) · **Atrasadas** (5, red style) · **Verificación pendiente** (3) · **Este mes** (12) · **Próximo mes** (8) · **+ Submesa** · **+ Responsable**

Counts live, driven from JSON.

### Controls
- Search box (by ID, title, actor)
- Ordenar dropdown (default: Plazo ascending)
- Exportar CSV button

### Table
Columns: ID · Actividad · Responsable · Plazo · Estado · ⋯ menu

- Row backgrounds: red-tinted if `late`, blue-tinted if `verify` state, white otherwise.
- Activity cell: title (bold) + one-line description muted below.
- Plazo: "30 jun · en 78 días" — days-color-coded.
- Status badge: Pendiente / En progreso / Completada / Atrasada / Verificar.
- Click row → shared activity modal.
- ⋯ menu: Ping al responsable · Copiar ID · Ver timeline · Asignar apoyo.

## Mi trabajo (personalized)

**Resolution:** if no identity, picker modal first. Once identity is known:

### Greeting hero + racha (3 states)
Based on user's performance:
- **State A — podium (ahead):** Gold gradient. "Estás en 1er lugar del podio del mes." + "Tu nombre aparece público en el Panel este mes. La Mesa completa te ve como referente."
- **State B — on track:** Green gradient (same as Panel hero). "Vas bien. Una completada más y entras al podio." + "Tu nombre no aparece todavía — está a un paso de aparecer."
- **State C — falling behind:** Slate grey. "Este mes te has retrasado. Vamos a retomarlo juntos." + private mirror: "Tu submesa cayó al 2°. Tu nombre no aparece en ningún listado público, solo la ST lo sabe." + "Camino de salida: pedir apoyo."

State-determination rules:
- State A: top 3 of the month (by completed-on-time count)
- State B: completed ≥ 1 this month AND ≤ 1 atrasadas
- State C: ≥ 2 atrasadas OR 0 completed in last 30 days when responsible for ≥ 3 active
- On-track default if none of the above

### Meta del trimestre row
- 4 KPIs: Meta Q (X de Y), Completadas totales, Requieren acción, Progreso Q bar.

### Lo más urgente
- Top 3 of user's activities by days-to-deadline + risk.
- Per row: colored dot, ID (mono), title, description, right-side plazo + **inline action buttons**:
  - **✅ Completé** → same as email confirm flow (posts to Apps Script web app)
  - **⚠ Bloqueador** → opens blocker form
  - **Ver detalle** (for non-urgent)

### Mi agenda — próximos 30 días
- Date · activity · "EN N DÍAS" status pill

### Cómo va tu Submesa
- Big "rank" number (1°/2°/3°)
- "🥇 S1 · Ambiente — líder de la mesa · 62% avance"
- Connector sentence linking individual work to team standing

## Línea de Tiempo (Timeline)

Minimal changes to current Gantt:
- Group rows by Submesa (collapsible sections).
- Color bars by status (same palette as rest of system).
- Horizontal axis: trimestres Q2 2026 → Q1 2028 (8 cols).
- Hover bar → tooltip with name + plazo.
- Click bar → shared activity modal.
- "Hoy" vertical line.

## Shared: Activity modal

Opened from any row-click across Panel, Actividades, Mi trabajo, Timeline.

Sections:
- Header: ID, status badge, title.
- Description: "Qué se hace", producto verificable, evidencia mínima.
- Meta: responsable(es), plazo, trimestre, submesa, tipo, ámbito.
- **Historial de notificaciones**: chronological list pulled from the Apps Script Log sheet.
  - "2026-04-06 · Recordatorio 7 días enviado a <email>"
  - "2026-04-13 · Aviso día de vencimiento enviado"
  - "2026-04-13 · Reportada como completada por <actor> — pendiente verificación ST"
- Acciones (context-sensitive):
  - For ST: **Verificar** · Marcar atrasada · Pedir actualización · Asignar apoyo.
  - For actor: **Reportar completada** · **Reportar bloqueador**.
  - For director: Ver contexto · Ping responsable.

## Mobile

- Tabs → top bar with horizontal scroll.
- Hero: stacked (big number on top, side stats below).
- 4 stat cards → 2×2 grid.
- Two-column grid → single column.
- Actividades table → card list: each row becomes a stacked card (title, actor, plazo, status, tap for detail).
- Mi trabajo hero: unchanged structure, smaller type.
- All interactive elements min 44px tap target.

## Gamification system

Four mechanisms, all driven from the same JSON:

1. **🥇 Avanzadores del mes (podio)** — top 3 actors by completed-on-time count in current calendar month. Reset monthly. Shown on Panel. Only positive names.

2. **🏁 Submesas en carrera** — comparison bars by submesa, sorted by % avance. Crown on leader. Updated daily. Shown on Panel.

3. **🤝 Buscan apoyo** — any activity marked "atrasada" or explicitly flagged by ST appears as an invitation, not an accusation. Shown on Panel. "Ofrezco apoyo" button → email to ST.

4. **🔥 Racha personal** — private. Per-actor count of consecutive months with ≥ 1 on-time completion and 0 atrasadas. Pause on any atrasada. Shown only on Mi trabajo. Plus "Meta del trimestre" progress.

Computation: a client-side function `computeGamification(activities)` in `shared/js/gamification.js` returns `{ podio: [...], submesaRace: [...], buscanApoyo: [...], rachaFor: (actorSlug) => ... }`.

## Notifications system (existing, to deploy)

The current `apps-script/Code.gs` already covers:
- Daily reminders (7-day, day-of, 3-day-overdue warning, 7-day-overdue escalation)
- Weekly digest per actor (Monday)
- Monthly report to all members (day 1)
- Web form for confirmation/blocker reporting
- Log writing to Sheet

**Additions needed for deployment:**
- Add `testEnviarTodosLosTipos()` helper that fires one of each email type regardless of date, so test rollout is immediate (not date-dependent).
- Fix: `obtenerEmailsActor` currently uses `actorTexto.includes(nombre)`, which matches substrings incorrectly — e.g. "Dirección Gestión Ambiental GADPS" also matches the prefix of "Dirección de Planificación GADPS". Replace with tokenizing both sides on `[,;·]` + trim, then exact-equal comparison on one of the tokens.
- Optional: integrate Log sheet read into the dashboard modal's "Historial" section via the published-to-web CSV.

## Data layer

- `orellana/data/actividades.json` and `sucumbios/data/actividades.json` remain the source of truth for the dashboard.
- Monthly/weekly: user exports fresh JSON from Sheet → replaces the file → `git push`. Update freshness timestamp shown in footer.
- Future (out of scope): a small sync function that reads the published-CSV URLs and writes back to JSON on a schedule.

## Rollout plan

### Phase 1 — Test rollout (D track, already in motion)
Follow `TEST_ROLLOUT.md`. All emails to `delftjd@gmail.com`. Timebox: one session.

### Phase 2 — Dashboard redesign implementation
Steps (high-level; writing-plans will break into tasks):
1. Extract shared CSS tokens into `shared/css/tokens.css`.
2. Rebuild `shared/css/dashboard.css` with the new visual system (cards, pills, badges, hero).
3. Rewrite `shared/js/dashboard.js`:
   - Identity resolver (URL param + localStorage + picker).
   - `computeGamification()` pure function.
   - Panel renderer (hero, stats, atencion, submesa, próximos).
   - Actividades renderer (verify banner, pills, table).
   - Mi trabajo renderer (3-state hero, urgente, agenda, submesa).
   - Shared activity modal with historial section.
   - Timeline (minor polish).
4. Per-province `index.html`: simplify to include shared + province-specific overrides (colors).
5. Responsive/mobile pass.
6. QA locally with real JSON.
7. `git push` → GitHub Pages deploys.

### Phase 3 — Real-data rollout
Once real actor emails are available, update Actores tab in the test Sheet → system flips to production. No code changes.

## Open questions (defaults unless user overrides)

- **Avatars**: initial-based colored circles (no photos). OK.
- **Empty states**: "Todavía no hay atrasadas — excelente" type copy, not a sad blank.
- **Cambiar de provincia**: top-right link visible from any tab → takes to landing.
- **Print CSS**: lightweight — hide sidebar/tabs, print-friendly Panel for board meetings.
- **Accessibility**: contrast ≥ WCAG AA; keyboard-navigable tabs; aria-labels on pill filters.

## Success criteria

- Director says "opens and immediately knows what to do" in <5s after first visit.
- ST reports verification flow takes ≤2 min per activity.
- An actor clicking from email → Mi trabajo → report completada: zero decisions, one page, two clicks.
- First month after real rollout: ≥70% of actors open at least one email; ≥50% click through to dashboard at least once.
