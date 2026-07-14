# SEM-GOV-001D-HOME1 — Home Page Information Architecture and Visual Consolidation v1

**Packet ID:** `SEM-GOV-001D-HOME1`
**Parent programme:** `SEM-GOV-001` — Unified Sports Intelligence Lifecycle
**Controlling design reference:** `SEM-GOV-001D-UI2` static Sports Match Hub dark dashboard
**Start commit:** `ac7f29b91cda992727eaa34800307f08e674e7f2`
**Mode:** Static frontend consolidation — no API, Supabase, or backend
**Date sealed:** 2026-07-14

| Gate | Value |
|---|---|
| `scout_edge_marriage_gate` | **BLOCKED** (unchanged) |
| `supabase_storage_gate` | **BLOCKED** (unchanged) |
| `unified_lifecycle_governor` | **BLOCKED** (unchanged) |

| Closure status | Value |
|---|---|
| Packet status | **TESTED** |
| HOME1 landing consolidation | **TESTED** |
| UI3 read-model API | **NOT STARTED** |
| UI4 live integration | **NOT STARTED** |
| Migration | **NOT APPLIED** |

---

## A. Authority

Stephen authorized HOME1 from HEAD `ac7f29b`. Rebuild `public/index.html` into a concise Hub-aligned dark landing page. Remove embedded legacy Hub, chatbot, technical framework sprawl, contact/feedback sections from home rendering. Do not modify dedicated Hub files.

---

## B. Approved file boundary

**New:** `public/css/home-page.css`, `public/js/home-page.js`, `tests/sem-gov-001d-home1-static-home.test.js`, `tests/sem-gov-001d-home1-visual-acceptance.test.js`, this packet.

**Modified:** `public/index.html`, `package.json`, Control Center registration files.

**Prohibited:** Hub files, `smh-hub.js`, backend, migrations, Supabase on home, UI3/UI4.

---

## C. Implementation summary

- Dark landing page aligned with Sports Match Hub visual language
- Five-item desktop primary nav (Home, Sports Match Hub, Match Intelligence, Subscribe, Login)
- Hero with governed lifecycle copy and Hub CTA
- Three-step how-it-works, static Hub preview, six lifecycle stages, four trust principles
- Subscription CTA and compact legal footer
- Removed legacy embedded Hub, EdgeMind chat, JSON pipeline demo, About/Contact/UX sprawl
- `home-page.js`: mobile nav, smooth anchors, one back-to-top — no network calls

---

## D. Definition of Done

- [x] Professional Hub-aligned home landing
- [x] One-row desktop navigation
- [x] Substantially shorter page
- [x] Legacy embedded Hub removed from home
- [x] No API/Supabase/backend on home
- [x] Hub files unchanged
- [x] HOME1 focused tests pass
- [x] UI1/UI2 regressions pass
- [x] Gates BLOCKED; migration NOT APPLIED; UI3/UI4 NOT STARTED

---

## E. Proof commands

```text
npm run test:sem-gov-001d-home1
npm run test:sem-gov-001d-ui2
npm run test:sem-gov-001d-ui1
npm run control:center
npm run control:projects
npm run verify:rulebook
```
