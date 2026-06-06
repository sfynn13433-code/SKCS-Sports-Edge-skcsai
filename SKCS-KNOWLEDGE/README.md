# SKCS Knowledge Layer v1

This folder is the first-pass knowledge system for SKCS.

## Structure

- `knowledge/`
  - Stable system documentation.
- `audit/`
  - Drift, gaps, and risk tracking.
- `governance/`
  - Rules for AI usage, naming, and documentation discipline.
- `providers/`
  - Provider discovery audits and semantic field mappings (evaluation artifacts).
- Key files:
  - `knowledge/database_schema.md`
  - `knowledge/formula_registry.md`
  - `knowledge/semantic_field_mapping_registry.md`
  - `knowledge/semantic_violation_log.md`
  - `knowledge/pipeline_metrics_registry.md`
  - `knowledge/dependency_registry.md`
  - `knowledge/cost_registry.md`
  - `knowledge/system_topology.md`
  - `governance/verification_layer_spec.md`
  - `governance/bsd_governance_hold.md` (lifted 2026-06-11)
  - `governance/feature_risk_registry.md`
  - `governance/provider_scorecard_bsd.md`
  - `providers/bzzoiro_discovery_audit.md`
  - `providers/bzzoiro_field_audit.md`
  - `providers/bzzoiro_provider_mapping.md`
  - `audit/verification_runtime_audit.md`
  - `audit/observability_registry.md`
  - `audit/column_dependency_matrix.md`
  - `audit/runtime_consumer_audit_v2.md`
  - `audit/cron_provider_runtime_map.md`

## Working rule

- The knowledge layer is updated before or alongside code changes whenever possible.
- Product rule thresholds live in `knowledge/business_rules.md` and must match runtime code, Supabase governance, and `SKCS_MASTER_RULEBOOK.md`.

## First-pass scope

- Supabase inventory.
- Business rules.
- Formula registry.
- API and provider registry.
- System topology.
- Scheduled jobs.
- Drift and gap reporting.
