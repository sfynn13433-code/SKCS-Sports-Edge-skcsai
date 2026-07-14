# SEM-GOV-001D-UI3-I8 — Durable Intake Evidence Storage Implementation Packet

| Field | Value |
|---|---|
| Packet ID | SEM-GOV-001D-UI3-I8 |
| Start HEAD | `e99ee91cdaa90a9086373ebbeda849134130eee7` |
| Mode | Scoped isolated implementation — migration authored only, service mock-first |
| Decision | **PASS WITH CORRECTION** |
| `scout_edge_marriage_gate` | **BLOCKED** (unchanged) |
| `supabase_storage_gate` | **BLOCKED** (unchanged) |
| `unified_lifecycle_governor` | **BLOCKED** (unchanged) |

---

## A. Authority and start HEAD

- **Controlling contracts:** `SEM-GOV-001D-UI3-I7_GOVERNED_FIP_INTAKE_ADAPTER_IMPLEMENTATION_PACKET.v1.md`, `SEM-GOV-001D-UI3-I6_EFI_001_GOVERNED_INTAKE_INSPECTION_AND_ADAPTER_CONTRACT.v1.md`, `EFI-001_FIP_INTAKE_HANDSHAKE_CONTRACT.v1.md`, `FIP-001_SCOUT_FIP_AUTHORITY_CONTRACT.v1.md`, `EST-001_SUPABASE_STORAGE_AND_FIP_RETENTION_CONTRACT.v1.md`
- **Start HEAD:** `e99ee91cdaa90a9086373ebbeda849134130eee7`
- **Pre-change inspection:** confirmed I7 adapter injects `recordIntakeEvidence` / `findAcceptedByIdempotencyKey`; no durable intake evidence table; no production evidence recorder; no HTTP FIP route; lifecycle and D3 migrations NOT APPLIED; no production `governedFipIntakeAdapter` caller; working tree clean except untracked `evidence/` and `evidence-home1-scratch/`.

---

## B. Inspection findings

| Finding | Result |
|---|---|
| I7 evidence interface | `buildBoundedEvidenceRecord()` emits 13 bounded camelCase fields + deterministic `idempotencyKey` |
| Durable table | **None before I8** |
| Production evidence recorder | **None before I8** |
| HTTP FIP route | None |
| Production adapter caller | None |
| Lifecycle migration | NOT APPLIED |
| D3 migration | NOT APPLIED |
| EST-001 R2 retention | **SEALED:** 90 days default; 365 days for `PROOF_FIXTURE` |
| EST-001 reserved table name | `fip_intake_events` — I8 implements `fip_intake_evidence` (documented correction) |
| D3 30-day retention | Does **not** govern intake evidence unless EST-001 says so — it does not |

---

## C. Factual table and column count

- **Exactly one table:** `public.fip_intake_evidence`
- **17 physical columns**

| Column | Type | Notes |
|---|---|---|
| `evidence_id` | UUID PK DEFAULT gen_random_uuid() | Surrogate key |
| `intake_id` | TEXT NOT NULL | Bounded intake reference |
| `fip_id` | TEXT NOT NULL | No FIP body |
| `fip_schema_version` | TEXT NOT NULL | |
| `fip_validation_hash` | TEXT NOT NULL | |
| `scout_fixture_id` | TEXT NOT NULL | |
| `fixture_uid` | UUID NULL | Nullable for pre-resolution rejections |
| `scout_run_id` | TEXT NOT NULL | |
| `received_at` | TIMESTAMPTZ NOT NULL | |
| `validated_at` | TIMESTAMPTZ NOT NULL | Clock-skew bounded |
| `outcome` | TEXT NOT NULL | ACCEPTED or REJECTED |
| `rejection_code` | TEXT NULL | Required iff REJECTED |
| `governed_mode` | TEXT NOT NULL | Drives retention class |
| `caller_identity_ref` | TEXT NOT NULL | Bounded caller reference only |
| `idempotency_key` | TEXT NOT NULL | SHA-256 hex |
| `recorded_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |
| `purge_eligible_at` | TIMESTAMPTZ NOT NULL | EST-001 R2 retention |

No JSONB. No FIP body. No raw provider payload.

---

## D. Outcome law

| Outcome | `rejection_code` | Idempotency |
|---|---|---|
| `ACCEPTED` | MUST be NULL | Partial unique index enforces one accepted row per `idempotency_key` |
| `REJECTED` | MUST be non-empty trimmed string | Multiple rows permitted for audit; transport rate-bounding deferred |

---

## E. Idempotency law

Canonical key:

`SHA-256(fipId + "|" + fipValidationHash + "|" + fipSchemaVersion)` → lowercase hex

Partial unique index:

```sql
CREATE UNIQUE INDEX idx_fip_intake_evidence_accepted_idempotency
  ON public.fip_intake_evidence (idempotency_key)
  WHERE outcome = 'ACCEPTED';
```

Service behaviour:

- `findAcceptedByIdempotencyKey()` queries only `outcome = 'ACCEPTED'`
- Unique race on accepted insert maps to `FIP_IDEMPOTENCY_DUPLICATE`
- Caller-supplied key must match canonical derivation or validation rejects before DB

---

## F. fixture_uid / FK decision

**Decision: no foreign key on `fixture_uid`.**

| Option | Rejected because |
|---|---|
| `ON DELETE CASCADE` | Would destroy audit evidence when lifecycle rows purge |
| `ON DELETE SET NULL` | Would mutate accepted evidence provenance post-resolution |
| FK to `fixture_lifecycle_current` | Rejection evidence may exist before identity resolution; evidence must survive lifecycle purge independently |

`fixture_uid` is stored as bounded provenance reference only.

---

## G. Retention-policy finding

**SEALED in EST-001 §R2:**

| Governed mode | Retention |
|---|---|
| Default / production | **90 days** from `recorded_at` |
| `PROOF_FIXTURE` | **365 days** from `recorded_at` |

Implementation:

- `createEst001RetentionPolicy()` implements sealed law exactly
- `calculatePurgeEligibleAt(recordedAt, governedMode, retentionPolicy)` is deterministic
- Unresolved/injected-null retention fails closed with `FIP_INTAKE_EVIDENCE_RETENTION_UNRESOLVED`
- D3's 30-day post-closure law does **not** apply to R2 intake evidence

---

## H. Security and RLS design

- `ALTER TABLE public.fip_intake_evidence ENABLE ROW LEVEL SECURITY`
- **No** anon policies
- **No** authenticated-user policies
- Service-role backend only
- No direct public PostgREST access
- No public DTO mapper
- No evidence values exposed to UI3

Rollback comment in migration:

```sql
-- DROP TABLE IF EXISTS public.fip_intake_evidence;
```

---

## I. Service factory and interface

**File:** `backend/services/fipIntakeEvidenceService.js`

```javascript
createFipIntakeEvidenceService({
  db,
  gateReader,
  clock,
  retentionPolicy,
  featureFlagEnabled
})
```

**Public methods:**

- `recordIntakeEvidence(record)`
- `findAcceptedByIdempotencyKey(idempotencyKey)`

**Exported helpers (validation/tests):** `validateEvidenceRecord`, `calculatePurgeEligibleAt`, `createEst001RetentionPolicy`, `mapPersistenceError`, `DOMAIN_CODES`

---

## J. Gate-before-database proof

Before any `db.query` or transaction:

1. `featureFlagEnabled === false` → `FIP_FEATURE_DISABLED`, zero DB
2. `gateReader.readGates().supabaseStorageGate !== 'CLEARED'` → `FIP_MARRIAGE_GATE_BLOCKED`, zero DB
3. Invalid/forbidden evidence input → `FIP_INTAKE_EVIDENCE_INVALID`, zero DB
4. Unresolved retention → `FIP_INTAKE_EVIDENCE_RETENTION_UNRESOLVED`, zero DB

With all gates **BLOCKED** at closure, production DB path remains unreachable until gate clearance.

---

## K. Input validation and forbidden fields

Forbidden keys (reject before DB): `fullFip`, `fipBody`, `fip_body`, `rawJson`, `raw_json`, `providerPayload`, `provider_payload`, `scoutPayload`, `credentials`, `authorization`, `bearerToken`, `secret`, `stack`, `sqlError`, plus `markets`, `context`, `envelope`, `canonical_fip`.

Normalization:

- Required strings trimmed; empty rejected
- `fixtureUid` NULL or valid UUID
- `rejectionCode` NULL for ACCEPTED
- Timestamps valid `Date` values
- `validated_at <= received_at + 5 minutes`
- `idempotencyKey` must match canonical SHA-256 derivation

---

## L. Query and transaction behaviour

**Insert:** explicit 16-value column list (excluding auto `evidence_id`), `RETURNING evidence_id` only.

**Select:** `INTERNAL_SELECT_COLUMNS` — no `SELECT *`.

**Duplicate accepted:** maps to `FIP_IDEMPOTENCY_DUPLICATE`.

**Other DB failures:** `FIP_INTAKE_EVIDENCE_UNAVAILABLE`.

**Integrity (>1 accepted row):** `FIP_INTAKE_EVIDENCE_INTEGRITY_ERROR`.

---

## M. Domain error mapping

| Code | When |
|---|---|
| `FIP_MARRIAGE_GATE_BLOCKED` | Storage gate not CLEARED |
| `FIP_FEATURE_DISABLED` | Feature flag off |
| `FIP_INTAKE_EVIDENCE_INVALID` | Validation/forbidden field/canonical key mismatch |
| `FIP_IDEMPOTENCY_DUPLICATE` | Accepted unique index violation |
| `FIP_INTAKE_EVIDENCE_UNAVAILABLE` | Other DB failure |
| `FIP_INTAKE_EVIDENCE_INTEGRITY_ERROR` | >1 accepted row for key |
| `FIP_INTAKE_EVIDENCE_RETENTION_UNRESOLVED` | Retention policy missing/invalid |

No raw SQL errors or constraint names exposed.

---

## N. I7 adapter integration

**Correction applied:** `governedFipIntakeAdapter.js` adds `invokeEvidenceRecorder()` to unwrap durable service envelopes `{ ok, found, record }` while preserving in-memory mock compatibility (direct record return).

No database import in adapter. No composition root. No route. No pipeline change.

---

## O. Migration non-execution boundary

- Migration file: `supabase/migrations/20261011000001_sem_gov_001d_ui3_i8_fip_intake_evidence.sql`
- **NOT APPLIED** by I8 closure
- No SQL executed against any database
- No production credentials used

---

## P. Rollback design

Manual rollback only:

```sql
DROP TABLE IF EXISTS public.fip_intake_evidence;
```

---

## Q. Resource and storage estimate

**Governed assumptions (EST-001 R2):**

| Parameter | Value |
|---|---|
| Accepted admissions | ≤ 50/day |
| Retention (production) | 90 days |
| Retention (PROOF_FIXTURE) | 365 days |
| Rejection rate | **Not governed** — capacity for rejections cannot be fully proven |

**Conservative accepted-only estimate (production mode):**

- Peak accepted rows in window: 50 × 90 = **4,500 rows**
- Estimated row width (17 columns + indexes): ~1.2 KB/row
- Accepted data: ~5.4 MB
- Indexes (idempotency partial unique, purge, received_at): ~2–3 MB additional
- **Total conservative accepted-only footprint: ~8 MB**

Rejection volume and mixed-mode totals require future transport rate governance before full capacity proof.

---

## R. Test matrix and results

| Suite | Result |
|---|---|
| `npm run test:sem-gov-001d-ui3-i8` | PASS (33 tests) |
| `npm run test:sem-gov-001d-ui3-i7` | PASS (existing + durable unwrap test) |
| `npm run test:sem-gov-001d-ui3-i6` | PASS |
| `npm run test:sem-gov-001d-ui3-i5` | PASS |
| `npm run test:sem-gov-001d-ui3-i4` | PASS |
| `npm run test:sem-gov-001d-ui3-i3` | PASS |
| `npm run test:sem-gov-001d-ui3-i2` | PASS |
| `npm run test:sem-gov-001d-ui3-i1` | PASS |
| `npm run control:center` | PASS |
| `npm run control:projects` | PASS |
| `npm run verify:rulebook` | PASS |

---

## S. Prohibited work (deferred)

- Migration apply
- HTTP FIP route
- Production adapter activation
- Scout/Supabase/Neon connections
- Purge job execution
- Gate clearance
- `public/` changes
- `fipIntakeService.js` modification
- `fixtureDisplayMetadataPersistenceService.js` modification

---

## T. FUTURE_SECURITY_NOTE

Five GitHub Dependabot dependency vulnerabilities remain recorded for future remediation. Not addressed in I8 scope.

---

## U. Definition of Done

- [x] One bounded `fip_intake_evidence` migration authored (not applied)
- [x] `fipIntakeEvidenceService` with gate-before-DB and EST-001 retention
- [x] Mock-first service tests (33 cases)
- [x] Static migration tests
- [x] I7 adapter envelope compatibility correction
- [x] Control Center registration
- [x] All gates remain BLOCKED
- [x] No route, network, or production activation

---

## V. Inspection decision

**PASS WITH CORRECTION**

Corrections sealed:

1. Table name `fip_intake_evidence` vs EST-001 reserved `fip_intake_events`
2. I7 adapter `invokeEvidenceRecorder()` envelope unwrap for durable service compatibility
3. No FK on `fixture_uid` for independent audit durability
4. Rejection-rate capacity not fully provable — accepted-only estimate provided

Blockers for production activation (unchanged):

- `supabase_storage_gate` BLOCKED — service fails closed on all DB operations
- Migration NOT APPLIED
- No HTTP route or production composition root
- No production `governedFipIntakeAdapter` caller
