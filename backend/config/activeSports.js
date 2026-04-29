'use strict';

const DEFAULT_ACTIVE_SPORTS = Object.freeze([
    'football',
    'basketball',
    'rugby',
    'american_football',
    'baseball',
    'hockey',
    'volleyball',
    'handball',
    'afl',
    'formula1',
    'mma',
    'tennis',
    'cricket'
]);

function normalizeActiveSportToken(value) {
    const token = String(value || '').trim().toLowerCase();
    if (!token) return '';

    const aliases = {
        nfl: 'american_football',
        'american-football': 'american_football',
        'american football': 'american_football',
        motorsport: 'formula1',
        'formula-1': 'formula1',
        formula_1: 'formula1',
        basketball_nba: 'basketball',
        nba: 'basketball',
        hockey_nhl: 'hockey',
        nhl: 'hockey',
        soccer: 'football'
    };

    return aliases[token] || token;
}

function resolveActiveDeploymentSports() {
    const raw = String(process.env.ACTIVE_DEPLOYMENT_SPORTS || '').trim();
    if (!raw) {
        return new Set(DEFAULT_ACTIVE_SPORTS);
    }

    const parsed = raw
        .split(',')
        .map((token) => normalizeActiveSportToken(token))
        .filter(Boolean);

    if (!parsed.length) {
        return new Set(DEFAULT_ACTIVE_SPORTS);
    }

    return new Set(parsed);
}

module.exports = {
    DEFAULT_ACTIVE_SPORTS,
    normalizeActiveSportToken,
    resolveActiveDeploymentSports
};
