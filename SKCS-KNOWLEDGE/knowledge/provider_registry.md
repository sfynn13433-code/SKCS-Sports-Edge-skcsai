# SKCS Provider Registry

This file tracks provider behavior, fallback order, and quota implications.

## Provider classification types

| Type | Purpose |
|------|---------|
| `PRIMARY` | Canonical truth for fixtures, teams, results |
| `SECONDARY` | Gap-fill when primary unavailable (governed) |
| `FALLBACK` | Last-resort ingest (governed) |
| `VERIFICATION` | Cross-provider compare only — never canonical |
| `ENRICHMENT` | Odds, sentiment, lineups, metadata — feature store lane |

## Football and sports providers

- API-Sports
  - **Type:** PRIMARY
  - Primary football provider.
  - Must be quota-aware and can be blocked when the provider is suspended or exhausted.
- TheSportsDB
  - **Type:** SECONDARY / discovery
  - Discovery and fallback source.
- RapidAPI hosts
  - **Type:** SECONDARY / enrichment
  - Multi-provider layer for odds, highlights, cricket, and related data.
- SportsData.io
  - **Type:** ENRICHMENT (pre-match context)
  - UCL schedule path wired in P0 (`competition_id=3` on free trial).
  - See `docs/sportsdataio-pre-match-directive.md`.
- Bzzoiro Sports Data (BSD)
  - **Type:** ENRICHMENT + VERIFICATION
  - **Status:** Field audit complete (2026-06-11). Sandboxed adapter gated by `ENABLE_BZZOIRO_PROVIDER=true`.
  - **Adapter:** `backend/providers/football/bzzoiroProvider.js`
  - **Approved endpoints:** odds/comparison, polymarket, lineups only
  - **Blocked:** stats (xG/spatial), predictions, WebSocket canonical writes
  - See `../providers/bzzoiro_field_audit.md`, `../governance/provider_scorecard_bsd.md`, `../governance/feature_risk_registry.md`

## AI providers

- Groq
  - Primary explanation / analysis provider.
- Dolphin
  - Fallback provider.

## Enrichment providers

- OpenWeather
  - Weather enrichment.
- News providers
  - Context, trends, and headlines.

## Registry fields to capture for each provider

- Purpose.
- Auth method.
- Quota rules.
- Fallback order.
- Cost impact.
- Main callsites.
- Failure behavior.

## Current risk notes

- Provider quotas must be captured in the registry, not just in runtime code.
- If a provider is suspended, the system should preserve that signal instead of converting it into a generic null result.
