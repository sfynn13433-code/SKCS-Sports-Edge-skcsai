'use strict';

const FOOTBALL_RULES = {
    confidenceBands: {
        highConfidence: { min: 80, label: 'HIGH_CONFIDENCE' },
        moderateRisk: { min: 70, max: 79, label: 'MODERATE_RISK' },
        highRisk: { min: 59, max: 69, label: 'HIGH_RISK' },
        extremeRisk: { max: 58, label: 'EXTREME_RISK' }
    },

    direct: {
        minConfidence: 45,
        strongConfidence: 80,
        moderateMin: 60,
        cautionMin: 45
    },

    secondary: {
        minConfidence: 76,
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
