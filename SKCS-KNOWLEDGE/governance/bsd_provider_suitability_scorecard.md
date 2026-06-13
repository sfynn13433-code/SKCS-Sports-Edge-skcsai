# BSD Provider Suitability Scorecard

**Date:** 2026-06-13
**Source:** BigBalls Sports Data correspondence (founder: Stefano)
**Context:** Active evaluation phase — provider characteristics now documented from direct engagement

---

## Provider suitability assessment

| Category | Assessment |
|----------|-----------|
| Founder Support | Excellent |
| Documentation Responsiveness | Excellent |
| Integration Support | Excellent |
| Schema Stability | Excellent |
| World Cup Coverage | Excellent |
| NBA Historical Coverage | Excellent |
| European Soccer Coverage | Good |
| Startup Friendliness | Good |
| Production Readiness | Promising |
| Cost Efficiency | Moderate–Good |

---

## API governance characteristics

### Pagination contract

- Default limit: `50` per page
- Maximum limit: `200` per page
- Exceeding maximum: **HTTP 400**
- Bulk strategy: Page iteration (`?page=1,2,3…`)
- Required params on `/v1/matches`: `?sport=` OR `?league=`

### Recommended consumption strategy

| Pattern | Recommendation |
|---------|---------------|
| High-frequency polling | **Avoid** |
| Large page requests (> 200) | **Avoid** — causes HTTP 400 |
| Scheduled fetches | **Prefer** |
| Composite endpoints | **Prefer** (consolidates preview + odds + probabilities + context) |
| Paginated retrieval | **Required** for bulk data |

---

## Coverage depth registry

### WC2026 — Tier 1 (EXCELLENT)

- 104 matches
- Live odds
- Elo win probabilities
- Advancement probabilities
- Monte Carlo simulations (calibrated from 301 historical World Cup matches)
- 26-player squads
- Golden Boot tracking
- **Schema stability:** LOCKED (June 11 – July 19, 2026)

### NBA — Tier 1 (EXCELLENT)

- Play-by-play data: 1946–present
- Box scores
- Shot coordinates
- Player props
- Historical hit rates
- Season averages
- **Backtesting value:** VERY HIGH

### Major European Soccer — Tier 2 (GOOD)

EPL, La Liga, Bundesliga, Ligue 1, Serie A

- Player appearances, goals, assists, minutes played, player ratings
- 2025–26 season ingest complete
- Historical range: 2023–24, 2024–25, 2025–26
- **Backtesting:** MODERATE

---

## Historical data registry

| Sport | Depth | Backtesting classification |
|-------|-------|---------------------------|
| NBA | 1946–present | **Elite** |
| Soccer | 2023–24 onward | **Limited but expanding** |

---

## Schema stability — WC2026

| Property | Value |
|----------|-------|
| Tournament | WC2026 |
| Schema stability | **LOCKED** |
| Lock window | June 11 – July 19, 2026 |
| Mid-tournament changes | **None** — explicitly confirmed by BSD |
| Versioning | Protects endpoint contracts |
| Semantic risk | LOW |
| Drift risk | LOW |

---

## Provider relationship

| Property | Value |
|----------|-------|
| Founder contact | Stefano |
| Escalation path | Direct |
| Commercial flexibility | Willing to discuss higher-volume architectures, bulk access, alternative solutions |
| Strategic value | **HIGH** |

---

## Future integration opportunities

BSD indicated willingness to discuss:
- Higher-volume architectures
- Bulk access patterns
- Alternative solutions if pagination becomes limiting

This suggests potential for flexible commercial discussions as SKCS scales.

---

## SKCS strategic classification

| Attribute | Classification |
|-----------|---------------|
| Provider status | **ACTIVE EVALUATION** |
| Current SKCS role | Evaluation + enrichment (not canonical primary) |
| WC2026 readiness | **HIGH** — schema locked, data rich |
| NBA readiness | **HIGH** — elite historical depth |
| European soccer readiness | **MODERATE** — expanding |
| Multi-sport potential | **HIGH** — 9+ sports documented |
| Promotion prerequisites | Coverage gates + legal sign-off (unchanged) |

---

## Recommended SKCS actions

### Immediate (done)

- ✅ Fix all BSD calls to respect `limit ≤ 200`
- ✅ Implement page-based retrieval
- ✅ Audit existing BSD jobs for oversized requests
- ✅ Update `provider_registry.md`

### Near-term

- ✅ Prefer composite preview endpoints
- ✅ Add BSD quota behaviour to `cost_registry.md`
- ✅ Record WC2026 schema stability guarantees in endpoint catalog

### Strategic

- ☐ Continue evaluating BSD as secondary/validation provider
- ☐ Consider BSD as high-trust provider for World Cup and NBA workloads
- ☐ Maintain direct relationship with Stefano for future scaling discussions

---

## Related artifacts

- `../knowledge/provider_registry.md` — BBD entry with pagination + coverage tiers
- `../providers/bigballs_endpoint_catalog.md` — Pagination contract, composite endpoints, coverage depth
- `../knowledge/cost_registry.md` — BBD budget optimization rules
- `../audit/cron_provider_runtime_map.md` — BSD `match_preview_sync` job entry
- `bigballs_evaluation_focus.md` — Active evaluation directive
