# Provider Scorecard — Bzzoiro Sports Data (BSD)

**Evaluation date:** 2026-06-06  
**Field audit date:** 2026-06-11  
**Governance verdict:** **D + E — Verification / Enrichment Provider**  
**Production status:** Sandboxed adapter approved; **not** primary, secondary, or fallback

## Decision summary

| Role | Verdict | Rationale |
|------|---------|-----------|
| A. Primary Provider | **Rejected** | Opaque upstream provenance; no SLA; ID model incompatible with canonical store |
| B. Secondary Provider | **Rejected** | Same legal exposure; would compete with API-Sports truth |
| C. Fallback Provider | **Rejected** | Vendor survival risk; solo-operator dependency |
| D. Verification Provider | **Approved (sandboxed)** | Low-cost cross-check for odds, lineups, fixture coverage |
| **E. Enrichment Provider** | **Conditionally approved** | Odds comparison, Polymarket, lineups, metadata only |

---

## Weighted scorecard

| Category | Weight | BSD score (/10) | Weighted |
|----------|--------|-----------------|----------|
| Coverage | 25% | 9.0 | 2.25 |
| Accuracy | 25% | 7.5** | 1.88 |
| Latency | 15% | 8.5 | 1.28 |
| Reliability | 15% | 6.0 | 0.90 |
| Cost | 10% | 10.0 | 1.00 |
| Integration complexity | 10% | 7.5 | 0.75 |
| **Total (operational)** | 100% | — | **7.81** |

\*Accuracy unverified — requires parallel run vs API-Sports (Phase 4).  
\*\*Field-level schema audit complete for approved enrichment endpoints (2026-06-11). Runtime accuracy still requires Phase 4 parallel verification.

### Governance overlay (pass/fail gates)

| Dimension | Score (/10) | Gate |
|-----------|-------------|------|
| Governance | 2 | **FAIL** for primary |
| Legal clarity | 1–2 | **FAIL** for spatial/xG ingestion |
| Technical capability | 9 | Pass |
| Vendor risk | 1 | **FAIL** for hard dependency |

**Effective SKCS trust tier:** Medium for approved enrichment domains only.

---

## Comparison matrix

| Dimension | BSD | API-Sports | SportsDataIO (UCL) |
|-----------|-----|------------|-------------------|
| Role today | Candidate enrichment | Primary canonical | Pre-match context |
| Football leagues | ~65 | 500+ | 1 (free trial) |
| Rate limits | None advertised | Quota-capped | Interval-capped |
| Cost | Free | Paid | Free trial / paid |
| Canonical IDs | `event.id` (BSD-local) | `fixture.id` | `GameId` / `GlobalGameId` |
| xG / shot maps | Yes (unique) | Limited | No |
| Polymarket odds | Yes (unique) | No | No |
| AI lineups | Yes (unique) | Confirmed only | Limited |
| Provenance | RED (core data) | Documented vendor | Documented vendor |
| SLA | None | Commercial | Commercial |
| SKCS status | Sandboxed adapter | Production | P0 wired (UCL) |

---

## Governance layer scores (audit)

| Dimension | Score | Key deductions |
|-----------|-------|----------------|
| Governance | 2/10 | Solo operator; no SLA; Discord-only support |
| Legal | 1/10 | Opaque upstream; ODbL share-alike risk; scraped-data concern |
| Reliability | 6/10 | Good tech; bad vendor continuity |
| Technical | 9/10 | v2 typing, WebSocket, MCP; OpenAPI intermittently broken |
| Vendor risk | 1/10 | Key-person + unproven revenue model |

---

## Approved domains (conditional)

- Odds comparison (14 books)
- Polymarket implied probabilities
- Odds movement (derived by SKCS)
- Formation data
- Confirmed lineups
- Predicted lineups (availability state only)
- Match metadata (venue, kickoff, jerseys)
- Fixture coverage cross-check

## Restricted domains (verification layer only)

- AI lineup `confidence` / `ai_score`
- BSD model metadata
- Player ratings from BSD models

## Blocked domains (until provenance proven)

- Shot maps and spatial coordinates
- xG and xG per minute
- Momentum metrics
- Average positions / tactical shape from BSD stats endpoint
- BSD CatBoost prediction probabilities
- BSD recommendation engine outputs
- BSD score predictions

---

## Phase 4 verification metrics (when adapter exists)

Run API-Sports and BSD in parallel for 30 days on tier-1 leagues:

| Metric | Target |
|--------|--------|
| Fixture match rate (crosswalk) | ≥ 95% |
| Kickoff time delta | ≤ 5 minutes |
| Final score agreement | ≥ 99% |
| Lineup player overlap (confirmed) | ≥ 90% |
| Odds availability (pre-match) | BSD ≥ API-Sports where both exist |
| Missing matches (BSD only / API only) | Logged, not silent |

---

## Sign-off checklist

- [x] Phase 1 discovery audit complete
- [x] Field-level extraction audit complete (`bzzoiro_field_audit.md`)
- [x] Feature risk registry updated with per-field scores
- [x] Sandboxed adapter (`backend/providers/football/bzzoiroProvider.js`)
- [ ] Legal review of ODbL commercial use
- [ ] Live league ID crosswalk captured
- [ ] Parallel verification run (Phase 4)
- [ ] Production enrichment store writes

**Approver:** SKCS Governance Layer — **2026-06-11** (governance docs + gated adapter)
