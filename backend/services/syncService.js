'use strict';

const { runPipelineForMatches, rebuildFinalOutputs } = require('./aiPipeline');
const { buildLiveData } = require('./dataProvider');
const { upsertCanonicalEvents } = require('./canonicalEvents');
const { assertRapidApiCacheWallReady } = require('./dataProviders');
const { buildMatchContext } = require('./normalizerService');
const pipelineLogger = require('../utils/pipelineLogger');
const config = require('../config');

// IRON-CLAD DATE PATCH: only drop matches that are CONFIRMED to be in the past
// beyond the 15-minute grace period. The 7-day forward ingestion horizon is
// preserved — future kickoffs (up to +7d) always pass this guard.
// Matches with no parseable kickoff are passed through (not rejected) so that
// freshly ingested fixtures without a kickoff field do not get silently dropped.
const SYNC_GRACE_MINUTES = 15;
// Maximum future window accepted at sync time — matches beyond 7 days are ignored.
const SYNC_FUTURE_DAYS = 7;
const SPORT_FETCH_STAGGER_MS = Math.max(0, Number(process.env.SPORT_FETCH_STAGGER_MS || 1200));
const DEFAULT_SYNC_WINDOW_DAYS = Math.max(2, Math.min(3, Number(process.env.LIVE_FETCH_WINDOW_DAYS || 3)));

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
    const mi = isObject(normalizedMatch?.match_info) ? normalizedMatch.match_info : {};
    const rawKickoff =
        mi.kickoff ||
        mi.match_time ||
        mi.kickoff_time ||
        mi.commence_time ||
        normalizedMatch?.kickoff ||
        normalizedMatch?.match_time ||
        null;

    if (!rawKickoff) return true; // no kickoff → pass through, let downstream decide

    const kickoffMs = new Date(rawKickoff).getTime();
    if (!Number.isFinite(kickoffMs)) return true; // unparseable → pass through

    const nowMs = Date.now();
    const graceCutoffMs = nowMs - SYNC_GRACE_MINUTES * 60 * 1000;
    const futureCapMs   = nowMs + SYNC_FUTURE_DAYS * 24 * 60 * 60 * 1000;

    if (kickoffMs < graceCutoffMs) return false; // past the grace window → stale, reject
    if (kickoffMs > futureCapMs)   return false; // beyond 7-day horizon → reject
    return true; // within [grace cutoff … +7 days] → accept
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
    // Soccer - England
    { sport: 'football', leagueId: '39', season: SEASON_YEAR, oddsKey: 'soccer_epl' },
    { sport: 'football', leagueId: '40', season: SEASON_YEAR, oddsKey: null },
    // Soccer - Spain
    { sport: 'football', leagueId: '140', season: SEASON_YEAR, oddsKey: 'soccer_spain_la_liga' },
    { sport: 'football', leagueId: '141', season: SEASON_YEAR, oddsKey: null },
    // Soccer - Germany
    { sport: 'football', leagueId: '78', season: SEASON_YEAR, oddsKey: 'soccer_germany_bundesliga' },
    { sport: 'football', leagueId: '79', season: SEASON_YEAR, oddsKey: null },
    // Soccer - Italy
    { sport: 'football', leagueId: '135', season: SEASON_YEAR, oddsKey: 'soccer_italy_serie_a' },
    { sport: 'football', leagueId: '136', season: SEASON_YEAR, oddsKey: null },
    // Soccer - France
    { sport: 'football', leagueId: '61', season: SEASON_YEAR, oddsKey: 'soccer_france_ligue_one' },
    { sport: 'football', leagueId: '62', season: SEASON_YEAR, oddsKey: null },
    // Soccer - International
    { sport: 'football', leagueId: '2', season: SEASON_YEAR, oddsKey: 'soccer_uefa_champs_league' },
    { sport: 'football', leagueId: '3', season: SEASON_YEAR, oddsKey: 'soccer_uefa_europa_league' },

    // Basketball / NBA
    { sport: 'nba', leagueId: '12', season: SEASON_YEAR, oddsKey: 'basketball_nba' },
    { sport: 'nba', leagueId: '20', season: SEASON_YEAR, oddsKey: null },
    { sport: 'basketball', leagueId: '117', season: SEASON_RANGE, oddsKey: null },
    { sport: 'basketball', leagueId: '85', season: SEASON_RANGE, oddsKey: null },
    { sport: 'basketball', leagueId: '120', season: SEASON_RANGE, oddsKey: 'basketball_euroleague' },

    // Rugby
    { sport: 'rugby', leagueId: '13', season: SEASON_YEAR, oddsKey: null },
    { sport: 'rugby', leagueId: '14', season: SEASON_YEAR, oddsKey: null },
    { sport: 'rugby', leagueId: '1', season: SEASON_YEAR, oddsKey: null },
    { sport: 'rugby', leagueId: '45', season: SEASON_YEAR, oddsKey: null },
    { sport: 'rugby', leagueId: '44', season: SEASON_YEAR, oddsKey: 'rugbyunion_international' },
    { sport: 'rugby', leagueId: '7', season: SEASON_YEAR, oddsKey: null },

    // American Football
    { sport: 'american_football', leagueId: '1', season: SEASON_YEAR, oddsKey: 'americanfootball_nfl' },
    { sport: 'american_football', leagueId: '2', season: SEASON_YEAR, oddsKey: null },

    // Baseball
    { sport: 'baseball', leagueId: '1', season: SEASON_YEAR, oddsKey: 'baseball_mlb' },
    { sport: 'baseball', leagueId: '2', season: SEASON_YEAR, oddsKey: null },
    { sport: 'baseball', leagueId: '3', season: SEASON_YEAR, oddsKey: null },
    { sport: 'baseball', leagueId: '96', season: SEASON_YEAR, oddsKey: null },
    { sport: 'baseball', leagueId: '97', season: SEASON_YEAR, oddsKey: null },

    // Hockey
    { sport: 'hockey', leagueId: '57', season: SEASON_YEAR, oddsKey: 'icehockey_nhl' },
    { sport: 'hockey', leagueId: '58', season: SEASON_YEAR, oddsKey: null },
    { sport: 'hockey', leagueId: '69', season: SEASON_YEAR, oddsKey: null },
    { sport: 'hockey', leagueId: '70', season: SEASON_YEAR, oddsKey: null },

    // Volleyball
    { sport: 'volleyball', leagueId: '95', season: SEASON_YEAR, oddsKey: null },
    { sport: 'volleyball', leagueId: '96', season: SEASON_YEAR, oddsKey: null },

    // Handball
    { sport: 'handball', leagueId: '82', season: SEASON_YEAR, oddsKey: null },
    { sport: 'handball', leagueId: '83', season: SEASON_YEAR, oddsKey: null },

    // Aussie Rules
    { sport: 'afl', leagueId: '1', season: SEASON_YEAR, oddsKey: 'aussierules_afl' },
    { sport: 'afl', leagueId: '2', season: SEASON_YEAR, oddsKey: null },

    // Formula 1 + MMA
    { sport: 'formula1', leagueId: null, season: SEASON_YEAR, oddsKey: null },
    { sport: 'mma', leagueId: null, season: SEASON_YEAR, oddsKey: 'mma_mixed_martial_arts' },
    { sport: 'tennis', leagueId: null, season: SEASON_YEAR, oddsKey: null },
    { sport: 'cricket', leagueId: null, season: SEASON_YEAR, oddsKey: null },
];

const FOOTBALL_TIER_1_LEAGUES = new Set(['39', '140', '78', '135', '61', '2', '3']);
const FOOTBALL_TIER_2_LEAGUES = new Set(['40', '141', '79', '136', '62']);
const BASKETBALL_TIER_1_LEAGUES = new Set(['12', '120']);
const BASKETBALL_TIER_2_LEAGUES = new Set(['20', '117', '85']);
const RUGBY_TIER_1_LEAGUES = new Set(['13', '14', '44']);
const RUGBY_TIER_2_LEAGUES = new Set(['1', '45', '7']);
const AMERICAN_FOOTBALL_TIER_1_LEAGUES = new Set(['1']);
const AMERICAN_FOOTBALL_TIER_2_LEAGUES = new Set(['2']);
const BASEBALL_TIER_1_LEAGUES = new Set(['1']);
const BASEBALL_TIER_2_LEAGUES = new Set(['2', '3', '96', '97']);
const HOCKEY_TIER_1_LEAGUES = new Set(['57']);
const HOCKEY_TIER_2_LEAGUES = new Set(['58', '69', '70']);

function resolveLeagueTier(item) {
    const sport = String(item?.sport || '').trim().toLowerCase();
    const leagueId = item?.leagueId === null || item?.leagueId === undefined
        ? null
        : String(item.leagueId).trim();

    if (!leagueId) return 3;

    if (sport === 'football') {
        if (FOOTBALL_TIER_1_LEAGUES.has(leagueId)) return 1;
        if (FOOTBALL_TIER_2_LEAGUES.has(leagueId)) return 2;
        return 3;
    }
    if (sport === 'basketball' || sport === 'nba') {
        if (BASKETBALL_TIER_1_LEAGUES.has(leagueId)) return 1;
        if (BASKETBALL_TIER_2_LEAGUES.has(leagueId)) return 2;
        return 3;
    }
    if (sport === 'rugby') {
        if (RUGBY_TIER_1_LEAGUES.has(leagueId)) return 1;
        if (RUGBY_TIER_2_LEAGUES.has(leagueId)) return 2;
        return 3;
    }
    if (sport === 'american_football') {
        if (AMERICAN_FOOTBALL_TIER_1_LEAGUES.has(leagueId)) return 1;
        if (AMERICAN_FOOTBALL_TIER_2_LEAGUES.has(leagueId)) return 2;
        return 3;
    }
    if (sport === 'baseball') {
        if (BASEBALL_TIER_1_LEAGUES.has(leagueId)) return 1;
        if (BASEBALL_TIER_2_LEAGUES.has(leagueId)) return 2;
        return 3;
    }
    if (sport === 'hockey') {
        if (HOCKEY_TIER_1_LEAGUES.has(leagueId)) return 1;
        if (HOCKEY_TIER_2_LEAGUES.has(leagueId)) return 2;
        return 3;
    }
    return 2;
}

const SPORTS_CONFIG = BASE_SPORTS_CONFIG.map((item) => ({
    ...item,
    leagueTier: resolveLeagueTier(item)
}));

function normalizeSportToken(value) {
    const token = String(value || '').trim().toLowerCase();
    if (!token) return '';
    const aliases = {
        nfl: 'american_football',
        'american-football': 'american_football',
        motorsport: 'formula1',
        'formula-1': 'formula1',
        formula_1: 'formula1',
        basketball_nba: 'basketball',
        nba: 'basketball'
    };
    return aliases[token] || token;
}

function normalizeRequestedSports(input) {
    if (!input) return [];

    const values = Array.isArray(input) ? input : [input];
    return values
        .flatMap((value) => String(value || '').split(','))
        .map((value) => normalizeSportToken(value))
        .filter(Boolean);
}

function getSportsConfigForRequest(input) {
    const requestedSports = normalizeRequestedSports(input);
    if (!requestedSports.length) {
        return {
            configs: SPORTS_CONFIG,
            requestedSports: []
        };
    }

    const requestedSet = new Set(requestedSports);
    if (requestedSet.has('all')) {
        return {
            configs: SPORTS_CONFIG,
            requestedSports: ['all']
        };
    }

    return {
        configs: SPORTS_CONFIG.filter((item) => {
            const itemSport = normalizeSportToken(item.sport);
            return requestedSet.has(itemSport);
        }),
        requestedSports
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

    const { configs, requestedSports } = getSportsConfigForRequest(options.sports);
    const scopeLabel = requestedSports.length ? requestedSports.join(', ') : 'all sports';
    console.log(`[syncService] Starting sports data sync for REAL matches (${scopeLabel})...`);
    console.log(`[syncService] Using season config: SEASON_YEAR=${SEASON_YEAR}, SEASON_RANGE=${SEASON_RANGE}`);
    const telemetryRunId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    pipelineLogger.startRun({
        run_id: telemetryRunId,
        metadata: {
            scope: scopeLabel,
            requested_sports: requestedSports.length ? requestedSports : ['all'],
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
                    note: 'no_matching_sports_config'
                }
            });
            console.log('[syncService][pipeline_telemetry] %s', JSON.stringify(report, null, 2));
            return {
                requestedSports,
                totalMatchesProcessed: 0,
                rebuiltFinalOutputs: false,
                perSport: [],
                errors: []
            };
        }

        const prioritizedConfigs = configs
            .slice()
            .sort((a, b) => {
                const tierA = Number(a?.leagueTier || 9);
                const tierB = Number(b?.leagueTier || 9);
                if (tierA !== tierB) return tierA - tierB;
                const sportA = String(a?.sport || '');
                const sportB = String(b?.sport || '');
                if (sportA !== sportB) return sportA.localeCompare(sportB);
                return String(a?.leagueId || '').localeCompare(String(b?.leagueId || ''));
            });

        for (let index = 0; index < prioritizedConfigs.length; index += 1) {
            const item = prioritizedConfigs[index];
            try {
                console.log(`[syncService] Fetching REAL matches for: ${item.sport} (tier: ${item.leagueTier || 3}, league: ${item.leagueId || 'all'}, season: ${item.season})...`);

                const rawMatches = await buildLiveData({
                    ...item,
                    windowDays: DEFAULT_SYNC_WINDOW_DAYS
                });
                const rawMatchesList = Array.isArray(rawMatches) ? rawMatches : [];
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
                        if (!normalizationInput || !normalizationInput.match || !normalizationInput.odds) {
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
                        if (!hasAnySharpOdds(normalized)) {
                            pipelineLogger.rejectionAdd({
                                run_id: telemetryRunId,
                                sport: item.sport,
                                bucket: 'missing_odds',
                                metadata: { match_id: normalized?.match_info?.match_id || null }
                            });
                        }
                        if (!hasMeaningfulContext(normalized)) {
                            pipelineLogger.rejectionAdd({
                                run_id: telemetryRunId,
                                sport: item.sport,
                                bucket: 'missing_context',
                                metadata: { match_id: normalized?.match_info?.match_id || null }
                            });
                        }
                        // IRON-CLAD DATE PATCH: drop matches that are past the grace window.
                        if (!isMatchWithinGraceWindow(normalized)) {
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
                        normalizedMatches.push(normalized);
                    } catch (normalizeErr) {
                        console.warn('[syncService] Normalization failed for one match (%s): %s', item.sport, normalizeErr.message);
                    }
                }

                if (normalizedMatches.length > 0) {
                    await upsertCanonicalEvents(normalizedMatches);
                    console.log(`[syncService] Found ${normalizedMatches.length} REAL matches for ${item.sport}. Running AI Analysis...`);
                    const pipelineResult = await runPipelineForMatches({
                        matches: normalizedMatches,
                        telemetry: {
                            run_id: telemetryRunId,
                            sport: item.sport
                        }
                    });
                    if (pipelineResult?.error) {
                        const errorMsg = `${item.sport}: ${pipelineResult.error}`;
                        perSportErrors.set(item.sport, errorMsg);
                        console.warn(`[syncService] ${item.sport}: pipeline skipped (${pipelineResult.error})`);
                        if (!perSport.has(item.sport)) perSport.set(item.sport, 0);
                    } else {
                        const insertedCount = Array.isArray(pipelineResult?.inserted)
                            ? pipelineResult.inserted.length
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
                    if (!perSport.has(item.sport)) {
                        perSport.set(item.sport, 0);
                    }
                }
            } catch (sportErr) {
                const errorMsg = `${item.sport}: ${sportErr.message}`;
                console.error(`[syncService] ERROR processing ${item.sport}:`, sportErr.message);
                console.error(`[syncService] Stack trace:`, sportErr.stack);
                perSportErrors.set(item.sport, errorMsg);
                // Continue with next sport instead of failing completely
            } finally {
                if (index < prioritizedConfigs.length - 1 && SPORT_FETCH_STAGGER_MS > 0) {
                    console.log(`[syncService] Stagger delay ${SPORT_FETCH_STAGGER_MS}ms before next sport fetch...`);
                    await sleep(SPORT_FETCH_STAGGER_MS);
                }
            }
        }

        if (totalMatchesProcessed > 0) {
            console.log('[syncService] Sync successful. Rebuilding final outputs for the website...');
            // This moves the AI results into the 'direct1x2_prediction_final' table the website sees.
            const rebuild = await rebuildFinalOutputs({
                triggerSource: 'sync_service',
                requestedSports: requestedSports.length ? requestedSports : ['all'],
                telemetryRunId: telemetryRunId,
                metadata: {
                    totalMatchesProcessed,
                    perSport: Array.from(perSport.entries()).map(([sport, matchesProcessed]) => ({ sport, matchesProcessed })),
                    errors: Array.from(perSportErrors.entries()).map(([sport, error]) => ({ sport, error }))
                }
            });
            const report = pipelineLogger.finishRun({
                run_id: telemetryRunId,
                status: 'completed',
                metadata: {
                    total_matches_processed: totalMatchesProcessed,
                    per_sport: Array.from(perSport.entries()).map(([sport, matchesProcessed]) => ({ sport, matchesProcessed })),
                    errors: Array.from(perSportErrors.entries()).map(([sport, error]) => ({ sport, error })),
                    publish_run_id: rebuild?.publish_run?.id || null
                }
            });
            console.log('[syncService][pipeline_telemetry] %s', JSON.stringify(report, null, 2));
            console.log('[syncService] Master sync complete! Real data is now live.');
            console.log(`[syncService] Summary: ${totalMatchesProcessed} matches processed, ${perSport.size} sports covered`);
            return {
                requestedSports,
                totalMatchesProcessed,
                rebuiltFinalOutputs: true,
                perSport: Array.from(perSport.entries()).map(([sport, matchesProcessed]) => ({ sport, matchesProcessed })),
                errors: Array.from(perSportErrors.entries()).map(([sport, error]) => ({ sport, error })),
                publishRun: rebuild?.publish_run || null
            };
        } else {
            console.warn('[syncService] Sync finished but 0 real matches were found. Check your API Keys and season configuration.');
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
                errors: Array.from(perSportErrors.entries()).map(([sport, error]) => ({ sport, error }))
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
