# FIP-001 — Scout FIP Authority Contract v1

## Contract status

| Field | Value |
|---|---|
| **Contract ID** | `FIP-001_SCOUT_FIP_AUTHORITY_CONTRACT.v1` |
| **Governed task** | `FIP-001` — Scout FIP Authority Contract |
| **Contract mode** | Contract-only (FIP-001-C1) |
| **Marriage gate** | **BLOCKED** (unchanged) |
| **`supabase_storage_gate`** | **BLOCKED** (unchanged) |
| **Runtime implementation** | **FORBIDDEN** in this packet |
| **Date sealed** | 2026-07-12 |
| **Start commit** | `ecebdc9fab4ae5ee89c23c0f3785894cc45da47e` |
| **Prior contracts** | `EMG-001_SCOUT_EDGE_MARRIAGE_GATE_CONTRACT.v1`, `EFI-001_FIP_INTAKE_HANDSHAKE_CONTRACT.v1`, `EST-001_SUPABASE_STORAGE_AND_FIP_RETENTION_CONTRACT.v1`, `E2E-001_SCOUT_EDGE_PROOF_PLANNING_PACKET.v1`, `SEE-001_SCOUT_EDGE_E2E_MARRIAGE_PROOF.v1` |

---

## 1. Purpose

This contract registers the **committed Scout Fixture Intelligence Package (FIP) authority** that Edge recognizes as the **only valid canonical sports-truth contract** for governed intake, crosswalk, and future proof work.

FIP-001-C1 answers:

1. What is the FIP schema identity?
2. What is the required payload shape?
3. Who owns validation status and hash authority?
4. What fixture identity is required?
5. What market and context requirements apply?
6. What governed proof modes are allowed?
7. What non-canonical sources are forbidden?

This contract **does not** implement intake, run E2E proof, create database tables, or change runtime behavior.

---

## 2. Canonical ownership law

| Domain | Owner | Store | Edge role |
|---|---|---|---|
| Sports truth assembly | **Scout** | Neon | Consume validated FIP only through EFI-001 |
| FIP validation state | **Scout** | Neon | Verify `validation.status` and `validation.hash` |
| Hash computation authority | **Scout** | Neon | Edge recomputes and compares; Scout algorithm is authoritative |
| Full validated FIP body | **Scout** | Neon | Transient T0 transport only per EST-001 |
| Derived predictions | **Edge** | Supabase | D1 outputs linked by R1 provenance |
| Intake audit | **Edge** | Supabase | R2 events per EFI-001 |

**Scout remains the canonical sports-truth owner.** Edge must not assemble, enrich, or substitute provider-acquired sports truth outside a validated Scout FIP received through EFI-001.

---

## 3. Relationship to sealed contracts

| Contract | FIP-001 role |
|---|---|
| **EMG-001** | Marriage gate requires committed FIP-001 crosswalk before implementation; gate stays BLOCKED |
| **EFI-001** | Intake boundary validates against FIP-001; EFI-001 §5 defers to this contract as authoritative |
| **EST-001** | Edge stores references (R1/R2) only; full FIP body remains in Scout |
| **E2E-001** | First proof uses one Football `PROOF_FIXTURE` sample conforming to FIP-001 |

### EFI-001 crosswalk authority

EFI-001 §5 defined the **intake minimum** until FIP-001 was registered. **FIP-001 is now authoritative.** EFI-001 §5 and FIP-001 §6 must be crosswalk-tested for drift before EFI-001-I1 implementation.

---

## 4. FIP schema identity

| Field | Law |
|---|---|
| **Authority ID** | `FIP-001` |
| **Contract artifact** | `control-center/FIP-001_SCOUT_FIP_AUTHORITY_CONTRACT.v1.md` |
| **Allowed `fip_schema_version` values** | `1.0.0` only (at FIP-001-C1 seal) |
| **Version gate** | Unsupported version → EFI-001 `FIP_SCHEMA_UNSUPPORTED` |
| **Schema drift control** | New versions require separate Control Center authorization and contract amendment |

```json
{
  "fip_schema_version": "1.0.0"
}
```

---

## 5. Validation status law

| Field | Law |
|---|---|
| `validation.status` | Must be exactly `VALIDATED` |
| Non-validated states | `DRAFT`, `PENDING`, `FAILED`, `REJECTED`, or any other value → **reject** at EFI-001 (`FIP_NOT_VALIDATED`) |
| Validation authority | **Scout only** — Edge does not upgrade or downgrade validation state |
| `validation.validated_at` | ISO-8601 UTC timestamp of Scout validation; required |

Edge may accept a FIP for governed analysis **only** when Scout has already marked it `VALIDATED`.

---

## 6. Hash authority law

| Field | Law |
|---|---|
| `validation.hash` | Required; lowercase hex SHA-256 string (64 characters) |
| `validation.hash_algorithm` | Required; must be exactly `scout-fip-sha256-v1` at FIP-001-C1 seal |
| Computation authority | **Scout** computes at validation time |
| Verification authority | **Edge EFI-001** recomputes and compares; mismatch → `FIP_HASH_MISMATCH` |
| Transit integrity | Payload must be **unmodified** since Scout validation |

### `scout-fip-sha256-v1` algorithm (authoritative)

```text
validation.hash = SHA-256( UTF-8 bytes of canonical_json( fip_hash_body ) )

fip_hash_body = the complete FIP object with:
  - validation.hash set to empty string ""
  - all other fields unchanged

canonical_json = JSON serialization with:
  - object keys sorted lexicographically at every depth
  - no insignificant whitespace
  - UTF-8 encoding
  - arrays preserve element order
```

Scout and Edge must use the same algorithm for proof and production governed modes. Algorithm changes require a new `validation.hash_algorithm` value and separate authorization.

### Idempotency key (EFI-001 alignment)

```text
idempotency_key = SHA-256( fip_id + "|" + validation.hash + "|" + fip_schema_version )
```

---

## 7. Required payload shape

A conforming FIP is a single JSON object. All §7 fields are required unless marked optional.

### 7.1 FIP wrapper (required)

| Field | Type | Required | Rule |
|---|---|---|---|
| `fip_id` | string | **YES** | Stable Scout-issued package identifier; globally unique within Scout |
| `fip_schema_version` | string | **YES** | Must be `1.0.0` at seal time |
| `validation.status` | string | **YES** | Must be `VALIDATED` |
| `validation.hash` | string | **YES** | Per §6 |
| `validation.hash_algorithm` | string | **YES** | Must be `scout-fip-sha256-v1` |
| `validation.validated_at` | string | **YES** | ISO-8601 UTC |
| `scout.fixture_id` | string | **YES** | Scout canonical fixture identifier |
| `provenance.scout_run_id` | string | **YES** | Scout assembly run reference |
| `provenance.source_system` | string | **YES** | Must be exactly `SCOUT` |
| `provenance.assembled_at` | string | **YES** | ISO-8601 UTC Scout assembly timestamp |

### 7.2 Fixture identity (required)

| Field | Type | Required | Rule |
|---|---|---|---|
| `fixture.sport` | string | **YES** | Normalized sport key; first E2E proof requires `football` |
| `fixture.league_id` | string | **YES** | Scout league identifier |
| `fixture.league` | string | **YES** | Human-readable league label |
| `fixture.kickoff_utc` | string | **YES** | ISO-8601 UTC kickoff |
| `fixture.status` | string | **YES** | Pre-match state acceptable for intake window |
| `fixture.home_team.id` | string | **YES** | Stable home team identity |
| `fixture.home_team.name` | string | **YES** | Home team display name |
| `fixture.away_team.id` | string | **YES** | Stable away team identity |
| `fixture.away_team.name` | string | **YES** | Away team display name |

**Fixture consistency law:** `scout.fixture_id` must resolve to the same fixture identity as `fixture.*` team and kickoff fields. Mismatch → EFI-001 `FIP_IDENTITY_INCONSISTENT`.

### 7.3 Markets (required for direct pipeline)

| Field | Type | Required | Rule |
|---|---|---|---|
| `markets.direct_1x2` | object | **YES** | Must exist |
| `markets.direct_1x2.home` | number \| null | conditional | Finite decimal odds when market published |
| `markets.direct_1x2.draw` | number \| null | conditional | Finite decimal odds when market published |
| `markets.direct_1x2.away` | number \| null | conditional | Finite decimal odds when market published |
| `markets.source` | string | **YES** | Scout-governed source label; must not name Edge provider APIs |

### 7.4 Context intelligence (required object; values may be empty)

| Field | Type | Required | Rule |
|---|---|---|---|
| `context.weather` | object \| null | **YES** | Key must exist |
| `context.injuries` | array | **YES** | May be `[]` |
| `context.suspensions` | array | **YES** | May be `[]` |
| `context.availability` | object | **YES** | Home/away availability structure |
| `context.h2h` | object | **YES** | May be empty summary |
| `context.form` | object | **YES** | May contain empty summaries |
| `context.lineups` | object | **YES** | Must include `expected` and `confirmed` keys; may be empty |

### 7.5 Forbidden payload content

| Content | Ruling |
|---|---|
| Raw provider API responses as sports truth | **FORBIDDEN** |
| Edge-acquired provider snapshots inside FIP body | **FORBIDDEN** |
| Mixed Scout + Edge provider truth without Scout validation | **FORBIDDEN** |
| Full Scout evidence archive blobs | **FORBIDDEN** in permanent Edge storage (EST-001 F1) |

---

## 8. Governed modes and proof fixture law

### 8.1 Allowed governed modes (at EFI-001 boundary)

| Mode | Authorization | FIP-001-C1 status |
|---|---|---|
| `PROOF_FIXTURE` | Control Center proof execution packet (e.g. future `E2E-001-X1`) | **Defined** — only mode authorized for first proof |
| `AUTHORIZED_PRODUCTION` | Separate operator authorization after marriage gate clearance | **FORBIDDEN** until gate cleared |

### 8.2 Reserved first proof fixture

| Field | Value |
|---|---|
| `proof_fixture_id` | `E2E-001-PROOF-001` |
| Sport | `football` |
| Fixture count | Exactly **1** |
| Kickoff window | ≥ 24 hours in future at proof time (pre-match only) |
| League | One allowlisted football league already supported by Edge deployment sport gates |
| `proof_fip_id` | Assigned by Scout at validation time; recorded in proof evidence |

The proof FIP must be delivered from Scout Neon through governed transport into EFI-001 — not manually constructed at Edge.

---

## 9. Forbidden non-canonical sources

Edge must **not** treat any of the following as FIP-001 authority or valid sports-truth substitutes:

| Source | Ruling |
|---|---|
| `dataProvider.getPredictionInputs()` → `buildLiveData()` | **FORBIDDEN** |
| `contextIngestionService.js` / `contextEnrichmentService.js` / `footballHighlightsService.js` | **FORBIDDEN** as sports-truth origin |
| `syncService.js` calling `buildLiveData()` | **FORBIDDEN** for governed sports truth |
| `POST /api/pipeline/run { matches: [...] }` | **FORBIDDEN** — not a governed FIP boundary |
| `public/data/*` context packs | **FORBIDDEN** — illustrative only |
| Workspace candidates (`scoutSignalSync.js`, `docs/intel_read_contract_v1.md`) | **FORBIDDEN** until committed and registered as governed authority |
| Direct Neon/Scout DB reads bypassing EFI-001 validation | **FORBIDDEN** |
| Manually constructed or provider-mixed payloads | **FORBIDDEN** |
| Supabase-stored FIP body replay | **FORBIDDEN** — replay authority is Scout per EST-001 |
| `docs/canonical_ingest_firewall.spec.md` / `canonicalIngestFirewall.js` | **FORBIDDEN** as FIP substitute — Edge-internal football firewall only |

---

## 10. Minimum conforming example (illustrative — not proof data)

```json
{
  "fip_id": "scout-fip-example-0001",
  "fip_schema_version": "1.0.0",
  "validation": {
    "status": "VALIDATED",
    "hash": "0000000000000000000000000000000000000000000000000000000000000000",
    "hash_algorithm": "scout-fip-sha256-v1",
    "validated_at": "2026-07-12T12:00:00.000Z"
  },
  "scout": {
    "fixture_id": "scout-fixture-example-0001"
  },
  "provenance": {
    "scout_run_id": "scout-run-example-0001",
    "source_system": "SCOUT",
    "assembled_at": "2026-07-12T11:55:00.000Z"
  },
  "fixture": {
    "sport": "football",
    "league_id": "league-example",
    "league": "Example League",
    "kickoff_utc": "2026-07-15T15:00:00.000Z",
    "status": "NS",
    "home_team": { "id": "team-home-1", "name": "Home FC" },
    "away_team": { "id": "team-away-1", "name": "Away FC" }
  },
  "markets": {
    "direct_1x2": { "home": 2.1, "draw": 3.4, "away": 3.2 },
    "source": "scout-governed-odds"
  },
  "context": {
    "weather": null,
    "injuries": [],
    "suspensions": [],
    "availability": { "home": {}, "away": {} },
    "h2h": {},
    "form": { "home": {}, "away": {} },
    "lineups": { "expected": {}, "confirmed": {} }
  }
}
```

This example is **not** proof data and must not be used as an E2E fixture without Scout validation and Control Center authorization.

---

## 11. Blockers after FIP-001-C1

| Blocker | Owner | Status after seal |
|---|---|---|
| EFI-001 runtime intake service/route | EFI-001-I1 | **BLOCKED** — implementation forbidden in FIP-001-C1 |
| EST-001 schema + retention enforcement | EST-001-I1 | **BLOCKED** |
| Controlled Scout FIP sample from Neon | Scout + `E2E-001-X1` | **BLOCKED** |
| ESEC-001 / EPI-001 / EPRV-001 | respective tasks | **INCOMPLETE** |
| Actual E2E proof execution | `E2E-001-X1` | **FORBIDDEN** in FIP-001-C1 |
| `scout_edge_marriage_gate` clearance | Separate operator authorization | **BLOCKED** |
| `supabase_storage_gate` clearance | After EST-001 implementation proof | **BLOCKED** |

**FIP-001-C1 satisfies EMG-001 contract-level block §6.4 item 4** (committed FIP-001 artifact). It does **not** clear the marriage gate.

---

## 12. FIP-001-C1 completion verdict

| Criterion | Result |
|---|---|
| FIP-001 authority contract committed | **PASS** |
| Control Center points to committed authority | **PASS** |
| Scout confirmed as canonical sports-truth owner | **PASS** |
| Schema identity, payload, validation, hash, fixture, market/context defined | **PASS** |
| Proof mode and forbidden sources defined | **PASS** |
| Marriage gate remains BLOCKED | **PASS** |
| Runtime intake implemented | **NO** |
| E2E proof executed | **NO** |

**Overall:** **APPROVED (authority registered; gates remain BLOCKED)**

---

## 13. Control Center integration

| Artifact | Role |
|---|---|
| `FIP-001_SCOUT_FIP_AUTHORITY_CONTRACT.v1.md` | Authoritative FIP contract (this file) |
| `EDGE_BUILD_CONTROL_LEDGER.v1.json` | `FIP-001` task status and evidence |
| `EDGE_REPOSITORY_ASSET_REGISTER.v1.json` | Governed asset registration |
| `EDGE_CONTROL_CENTER.md` | Operator evidence note |
| `EFI-001_FIP_INTAKE_HANDSHAKE_CONTRACT.v1.md` | Downstream intake law; §5 crosswalk target |
| `E2E-001_SCOUT_EDGE_PROOF_PLANNING_PACKET.v1.md` | Proof sample requirements |

---

## 14. Validation boundary

FIP-001-C1:

- **Does** register the committed Scout FIP authority for Edge recognition.
- **Does** keep `scout_edge_marriage_gate` and `supabase_storage_gate` **BLOCKED**.
- **Does not** implement intake, run proof, mutate Supabase, change runtime, or clear gates.
- **Does not** reopen the cleanup programme.

---

## 15. References

- `EMG-001_SCOUT_EDGE_MARRIAGE_GATE_CONTRACT.v1.md`
- `EFI-001_FIP_INTAKE_HANDSHAKE_CONTRACT.v1.md`
- `EST-001_SUPABASE_STORAGE_AND_FIP_RETENTION_CONTRACT.v1.md`
- `E2E-001_SCOUT_EDGE_PROOF_PLANNING_PACKET.v1.md`
- `SEE-001_SCOUT_EDGE_E2E_MARRIAGE_PROOF.v1.md`
- `backend/services/aiPipeline.js` — `buildRawPredictionFromProviderItem()` downstream consumer
- `backend/services/syncService.js` — envelope shape expectations
