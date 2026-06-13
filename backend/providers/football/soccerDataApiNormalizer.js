'use strict';

function parseKickoffUtc(dateStr, timeStr) {
    const date = String(dateStr || '').trim();
    const time = String(timeStr || '').trim();
    if (!date) return null;

    const slash = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slash) {
        const [, dd, mm, yyyy] = slash;
        const isoDate = `${yyyy}-${mm}-${dd}`;
        const iso = time ? `${isoDate}T${time}:00.000Z` : `${isoDate}T00:00:00.000Z`;
        const ms = Date.parse(iso);
        return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
    }

    const ms = Date.parse(date);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function normalizeFixture(row = {}, context = {}) {
    const home = row.teams?.home?.name || row.home?.name || null;
    const away = row.teams?.away?.name || row.away?.name || null;
    const odds = row.odds?.match_winner || {};
    const matchId = row.id || row.match_id || null;

    return {
        match_id: matchId ? `sda-${matchId}` : null,
        sport: 'football',
        home_team: home,
        away_team: away,
        date: parseKickoffUtc(row.date, row.time),
        status: row.status || null,
        market: '1X2',
        prediction: null,
        confidence: null,
        volatility: null,
        odds: {
            home: odds.home ?? null,
            draw: odds.draw ?? null,
            away: odds.away ?? null
        },
        provider: 'soccer_data_api',
        provider_name: 'Soccer Data API',
        league: context.league_name || row.league?.name || null,
        country: context.country_name || row.country?.name || null,
        league_id: context.skcs_league_id || null,
        sda_league_id: context.sda_league_id || row.league_id || null,
        sda_match_id: matchId,
        raw_provider_data: row
    };
}

function normalizeMatchesPayload(payload) {
    const blocks = Array.isArray(payload) ? payload : [];
    const rows = [];

    for (const block of blocks) {
        const matches = Array.isArray(block.matches) ? block.matches : [];
        for (const match of matches) {
            rows.push(normalizeFixture(match, {
                league_name: block.league_name,
                country_name: block.country?.name,
                sda_league_id: block.league_id
            }));
        }
    }

    return rows;
}

function hasUsableOdds(row = {}) {
    const odds = row.odds || {};
    return [odds.home, odds.draw, odds.away].some((v) => Number.isFinite(Number(v)) && Number(v) > 1);
}

function passesSkcsFixtureGate(row = {}) {
    return Boolean(row.match_id && row.home_team && row.away_team && row.date);
}

module.exports = {
    normalizeFixture,
    normalizeMatchesPayload,
    hasUsableOdds,
    passesSkcsFixtureGate,
    parseKickoffUtc
};
