# EPRV-001-P1 — External Provider Removal Implementation Planning Packet

**Mini-project:** EPRV-001-P1
**Start commit:** `b4df29f6cca04b55754cef0d4f10d1bb50ad9dfb`
**Mode:** Read-only planning — no runtime edits, no provider deletion, no SQL/migrations, no gate clearance
**EPRV-001 status:** `PARTIAL` (unchanged)
**Scout-Edge marriage gate:** `BLOCKED` (unchanged)
**Supabase storage gate:** `BLOCKED` (unchanged)

---

## 1. Runtime Call Graph

The following graph traces the exact production execution path from an HTTP trigger to each external provider call. All paths are reachable today. Evidence source: read-only inspection of `backend/services/aiPipeline.js`, `backend/services/dataProvider.js`, `backend/services/contextIngestionService.js`, `backend/services/footballHighlightsService.js`, `backend/services/syncService.js`, and `backend/routes/` at commit `b4df29f6`.

```
POST /api/pipeline/run-full  (vercel.json cron / external cron)
  └── backend/routes/pipeline.js
        ├── syncAllSports()  [syncService.js]
        │     └── buildLiveData(sport, leagueId, season)  [dataProvider.js:1668]
        │           ├── Source 0: fetchBigBallsFootballFixtures()  [bigBallsFootballBridge.js]  <- RapidAPI-backed
        │           ├── Source 1a: fetchUpcomingFixtures()  [dataProvider.js]  <- TheSportsDB REST API
        │           ├── Source 1b: SportSrcClient.getMatches()  [apiClients.js]  <- SportSRC REST API
        │           ├── Source 2: fetchOddsData(oddsKey)  [dataProvider.js]  <- OddsAPIClient  [apiClients.js]
        │           ├── Source 3: fetchSportsDataOrg()  [dataProvider.js]  <- SportsDataOrgClient [apiClients.js]
        │           ├── Source 4: fetchSportsDataIO()  [dataProvider.js]  <- SportsDataIOClient [apiClients.js]
        │           ├── Source 5: fetchRapidAPI()  [dataProvider.js:1533]  <- RapidAPIClient [apiClients.js]
        │           ├── Source 6: fetchCricketData()  [dataProvider.js]  <- CricketDataClient [apiClients.js]
        │           └── Source 7: getScoreboard()  [espnHiddenApiService.js]  <- ESPN Hidden API (no key)
        │
        └── runPipelineFromConfiguredDataMode()  [aiPipeline.js:2153]
              └── getPredictionInputs()  [dataProvider.js:2078]
                    └── buildLiveData()  (same waterfall as above)
                          └── for each fixture item:
                                └── buildRawPredictionFromProviderItem(item)  [aiPipeline.js]
                                      ├── getInjuries(fixtureId)  [contextIngestionService.js:188]
                                      │     └── SUSPENDED -- returns null immediately (no API call)
                                      ├── getH2H(team1, team2)  [contextIngestionService.js:193]
                                      │     └── SUSPENDED -- returns null immediately (no API call)
                                      ├── getWeather(city)  [contextIngestionService.js:198]
                                      │     └── OpenWeatherMap REST API  (gated: WEATHER_API_KEY required)
                                      ├── getTeamNewsContext(options)  [contextIngestionService.js:215]
                                      │     └── NewsAPI REST API  (gated: NEWSAPI_KEY + daily budget)
                                      └── applyFootballH2HEnrichment()  [aiPipeline.js:224]
                                            └── fetchHeadToHeadFallback(homeId, awayId)
                                                  [footballHighlightsService.js]
                                                  └── RapidAPI / API-Sports H2H endpoint
                                                        (gated: canUseFootballHighlights() budget check)

POST /api/pipeline/run-full (manual match injection path)
  └── runPipelineForMatches(matches)  [aiPipeline.js]
        └── buildRawPredictionFromProviderItem()  (same context calls as above)

GET /api/sportsedge/* (live scores path)
  └── backend/routes/sportsEdge.js
        └── getFeaturedGames() / getLiveScores()  [hybridSportsDataService.js]
              └── External sports data aggregator (separate surface -- read-only scores)

POST /api/scheduler/* (enrichment queue)
  └── backend/routes/scheduler.js
        └── contextEnrichmentService.processEnrichmentQueue()  [contextEnrichmentService.js]
              └── Separate enrichment path -- NOT currently connected to FIP boundary
```

### Also reachable from scripts/ (non-production, but on-disk call sites)

| Script | Call |
|---|---|
| `scripts/test-sportsrc-fixtures.js` | `dataProvider.buildLiveData()` |
| `scripts/fetch-live-fixtures.js` | `dataProvider.buildLiveData()` |
| `scripts/test-odds-integration.js` | `oddsApiPipeline.runOddsPipeline()` |
| `scripts/test-football-h2h-pipeline-integration.js` | `footballHighlightsService.fetchHeadToHeadFallback()` |
| `scripts/diagnostic-espn.js` | `dataProviders.fetchRapidApiProvider()` |

---

## 2. Provider-to-FIP Fact-Class Matrix

| Provider | Module | Fact Class Acquired | FIP Equivalent | Disposition |
|---|---|---|---|---|
| **Big Balls Data** | `bigBallsFootballBridge.js` | Fixtures: id, teams, kickoff, competition | `fixture.fixture_id`, `fixture.home_team`, `fixture.away_team`, `fixture.kickoff_time` | `BYPASS` once FIP is live; `KEEP` until then |
| **TheSportsDB** | `dataProvider.js` | Fixtures: id, teams, kickoff, sport, league | Same as above | `BYPASS` once FIP is live; `KEEP` until then |
| **SportSRC** | `apiClients.js` (SportSrcClient) | Fixtures: teams, date, competition | Same as above | `BYPASS` once FIP is live; `KEEP` until then |
| **OddsAPI** | `OddsAPIClient` / `oddsApiPipeline.js` | Markets: home/away/draw odds, spread, totals | `markets.sharp_odds` (from Scout via FIP) | `BYPASS` for fixture ingestion; `REFACTOR_LATER` for odds enrichment |
| **FootballData.org** | `SportsDataOrgClient` | Fixtures (football-only fallback) | Same fixture fields | `BYPASS` once FIP is live; `KEEP` as last-resort fallback |
| **SportsData.io** | `SportsDataIOClient` | Fixtures (non-football sports) | No current FIP equivalent for non-football | `KEEP` pending non-football FIP scope |
| **RapidAPI (fixture)** | `RapidAPIClient` + `dataProviders.js` | Fixtures (multi-sport fallback) | Same fixture fields | `BYPASS` once FIP is live; `KEEP` as last-resort fallback |
| **CricketData** | `CricketDataClient` | Cricket fixtures | No current FIP equivalent | `KEEP` pending cricket FIP scope |
| **ESPN Hidden API** | `espnHiddenApiService.js` | Fixtures: teams, date, status | Same fixture fields | `BYPASS` once FIP is live; `KEEP` as no-key fallback |
| **API-Sports (injuries)** | `contextIngestionService.js:188` | Team injuries by fixture | `context.contextual_intelligence.injuries` (from Scout via FIP) | **ALREADY SUSPENDED** -- returns `null` unconditionally |
| **API-Sports (H2H)** | `contextIngestionService.js:193` | Head-to-head match history | `context.contextual_intelligence.h2h` (from Scout via FIP) | **ALREADY SUSPENDED** -- returns `null` unconditionally |
| **OpenWeatherMap** | `contextIngestionService.js:198` | Weather at venue city | `context.contextual_intelligence.weather` (from Scout via FIP) | `BYPASS` once FIP delivers weather; gated by `WEATHER_API_KEY` |
| **NewsAPI** | `contextIngestionService.js:215` | Team news (injury/suspension articles) | `context.contextual_intelligence.news` (from Scout via FIP) | `BYPASS` once FIP delivers news; gated by daily budget |
| **RapidAPI H2H** | `footballHighlightsService.js` | Football head-to-head history | `context.contextual_intelligence.h2h` (from Scout via FIP) | `BYPASS` once FIP delivers H2H; gated by daily budget check |
| **hybridSportsDataService** | `sportsEdge.js` | Live scores (display surface, not pipeline) | No FIP equivalent needed (display-only) | `KEEP` -- separate display surface, not prediction input |
| **contextEnrichmentService** | `scheduler.js` | Enrichment queue (separate path) | Needs investigation before disposition | `KEEP` pending separate audit |

---

## 3. Context Replacement Decision Table

| Context Fact Class | Current Source | FIP Field | Replacement Readiness | Decision |
|---|---|---|---|---|
| **Weather** | OpenWeatherMap via `contextIngestionService.getWeather()` | `context.contextual_intelligence.weather` | Requires Scout to populate this field in FIP envelope | `BYPASS_WHEN_FIP_DELIVERS` |
| **Injuries** | API-Sports -- **ALREADY SUSPENDED** | `context.contextual_intelligence.injuries` | Scout must populate; Edge reads from FIP envelope | `BYPASS_WHEN_FIP_DELIVERS` -- currently already null |
| **H2H (direct)** | API-Sports -- **ALREADY SUSPENDED** | `context.contextual_intelligence.h2h` | Scout must populate; Edge reads from FIP envelope | `BYPASS_WHEN_FIP_DELIVERS` -- currently already null |
| **H2H (fallback)** | RapidAPI via `footballHighlightsService` | `context.contextual_intelligence.h2h` | Scout must populate; currently gated by budget check | `BYPASS_WHEN_FIP_DELIVERS` |
| **Form** | Derived from provider fixture history | `context.contextual_intelligence.form` | Scout must populate recent-form | `BYPASS_WHEN_FIP_DELIVERS` |
| **News** | NewsAPI via `contextIngestionService.getTeamNewsContext()` | `context.contextual_intelligence.news` | Scout must populate impact articles | `BYPASS_WHEN_FIP_DELIVERS` |
| **Fixtures** | buildLiveData() waterfall (8 sources) | `fixture.*` from FIP envelope | EFI-001 intake boundary already exists | `BYPASS_WHEN_FIP_DELIVERS` |
| **Results** | Not currently acquired per-fixture (graded post-match via DB) | N/A | No FIP replacement needed | `KEEP` -- grading is a separate post-match path |
| **Odds / Markets** | OddsAPI + oddsApiPipeline | `markets.sharp_odds` from FIP | Scout must deliver odds via FIP envelope | `BYPASS_WHEN_FIP_DELIVERS` |

**Critical gap:** FIP-001 defines the envelope schema but Scout has not yet been built. The `context.contextual_intelligence` object accepted by `fipIntakeService.receiveValidatedFip()` can receive weather/injuries/H2H/news/form/odds from Scout, but Scout does not yet push a live FIP packet. The EFI boundary (`fipIntakeService.js`) is already fail-closed against all forbidden origins (`BUILD_LIVE_DATA`, `API_SPORTS`, `BIG_BALLS`, etc.).

---

## 4. File-by-File Proposed Disposition

| File | Role | Proposed Disposition | Rationale |
|---|---|---|---|
| `backend/services/dataProvider.js` | Primary fixture waterfall (8 sources) -> `getPredictionInputs()` | `BYPASS` (per-source, sequentially) once FIP delivers fixtures | Gate each source behind a FIP-first check; waterfall becomes fallback only during transition |
| `backend/services/dataProviders.js` | RapidAPI rotation/cache wall helpers | `BYPASS` once RapidAPI fixture source is bypassed | Retained as shared utility if other RapidAPI calls remain |
| `backend/services/contextIngestionService.js` | `getInjuries()`, `getH2H()` (suspended), `getWeather()`, `getTeamNewsContext()` | `BYPASS` per function when FIP delivers equivalent field | `getInjuries()` and `getH2H()` already return null; `getWeather()` and `getTeamNewsContext()` can be bypassed by checking FIP envelope first |
| `backend/services/footballHighlightsService.js` | RapidAPI H2H fallback enrichment | `BYPASS` once FIP delivers H2H context; `KEEP` budget gate until then | `canUseFootballHighlights()` gate already prevents overuse |
| `backend/services/oddsApiPipeline.js` | Standalone odds pipeline (not in main prediction path) | `REFACTOR_LATER` | Used in `scripts/test-odds-integration.js`; not triggered by main pipeline cron |
| `backend/services/hybridSportsDataService.js` | Live scores display surface | `KEEP` | Display-only; not a prediction acquisition surface |
| `backend/services/contextEnrichmentService.js` | Enrichment queue processing | `KEEP` pending separate audit | Not yet connected to FIP boundary; needs independent investigation |
| `backend/services/fipIntakeService.js` | EFI-001 FIP intake boundary | `KEEP` -- authoritative intake gate | Already fail-closed; receives validated Scout FIP envelopes |
| `backend/services/aiPipeline.js` | Pipeline orchestration: `runPipelineFromConfiguredDataMode()`, `buildRawPredictionFromProviderItem()` | `REFACTOR_LATER` -- add FIP-first input path | `getPredictionInputs()` call at L2155 is the single injection point for FIP replacement |
| `backend/services/syncService.js` | Sync trigger calling `buildLiveData()` | `BYPASS` `buildLiveData()` call once FIP provides fixture input | `syncService` orchestrates the data ingestion cycle |
| `backend/providers/football/bigBallsDataProvider.js` (+ bridge) | BigBalls primary football fixture source | `BYPASS` once FIP delivers fixtures; `KEEP` as fallback | Currently gated by `isBigBallsPrimaryFootball()` flag |
| `backend/services/espnHiddenApiService.js` | ESPN fallback (no key, free) | `KEEP` as final no-cost fallback during FIP transition | Harmless; contributes only when all paid sources fail |
| `backend/apiClients.js` | All provider API client instances | `REFACTOR_LATER` -- remove unused clients after bypass confirmed | Do not delete until bypass is proven stable |
| `scripts/test-sportsrc-fixtures.js` | Dev test script for SportSRC | `KEEP` -- not deployed | Read-only test |
| `scripts/test-odds-integration.js` | Dev test for OddsAPI pipeline | `KEEP` -- not deployed | Read-only test |
| `scripts/test-football-h2h-pipeline-integration.js` | Dev test for H2H service | `KEEP` -- not deployed | Read-only test |

---

## 5. Fail-Closed Acceptance and Rejection Scenarios

### EFI-001 Intake Boundary (`fipIntakeService.js`)

The intake is already fail-closed. The following rejection codes are enforced:

| Scenario | Rejection Code | Behaviour |
|---|---|---|
| Payload is null or non-object | `INVALID_PAYLOAD` | Rejected immediately, `envelope: null` |
| `source` is `BUILD_LIVE_DATA`, `API_SPORTS`, `BIG_BALLS`, `ODDS_API`, etc. | `FORBIDDEN_ORIGIN` | Rejected; provider data cannot enter via FIP path |
| `fip_schema_version !== '1.0.0'` | `UNSUPPORTED_SCHEMA_VERSION` | Rejected |
| `proof_mode !== 'PROOF_FIXTURE'` | `UNSUPPORTED_PROOF_MODE` | Rejected |
| `validation.status !== 'VALIDATED'` | `VALIDATION_STATUS_NOT_VALIDATED` | Rejected |
| `validation.algorithm !== 'scout-fip-sha256-v1'` | `UNSUPPORTED_HASH_ALGORITHM` | Rejected |
| Any required field missing (`fip_id`, `fixture.fixture_id`, `markets`, `context`, etc.) | `REQUIRED_FIELD_MISSING` | Rejected |
| `validation.hash` does not match computed canonical hash | `HASH_MISMATCH` | Rejected |
| `governedMode === AUTHORIZED_PRODUCTION` and `scoutEdgeMarriageGate !== 'CLEARED'` | `PRODUCTION_GATE_BLOCKED` | Rejected -- gate is currently `BLOCKED` |

### Context Fail-Closed Scenarios (post-bypass)

| Scenario | Required Behaviour |
|---|---|
| FIP arrives but `context.contextual_intelligence` is empty / null | Pipeline must proceed without context enrichment -- no crash, no retry against provider |
| FIP `context.contextual_intelligence.weather` is missing | `getWeather()` bypass must not fall back to provider; return null or empty |
| FIP `context.contextual_intelligence.h2h` is missing | `applyFootballH2HEnrichment()` must produce `h2h_enrichment_status: skipped` -- existing gate logic already handles this |
| FIP `context.contextual_intelligence.injuries` is missing | `getInjuries()` already returns null; no change required |
| FIP fixture data is missing or incomplete | `buildRawPredictionFromProviderItem()` must reject via existing `validateRawPredictionInput()` -- no provider fallback allowed post-bypass |
| FIP `validation.hash` is stale (replay attack) | `HASH_MISMATCH` rejection -- already enforced |
| FIP arrives with `fixture.sport` not in `ACTIVE_DEPLOYMENT_SPORTS` | `isDeploymentSportEnabled()` check already skips ineligible sports |

---

## 6. EPI Regression Test Requirements

The following test suites must be verified clean before and after each implementation batch. No batch is complete until all pass.

| Test Suite | File | Guards |
|---|---|---|
| **FIP Intake boundary** | `tests/fip-intake-service.test.js` | All rejection scenarios; `FORBIDDEN_ORIGIN` for `buildLiveData` source |
| **EPI Pipeline Integrity** | `tests/epi-pipeline-integrity-contract.test.js` | `getPredictionInputs()` named as acquisition surface; scoring/filtering/ACCA invariants |
| **FIP Storage Policy** | `tests/fip-storage-policy-service.test.js` | No Supabase permanent retention; FIP body not persisted |
| **EPRV Contract** | `tests/eprv-provider-removal-contract.test.js` | All 7 inspected provider files named; no runtime edits; provider removal remains PARTIAL |
| **Control Center Ledger** | `tests/edge-control-center-ledger.test.js` | Full CC check passes; gates remain BLOCKED |
| **EAC Classification** | (run via `npm run control:classification`) | No unclassified assets after any batch |

**New regression tests required per batch** (to be defined in individual batch tickets):

- Fixture ingestion with FIP input: predictions produced, no provider call made
- Context bypass: pipeline produces output when all context fields are null
- Provider bypass confirmation: `buildLiveData()` not called when FIP input is present
- Storage drift protection: no full FIP body inserted into Supabase after each batch

---

## 7. Storage Restrictions (EST)

These restrictions apply for the duration of all implementation batches:

1. FIP envelopes must not be persisted in full to Supabase. The Supabase storage gate is `BLOCKED`. Only the derived prediction output (confidence, market, risk tier) may be stored.
2. No raw provider payloads (`raw_provider_data`) may be written to any Supabase table as a result of FIP intake.
3. Context fields (weather, injuries, H2H, news) acquired from FIP must flow into the prediction computation only -- not persisted as Supabase rows.
4. Scout FIP raw bodies must not become a permanent mirror. FIP transport and Supabase retention are separate decisions requiring separate gate clearance.
5. The `supabase_storage_gate` field returned in every FIP intake evidence object must remain `BLOCKED` until explicit gate clearance is approved.

---

## 8. Implementation Batches

Each batch is a separate mini-project. No batch may begin without explicit approval.

### Batch P1-B01 -- FIP-First Fixture Injection Point

**Scope:** Add a FIP-input path to `runPipelineFromConfiguredDataMode()` in `aiPipeline.js` that accepts a pre-validated FIP envelope array instead of calling `getPredictionInputs()`. Provider waterfall is not deleted -- it becomes the fallback when no FIP input is supplied.

**Files:**
- `backend/services/aiPipeline.js` -- add `runPipelineFromFip(fipEnvelopes)` function; leave `runPipelineFromConfiguredDataMode()` intact
- `backend/routes/pipeline.js` -- add optional FIP input path to `/run-full`

**DoD:** All 6 regression test suites pass. `getPredictionInputs()` is not called when FIP envelopes are supplied. Provider waterfall still works when no FIP is supplied.

### Batch P1-B02 -- Context Bypass (Weather, News)

**Scope:** In `buildRawPredictionFromProviderItem()`, check the incoming item's `contextual_intelligence` field first. If present, skip `getWeather()` and `getTeamNewsContext()` calls. If absent, preserve existing behaviour.

**Files:**
- `backend/services/aiPipeline.js` -- conditional bypass in context enrichment block
- `backend/services/contextIngestionService.js` -- no changes; existing null-returns preserved

**DoD:** All regression suites pass. `getWeather()` and `getTeamNewsContext()` are not called when context is supplied via envelope.

### Batch P1-B03 -- H2H Context Bypass

**Scope:** In `applyFootballH2HEnrichment()`, check FIP envelope for `contextual_intelligence.h2h`. If present and valid, skip `fetchHeadToHeadFallback()`. If absent, preserve existing budget-gated behaviour.

**Files:**
- `backend/services/aiPipeline.js` -- conditional bypass in `applyFootballH2HEnrichment()`
- `backend/services/footballHighlightsService.js` -- no changes; budget gate preserved

**DoD:** All regression suites pass. `fetchHeadToHeadFallback()` not called when H2H data is in envelope.

### Batch P1-B04 -- Sync Service FIP Bypass

**Scope:** In `syncService.js`, add an optional FIP-first path so that when a FIP batch is provided, `buildLiveData()` is not called for covered sports/leagues.

**Files:**
- `backend/services/syncService.js` -- conditional FIP-first path in `syncSports()`

**DoD:** All regression suites pass. `buildLiveData()` not called for sports/leagues covered by the FIP batch.

### Batch P1-B05 -- Provider Removal Audit and Final Disposition

**Scope:** After B01-B04 are proven stable in production, audit all provider call counts in logs. Promote each provider from `BYPASS` to `REMOVE_LATER` only after zero-call confirmation over 7 or more days.

**Files:** No code changes. Evidence collection only.

**DoD:** Production logs confirm zero calls to each bypassed provider over 7 days. Disposition table updated.

---

## 9. Hold Conditions and Rollback Criteria

### Hold Conditions

The following conditions must hold for each batch before implementation:

- EPRV-001 status remains `PARTIAL` -- no batch changes it to `COMPLETE`
- Scout-Edge marriage gate remains `BLOCKED` -- no batch clears it
- Supabase storage gate remains `BLOCKED` -- no batch clears it
- All 6 regression test suites pass at batch start
- No runtime provider deletion occurs in the batch
- No SQL migrations, schema changes, or Supabase table writes are introduced
- Each batch is a separate mini-project with its own explicit approval

### Rollback Criteria

Rollback is required immediately if any of the following occur after a batch is deployed:

- Any regression test suite fails in CI
- `runPipelineFromConfiguredDataMode()` returns 0 predictions when FIP envelopes are valid and non-empty
- `fipIntakeService.receiveValidatedFip()` begins accepting forbidden-origin payloads
- A full FIP body or raw provider payload is detected in a Supabase table
- The Scout-Edge marriage gate is cleared without explicit separate approval
- `getPredictionInputs()` is deleted before FIP input has been proven stable for 7 or more days

---

## 10. Confirmation of Gate States

| Gate | State | Authority to Clear |
|---|---|---|
| EPRV-001 status | `PARTIAL` | Requires all 8 proof areas complete and a separate governed implementation closure |
| Scout-Edge marriage gate | `BLOCKED` | Requires `EMG-001`, `ESEC-001`, `EPRV-001` complete + `E2E-001` proof |
| Supabase storage gate | `BLOCKED` | Requires separate FIP transport and Supabase retention decision |
| E2E-001 | `BLOCKED` | Cannot begin until marriage prerequisites are met |
| Next implementation batch (P1-B01) | `ON HOLD` | Requires explicit approval of this planning packet after governed commit |