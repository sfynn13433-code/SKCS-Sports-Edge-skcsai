# ALI-001 — Accuracy and Loss Intelligence Proposal

## Status

PROPOSED — FUTURE MINI-PROJECT — DO NOT START

## Purpose

Create a governed post-event accuracy and loss-intelligence system that explains not only whether a prediction won or lost, but what Edge knew at publication time, what actually happened during the event, which developments materially changed the outcome, whether those developments were reasonably predictable, and whether Scout or Edge requires improvement.

## Core ownership law

Scout owns verified event truth, official outcomes, incident evidence, actual conditions, provenance, and canonical event identity. Edge owns prediction grading, confidence calibration, loss-driver analysis, product-level accuracy, and customer-facing transparency.

## Required capabilities

- Exact linkage to the original Scout FIP, Edge prediction, product, tier, publish run, sport, event, and fixture date.
- Official result, final score, finishing order, event status, cancellation, postponement, abandonment, void, disqualification, and corrected-result handling.
- Preservation of the evidence available when the prediction was published.
- Post-event evidence covering red cards, injuries, withdrawals, crashes, penalties, tactical changes, actual weather, surface conditions, and other decisive incidents.
- Trusted news and post-event reporting as explanatory evidence, never as the sole authority for an official result.
- Grading for Direct, Secondary, Multi, Same Match, ACCA, and Mega ACCA products.
- Primary and secondary loss-driver classification.
- Assessment of predictability, missing evidence, stale evidence, interpretation failure, calibration failure, data-integrity failure, and normal sporting variance.
- Tuesday publication cycle for weekend accuracy and loss-intelligence updates.
- Idempotent grading and governed correction when an official result changes.

## Initial loss classifications

- Unanticipated in-event incident
- Late information change
- Weather or surface-condition change
- Missing pre-event evidence
- Stale evidence
- Incorrect Edge interpretation
- Model calibration failure
- Missed market warning
- Data-integrity or event-linkage failure
- Normal sporting variance
- Disputed or incomplete result

## Hold conditions

ALI-001 must remain queued until the governed pre-event FIP intake, canonical post-event result intake, event/prediction identity linkage, correction law, duplicate-grading law, and source-authority rules are approved and proven.

## Definition of Done

For each graded prediction, the Accuracy Center can show the original prediction, publication-time evidence, verified outcome, important event timeline, loss reason, predictability assessment, Scout/Edge improvement responsibility, supporting provenance, and correct weekly rollups without inventing explanations or hiding losses.

## Scope protection

This proposal does not activate implementation, change prediction logic, alter grading tables, modify Supabase, or disturb the current active mini-project.
