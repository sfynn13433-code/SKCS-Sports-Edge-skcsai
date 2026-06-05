# Semantic Violation Log

This document defines the operational meaning of the semantic violation ledger.

## Purpose

- Record every blocked, quarantined, or normalized semantic event.
- Preserve field-level evidence for drift analysis and postmortems.
- Convert semantic enforcement from a code path into an auditable system signal.

## What gets logged

- Missing canonical identity resolution.
- Unmapped or ambiguous status values.
- Forbidden context attempts such as weather or unsupported news injection.
- Any normalization event that changes provider semantics before grading.

## Minimum fields

- `pipeline`
- `violation_type`
- `severity`
- `rule_id`
- `field_path`
- `raw_value`
- `context`
- `game_id`
- `message`
- `resolved`

## Operating rule

- The ledger is append-only.
- Logging should never block the prediction pipeline.
- Logs should be treated as governance evidence, not debug noise.
