# SEM-GOV-001D-UI3-I1 — Lifecycle Read-Model API Inspection and Contract v1

**Packet ID:** `SEM-GOV-001D-UI3-I1`
**Parent programme:** `SEM-GOV-001` — Unified Sports Intelligence Lifecycle
**Parent mini-project:** `SEM-GOV-001D` — Football Sports Match Hub fixture-first UI
**Controlling contracts:** `SEM-GOV-001D-UI1_SPORTS_MATCH_HUB_INFORMATION_ARCHITECTURE_AND_SCREEN_CONTRACT.v1`, `SEM-GOV-001B_FOOTBALL_LIFECYCLE_PERSISTENCE_CONTRACT.v1`, `SEM-GOV-001B-I4_LIFECYCLE_PERSISTENCE_IMPLEMENTATION_PACKET.v1`
**Start commit:** `4d0404d27ef38b0fc895165e4b00600a8b105458`
**Mode:** Inspection closure and contract authoring only — no API implementation
**Date sealed:** 2026-07-14

| Gate | Value |
|---|---|
| `scout_edge_marriage_gate` | **BLOCKED** (unchanged) |
| `supabase_storage_gate` | **BLOCKED** (unchanged) |
| `unified_lifecycle_governor` | **BLOCKED** (unchanged) |

| Closure status | Value |
|---|---|
| Inspection result | **PASS WITH BLOCKER** |
| UI3 read-model API implementation | **NOT STARTED** / **BLOCKED** |
| UI4 live integration | **NOT STARTED** |
| Migration `20261008000001_sem_gov_001b_lifecycle_persistence.sql` | **NOT APPLIED** |
| `public_fixture_id` resolver design | **BLOCKED** |

---

## A. Authority and inspection result

Stephen authorized SEM-GOV-001D-UI3-I1 read-only inspection closure and sealed API contract authoring. This packet records inspection findings and fixes the future read-model boundary. **UI3-I1 authorizes no endpoint, route, controller, service, migration, Supabase operation, or frontend fetch implementation.**

**Inspection decision:** **PASS WITH BLOCKER** — inspection completed truthfully; production UI3 implementation remains blocked pending separately approved metadata projection, identifier design, migration apply, and gate clearance.

---

## B. Start point

**Start commit:** `4d0404d27ef38b0fc895165e4b00600a8b105458`

**Prerequisites satisfied for inspection only:**

- SEM-GOV-001D-UI1 screen contract PROPOSED
- SEM-GOV-001D-UI2 static Hub TESTED
- SEM-GOV-001D-HOME1 home landing TESTED

---

## C. Scope

**In scope:** Read-only inspection of lifecycle API readiness, blocker registry, sealed public route contract, two-source read-model law, prohibited sources and fields, service-unavailable contract, Control Center registration, packet guard test.

**Out of scope:** Backend routes, read-model services, DTO mappers, migration apply, Supabase mutation, `public_fixture_id` generation, UI4 frontend integration, gate clearance, mock-to-live Hub wiring.

---

## D. Controlling contracts

- SEM-GOV-001D-UI1 §T — future endpoint paths and public DTO field contract
- SEM-GOV-001B — `fixture_uid` internal law, persistence projection shapes
- SEM-GOV-001B-I4 — `fixture_lifecycle_current` schema; migration authored **NOT APPLIED**
- `backend/services/lifecycleGovernor.js` — pure evaluation logic; **not** a fixture read store
- `backend/services/lifecyclePersistenceService.js` — internal persistence service; **not** a public DTO adapter

---

## E. Read-only inspection findings

| Finding | Result |
|---|---|
| UI1 defines `GET /api/lifecycle/fixtures` and `GET /api/lifecycle/fixtures/{opaque_public_id}` | **CONFIRMED** |
| Lifecycle route mounted in `backend/server-express.js` | **ABSENT** |
| Dedicated lifecycle router under `backend/routes/` | **ABSENT** |
| `lifecycleGovernor.js` role | Pure evaluation logic only — **not** a fixture read store |
| `lifecyclePersistenceService.js` role | Internal persistence writer/reader — **not** a public DTO adapter |
| Migration `20261008000001_sem_gov_001b_lifecycle_persistence.sql` | Authored — **NOT APPLIED** |
| `fixture_lifecycle_current` public fixture metadata | **MISSING** — no `home_team`, `away_team`, `competition`, `venue`, `country` |
| `fixture_lifecycle_current` public status-summary fields | **MISSING** — persistence row is lifecycle-state projection only |
| Canonical `fixture_uid` → public fixture metadata join | **NOT PROVEN** |
| UI2 mock fixtures (`sports-match-hub-mock-data.js`) | Static UI only — **not** approved canonical API source |
| Production UI3 implementation | **BLOCKED** |
| UI4 live integration | **NOT STARTED** |

---

## F. Blocker registry

Production UI3 implementation is **BLOCKED** until all blockers below are separately inspected, designed, and authorized:

1. **Migration not applied** — lifecycle persistence tables do not exist in production storage.
2. **Metadata projection missing** — no governed source for `home_team`, `away_team`, `competition`, `venue`, `country`.
3. **Identifier resolver missing** — `public_fixture_id` generation/resolution design not approved; must be non-reversible and must not expose `fixture_uid`.
4. **Two-source join unproven** — no canonical join between governed lifecycle projection and fixture metadata projection by `fixture_uid`.
5. **Governance gates blocked** — `scout_edge_marriage_gate`, `supabase_storage_gate`, `unified_lifecycle_governor` remain **BLOCKED**.

---

## G. Sealed public API contract (design only — not implemented)

Public routes remain exactly the two UI1 routes:

- `GET /api/lifecycle/fixtures`
- `GET /api/lifecycle/fixtures/{opaque_public_id}`

**Law:** API reads must use a **dedicated future read-model service**. Persistence rows must **not** be returned directly to clients. No endpoint, route, controller, or service implementation is authorized in UI3-I1.

List and detail responses must conform to UI1 §T public DTO fields. Internal persistence columns must be mapped and filtered through the future read-model adapter only.

---

## H. Two-source read-model law

Future UI3 read-model assembly requires **two separately governed sources**:

| Source | Role | Link key (internal only) |
|---|---|---|
| **Source A** | Governed lifecycle projection (`fixture_lifecycle_current` after migration apply and gate clearance) | `fixture_uid` |
| **Source B** | Separately proven canonical fixture metadata projection | `fixture_uid` |

The read-model service joins Source A and Source B internally. Clients receive only UI1 public DTO fields. Source B must be independently inspected and explicitly approved before production reads.

---

## I. Prohibited sources and fallbacks

The following are **prohibited** as read-model sources unless separately inspected and explicitly approved as canonical:

- `raw_fixtures` and raw provider fixture tables
- `predictions`, grading, and publication tables
- Provider tables and ungoverned enrichment stores
- UI2 mock fixtures (`public/js/sports-match-hub-mock-data.js`) in production
- Direct Scout query or Scout runtime payloads
- Mock fallback in production

When the lifecycle gate, storage source, metadata source, or identifier resolver is unavailable, the API must return a **controlled service-unavailable contract** without querying unsafe fallback sources.

---

## J. Prohibited exposure fields

The following must **never** appear in public API responses, URLs, logs surfaced to clients, or frontend state:

- `fixture_uid` (raw)
- Scout identifiers (`scout_fip_id`, Scout namespace aliases)
- Validation hashes (`scout_validation_hash`, any hash fields)
- `engine_stage`
- `transition_version`
- Raw `reason_detail_safe`
- Database metadata (`created_at`/`updated_at` as internal audit unless mapped to governed `evidence_fresh_at`/`updated_at` public fields per UI1 §T)

`public_fixture_id` generation and resolution remains **BLOCKED** pending a separately approved non-reversible identifier design.

---

## K. Service-unavailable contract

When any required source or resolver is unavailable:

- Return HTTP **503** (or governed equivalent) with a stable error envelope
- Message intent: lifecycle fixture status temporarily unavailable
- **Do not** query prohibited fallback sources
- **Do not** synthesize fixtures from mocks, predictions, or raw provider rows
- **Do not** leak internal blocker codes, gate names, or persistence table names to clients

---

## L. Deferred work

| Item | Status |
|---|---|
| UI3 read-model service implementation | **NOT STARTED** — separate authorization after blockers cleared |
| UI3 route mounting | **NOT STARTED** |
| UI4 live Hub integration | **NOT STARTED** |
| `public_fixture_id` resolver | **BLOCKED** — separate design packet required |
| Canonical fixture metadata projection | **NOT PROVEN** |
| Migration apply | **NOT APPLIED** — requires `supabase_storage_gate` clearance |
| Gate clearance | **BLOCKED** — separate authorization |

---

## M. Prohibited work in UI3-I1

UI3-I1 explicitly **prohibits**:

- Any file under `backend/routes/` for lifecycle
- Any lifecycle read-model service under `backend/services/`
- Migration apply or Supabase DDL/DML
- `public_fixture_id` logic
- Frontend `fetch` to `/api/lifecycle/*`
- Gate clearance or production caller activation

---

## N. Definition of Done — SEM-GOV-001D-UI3-I1

- [x] Read-only inspection findings recorded truthfully
- [x] Inspection result **PASS WITH BLOCKER** sealed
- [x] Both UI1 endpoint paths documented and unchanged
- [x] Two-source read-model law documented
- [x] Prohibited sources and fallbacks documented
- [x] All internal prohibited fields documented
- [x] Service-unavailable contract documented
- [x] UI3 implementation **NOT STARTED** / **BLOCKED**
- [x] UI4 **NOT STARTED**
- [x] Migration **NOT APPLIED**
- [x] All three governance gates remain **BLOCKED**
- [x] Control Center registration
- [x] Packet guard test passes
- [ ] UI3 API implementation — **NOT STARTED**
- [ ] UI4 live integration — **NOT STARTED**

---

## O. Proof commands

```text
npm run test:sem-gov-001d-ui3-i1
npm run test:sem-gov-001d-ui2
npm run test:sem-gov-001d-home1
npm run test:sem-gov-001d-ui1
npm run control:center
npm run control:projects
npm run verify:rulebook
```
