# Big Balls Data — PRIMARY Candidacy Assessment

**Date:** 2026-06-06  
**User intent:** Promote Big Balls Data to **PRIMARY** football provider while API-Sports remains on hold.  
**Status:** **PRIMARY CANDIDATE — gated pilot** (`BIG_BALLS_PRIMARY_FOOTBALL=true`)

---

## Executive verdict

Big Balls Data **can begin serving as PRIMARY for a subset of tier-1 football** today, but **cannot yet replace API-Sports for the full SKCS platform** without resolving coverage, quota, legal, and data-shape gaps.

| Dimension | Ready for PRIMARY? | Notes |
|-----------|-------------------|-------|
| Authentication | ✓ | Key works on `api.bigballsdata.com` |
| Tier-1 top 5 + UCL + MLS | **Partial pilot** | 7 leagues mapped in `bigBallsLeagueMap.js` |
| Full `TARGET_LEAGUES` (66) | ✗ | BBD lists **6** football competitions |
| Multi-sport SKCS (13+) | **Partial** | BBD has 9 sports — basketball/NFL/NHL possible later |
| Free tier quota | ✗ | 1,000 req/day — sync exhausts in one sweep |
| Terms / commercial license | ✗ | `/terms` not published |
| Live fixture list (team names) | ✗ | `/v1/matches` returns scores-only; use stored lane |
| Website + predictions wired | **Pilot only** | `buildLiveData` bridge added behind flag |

**Recommendation:** Run **PRIMARY pilot** on tier-1 mapped leagues only. Keep API-Sports code as fallback. Upgrade BBD plan before full production sync.

---

## What PRIMARY means in SKCS

```text
syncService → buildLiveData
    → [NEW] Big Balls PRIMARY (football, mapped leagues)
    → TheSportsDB fallback
    → API-Sports fallback (on hold)
    → prediction pipeline (unchanged rules)
```

### Environment (Render + `.env`)

```env
BIG_BALLS_DATA_API_KEY=bbs_live_…
BIG_BALLS_BASE_URL=https://api.bigballsdata.com
ENABLE_BIG_BALLS_DATA_PROVIDER=true
BIG_BALLS_PRIMARY_FOOTBALL=true
```

### Mapped PRIMARY football leagues (pilot)

| SKCS league ID | Competition | BBD alias |
|----------------|-------------|-----------|
| 4328 / 39 | Premier League | `epl` |
| 4335 / 140 | La Liga | `laliga` |
| 4331 / 78 | Bundesliga | `bundesliga` |
| 4332 / 135 | Serie A | `serie-a` |
| 4334 / 61 | Ligue 1 | `ligue-1` |
| 3 | UEFA Champions League | `cl` |
| 253 | MLS | `mls` |

**Not covered by BBD today:** J1, J2, CSL, Brasileirão, Championship, all 38 missing BSD/SKCS lower-tier targets.

---

## Promotion gates

| Gate | Threshold | Current |
|------|-----------|---------|
| G1 — Auth + adapter | 6/6 provider functions | ✓ Pass |
| G2 — Tier-1 league map | ≥7 leagues | ✓ Pass (7 mapped) |
| G3 — Fixtures with team names | Required for predictions | **Partial** (stored lane) |
| G4 — Daily quota headroom | ≥500 req/day for sync | ✗ Fail on free tier |
| G5 — Legal / Terms | Written redistribution OK | ✗ Fail |
| G6 — `TARGET_LEAGUES` coverage | ≥80% | ✗ ~11% (7/66) |
| G7 — Crosswalk match-rate | ≥90% vs API-Sports | Not measured (API-Sports on hold) |

**PRIMARY pilot approved:** G1 + G2 + partial G3 with flag.  
**Full PRIMARY promotion:** blocked on G4, G5, G6.

---

## Code wired (pilot)

| File | Role |
|------|------|
| `backend/config/bigBallsLeagueMap.js` | SKCS ↔ BBD league crosswalk |
| `backend/services/bigBallsFootballBridge.js` | PRIMARY ingest → prediction input shape |
| `backend/services/dataProvider.js` | `buildLiveData` tries BBD first when flagged |
| `backend/providers/football/bigBallsDataProvider.js` | Evaluation adapter |

Provider tag on ingested rows: `provider: 'big_balls_data'`, `match_id: bbd-{id}`.

---

## Risks if promoted too fast

1. **Sparse stored fixtures** — EPL may return few rows; site looks empty for unmapped leagues.
2. **Quota exhaustion** — Free tier blocks mid-sync; predictions stall.
3. **Score-only live rows** — Without team names, pipeline skips fixtures.
4. **No Terms** — Commercial subscription product risk.
5. **Host timeout** — `api.bigballsports.com` unreliable; must use `api.bigballsdata.com`.

---

## Phased PRIMARY roadmap

### Phase A — Pilot (now)

- [x] Evaluation adapter
- [x] `BIG_BALLS_PRIMARY_FOOTBALL` bridge in `buildLiveData`
- [ ] Set Render env + `BIG_BALLS_BASE_URL=https://api.bigballsdata.com`
- [ ] Run `sync:live` for one mapped league (e.g. EPL `4328`)
- [ ] Verify fixtures land in DB / public site

### Phase B — Expand coverage

- [ ] Live league inventory vs `TARGET_LEAGUES`
- [ ] Add BBD aliases as vendor adds leagues
- [ ] Upgrade to Starter/Growth plan for quota
- [ ] Obtain Terms + commercial license

### Phase C — Full PRIMARY (if gates pass)

- [ ] Disable API-Sports football calls (keep code)
- [ ] Extend bridge to basketball/NFL via BBD multi-sport
- [ ] Canonical ID crosswalk table in DB
- [ ] Governance sign-off

---

## Comparison: why BBD over Bzzoiro for PRIMARY intent

| Factor | Big Balls Data | Bzzoiro BSD |
|--------|----------------|-------------|
| Multi-sport | 9 sports | Football only |
| Documented API | [docs](https://bigballsdata.com/docs) + OpenAPI | Bzzoiro v2 docs |
| Rate limits | Transparent | None observed |
| PRIMARY wiring | **Pilot live** | Evaluation only |
| Football league count | 6 listed | 65 listed |
| Historical depth | Stored + live | 64k+ events |
| Cost at scale | Paid tiers | Free |

**User direction aligned:** BBD is the correct PRIMARY *candidate* for a multi-sport SKCS; Bzzoiro remains enrichment/verification reference.

---

## Immediate actions for you

1. **Render:** Set `BIG_BALLS_BASE_URL=https://api.bigballsdata.com` (fix timeout).
2. **Render:** Set `BIG_BALLS_PRIMARY_FOOTBALL=true`.
3. **Upgrade** BBD plan if daily sync needed (free 1,000/day is insufficient).
4. **Email** `developers@bigballsdata.com` for Terms + commercial use on skcs.co.za.
5. **Test:** `npm run sync:live` and confirm EPL fixtures from `big_balls_data` provider tag.
