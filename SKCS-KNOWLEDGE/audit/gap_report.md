# SKCS Knowledge Layer Gap Report

## Current runtime note

This gap report is historical context. The runtime now includes controlled SportsDataIO support and canonical publish-table wiring changes, so any remaining gaps should be read against the current ingest and publish paths.

Master Rulebook thresholds are now documented in `knowledge/business_rules.md` and `knowledge/formula_registry.md` as:
- Direct 1X2: `75 / 55 / 30`
- Secondary floor: `72%`
- Double Chance: separate market group
- Same Match Builder: `4 / 6 / 8`

## What is complete in this first pass

- A first-pass inventory of core database objects.
- A first-pass formula registry.
- A first-pass provider and API registry.
- A first-pass system topology map.

## High-priority gaps

- The schema inventory is not yet fully exhaustive.
- Some legacy compatibility layers still need consumer mapping.
- Several cron and interval jobs need exact runtime confirmation.
- The provider registry needs endpoint-level detail and environment-variable mapping.
- The formula registry still needs versioning and consumer mapping for every prediction formula.
- Runtime consumer mapping is still missing for many tables, views, and SQL functions.
- Cost estimates are still directional rather than measured.
- `runtime_consumer_audit.md` now exists, but it still needs column-level depth and more complete coverage of low-level scripts.
- `runtime_consumer_audit_v2.md` now exists, but the next slice still needs column-level coverage and job/provider runtime mapping.
- `column_dependency_matrix.md` now exists, but it still needs a second pass for exact column-by-column frontend and script coverage.
- `cron_provider_runtime_map.md` now exists, but it should be expanded with exact provider quota numbers, duplicate-call detection, and measurable refresh economics.
- `prediction_dependency_audit.md` now exists, but it still needs verification against the full codebase and a follow-up `dependency_registry.md`.
- `semantic_field_mapping_registry.md` now exists, but it still needs ongoing updates whenever source feed semantics or unsupported context assumptions change.
- `semantic_violation_log.md` now exists as the governance ledger for blocked, quarantined, and normalized semantic events.
- The Knowledge Layer completeness audit now confirms the remaining blind spots are concentrated in dependency, observability, cost, and centralized RLS documentation rather than broad architectural inventory.
- `verification_layer_spec.md` now exists as the control-spec foundation for Layer 5, but it still needs implementation against SQL checks, cron validators, and deployment gates.
- `verification_runtime_audit.md` now exists as the truth audit for Layer 5 enforcement reality; it needs continued verification as runtime changes are patched.

## Risk areas already visible

- `predictions_final` has history as both table-like and view-like logic across migrations.
- Some migrations reflect older schema assumptions and can fail against the current shape.
- API quota logic is split across router, provider registry, and runtime fallback code.
- The system still has multiple read surfaces for predictions, which can cause drift if not documented.

## Next inventory steps

1. Complete table-by-table relationships.
2. Map every view to source tables and consumers.
3. Map every SQL function to its inputs and outputs.
4. Map every scheduled job to its quota and failure impact.
5. Map every provider to auth, endpoint, quota, and fallback order.
6. Produce a runtime consumer audit for the highest-value tables and functions.
7. Expand the runtime consumer audit to cover low-level scripts and column-level dependencies.
8. Map cron jobs and provider routes to their exact runtime consumers.
9. Expand the column dependency matrix to additional tables and exact route fields.
10. Turn the cron/provider map into a measured cost registry with quotas and duplicate-call analysis.

## High-priority docs created since the last pass

- `prediction_dependency_audit.md` now exists as the canonical dependency map for prediction-related RLS rollout.
- `semantic_field_mapping_registry.md` now exists as the semantic control layer for identity, time, and context meaning.
- `semantic_violation_log.md` now exists as the audit trail for semantic enforcement events.
- `verification_layer_spec.md` now exists as the first executable governance contract for Layer 5.
- `verification_runtime_audit.md` now exists as the current truth audit for Layer 5 enforcement reality.

## Remaining high-priority work

- Verify every prediction consumer from the codebase against `prediction_dependency_audit.md`.
- Build `dependency_registry.md` from the dependency audit and the runtime consumer audits.
- Complete the prediction-table RLS rollout plan only after the dependency registry is stable.
- Create `observability_registry.md` for degraded-state and soft-failure detection.
- Refresh or formalize `cost_registry.md` so provider cost, quota, and optimization live in one place.
- Create or centralize `rls_registry.md` so the current policy state is easy to inspect later.
- Keep the semantic mapping registry aligned with any new SportsDataIO field or status semantics before those values are used in grading.
- Keep the semantic violation ledger aligned with the enforcement guard so every blocked or normalized event is preserved.
- Implement the Layer 5 checks described in `verification_layer_spec.md`.
- Patch only the missing hooks identified in `verification_runtime_audit.md`.

## Knowledge Layer completeness audit

- `knowledge_layer_completeness_audit.md` now exists as the high-level checkpoint for major architectural coverage.
- Current assessment: approximately 78-82% complete.
- The remaining work is high-value and narrow in scope; a full re-audit is not necessary.
