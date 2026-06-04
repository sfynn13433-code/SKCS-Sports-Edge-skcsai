# SKCS Provider Registry

This file tracks provider behavior, fallback order, and quota implications.

## Football and sports providers

- API-Sports
  - Primary football provider.
  - Must be quota-aware and can be blocked when the provider is suspended or exhausted.
- TheSportsDB
  - Discovery and fallback source.
- RapidAPI hosts
  - Multi-provider layer for odds, highlights, cricket, and related data.
- SportsData.io
  - Alternative sports provider where configured.

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
