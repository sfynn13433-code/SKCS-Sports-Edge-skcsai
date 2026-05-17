'use strict';

const FOOTBALL_RULES = {
    confidenceBands: {
        highConfidence: { min: 75, label: 'HIGH_CONFIDENCE' },
        moderateRisk: { min: 55, max: 74, label: 'MODERATE_RISK' },
        highRisk: { min: 30, max: 54, label: 'HIGH_RISK' },
        extremeRisk: { max: 29, label: 'EXTREME_RISK' }
    },

    direct: {
        minConfidence: 45,
        strongConfidence: 80,
        moderateMin: 60,
        cautionMin: 45
    },

    secondary: {
        minConfidence: 75,
        maxItems: 4,
        diversityCaps: {
            goals: 2,
            cards: 1
        }
    },

    acca: {
        minLegConfidence: Number(process.env.ACCA_CONFIDENCE_MIN || 70),
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
