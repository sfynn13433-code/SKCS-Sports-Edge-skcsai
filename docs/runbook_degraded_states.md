# SKCS Production Runbook

## Incident Response and State Recovery Guide

This runbook covers Blocker #10.

Use it when the control plane emits `WARN`, `DEGRADED`, or `FAIL`.

## 1. How to read the state

- `PASS`: normal operation
- `WARN`: drift detected, investigate soon
- `DEGRADED`: fallback mode active
- `FAIL`: block and recover

## 2. First things to check

1. Semantic drift dashboard
2. Latest `system_health_state` snapshot
3. `semantic_violations`
4. Pipeline telemetry and fallback counts

## 3. Response by state

### WARN

- Review the rule failure heatmap.
- Check whether a new provider field needs registry updates.
- Monitor for escalation.

### DEGRADED

- Confirm that deep enrichment is being suppressed.
- Check if a provider outage or semantic drift spike caused the fallback.
- Let the controller recover naturally after the issue clears, or create a new healthy snapshot through the supported reset path.

### FAIL

- Stop automated publishing.
- Investigate canonical identity or quota failures first.
- Quarantine bad batches if needed.
- Restore the upstream cause.
- Release the system only after the control plane returns to a healthy snapshot.

## 4. Recovery rule

Do **not** mutate historical health rows in place.
Recovery should happen through a new healthy control-plane snapshot or a controlled reset routine that preserves audit history.

## 5. Rollback notes

If a deployment introduces forbidden context or schema drift:

- revert the faulty deployment
- re-run the affected ingestion or grading job
- verify the drift summary has settled
- confirm the control plane state has returned to `PASS`

## 6. Escalation reminders

- `WARN`: assign to the owning engineer or data provider contact
- `DEGRADED`: notify the operator and inspect fallback behavior
- `FAIL`: escalate to on-call and block publication until resolved

