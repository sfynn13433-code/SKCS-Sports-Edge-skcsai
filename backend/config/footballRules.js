'use strict';

const FOOTBALL_RULES = {
    confidenceBands: {
        lowRisk: { min: 75, label: 'LOW_RISK' },
        mediumRisk: { min: 55, max: 74, label: 'MEDIUM_RISK' },
        highRisk: { min: 30, max: 54, label: 'HIGH_RISK' },
        extremeRisk: { max: 29, label: 'EXTREME_RISK' }
    },

    direct: {
        minConfidence: 30,
        strongConfidence: 75,
        moderateMin: 55,
        cautionMin: 30
    },

    secondary: {
        minConfidence: 72,
        maxItems: 4,
        diversityCaps: {
            goals: 2,
            cards: 1
        }
    },

    acca: {
        minLegConfidence: Number(process.env.ACCA_CONFIDENCE_MIN || 75),
        minAllowedConfidence: 45,
        maxAllowedConfidence: 99,
        defaultSixLegs: 6,
        defaultMegaLegs: 12,
        allowHighVolatility: false
    },

    volatility: {
        extremeThreshold: 0.7
    },

    timing: {
        staleGraceMinutes: 15,
        staleRejectHours: 2
    }
};

module.exports = { FOOTBALL_RULES };
