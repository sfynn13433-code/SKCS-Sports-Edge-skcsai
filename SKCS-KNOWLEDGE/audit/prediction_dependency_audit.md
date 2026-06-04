# Prediction Dependency Audit

Status: Active  
Priority: High

Purpose: Map all prediction-system dependencies before any further RLS rollout on prediction, enrichment, or settlement tables.

Related documents:
- `SKCS-KNOWLEDGE/audit/runtime_consumer_audit.md`
- `SKCS-KNOWLEDGE/audit/runtime_consumer_audit_v2.md`
- `SKCS-KNOWLEDGE/knowledge/database_schema.md`
- `SKCS-KNOWLEDGE/knowledge/business_rules.md`
- `SKCS-KNOWLEDGE/knowledge/system_topology.md`
- `SKCS-KNOWLEDGE/audit/gap_report.md`
- `SKCS-KNOWLEDGE/knowledge/dependency_registry.md` (planned)

## Scope

Affected tables:
- `direct1x2_prediction_final`
- `predictions_final`
- `prediction_final`
- `prediction_scores`
- `match_context_data`
- `match_results`

This audit focuses on the tables most likely to affect:
- prediction generation
- prediction display
- settlement
- analytics
- enrichment quality

## Summary

The reference-data RLS pass is already complete and low risk. The next RLS rollout target is materially riskier because these tables sit in active read/write chains. A mistaken policy here can cause empty prediction pages, stale outputs, failed settlement jobs, or silent quality degradation.

The correct operating question is now:

> Which specific consumers will be affected by enabling RLS on this table?

That question should be answered table-by-table before any policy is applied.

## 1) `direct1x2_prediction_final`

Purpose:
Primary finalized prediction store and the main user-facing feed.

Readers:
- Frontend prediction pages
- API routes that power the hub
- Dashboard widgets
- Reporting and analytics jobs

Writers:
- Prediction pipeline
- Settlement jobs
- Backfill scripts
- Compatibility migration paths

Upstream dependencies:
- `matches`
- `team_stats`
- `injuries`
- `news_mentions`
- `match_context_data`

Downstream consumers:
- Homepage and hub prediction cards
- Confidence filtering
- Deep prediction engine
- ACCA builder
- Settlement and grading jobs
- Analytics and reporting

Criticality:
CRITICAL

RLS risk:
HIGH

Recommended policy:
- Public `SELECT`
- `service_role` `INSERT`
- `service_role` `UPDATE`
- `service_role` `DELETE`

Failure modes:
- `SELECT` blocked: homepage and prediction pages appear empty or partial.
- `INSERT` blocked: the pipeline runs but new final rows never appear.
- `UPDATE` blocked: refresh jobs silently fail while stale rows remain visible.

Validation checklist:
- Homepage loads
- Predictions page loads
- API routes respond with rows
- Scheduled jobs complete
- Freshness updates after publish

## 2) `predictions_final`

Purpose:
Legacy or compatibility-facing final prediction surface.

Readers:
- Legacy API paths
- Compatibility routes
- Older scripts and migration-era tools

Writers:
- Older publish paths
- Backfill and reconciliation tooling

Upstream dependencies:
- Final prediction generation pipeline
- Publish flow compatibility code

Downstream consumers:
- Legacy dashboards
- Migration scripts
- Compatibility tooling

Criticality:
CRITICAL for legacy paths

RLS risk:
HIGH

Recommended policy:
- Public `SELECT`
- `service_role` writes only

Failure modes:
- Compatibility routes return empty data.
- Older scripts or dashboards regress without obvious runtime errors.

Validation checklist:
- Legacy consumers still resolve rows
- Compatibility scripts still read the expected shape

## 3) `prediction_final`

Purpose:
Legacy alias or compatibility view used by older tooling.

Readers:
- Older scripts
- Compatibility logic

Writers:
- Migration or backfill helpers

Upstream dependencies:
- Final prediction generation pipeline

Downstream consumers:
- Older SQL or script-based read paths

Criticality:
HIGH for compatibility

RLS risk:
HIGH

Recommended policy:
- Public `SELECT`
- `service_role` writes only

Failure modes:
- Older tooling breaks first.
- The break may look minor but can block operational scripts.

Validation checklist:
- Legacy scripts still succeed
- Compatibility queries return rows

## 4) `prediction_scores`

Purpose:
Deterministic scoring layer for confidence and supporting factors.

Readers:
- Final views
- Analytics
- Hub presentation
- Score refresh jobs

Writers:
- Score population jobs
- Auto-populate triggers
- Refresh helpers

Upstream dependencies:
- `direct1x2_prediction_final`
- fixture and context inputs
- scoring formulas in SQL

Downstream consumers:
- `v_predictions_final`
- `refresh_v_predictions_final()`
- dashboard score displays
- future SQL-first scoring workflows

Criticality:
HIGH

RLS risk:
HIGH

Recommended policy:
- Public `SELECT`
- `service_role` writes only

Failure modes:
- `SELECT` blocked: confidence and score outputs vanish from the hub.
- `INSERT` or `UPDATE` blocked: score refresh jobs stop writing while the rest of the pipeline appears healthy.

Validation checklist:
- Score rows present for current fixtures
- API response still includes confidence data
- Refresh jobs update existing rows

## 5) `match_context_data`

Purpose:
Enrichment payload store used by prediction generation and Edge Mind insights.

Readers:
- Enrichment pipeline
- Edge Mind explanation logic
- Prediction generation
- Diagnostics and support tools

Writers:
- Context enrichment jobs
- Provider fetch orchestration

Upstream dependencies:
- API fetches
- standings data
- head-to-head data
- last-five form data
- injuries
- weather
- news snapshots

Downstream consumers:
- Prediction quality logic
- Edge Mind insight generation
- Context-based explanation blocks

Criticality:
HIGH

RLS risk:
HIGH

Recommended policy:
- Public `SELECT`
- `service_role` writes only

Failure modes:
- `SELECT` blocked: prediction quality collapses into generic fallback output.
- `INSERT` blocked: enrichment jobs run but context never lands in storage.
- `UPDATE` blocked: refresh jobs silently stop refreshing stale context.

Visibility:
LOW

Detection:
Currently weak unless row freshness and null-rate are monitored.

Validation checklist:
- Enrichment rows still persist
- Edge Mind outputs still include context
- Fallback/default values do not dominate

## 6) `match_results`

Purpose:
Historical match outcome source for scoring, backfills, and rule checks.

Readers:
- Scoring helpers
- Backfill jobs
- Settlement logic
- Analytics

Writers:
- Result ingestion jobs
- Normalization and replay tooling

Upstream dependencies:
- Result ingestion
- Normalization pipeline

Downstream consumers:
- Prediction quality workflows
- Grading and settlement
- Historical analytics

Criticality:
HIGH

RLS risk:
MEDIUM to HIGH

Recommended policy:
- Public `SELECT`
- `service_role` writes only

Failure modes:
- `SELECT` blocked: grading and historical scoring lose history.
- `INSERT` blocked: backfills cannot recover missing rows.

Validation checklist:
- Backfill jobs still resolve past results
- Settlement queries still see completed matches

## Failure patterns to watch

Silent degradation is the main risk in this layer.

- Process succeeds but row quality collapses.
- Pipeline completes but the hub becomes generic.
- Context refresh jobs run but never persist.
- Settlement or analytics lag behind without a hard error.

These are more dangerous than outright crashes because they can hide behind normal job completion logs.

## Recommended rollout order

1. Audit consumers.
2. Design read policies.
3. Design write policies.
4. Enable RLS.
5. Run production validation.

Do not enable RLS on prediction or result tables until the consumer map for each table is explicit.

## Knowledge Layer note

This document is the canonical dependency audit for prediction-related RLS rollout.
The canvas version is the visual working copy; this markdown file is the version controlled source of truth.
