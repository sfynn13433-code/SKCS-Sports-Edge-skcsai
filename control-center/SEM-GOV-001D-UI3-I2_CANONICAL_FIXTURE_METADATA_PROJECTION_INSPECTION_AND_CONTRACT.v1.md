# SEM-GOV-001D-UI3-I2 — Canonical Fixture Metadata Projection Inspection and Contract v1

**Packet ID:** `SEM-GOV-001D-UI3-I2`
**Parent programme:** `SEM-GOV-001` — Unified Sports Intelligence Lifecycle
**Parent mini-project:** `SEM-GOV-001D` — Football Sports Match Hub fixture-first UI
**Controlling contracts:** `SEM-GOV-001D-UI3-I1_LIFECYCLE_READ_MODEL_API_INSPECTION_AND_CONTRACT.v1`, `FIP-001_SCOUT_FIP_AUTHORITY_CONTRACT.v1`, `EST-001_SUPABASE_STORAGE_AND_FIP_RETENTION_CONTRACT.v1`, `EFI-001` (governed intake boundary — not implemented)
**Start commit:** `0e9d578b423d89c46bad3a4bbc78faac86aa776e`
**Mode:** Inspection closure and contract authoring only — no schema, persistence, or runtime implementation
**Date sealed:** 2026-07-14

| Gate | Value |
|---|---|
| `scout_edge_marriage_gate` | **BLOCKED** (unchanged) |
| `supabase_storage_gate` | **BLOCKED** (unchanged) |
| `unified_lifecycle_governor` | **BLOCKED** (unchanged) |

| Closure status | Value |
|---|---|
| Inspection result | **PASS WITH BLOCKER** — **NEW GOVERNED METADATA PROJECTION REQUIRED** |
| UI3 read-model API implementation | **NOT STARTED** / **BLOCKED** |
| UI4 live integration | **NOT STARTED** |
| Lifecycle migration `20261008000001_sem_gov_001b_lifecycle_persistence.sql` | **NOT APPLIED** |
| `public_fixture_id` resolver design | **BLOCKED** |
| Source B schema / persistence | **NOT AUTHORIZED** — separate storage-policy mini-project required |

---

## A. Authority and inspection result

Stephen authorized SEM-GOV-001D-UI3-I2 read-only inspection closure and sealed Source B metadata projection contract authoring. This packet defines the future bounded fixture-display metadata projection required by UI3-I1 Source B law. **UI3-I2 authorizes no table, migration, FIP intake, DTO mapper, backend service, Supabase operation, or frontend change.**

**Inspection decision:** **PASS WITH BLOCKER — NEW GOVERNED METADATA PROJECTION REQUIRED** — inspection completed truthfully; no existing `fixture_uid`-to-canonical-metadata projection is proven; a new bounded Edge fixture-display metadata projection must be designed and separately authorized before UI3 implementation.

---

## B. Start point

**Start commit:** `0e9d578b423d89c46bad3a4bbc78faac86aa776e`

**Prerequisites satisfied for inspection only:**

- SEM-GOV-001D-UI3-I1 read-model API contract TESTED (PASS WITH BLOCKER)
- SEM-GOV-001D-UI2 static Hub TESTED
- SEM-GOV-001D-HOME1 home landing TESTED

---

## C. Scope

**In scope:** Read-only inspection of canonical fixture metadata authority, Source B rejection findings, sealed future projection field contract, logo ownership law, EST-001 authorization blocker, Control Center registration, packet guard test.

**Out of scope:** Backend services, Supabase DDL/DML, FIP intake implementation, DTO mappers, `public_fixture_id` logic, UI4 integration, gate clearance, raw_fixtures promotion, provider fallback paths.

---

## D. Controlling contracts

- SEM-GOV-001D-UI3-I1 §H — Source A lifecycle projection; Source B canonical fixture metadata projection joined by `fixture_uid`
- FIP-001 — Scout FIP as canonical authority for fixture identity, league, kickoff, home team, away team
- EST-001 — Supabase storage and retention law; does **not** yet explicitly authorize the new bounded metadata projection
- EFI-001 — future governed FIP intake boundary (not implemented)

---

## E. Read-only inspection findings

| Finding | Result |
|---|---|
| `raw_fixtures` as UI3 Source B | **REJECTED** — not approved canonical metadata authority |
| `raw_fixtures` ingestion character | Written by direct provider ingestion; may contain raw provider payloads |
| Predictions, grading, publication tables | **PROHIBITED** as fixture metadata authority |
| UI2 mock fixtures (`sports-match-hub-mock-data.js`) | **PROHIBITED** as fixture metadata authority |
| Scout FIP-001 fixture metadata authority | **CONFIRMED** — canonical for fixture identity, league, kickoff, home team, away team |
| Team emblem sourcing | Scout remains responsible for lawful team-emblem sourcing and governance |
| Edge emblem placement | Edge may later map optional Scout-governed emblem references to correct home/away position only |
| Edge independent logo acquisition | **PROHIBITED** |
| Existing `fixture_uid` → canonical metadata projection | **NOT PROVEN** |
| New bounded Edge fixture-display metadata projection | **REQUIRED** |
| Full FIP permanent copy in Supabase | **PROHIBITED** |
| EST-001 authorization for new projection | **NOT YET EXPLICIT** — blocker |
| Production UI3 implementation | **BLOCKED** |
| `public_fixture_id` design | **BLOCKED** |
| UI4 live integration | **NOT STARTED** |
| Lifecycle migration | **NOT APPLIED** |

---

## F. Blocker registry

Source B and UI3 production remain **BLOCKED** until:

1. **New projection designed** — bounded Edge fixture-display metadata projection authorized by separate storage-policy/design mini-project.
2. **EST-001 explicit authorization** — retention and storage law must explicitly authorize the bounded projection shape.
3. **EFI-001 intake boundary** — Source B may only be populated from validated Scout FIP received through governed intake; intake not implemented.
4. **UI3-I1 blockers remain** — migration not applied, `public_fixture_id` BLOCKED, gates BLOCKED.
5. **No unsafe fallback** — `raw_fixtures`, provider tables, predictions, mocks remain prohibited.

---

## G. Sealed recommended future projection fields

Future Source B: **bounded fixture-display metadata projection** (design only — no table authorized in UI3-I2).

### INTERNAL (storage and join only — never public API output)

| Field | Role |
|---|---|
| `fixture_uid` | Edge-minted join key to Source A lifecycle projection |
| `scout_fixture_id` | Scout fixture identity reference |
| `fip_id` or governed provenance-reference key | Links row to validated FIP receipt through EFI-001 |
| `home_team_scout_id` | Scout home team identity |
| `away_team_scout_id` | Scout away team identity |

### DISPLAY (mapped to UI1 public DTO via future read-model adapter)

| Field | Required | Notes |
|---|---|---|
| `sport` | Yes | Football-first until multi-sport authorization |
| `competition_id` | Yes | Governed competition identifier |
| `competition_name` | Yes | Public competition label |
| `kickoff_at` | Yes | TIMESTAMPTZ |
| `timezone` | Yes | `Africa/Johannesburg` default law |
| `home_team_name` | Yes | Missing fails closed |
| `away_team_name` | Yes | Missing fails closed |
| `venue` | Optional | Missing does not invalidate fixture |
| `country` | Optional | Missing does not invalidate fixture |
| `home_team_emblem_ref` | Optional | Scout-governed reference; Edge maps to home position only |
| `away_team_emblem_ref` | Optional | Scout-governed reference; Edge maps to away position only |
| `metadata_fresh_at` | Yes | Freshness signal for display |

### PROHIBITED in projection storage and public output

- Full FIP body
- `raw_json`
- Raw provider payload
- Odds, H2H, form, injuries, weather, lineups
- Scout evidence archives
- Validation hashes in public output
- Raw `fixture_uid` in public output
- Independent Edge logo acquisition

---

## H. Logo and emblem law

- **Scout owns** lawful team-emblem sourcing, validation, and governance.
- **Edge may** map optional Scout-governed `home_team_emblem_ref` / `away_team_emblem_ref` to the correct home/away display position in the future read-model adapter.
- **Edge must not** independently acquire, scrape, or host team logos outside Scout-governed references.
- Missing optional emblem data **must not** invalidate a fixture row.

---

## I. Contract law — Source A and Source B

| Source | Role | Population law |
|---|---|---|
| **Source A** | Governed lifecycle projection (UI3-I1) | Lifecycle persistence after migration apply and gate clearance |
| **Source B** | Bounded fixture-display metadata projection (this packet) | Validated Scout FIP through governed EFI-001 intake boundary only |

**Join:** Both sources link internally through `fixture_uid`. Public API exposes UI1 DTO fields only.

**Prohibited Source B population paths:**

- Direct Scout database read by public API or projection writer
- `raw_fixtures` or raw provider tables
- Prediction, grading, or publication tables
- UI2 mock fixtures
- Provider fallback
- Mock fallback in production

**Fail-closed law:**

- Missing required team names, competition, kickoff, or fixture identity → reject row / fail closed
- Missing optional emblem, venue, or country → fixture remains valid

---

## J. EST-001 authorization blocker

EST-001 does **not** yet explicitly authorize the new bounded fixture-display metadata projection. The full FIP must not be permanently copied into Supabase. A **separate storage-policy/design mini-project** is required before Source B schema, retention class, or persistence implementation may begin. UI3-I2 seals field intent only; it does not amend EST-001.

---

## K. Service-unavailable and missing-projection law

When Source B projection, EFI-001 intake, EST-001 authorization, or required metadata fields are unavailable:

- Return controlled service-unavailable contract per UI3-I1 §K
- **Do not** query `raw_fixtures`, provider tables, predictions, or mocks
- **Do not** synthesize team or competition names from non-canonical sources

---

## L. Deferred work

| Item | Status |
|---|---|
| Source B storage-policy/design mini-project | **NOT STARTED** |
| Source B schema / migration | **NOT AUTHORIZED** |
| EFI-001 FIP intake implementation | **NOT STARTED** |
| UI3 read-model service | **NOT STARTED** / **BLOCKED** |
| UI4 live integration | **NOT STARTED** |
| `public_fixture_id` resolver | **BLOCKED** |
| Lifecycle migration apply | **NOT APPLIED** |
| Gate clearance | **BLOCKED** |

---

## M. Prohibited work in UI3-I2

UI3-I2 explicitly **prohibits:**

- Any `backend/` service, route, or mapper for metadata projection
- Any `supabase/` migration or table creation
- FIP intake implementation
- `public/` frontend changes
- Gate clearance
- Promoting `raw_fixtures` to canonical Source B

---

## N. Definition of Done — SEM-GOV-001D-UI3-I2

- [x] Read-only inspection findings recorded truthfully
- [x] Inspection result **PASS WITH BLOCKER — NEW GOVERNED METADATA PROJECTION REQUIRED** sealed
- [x] `raw_fixtures` explicitly rejected as Source B
- [x] Scout FIP-001 named canonical fixture metadata authority
- [x] New bounded metadata projection requirement sealed
- [x] INTERNAL, DISPLAY, and PROHIBITED fields documented
- [x] Logo ownership: Scout sources; Edge placement only
- [x] EST-001 authorization blocker recorded
- [x] UI3/UI4 NOT STARTED; production UI3 BLOCKED
- [x] Migration NOT APPLIED; all gates BLOCKED
- [x] Control Center registration
- [x] Packet guard test passes
- [ ] Source B persistence — **NOT AUTHORIZED**
- [ ] UI3 API implementation — **NOT STARTED**

---

## O. Proof commands

```text
npm run test:sem-gov-001d-ui3-i2
npm run test:sem-gov-001d-ui3-i1
npm run test:sem-gov-001d-ui2
npm run test:sem-gov-001d-home1
npm run test:sem-gov-001d-ui1
npm run control:center
npm run control:projects
npm run verify:rulebook
```
