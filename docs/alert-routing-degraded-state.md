# SKCS Alert Routing and Degraded-State Protocol

This document defines the operational response for Blocker #8.

Alerts must be driven by **state transitions** from the control plane, not by the telemetry feed itself. The control plane evaluator stays the only source of truth for runtime state.

## Routing policy

- `PASS -> WARN`: send a warning to the team channel
- `WARN -> DEGRADED`: send a higher-priority warning and suppress deep enrichment
- `DEGRADED -> FAIL`: send a critical alert to the on-call route
- `FAIL -> PASS`: send a recovery notice

## Alert payload requirements

Each alert should include:

- previous state
- new state
- transition reason
- active violations
- top affected pipeline
- timestamp
- dashboard link

## Degraded-state behavior

When the control plane enters `DEGRADED`:

- short-circuit deep enrichment
- use fallback models
- cap confidence
- suppress hallucination-prone UI text
- keep the pipeline alive in minimal mode

When the control plane enters `FAIL`:

- block publication
- halt risky downstream jobs
- notify on-call
- require recovery through a new healthy snapshot or controller reset path

## Hard rule

Do **not** add a second evaluator here.
Do **not** compute state in the alert dispatcher.
The dispatcher should only react to the state already persisted by `verificationController`.

## Suggested operator flow

1. Read the alert and identify the state transition.
2. Open the semantic drift dashboard.
3. Inspect the latest `system_health_state` snapshot.
4. Review `semantic_violations` and the pipeline telemetry feed.
5. Apply the degraded-state protocol or block publication if state is `FAIL`.

