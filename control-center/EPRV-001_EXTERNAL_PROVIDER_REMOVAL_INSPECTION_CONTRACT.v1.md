# EPRV-001 — External Sports Provider Removal Inspection Contract v1

## Contract status

| Field | Value |
|---|---|
| **Contract ID** | `EPRV-001_EXTERNAL_PROVIDER_REMOVAL_INSPECTION_CONTRACT.v1` |
| **Governed task** | `EPRV-001` — External Sports Provider Removal |
| **Contract mode** | Inspection contract only (EPRV-001-C1) |
| **EPRV task state after packet** | **PARTIAL** |
| **Scout ↔ Edge marriage gate** | **BLOCKED** (unchanged) |
| **Supabase storage gate** | **BLOCKED** (unchanged) |
| **Runtime provider removal** | **FORBIDDEN** in this packet |
| **Date sealed** | 2026-07-13 |
| **Prior contracts** | `FIP-001_SCOUT_FIP_AUTHORITY_CONTRACT.v1`, `EFI-001_FIP_INTAKE_HANDSHAKE_CONTRACT.v1`, `EST-001_SUPABASE_STORAGE_AND_FIP_RETENTION_CONTRACT.v1`, `EPI-001_PREDICTION_PIPELINE_INTEGRITY_CONTRACT.v1` |

---

## 1. Purpose

This contract records the current Edge external sports-provider acquisition surfaces before any further provider removal is attempted.

EPRV-001-C1 answers:

1. Which reachable or relevant Edge files still participate in sports-data acquisition?
2. Which runtime chain still allows live provider acquisition?
3. Which provider/domain/API-key surfaces were observed?
4. Which surfaces are documentation-only findings versus later implementation targets?
5. Which actions remain forbidden until a separate implementation packet is approved?

This contract does **not** remove providers, edit runtime code, replace live input with FIP input, run SQL, mutate Supabase, wire routes, execute E2E proof, or clear gates.

---

## 2. Current provider-removal ruling

EPRV-001 remains **PARTIAL**.

Provider-removal work cannot safely proceed by deleting mixed acquisition/analysis files because several files contain both:

- provider acquisition logic
- normalization/translation logic
- prediction input-shape compatibility logic
- context enrichment logic required by current scoring and ACCA behaviour

Runtime removal therefore requires a later implementation packet with replacement proof from the governed Scout/FIP input boundary.

---

## 3. Primary live acquisition chain

The current live prediction-input path remains:

```text
backend/services/aiPipeline.js
→ imports getPredictionInputs from backend/services/dataProvider.js
→ getPredictionInputs()
→ buildLiveData()
→ external sports-provider acquisition/fallback chain
```

Inspection evidence:

| Evidence | Finding |
|---|---|
| `aiPipeline.js` import | Imports `getPredictionInputs` from `./dataProvider` |
| `aiPipeline.js` context imports | Imports weather, injury, H2H, team-news, and football-highlight helper surfaces |
| `dataProvider.js` live mode | `getPredictionInputs()` calls `buildLiveData(options)` when `DATA_MODE` is live |
| `dataProvider.js` provider path | `buildLiveData()` walks multiple external provider/fallback origins |
| Current task state | EPRV remains PARTIAL; provider removal is not complete |

---

## 4. Provider/acquisition surfaces inspected

| Surface | Current responsibility | EPRV-C1 classification |
|---|---|---|
| `backend/server-express.js` | API routing and background process boot loop | Runtime-reachability surface; no edit authorized |
| `backend/services/dataProvider.js` | Core live acquisition mapping and multi-sport provider fallback orchestration | Future implementation target |
| `backend/services/dataProviders.js` | RapidAPI endpoint map and cache-duration configuration | Contract-only provider inventory surface |
| `backend/services/contextIngestionService.js` | Weather, news, injuries, suspensions, H2H/context parameter retrieval | Future provider/context replacement target |
| `backend/services/contextEnrichmentService.js` | PostgreSQL enrichment queue and context-enrichment controller | Future implementation target |
| `backend/services/footballHighlightsService.js` | Football matchup logs / H2H compiler | Future H2H replacement or bypass target |
| `backend/services/oddsApiPipeline.js` | Bookmaker/Odds API aggregation | Future implementation target |
| `backend/services/skcsHeartbeat.js` | Scheduled sync and provider-key health checks | Contract-only / later scheduler review |
| `backend/services/hybridSportsDataService.js` | ESPN and Pro Football fallback score sync | Future implementation target |
| `backend/utils/rapidApiWaterfall.js` | RapidAPI key rotation request handler | Contract-only provider utility surface |
| `backend/apiClients.js` | Consolidated provider base clients | Future implementation target |
| `backend/services/aiPipeline.js` | Prediction pipeline consuming `getPredictionInputs()` and context helpers | Protected by EPI; no edit authorized here |
| `scripts/import-today-snapshot-pipeline.js` | Bulk daily fixture and odds importer | Future legacy/snapshot implementation target |

---

## 5. Provider/domain/API-key markers

Observed provider or acquisition markers include:

| Marker class | Evidence |
|---|---|
| TheSportsDB | `THESPORTSDB_BASE_URL`, `THESPORTSDB_KEY`, `SPORTS_DB_KEY`, TheSportsDB fallback |
| API-Sports | `APISportsClient`, `X_APISPORTS_KEY`, API-Sports normalized fixtures |
| Odds API | `OddsAPIClient`, `ODDS_API_KEY`, Odds API fallback |
| RapidAPI | `RapidAPIClient`, `RAPIDAPI_KEY`, RapidAPI fallback/waterfall |
| SportsData.io | `SportsDataIOClient`, `SPORTSDATA_IO_KEY`, SportsData.io fallback |
| CricketData | `CricketDataClient`, CricketData fallback |
| Big Balls Data | `fetchBigBallsFootballFixtures`, Big Balls primary football path |
| SportSRC | `SportSrcClient`, SportSRC fixture normalization |
| ESPN Hidden API | `getScoreboard`, ESPN hidden fallback |
| FootballData.org | FootballData.org fallback path |
| Weather/context | Weather, injury, H2H, team-news, news/context acquisition helpers |

---

## 6. Known high-risk runtime lines

The following line-level evidence is recorded for future implementation packets:

| File | Evidence |
|---|---|
| `backend/services/aiPipeline.js` | Imports `getPredictionInputs` and direct context helpers |
| `backend/services/dataProvider.js` | Defines TheSportsDB base URL and provider delay/env controls |
| `backend/services/dataProvider.js` | `buildLiveData()` begins live provider acquisition orchestration |
| `backend/services/dataProvider.js` | `buildLiveData()` logs/checks `X_APISPORTS_KEY`, `THESPORTSDB_KEY`, `ODDS_API_KEY`, `RAPIDAPI_KEY`, `SPORTSDATA_IO_KEY` |
| `backend/services/dataProvider.js` | TheSportsDB requests call `eventsday.php`, `eventsnextleague.php`, and `eventsseason.php` |
| `backend/services/dataProvider.js` | Live acquisition fallbacks include Big Balls Data, TheSportsDB, SportSRC, Odds API, FootballData.org, SportsData.io, RapidAPI, CricketData, and ESPN Hidden API |
| `backend/services/dataProvider.js` | `getPredictionInputs()` calls `buildLiveData(options)` in live mode |

---

## 7. Core laws

| Law | Requirement |
|---|---|
| **Scout sports-truth law** | Scout remains the sole governed canonical sports-truth provider |
| **Edge analysis law** | Edge may analyze, score, filter, publish, and commercialize predictions but must not independently acquire canonical sports truth once the FIP replacement is active |
| **No blind deletion** | Mixed acquisition/analysis files must not be deleted merely because they mention providers |
| **FIP replacement proof first** | Runtime provider bypass/removal requires proof that governed FIP input supplies the required equivalent facts |
| **Prediction integrity preserved** | EPI-001 remains binding; provider removal must not silently break scoring, filtering, direct 1X2, ACCA, publication, or subscriber surfaces |
| **Storage law preserved** | EST-001 remains binding; provider removal must not introduce full Scout/FIP mirroring into Supabase |
| **Gate law preserved** | Gates remain BLOCKED until separately approved |
| **No external provider as fallback truth** | After approved implementation, external provider fallback must not silently become canonical sports truth |

---

## 8. Forbidden in EPRV-001-C1

EPRV-001-C1 does not authorize:

- editing `backend/services/dataProvider.js`
- editing `backend/services/aiPipeline.js`
- editing `backend/apiClients.js`
- editing provider clients or provider utility code
- deleting provider code
- disabling provider code
- changing `DATA_MODE`
- wiring FIP into runtime prediction execution
- SQL execution
- Supabase mutation
- migration creation
- route wiring
- E2E proof
- gate clearance
- cleanup programme reopening

---

## 9. Future implementation gate

Before a future EPRV implementation may edit runtime provider/acquisition code, it must provide:

| Required proof | Description |
|---|---|
| Runtime reachability proof | Confirm which provider paths are reachable from active routes, scripts, schedules, or production boot paths |
| FIP replacement map | Map each provider-acquired fact class to governed Scout/FIP fields |
| Fail-closed no-input proof | Show pipeline behaviour when FIP input is absent or invalid |
| Prediction regression proof | Show EPI protected scoring/filtering/ACCA behaviour remains compatible |
| Provider bypass proof | Prove external provider calls are bypassed only after equivalent FIP facts exist |
| Context replacement proof | Weather, injury, H2H, news, and form context must be sourced from governed FIP/Scout boundaries or explicitly held |
| Storage drift proof | Provider removal must not cause full FIP or Scout evidence bodies to be persisted in Supabase |
| Gate proof | `scout_edge_marriage_gate` and `supabase_storage_gate` remain BLOCKED unless separately approved |

---

## 10. Relationship to upstream contracts

| Contract | EPRV-001-C1 relationship |
|---|---|
| **FIP-001** | Defines the Scout FIP authority source that must replace external provider sports truth |
| **EFI-001** | Defines the fail-closed intake boundary that future EPRV implementation must consume |
| **EST-001** | Defines what Edge may retain while removing provider acquisition |
| **EPI-001** | Protects prediction/scoring/filtering/ACCA semantics during provider removal |
| **E2E-001** | Owns end-to-end proof after provider-removal and runtime mapping prerequisites are ready |
| **EMG-001** | Keeps marriage gate blocked until explicit approval exists |

---

## 11. Completion verdict

| Criterion | Result |
|---|---|
| Current provider surfaces identified | **PASS** |
| Live acquisition chain recorded | **PASS** |
| Provider/domain/API-key markers recorded | **PASS** |
| Runtime provider edits forbidden | **PASS** |
| Provider deletion forbidden | **PASS** |
| SQL/Supabase/migration forbidden | **PASS** |
| Gates remain BLOCKED | **PASS** |
| EPRV remains PARTIAL | **PASS** |
| Future implementation proof requirements defined | **PASS** |

---

## 12. Validation boundary

EPRV-001-C1:

- **Does** document current external sports-provider acquisition surfaces.
- **Does** preserve the inspection evidence needed for future provider-removal implementation.
- **Does** keep EPRV-001 in PARTIAL state.
- **Does** protect EPI prediction-pipeline invariants.
- **Does not** change runtime provider code.
- **Does not** delete providers.
- **Does not** wire FIP into prediction execution.
- **Does not** run SQL, mutate Supabase, or create migrations.
- **Does not** clear `scout_edge_marriage_gate` or `supabase_storage_gate`.
- **Does not** reopen the cleanup programme.
