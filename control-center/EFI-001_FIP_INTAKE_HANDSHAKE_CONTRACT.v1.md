# EFI-001 — FIP Intake Handshake Contract v1

## Contract status

| Field | Value |
|---|---|
| **Contract ID** | `EFI-001_FIP_INTAKE_HANDSHAKE_CONTRACT.v1` |
| **Governed task** | `EFI-001` — FIP Intake Handshake |
| **Contract mode** | Contract-only (EFI-001-C1) |
| **Marriage gate** | **BLOCKED** (unchanged) |
| **Runtime implementation** | **FORBIDDEN** in this packet |
| **Date sealed** | 2026-07-12 |
| **Prior contracts** | `EMG-001_SCOUT_EDGE_MARRIAGE_GATE_CONTRACT.v1`, `SEE-001_SCOUT_EDGE_E2E_MARRIAGE_PROOF.v1` |

---

## 1. Purpose

This contract defines the **single governed fail-closed intake boundary** through which Edge may accept a validated canonical Scout Fixture Intelligence Package (FIP) for prediction analysis.

EFI-001-C1 answers:

1. What exact Scout/FIP payload Edge is allowed to ingest.
2. Where the intake boundary sits in architecture.
3. What validation must complete before prediction use.
4. What must fail closed.
5. What evidence must be recorded.
6. What remains blocked before implementation.

This contract **does not** implement the bridge. It seals the law that a future EFI-001 implementation packet must follow.

---

## 2. Relationship to EMG-001

| EMG-001 law | EFI-001-C1 application |
|---|---|
| Sports truth enters only via validated FIP through EFI-001 | This contract defines that boundary |
| `POST /api/pipeline/run { matches }` forbidden for proof | Not a governed intake boundary |
| `buildLiveData()` forbidden as proof origin | Intake boundary must replace sports-truth origin in governed mode |
| Gate remains BLOCKED until separate approval | Intake contract does not clear gate |
| Sequence EMG-001 → EFI-001 → EST-001 → E2E-001 | This packet completes EFI-001 contract step only |

---

## 3. Accepted FIP source

Edge may ingest sports truth **only** from the following origin:

```text
Scout (Neon)
  → Scout FIP assembly + validation (FIP-001 authority)
    → governed transport (transport law owned by EST-001)
      → EFI-001 intake boundary (this contract)
        → transient Edge analysis envelope
          → prediction pipeline
```

### Allowed source conditions (ALL required)

| # | Condition |
|---|---|
| S1 | Payload is a **validated canonical Scout FIP** per `FIP-001` |
| S2 | `validation.status` is exactly `VALIDATED` |
| S3 | Payload is **unmodified** since Scout validation (hash integrity preserved) |
| S4 | Payload enters Edge **only** through the EFI-001 intake boundary |
| S5 | Intake occurs in a **governed mode** explicitly authorized by Control Center (proof fixture or approved production mode) |
| S6 | Provenance metadata required by §8 is present |

### Forbidden sources (fail closed)

| Source | Ruling |
|---|---|
| `dataProvider.getPredictionInputs()` → `buildLiveData()` | **REJECT** — external provider acquisition |
| Parallel context/acquisition services | **REJECT** as sports-truth origin |
| `POST /api/pipeline/run { matches: [...] }` | **REJECT** — not a governed FIP boundary |
| `public/data/*` snapshots | **REJECT** — illustrative only |
| Workspace candidates (`scoutSignalSync.js`, `intel_read_contract_v1.md`) | **REJECT** until committed and registered as authority |
| Direct Neon/Scout DB reads bypassing intake validation | **REJECT** |
| Manually constructed or provider-mixed payloads | **REJECT** |

---

## 4. Intake boundary definition

### Logical boundary (contract target)

The EFI-001 intake boundary is **one** governed surface with these properties:

```text
[Future] fipIntakeBoundary.receiveValidatedFip(payload, context)
  → validate against EFI-001 + FIP-001
  → record intake evidence (§9)
  → on success: emit EdgeAnalysisEnvelope (§6)
  → on failure: fail closed (§7); no prediction use
```

### Architectural insertion point

```text
Scout validated FIP
  → EFI-001 intake boundary          ← MUST BE IMPLEMENTED HERE
    → EdgeAnalysisEnvelope
      → aiPipeline.buildRawPredictionFromProviderItem()
        → insertRawPrediction / filterRawPrediction
```

**Governed replacement rule:** In Scout-governed sports-truth mode, `dataProvider.getPredictionInputs()` must **not** call `buildLiveData()` for sports truth. EFI-001 becomes the sole sports-truth origin for that mode.

### Boundary exclusions (not sufficient alone)

| Surface | Why excluded |
|---|---|
| `backend/routes/pipeline.js` POST `/run { matches }` | No FIP schema validation, provenance, or idempotency law |
| `backend/services/dataProvider.js` | Currently external-provider acquisition |
| `backend/services/syncService.js` | Currently calls `buildLiveData()` |
| Any UI or admin manual paste path | No fail-closed validation |

### Future implementation targets (declarative only — not authorized here)

| Target | Role |
|---|---|
| `backend/services/fipIntakeService.js` (name reserved) | Primary intake validator + envelope mapper |
| Optional `backend/routes/fipIntake.js` (name reserved) | Governed receive/read API for authorized callers |
| Intake evidence store / log sink | Records §9 evidence; retention law deferred to EST-001 |

**No file named above may be created in EFI-001-C1.**

---

## 5. Canonical FIP payload (minimum contract)

Until `FIP-001` is committed as governed authority, this section defines the **Edge intake minimum** that EFI-001 must enforce. When `FIP-001` is registered, it becomes authoritative and this section must be crosswalk-tested for drift.

### 5.1 FIP wrapper (required)

| Field | Type | Required | Rule |
|---|---|---|---|
| `fip_id` | string | **YES** | Stable Scout-issued package identifier |
| `fip_schema_version` | string | **YES** | Must match an allowed version list maintained by Control Center |
| `validation.status` | string | **YES** | Must be exactly `VALIDATED` |
| `validation.hash` | string | **YES** | Canonical hash of validated FIP body; mismatch → reject |
| `validation.validated_at` | ISO-8601 string | **YES** | Scout validation timestamp |
| `scout.fixture_id` | string | **YES** | Scout canonical fixture identifier |
| `provenance.scout_run_id` | string | **YES** | Scout assembly run reference |
| `provenance.source_system` | string | **YES** | Must be `SCOUT` |

### 5.2 Fixture identity (required)

| Field | Type | Required | Rule |
|---|---|---|---|
| `fixture.sport` | string | **YES** | Normalized sport key |
| `fixture.league_id` | string | **YES** | Scout league identifier |
| `fixture.league` | string | **YES** | Human-readable league label |
| `fixture.kickoff_utc` | ISO-8601 string | **YES** | Fixture kickoff time |
| `fixture.status` | string | **YES** | Pre-match state acceptable for intake window |
| `fixture.home_team.id` | string | **YES** | Stable home team identity |
| `fixture.home_team.name` | string | **YES** | Home team display name |
| `fixture.away_team.id` | string | **YES** | Stable away team identity |
| `fixture.away_team.name` | string | **YES** | Away team display name |

### 5.3 Markets / odds (required for direct pipeline)

| Field | Type | Required | Rule |
|---|---|---|---|
| `markets.direct_1x2` | object | **YES** | Must contain finite odds for home/draw/away OR explicit null with documented Scout reason |
| `markets.direct_1x2.home` | number \| null | conditional | Required when market published |
| `markets.direct_1x2.draw` | number \| null | conditional | Required when market published |
| `markets.direct_1x2.away` | number \| null | conditional | Required when market published |
| `markets.source` | string | **YES** | Must be Scout-governed, not Edge provider |

### 5.4 Context intelligence (required object; fields may be empty)

| Field | Type | Required | Rule |
|---|---|---|---|
| `context.weather` | object \| null | **YES** | Key must exist; null permitted if Scout has no weather truth |
| `context.injuries` | array | **YES** | May be empty array |
| `context.suspensions` | array | **YES** | May be empty array |
| `context.availability` | object | **YES** | Home/away availability structure |
| `context.h2h` | object | **YES** | H2H evidence object; may be empty summary |
| `context.form` | object | **YES** | Team form object; may contain empty summaries |
| `context.lineups` | object | **YES** | Expected/confirmed lineup slots; may be empty |

### 5.5 Forbidden payload content

| Content | Rule |
|---|---|
| Raw provider API responses presented as sports truth | **REJECT** |
| Edge-acquired provider snapshots inside FIP body | **REJECT** |
| Mixed Scout + Edge provider truth without Scout validation | **REJECT** |
| Full Scout evidence archive blobs | **REJECT** at intake (transport may carry reference only per EST-001) |

---

## 6. FIP → Edge analysis envelope crosswalk

On successful intake, EFI-001 must emit an **EdgeAnalysisEnvelope** conforming to committed pipeline expectations before `buildRawPredictionFromProviderItem()`.

### Output shape

```json
{
  "match_info": {
    "match_id": "<scout.fixture_id>",
    "sport": "<fixture.sport>",
    "home_team": "<fixture.home_team.name>",
    "away_team": "<fixture.away_team.name>",
    "home_team_id": "<fixture.home_team.id>",
    "away_team_id": "<fixture.away_team.id>",
    "kickoff": "<fixture.kickoff_utc>",
    "league": "<fixture.league>",
    "league_id": "<fixture.league_id>",
    "status": "<fixture.status>"
  },
  "sharp_odds": {
    "home": "<markets.direct_1x2.home>",
    "draw": "<markets.direct_1x2.draw>",
    "away": "<markets.direct_1x2.away>",
    "source": "<markets.source>"
  },
  "contextual_intelligence": {
    "weather": "<context.weather>",
    "injuries": "<context.injuries>",
    "suspensions": "<context.suspensions>",
    "availability": "<context.availability>",
    "h2h": "<context.h2h>",
    "form": "<context.form>",
    "expected_lineups": "<context.lineups.expected>",
    "confirmed_lineups": "<context.lineups.confirmed>"
  },
  "metadata": {
    "sports_truth_origin": "SCOUT_FIP",
    "fip_id": "<fip_id>",
    "fip_schema_version": "<fip_schema_version>",
    "validation_hash": "<validation.hash>",
    "scout_run_id": "<provenance.scout_run_id>",
    "intake_contract": "EFI-001_FIP_INTAKE_HANDSHAKE_CONTRACT.v1"
  }
}
```

### Crosswalk rules

| Rule | Law |
|---|---|
| X1 | `match_info.match_id` must equal `scout.fixture_id` |
| X2 | No field mapping may silently default missing required FIP identity |
| X3 | Envelope must not add sports truth not present in validated FIP |
| X4 | `metadata.sports_truth_origin` must be `SCOUT_FIP` |
| X5 | Original FIP wrapper provenance must survive into `metadata` |

---

## 7. Validation and fail-closed rules

### Pre-prediction validation sequence (ordered)

```text
1. Schema version gate
2. Validation status gate
3. Hash integrity gate
4. Required field gate
5. Identity consistency gate
6. Idempotency gate
7. Intake authorization gate
8. Envelope mapping gate
```

### Fail-closed rejection table

| Code | Condition | Action |
|---|---|---|
| `FIP_SCHEMA_UNSUPPORTED` | `fip_schema_version` not in allowed list | Reject; log; no prediction |
| `FIP_NOT_VALIDATED` | `validation.status` ≠ `VALIDATED` | Reject; log; no prediction |
| `FIP_HASH_MISMATCH` | Recomputed hash ≠ `validation.hash` | Reject; log; no prediction |
| `FIP_REQUIRED_FIELD_MISSING` | Any §5 required field absent | Reject; log; no prediction |
| `FIP_IDENTITY_INCONSISTENT` | Team/fixture identity fails consistency checks | Reject; log; no prediction |
| `FIP_IDEMPOTENCY_DUPLICATE` | Same idempotency key already accepted | No-op or reject per §8; never duplicate prediction |
| `FIP_INTAKE_UNAUTHORIZED` | Governed mode / caller not authorized | Reject; log; no prediction |
| `FIP_FORBIDDEN_ORIGIN` | Payload contains forbidden provider-mixed truth | Reject; log; no prediction |
| `FIP_ENVELOPE_MAP_FAILED` | Crosswalk cannot produce valid envelope | Reject; log; no prediction |
| `FIP_MARRIAGE_GATE_BLOCKED` | Production intake attempted while gate blocked without proof authorization | Reject; log; no prediction |

### Prediction use gate

**No call to `buildRawPredictionFromProviderItem()` may occur unless all validation steps pass and intake evidence is recorded.**

---

## 8. Idempotency and provenance law

### Idempotency key

```text
idempotency_key = SHA-256(fip_id + "|" + validation.hash + "|" + fip_schema_version)
```

| Event | Law |
|---|---|
| First accepted intake for key | Process and record `ACCEPTED` |
| Duplicate key, identical payload | `NO_OP` with evidence record (preferred) or `REJECT` with `FIP_IDEMPOTENCY_DUPLICATE` |
| Duplicate key, different payload | **REJECT** `FIP_HASH_MISMATCH` — fail closed |

### Provenance minimum (must survive to prediction metadata)

| Field | Purpose |
|---|---|
| `fip_id` | Canonical package identity |
| `fip_schema_version` | Schema drift control |
| `validation.hash` | Integrity proof |
| `validation.validated_at` | Scout validation time |
| `provenance.scout_run_id` | Assembly traceability |
| `provenance.source_system` | Must remain `SCOUT` |
| `intake_id` | Edge intake event identity (generated at boundary) |
| `intake_contract_version` | `EFI-001_FIP_INTAKE_HANDSHAKE_CONTRACT.v1` |

Permanent Supabase retention of these fields is governed by **EST-001**, not this contract.

---

## 9. Evidence that must be recorded

Every intake attempt (accept or reject) must produce a structured evidence record.

### Required evidence fields

| Field | Required | Notes |
|---|---|---|
| `intake_id` | YES | UUID or deterministic intake event id |
| `timestamp_utc` | YES | Edge intake processing time |
| `fip_id` | YES | From payload |
| `fip_schema_version` | YES | From payload |
| `validation.hash` | YES | From payload |
| `idempotency_key` | YES | Per §8 |
| `result` | YES | `ACCEPTED` \| `REJECTED` \| `NO_OP` |
| `rejection_code` | conditional | Required when `REJECTED` |
| `rejection_detail` | conditional | Human/machine readable reason |
| `caller` | YES | Authorized surface identifier |
| `governed_mode` | YES | `PROOF_FIXTURE` \| `AUTHORIZED_PRODUCTION` |
| `envelope_emitted` | conditional | `true` only on `ACCEPTED` |

### Evidence storage

- Storage location, retention duration, and Supabase table design are **EST-001** scope.
- EFI-001-C1 requires only that evidence **must** be recordable and auditable; it does not authorize schema creation.

---

## 10. Blocked before implementation

The following remain **blocked** after EFI-001-C1:

| Blocker | Owner |
|---|---|
| Runtime intake service/route implementation | Future EFI-001 implementation packet |
| Committed `FIP-001` authority artifact in repo | Separate registration/import packet |
| `EST-001` transport and retention law | EST-001-C1+ |
| Idempotency proof in runtime | Future EFI-001 implementation packet |
| Input validation proof tests | Future EFI-001 implementation packet |
| `scout_edge_marriage_gate` clearance | Separate explicit approval after E2E-001 |
| `E2E-001` controlled proof | After EST-001 + implementation |
| `EPRV-001` provider removal completion | Before E2E proof |
| Replacing `buildLiveData()` in production | After E2E proof authorization |
| Supabase table/migration for intake evidence | EST-001 + implementation authorization |

**EFI-001-C1 does not authorize any item in this table.**

---

## 11. EFI-001-C1 completion verdict

| Criterion | Result |
|---|---|
| FIP intake handshake contract written | **PASS** |
| Accepted FIP source defined | **PASS** |
| Required payload fields defined | **PASS** |
| Rejection/fail-closed rules defined | **PASS** |
| Runtime implementation forbidden | **PASS** |
| Marriage gate remains BLOCKED | **PASS** |
| Implementation authorized | **NO** |

---

## 12. Control Center integration

| Artifact | Role |
|---|---|
| `EDGE_BUILD_CONTROL_LEDGER.v1.json` | `EFI-001` task status and evidence |
| `EDGE_MASTER_PROJECT_REGISTER.v1.json` | Project mirror |
| `EDGE_CONTROL_CENTER.md` | Operator evidence note |
| `EMG-001_SCOUT_EDGE_MARRIAGE_GATE_CONTRACT.v1` | Upstream gate law |
| This contract | Authoritative intake handshake law for EFI-001-C1 |

---

## 13. Validation boundary

EFI-001-C1:

- **Does** define the governed FIP intake handshake contract.
- **Does** keep `scout_edge_marriage_gate` **BLOCKED**.
- **Does** authorize EST-001 contract inspection when separately approved.
- **Does not** implement intake code, routes, pipeline changes, Supabase mutations, deployment, provider removal, or gate clearance.
- **Does not** reopen the cleanup programme.

---

## 14. References

- `EMG-001_SCOUT_EDGE_MARRIAGE_GATE_CONTRACT.v1.md`
- `SEE-001_SCOUT_EDGE_E2E_MARRIAGE_PROOF.v1.md`
- `backend/services/syncService.js` — `toNormalizationInput()` envelope expectations
- `backend/services/aiPipeline.js` — `buildRawPredictionFromProviderItem()` downstream consumer
- `FIP-001` (referenced; committed artifact pending)
