# Soccer Data API / StatPal — NotebookLM synthesis (2026-06-06)

Cross-check of NotebookLM answers vs **live SKCS probes** and **soccerdataapi.com** pages fetched directly.

## Critical: two products, two pricing models

NotebookLM blended **StatPal** (rebrand) with legacy **Soccerdata API** and **football-data.org**.

| Source | Free tier | Paid tiers | Auth |
|--------|-----------|------------|------|
| **soccerdataapi.com** (what we probed) | **$0 — 75 req/day** to all endpoints | Basic $14, Plus $29, Pro $79 — **per-league** gates on [coverage](https://soccerdataapi.com/coverage/) | `auth_token` query param |
| **StatPal v2** (Notebook) | **14-day trial** (paid-tier limits) | Starter $29/mo (50k/day, 2 sports), Total $129/mo (300k/day, all sports) | `access_key` at `https://statpal.io/api/v2/` |
| **football-data.org** (Notebook) | 10 req/min registered | Standard+ plans | `X-Auth-Token` header |

**SKCS rule:** Treat these as **separate evaluation tracks** until support confirms whether `soccerdataapi.com` keys work on `statpal.io/api/v2/` and whether legacy Basic/Plus/Pro league gates still apply.

## Notebook answers we can use immediately

### Integration (Soccerdata — confirmed by our client + docs)

- `auth_token` query parameter required
- `Accept-Encoding: gzip` required or call fails
- Errors often HTTP **200** + `detail` (`Invalid token`, `throttled 60s`, `Error fetching match`)
- Cheapest bulk sync path: `/matches/?league_id=` (one call per league per day)
- `/match-preview/` and `/match-previews-upcoming/` exist — **block from SKCS prediction engine** (vendor AI) regardless of ToS ambiguity in Notebook

### football-data.org (parallel path — already in SKCS)

- World Cup competition code: **`WC`**, country **World**
- Active season window: matches drop if start >30 days future or end >30 days past
- Pre-match filter: `status=SCHEDULED`
- Auth: `X_AUTH_TOKEN` in `.env`

### StatPal marketing claims (unverified on our key)

- “FIFA World Cup 2026 — Full Coverage Available”
- Pre-match odds 80+ markets; refresh ~30 min
- 12+ sports under one vendor

## Notebook gaps vs our live probes

| Topic | Notebook | SKCS live probe |
|-------|----------|-----------------|
| `league_id` for summer leagues | Not in sources | **Mapped:** Brazil 215, CSL 181, J1 256, Russia 287, Allsvenskan 300, Eliteserien 273, MLS 168 |
| FIFA World Cup `league_id` | Not in sources | On coverage: **International → Fifa World Cup = Plus plan**; not found via usa/europe `/league/` |
| Date format | Suggests `YYYY-MM-DD` | `DD-MM-YYYY` (dashes) accepted; slashes `Invalid date.`; `YYYY-MM-DD` also invalid |
| Empty `matches[]` | Inactive season / trial | HTTP 200, blocks present, **matches array empty** for MLS, Brazil, J1, WC dates — auth OK |
| Ghana Premier League | Not covered | Not on soccerdataapi.com/coverage table |
| Per-league Basic/Plus/Pro | Notebook denied | **Confirmed** on coverage page (e.g. J1=Plus, CSL=Basic, WC=Plus) |

## Coverage table — SKCS summer + World Cup (from soccerdataapi.com/coverage)

| League | Plan tier (per coverage page) |
|--------|-------------------------------|
| International — Fifa World Cup | **Plus** |
| Brazil — Serie A | **Plus** |
| China — CSL | **Basic** |
| Japan — J1 League | **Plus** |
| Russia — Premier League | **Plus** |
| Sweden — Allsvenskan | **Plus** |
| Norway — Eliteserien | **Plus** |
| USA — MLS | **Basic** |

**Hypothesis for empty fixtures on free $0 tier:** Coverage page plan tags may gate schedule/odds even when marketing says “all leagues” on free — **ask support to confirm**.

## Minimum viable plan (SKCS math)

**If staying on soccerdataapi.com model:**

- 66 leagues × 1 `/matches/` call = **66 calls/day** minimum (before `/match/` enrichment)
- Free 75/day = evaluation only, no headroom
- **Plus $29** unlocks World Cup + most summer leagues per coverage table
- **Basic $14** covers MLS + CSL only among our summer list

**If migrating to StatPal Starter $29:**

- Notebook: 50k calls/day — plenty for 66-league daily sync
- Must validate: endpoint migration, `league_id` parity, WC 2026 data live

## Recommended next steps

1. **Email support** (draft below) — clarify free vs Plus gating and date format.
2. **Try football-data.org `WC`** for World Cup fixtures (SKCS already has `X_AUTH_TOKEN`) — no Soccerdata calls burned.
3. **Do not wire Soccerdata as PRIMARY** until one league returns non-empty `matches[]` with team names on our paid/trial tier.
4. **Optional:** StatPal 14-day trial as separate evaluation — new base URL + `access_key`.

## Support email (send from your account)

**To:** support@soccerdataapi.com, support@statpal.io  
**Subject:** Empty `/matches/` on free tier — league access vs Plus plan

Hello,

We are evaluating the API for a pre-match football product (66 leagues, daily sync).

**Account:** Using Soccerdata API (`api.soccerdataapi.com`) with valid `auth_token`.  
**Working:** `/standing/`, `/country/`, `/league/` — e.g. EPL standings return 20 teams.  
**Not working:** `/matches/?league_id=` returns HTTP 200 with league blocks but **empty `matches[]`** for:

- MLS (168), Brazil Serie A (215), J1 (256), Russia (287), Allsvenskan (300), Eliteserien (273)  
- `/matches/?date=06-06-2026` and `11-06-2026` — blocks returned, zero matches  

**Questions:**

1. Does the **free $0 plan (75/day)** include **Schedules** and **Odds** per the [coverage table](https://soccerdataapi.com/coverage/), or only for leagues tagged Basic on our plan?  
2. What is the exact **`date=` format** for `/matches/`?  
3. What **`league_id`** and plan tier are required for **FIFA World Cup 2026** fixtures?  
4. Should we migrate to **StatPal v2** (`statpal.io/api/v2/`, `access_key`) for 2026 World Cup coverage?

Thank you,  
SKCS Team
