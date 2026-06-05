# Pipeline Metrics Registry

## Purpose

This registry defines the measured telemetry used to observe SKCS pipeline health during the runtime measurement window.

The registry is facts-only. It does not assign health state or thresholds. Health decisions remain the job of the control plane evaluator and verification controller.

## Measured Sources

- `public.ai_pipeline_telemetry`
- `public.blocked_ai_calls_log`
- `public.semantic_violations`
- `public.v_pipeline_health_feed`

## Core Metrics

| Metric | Source | Meaning |
| --- | --- | --- |
| `total_ai_calls` | `ai_pipeline_telemetry` | Total provider calls observed for a pipeline |
| `successful_calls` | `ai_pipeline_telemetry.success` | Calls that completed successfully |
| `fallback_calls` | `ai_pipeline_telemetry.metadata.fallback` | Calls that used a fallback provider path |
| `blocked_calls` | `ai_pipeline_telemetry.status` / `finish_reason` | Calls blocked by budget or execution constraints |
| `avg_latency_ms` | `ai_pipeline_telemetry.latency_ms` | Mean latency observed for the window |
| `p95_latency_ms` | `ai_pipeline_telemetry.latency_ms` | 95th percentile latency |
| `total_input_tokens` | `ai_pipeline_telemetry.input_tokens` | Observed input token volume |
| `total_output_tokens` | `ai_pipeline_telemetry.output_tokens` | Observed output token volume |
| `total_tokens_used` | `ai_pipeline_telemetry.total_tokens` | Total observed token volume |
| `total_cost_estimate` | `ai_pipeline_telemetry.cost_estimate` | Cost ledger input for later cost review |
| `blocked_call_count` | `blocked_ai_calls_log` | Calls that were prevented from executing |
| `semantic_violation_count` | `semantic_violations` | Semantic drift volume observed for the pipeline |
| `critical_violation_count` | `semantic_violations.severity` | Critical or blocked semantic drift events |
| `last_activity_at` | all sources | Most recent observed activity for the pipeline |

## Current Measurement Cadence

- Feed refresh cadence: every 30 minutes
- Feed window: last 24 hours
- Persistence target: `system_health_state.snapshot.pipelineMetrics`
- Controller entry point: `verificationController.recordPipelineMetrics()`

## Runtime Intent

1. Capture measured pipeline behavior.
2. Persist the feed alongside control-plane snapshots.
3. Keep the measurement window open long enough to identify stable call volume, fallback pressure, and latency trends.
4. Use the observed data to update the cost registry before any optimization decision.

## Operational Note

The feed is meant to be read by dashboards, cron jobs, and control-plane snapshots. It must not be used as a second source of truth for health-state thresholds.
