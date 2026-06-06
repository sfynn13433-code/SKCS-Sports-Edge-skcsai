'use strict';

const { runPipelineForMatches, rebuildFinalOutputs } = require('./aiPipeline');
const { buildLiveData } = require('./dataProvider');
const { upsertCanonicalEvents } = require('./canonicalEvents');
const { assertRapidApiCacheWallReady } = require('./dataProviders');
const { buildMatchContext } = require('./normalizerService');
const quotaPlanner = require('./quotaPlanner');
const { executeOperation } = require('../core/executionPipeline');
const verificationController = require('../core/verificationController');
const pipelineLogger = require('../utils/pipelineLogger');
const config = require('../config');
const { resolveActiveDeploymentSports } = require('../config/activeSports');

console.log('🚨 ACTIVE DATA SOURCE:', process.env.RAPIDAPI_HOST);

// IRON-CLAD DATE PATCH: only drop matches that are CONFIRMED to be in the past
// beyond the 15-minute grace period. The 7-day forward ingestion horizon is
// preserved — future kickoffs (up to +7d) always pass this guard.
// Matches with no parseable kickoff are passed through (not rejected) so that
// freshly ingested fixtures without a kickoff field do not get silently dropped.
const SYNC_GRACE_MINUTES = 15;
// Maximum future window accepted at sync time — matches beyond 7 days are ignored.
const SYNC_FUTURE_DAYS = 7;
const SPORT_FETCH_STAGGER_MS = Math.max(0, Number(process.env.SPORT_FETCH_STAGGER_MS || 1200));
// API-Sports free tier: max 10 req/min → ≥6000ms between tier-1 football league fetches.
const TIER1_MIN_HTTP_DELAY_MS = Math.max(6000, Number(process.env.TIER1_HTTP_DELAY_MS || 6000));
const DEFAULT_SYNC_WINDOW_DAYS = Math.max(2, Math.min(3, Number(process.env.LIVE_FETCH_WINDOW_DAYS || 3)));
const ACTIVE_DEPLOYMENT_SPORTS = resolveActiveDeploymentSports();
const TIER1_SPORT_PRIORITY = Object.freeze({
    Football: 100,
    Basketball: 90,
    Rugby: 80,
    MMA: 70
});

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function unwrapExecuteResult(operationResult) {
    if (!operationResult || typeof operationResult !== 'object') return null;
    if (operationResult.success === true && operationResult.result !== undefined) {
        return operationResult.result;
    }
    return operationResult;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function tier1PriorityForSport(sport) {
    const token = normalizeSportToken(sport);
    return Number(TIER1_SPORT_PRIORITY[token] || 0);
}

function isTier1PrioritySport(sport) {
    return tier1PriorityForSport(sport) > 0;
}

/**
 * Returns true if the normalized match should enter the pipeline.
 *
 * Rules:
 *  - No parseable kickoff → pass through (let downstream validation handle it).
 *  - Kickoff is in the past beyond SYNC_GRACE_MINUTES → reject (stale).
 *  - Kickoff is more than SYNC_FUTURE_DAYS in the future → reject (too far out).
 *  - Anything else (upcoming, within grace window) → accept.
 */
function isMatchWithinGraceWindow(normalizedMatch) {
    try {
        const raw = normalizedMatch || {};
        const kickoffStr = String(
            raw?.match_info?.kickoff ||
            raw?.kickoff ||
            raw?.date ||
            raw?.match_time ||
            ''
        ).trim();

        // No parseable kickoff → pass through
        if (!kickoffStr) return true;
        const kickoff = new Date(kickoffStr);
        if (Number.isNaN(kickoff.getTime())) return true;

        const now = new Date();
        const pastCutoff = new Date(now.getTime() - SYNC_GRACE_MINUTES * 60 * 1000);
        const futureCutoff = new Date(now.getTime() + SYNC_FUTURE_DAYS * 24 * 60 * 60 * 1000);

        if (kickoff < pastCutoff) return false;      // stale
        if (kickoff > futureCutoff) return false;    // too far in the future
        return true;                                  // within window
    } catch (err) {
        // Defensive: on any parsing error, allow through and let downstream handle
        return true;
    }
}

function toNormalizationInput(rawMatch) {
    if (!isObject(rawMatch)) return null;

    if (isObject(rawMatch.match_info) && isObject(rawMatch.sharp_odds) && isObject(rawMatch.contextual_intelligence)) {
        return rawMatch;
    }

    if (isObject(rawMatch.match) && isObject(rawMatch.odds)) {
        return rawMatch;
    }

    const rawProviderData = isObject(rawMatch.raw_provider_data) ? rawMatch.raw_provider_data : {};
    const match = {
        ...rawProviderData,
        ...rawMatch
    };
    const odds = isObject(rawMatch.odds)
        ? rawMatch.odds
        : (isObject(rawProviderData.odds) ? rawProviderData.odds : {});

    return {
        ...rawMatch,
        match,
        odds
    };
}

function hasAnySharpOdds(matchContext) {
    const sharpOdds = isObject(matchContext?.sharp_odds) ? matchContext.sharp_odds : {};
    return Object.values(sharpOdds).some((value) => Number.isFinite(Number(value)));
}

function hasMeaningfulContext(matchContext) {
    const context = isObject(matchContext?.contextual_intelligence) ? matchContext.contextual_intelligence : null;
    if (!context) return false;
    if (context.weather) return true;
    if (Array.isArray(context.injuries) && context.injuries.length > 0) return true;
    if (Array.isArray(context.suspensions) && context.suspensions.length > 0) return true;
    if (Array.isArray(context.expected_lineups) && context.expected_lineups.length > 0) return true;
    if (Array.isArray(context.confirmed_lineups) && context.confirmed_lineups.length > 0) return true;
    if (context.lineup_confirmed === true) return true;
    return false;
}

function getSeasonStartYear() {
    const now = new Date();
    const month = now.getUTCMonth() + 1; // 1-12
    const year = now.getUTCFullYear();
    
    // Most European soccer leagues run August-May
    // If we're between January-July, we're in the latter part of the previous year's started season
    // If we're between August-December, we're in the start of a new season
    if (month >= 8) {
        // August-December: start of season (e.g., Aug 2026 = 2026-2027 season)
        return year;
    } else {
        // January-July: latter part of season (e.g., Apr 2026 = 2025-2026 season)
        return year - 1;
    }
}

const SEASON_START_YEAR = getSeasonStartYear();
const SEASON_YEAR = String(SEASON_START_YEAR); // APIs use the starting year (e.g., 2025 for 2025-2026 season)
const SEASON_RANGE = `${SEASON_START_YEAR}-${SEASON_START_YEAR + 1}`;

/**
 * Supported sports and their configurations
 * These are the REAL leagues the AI will now look for.
 */
const BASE_SPORTS_CONFIG = [
    // Soccer - England (TheSportsDB league IDs)
    { sport: 'Football', leagueId: '4328', season: SEASON_YEAR, oddsKey: 'soccer_epl' },
    // Soccer - Spain (TheSportsDB league IDs)
    { sport: 'Football', leagueId: '4335', season: SEASON_YEAR, oddsKey: 'soccer_spain_la_liga' },
    // Soccer - Germany (TheSportsDB league IDs)
    { sport: 'Football', leagueId: '4331', season: SEASON_YEAR, oddsKey: 'soccer_germany_bundesliga' },
    // Soccer - Italy (TheSportsDB league IDs)
    { sport: 'Football', leagueId: '4332', season: SEASON_YEAR, oddsKey: 'soccer_italy_serie_a' },
    // Soccer - France (TheSportsDB league IDs)
    { sport: 'Football', leagueId: '4334', season: SEASON_YEAR, oddsKey: 'soccer_france_ligue_one' },

    // Basketball - NBA (TheSportsDB league ID)
    { sport: 'Basketball', leagueId: '4387', season: SEASON_YEAR, oddsKey: 'basketball_nba' },

    // MLB (TheSportsDB league ID)
    { sport: 'MLB', leagueId: '4424', season: SEASON_YEAR, oddsKey: 'baseball_mlb' },

    // NHL (TheSportsDB league ID)
    { sport: 'NHL', leagueId: '4380', season: SEASON_YEAR, oddsKey: 'icehockey_nhl' },

    // NFL (TheSportsDB league ID)
    { sport: 'NFL', leagueId: '4391', season: SEASON_YEAR, oddsKey: 'americanfootball_nfl' },
];

/**
 * Summer / global football — API-Sports V3 league ids (not TheSportsDB).
 * Same ingest waterfall per league (API-Sports primary); no change to stagger, quotas, or router rules.
 * @see docs/football-leagues-apisports.md
 */
const FOOTBALL_APISPORTS_LEAGUE_CONFIG = [
    { sport: 'Football', leagueId: '3', season: SEASON_YEAR, oddsKey: null, leagueTier: 1, competition: 'UEFA Champions League', fixtureDate: '2026-05-05', allowFinalForDisplay: true },
    { sport: 'Football', leagueId: '98', season: SEASON_YEAR, oddsKey: null, leagueTier: 1, competition: 'J1 League' },
    { sport: 'Football', leagueId: '99', season: SEASON_YEAR, oddsKey: null, leagueTier: 2, competition: 'J2 League' },
    { sport: 'Football', leagueId: '169', season: SEASON_YEAR, oddsKey: null, leagueTier: 1, competition: 'Chinese Super League' },
    { sport: 'Football', leagueId: '170', season: SEASON_YEAR, oddsKey: null, leagueTier: 2, competition: 'China League One' },
    { sport: 'Football', leagueId: '253', season: SEASON_YEAR, oddsKey: null, leagueTier: 1, competition: 'MLS' },
    { sport: 'Football', leagueId: '255', season: SEASON_YEAR, oddsKey: null, leagueTier: 2, competition: 'USL Championship' },
    { sport: 'Football', leagueId: '71', season: SEASON_YEAR, oddsKey: null, leagueTier: 1, competition: 'Brasileirão Série A' },
    { sport: 'Football', leagueId: '72', season: SEASON_YEAR, oddsKey: null, leagueTier: 2, competition: 'Brasileirão Série B' }
];

const FOOTBALL_TIER_1_LEAGUES = new Set([
    '3', '4328', '4335', '4331', '4332', '4334',
    '98', '169', '253', '71'
]);
const FOOTBALL_TIER_2_LEAGUES = new Set(['99', '170', '255', '72']);
const BASKETBALL_TIER_1_LEAGUES = new Set(['4387']);
const BASKETBALL_TIER_2_LEAGUES = new Set([]);
const RUGBY_TIER_1_LEAGUES = new Set([]);
const RUGBY_TIER_2_LEAGUES = new Set([]);
const AMERICAN_FOOTBALL_TIER_1_LEAGUES = new Set(['4391']);
const AMERICAN_FOOTBALL_TIER_2_LEAGUES = new Set([]);
const BASEBALL_TIER_1_LEAGUES = new Set(['4424']);
const BASEBALL_TIER_2_LEAGUES = new Set([]);
const HOCKEY_TIER_1_LEAGUES = new Set(['4380']);
const HOCKEY_TIER_2_LEAGUES = new Set([]);

function resolveLeagueTier(item) {
    const sport = normalizeSportToken(item?.sport || '');
    const leagueId = item?.leagueId === null || item?.leagueId === undefined
        ? null
        : String(item.leagueId).trim();

    if (!leagueId) return 3;

    if (sport === 'Football') {
        if (FOOTBALL_TIER_1_LEAGUES.has(leagueId)) return 1;
        if (FOOTBALL_TIER_2_LEAGUES.has(leagueId)) return 2;
        return 3;
    }
    if (sport === 'Basketball') {
        if (BASKETBALL_TIER_1_LEAGUES.has(leagueId)) return 1;
        if (BASKETBALL_TIER_2_LEAGUES.has(leagueId)) return 2;
        return 3;
    }
    if (sport === 'Rugby') {
        if (RUGBY_TIER_1_LEAGUES.has(leagueId)) return 1;
        if (RUGBY_TIER_2_LEAGUES.has(leagueId)) return 2;
        return 3;
    }
    if (sport === 'NFL') {
        if (AMERICAN_FOOTBALL_TIER_1_LEAGUES.has(leagueId)) return 1;
        if (AMERICAN_FOOTBALL_TIER_2_LEAGUES.has(leagueId)) return 2;
        return 3;
    }
    if (sport === 'MLB') {
        if (BASEBALL_TIER_1_LEAGUES.has(leagueId)) return 1;
        if (BASEBALL_TIER_2_LEAGUES.has(leagueId)) return 2;
        return 3;
    }
    if (sport === 'NHL') {
        if (HOCKEY_TIER_1_LEAGUES.has(leagueId)) return 1;
        if (HOCKEY_TIER_2_LEAGUES.has(leagueId)) return 2;
        return 3;
    }
    return 2;
}

const SPORTS_CONFIG = [
    ...BASE_SPORTS_CONFIG.map((item) => ({
        ...item,
        leagueTier: resolveLeagueTier(item)
    })),
    ...FOOTBALL_APISPORTS_LEAGUE_CONFIG
];

function normalizeSportToken(value) {
    const token = String(value || '').trim().toLowerCase();
    if (!token) return '';
    const aliases = {
        nfl: 'NFL',
        'american-football': 'NFL',
        american_football: 'NFL',
        basketball_nba: 'Basketball',
        nba: 'Basketball',
        football: 'Football',
        soccer: 'Football',
        basketball: 'Basketball',
        rugby: 'Rugby',
        mma: 'MMA',
        volleyball: 'Volleyball',
        handball: 'Handball',
        afl: 'AFL',
        nhl: 'NHL',
        mlb: 'MLB',
        golf: 'Golf',
        boxing: 'Boxing',
        tennis: 'Tennis',
        cricket: 'Cricket',
        esports: 'Esports',
        darts: 'Darts'
    };
    const resolved = aliases[token];
    if (resolved) return resolved;
    return token.charAt(0).toUpperCase() + token.slice(1);
}

function normalizeRequestedSports(input) {
    if (!input) return [];

    const values = Array.isArray(input) ? input : [input];
    return values
        .flatMap((value) => String(value || '').split(','))
        .map((value) => normalizeSportToken(value))
        .filter(Boolean);
}

function isActiveDeploymentSport(value) {
    return ACTIVE_DEPLOYMENT_SPORTS.has(normalizeSportToken(value));
}

function getSportsConfigForRequest(input) {
    const requestedSports = normalizeRequestedSports(input);
    const enabledConfigs = SPORTS_CONFIG.filter((item) => ACTIVE_DEPLOYMENT_SPORTS.has(item.sport));

    if (!requestedSports.length) {
        return {
            configs: enabledConfigs,
            requestedSports: Array.from(ACTIVE_DEPLOYMENT_SPORTS),
            blockedSports: []
        };
    }

    const requestedSet = new Set(requestedSports);
    if (requestedSet.has('all')) {
        return {
            configs: enabledConfigs,
            requestedSports: Array.from(ACTIVE_DEPLOYMENT_SPORTS),
            blockedSports: requestedSports.filter((sport) => !ACTIVE_DEPLOYMENT_SPORTS.has(sport) && sport !== 'all')
        };
    }

    const enabledSportsInRequest = requestedSports.filter((sport) => ACTIVE_DEPLOYMENT_SPORTS.has(sport));

    return {
        configs: enabledSportsInRequest.length ? enabledConfigs.filter((item) => enabledSportsInRequest.includes(item.sport)) : [],
        requestedSports: enabledSportsInRequest.length ? enabledSportsInRequest : requestedSports,
        blockedSports: requestedSports.filter((sport) => !ACTIVE_DEPLOYMENT_SPORTS.has(sport))
    };
}

/**
 * syncAllSports
 * This function clears out the "Test Data" and pulls REAL matches 
 * from the providers into your Supabase database.
 */
async function syncSports(options = {}) {
    const cacheWallReady = assertRapidApiCacheWallReady();
    if (!cacheWallReady) {
        console.warn('[syncService] RapidAPI cache wall is not fully configured. RapidAPI fallbacks may be blocked.');
    }

    const { configs, requestedSports, blockedSports } = getSportsConfigForRequest(options.sports);
    const syncState = {
        apiSportsFootballBlocked: false
    };
    const scopeLabel = requestedSports.length ? requestedSports.join(', ') : 'all sports';
    console.log(`[syncService] Starting sports data sync for REAL matches (${scopeLabel})...`);
    if (blockedSports.length > 0) {
        console.log('[syncService] Active-sports gate blocked requested sports: %s', blockedSports.join(', '));
    }
    console.log(`[syncService] Using season config: SEASON_YEAR=${SEASON_YEAR}, SEASON_RANGE=${SEASON_RANGE}`);

    // ── PROVIDER STATUS LOGGING ─────────────────────────────────────────────
    console.log('[Provider Status]');
    console.log(`  API-Sports: ${String(process.env.DISABLE_APISPORTS || '').toLowerCase() === 'true' ? 'DISABLED' : 'ON HOLD / FALLBACK'} (X_APISPORTS_KEY=${process.env.X_APISPORTS_KEY ? 'SET' : 'MISSING'})`);
    console.log(`  Big Balls Data: ${String(process.env.ENABLE_BIG_BALLS_DATA_PROVIDER || '').trim() === 'true' ? 'ACTIVE' : 'DISABLED'} PRIMARY_FOOTBALL=${String(process.env.BIG_BALLS_PRIMARY_FOOTBALL || '').trim() === 'true' ? 'YES' : 'NO'} (BIG_BALLS_DATA_API_KEY=${process.env.BIG_BALLS_DATA_API_KEY ? 'SET' : 'MISSING'})`);
    console.log(`  TheSportsDB: ${process.env.THESPORTSDB_KEY ? 'ACTIVE' : 'DISABLED'} (THESPORTSDB_KEY=${process.env.THESPORTSDB_KEY ? 'SET' : 'MISSING'})`);
    console.log(`  Odds API: ${process.env.ODDS_API_KEY ? 'ACTIVE' : 'DISABLED'} (ODDS_API_KEY=${process.env.ODDS_API_KEY ? 'SET' : 'MISSING'})`);
    console.log(`  FootballData.org: ${normalizeSportToken(requestedSports[0] || 'football') === 'football' ? 'ACTIVE' : 'N/A (football only)'}`);
    // ────────────────────────────────────────────────────────────────────
    const telemetryRunId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    pipelineLogger.startRun({
        run_id: telemetryRunId,
        metadata: {
            scope: scopeLabel,
            requested_sports: requestedSports.length ? requestedSports : ['all'],
            blocked_sports: blockedSports,
            season_year: SEASON_YEAR,
            season_range: SEASON_RANGE
        }
    });

    // FORCE REAL MODE: We ignore the 'test' config to ensure real data flows.
    try {
        let totalMatchesProcessed = 0;
        const perSport = new Map();
        const perSportErrors = new Map();

        if (!configs.length) {
            console.warn('[syncService] No matching sports configuration found for request:', requestedSports.join(', '));
            const report = pipelineLogger.finishRun({
                run_id: telemetryRunId,
                status: 'completed',
                metadata: {
                    total_matches_processed: 0,
                    note: 'no_matching_sports_config',
                    blocked_sports: blockedSports
                }
            });
            console.log('[syncService][pipeline_telemetry] %s', JSON.stringify(report, null, 2));
            return {
                requestedSports,
                totalMatchesProcessed: 0,
                rebuiltFinalOutputs: false,
                perSport: [],
                errors: blockedSports.map((sport) => `${sport}: disabled_in_phase_1_football_only`)
            };
        }

        const prioritizedConfigs = configs
            .slice()
            .sort((a, b) => {
                const priorityA = tier1PriorityForSport(a?.sport);
                const priorityB = tier1PriorityForSport(b?.sport);
                if (priorityA !== priorityB) return priorityB - priorityA;
                const tierA = Number(a?.leagueTier || 9);
                const tierB = Number(b?.leagueTier || 9);
                if (tierA !== tierB) return tierA - tierB;
                const sportA = String(a?.sport || '');
                const sportB = String(b?.sport || '');
                if (sportA !== sportB) return sportA.localeCompare(sportB);
                return String(a?.leagueId || '').localeCompare(String(b?.leagueId || ''));
            });

        const footballConfigs = prioritizedConfigs.filter((item) => normalizeSportToken(item?.sport) === 'football');
        const footballPlan = footballConfigs.length > 0
            ? (await quotaPlanner.buildPlan({
                sports: requestedSports,
                football: {
                    leagues: footballConfigs,
                    callsPerLeague: 1,
                    minRequiredCalls: 1
                }
            })).football || null
            : null;

        verificationController.enforce(
            verificationController.evaluateQuotaState({
                source: 'syncService',
                remainingToday: footballPlan?.rawState?.remainingToday ?? null,
                remainingPerMinute: footballPlan?.rawState?.remainingPerMinute ?? null,
                exhaustedToday: footballPlan?.rawState?.exhaustedToday === true,
                exhaustedPerMinute: footballPlan?.rawState?.exhaustedPerMinute === true,
                bufferBelow10percent: footballPlan?.rawState?.remainingToday != null && footballPlan?.rawState?.dailyLimit != null
                    ? footballPlan.rawState.remainingToday <= Math.max(1, Math.floor(Number(footballPlan.rawState.dailyLimit) * 0.1))
                    : false,
                hardStop: footballPlan?.reason === 'NO_PROVIDER_STATE'
            })
        );

        const footballLeagueAllowlist = new Set(
            Array.isArray(footballPlan?.leaguesAllowed)
                ? footballPlan.leaguesAllowed.map((item) => String(item?.leagueId || '').trim()).filter(Boolean)
                : []
        );
        if (footballPlan && footballPlan.allowed === false) {
            syncState.apiSportsFootballBlocked = true;
            console.log(
                `[syncService] Football API-Sports preflight blocked: ${footballPlan.reason} (remainingToday=${footballPlan.rawState?.remainingToday ?? 'n/a'}, remainingPerMinute=${footballPlan.rawState?.remainingPerMinute ?? 'n/a'}) — continuing with Big Balls / TheSportsDB fallbacks`
            );
        }

        for (let index = 0; index < prioritizedConfigs.length; index += 1) {
            const item = prioritizedConfigs[index];
            try {
                const itemSportToken = normalizeSportToken(item?.sport);
                if (itemSportToken === 'football' && footballPlan?.allowed === true) {
                    const leagueId = String(item?.leagueId || '').trim();
                    if (footballLeagueAllowlist.size > 0 && !footballLeagueAllowlist.has(leagueId)) {
                        console.log(`[syncService] Skipping ${item.leagueId || 'football'} - football quota planner excluded this league`);
                        if (!perSport.has(item.sport)) perSport.set(item.sport, 0);
                        continue;
                    }
                }
                if (!isActiveDeploymentSport(item.sport)) {
                    console.log('[syncService] Skipping disabled sport in phase-1 deployment: %s', item.sport);
                    continue;
                }
                console.log(`[syncService] Fetching REAL matches for: ${item.sport} (tier: ${item.leagueTier || 3}, league: ${item.leagueId || 'all'}, season: ${item.season})...`);
                console.log(`[DIAG] syncSports calling buildLiveData for sport=${item.sport} leagueId=${item.leagueId} season=${item.season} oddsKey=${item.oddsKey || 'none'}`);

                const rawMatches = await buildLiveData({
                    ...item,
                    windowDays: DEFAULT_SYNC_WINDOW_DAYS,
                    syncState
                });
                const rawMatchesList = Array.isArray(rawMatches) ? rawMatches : [];
                console.log(`[DIAG] syncSports buildLiveData returned ${rawMatchesList.length} raw matches for ${item.sport}/${item.leagueId}`);
                pipelineLogger.stageAdd({
                    run_id: telemetryRunId,
                    sport: item.sport,
                    stage: 'fetched_count',
                    count: rawMatchesList.length
                });
                const normalizedMatches = [];
                for (const rawMatch of rawMatchesList) {
                    try {
                        const normalizationInput = toNormalizationInput(rawMatch);
                        const isSportsDataIoRow = String(rawMatch?.provider || rawMatch?.provider_name || '').toLowerCase().includes('sportsdata');
                        if (!normalizationInput || !normalizationInput.match || (!normalizationInput.odds && !isSportsDataIoRow)) {
                            pipelineLogger.rejectionAdd({
                                run_id: telemetryRunId,
                                sport: item.sport,
                                bucket: 'legacy_schema_reject',
                                metadata: { reason: 'missing_match_or_odds' }
                            });
                            continue;
                        }
                        const normalized = buildMatchContext(normalizationInput);
                        if (!normalized) {
                            pipelineLogger.rejectionAdd({
                                run_id: telemetryRunId,
                                sport: item.sport,
                                bucket: 'legacy_schema_reject',
                                metadata: { reason: 'normalizer_returned_null' }
                            });
                            continue;
                        }

                        pipelineLogger.stageAdd({
                            run_id: telemetryRunId,
                            sport: item.sport,
                            stage: 'normalized_count',
                            count: 1
                        });
                        pipelineLogger.recordSportNormalization({
                            run_id: telemetryRunId,
                            sport: item.sport,
                            provider_sport: rawMatch?.sport || rawMatch?.raw_provider_data?.sport || normalizationInput?.match?.sport || 'unknown',
                            canonical_sport: normalized?.sport || item.sport
                        });
                         if (!isActiveDeploymentSport(normalized?.sport || item.sport)) {
                             pipelineLogger.rejectionAdd({
                                 run_id: telemetryRunId,
                                 sport: normalizeSportToken(normalized?.sport || item.sport) || 'unknown',
                                 bucket: 'sport_deployment_block',
                                 metadata: {
                                     reason: 'sport_not_in_active_deployment_set'
                                 }
                             });
                             continue;
                         }
                        // TEMPORARY BYPASS: Relax gatekeepers to allow matches without context/odds to proceed
                        if (!hasAnySharpOdds(normalized)) {
                            console.warn('[syncService] Bypassing missing odds for match %s (ProFootballAPI 404/400 errors)', normalized?.match_info?.match_id || 'unknown');
                        }
                        if (!hasMeaningfulContext(normalized)) {
                            console.warn('[syncService] Bypassing missing context for match %s (ProFootballAPI 404/400 errors)', normalized?.match_info?.match_id || 'unknown');
                        }
                        // IRON-CLAD DATE PATCH: drop matches that are past the grace window.
                        if (!isMatchWithinGraceWindow(normalized) && !(isSportsDataIoRow && item?.allowFinalForDisplay)) {
                            pipelineLogger.rejectionAdd({
                                run_id: telemetryRunId,
                                sport: item.sport,
                                bucket: 'stale_kickoff_rejected',
                                metadata: {
                                    match_id: normalized?.match_info?.match_id || null,
                                    reason: 'kickoff_past_grace_window'
                                }
                            });
                            continue;
                        }
                        // Safeguard: Ensure contextual_intelligence is initialized as {} when empty
                        if (!normalized.contextual_intelligence || typeof normalized.contextual_intelligence !== 'object') {
                            normalized.contextual_intelligence = {};
                        }
                        normalizedMatches.push(normalized);
                    } catch (normalizeErr) {
                        console.warn('[syncService] Normalization failed for one match (%s): %s', item.sport, normalizeErr.message);
                    }
                }

                if (normalizedMatches.length > 0) {
                    await upsertCanonicalEvents(normalizedMatches, {
                        allowSportsDataIo: Boolean(item?.allowFinalForDisplay)
                    });
                    console.log(`[syncService] Found ${normalizedMatches.length} REAL matches for ${item.sport}. Running AI Analysis...`);
                    const pipelineResult = await executeOperation({
                        operation: 'syncService.runPipelineForMatches',
                        caller: 'backend/services/syncService.js',
                        payload: {
                            sport: item.sport,
                            matchCount: normalizedMatches.length,
                            run_id: telemetryRunId
                        },
                        execute: async () => runPipelineForMatches({
                            matches: normalizedMatches,
                            telemetry: {
                                run_id: telemetryRunId,
                                sport: item.sport
                            }
                        })
                    });
                    const pipelinePayload = unwrapExecuteResult(pipelineResult);
                    if (pipelineResult?.success === false || pipelinePayload?.error) {
                        const errorMsg = `${item.sport}: ${pipelineResult?.error || pipelinePayload?.error || 'pipeline_blocked'}`;
                        perSportErrors.set(item.sport, errorMsg);
                        console.warn(`[syncService] ${item.sport}: pipeline skipped (${pipelineResult?.error || pipelinePayload?.error})`);
                        if (!perSport.has(item.sport)) perSport.set(item.sport, 0);
                    } else {
                        const insertedCount = Array.isArray(pipelinePayload?.inserted)
                            ? pipelinePayload.inserted.length
                            : normalizedMatches.length;
                        totalMatchesProcessed += insertedCount;
                        perSport.set(item.sport, (perSport.get(item.sport) || 0) + insertedCount);
                        console.log(`[syncService] ${item.sport}: pipeline complete (normalized=${normalizedMatches.length}, inserted=${insertedCount})`);
                    }
                } else {
                    console.warn(`[syncService] No upcoming REAL matches found for ${item.sport}. This could mean:`);
                    console.warn(`  - Season is over or hasn't started yet`);
                    console.warn(`  - API keys are missing or invalid`);
                    console.warn(`  - League ID or season configuration is incorrect`);
                    console.warn(`  - Provider does not support this sport (leagueId=${item.leagueId})`);
                    if (!perSport.has(item.sport)) {
                        perSport.set(item.sport, 0);
                    }
                }
            } catch (sportErr) {
                if (sportErr?.code === 'provider_quota_exceeded' && normalizeSportToken(item?.sport) === 'football') {
                    syncState.apiSportsFootballBlocked = true;
                    console.warn('[syncService] API-Sports football quota exhausted; remaining football leagues will be skipped.');
                }
                const errorMsg = `${item.sport}: ${sportErr.message}`;
                console.error(`[syncService] ERROR processing ${item.sport}:`, sportErr.message);
                console.error(`[syncService] Stack trace:`, sportErr.stack);
                perSportErrors.set(item.sport, errorMsg);
                // Continue with next sport instead of failing completely
            } finally {
                if (index < prioritizedConfigs.length - 1 && SPORT_FETCH_STAGGER_MS > 0) {
                    const nextItem = prioritizedConfigs[index + 1];
                    const enforceTier1Delay = isTier1PrioritySport(item?.sport) || isTier1PrioritySport(nextItem?.sport);
                    const delayMs = enforceTier1Delay
                        ? Math.max(SPORT_FETCH_STAGGER_MS, TIER1_MIN_HTTP_DELAY_MS)
                        : SPORT_FETCH_STAGGER_MS;
                    console.log(`[syncService] Stagger delay ${delayMs}ms before next sport fetch...`);
                    await sleep(delayMs);
                }
            }
        }

        if (totalMatchesProcessed > 0) {
            console.log('[syncService] Sync successful. Rebuilding final outputs for the website...');
            // This moves the AI results into the 'direct1x2_prediction_final' table the website sees.
            const rebuild = await executeOperation({
                operation: 'syncService.rebuildFinalOutputs',
                caller: 'backend/services/syncService.js',
                payload: {
                    triggerSource: 'sync_service',
                    requestedSports: requestedSports.length ? requestedSports : ['all'],
                    telemetryRunId
                },
                execute: async () => rebuildFinalOutputs({
                    triggerSource: 'sync_service',
                    requestedSports: requestedSports.length ? requestedSports : ['all'],
                    telemetryRunId: telemetryRunId,
                    metadata: {
                        totalMatchesProcessed,
                        perSport: Array.from(perSport.entries()).map(([sport, matchesProcessed]) => ({ sport, matchesProcessed })),
                        errors: Array.from(perSportErrors.entries()).map(([sport, error]) => ({ sport, error }))
                    }
                })
            });
            const report = pipelineLogger.finishRun({
                run_id: telemetryRunId,
                status: 'completed',
                metadata: {
                    total_matches_processed: totalMatchesProcessed,
                    per_sport: Array.from(perSport.entries()).map(([sport, matchesProcessed]) => ({ sport, matchesProcessed })),
                    errors: Array.from(perSportErrors.entries()).map(([sport, error]) => ({ sport, error })),
                    publish_run_id: unwrapExecuteResult(rebuild)?.publish_run?.id || null
                }
            });
            console.log('[syncService][pipeline_telemetry] %s', JSON.stringify(report, null, 2));
            console.log('[syncService] Master sync complete! Real data is now live.');
            console.log(`[syncService] Summary: ${totalMatchesProcessed} matches processed, ${perSport.size} sports covered`);
            const rebuildPayload = unwrapExecuteResult(rebuild);
            return {
                success: true,
                requestedSports,
                totalMatchesProcessed,
                rebuiltFinalOutputs: true,
                perSport: Array.from(perSport.entries()).map(([sport, matchesProcessed]) => ({ sport, matchesProcessed })),
                errors: [
                    ...Array.from(perSportErrors.entries()).map(([sport, error]) => ({ sport, error })),
                    ...blockedSports.map((sport) => ({ sport, error: 'disabled_in_phase_1_football_only' }))
                ],
                publishRun: rebuildPayload?.publish_run || null
            };
        } else {
            console.warn('[syncService] Sync finished but 0 real matches were found. Check your API Keys and season configuration.');
            console.log(`[DIAG] FINAL SUMMARY: totalMatchesProcessed=0 perSport=${JSON.stringify(Array.from(perSport.entries()))} errors=${JSON.stringify(Array.from(perSportErrors.entries()))}`);

            // ── FIXTURES FETCHED SUMMARY ───────────────────────────────────────────
            console.log('[Fixtures fetched]');
            perSport.forEach((count, sport) => {
                console.log(`  ${sport}: ${count}`);
            });
            // ────────────────────────────────────────────────────────────────────

            const report = pipelineLogger.finishRun({
                run_id: telemetryRunId,
                status: 'completed',
                metadata: {
                    total_matches_processed: 0,
                    per_sport: Array.from(perSport.entries()).map(([sport, matchesProcessed]) => ({ sport, matchesProcessed })),
                    errors: Array.from(perSportErrors.entries()).map(([sport, error]) => ({ sport, error }))
                }
            });
            console.log('[syncService][pipeline_telemetry] %s', JSON.stringify(report, null, 2));
            return {
                requestedSports,
                totalMatchesProcessed: 0,
                rebuiltFinalOutputs: false,
                perSport: Array.from(perSport.entries()).map(([sport, matchesProcessed]) => ({ sport, matchesProcessed })),
                errors: [
                    ...Array.from(perSportErrors.entries()).map(([sport, error]) => ({ sport, error })),
                    ...blockedSports.map((sport) => ({ sport, error: 'disabled_in_phase_1_football_only' }))
                ]
            };
        }

    } catch (error) {
        console.error('[syncService] Master sync failed:', error.message);
        console.error('[syncService] Stack trace:', error.stack);
        const report = pipelineLogger.finishRun({
            run_id: telemetryRunId,
            status: 'failed',
            metadata: { error: error.message }
        });
        console.log('[syncService][pipeline_telemetry] %s', JSON.stringify(report, null, 2));
        throw error;
    }
}

async function syncAllSports() {
    return syncSports();
}

// Allow manual trigger via command line
if (require.main === module) {
    syncSports({
        sports: process.argv.slice(2)
    })
        .then(() => {
            console.log('[syncService] Manual process finished.');
            process.exit(0);
        })
        .catch((err) => {
            console.error('[syncService] Manual process crashed:', err);
            process.exit(1);
        });
}

module.exports = {
    syncAllSports,
    syncSports
};
