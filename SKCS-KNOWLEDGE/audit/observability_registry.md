# SKCS Observability Registry

This registry is the source of truth for how SKCS detects degraded runtime behavior, soft failures, and semantic drift.

## Authority

- Runtime state is decided by `backend/semantic-layer/controlPlaneEvaluator.js`.
- `verificationController` persists the evaluated state to `public.system_health_state`.
- UI surfaces must render backend state only and must not calculate health client-side.

## Control-plane states

- `PASS`
  - Meaning: drift is within the healthy band.
  - UI treatment: hidden banner, normal dashboard state.
- `WARN`
  - Meaning: drift is present but not yet severe enough to block publishing.
  - UI treatment: yellow banner and visible dashboard warning.
- `DEGRADED`
  - Meaning: the control plane should reduce trust and disable enrichment-heavy paths.
  - UI treatment: orange banner, fallback-heavy runtime behavior.
- `FAIL`
  - Meaning: the control plane should quarantine or block unsafe publication paths.
  - UI treatment: red banner, blocked downstream actions.

## Threshold source of truth

- The only threshold logic lives in `controlPlaneEvaluator.js`.
- Default threshold bands are derived there from violation counts, critical counts, blocked counts, and drift rate.
- No React component, route handler, or edge function should re-implement those thresholds.

## Observability signals

- `semantic_violations`
  - Records blocked, normalized, or quarantined semantic events.
  - Primary use: drift summary, heatmap, recent criticals, provider drift cards.
- `v_pipeline_health_feed`
  - Records telemetry facts only from pipeline execution, fallback usage, latency, and token consumption.
  - Primary use: operational dashboards and trend analysis.
- `system_health_state`
  - Records append-only health snapshots.
  - Primary use: runtime banner, dashboard state, historical audits.
- `X-System-State`
  - Response header emitted by `/api/health` and other health-aware responses.
  - Primary use: quick client-side visibility and proxy/debug tooling.
- `X-Control-State`
  - Response header emitted by the semantic drift summary route.
  - Primary use: admin dashboards and alert consumers.

## Runtime detections

- Banner should appear when system state is `WARN`, `DEGRADED`, `CRITICAL`, or `BLOCKED`.
- Dashboard should surface:
  - total violations
  - severity breakdown
  - drift velocity
  - rule failure heatmap
  - provider drift
  - recent criticals
- Alert routing should trigger from state transitions in `system_health_state`, not from the telemetry feed itself.
- Alerting consumers should react to the same backend snapshot, not a client-side recomputation.

## Soft-failure patterns to watch

- Enrichment returning partial data while the pipeline continues.
- Provider data changing field semantics without a matching registry update.
- Canonical identity missing while the pipeline still emits downstream artifacts.
- Rate-limit or quota pressure forcing fallback behavior.

## Review cadence

- Revisit this registry whenever the evaluator thresholds change.
- Revisit it whenever the semantic field mapping registry changes.
- Revisit it whenever `knowledge/pipeline_metrics_registry.md` changes.
- Revisit it whenever a new alert or banner consumes the health snapshot.
- Revisit it whenever `docs/pipeline-health-feed.md`, `docs/alert-routing-degraded-state.md`, or `docs/runbook_degraded_states.md` changes.
