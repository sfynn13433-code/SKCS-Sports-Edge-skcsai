# SEM-GOV-001D-UI1 — Sports Match Hub Information Architecture and Screen Contract v1

**Packet ID:** `SEM-GOV-001D-UI1`
**Parent programme:** `SEM-GOV-001` — Unified Sports Intelligence Lifecycle
**Parent mini-project:** `SEM-GOV-001D` — Football Sports Match Hub fixture-first UI
**Controlling contracts:** `SEM-GOV-001_UNIFIED_SPORTS_INTELLIGENCE_LIFECYCLE_CONTRACT.v1`, `SEM-GOV-001B_FOOTBALL_LIFECYCLE_PERSISTENCE_CONTRACT.v1`, `SEM-GOV-001B-I4_LIFECYCLE_PERSISTENCE_IMPLEMENTATION_PACKET.v1`
**Start commit:** `2d4c6a3df20dc0d6575d72b7713232933dff51f5`
**Mode:** Governance authoring — design and screen contract only (no UI implementation)
**Date sealed:** 2026-07-14

| Gate | Value |
|---|---|
| `scout_edge_marriage_gate` | **BLOCKED** (unchanged) |
| `supabase_storage_gate` | **BLOCKED** (unchanged) |
| `unified_lifecycle_governor` | **BLOCKED** (unchanged) |

| Closure status | Value |
|---|---|
| Packet status | **PROPOSED** |
| UI2 static implementation | **NOT STARTED** |
| UI3 read-model API | **NOT STARTED** |
| UI4 live integration | **NOT STARTED** |
| Production UI mutation | **NONE** |

---

## A. Authority and status

Stephen authorized SEM-GOV-001D-UI1 governance packet authoring following read-only UI1 inspection. This packet approves **future UI planning only**. It does not activate UI2, UI3, UI4, lifecycle production callers, migration apply, or gate clearance. **UI1 authorizes no production UI mutation.**

---

## B. Start point

**Start commit:** `2d4c6a3df20dc0d6575d72b7713232933dff51f5`

---

## C. Scope

**In scope:** Information architecture, screen contracts, navigation, day-label presentation, lifecycle language, fixture cards, filters, UI states, future API read-model field contract, responsive and accessibility law, visual direction, trust language, implementation sequence UI2–UI4.

**Out of scope:** HTML/CSS/JS changes, API routes, backend read models, migrations, Supabase mutation, mock fixture files in repo, screenshots, gate clearance.

---

## D. Controlling contracts

- SEM-GOV-001 §4–§6, §12 — stages, states, eight-day funnel, Help contract
- SEM-GOV-001B — persistence law, `day_label` domain, OD-3 eight SAST buckets
- SEM-GOV-001B-I4 — persistence foundation TESTED; migration NOT APPLIED
- `backend/services/lifecycleGovernor.js` — `DAY_LABELS` authority for runtime alignment

---

## E. Current UI baseline

- **Home** (`public/index.html`) embeds a section titled “Sports Market Hub.”
- Existing Hub code (`public/js/smh-hub.js`) is **prediction-centric**: sport/market dropdowns → `/api/predictions`; cards show confidence %, risk tier, pick type.
- **No dedicated Sports Match Hub route** exists today.
- **Help** and **History** pages do not exist.
- Architecture: Tailwind `css/output.css`, large inline styles in `index.html`, plain JavaScript modules.
- Mobile breakpoints exist (960, 900, 768, 640, 600 px) but are inconsistent.
- Navigation relies heavily on in-page anchors (AI Pipeline, Framework, About, etc.).
- **The governed lifecycle Hub is not implemented.** Current prediction cards are **not** governed lifecycle cards.

---

## F. Page disposition map

| Surface | Disposition | Notes |
|---|---|---|
| `index.html` landing/hero | KEEP / RESTRUCTURE LATER | Remains default landing |
| Embedded Sports Market Hub | MERGE INTO DEDICATED HUB | Prediction UX retired from home long-term |
| `accuracy.html` | KEEP | Future nav label: Match Intelligence |
| `experience.html` | KEEP | Onboarding funnel |
| `market-explorer.html` | RETIRE-LATER | Overlaps Hub |
| `direct-markets.html` | RETIRE-LATER | Redirect shim |
| `subscription.html` / `subscribe/` | KEEP | Product law |
| `login.html` | KEEP | Auth |
| `language-switch.html` | KEEP | RLL-001 deferred |
| `terms.html`, `privacy.html` | KEEP | Legal |
| `vip-stress-dashboard.html` | OUT-OF-SCOPE | Internal |
| `control-center.html`, `admin-sync.html` | OUT-OF-SCOPE | Ops |
| `payment.html` | KEEP | Billing |
| Help page | CREATE-LATER | UI2+ |
| History page | CREATE-LATER | UI2+ |
| Dedicated Sports Match Hub page | CREATE-LATER | UI2 |

No retire/delete actions in UI1.

---

## G. Canonical navigation

**Future primary navigation (desktop and mobile sheet):**

1. Home → `/`
2. **Sports Match Hub** → `/sports-match-hub` (CREATE-LATER)
3. Match Intelligence → `/accuracy.html`
4. Help → `/help` (CREATE-LATER)
5. Subscribe → `/subscribe`
6. Login / Account → `/login.html`

**Rules:**

- Home remains default landing; **no auto-redirect** Home → Hub.
- Returning users may deep-link to Hub.
- Language, Terms, Privacy → footer/secondary nav.
- Framework, About, Contact anchors **not** primary nav items.
- Active item: `aria-current="page"`.
- Logged-out users see Hub lifecycle status (public boundary); premium markers only where subscription law requires.

---

## H. Home screen contract

- Plain-language hero (football fixture lifecycle intelligence; no guarantee language).
- Primary CTA: **Open Sports Match Hub**.
- Concise fixture-status summary when future API provides counts (OPTIONAL / FUTURE).
- Three-step “How it works”: choose day → read status → open fixture.
- Trust block: SAST timezone, freshness, status may change, informational not advice.
- No unsupported accuracy percentages.

---

## I. Sports Match Hub screen contract

- Football-first; sport selector disabled to football until multi-sport authorization.
- SAST date context line: “All times South Africa (SAST).”
- Canonical day navigation (§N).
- Filters: lifecycle state, competition, team search, active/archived.
- Bounded fixture results with count; freshness / last-updated indicator.
- Fixture cards per §Q — **no prediction confidence or risk-tier presentation**.
- States: loading, empty day, stale, unavailable, no production data yet (§S).
- Pagination/cursor; admission-cap upstream delay message when user-relevant.

---

## J. Fixture detail contract

- Teams, competition, kickoff (SAST), mapped day label, lifecycle state badge.
- Lifecycle stage on detail (and stepper); publication eligibility in plain language.
- Status summary, safe timeline, public hold/elimination category.
- Evidence freshness, updated time.
- Back to Hub preserving URL state (day + filters).
- **Prohibited:** raw `fixture_uid`, hashes, Scout IDs, SQL IDs, raw `reason_detail_safe`.

---

## K. History contract

- Archived fixture lifecycle history and final decisions.
- Past status timeline (read-only).
- Filters: date range, competition, final state.
- **No betting settlement assumption** unless future API proves settlement fields.

---

## L. Help and How It Works contract

Per SEM-GOV-001 §12:

- Day label vs lifecycle stage distinction (worked example).
- Lifecycle-state glossary (§O).
- Stage explanations (§P).
- Held vs eliminated vs Review Complete meanings.
- SAST, freshness, responsible-use, no-guarantee language.
- Reopenable panel on Hub + full Help page (CREATE-LATER).

---

## M. System unavailable contract

- Full-page and inline variants.
- Heading: “Sports Match Hub is temporarily unavailable.”
- Primary: Retry; secondary: Home.
- `aria-live="assertive"` for full-page; polite for inline.

---

## N. Day-navigation contract

### Canonical authority

**SEM-GOV-001 §6** and **SEM-GOV-001B OD-3 / §day_label** define eight SAST buckets. **`lifecycleGovernor.js` `DAY_LABELS`** and **`tests/lifecycle-governor.test.js`** confirm:

`TODAY`, `DAY_2`, `DAY_3`, `DAY_4`, `DAY_5`, `DAY_6`, `DAY_7`, `DAY_8`

**Canonical sequence begins at `TODAY`; the next token is `DAY_2` (no intermediate first-day alias).**

### Internal token, user label, offset

| Internal token | User-facing label | SAST calendar offset |
|---|---|---|
| `TODAY` | Today | 0 |
| `DAY_2` | Tomorrow | +1 |
| `DAY_3` | Day 3 | +2 |
| `DAY_4` | Day 4 | +3 |
| `DAY_5` | Day 5 | +4 |
| `DAY_6` | Day 6 | +5 |
| `DAY_7` | Day 7 | +6 |
| `DAY_8` | Day 8 | +7 |

### Visible tab format (two lines)

```
Today
14 Jul
```

```
Tomorrow
15 Jul
```

- Timezone: `Africa/Johannesburg`.
- Actual date always shown; no server-local ambiguity.
- Underscore tokens never shown to users.
- URL: `?day=TODAY`, `?day=DAY_2`, … (internal token in query; mapped label in UI).
- Mobile: horizontal scroll; selected tab scrolls into view; `role="tablist"` semantics.
- Empty day: genuine empty state, not error.

---

## O. Lifecycle-state language

| Code | Label | Meaning | Badge priority | Card | Detail | Filter |
|---|---|---|---|---|---|---|
| `VISIBLE` | Listed | In active window; full review may not have started | 5 | Standard | Full | Yes |
| `UNDER_REVIEW` | Under Review | Governed checks in progress | 4 | + stage hint | Full + timeline | Yes |
| `HELD` | On Hold | Paused pending evidence or review | 3 | Amber border | Hold category | Yes |
| `ELIMINATED` | Not Publishing | Will not receive published insight | 2 | Muted | Category + summary | Yes |
| `FINAL_APPROVED` | Review Complete | Checks completed; insight informational, not guaranteed | 6 | Green accent | Decision summary | Yes |
| `CANCELLED` | Cancelled | Match not expected to proceed | 1 | Struck/muted | Timeline | Yes |
| `POSTPONED` | Postponed | Delayed; awaits updated kickoff | 2 | Blue accent | New kickoff | Yes |
| `ARCHIVED` | Archived | Left active window; history preserved | 0 | De-emphasized | Read-only | Yes |

Colour is never the only indicator; each badge includes text and optional icon with accessible name.

---

## P. Lifecycle-stage language

| Internal | User label |
|---|---|
| `ADMITTED` | Fixture Admitted |
| `EVIDENCE_REVIEW` | Evidence Review |
| `CONTEXT_REVIEW` | Context Review |
| `STABILITY_REVIEW` | Stability Review |
| `PUBLICATION_REVIEW` | Publication Review |
| `FINAL_DECISION` | Final Decision |

**Recommendation:** Stages on fixture detail (horizontal stepper); short hint on `UNDER_REVIEW` and `HELD` cards only; not on every card. Never expose `engine_stage` (1–6).

---

## Q. Fixture-card contract

**Required:** home team, away team, competition, kickoff SAST, mapped day label, lifecycle-state badge, short status summary, evidence freshness or updated time, view-fixture action.

**Optional:** venue, country, publication-eligibility message, final decision marker.

**Prohibited:** `fixture_uid`, database IDs, Scout IDs, hashes, raw sources, raw `reason_detail_safe`, confidence, probability, betting advice, gate state.

**Variants:** mobile compact; desktop standard; held/eliminated/postponed/cancelled/final-approved/archived treatments per §O.

---

## R. Filter and search contract

- Day (tab), lifecycle status (chips), competition (dropdown), team search (300 ms debounce, min 2 chars), active/archived toggle, publication eligibility when meaningful.
- AND combination; visible chips; Clear all; zero-results state; mobile filter sheet; keyboard accessible; bounded pagination; shareable URL.
- No provider/model/engine filters.

---

## S. UI-state contract

| State | Heading intent | Primary action | aria-live |
|---|---|---|---|
| Initial loading | Loading fixtures… | — | polite |
| Incremental refresh | Updating… | — | polite |
| Empty day | No fixtures for [date] | Another day | polite |
| No filter matches | No fixtures match filters | Clear filters | polite |
| API unavailable | Unable to load fixtures | Retry | assertive |
| Stale data | Showing last updated [time] | Refresh | polite |
| Lifecycle unavailable | Status temporarily unavailable | Retry | assertive |
| No production data | Fixture status coming soon | Help | polite |
| Auth required | Sign in to continue | Login | polite |
| Premium required | Upgrade to view insight | Subscribe | polite |
| Unexpected error | Something went wrong | Retry | assertive |

Never invent fixtures in empty/unavailable states. Stale cache may remain visible with banner.

---

## T. API read-model contract (design only — not implemented)

**Future endpoints (UI3):**

- `GET /api/lifecycle/fixtures`
- `GET /api/lifecycle/fixtures/{opaque_public_id}`

UI must **not** consume persistence-table rows directly.

### List item — REQUIRED

`public_fixture_id`, `sport`, `home_team`, `away_team`, `competition`, `kickoff_at`, `timezone`, `day_label`, `lifecycle_state`, `lifecycle_state_label`, `evidence_fresh_at`, `updated_at`, `archived`, `detail_available`

### List item — OPTIONAL

`lifecycle_stage`, `lifecycle_stage_label`, `publication_eligible`, `hold_category_public`, `elimination_category_public`, `status_summary`, `venue`, `country`

### INTERNAL — DO NOT EXPOSE

`fixture_uid`, Scout identifiers, validation hashes, `transition_version`, raw `reason_detail_safe`, database metadata

### Detail — REQUIRED additions

`status_summary`, `lifecycle_timeline`, `latest_transition_at`

### Timeline item — REQUIRED

`event_key` (opaque), `from_state`, `to_state`, `display_label`, `occurred_at`

---

## U. Responsive-design contract

- Desktop ≥960px: top nav, 2–3 column cards, side filters.
- Tablet 768–959px: 2 columns; filter sheet.
- Mobile <768px: single column; sticky day tabs; hamburger nav; 44×44px touch targets.
- Compact refinements ~640px/600px aligned with existing `index.html` patterns.

---

## V. Accessibility contract

- Semantic landmarks; one `h1`; logical headings.
- Day tabs: `tablist`/`tab`/`tabpanel`; arrow-key navigation.
- Visible focus; status text + colour; labelled filters.
- `aria-live` for loading/errors; `<time datetime>` for SAST dates.
- `prefers-reduced-motion`: disable hover transforms.
- No focus-stealing auto-refresh.

**Recorded gaps (not fixed in UI1):** SMH prediction cards lack status semantics; colour-only risk tiers; inconsistent modal focus.

---

## W. Visual direction

Preserve SKCS brand: primary `#0d6efd`, dark Hub panels (`#0f172a`), light Home background, Segoe UI stack, 8–12px card radius, restrained shadows, state-based left border accents, text-first badges, calm held/eliminated treatment, ~200ms transitions. No new brand assets in UI1.

---

## X. Trust, safety and product-language rules

**Prohibit:** sure-win, guaranteed outcomes, unsupported accuracy %, Review Complete as certainty, Held/Eliminated as app failure, hiding SAST/freshness, governance jargon in user copy.

**Require:** SAST display, freshness, status-may-change, informational-not-advice, plain English.

---

## Y. Implementation sequence, prohibited work and Definition of Done

### Sequence

| Phase | Scope | Prerequisite |
|---|---|---|
| **UI2** | Static HTML/CSS/JS; governed mock fixtures in tests/adapter; no live API | UI1 packet PROPOSED/approved |
| **UI3** | Bounded read-only lifecycle read-model API + DTO mapping | UI2 visual acceptance; separate packet |
| **UI4** | Live frontend integration | UI3 endpoint; gates cleared as required; migration applied only after `supabase_storage_gate` |

### Prohibited in UI1

Frontend/runtime code, API implementation, migration apply, gate clearance, UI2–UI4 activation, mock files in repo.

### Definition of Done — SEM-GOV-001D-UI1

- [x] Packet sections A–Y sealed
- [x] Current baseline recorded truthfully
- [x] Page disposition explicit
- [x] Canonical navigation fixed
- [x] Screen contracts fixed
- [x] Day tokens reconciled with governor authority (TODAY then DAY_2 through DAY_8)
- [x] State/stage mappings fixed
- [x] API read-model specified, not implemented
- [x] UI2/UI3/UI4 boundaries explicit
- [x] Control Center registration
- [x] Packet guard test passes
- [ ] UI implementation — **NOT STARTED**
- [ ] Gate clearance — **separate authorization**
