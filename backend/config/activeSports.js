'use strict';

const DEFAULT_ACTIVE_SPORTS = Object.freeze([
    'football',
    'basketball',
    'Rugby',
    'NFL',
    'MLB',
    'NHL',
    'Volleyball',
    'Handball',
    'AFL',
    'F1',
    'MMA',
    'Golf',
    'Boxing',
    'tennis',
    'cricket',
    'esports'
]);

function normalizeActiveSportToken(value) {
    const token = String(value || '').trim().toLowerCase();
    if (!token) return '';

    const aliases = {
        nfl: 'NFL',
        american_football: 'NFL',
        'american-football': 'NFL',
        'american football': 'NFL',
        mlb: 'MLB',
        baseball: 'MLB',
        nhl: 'NHL',
        hockey: 'NHL',
        f1: 'F1',
        formula1: 'F1',
        'formula-1': 'F1',
        formula_1: 'F1',
        mma: 'MMA',
        afl: 'AFL',
        volleyball: 'Volleyball',
        handball: 'Handball',
        golf: 'Golf',
        rugby: 'Rugby',
        boxing: 'Boxing',
        soccer: 'football',
        nba: 'basketball'
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
