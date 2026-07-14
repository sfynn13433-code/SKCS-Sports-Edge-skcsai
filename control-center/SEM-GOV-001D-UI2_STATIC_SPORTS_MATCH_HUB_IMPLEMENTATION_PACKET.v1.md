# SEM-GOV-001D-UI2 — Static Sports Match Hub Implementation Packet v1

**Packet ID:** `SEM-GOV-001D-UI2`
**Parent programme:** `SEM-GOV-001` — Unified Sports Intelligence Lifecycle
**Controlling contract:** `SEM-GOV-001D-UI1_SPORTS_MATCH_HUB_INFORMATION_ARCHITECTURE_AND_SCREEN_CONTRACT.v1`
**Start commit:** `81b618f2a4db1a105ba5cf28e716e06d60c0b156`
**Mode:** Static frontend implementation — mock data only
**Date sealed:** 2026-07-14

| Gate | Value |
|---|---|
| `scout_edge_marriage_gate` | **BLOCKED** (unchanged) |
| `supabase_storage_gate` | **BLOCKED** (unchanged) |
| `unified_lifecycle_governor` | **BLOCKED** (unchanged) |

| Closure status | Value |
|---|---|
| Packet status | **TESTED** |
| UI2 static implementation | **TESTED** |
| UI3 read-model API | **NOT STARTED** |
| UI4 live integration | **NOT STARTED** |
| Production lifecycle caller | **NONE** |
| Migration | **NOT APPLIED** |

---

## A. Authority

Stephen authorized full UI2 implementation from HEAD `81b618f`. UI2 delivers the visible Sports Match Hub using governed static mock fixtures only. No live API, Supabase, backend, or gate clearance.

---

## B. Approved file boundary

**New:** `public/sports-match-hub.html`, `public/css/sports-match-hub.css`, `public/js/sports-match-hub.js`, `public/js/sports-match-hub-mock-data.js`, `tests/sem-gov-001d-ui2-static-hub.test.js`, `tests/sem-gov-001d-ui2-visual-acceptance.test.js`, this packet.

**Modified:** `public/index.html` (Hub nav link + hero CTA only), `package.json`, Control Center registration files.

**Prohibited:** `smh-hub.js`, backend, migrations, Help/History, UI3/UI4.

---

## C. Implementation summary

- Dedicated page at `/sports-match-hub.html`
- Eight day tabs (`TODAY` … `DAY_8`) with SAST dates and user labels (Today, Tomorrow, Day 3–8)
- Lifecycle states, stages, filters, team search, archived toggle, fixture detail
- Static UI-state demonstrations via `?uiState=`
- No `fetch`, XMLHttpRequest, Supabase, or `/api/` usage

---

## D. Definition of Done

- [x] Dedicated static Hub page
- [x] Canonical navigation from Home
- [x] Eight governed day tabs with SAST dates
- [x] Governed mock fixtures (public DTO shape)
- [x] All eight lifecycle states
- [x] Lifecycle stages on detail; hints on UNDER_REVIEW/HELD cards
- [x] Filters and team search
- [x] Fixture detail with back state preservation
- [x] Required non-success state demos
- [x] No API/backend/Supabase caller
- [x] Focused UI2 tests
- [x] UI1 regression preserved
- [x] Gates remain BLOCKED; migration NOT APPLIED
- [x] UI3/UI4 NOT STARTED

---

## E. Proof commands

```text
npm run test:sem-gov-001d-ui2
npm run test:sem-gov-001d-ui1
npm run test:control-center
npm run control:center
npm run control:projects
npm run control:assets
npm run control:classification
npm run verify:rulebook
```
