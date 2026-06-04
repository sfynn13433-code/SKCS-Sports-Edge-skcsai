# Verification Layer Spec

Status: Active  
Priority: High

Purpose: define Layer 5 as an operational control system, not just a concept.

## Core invariant

- Knowledge Layer remains the source of truth.
- Notebook and other analysis layers may infer, but they do not promote truth.
- Verification must run before operational trust is granted to a change.

## What Layer 5 controls

Layer 5 governs the transition from documented intent to trusted runtime behavior.

It must control:
- data integrity
- pipeline health
- RLS correctness
- cost anomalies

## Verification inputs

Verification checks should consume real signals, not narrative descriptions.

Accepted inputs:
- database queries
- pipeline outputs
- API responses
- job logs
- counters and freshness metrics
- policy state from Supabase
- quota and provider usage metrics

## Deterministic checks

The following check classes should be treated as first-class controls.

### 1) Data integrity

Examples:
- expected rows exist
- required joins are present
- null spikes stay within bounds
- freshness timestamps are updated

Example rule:

```text
IF prediction row count = 0 AND fixtures exist
THEN FAIL
```

### 2) Pipeline health

Examples:
- prediction generation success rate
- enrichment completion rate
- settlement completion rate
- backfill completion rate

Example rule:

```text
IF enrichment completion rate drops below the defined floor
THEN WARN or BLOCK depending on table criticality
```

### 3) RLS correctness

Examples:
- public read returns rows where expected
- service-role writes still succeed
- protected tables do not unexpectedly return empty sets

Example rule:

```text
IF public SELECT returns zero rows on a known-read table AND data exists
THEN FAIL
```

### 4) Cost anomalies

Examples:
- API call spikes
- quota exhaustion
- repeated fallback/provider churn
- unexpected HTML or non-JSON provider responses

Example rule:

```text
IF provider error rate spikes beyond the threshold
THEN WARN and escalate to investigation
```

## Threshold model

Layer 5 should support at least four decision bands.

### Pass

The change is safe to promote.

### Warn

The change is acceptable, but a soft failure or drift signal was detected.

### Block

The change should not be promoted because a required check failed.

### Degrade

The system may continue operating, but a reduced-trust mode should be declared.

## Suggested operational thresholds

These should be tuned per table or job class, but the system needs defaults.

- Prediction rows absent while fixtures exist: fail.
- Enrichment freshness beyond the agreed window: warn or degrade.
- Required RLS read path returning empty unexpectedly: fail.
- API or provider error rates rising sharply: warn or fail depending on impact.
- Settlement or publish jobs incomplete: fail.

## Execution points

Verification should run at multiple points, not only before deployment.

### Pre-change

- schema changes
- RLS changes
- migration rollout
- provider configuration changes

### Post-change

- verify row counts
- verify reads
- verify writes
- verify freshness
- verify fallback behavior

### Runtime

- daily integrity checks
- scheduled freshness checks
- provider quota checks
- soft-failure detection

## Actions

Verification results must map to system actions.

- allow
- warn
- block
- degrade mode
- rollback flag
- create gap note

## Promotion rules

Truth promotion should be explicit.

```text
draft -> verified -> production-trusted
```

Promotion requires:
- a defined check set
- a passing verification result
- a recorded timestamp or run reference
- a clear owner or subsystem

## What is not allowed

- Treating documentation as proof.
- Treating a successful job as proof that data quality is good.
- Treating a model consensus as verification.
- Promoting inferred behavior to operational truth without checks.

## Initial implementation surfaces

This spec is intended to be enforced through:
- SQL validation queries
- cron validators
- post-migration checks
- runtime health jobs
- deployment gates
- alerting rules

## Why this matters

The system is moving from architecture description to system enforcement.
Without Layer 5, the Knowledge Layer can describe the system but cannot prove it is safe to trust.

## Related documents

- `SKCS-KNOWLEDGE/governance/documentation_policy.md`
- `SKCS-KNOWLEDGE/governance/ai_usage_policy.md`
- `SKCS-KNOWLEDGE/audit/prediction_dependency_audit.md`
- `SKCS-KNOWLEDGE/audit/knowledge_layer_completeness_audit.md`
- `SKCS-KNOWLEDGE/audit/gap_report.md`
- `SKCS-KNOWLEDGE/knowledge/system_topology.md`
- `SKCS-KNOWLEDGE/knowledge/dependency_registry.md` (planned)
- `SKCS-KNOWLEDGE/security/rls_registry.md` (planned)

