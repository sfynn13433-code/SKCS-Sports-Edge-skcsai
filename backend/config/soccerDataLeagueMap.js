'use strict';

/**
 * SKCS league identifiers → Soccer Data API league_id
 * @see https://soccerdataapi.com/docs/ (Premier League example league_id=228)
 */
const SKCS_TO_SOCCER_DATA = Object.freeze([
    { skcs_league_id: '4328', apisports_id: '39', competition: 'Premier League', sda_league_id: 228, country: 'england', country_id: 8, tier: 1 },
    { skcs_league_id: '4335', apisports_id: '140', competition: 'La Liga', sda_league_id: 297, country: 'spain', country_id: 60, tier: 1 },
    { skcs_league_id: '4331', apisports_id: '78', competition: 'Bundesliga', sda_league_id: 241, country: 'germany', country_id: 27, tier: 1 },
    { skcs_league_id: '4332', apisports_id: '135', competition: 'Serie A', sda_league_id: 253, country: 'italy', country_id: 6, tier: 1 },
    { skcs_league_id: '4334', apisports_id: '61', competition: 'Ligue 1', sda_league_id: 235, country: 'france', country_id: 9, tier: 1 },
    { skcs_league_id: '3', apisports_id: '3', competition: 'UEFA Champions League', sda_league_id: 310, country: 'europe', country_id: 4, tier: 1 },
    { skcs_league_id: '253', apisports_id: '253', competition: 'MLS', sda_league_id: 168, country: 'usa', country_id: 1, tier: 1 }
]);

const TIER1_COUNTRY_HINTS = Object.freeze([
    { country_name: 'england', skcs_league_id: '4328', competition: 'Premier League' },
    { country_name: 'spain', skcs_league_id: '4335', competition: 'La Liga' },
    { country_name: 'germany', skcs_league_id: '4331', competition: 'Bundesliga' },
    { country_name: 'italy', skcs_league_id: '4332', competition: 'Serie A' },
    { country_name: 'france', skcs_league_id: '4334', competition: 'Ligue 1' }
]);

/** European top-flight SDA ids — do not probe /matches/ in May–Aug (season ended). */
const EUROPEAN_OFFSEASON_SDA_LEAGUE_IDS = Object.freeze(new Set([
    228, 297, 241, 253, 235, 310
]));

/**
 * Summer / in-season probe target for fixture + match-detail health checks.
 * Override with SOCCER_DATA_FIXTURE_PROBE_LEAGUE_ID.
 */
const FIXTURE_PROBE_LEAGUE = Object.freeze({
    skcs_league_id: '253',
    competition: 'MLS',
    sda_league_id: 168,
    country: 'usa',
    country_id: 1,
    note: 'Use for fixture probes while European top leagues are off-season'
});

function isEuropeanOffseasonLeague(sdaLeagueId) {
    const id = Number(sdaLeagueId);
    return Number.isFinite(id) && EUROPEAN_OFFSEASON_SDA_LEAGUE_IDS.has(id);
}

function resolveFixtureProbeLeague() {
    const override = Number(process.env.SOCCER_DATA_FIXTURE_PROBE_LEAGUE_ID);
    if (Number.isFinite(override) && override > 0) {
        const mapped = SKCS_TO_SOCCER_DATA.find((row) => row.sda_league_id === override) || null;
        return {
            skcs_league_id: mapped?.skcs_league_id || null,
            competition: mapped?.competition || `league_${override}`,
            sda_league_id: override,
            country: mapped?.country || null,
            country_id: mapped?.country_id || null,
            note: 'env_override'
        };
    }
    return { ...FIXTURE_PROBE_LEAGUE };
}

function resolveSoccerDataLeague(skcsLeagueId) {
    const id = String(skcsLeagueId || '').trim();
    if (!id) return null;
    return SKCS_TO_SOCCER_DATA.find((row) => row.skcs_league_id === id || row.apisports_id === id) || null;
}

function listTier1SoccerDataTargets() {
    return SKCS_TO_SOCCER_DATA.slice();
}

module.exports = {
    SKCS_TO_SOCCER_DATA,
    TIER1_COUNTRY_HINTS,
    EUROPEAN_OFFSEASON_SDA_LEAGUE_IDS,
    FIXTURE_PROBE_LEAGUE,
    listTier1SoccerDataTargets,
    resolveSoccerDataLeague,
    isEuropeanOffseasonLeague,
    resolveFixtureProbeLeague
};
