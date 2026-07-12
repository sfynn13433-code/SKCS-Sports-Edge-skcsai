# SEE-001 — Scout–Edge Read-Only E2E Marriage Proof

**Mini-project ID:** SEE-001  
**Status:** COMPLETE (read-only inspection)  
**Start commit:** `6a8dc811da3e50dfa14653250991c9467f54a7cb`  
**Inspection HEAD:** `6a8dc811da3e50dfa14653250991c9467f54a7cb`  
**Date:** 2026-07-12  
**Mode:** Read-only inspection + evidence packet only  

---

## Result

**NEEDS IMPLEMENTATION**

The first Scout–Edge end-to-end marriage proof cannot run safely from current committed contracts and runtime paths. Governance correctly keeps `scout_edge_marriage_gate` **BLOCKED** and `E2E-001` **BLOCKED**.

A safe first E2E proof requires separate contract and implementation mini-projects before any live marriage test.

---

## Start-point verification

| Check | Result |
|---|---|
| `git status --short` | Clean (no output) |
| `git rev-parse HEAD` | `6a8dc811da3e50dfa14653250991c9467f54a7cb` |
| `git rev-parse origin/main` | `6a8dc811da3e50dfa14653250991c9467f54a7cb` |
| Cleanup programme | `PROGRAMME_CLOSED` |
| `phase_8.status` / `lifecycle_state` | `PHASE_CLOSED` |
| `npm run control:center` | PASS |
| `npm run control:verify` | PASS |
| `npm run verify:rulebook` | PASS |

Cleanup programme was not reopened.

---

## Question answered

> Can we prove, from current files and contracts, what Edge expects from Scout, what Scout provides, and what gap blocks a safe first E2E marriage test?

**Answer:** Partially. Edge’s de facto prediction input shape and runtime entrypoints are provable from committed code. Scout’s canonical FIP contract and a governed Edge intake boundary are **not** present in the committed repository. Several Scout-adjacent artifacts exist only as preserved workspace candidates.

---

## Edge expected input contract (committed, de facto)

Edge does **not** consume a named canonical FIP today. The live configured path is external-provider acquisition normalized into pipeline items.

### Primary configured entry chain

```text
backend/routes/pipeline.js  POST /run (no matches body)
  → aiPipeline.runPipelineFromConfiguredDataMode()
    → dataProvider.getPredictionInputs()
      → buildLiveData()  [DATA_MODE=live]
        → APISportsClient / Big Balls / TheSportsDB / Odds API / RapidAPI / ESPN / etc.
    → aiPipeline.buildRawPredictionFromProviderItem(item)
      → semanticGuard.enforceSemanticAlignment()
      → buildMatchContext()
      → insertRawPrediction() / filterRawPrediction()
```

### Secondary manual-injection entry (already exists)

```text
backend/routes/pipeline.js  POST /run  { matches: [...] }
  → aiPipeline.runPipelineForMatches({ matches })
    → buildRawPredictionFromProviderItem(item)  [per supplied match]
```

This route is **not** a governed FIP intake boundary. It accepts admin-authenticated arbitrary match payloads and does not validate Scout provenance, FIP schema version, idempotency keys, or retention law.

### De facto normalized item shape

`syncService.toNormalizationInput()` and `aiPipeline.buildRawPredictionFromProviderItem()` accept:

1. **Preferred analysis envelope** (already normalized):
   - `match_info` (requires `match_id`, team identity fields)
   - `sharp_odds`
   - `contextual_intelligence` (weather, injuries, suspensions, lineups, etc.)

2. **Legacy envelope:**
   - `match` + `odds`

3. **Provider-flat envelope** from `dataProvider.normalizeFixture()`:
   - `match_id`, `sport`, `home_team`, `away_team`, `date`, `status`, `market`, `odds`, `provider`, `raw_provider_data`, etc.

`contextual_intelligence` is optional at ingest but materially affects downstream context scoring when present (`syncService.hasMeaningfulContext()`).

### Parallel non-FIP acquisition surfaces (still reachable)

Documented in `EDGE_CONTROL_CENTER.md` §4 and confirmed in code:

| Surface | Role |
|---|---|
| `backend/services/dataProvider.js` | Primary fixture/odds acquisition |
| `backend/services/contextIngestionService.js` | API-Sports injuries, OpenWeather, NewsAPI context |
| `backend/services/contextEnrichmentService.js` | Additional context enrichment |
| `backend/services/footballHighlightsService.js` | Highlight/context acquisition |
| `backend/services/syncService.js` | Sync path calling `buildLiveData()` |
| `scripts/import-today-snapshot-pipeline.js` | Snapshot import acquisition |

**SCOUT-SOLE-PROVIDER STATE:** PARTIAL (`EPRV-001`).

### Canonical football ingest (separate from Scout FIP)

`docs/canonical_ingest_firewall.spec.md` + `backend/services/canonicalIngestFirewall.js` define API-Sports-shaped canonical football truth for `football_canonical_events`. This is an **Edge-internal football truth firewall**, not the Scout FIP intake contract referenced by `FIP-001`.

---

## Scout / FIP contract references present in Edge

| Reference | Location | Committed? | Runtime proof? |
|---|---|---|---|
| `FIP-001` | `EDGE_BUILD_CONTROL_LEDGER.v1.json`, `EDGE_MASTER_PROJECT_REGISTER.v1.json` | Referenced only | No contract artifact in repo |
| Architectural law Scout → FIP → Edge | `EDGE_CONTROL_CENTER.md` §1, §5 | Yes | Governance only |
| `EMG-001` marriage gate prerequisites | Ledger + register | Yes | PROPOSED — no contract file |
| `EFI-001` intake handshake definition | Ledger + register | Yes | PROPOSED — no intake boundary |
| `E2E-001` proof requirements | Ledger + register | Yes | BLOCKED — open gaps documented |
| `backend/services/scoutSignalSync.js` | Asset register workspace candidate + runtime inventory surface | **No** (PRE_EXISTING_UNTRACKED) | Candidate only; references `SCOUT_DATABASE_URL`, `scout_raw_match_signals` |
| `docs/intel_read_contract_v1.md` | Asset register workspace candidate | **No** (PRE_EXISTING_UNTRACKED) | Not readable from committed tree |
| `scout_fip_visibility_activates_marriage` | `EDGE_SYSTEM_RUNTIME_INVENTORY.v1.json` semantics | Yes | `false` |

### Runtime inventory Scout/FIP surfaces (heuristic classification)

`check_edge_system_runtime_inventory.js` tags paths matching `scout|fip|SCOUT_DATABASE_URL|scout_raw_match_signals`. Surfaces include:

- `backend/services/dataProvider.js` — because it is the future replacement target for sports truth input
- `backend/services/scoutSignalSync.js` — absent file, candidate only
- `control-center/*` and `public/js/control-center.js` — governance UI references only

**Conclusion:** Edge governance knows about Scout/FIP, but committed runtime does not read validated Scout FIP.

---

## Exact Edge entrypoint that should consume Scout output

**Governed target (not implemented):** a new fail-closed intake boundary owned by `EFI-001`, upstream of prediction analysis, replacing `getPredictionInputs()` → `buildLiveData()` as the sports-truth origin.

**Practical insertion point in existing architecture:**

```text
EFI-001 intake boundary (TO BE IMPLEMENTED)
  → normalized FIP → existing analysis envelope
    → aiPipeline.buildRawPredictionFromProviderItem()
```

**Nearest existing hook (insufficient alone):** `POST /api/pipeline/run` with `{ matches }` could accept FIP-translated payloads for a **non-governed** experiment only. It must not be treated as marriage proof without EMG-001 + EFI-001 + EST-001 contracts.

---

## Exact Scout/FIP data shape Edge expects or lacks

### What Edge analysis already understands

Committed pipeline code expects **derived analysis envelopes**, not a Scout FIP package:

- `match_info` with stable `match_id` and team identity
- `sharp_odds` object
- `contextual_intelligence` object (weather, injuries, availability, lineups)

### What Edge lacks for Scout marriage

| Missing artifact | Why it blocks E2E |
|---|---|
| Canonical `FIP-001` contract file in Edge repo | No authoritative schema/version to validate against |
| Scout FIP → Edge envelope crosswalk | No mapping law from Scout fields to `match_info` / `sharp_odds` / `contextual_intelligence` |
| Governed intake route/service | No fail-closed receive/read boundary with provenance |
| Idempotency + provenance retention law (`EST-001`) | Cannot prove safe re-ingest or minimal Supabase retention |
| Marriage gate contract (`EMG-001`) | Gate cannot clear even if intake existed |
| Committed `scoutSignalSync.js` or equivalent | No Neon/Scout read path in repository |
| Committed `intel_read_contract_v1.md` or equivalent | No readable Scout output contract in tree |
| Provider removal completion (`EPRV-001`) | Live pipeline still reaches external sports APIs |

### Workspace candidates (not committed — cannot be proof)

- `backend/services/scoutSignalSync.js`
- `docs/intel_read_contract_v1.md`

These may inform `EFI-001` design but are not current authority.

---

## Gaps found (blocking first E2E proof)

1. **No committed FIP-001 artifact** — only ledger/register references.
2. **No EFI-001 intake boundary** — `getPredictionInputs()` still calls `buildLiveData()`.
3. **EMG-001 PROPOSED** — marriage gate contract undefined/untested.
4. **EST-001 PROPOSED** — transport vs retention undecided in implementable form.
5. **ESEC-001 / EPI-001 PROPOSED** — security and pipeline integrity inventories incomplete.
6. **EPRV-001 PARTIAL** — six reachable external acquisition surfaces remain.
7. **Scout bridge files absent from committed tree** — `scoutSignalSync.js`, `intel_read_contract_v1.md` are candidates only.
8. **E2E-001 open gaps** — all seven ledger gaps still open (`FIP intake not implemented`, storage law, security, pipeline protection, provider removal incomplete).
9. **`scout_fip_visibility_activates_marriage: false`** — inventory semantics explicitly do not activate marriage from surface tagging alone.

---

## Evidence inspected

### Governance / contracts

- `control-center/EDGE_CONTROL_CENTER.md` (§1–§6, marriage gate, provider-removal state)
- `control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json` (EMG-001, EFI-001, E2E-001, EPRV-001)
- `control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json`
- `control-center/EDGE_PROJECT_BACKLOG.md`
- `control-center/EDGE_PROJECT_DEPENDENCY_MAP.md`
- `control-center/EDGE_SYSTEM_RUNTIME_INVENTORY.v1.json`
- `control-center/EDGE_SYSTEM_RUNTIME_MAP.md`
- `control-center/EDGE_REPOSITORY_ASSET_REGISTER.v1.json` (workspace candidates)
- `control-center/check_edge_system_runtime_inventory.js` (Scout/FIP heuristic)

### Runtime / API

- `backend/routes/pipeline.js`
- `backend/services/aiPipeline.js` (`runPipelineFromConfiguredDataMode`, `buildRawPredictionFromProviderItem`)
- `backend/services/dataProvider.js` (`getPredictionInputs`, `buildLiveData`, `normalizeFixture`)
- `backend/services/syncService.js` (`toNormalizationInput`, `hasMeaningfulContext`)
- `backend/services/contextIngestionService.js` (external context acquisition)
- `docs/canonical_ingest_firewall.spec.md` (Edge football truth — not Scout FIP)

### Sample data (read-only)

- `public/data/context-pack-2026-05-17.json` — illustrates rich event context shape, but is **not** a governed FIP contract and is not wired as pipeline intake authority.

---

## Decision matrix

| Criterion | Verdict |
|---|---|
| Can we prove Edge’s current sports-truth origin? | **YES** — external providers via `buildLiveData()` |
| Can we prove Scout FIP schema from committed Edge repo? | **NO** |
| Can we prove a governed intake boundary exists? | **NO** |
| Can we run a safe first E2E marriage test today? | **NO** |
| Is marriage gate correctly blocked? | **YES** |
| Overall first E2E proof readiness | **NEEDS IMPLEMENTATION** |

---

## Next recommended mini-project

**EMG-001-C1 — Scout–Edge Marriage Gate Contract (contract-only)**

Define and test the explicit marriage-gate contract before any intake implementation:

- Required evidence checklist per prerequisite (EFI-001, EST-001, ESEC-001, EPI-001, EPRV-001, E2E-001)
- Fail-closed gate validator (incomplete prerequisites cannot clear gate)
- Canonical cross-reference to `FIP-001` source of truth (likely requires importing/registering Scout’s FIP contract or `intel_read_contract_v1.md` into governed assets)
- Explicit statement whether `POST /api/pipeline/run { matches }` is in or out of scope for future proof

**Do not** implement the Scout–Edge bridge, provider removal, or Supabase mutations in the follow-on unless separately authorized.

Suggested sequence after EMG-001-C1:

1. `EFI-001` contract + smallest fail-closed intake boundary  
2. `EST-001` transport/retention law  
3. `E2E-001` controlled proof fixture  
4. Separate explicit approval of `scout_edge_marriage_gate`

---

## Forbidden actions (confirmed not performed)

- Cleanup programme reopening: **NO**
- File deletion / merge / retirement / refactor: **NO**
- Runtime / UI / product behavior change: **NO**
- SQL execution / Supabase mutation: **NO**
- Deployment / dependency / security remediation: **NO**
- Scout–Edge bridge implementation: **NO**

---

## Validation boundary

Read-only inspection and Control Center evidence recording only. This packet does not authorize implementation, deployment, or marriage-gate clearance.
