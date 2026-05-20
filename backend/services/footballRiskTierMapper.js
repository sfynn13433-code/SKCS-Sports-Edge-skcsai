'use strict';

const LEGACY_TO_CANONICAL = Object.freeze({
    EXTREME_CAUTION: 'EXTREME_RISK',
    MODERATE_HIGH_CAUTION: 'HIGH_RISK',
    STRONG: 'LOW_RISK'
});

const PASSTHROUGH = new Set([
    'LOW_RISK',
    'MEDIUM_RISK',
    'HIGH_RISK',
    'EXTREME_RISK'
]);

function normalizeFootballRiskTier(label) {
    const normalized = String(label || '').trim().toUpperCase();

    if (LEGACY_TO_CANONICAL[normalized]) {
        return LEGACY_TO_CANONICAL[normalized];
    }

    if (PASSTHROUGH.has(normalized)) {
        return normalized;
    }

    console.warn(`[footballRiskTierMapper] Unknown risk tier "${label}", defaulting to HIGH_RISK`);
    return 'HIGH_RISK';
}

module.exports = {
    normalizeFootballRiskTier
};
