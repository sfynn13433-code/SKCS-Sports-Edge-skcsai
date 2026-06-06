'use strict';

/**
 * Maps SKCS sync league identifiers (TheSportsDB or API-Sports) → Big Balls Data football aliases.
 * @see https://bigballsdata.com/llms.txt
 */
const SKCS_TO_BBD_FOOTBALL = Object.freeze([
    { skcs_league_id: '4328', apisports_id: '39', competition: 'Premier League', bbd_alias: 'epl', tier: 1 },
    { skcs_league_id: '4335', apisports_id: '140', competition: 'La Liga', bbd_alias: 'laliga', tier: 1 },
    { skcs_league_id: '4331', apisports_id: '78', competition: 'Bundesliga', bbd_alias: 'bundesliga', tier: 1 },
    { skcs_league_id: '4332', apisports_id: '135', competition: 'Serie A', bbd_alias: 'serie-a', tier: 1 },
    { skcs_league_id: '4334', apisports_id: '61', competition: 'Ligue 1', bbd_alias: 'ligue-1', tier: 1 },
    { skcs_league_id: '3', apisports_id: '3', competition: 'UEFA Champions League', bbd_alias: 'cl', tier: 1 },
    { skcs_league_id: '253', apisports_id: '253', competition: 'MLS', bbd_alias: 'mls', tier: 1 }
]);

const BY_SKCS_ID = new Map(SKCS_TO_BBD_FOOTBALL.map((row) => [row.skcs_league_id, row]));
const BY_APISPORTS_ID = new Map(SKCS_TO_BBD_FOOTBALL.map((row) => [row.apisports_id, row]));

function resolveBigBallsFootballLeague(skcsLeagueId) {
    const id = String(skcsLeagueId || '').trim();
    if (!id) return null;
    return BY_SKCS_ID.get(id) || BY_APISPORTS_ID.get(id) || null;
}

function listMappedBigBallsFootballLeagues() {
    return SKCS_TO_BBD_FOOTBALL.slice();
}

module.exports = {
    SKCS_TO_BBD_FOOTBALL,
    listMappedBigBallsFootballLeagues,
    resolveBigBallsFootballLeague
};
