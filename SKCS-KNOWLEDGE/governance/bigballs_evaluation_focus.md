# Governance — Big Balls Data Evaluation Focus

**Effective:** 2026-06-06  
**Directive:** SKCS shifts **active provider evaluation** to Big Balls Data (`api.bigballsdata.com`).

## Provider status matrix

| Provider | Status | SKCS action |
|----------|--------|-------------|
| API-Sports | **ON HOLD** | Preserve code; no removal; no new development |
| Bzzoiro BSD (`sports.bzzoiro.com`) | **PAUSED EVALUATION** | Keep adapter + knowledge; no new Bzzoiro work unless regression |
| **Big Balls Data** | **ACTIVE EVALUATION** | Discovery, adapter, coverage audit, health validation |

## Restrictions (unchanged)

- No prediction pipeline changes
- No grading / verification logic changes
- No API-Sports removal
- No BBD `/v1/predictions` or intelligence probabilities in decision-making
- No canonical ingest promotion without legal + coverage gates

## Environment

```env
BIG_BALLS_DATA_API_KEY=bbs_live_…
ENABLE_BIG_BALLS_DATA_PROVIDER=true
```

## Success criteria (Big Balls phase)

- [ ] Authentication confirmed with live key
- [ ] `audit:bigballs-discovery` pass
- [ ] `verify:bigballs-provider` pass (≥4/6 functions)
- [ ] Football league inventory vs SKCS `TARGET_LEAGUES`
- [ ] Terms / commercial license obtained
- [ ] Readiness assessment updated with live data

## Bzzoiro preservation

All Bzzoiro artifacts remain valid reference material:

- `bsd_*` knowledge docs
- `bzzoiroProvider.js` / `bsdProvider.js`
- `BZZOIRO_API_TOKEN` env — do not delete
