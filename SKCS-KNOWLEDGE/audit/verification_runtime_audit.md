# Verification Runtime Audit

Status: Active  
Priority: High

Purpose: determine what Layer 5 verification checks are actually implemented in SKCS today, versus what is only defined in the spec or execution map.

This is a truth audit, not a design audit.

## Scope

### In scope

- `backend/services/aiPipeline.js`
- `backend/services/syncService.js`
- `backend/services/contextEnrichmentService.js`
- `backend/services/quotaPlanner.js`
- `backend/services/providerQuotaService.js`
- `backend/routes/predictions.js`
- `backend/services/cronJobs.js`
- scheduled scripts and runtime validation hooks
- Supabase RLS / policy enforcement state where it affects runtime behavior

### Out of scope

- UI components unless they directly enforce runtime logic
- static markdown docs
- Notebook / LLM analysis layers

## Audit method

This audit records only what is actually present in runtime code paths or live policy state.

Classification:
- `VERIFIED` = the check is implemented and visible in a live code path.
- `PARTIAL` = some logic exists, but it is not a full enforcement gate.
- `MISSING` = no runtime implementation was found in the scanned code paths.
- `UNKNOWN` = not yet verified in the current pass.

## 1) Prediction pipeline verification

### 1.1 Raw input schema validation

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | YES |
| Location | `backend/services/aiPipeline.js` |
| Status | VERIFIED |
| Evidence | `validateRawPredictionInput(raw)` is called before insert; invalid inputs are rejected and logged. |

### 1.2 Pipeline mutual exclusion / re-entrancy guard

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | YES |
| Location | `backend/services/aiPipeline.js` |
| Status | VERIFIED |
| Evidence | `isRunning` blocks concurrent runs with a logged warning and a returned error object. |

### 1.3 Deployment-sport gate

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | YES |
| Location | `backend/services/aiPipeline.js`, `backend/services/syncService.js` |
| Status | VERIFIED |
| Evidence | Sports outside the active deployment set are skipped before pipeline execution. |

### 1.4 Duplicate raw prediction suppression

| Field | Value |
| --- | --- |
| Defined in spec | IMPLIED |
| Exists in code | YES |
| Location | `backend/services/aiPipeline.js` |
| Status | VERIFIED |
| Evidence | A dedupe key is built for raw rows and duplicates are skipped within the run. |

### 1.5 Confidence bounds enforcement

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | PARTIAL / NOT FULLY VERIFIED IN THIS PASS |
| Location | prediction generation logic |
| Status | PARTIAL |
| Notes | Confidence bands and warnings exist, but a hard clamp / centralized runtime gate was not confirmed in the current scan. |

## 2) Enrichment layer verification

### 2.1 Context freshness checks

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | NOT FOUND IN THIS PASS |
| Location | `backend/services/contextEnrichmentService.js` / enrichment pipeline |
| Status | MISSING |
| Notes | Freshness logic was not observed as a hard verification gate. |

### 2.2 Null-state handling for provider payloads

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | YES, BUT PARTIAL |
| Location | `backend/services/thesportsdbPipeline.js` |
| Status | PARTIAL |
| Evidence | `fetchTheSportsDB()` returns `null` on invalid JSON; `enrichMatchContext()` catches the resulting failure and continues with fallback values. |
| Notes | This is a soft-failure path, not a deterministic gate. |

### 2.3 Fallback logging for enrichment failures

| Field | Value |
| --- | --- |
| Defined in spec | IMPLIED |
| Exists in code | YES |
| Location | `backend/services/thesportsdbPipeline.js`, `backend/services/contextEnrichmentService.js` |
| Status | VERIFIED |
| Evidence | Failures are logged and the pipeline continues rather than crashing. |

### 2.4 Degraded-state flag for enrichment

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | NOT FOUND IN THIS PASS |
| Location | enrichment pipeline |
| Status | MISSING |
| Notes | No explicit degraded-state flag was found for partial enrichment success. |

## 3) Read path verification

### 3.1 Empty dataset protection

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | YES, BUT PARTIAL |
| Location | `backend/routes/predictions.js` |
| Status | PARTIAL |
| Evidence | The route falls back to DB/Supabase reads and logs failures, but it does not clearly expose a dedicated degraded-state signal to the caller. |

### 3.2 Score presence validation

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | UNKNOWN / PARTIAL |
| Location | `backend/routes/predictions.js` |
| Status | PARTIAL |
| Notes | The read path filters rows and handles missing values defensively, but no explicit Layer 5 score-validation gate was confirmed. |

### 3.3 Explicit degraded-mode response

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | NOT FOUND IN THIS PASS |
| Location | `/api/predictions` and related read routes |
| Status | MISSING |
| Notes | Warnings and fallbacks exist, but a standardized degraded response was not observed. |

## 4) Quota and cost enforcement

### 4.1 Pre-call quota gating

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | YES |
| Location | `backend/services/quotaPlanner.js`, `backend/services/syncService.js` |
| Status | VERIFIED |
| Evidence | `buildFootballPlan()` returns `allowed: false` when caps are exhausted or usable calls are insufficient. `syncService` blocks football sync when the planner says not to proceed. |

### 4.2 Provider quota state evaluation

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | YES |
| Location | `backend/services/providerQuotaService.js`, `backend/services/quotaPlanner.js` |
| Status | VERIFIED |
| Evidence | Quota state is read from the DB and converted into allow/block decisions. |

### 4.3 Hard enforcement after quota check

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | PARTIAL |
| Location | `backend/services/quotaPlanner.js`, `backend/services/syncService.js` |
| Status | PARTIAL |
| Notes | Football quota is enforced. Broader, centralized enforcement across every provider path was not confirmed. |

### 4.4 Provider failover policy as a runtime gate

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | PARTIAL / UNKNOWN |
| Location | provider and fallback services |
| Status | PARTIAL |
| Notes | Fallback behavior exists in runtime code, but a single verified control point for failover policy was not found in this pass. |

## 5) Scheduled verification jobs

### 5.1 Daily discovery / pulse / cleanup jobs

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | YES |
| Location | `backend/services/cronJobs.js` |
| Status | VERIFIED |
| Evidence | Daily discovery, pulse enrichment, and stale prediction cleanup are scheduled. |

### 5.2 Row-count auditor

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | NOT FOUND IN THIS PASS |
| Location | scheduled jobs / maintenance scripts |
| Status | MISSING |
| Notes | No dedicated row-count verification job was identified in the current scan. |

### 5.3 Orphaned-context sweeper

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | NOT FOUND IN THIS PASS |
| Location | scheduled jobs / maintenance scripts |
| Status | MISSING |
| Notes | No explicit runtime sweeper was identified for stale or orphaned context rows. |

## 6) Enforcement behavior audit

### 6.1 Central PASS / WARN / FAIL control plane

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | NOT FOUND IN THIS PASS |
| Status | MISSING |
| Notes | Runtime logic uses warnings, returns, and errors, but not a single centralized enforcement enum or control plane. |

### 6.2 Degraded-state flag propagation

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | NOT FOUND IN THIS PASS |
| Status | MISSING |
| Notes | Degradation is often implicit rather than explicitly propagated. |

### 6.3 Rollback signals

| Field | Value |
| --- | --- |
| Defined in spec | YES |
| Exists in code | NOT FOUND IN THIS PASS |
| Status | MISSING |
| Notes | No clear rollback signal surfaced in the scanned runtime modules. |

## 7) Failure mode validation

### 7.1 Enrichment failure

| Field | Value |
| --- | --- |
| Logged explicitly | YES |
| Alerted | NO EVIDENCE FOUND |
| Silent degradation possible | YES |
| Status | PARTIAL |

### 7.2 Empty prediction surfaces

| Field | Value |
| --- | --- |
| Logged explicitly | SOMETIMES |
| Alerted | NO EVIDENCE FOUND |
| Silent degradation possible | YES |
| Status | PARTIAL |

### 7.3 Quota exhaustion

| Field | Value |
| --- | --- |
| Logged explicitly | YES |
| Alerted | NO EVIDENCE FOUND |
| Silent degradation possible | NO, IF THE GATE IS HIT |
| Status | VERIFIED / PARTIAL |

### 7.4 RLS mismatch / access drift

| Field | Value |
| --- | --- |
| Logged explicitly | NO EVIDENCE FOUND |
| Alerted | NO EVIDENCE FOUND |
| Silent degradation possible | YES |
| Status | MISSING |

## 8) Runtime truth summary

### Verified checks

- Raw prediction input validation exists in `aiPipeline.js`.
- Pipeline re-entrancy protection exists in `aiPipeline.js`.
- Deployment-sport gating exists in `aiPipeline.js` and `syncService.js`.
- Raw prediction deduplication exists in `aiPipeline.js`.
- Quota preflight gating exists in `quotaPlanner.js` and is enforced in `syncService.js`.
- Daily discovery, pulse enrichment, and stale cleanup cron jobs exist in `cronJobs.js`.
- Enrichment failures are logged and the pipeline continues.

### Partial implementations

- Confidence bounds enforcement is present as rules/warnings but was not confirmed as a hard runtime gate.
- Enrichment null handling exists only as soft-failure behavior around `results` access.
- The predictions read path falls back and logs warnings, but does not clearly expose a standardized degraded-state flag.
- Provider failover behavior exists, but a single centralized enforcement point was not confirmed.

### Missing enforcement

- Context freshness verification gate.
- Explicit degraded-state propagation.
- Row-count auditor.
- Orphaned-context sweeper.
- Central PASS / WARN / FAIL control plane.
- Rollback signals.
- RLS mismatch detection as a runtime verification signal.

## 9) Critical silent gaps

- No clear alerting layer was identified for soft failures.
- No rollback signal path was identified in the scanned runtime modules.
- No degraded-state flag propagation was identified.
- No dedicated runtime check was identified for freshness collapse or null-spike detection.
- RLS policy state is being tracked in the database, but a runtime verification layer for access drift was not found in this pass.

## 10) System truth statement

- Spec: COMPLETE
- Execution map: COMPLETE
- Runtime enforcement reality: MIXED

The system already contains real enforcement in a few important places, but several of the most important verification controls still exist only as intent or partial behavior.

## 11) Next step

Patch only the missing hooks identified here.

Do not redesign the architecture.
Do not duplicate checks already present.
Do not convert partial behavior into a new parallel control system.

Close enforcement gaps only.

