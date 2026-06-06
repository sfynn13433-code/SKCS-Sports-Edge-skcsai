# SKCS BSD Readiness Assessment

**Date:** 2026-06-06  
**Context:** API-Sports **ON HOLD** (code preserved; no fresh canonical ingest)  
**Inputs:** `bsd_league_inventory.md`, `bsd_coverage_audit.md`, `bsd_semantic_mapping.md`, `bsd_provider_health.md`, live production wiring audit  
**Question:** What can SKCS realistically deliver **today** and **if BSD were the only football data source**?

---

## Executive summary

| Reality | Verdict |
|---------|---------|
| BSD data quality (tier-1 football) | **Strong** — 10/10 crosswalk leagues present, deep fixture/standings history |
| BSD coverage vs SKCS `TARGET_LEAGUES` | **42.4%** (28/66) — adequate for top-of-pyramid, inadequate for full sync footprint |
| BSD wired to production SKCS | **No** — evaluation adapter + sandboxed enrichment only |
| SKCS multi-sport platform | **0%** on BSD — football-only provider |

**Bottom line while API-Sports is on hold:**

- SKCS **cannot** maintain full public website, prediction, grading, or premium product freshness from BSD alone without a major ingest migration (explicitly not approved).
- SKCS **can** use BSD today for **sandboxed enrichment** (odds comparison, lineups, polymarket) and **offline evaluation** (coverage audits, crosswalk probes, adapter smoke tests) on tier-1 football.
- Returning API-Sports to active status remains the fastest path to restore full product operation. BSD is a **supplement**, not a drop-in replacement.

---

## Classification legend

| Category | Meaning |
|----------|---------|
| **FULLY SUPPORTED** | Feature can operate on BSD data alone within its intended scope — no API-Sports required for that scope. Production wire-up may still be pending. |
| **PARTIALLY SUPPORTED** | Feature can run on BSD but with reduced league coverage, sparse fields, football-only scope, or sandbox-only wiring. |
| **NOT SUPPORTED** | Feature requires API-Sports, another provider, or existing SKCS canonical data already ingested before the hold. |

---

## Feature readiness matrix

| Feature | Classification | BSD coverage | Production status today | Operational notes |
|---------|----------------|--------------|-------------------------|-------------------|
| **Fixtures** | **PARTIALLY SUPPORTED** | 28/66 SKCS targets; 1,868 upcoming events catalog-wide; tier-1 100% | `bsdProvider.fixtures()` exists; **not** wired to `syncService` / website | Fresh pre-match fixture ingest for full SKCS footprint **cannot** run on BSD. Tier-A leagues (EPL, La Liga, UCL, MLS, etc.) have viable fixture lists. Missing: L1/L2, Serie B/C, most Africa/CONMEBOL domestic, J2, A-League, UAE. |
| **Results** | **PARTIALLY SUPPORTED** | 62,526 finished events; scores on event rows | Grading reads canonical/API-Sports path — **stale** while hold active | Finished scores available for covered leagues (e.g. EPL 6,123 finished). No production path writes BSD results to `football_canonical_events` or grading tables. Historical backfill possible in evaluation lane only. |
| **Standings** | **PARTIALLY SUPPORTED** | Full tables for Tier-A leagues with `season_id`; xGF/xGA included | `bsdProvider.standings()` verified (EPL 20-team / 38-round table) | **Strongest BSD asset** after fixtures. Works for top-5, UCL, Championship, Portugal, Eredivisie, etc. Fails for SKCS targets with no BSD league (Denmark, Argentina, Egypt, …). 30 BSD leagues lack embedded `current_season`. |
| **Team Form** | **NOT SUPPORTED** | `form` string on standings; derivable from finished events | Production uses **TheSportsDB** (`enrich-team-form.js`) — not BSD | BSD could theoretically compute W/D/L form for covered leagues, but no adapter, no pipeline connection, and no multi-sport path. SKCS form enrichment does not read BSD today. |
| **Lineups** | **PARTIALLY SUPPORTED** | `GET /events/{id}/lineups/` governance-approved | Sandboxed: `bzzoiroProvider` → `rapidapi_cache` only | Endpoint healthy; pre-match often `lineup_status: unavailable`. AI/confidence fields verification-only. Useful as enrichment compare, not as sole lineup source for predictions. |
| **Odds** | **PARTIALLY SUPPORTED** | 17 bookmakers via odds comparison | Sandboxed enrichment cache only; primary odds path API-Sports/RapidAPI | Sparse on far-future fixtures (`bookmakers_count: 0` observed). Adequate for tier-1 verification/enrichment when markets exist. Not a full replacement for SKCS multi-source odds waterfall. |
| **Historical Analysis** | **PARTIALLY SUPPORTED** | 64k+ events; multi-season depth per league (e.g. PL 6,116 finished) | No BSD-driven backtest pipeline wired | Deep history for Tier-A football. `ordering` param unreliable for date-bound queries — use `date_from`/`date_to`. Football-only; no cricket/NBA/NFL/etc. Cannot cover 38 missing `TARGET_LEAGUES`. |
| **Verification Layer** | **PARTIALLY SUPPORTED** | Tier-1 crosswalk 10/10; odds/lineups/polymarket probes | `verify-bsd-crosswalk.js`, `verify-bsd-enrichment.js` active | Identity crosswalk verified; live match-rate % blocked until API-Sports quota returns. BSD is **designed** for this lane. Cannot verify leagues absent on BSD. |
| **Semantic Layer** | **PARTIALLY SUPPORTED** | `bsdNormalizer` + `bsdProvider` map to `GameId`, `MatchStatusNormalized`, `HomeTeam`, etc. | Evaluation lane only — **not** connected to `canonicalIngestFirewall` as primary | Normalization proven in smoke tests. Canonical ingest firewall still expects API-Sports identity. BSD IDs require crosswalk — never canonical without governance promotion. |
| **Prediction Pipelines** | **NOT SUPPORTED** | BSD `/prediction/` exists but **governance-blocked** | `syncService` → `buildLiveData` → API-Sports; AI pipeline consumes canonical predictions | No BSD input to `aiPipeline`, `direct1x2Builder`, `accaBuilder`, or grading. API-Sports hold = **no fresh prediction generation** for new fixtures. Deliberate restriction — not a data gap alone. |
| **Public Website Coverage** | **NOT SUPPORTED** | Would cover ~42% of football targets if migrated | Site reads DB/canonical from API-Sports pipeline | skcs.co.za does **not** read BSD. With API-Sports on hold, public fixture/prediction freshness **degrades** regardless of BSD availability. Multi-sport pages unaffected by BSD (0% non-football). |
| **Premium Products** (Core / Elite / VIP) | **NOT SUPPORTED** | Enrichment signals only in covered tier-1 | Accas, secondary markets, deep VIP, mega-acca depend on full pipeline + multi-sport | Core/elite/vip tiers assume fresh predictions, secondary insights, and breadth across configured sports. BSD cannot feed acca builder, master rulebook grading, or subscription-gated surfaces without full primary ingest. |

---

## Summary by category

### FULLY SUPPORTED (0 features at full SKCS product scope)

No SKCS **product-facing feature** can operate entirely on BSD across the configured platform today. Even the strongest BSD capabilities (standings, finished results) are **football-only**, **42%-league partial**, and **not wired** to public or prediction surfaces.

**Narrow sub-scope note:** Within **Tier-A BSD leagues only**, standings and finished-result **data** are production-grade. That is a data readiness finding, not an operational “feature green” for SKCS users.

### PARTIALLY SUPPORTED (8 features)

| Feature | What works | What does not |
|---------|------------|-----------------|
| Fixtures | Tier-1 + 28 mapped `TARGET_LEAGUES`; 64k catalog | 38 missing targets; no production ingest; football-only |
| Results | Scores + status on finished events in covered leagues | Grading/canonical write path; missing leagues |
| Standings | Full current-season tables, form string, xG columns (verification) | Leagues without `season_id`; unmapped SKCS targets |
| Lineups | Approved enrichment endpoint; adapter healthy | Sparse pre-match; cache-only; not prediction input |
| Odds | 17-book comparison; tier-1 when markets posted | Sparse far-future; not primary odds source |
| Historical Analysis | Deep per-league event history (football) | Date ordering quirks; 42% league coverage; no multi-sport |
| Verification Layer | Crosswalk, enrichment probes, health scripts | Match-rate vs API-Sports; leagues not on BSD |
| Semantic Layer | `bsdProvider` normalization complete | Not canonical primary; firewall not promoted for BSD |

### NOT SUPPORTED (4 features)

| Feature | Blocker |
|---------|---------|
| Team Form | Production path uses TheSportsDB; no BSD team-form pipeline |
| Prediction Pipelines | Governance + architecture: canonical ingest API-Sports; BSD predictions blocked |
| Public Website Coverage | Not wired; API-Sports hold stops fresh canonical feed |
| Premium Products | Depend on predictions, secondary markets, multi-sport — all API-Sports-coupled |

---

## Coverage-weighted readiness score

Using `bsd_league_inventory.md` tiers:

| SKCS scope | BSD representation | Readiness |
|------------|-------------------|-----------|
| Tier-1 crosswalk (10 leagues) | **100%** present | **High** for evaluation/enrichment |
| `TARGET_LEAGUES` (66 API-Sports IDs) | **42.4%** mapped | **Low–medium** for full football sync |
| European top 5 + UCL | **~100%** | **High** data; **zero** production wire |
| Lower tiers (L1, Serie B, 2. Bundesliga, …) | **~15%** | **Low** |
| Africa domestic (SA, Egypt, Ghana, Kenya, …) | **~0%** of SKCS targets | **None** |
| CONMEBOL domestic (ex-Brazil) | **~0%** | **None** |
| Asia-Pacific gaps (J2, A-League, UAE) | **~33%** (J1+CSL+K League only) | **Low** |
| Multi-sport (13+ sports) | **0%** | **None** |

**Weighted football product coverage if BSD were primary:** ~**42%** of configured league targets.  
**Weighted full-platform coverage:** ~**3–5%** (football-only ÷ all active sports).

---

## What SKCS can deliver while API-Sports is on hold

### Can deliver (today, no migration)

| Deliverable | Mechanism |
|-------------|-----------|
| BSD health / coverage audits | `npm run audit:bsd-discovery`, `audit:bsd-league-inventory`, `verify:bsd-provider` |
| Tier-1 enrichment cache refresh | `npm run sync:bsd-enrichment` → `rapidapi_cache` |
| Crosswalk identity checks | `npm run verify:bsd-crosswalk` (match-rate when API-Sports quota available) |
| Offline evaluation datasets | `bsdProvider` JSON exports for Tier-A leagues |
| Stale public site from **existing** DB rows | Last successful API-Sports ingest — not BSD-fed |

### Cannot deliver (without API-Sports or approved BSD primary migration)

| Gap | Reason |
|-----|--------|
| Fresh fixtures across full `TARGET_LEAGUES` | 38 leagues absent on BSD; no BSD canonical ingest |
| New predictions for upcoming matches | Prediction pipeline not connected to BSD |
| Grading / accuracy for new results | Results path API-Sports-canonical |
| Full public website football breadth | 42% league mapping + no wire |
| Premium accas / VIP / secondary market generation at scale | Pipeline + multi-league dependency |
| Any non-football sport | BSD football-only |

---

## Promotion prerequisites (before any BSD role expansion)

| Prerequisite | Current state |
|--------------|---------------|
| SKCS `TARGET_LEAGUES` coverage ≥ 80% | **42.4%** — fail |
| Production canonical ingest wire | **Not started** — fail |
| Governance primary promotion | **Rejected** — fail |
| API-Sports crosswalk match-rate baseline | **Pending quota** — incomplete |
| Multi-sport strategy | **Out of scope** for BSD — fail |
| Legal/provenance sign-off | **Open** — fail |

**Recommendation:** Keep BSD in **evaluation + enrichment**. Restore API-Sports when budget allows for full product operation. Use BSD in parallel for tier-1 odds/lineups verification only.

---

## Related artifacts

- `bsd_league_inventory.md` — Tier A/B/C league matrix
- `bsd_coverage_audit.md` — Entity counts and API-Sports gap analysis
- `bsd_semantic_mapping.md` — Field-level canonical mapping
- `bsd_provider_health.md` — Latency and reliability
- `../knowledge/provider_registry.md` — API-Sports ON HOLD / BSD ACTIVE EVALUATION

## Regeneration

```bash
npm run audit:bsd-league-inventory
npm run verify:bsd-provider
```

Update this assessment when: API-Sports hold lifts, BSD ingest is wired, or `TARGET_LEAGUES` changes.
