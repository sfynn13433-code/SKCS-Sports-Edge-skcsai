# SEM-GOV-001D-UI3-I6 — EFI-001 Governed Intake Inspection and Adapter Contract v1

**Packet ID:** `SEM-GOV-001D-UI3-I6`
**Parent programme:** `SEM-GOV-001` — Unified Sports Intelligence Lifecycle
**Parent mini-project:** `SEM-GOV-001D` — Football Sports Match Hub fixture-first UI
**Controlling contracts:** `EFI-001`, `FIP-001`, `EST-001`, `EMG-001`, `SEE-001`, `SEM-GOV-001D-UI3-I4`, `SEM-GOV-001D-UI3-I5`
**Start commit:** `f905e7b9c8564f21a2d46b514dbf495e2e29c3e2`
**Mode:** Read-only inspection and adapter contract only — no runtime intake implementation, Scout connection, database write, migration apply, route, or gate clearance
**Date sealed:** 2026-07-14

| Gate | Value |
|---|---|
| `scout_edge_marriage_gate` | **BLOCKED** (unchanged) |
| `supabase_storage_gate` | **BLOCKED** (unchanged) |
| `unified_lifecycle_governor` | **BLOCKED** (unchanged) |

| Closure status | Value |
|---|---|
| Inspection decision | **PASS WITH BLOCKER** |
| `fipIntakeService.js` | **PARTIAL — PROOF-ONLY ISOLATED FOUNDATION** (requires correction) |
| D3 adapter | **NOT IMPLEMENTED** (contract sealed in I6) |
| Fixture identity bridge | **NOT IMPLEMENTED** |
| Intake evidence persistence | **NOT IMPLEMENTED** (design only) |
| HTTP intake route | **ABSENT** |
| Migration apply | **NOT AUTHORIZED** |

---

## A. Authority and start point

Stephen authorized SEM-GOV-001D-UI3-I6 read-only inspection of existing EFI-001 intake code and contracts, plus sealing of the governed adapter contract required to map a validated Scout FIP into (A) `EdgeAnalysisEnvelope` and (B) the I5 `upsertFromValidatedIntake(dto)` input. **No runtime changes, HTTP calls, database writes, or gate clearance.**

**Start commit:** `f905e7b9c8564f21a2d46b514dbf495e2e29c3e2`

---

## B. Exact inspection scope

| Artifact | Inspected |
|---|---|
| `control-center/EFI-001_FIP_INTAKE_HANDSHAKE_CONTRACT.v1.md` | YES |
| `control-center/FIP-001_SCOUT_FIP_AUTHORITY_CONTRACT.v1.md` | YES |
| `backend/services/fipIntakeService.js` | YES (read-only) |
| `backend/services/fixtureDisplayMetadataPersistenceService.js` | YES (read-only) |
| `backend/services/aiPipeline.js` | YES (read-only) |
| `backend/services/lifecyclePersistenceService.js` | YES (read-only, identity pattern) |
| `backend/routes/pipeline.js` | YES (read-only) |
| `tests/fip-intake-service.test.js` | YES |
| `tests/fixture-display-metadata-persistence-service.test.js` | YES |

---

## C. Current runtime findings

| Finding | Evidence |
|---|---|
| Start HEAD confirmed | `f905e7b9` |
| Working tree clean except evidence folders | `git status` |
| `fipIntakeService.js` exists | Committed EFI-001-I1 foundation |
| No FIP intake HTTP route | `backend/routes/*` — no `fipIntake` match |
| No direct Scout/Neon DB reads in intake service | `fipIntakeService.js` — pure in-process validation |
| `buildLiveData()` still active sports-truth path | `dataProvider.js`, `syncService.js`, `scheduler.js` |
| `POST /api/pipeline/run { matches }` still exists | `pipeline.js` L274–284 |
| `aiPipeline` default input = `getPredictionInputs()` | `aiPipeline.js` L2183–2193 |
| Optional `fip_envelopes` proof path in `aiPipeline` | `aiPipeline.js` L2183–2309 |
| Lifecycle migration NOT APPLIED | Ledger + I5 packet |
| D3 migration NOT APPLIED | I5 packet |
| D3 persistence service isolated, no caller | Grep — no production import |

---

## D. `fipIntakeService` classification

**Classification: PARTIAL — PROOF-ONLY ISOLATED FOUNDATION (requires correction before production adapter)**

| Criterion | Status |
|---|---|
| Active production intake boundary | **NO** — not route-mounted; pipeline defaults to provider path |
| Isolated foundation | **YES** — EFI-001-I1 single-module validator |
| Proof-only | **YES** — `PROOF_FIXTURE` mode only; tests use proof fixtures |
| Contract-compliant with FIP-001 | **PARTIAL** — hash/idempotency aligned; field-shape drift (see §G) |
| Stale | **NO** — actively tested |
| D3-capable | **NO** — no DTO mapper, no `fixture_uid` resolution |

**Verdict:** Do **not** replace the module. **Correct and extend** via a future governed adapter layer (`mapValidatedFipToDisplayMetadataDto`, `resolveFixtureUidFromScoutFixtureId`) without bypassing `receiveValidatedFip`.

---

## E. Callers and route map

### Runtime callers of `fipIntakeService`

| Caller | Path | Classification |
|---|---|---|
| `backend/services/aiPipeline.js` | `resolveConfiguredPredictionInput()` when `options.fip_envelopes` present | **Proof/test injection only** — not default production path |
| `tests/fip-intake-service.test.js` | Direct `receiveValidatedFip` | Test |
| `tests/edge-system-runtime-inventory.test.js` | Inventory reference | Test/meta |

### Test-only / inventory references

`tests/lifecycle-governor.test.js` (forbidden import check), `tests/sem-gov-001b-governor-foundation-packet.test.js`, Control Center asset register.

### Routes

| Route | FIP intake? |
|---|---|
| `POST /api/pipeline/run` | **NO** — accepts `{ matches }` or runs `runPipelineFromConfiguredDataMode()` without governed FIP boundary |
| Any `/api/fip/*` | **ABSENT** |

### Prohibited surfaces (must not become intake boundary)

`pipeline.js` manual matches, `dataProvider.buildLiveData()`, `syncService` normalization input, `contextIngestionService` provider fetches, direct Neon reads, `public/data/*`.

---

## F. Accepted FIP source and forbidden sources

**Accepted (when all gates pass in future authorization):**

```text
Scout (Neon) → Scout FIP assembly + validation (FIP-001)
  → governed transport (EST-001, future)
    → EFI-001 receiveValidatedFip (fipIntakeService)
      → adapter outputs
```

**Forbidden as sports-truth origin (sealed — fail closed):**

| Source | Ruling |
|---|---|
| `buildLiveData()` / `getPredictionInputs()` default path | **FORBIDDEN** for governed sports truth |
| `POST /api/pipeline/run { matches }` | **FORBIDDEN** |
| Provider APIs (API-Sports, Odds API, etc.) | **FORBIDDEN** |
| Direct Neon/Scout DB bypass | **FORBIDDEN** |
| Manual Edge-constructed payloads | **FORBIDDEN** in production |
| `raw_fixtures`, Supabase FIP replay | **FORBIDDEN** |

`fipIntakeService` enforces forbidden-origin tokens via `FORBIDDEN_ORIGIN_VALUES` set.

---

## G. Canonical hash verification findings

**Hash law: PROVEN** — aligned with FIP-001 §6 and implemented in `computeFipHash()`.

| Rule | Sealed value |
|---|---|
| Algorithm | `scout-fip-sha256-v1` |
| Digest | SHA-256 lowercase hex (64 chars) |
| Input bytes | UTF-8 of `canonical_json(fip_hash_body)` |
| `fip_hash_body` | Complete FIP object with `validation.hash` set to `""` |
| Canonical JSON | Recursive key sort (`stableClone` + `JSON.stringify`) |
| Comparison | Strict equality `validation.hash === computeFipHash(payload)` |
| Failure code (current) | `HASH_MISMATCH` → map to `FIP_HASH_MISMATCH` in adapter contract |
| Idempotency | `SHA-256(fip_id\|validation.hash\|fip_schema_version)` — **matches I5** |

**Correction required:** Runtime uses `validation.algorithm`; FIP-001 authority field is `validation.hash_algorithm`. Adapter contract must accept **either** during transition with `FIP_SCHEMA_UNSUPPORTED` if neither matches `scout-fip-sha256-v1`.

**Not invented:** Hash rules are proven from FIP-001 + `fipIntakeService.js` + `tests/fip-intake-service.test.js`.

---

## H. Schema-version law

| Rule | Value |
|---|---|
| Allowed versions | `1.0.0` only |
| Current enforcement | `fipIntakeService.FIP_SCHEMA_VERSION === '1.0.0'` |
| Failure code | `UNSUPPORTED_SCHEMA_VERSION` → `FIP_SCHEMA_UNSUPPORTED` |
| Proof mode | `PROOF_FIXTURE` only until marriage gate clearance |
| Production mode | `AUTHORIZED_PRODUCTION` blocked while `scout_edge_marriage_gate !== CLEARED` |

**FIP-001 vs runtime shape drift (BLOCKER for production):**

| FIP-001 required | Current `fipIntakeService` required | Status |
|---|---|---|
| `scout.fixture_id` | `fixture.fixture_id` | **DRIFT** |
| `validation.hash_algorithm` | `validation.algorithm` | **DRIFT** |
| `provenance.scout_run_id` | Not required | **MISSING** |
| `provenance.source_system` | Not required | **MISSING** |
| `fixture.kickoff_utc` | `fixture.kickoff_time` | **DRIFT** |
| `fixture.home_team.id` / `.name` | `fixture.home_team` flat string | **DRIFT** |
| `markets.direct_1x2` | `markets` object with `sharp_odds` | **DRIFT** |
| `context.weather`, `injuries`, etc. | `context` object with `contextual_intelligence` | **DRIFT** |

Proof fixtures in `tests/fip-intake-service.test.js` follow **runtime** shape, not full FIP-001 §7. Future adapter must validate **FIP-001 canonical shape** for production; proof mode may retain backward-compatible mapping layer until E2E proof migrates fixtures.

---

## I. Authentication and authorization design (future only)

| Control | Design |
|---|---|
| Transport | HTTPS POST from Scout push service to future governed Edge intake route |
| Authentication | Machine-to-machine HMAC-signed JWT or shared secret in env (never in repo) |
| Caller identity | `caller` string + verified service principal ID in evidence |
| Replay window | `received_at` within 5 minutes of transport timestamp; nonce optional in header |
| Timestamp skew | Align with `MAX_FUTURE_CLOCK_SKEW_MS` (5 min) and `MAX_VALIDATION_AGE_MS` (30 min) |
| Proof mode | `PROOF_FIXTURE` + explicit Control Center task authorization |
| Production mode | `AUTHORIZED_PRODUCTION` only when `scout_edge_marriage_gate === CLEARED` |
| Request size ceiling | 256 KB per FIP JSON body |
| Rate limiting | 10 intake requests/minute per caller (future route middleware) |
| Logging redaction | Never log full FIP body; log `fip_id`, `intake_id`, codes only |
| Secrets | Render/Vercel env vars only — **no credentials in repository** |

**I6 does not create secrets, routes, or live endpoints.**

---

## J. Identity-resolution law

**Proven law (no second identity system):**

```text
scout.fixture_id
  → fixture_identity_aliases (alias_namespace = 'scout_fixture_id', alias_value = scout.fixture_id)
    → fixture_uid (UUID)
```

| Rule | Law |
|---|---|
| Alias namespace | `scout_fixture_id` (sealed for UI3 adapter) |
| Alias value | Exact `scout.fixture_id` from validated FIP |
| Source system | `SCOUT` |
| Resolution | `lifecyclePersistenceService.findFixtureByAlias()` or equivalent read |
| Admission | If alias missing → `lifecyclePersistenceService.admitFixture()` with same alias binding |
| Forbidden | Using `scout.fixture_id` as `fixture_uid` |
| Forbidden | D3 minting `fixture_uid` independently |
| Forbidden | D3 write before lifecycle parent row exists |

**Secondary alias (optional):** `alias_namespace = 'fip_id'`, `alias_value = fip_id` for intake traceability — does not replace `scout_fixture_id` as canonical sports identity.

**Current status:** `fipIntakeService` does **not** resolve `fixture_uid`. **BLOCKER** for D3 adapter implementation.

---

## K. Lifecycle-before-D3 ordering (sealed sequence)

Inspection confirms the following **proven orchestration order**:

```text
1. Scout validated FIP (FIP-001)
2. Authenticated governed transport (future — EST-001)
3. EFI-001 intake validation — receiveValidatedFip() (exists partial)
4. Intake evidence record (ephemeral today; persistent store future)
5. Fixture identity resolution — scout.fixture_id → fixture_uid (NOT IMPLEMENTED)
6. Lifecycle admission OR existing fixture_uid confirmation (NOT WIRED)
7. mapValidatedFipToDisplayMetadataDto() (NOT IMPLEMENTED)
8. fixtureDisplayMetadataPersistenceService.upsertFromValidatedIntake(dto) (exists isolated)
9. mapValidatedFipToEdgeAnalysisEnvelope() (exists partial in fipIntakeService)
10. Future prediction pipeline use (NOT AUTHORIZED)
```

**Lifecycle-before-D3 law:** Steps 5–6 **must complete successfully** before step 8. D3 upsert **must reject** `DISPLAY_METADATA_LIFECYCLE_MISSING` if parent row absent (I5 enforced).

**Transaction boundary:** Steps 3–4 are in-process. Steps 5–8 should share one orchestration transaction in future implementation packet (identity + D3 upsert atomicity deferred to adapter design).

---

## L. FIP-to-D3 DTO crosswalk

Target: `upsertFromValidatedIntake(dto)` per I5 / `fixtureDisplayMetadataPersistenceService`.

| DTO field | Classification | FIP-001 source | Current availability |
|---|---|---|---|
| `fixtureUid` | lifecycle-resolved | N/A — from `fixture_identity_aliases` | **BLOCKER** |
| `sport` | direct | `fixture.sport` | Available (normalize `football`) |
| `scoutFixtureId` | direct | `scout.fixture_id` | **BLOCKER** in runtime shape (`fixture.fixture_id` only) |
| `fipId` | direct | `fip_id` | Available |
| `fipSchemaVersion` | direct | `fip_schema_version` | Available |
| `fipValidationHash` | direct | `validation.hash` | Available |
| `intakeId` | derived | from `evidence.intake_id` | Available post-intake |
| `homeTeamScoutId` | direct | `fixture.home_team.id` | **BLOCKER** (flat string in runtime) |
| `awayTeamScoutId` | direct | `fixture.away_team.id` | **BLOCKER** |
| `competitionId` | direct | `fixture.league_id` | **BLOCKER** (runtime uses `competition` string) |
| `competitionName` | direct | `fixture.league` | Partial (`fixture.competition`) |
| `kickoffAt` | direct | `fixture.kickoff_utc` | Partial (`fixture.kickoff_time`) |
| `timezone` | derived governed | fixed `Africa/Johannesburg` | Available |
| `homeTeamName` | direct | `fixture.home_team.name` | Partial (flat string) |
| `awayTeamName` | direct | `fixture.away_team.name` | Partial |
| `venue` | optional | Scout extension / not in FIP-001 §7 minimum | **Unavailable** — NULL |
| `country` | optional | Scout extension | Partial in proof fixtures |
| `homeTeamEmblemRef` | optional | Scout emblem ref (UI3-I2) | **Unavailable** in FIP-001 §7 — NULL until Scout provides |
| `awayTeamEmblemRef` | optional | Scout emblem ref | **Unavailable** — NULL |
| `metadataFreshAt` | direct | `validation.validated_at` | Available |
| `idempotencyKey` | derived | `SHA-256(fip_id\|hash\|schema_version)` | Available — must match I5 computed key |

**Full FIP body:** **PROHIBITED** at D3 boundary (EST-001 / I5).

---

## M. FIP-to-EdgeAnalysisEnvelope crosswalk status

| EFI-001 §6 field | Current `mapToEdgeAnalysisEnvelope` | Status |
|---|---|---|
| `match_info.match_id` | `fixture.fixture_id` | Partial |
| `match_info.home_team_id` | Missing | **GAP** |
| `match_info.away_team_id` | Missing | **GAP** |
| `match_info.kickoff` | `kickoff_time` | Partial |
| `sharp_odds` from `markets.direct_1x2` | Uses `markets.sharp_odds` or whole `markets` | **DRIFT** |
| `contextual_intelligence` structured | Uses `context.contextual_intelligence` or whole `context` | Partial |
| `metadata.scout_run_id` | Missing | **GAP** |
| `metadata.sports_truth_origin` | `SCOUT_FIP` | **PASS** |

**Conclusion:** Envelope mapping **works for EFI-001-I1 proof fixtures** but is **not FIP-001-canonical**. Future adapter must implement EFI-001 §6 crosswalk for production.

---

## N. Idempotency, replay and retry law

| Event | Law |
|---|---|
| Idempotency key | `SHA-256(fip_id\|validation.hash\|fip_schema_version)` |
| First accept | Process; record `ACCEPTED` evidence |
| Duplicate identical key | `NO_OP` preferred at D3 layer; intake may return prior evidence |
| Duplicate key, different hash | `FIP_HASH_MISMATCH` / `DISPLAY_METADATA_PROVENANCE_CONFLICT` — fail closed |
| HTTP retry | Safe for identical payload (idempotent); unsafe if Scout re-validates with new hash |
| Scout replay | New `validation.hash` → new idempotency key → D3 UPDATE if fresher |
| Stale replay | Reject `FIP_STALE` / `DISPLAY_METADATA_STALE_UPDATE` |

**Current storage:** Idempotency computed in-memory only; **no durable intake idempotency store** — **BLOCKER** for production.

---

## O. Intake evidence design

**Minimum evidence record (no full FIP body):**

| Field | Required | Source |
|---|---|---|
| `intake_id` | YES | `buildIntakeId()` — deterministic from fip_id + hash + received_at |
| `fip_id` | YES | payload |
| `fip_schema_version` | YES | payload |
| `fip_validation_hash` | YES | `validation.hash` |
| `scout_fixture_id` | YES | `scout.fixture_id` |
| `fixture_uid` | conditional | After identity resolution |
| `scout_run_id` | YES | `provenance.scout_run_id` |
| `received_at` | YES | transport timestamp |
| `validated_at` | YES | `validation.validated_at` |
| `outcome` | YES | `ACCEPTED` / `REJECTED` / `NO_OP` |
| `rejection_code` | conditional | Domain code |
| `governed_mode` | YES | `PROOF_FIXTURE` / `AUTHORIZED_PRODUCTION` |
| `caller` | YES | authorized caller ref |
| `idempotency_key` | YES | computed |

**Storage:** No approved persistent table exists today. `fipIntakeService` returns evidence object in result only. **Separate bounded design required** (EST-001 scope) — likely `lifecycle_fip_intake_evidence` or append-only log sink. **I6 does not authorize table creation.**

---

## P. Domain error contract (reconciled)

| Code | When |
|---|---|
| `FIP_SCHEMA_UNSUPPORTED` | Schema version or hash algorithm unsupported |
| `FIP_NOT_VALIDATED` | `validation.status !== VALIDATED` |
| `FIP_HASH_MISMATCH` | Recomputed hash mismatch |
| `FIP_REQUIRED_FIELD_MISSING` | FIP-001 / EFI-001 required field absent |
| `FIP_IDENTITY_INCONSISTENT` | scout.fixture_id vs fixture fields mismatch |
| `FIP_IDEMPOTENCY_DUPLICATE` | Duplicate intake key with conflicting handling |
| `FIP_INTAKE_UNAUTHORIZED` | Caller/mode unauthorized |
| `FIP_FORBIDDEN_ORIGIN` | Forbidden sports-truth origin detected |
| `FIP_ENVELOPE_MAP_FAILED` | Envelope crosswalk failure |
| `FIP_MARRIAGE_GATE_BLOCKED` | Production intake while gate blocked |
| `FIP_FIXTURE_IDENTITY_UNRESOLVED` | scout.fixture_id cannot resolve to fixture_uid |
| `FIP_LIFECYCLE_PARENT_MISSING` | Lifecycle row missing before D3 |
| `FIP_D3_MAP_FAILED` | DTO mapping failure |
| `FIP_INTAKE_EVIDENCE_UNAVAILABLE` | Evidence store unavailable |

Map current runtime codes: `HASH_MISMATCH` → `FIP_HASH_MISMATCH`, `FORBIDDEN_ORIGIN` → `FIP_FORBIDDEN_ORIGIN`, etc.

**Never expose:** secrets, raw FIP body, SQL errors, stack traces.

---

## Q. Resource limits

| Limit | Value |
|---|---|
| Max FIP JSON size | 256 KB |
| Max batch size (`fip_envelopes`) | 100 (existing `aiPipeline` law) |
| Validation age | 30 minutes (`MAX_VALIDATION_AGE_MS`) |
| Future clock skew | 5 minutes |
| Kickoff horizon | 48 hours provisional (`MAX_KICKOFF_HORIZON_MS`) — superseded by lifecycle governor when active |
| D3 upsert queries | ≤ 4 per I5 |

---

## R. Fail-closed behaviour

All validation failures return rejected intake with evidence stub; **no** envelope emission; **no** D3 write; **no** prediction use. Gate-before-database law applies to D3 and lifecycle services independently.

---

## S. Prohibited surfaces (I6)

No modification to `fipIntakeService.js`, `fixtureDisplayMetadataPersistenceService.js`, `lifecyclePersistenceService.js`, `aiPipeline.js`, routes, migrations, `public/`, evidence folders, or gate clearance.

---

## T. Implementation file plan (future — NOT AUTHORIZED in I6)

| File | Role |
|---|---|
| `backend/services/fipIntakeAdapterService.js` (future) | Orchestration: validate → identity → lifecycle → D3 DTO → envelope |
| `backend/services/fipIntakeService.js` | Retain as pure validator (after FIP-001 alignment correction) |
| `backend/routes/fipIntake.js` (future) | Governed HTTP boundary |
| Intake evidence migration (future) | EST-001 + separate authorization |
| `tests/fip-intake-adapter-service.test.js` (future) | Mock-first adapter tests |

---

## U. Test matrix (I6)

| Test | I6 status |
|---|---|
| `npm run test:sem-gov-001d-ui3-i6` | Packet guard |
| `npm run test:sem-gov-001d-ui3-i5` | D3 persistence regression |
| `tests/fip-intake-service.test.js` | Existing proof intake (unchanged) |
| Future adapter tests | **NOT STARTED** |

---

## V. Blockers and deferred work

| Blocker | Owner |
|---|---|
| FIP-001 field-shape alignment in `fipIntakeService` | Future EFI-001 / UI3-I7 implementation |
| `fixture_uid` resolution adapter | Future UI3-I7 |
| D3 DTO mapper | Future UI3-I7 |
| Persistent intake evidence store | EST-001 + future migration |
| HTTP intake route + auth | Future implementation |
| Lifecycle migration apply | `supabase_storage_gate` |
| D3 migration apply | `supabase_storage_gate` |
| Replace `buildLiveData()` default | EPRV-001 + E2E-001 |
| Gate clearance | Separate authorization |

**FUTURE_SECURITY_NOTE:** GitHub Dependabot reports 5 dependency vulnerabilities; **not addressed in I6**.

---

## W. Definition of Done — SEM-GOV-001D-UI3-I6

- [x] Existing intake code and callers inspected
- [x] Runtime status proven
- [x] Canonical FIP source and prohibited sources sealed
- [x] Hash verification proven from FIP-001 + runtime
- [x] Fixture identity resolution law sealed
- [x] Lifecycle-before-D3 sequence sealed
- [x] Complete D3 DTO crosswalk documented
- [x] EdgeAnalysisEnvelope compatibility documented
- [x] Authentication design documented
- [x] Replay/retry law documented
- [x] Intake evidence requirements documented
- [x] No runtime implementation
- [x] No database or HTTP operations
- [x] All gates BLOCKED
- [ ] Adapter implementation — **NOT STARTED**

---

## X. Inspection decision

**PASS WITH BLOCKER**

Design and inspection are complete. Production-safe adapter implementation is **blocked** by: FIP-001 shape drift in runtime intake, missing `fixture_uid` resolution, missing D3 DTO mapper, missing persistent intake evidence, lifecycle/D3 migrations not applied, and all governance gates BLOCKED.

**Next implementation packet:** `SEM-GOV-001D-UI3-I7` — Governed FIP Intake Adapter Implementation (proposed name; not authorized in I6).

---

## Y. Proof commands

```text
npm run test:sem-gov-001d-ui3-i6
npm run test:sem-gov-001d-ui3-i5
npm run test:sem-gov-001d-ui3-i4
npm run test:sem-gov-001d-ui3-i3
npm run test:sem-gov-001d-ui3-i2
npm run test:sem-gov-001d-ui3-i1
npm run control:center
npm run control:projects
npm run verify:rulebook
```
