# SKCS Cost Registry

This file turns the runtime map into a governance register.
It captures quotas, estimated call frequency, budget class, duplication risk, and cost impact.

## Legend

- **Budget Class**
  - `Critical` = required for prediction generation or publishing
  - `Important` = materially improves quality but is not mandatory
  - `Optional` = nice-to-have enrichment
- **Cost Impact**
  - `Low`, `Medium`, `High`, `Critical`
- **Optimization Candidate**
  - `Yes` = likely to save calls or runtime if redesigned
  - `No` = currently acceptable

## 1) External provider cost registry

### API-Sports Football

- **Plan / registry limit**
  - `dailyLimit = 100`
  - `perMinuteLimit = 10` (API-Sports free plan: 10 requests/minute)
- **Budget class**
  - `Critical`
- **Critical jobs**
  - `syncSports`
  - football `buildLiveData`
  - prediction refresh paths that depend on football fixture data
- **Estimated call pattern**
  - Variable by league count and retry behavior
  - In the worst case, a football sync can consume a meaningful share of the daily budget very quickly if multiple leagues are attempted
- **Duplicate call risk**
  - High
  - Same provider is reached by sync orchestration, fallback paths, and retry loops
- **Risk**
  - High
  - This is the most sensitive quota surface in the system
- **Optimization candidate**
  - Yes
- **Reason**
  - Preflight quota planning already exists because this provider can be exhausted before the sync finishes

### API-Sports Other Sports

- **Plan / registry limit**
  - `dailyLimit = 100`
  - `perMinuteLimit = 10`
- **Budget class**
  - `Important`
- **Estimated call pattern**
  - Variable by sport and league volume
- **Risk**
  - Medium to high
- **Optimization candidate**
  - Yes

### TheSportsDB

- **Plan / registry limit**
  - `dailyLimit = 500`
  - `perMinuteLimit = null`
- **Budget class**
  - `Critical` for discovery
  - `Important` for enrichment
- **Critical jobs**
  - Daily Discovery cron
  - fixture discovery helpers
  - match context enrichment
- **Estimated call pattern**
  - Discovery is daily
  - enrichment is periodic and match-driven
- **Duplicate call risk**
  - Medium
  - Discovery and enrichment may revisit the same fixture windows
- **Risk**
  - Medium
- **Optimization candidate**
  - Yes

### Odds API

- **Plan / registry limit**
  - Budget-based gating, not a fixed daily limit in the registry
- **Budget class**
  - `Important`
- **Critical jobs**
  - odds enrichment inside build and routing logic
- **Estimated call pattern**
  - Variable, often tied to fixture volume and market depth
- **Duplicate call risk**
  - Medium
- **Risk**
  - Medium
- **Optimization candidate**
  - Yes

### RapidAPI families

- **Examples**
  - football, highlights, cricket, odds, news, and other hosts
- **Budget class**
  - `Important` to `Optional` depending on feature
- **Estimated call pattern**
  - Variable and provider-specific
- **Duplicate call risk**
  - High when multiple fallback hosts provide overlapping data
- **Risk**
  - High
- **Optimization candidate**
  - Yes

### SportsAPI Pro / metrx_factory / divanscore

- **Budget class**
  - `Optional` to `Important`
- **Estimated call pattern**
  - Fallback driven
- **Duplicate call risk**
  - Medium to high
- **Risk**
  - Medium
- **Optimization candidate**
  - Yes

### Big Balls Sports Data (BBD)

- **Plan / registry limit**
  - `paginationLimit = 200` (max per page)
  - `defaultLimit = 50` (per page)
  - Exceeding 200 causes **HTTP 400**
- **Budget class**
  - `Important` (evaluation phase)
- **Critical jobs**
  - `match_preview_sync` (composite endpoint preferred)
  - `bigBallsFootballBridge` fixture ingest (7 tier-1 leagues)
  - Provider health verification scripts
- **Estimated call pattern**
  - Low to medium — scheduled fetches, not polling
  - Paginated bulk retrieval iterates pages at ≤200/page
- **Duplicate call risk**
  - Low
  - Single bridge entry point; no fallback retry loops
- **Risk**
  - Low to medium
- **Optimization rules**
  - Use composite endpoints whenever available (consolidates preview + odds + probabilities + context)
  - Use scheduled sync jobs aligned to fixture lifecycle
  - Paginate instead of oversized requests (never exceed 200/page)
  - Avoid high-frequency polling and large page requests
- **Cost impact**
  - Moderate–Good
- **Optimization candidate**
  - Yes

## 2) AI cost registry

### Scope note

- The AI tools used for building and reasoning (`Cursor`, `Gemini`, `NotebookLM`, and similar assistants) are **not** counted as SKCS AI Sports Edge runtime costs.
- For the current project budget view, only in-product providers and runtime workflows are included.
- In the current workspace, the stated external usage is: `Cursor` at `$20`, free-tier tools, and `Gemini` at `$26`, all treated as build-time support rather than product operating cost.

### Groq

- **Use case**
  - Primary prediction explanation and structured analysis provider
- **Trigger**
  - Prediction generation and explanation pipeline
- **Budget class**
  - `Important`
- **Estimated usage pattern**
  - One or more AI calls per generated insight or explanation bundle
- **Duplicate call risk**
  - Medium
  - Similar prompts may be retried in explanation workflows
- **Risk**
  - High if explanation volume rises
- **Optimization candidate**
  - Yes

### Dolphin

- **Use case**
  - Fallback model when primary AI fails
- **Trigger**
  - Error fallback or provider outage
- **Budget class**
  - `Optional` as fallback, but operationally useful
- **Estimated usage pattern**
  - Lower frequency than primary AI, but potentially bursty during failures
- **Duplicate call risk**
  - Medium
- **Risk**
  - Medium
- **Optimization candidate**
  - Yes

### NotebookLM / Gemini / Cursor / Antigravity

- **Use case**
  - Knowledge work and architecture reasoning
- **Trigger**
  - Human and agent analysis sessions
- **Budget class**
  - `Important`
- **Estimated usage pattern**
  - Session-based rather than per-match
- **Duplicate work risk**
  - High without the knowledge layer
- **Risk**
  - High as a knowledge-work cost driver
- **Optimization candidate**
  - Yes

## 3) Runtime cost registry

### Daily Discovery cron

- **Frequency**
  - `1/day`
- **Provider**
  - TheSportsDB
- **Estimated calls**
  - Low to medium, depending on date window and league breadth
- **Budget class**
  - `Critical`
- **Optimization candidate**
  - Yes

### Pulse Check cron

- **Frequency**
  - `48/day`
- **Provider**
  - TheSportsDB-derived enrichment and AI explanation sources
- **Estimated calls**
  - Medium to high, because it can enrich and generate AI insight for many upcoming matches
- **Budget class**
  - `Important`
- **Optimization candidate**
  - Yes

### Stale Prediction Cleanup cron

- **Frequency**
  - `48/day`
- **Provider**
  - None
- **Estimated calls**
  - Low
- **Budget class**
  - `Important`
- **Optimization candidate**
  - No

### Heartbeat pre-match freshness interval

- **Frequency**
  - Disabled by default in pre-match-only mode
- **Provider**
  - Pre-match metadata sources
- **Estimated calls**
  - Low when enabled
- **Budget class**
  - `Optional`
- **Optimization candidate**
  - Yes

### Heartbeat trends/news interval

- **Frequency**
  - `24/day`
- **Provider**
  - News and context sources
- **Estimated calls**
  - Medium
- **Budget class**
  - `Important`
- **Optimization candidate**
  - Maybe

### Sports sync orchestration

- **Frequency**
  - On demand and on schedule
- **Provider**
  - API-Sports, TheSportsDB, Odds API, fallback hosts
- **Estimated calls**
  - Critical and highly variable
- **Budget class**
  - `Critical`
- **Optimization candidate**
  - Yes

### Prediction score refresh

- **Frequency**
  - Triggered on insert/update and via batch refresh
- **Provider**
  - None
- **Estimated calls**
  - Database-only
- **Budget class**
  - `Critical`
- **Optimization candidate**
  - Yes

## 4) Duplicate call analysis

### API-Sports football fixtures

- **Potential duplication sources**
  - `syncSports`
  - fallback retries inside `buildLiveData`
  - manual refresh paths
  - route-triggered syncs
- **Consumers**
  - live fixture sync
  - prediction refresh
  - enrichment and explanation support
- **Recommendation**
  - cache aggressively
  - short-circuit quota-exhausted runs
  - avoid repeated retries for the same exhausted league

### TheSportsDB discovery/enrichment

- **Potential duplication sources**
  - daily discovery
  - pulse check
  - manual repair / force-discovery routes
- **Consumers**
  - raw fixtures
  - context enrichment
  - AI explanation
- **Recommendation**
  - align refresh windows with actual fixture lifecycle

### AI explanations

- **Potential duplication sources**
  - repeated explanation generation for unchanged fixtures
  - retry flows after transient failures
- **Consumers**
  - sports edge
  - premium explanations
  - publish and refresh flows
- **Recommendation**
  - memoize or reuse stable explanations where possible

## 5) Cost per pipeline

### Football prediction generation

- **Providers**
  - API-Sports
  - TheSportsDB
  - Odds API
  - AI provider chain
- **Jobs**
  - sports sync
  - discovery
  - enrichment
  - prediction publication
- **Estimated daily cost**
  - High and variable
- **Risk**
  - High
- **Optimization candidate**
  - Yes

### Pre-match explanation generation

- **Providers**
  - Groq
  - Dolphin fallback
- **Jobs**
  - AI insight generation
  - EdgeMind explanation
- **Estimated daily cost**
  - Medium to high depending on volume
- **Risk**
  - High
- **Optimization candidate**
  - Yes

### Pre-match freshness maintenance

- **Providers**
  - pre-match metadata sources
- **Jobs**
  - heartbeat pre-match freshness interval
- **Estimated daily cost**
  - Low by default; higher only if live-style polling is explicitly re-enabled
- **Risk**
  - Medium
- **Optimization candidate**
  - Yes

## 6) Cost governance conclusions

- API-Sports football remains the most important hard quota to govern.
- TheSportsDB is a meaningful discovery/enrichment cost but less dangerous than football API-Sports.
- AI explanation generation is a real cost center and should be treated as a separate budget class.
- Repeated job execution is the main hidden runtime cost, especially where it overlaps with provider retries or unchanged fixture data.
- The most valuable optimization levers are:
  - preflight quota checks
  - cache/reuse of stable outputs
  - reducing duplicate discovery/enrichment
  - disabling optional live-score work when the product is pre-match only

## 7) Measured runtime snapshot

This section records the current measurable cost shape of the system from the runtime map and code paths that exist today.

### Current scheduled frequency

- Daily Discovery cron: `1/day`
- Pulse Check cron: `48/day`
- Stale Prediction Cleanup cron: `48/day`
- Heartbeat pre-match freshness interval: `0/day` by default, `48/day` only if live-style polling is explicitly re-enabled
- Heartbeat trends/news interval: `24/day`
- Sports sync orchestration: on demand plus scheduled triggers

### Current high-cost surfaces

- API-Sports football sync and fallback paths
- TheSportsDB discovery and enrichment
- Groq primary AI generation
- Dolphin fallback bursts during provider failures
- Pre-match freshness maintenance when enabled

### Current duplicate-call hotspots

- `syncSports` and football fallback/retry loops
- Daily discovery and pulse check revisiting overlapping fixture windows
- Repeated AI explanation generation for unchanged fixtures
- Route-triggered syncs overlapping with scheduled syncs

### What is measured today

- Relative frequency of each major job
- Provider sensitivity and duplicate-call risk
- Optimization candidates by workflow

### What still needs pre-match telemetry

- Exact monthly dollar cost per provider
- Per-workflow token consumption
- Exact duplicate-call counts from production runs
- Storage and refresh cost per table or view

## 7) Next additions

- Monthly dollar estimates per provider
- Supabase storage and refresh cost per table/view
- Measured AI consumption per workflow
- Exact duplicate-call counts once runtime telemetry is available
