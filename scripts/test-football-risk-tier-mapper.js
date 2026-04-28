'use strict';

const { normalizeFootballRiskTier } = require('../backend/services/footballRiskTierMapper');

function assertEqual(actual, expected, label) {
    if (actual !== expected) {
        throw new Error(`[FAIL] ${label}: expected "${expected}", got "${actual}"`);
    }
    console.log(`[PASS] ${label}: ${actual}`);
}

function run() {
    assertEqual(
        normalizeFootballRiskTier('EXTREME_CAUTION'),
        'EXTREME_RISK',
        'EXTREME_CAUTION => EXTREME_RISK'
    );
    assertEqual(
        normalizeFootballRiskTier('MODERATE_HIGH_CAUTION'),
        'HIGH_RISK',
        'MODERATE_HIGH_CAUTION => HIGH_RISK'
    );
    assertEqual(
        normalizeFootballRiskTier('STRONG'),
        'HIGH_CONFIDENCE',
        'STRONG => HIGH_CONFIDENCE'
    );
    assertEqual(
        normalizeFootballRiskTier('HIGH_CONFIDENCE'),
        'HIGH_CONFIDENCE',
        'HIGH_CONFIDENCE passthrough'
    );
    assertEqual(
        normalizeFootballRiskTier('MODERATE_RISK'),
        'MODERATE_RISK',
        'MODERATE_RISK passthrough'
    );
    assertEqual(
        normalizeFootballRiskTier('unknown'),
        'HIGH_RISK',
        'unknown => HIGH_RISK default'
    );

    console.log('\nAll risk-tier mapper tests passed.');
}

run();
