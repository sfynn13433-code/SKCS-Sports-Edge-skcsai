# EPI-001 — Prediction Pipeline Integrity Contract v1

## Contract status

| Field | Value |
|---|---|
| **Contract ID** | `EPI-001_PREDICTION_PIPELINE_INTEGRITY_CONTRACT.v1` |
| **Governed task** | `EPI-001` — Prediction Pipeline Integrity |
| **Contract mode** | Contract-only (EPI-001-C1) |
| **Scout ↔ Edge marriage gate** | **BLOCKED** (unchanged) |
| **Supabase storage gate** | **BLOCKED** (unchanged) |
| **Runtime implementation** | **FORBIDDEN** in this packet |
| **Date sealed** | 2026-07-13 |
| **Prior contracts** | `FIP-001_SCOUT_FIP_AUTHORITY_CONTRACT.v1`, `EFI-001_FIP_INTAKE_HANDSHAKE_CONTRACT.v1`, `EST-001_SUPABASE_STORAGE_AND_FIP_RETENTION_CONTRACT.v1`, `EMG-001_SCOUT_EDGE_MARRIAGE_GATE_CONTRACT.v1` |

---

## 1. Purpose

This contract protects the existing Edge prediction pipeline before the Scout FIP intake is wired into real prediction execution.

EPI-001-C1 answers:

1. Which pipeline files are protected?
2. Which prediction behaviours must not break during FIP integration?
3. Which current provider/acquisition paths are risk surfaces but not removed here?
4. Which database and Supabase dependencies must remain compatible with EST-001 retention law?
5. Which future implementation actions require a separate packet?

This contract does **not** edit prediction runtime code, remove providers, create SQL, mutate Supabase, wire routes, execute E2E proof, or clear gates.

---

## 2. Protected pipeline surfaces

| Surface | Protected responsibility | EPI ruling |
|---|---|---|
| `backend/services/aiPipeline.js` | Orchestrates input gathering, context enrichment, scoring, filtering, direct 1X2 evaluation, raw prediction insertion, ACCA construction, and publishing | Preserve orchestration semantics; future FIP work must replace the input origin without silently changing scoring/publication behaviour |
| `backend/services/aiScoring.js` | Produces baseline prediction, confidence, and volatility using model/odds/fallback logic | Preserve scoring outputs; AI may analyze supplied intelligence but must not become canonical sports truth |
| `backend/services/filterEngine.js` | Applies tier rules and writes filtered prediction outputs | Preserve validation and table contract for `predictions_raw` and `predictions_filtered` |
| `backend/services/direct1x2Engine.js` | Applies deterministic weather/injury/form/H2H/volatility adjustments to direct 1X2 probabilities | Preserve pure in-memory adjustment semantics |
| `backend/services/marketIntelligence.js` | Defines market categories, priorities, fallback ladders, conflict rules, safe pools, and secondary market selection | Preserve market taxonomy and conflict behaviour |
| `backend/services/accaBuilder.js` | Builds ACCA tickets, stage rows, same-match combinations, publication rows, and double-chance legs | Preserve ACCA construction, publication dependencies, and table expectations |

---

## 3. Current inspection evidence

EPI-001-C1 records the following inspection evidence from the approved inspection packet:

| Evidence area | Finding |
|---|---|
| Git state | Clean at `cf315cdc66e4ada6b84713e1b20996d864c6f9a3` before contract work |
| `aiPipeline.js` | Coordinates scoring, filtering, ACCA, publication, and still contains live/context acquisition risk surfaces |
| `aiScoring.js` | Operates on in-memory match objects and may call Dolphin/AI analysis |
| `filterEngine.js` | Reads/writes PostgreSQL/Supabase prediction tables and validates raw prediction shape |
| `direct1x2Engine.js` | Pure in-memory scoring/adjustment engine |
| `marketIntelligence.js` | Pure market taxonomy, priority, safety, fallback, and conflict logic |
| `accaBuilder.js` | Reads filtered/raw/stage/rule tables and writes publication/same-match outputs |
| Existing checks | `npm run control:center`, `npm run control:verify`, and `npm run verify:rulebook` passed before this contract |

---

## 4. Core laws

| Law | Requirement |
|---|---|
| **Sports truth owner** | Scout remains canonical sports truth owner |
| **Edge role** | Edge owns analysis, scoring, filtering, ACCA construction, explanation, publication, users, subscribers, and commercial state |
| **FIP input law** | Future FIP implementation must supply equivalent prediction input facts through the governed EFI/EST boundary |
| **No silent score drift** | FIP integration must not silently change scoring, confidence, filtering, market conflict, ACCA, or publication rules |
| **No provider deletion here** | Provider/acquisition risk surfaces are documented but not removed in EPI-001-C1 |
| **No full FIP retention** | EST-001 remains binding: Edge may persist provenance/reference/audit/derived prediction state, not full Scout mirrors |
| **AI boundary** | AI/Dolphin/EdgeMind may analyze supplied facts but must not create canonical sports truth |

---

## 5. Protected invariants for future FIP implementation

Future implementation must preserve or explicitly prove any intentional change to:

1. `predictions_raw` insert shape and validation.
2. `predictions_filtered` filter output behaviour.
3. Direct 1X2 probability adjustment semantics.
4. Market priority tiers and fallback ladders.
5. Conflict detection between same-match and correlated markets.
6. ACCA leg construction and publication flow.
7. Same-match-combination safety rules.
8. Prediction provenance fields required by EST-001.
9. Existing grading/accuracy compatibility.
10. Existing subscriber/publication surfaces.

---

## 6. Known risk surfaces for later packets

| Risk surface | Reason | Future owner |
|---|---|---|
| `aiPipeline.js -> getPredictionInputs()` | May trigger live provider acquisition instead of governed FIP input | EPRV-001 / future EPI implementation |
| `aiPipeline.js` context calls | Weather, injury, H2H, form, and news/context acquisition may still be direct | EPRV-001 |
| `aiScoring.js -> analyzeWithDolphin()` | AI must not infer canonical sports facts outside supplied FIP context | EAI-001 / EPI implementation |
| `filterEngine.js` DB reads/writes | Future FIP rows must satisfy existing raw prediction validation | EPI implementation |
| `accaBuilder.js` DB joins and publication writes | EST retention limits must not break required derived prediction/ACCA tables | EPI / EST implementation |

These are **findings**, not repairs.

---

## 7. Forbidden in EPI-001-C1

EPI-001-C1 does not authorize:
- editing `aiPipeline.js`
- editing `aiScoring.js`
- editing `filterEngine.js`
- editing `direct1x2Engine.js`
- editing `marketIntelligence.js`
- editing `accaBuilder.js`
- SQL execution
- Supabase mutation
- migration creation
- route wiring
- E2E proof
- provider removal
- dependency/security remediation
- gate clearance
- cleanup programme reopening

---

## 8. Future implementation gate

Before a future EPI implementation may touch runtime prediction code, it must provide:

| Required proof | Description |
|---|---|
| Baseline behaviour proof | Current scoring/filtering/ACCA behaviour captured before code change |
| FIP input mapping | Mapping from EFI accepted envelope to existing pipeline input shape |
| Raw prediction compatibility proof | FIP-derived rows satisfy existing `predictions_raw` validation |
| ACCA compatibility proof | ACCA construction still receives required filtered/raw/stage inputs |
| Provider bypass proof | External acquisition is bypassed only where FIP supplies equivalent governed intelligence |
| No-storage-drift proof | Full FIP bodies and Scout mirrors are not persisted |
| Gate proof | Marriage and storage gates remain BLOCKED unless separately approved |

---

## 9. Relationship to upstream contracts

| Contract | EPI-001-C1 relationship |
|---|---|
| **FIP-001** | Defines the validated Scout FIP authority source |
| **EFI-001** | Defines the fail-closed intake boundary and accepted analysis envelope |
| **EST-001** | Defines what Edge may retain in Supabase |
| **EMG-001** | Keeps the marriage gate blocked until all prerequisites and explicit approval exist |
| **EPRV-001** | Owns provider-removal work after FIP replacement proof exists |
| **E2E-001** | Owns end-to-end proof only after prerequisite packets are ready |

---

## 10. Completion verdict

| Criterion | Result |
|---|---|
| Protected pipeline surfaces identified | **PASS** |
| Current inspection evidence recorded | **PASS** |
| Runtime implementation forbidden | **PASS** |
| Provider removal forbidden | **PASS** |
| SQL/Supabase/migration forbidden | **PASS** |
| Gates remain BLOCKED | **PASS** |
| Future implementation proof requirements defined | **PASS** |

---

## 11. Validation boundary

EPI-001-C1:

- **Does** define the protected prediction pipeline contract.
- **Does** register current risk surfaces for later packets.
- **Does** protect scoring, filtering, ACCA, and publication semantics.
- **Does not** change prediction runtime code.
- **Does not** remove providers.
- **Does not** run SQL, mutate Supabase, or create migrations.
- **Does not** clear `scout_edge_marriage_gate` or `supabase_storage_gate`.
- **Does not** reopen the cleanup programme.
