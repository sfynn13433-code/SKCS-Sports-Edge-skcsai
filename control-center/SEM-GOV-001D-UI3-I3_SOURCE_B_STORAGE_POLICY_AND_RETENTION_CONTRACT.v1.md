# SEM-GOV-001D-UI3-I3 — Source B Storage Policy and Retention Contract v1

**Packet ID:** `SEM-GOV-001D-UI3-I3`
**Parent programme:** `SEM-GOV-001` — Unified Sports Intelligence Lifecycle
**Parent mini-project:** `SEM-GOV-001D` — Football Sports Match Hub fixture-first UI
**Controlling contracts:** `SEM-GOV-001D-UI3-I2_CANONICAL_FIXTURE_METADATA_PROJECTION_INSPECTION_AND_CONTRACT.v1`, `EST-001_SUPABASE_STORAGE_AND_FIP_RETENTION_CONTRACT.v1`, `SEM-GOV-001B-I4_CAP2_DAILY_ADMISSION_LIMIT_DESIGN.v1`
**Start commit:** `6c34745ca638045231ba2fa9fc7f4365c07337ca`
**Mode:** Storage policy and retention contract only — no schema, migration, purge, or runtime implementation
**Date sealed:** 2026-07-14

| Gate | Value |
|---|---|
| `scout_edge_marriage_gate` | **BLOCKED** (unchanged) |
| `supabase_storage_gate` | **BLOCKED** (unchanged) |
| `unified_lifecycle_governor` | **BLOCKED** (unchanged) |

| Closure status | Value |
|---|---|
| Policy decision | **PASS WITH CORRECTION** |
| Storage class | **D3 — DERIVED FIXTURE DISPLAY STATE** |
| EST-001 D3 amendment | **SEALED** (law only) |
| Source B table `fixture_display_metadata` | **RESERVED** — not created |
| UI3 read-model implementation | **NOT STARTED** / **BLOCKED** |
| UI4 live integration | **NOT STARTED** |
| Lifecycle migration | **NOT APPLIED** |
| D3 purge runtime | **NOT AUTHORIZED** |

---

## A. Authority and policy decision

Stephen authorized SEM-GOV-001D-UI3-I3 storage-policy and retention contract authoring to resolve the UI3-I2 EST-001 authorization blocker. This packet seals **D3 — DERIVED FIXTURE DISPLAY STATE** as the governed Supabase storage class for UI3 Source B and amends EST-001 accordingly. **UI3-I3 authorizes no migration, table creation, purge job, EFI-001 intake, UI3 service, or gate clearance.**

**Policy decision:** **PASS WITH CORRECTION** — D3 storage class, retention law, field boundary, and capacity proof sealed; EST-001 amended to explicitly recognize D3; runtime implementation remains forbidden until separate authorization.

---

## B. Start point

**Start commit:** `6c34745ca638045231ba2fa9fc7f4365c07337ca`

**Prerequisites satisfied for policy authoring only:**

- SEM-GOV-001D-UI3-I2 metadata projection contract TESTED (PASS WITH BLOCKER)
- SEM-GOV-001D-UI3-I1 read-model API contract TESTED
- SEM-GOV-001B-I4-CAP2 50/day capacity model TESTED

---

## C. Scope

**In scope:** D3 storage class law, retention and purge policy, allowed/prohibited fields, capacity proof against 380 MB activation ceiling, EST-001 amendment, Control Center registration, packet guard test.

**Out of scope:** SQL migrations, table creation, purge implementation, EFI-001, UI3 read-model service, `public_fixture_id`, UI4, gate clearance.

---

## D. Controlling contracts

- SEM-GOV-001D-UI3-I2 §G — bounded projection field intent (INTERNAL + DISPLAY)
- EST-001 — amended by this packet to add D3 class (§4.1, §5.1, §6, §10)
- FIP-001 — Scout remains canonical sports-truth and replay authority
- EFI-001 — sole lawful population path for D3 rows (not implemented)
- SEM-GOV-001B-I4-CAP2 — 167 MB baseline; lifecycle conservative total **357.10 MB**

---

## E. D3 — DERIVED FIXTURE DISPLAY STATE

### E.1 Class definition

| Attribute | Law |
|---|---|
| **Class code** | **D3** |
| **Name** | DERIVED FIXTURE DISPLAY STATE |
| **Owner** | Edge (Supabase) |
| **Canonical sports truth** | Scout (not mirrored) |
| **Population source** | Validated Scout FIP through governed EFI-001 intake only |
| **Replaceability** | Fully replaceable display state; not evidence archive |
| **Scout mirror** | **PROHIBITED** — D3 is not a Scout mirror |

### E.2 D3 operational law

- D3 is Edge-owned replaceable display state derived **only** from a validated Scout FIP received through EFI-001.
- Scout remains canonical sports-truth and replay authority.
- **One row maximum per `fixture_uid`.**
- **Idempotent upsert** — no append-only metadata history.
- A corrected or newer validated Scout FIP may **replace** the existing row.
- Rebuild requires fetching and validating a **fresh Scout FIP** — not replay from Supabase FIP body.
- Public API may read D3 **only** through the future UI3 read-model service — never direct table exposure.

### E.3 Reserved future table

| Reserved name | Class | Purpose |
|---|---|---|
| `fixture_display_metadata` | D3 | One row per `fixture_uid`; bounded display fields only |

**No migration or table creation is authorized in UI3-I3.**

---

## F. Retention and purge law

| Phase | Retention | Rule |
|---|---|---|
| **Active** | While fixture is in the eight-day lifecycle window | Row retained and upsertable |
| **Post-closure** | Maximum **30 days** after lifecycle archive/closure | `purge_eligible_at` set at closure + 30 days |
| **Purge** | After 30-day post-closure window | Delete through future governed purge mechanism |
| **Indefinite retention** | **PROHIBITED** | No permanent metadata archive |
| **180-day D3 retention** | **PROHIBITED** | D3 is not lifecycle transition history |
| **Metadata version history** | **PROHIBITED** | Replace-in-place only |

---

## G. Allowed D3 fields

Aligned with SEM-GOV-001D-UI3-I2 bounded projection contract.

### INTERNAL (storage and join only)

`fixture_uid`, `scout_fixture_id`, `fip_id` or governed provenance-reference key, `home_team_scout_id`, `away_team_scout_id`

### DISPLAY

`sport`, `competition_id`, `competition_name`, `kickoff_at`, `timezone`, `home_team_name`, `away_team_name`, `venue` (optional), `country` (optional), `home_team_emblem_ref` (optional), `away_team_emblem_ref` (optional), `metadata_fresh_at`

### SYSTEM / AUDIT

`created_at`, `updated_at`, `lifecycle_closed_at` or `purge_eligible_at`

### PROHIBITED

Full FIP body, `raw_json`, provider payload, odds, H2H, form, injuries, weather, lineups, Scout evidence archive, validation hash in public output, metadata version history, independent Edge logo acquisition, direct Scout database reads, `raw_fixtures`/provider/mock fallback.

---

## H. Capacity proof (conservative static model)

### H.1 Inputs (from SEM-GOV-001B-I4-CAP2)

| Input | Value |
|---|---|
| Verified baseline | **167 MB** |
| Existing lifecycle conservative projected total (without D3) | **357.10 MB** |
| Activation ceiling | **380 MB** |
| Existing headroom (pre-D3) | **22.90 MB** |
| Minimum required headroom below 380 MB | **20 MB** |
| Maximum D3 budget (derived) | **≤ 2.90 MB** to preserve 20 MB headroom |

### H.2 D3 steady-state row ceiling

| Bucket | Calculation | Rows |
|---|---|---|
| Active (eight-day window) | 50 admissions/day × 8 days | **400** |
| Closed retention (30 days) | 50/day × 30 days | **1,500** |
| **Maximum steady-state rows** | | **≈ 1,900** |

### H.3 Conservative D3 increment calculation

| Component | Assumption | Size |
|---|---|---|
| Row width (INTERNAL + DISPLAY + SYSTEM) | 700 bytes conservative average | 1,900 × 700 B = **1.33 MB** |
| Primary index (`fixture_uid` PK) | 32 bytes/entry + pages | **0.06 MB** |
| Secondary indexes (`purge_eligible_at`, `kickoff_at`) | Partial/btree overhead | **0.14 MB** |
| Static maintenance / vacuum contingency | Bounded replace-in-place table | **0.35 MB** |
| Contingency buffer (25%) | Against underestimate | **0.47 MB** |
| **D3 conservative subtotal** | | **2.35 MB** → **2.40 MB** (rounded) |

### H.4 Projected total and verdict

| Metric | Value |
|---|---|
| Lifecycle conservative subtotal (CAP2) | 357.10 MB |
| D3 conservative subtotal | + 2.40 MB |
| **Projected total including D3** | **359.50 MB** |
| Headroom below 380 MB activation ceiling | **20.50 MB** |
| Minimum required headroom | 20 MB |
| **Capacity verdict** | **PASS** — preserves ≥ 20 MB headroom; does not weaken CAP2 capacity law |

If a future implementation model cannot preserve **≥ 20 MB** headroom below **380 MB**, the packet must close **HOLD** rather than weakening capacity law.

---

## I. Source A and Source B join law (unchanged from UI3-I1/UI3-I2)

| Source | Class | Role |
|---|---|---|
| **Source A** | Lifecycle projection | Governed lifecycle state after migration apply |
| **Source B** | **D3** (`fixture_display_metadata`) | Bounded fixture-display metadata |

Internal join key: `fixture_uid`. Public API exposes UI1 DTO fields only through future read-model adapter.

---

## J. EST-001 amendment summary

EST-001 is amended by UI3-I3 to:

- Add **D3 — DERIVED FIXTURE DISPLAY STATE** as explicitly allowed bounded derived Edge application state
- State D3 does **not** permit a full Scout mirror
- Reserve future table name `fixture_display_metadata` (not created)
- Add 8-day active + 30-day post-closure retention law
- Add purge and replacement law for D3
- Keep `supabase_storage_gate` **BLOCKED**
- Keep `scout_edge_marriage_gate` **BLOCKED**
- **Not** authorize runtime implementation or migration apply

---

## K. Prohibited work in UI3-I3

- Any `backend/` service, mapper, or purge job
- Any `supabase/` migration or `CREATE TABLE`
- EFI-001 intake implementation
- UI3 read-model route or service
- `public/` frontend changes
- Gate clearance

---

## L. Definition of Done — SEM-GOV-001D-UI3-I3

- [x] Policy decision **PASS WITH CORRECTION** sealed
- [x] D3 storage class and operational law documented
- [x] Retention: 8-day active + 30-day post-closure; no 180-day D3 retention
- [x] Allowed and prohibited fields documented
- [x] Capacity proof preserves ≥ 20 MB headroom (359.50 MB total; 20.50 MB headroom)
- [x] EST-001 amended to recognize D3
- [x] Scout remains canonical authority
- [x] UI3/UI4 NOT STARTED; migration NOT APPLIED; gates BLOCKED
- [x] Control Center registration
- [x] Packet guard test passes
- [ ] D3 table migration — **NOT AUTHORIZED**
- [ ] D3 purge runtime — **NOT AUTHORIZED**

---

## M. Proof commands

```text
npm run test:sem-gov-001d-ui3-i3
npm run test:sem-gov-001d-ui3-i2
npm run test:sem-gov-001d-ui3-i1
npm run test:sem-gov-001d-ui2
npm run test:sem-gov-001d-home1
npm run test:sem-gov-001d-ui1
npm run control:center
npm run control:projects
npm run verify:rulebook
```
