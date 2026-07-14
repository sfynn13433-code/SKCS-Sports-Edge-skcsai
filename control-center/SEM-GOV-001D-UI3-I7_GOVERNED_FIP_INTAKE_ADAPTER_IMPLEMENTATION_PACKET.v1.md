# SEM-GOV-001D-UI3-I7 — Governed FIP Intake Adapter Implementation Packet

| Field | Value |
|---|---|
| Packet ID | SEM-GOV-001D-UI3-I7 |
| Start HEAD | `ddf6f8438179b295ba8f826ceb474622e0b38b8c` |
| Mode | Scoped isolated implementation with dependency injection and mock-first tests |
| Decision | **PASS WITH CORRECTION** |
| `scout_edge_marriage_gate` | **BLOCKED** (unchanged) |
| `supabase_storage_gate` | **BLOCKED** (unchanged) |
| `unified_lifecycle_governor` | **BLOCKED** (unchanged) |

---

## A. Authority and start HEAD

- **Controlling contract:** `SEM-GOV-001D-UI3-I6_EFI_001_GOVERNED_INTAKE_INSPECTION_AND_ADAPTER_CONTRACT.v1.md`
- **Start HEAD:** `ddf6f8438179b295ba8f826ceb474622e0b38b8c`
- **Pre-change inspection:** confirmed PARTIAL proof-only `fipIntakeService`, no HTTP route, no resolver, no D3 mapper, no durable evidence store, migrations NOT APPLIED, no production D3 caller.

---

## B. Inspection findings

| Finding | Result |
|---|---|
| `fipIntakeService.js` | PARTIAL proof-only foundation — corrected in I7 |
| HTTP FIP route | None |
| `fixture_uid` resolver | **Implemented** as isolated `fixtureIdentityResolverService.js` |
| D3 DTO mapper | **Implemented** in `fipIntakeService.mapValidatedFipToD3Dto()` |
| Orchestration | **Implemented** in `governedFipIntakeAdapter.js` |
| Intake evidence | **Injected interface only** — no table/migration |
| Lifecycle migration | NOT APPLIED |
| D3 migration | NOT APPLIED |
| Production caller | None |

---

## C. Exact runtime files modified or created

### Modified
- `backend/services/fipIntakeService.js` — FIP-001 alignment, domain codes, legacy compatibility, D3/envelope mappers
- `tests/fip-intake-service.test.js` — domain code updates + legacy normalization test

### Created
- `backend/services/fixtureIdentityResolverService.js`
- `backend/services/governedFipIntakeAdapter.js`
- `tests/fixture-identity-resolver-service.test.js`
- `tests/governed-fip-intake-adapter.test.js`
- `control-center/SEM-GOV-001D-UI3-I7_GOVERNED_FIP_INTAKE_ADAPTER_IMPLEMENTATION_PACKET.v1.md`
- `tests/sem-gov-001d-ui3-i7-implementation-packet.test.js`

### Unchanged (hard boundary)
- `fixtureDisplayMetadataPersistenceService.js`
- `lifecyclePersistenceService.js`
- `aiPipeline.js`
- routes, controllers, migrations, `public/`

---

## D. Existing-service correction strategy

`fipIntakeService.js` retained as validator/mapper foundation:

1. **Canonical authority:** `validation.hash_algorithm` (not `validation.algorithm`)
2. **Explicit legacy boundary:** `normalizeLegacyProofFip()` + `isLegacyProofFipShape()` only for EFI-001 proof fixtures
3. **Hash verified on incoming wire shape** before normalization (legacy hash stability preserved)
4. **Canonical internal representation** emitted post-validation for adapter orchestration
5. **Domain codes** aligned to I6 `FIP_*` contract

---

## E. Authoritative FIP shape

FIP-001 minimum fields enforced for canonical intake:

- `fip_id`, `fip_schema_version`
- `validation.status`, `validation.hash`, `validation.hash_algorithm`, `validation.validated_at`
- `scout.fixture_id`
- `provenance.scout_run_id`, `provenance.source_system`
- `fixture.sport`, `fixture.league_id`, `fixture.league`, `fixture.kickoff_utc`, `fixture.status`
- `fixture.home_team.id`, `fixture.home_team.name`, `fixture.away_team.id`, `fixture.away_team.name`
- `markets`, `context` objects

Optional governed fields mapped when present: `venue`, `country`, `home_team.emblem_ref`, `away_team.emblem_ref`.

---

## F. Compatibility boundary

| Shape | Rule |
|---|---|
| Legacy EFI-001 proof fixture | Requires `proof_mode: PROOF_FIXTURE` and legacy fields (`validation.algorithm`, `fixture.fixture_id`, flat teams, `kickoff_time`) |
| Canonical FIP-001 | No `proof_mode` required; uses `validation.hash_algorithm` and nested team objects |
| Arbitrary variants | **Rejected** — no silent multi-shape support |

---

## G. Canonical hash implementation

| Rule | Value |
|---|---|
| Algorithm identifier | `scout-fip-sha256-v1` |
| Digest | SHA-256 lowercase hex |
| Encoding | UTF-8 |
| Canonicalization | Recursive key sort (`stableClone` + `JSON.stringify`) |
| Hash input | Full FIP with `validation.hash = ""` |
| Comparison | `constantTimeEqual()` timing-safe compare |
| Mismatch code | `FIP_HASH_MISMATCH` |
| Idempotency | `SHA-256(fip_id\|validation.hash\|fip_schema_version)` |

---

## H. Identity resolver queries and results

`fixtureIdentityResolverService.js`:

```sql
SELECT fixture_uid
FROM fixture_identity_aliases
WHERE alias_namespace = 'scout_fixture_id' AND alias_value = $1
```

```sql
SELECT fixture_uid
FROM fixture_lifecycle_current
WHERE fixture_uid = $1
```

| Result | Code |
|---|---|
| 0 alias rows | `FIP_FIXTURE_IDENTITY_UNRESOLVED` |
| >1 alias rows | `FIP_IDENTITY_INCONSISTENT` |
| `fixture_uid === scout.fixture_id` | `FIP_IDENTITY_INCONSISTENT` |
| 0 lifecycle rows | `FIP_LIFECYCLE_PARENT_MISSING` |

No `fixture_uid` minting. No lifecycle admission in I7.

---

## I. Lifecycle-parent requirement

D3 upsert occurs only after:

1. Canonical FIP validation
2. `scout.fixture_id` → `fixture_uid` resolution
3. `fixture_lifecycle_current` parent confirmation

---

## J. D3 DTO mapper

Pure function `mapValidatedFipToD3Dto(canonicalFip, { fixtureUid, intakeId, idempotencyKey })` emits exactly:

`fixtureUid`, `sport`, `scoutFixtureId`, `fipId`, `fipSchemaVersion`, `fipValidationHash`, `intakeId`, `idempotencyKey`, `homeTeamScoutId`, `awayTeamScoutId`, `competitionId`, `competitionName`, `kickoffAt`, `timezone` (`Africa/Johannesburg`), `homeTeamName`, `awayTeamName`, `venue`, `country`, `homeTeamEmblemRef`, `awayTeamEmblemRef`, `metadataFreshAt`.

No markets, odds, context, injuries, weather, or full FIP body.

---

## K. D3 persistence orchestration

Adapter invokes injected `displayMetadataPersistence.upsertFromValidatedIntake(dto)` once per accepted intake.

- Persistence failure → `FIP_PERSISTENCE_FAILED`
- Identical idempotency key replay → prior accepted evidence returned; D3 not called again
- No production caller wired in I7

---

## L. EdgeAnalysisEnvelope mapping

`mapToEdgeAnalysisEnvelope()` corrected for canonical FIP:

- `sports_truth_origin: SCOUT_FIP`
- `markets.direct_1x2` preferred; legacy `sharp_odds` fallback for proof fixtures only
- `metadata.scout_run_id` from `provenance.scout_run_id`
- `metadata.validation_hash_algorithm` canonical field
- Failure → `FIP_ENVELOPE_MAP_FAILED`
- **No `aiPipeline` invocation in adapter**

---

## M. Intake evidence interface

Injected interface only:

- `evidenceRecorder.recordIntakeEvidence(record)`
- `evidenceRecorder.findAcceptedByIdempotencyKey(key)`

Bounded record fields: `intakeId`, `fipId`, `fipSchemaVersion`, `fipValidationHash`, `scoutFixtureId`, `fixtureUid`, `scoutRunId`, `receivedAt`, `validatedAt`, `outcome`, `rejectionCode`, `governedMode`, `callerIdentityRef`, `idempotencyKey`.

No full FIP body. No credentials. Evidence store failure on acceptance → `FIP_INTAKE_EVIDENCE_UNAVAILABLE`.

**Correction:** durable production evidence remains deferred to a future storage packet.

---

## N. Idempotency law

- Deterministic `SHA-256(fip_id|validation.hash|fip_schema_version)` lowercase hex
- Matches I5 `buildDisplayMetadataIdempotencyKey()`
- Same accepted package does not duplicate D3 writes
- Conflicting package under same key fails closed
- Mock in-memory recorder used in tests only

---

## O. Gate-before-downstream proof

Failures before identity/D3/envelope:

- disabled feature
- unauthorized caller/mode
- production mode with blocked marriage gate
- schema unsupported / not validated / hash mismatch / required field missing
- forbidden origin
- identity unresolved / inconsistent / lifecycle parent missing
- D3 map failure / persistence failure / envelope map failure

Bounded rejected evidence may be recorded when safe metadata is extractable.

---

## P. Domain errors

Implemented/reconciled: `FIP_SCHEMA_UNSUPPORTED`, `FIP_NOT_VALIDATED`, `FIP_HASH_MISMATCH`, `FIP_REQUIRED_FIELD_MISSING`, `FIP_IDENTITY_INCONSISTENT`, `FIP_IDEMPOTENCY_DUPLICATE`, `FIP_INTAKE_UNAUTHORIZED`, `FIP_FORBIDDEN_ORIGIN`, `FIP_ENVELOPE_MAP_FAILED`, `FIP_MARRIAGE_GATE_BLOCKED`, `FIP_FIXTURE_IDENTITY_UNRESOLVED`, `FIP_LIFECYCLE_PARENT_MISSING`, `FIP_D3_MAP_FAILED`, `FIP_INTAKE_EVIDENCE_UNAVAILABLE`, `FIP_PERSISTENCE_FAILED`, `FIP_FEATURE_DISABLED`, `FIP_STALE`, `FIP_TIME_INVALID`, `FIP_PAYLOAD_INVALID`, `FIP_PAYLOAD_TOO_LARGE`.

No stack traces, SQL errors, secrets, or raw FIP bodies exposed.

---

## Q. Resource limits

| Limit | Value |
|---|---|
| Default max FIP bytes | 256 KB (`DEFAULT_MAX_FIP_BYTES`, configurable via context) |
| Identity queries per intake | ≤ 2 |
| D3 upserts per accepted intake | 1 |
| Accepted evidence records per intake | 1 |
| Automatic retry loops | None |

---

## R. Test matrix and results

| Suite | Tests | Result |
|---|---|---|
| `tests/fip-intake-service.test.js` | 15 | PASS |
| `tests/fixture-identity-resolver-service.test.js` | 7 | PASS |
| `tests/governed-fip-intake-adapter.test.js` | 28 | PASS |
| `tests/sem-gov-001d-ui3-i7-implementation-packet.test.js` | guard | PASS |

---

## S. No-route / no-network / no-apply boundary

- No HTTP route added
- No Scout/Neon/Supabase connections
- No migration apply
- No production caller
- No `aiPipeline` activation from adapter
- Migrations remain NOT APPLIED

---

## T. Prohibited work (deferred)

- HTTP intake route + authentication secrets
- Durable intake evidence table/migration
- Lifecycle admission implementation
- `fixture_uid` minting
- Gate clearance
- Pipeline default-path replacement (`dataProvider`, `syncService`)
- UI3 read-model implementation

---

## U. FUTURE_SECURITY_NOTE

GitHub Dependabot reports 5 dependency vulnerabilities on default branch (2 high, 2 moderate, 1 low). Not addressed in I7.

---

## V. Definition of Done

- [x] Governed adapter implemented with DI
- [x] FIP-001 canonical validation + legacy compatibility boundary
- [x] Identity resolver isolated with explicit SELECT columns
- [x] D3 DTO mapper and persistence orchestration
- [x] EdgeAnalysisEnvelope mapping corrected
- [x] Bounded intake evidence interface consumed
- [x] Mock-first tests pass
- [x] No route, network, migration apply, or production caller
- [x] All gates remain BLOCKED

---

## W. Inspection decision

**PASS WITH CORRECTION**

Correction: intake evidence remains injected-only; durable storage and HTTP boundary deferred.

**Proposed next packet (NOT AUTHORIZED):** SEM-GOV-001D-UI3-I8 — Governed FIP Intake HTTP Boundary and Evidence Persistence (design/implementation per separate authorization).

---

## X. Proof commands

```
npm run test:sem-gov-001d-ui3-i7
npm run test:sem-gov-001d-ui3-i6
npm run test:sem-gov-001d-ui3-i5
npm run control:center
npm run control:projects
npm run verify:rulebook
```
