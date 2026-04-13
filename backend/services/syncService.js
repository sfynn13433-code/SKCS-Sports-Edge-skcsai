'use strict';

const { runPipelineForMatches, rebuildFinalOutputs } = require('./aiPipeline');
const { buildLiveData } = require('./dataProvider');
const { upsertCanonicalEvents } = require('./canonicalEvents');
const { assertRapidApiCacheWallReady } = require('./dataProviders');
const { buildMatchContext } = require('./normalizerService');
const config = require('../config');

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
const SPORTS_CONFIG = [
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
];

function normalizeRequestedSports(input) {
    if (!input) return [];

    const values = Array.isArray(input) ? input : [input];
    return values
        .flatMap((value) => String(value || '').split(','))
        .map((value) => String(value || '').trim().toLowerCase())
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
    return {
        configs: SPORTS_CONFIG.filter((item) => requestedSet.has(String(item.sport || '').toLowerCase())),
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

    // FORCE REAL MODE: We ignore the 'test' config to ensure real data flows.
    try {
        let totalMatchesProcessed = 0;
        const perSport = new Map();
        const perSportErrors = new Map();

        if (!configs.length) {
            console.warn('[syncService] No matching sports configuration found for request:', requestedSports.join(', '));
            return {
                requestedSports,
                totalMatchesProcessed: 0,
                rebuiltFinalOutputs: false,
                perSport: [],
                errors: []
            };
        }

        for (const item of configs) {
            try {
                console.log(`[syncService] Fetching REAL matches for: ${item.sport} (league: ${item.leagueId || 'all'}, season: ${item.season})...`);

                const rawMatches = await buildLiveData(item);
                const normalizedMatches = [];
                for (const rawMatch of (Array.isArray(rawMatches) ? rawMatches : [])) {
                    try {
                        const normalizationInput = toNormalizationInput(rawMatch);
                        const normalized = buildMatchContext(normalizationInput);
                        if (!normalized) continue;
                        normalizedMatches.push(normalized);
                    } catch (normalizeErr) {
                        console.warn('[syncService] Normalization failed for one match (%s): %s', item.sport, normalizeErr.message);
                    }
                }

                if (normalizedMatches.length > 0) {
                    await upsertCanonicalEvents(normalizedMatches);
                    console.log(`[syncService] Found ${normalizedMatches.length} REAL matches for ${item.sport}. Running AI Analysis...`);
                    await runPipelineForMatches({ matches: normalizedMatches });
                    totalMatchesProcessed += normalizedMatches.length;
                    perSport.set(item.sport, (perSport.get(item.sport) || 0) + normalizedMatches.length);
                    console.log(`[syncService] ${item.sport}: pipeline complete for ${normalizedMatches.length} matches`);
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
            }
        }

        if (totalMatchesProcessed > 0) {
            console.log('[syncService] Sync successful. Rebuilding final outputs for the website...');
            // This moves the AI results into the 'predictions_final' table the website sees.
            const rebuild = await rebuildFinalOutputs({
                triggerSource: 'sync_service',
                requestedSports: requestedSports.length ? requestedSports : ['all'],
                metadata: {
                    totalMatchesProcessed,
                    perSport: Array.from(perSport.entries()).map(([sport, matchesProcessed]) => ({ sport, matchesProcessed })),
                    errors: Array.from(perSportErrors.entries()).map(([sport, error]) => ({ sport, error }))
                }
            });
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
