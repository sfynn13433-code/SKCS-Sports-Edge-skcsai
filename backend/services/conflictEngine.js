'use strict';

function normalizeMarket(market) {
    return String(market || '').trim().toUpperCase();
}

function normalizePick(pick) {
    return String(pick || '').trim().toLowerCase();
}

/**
 * CONFLICT_MATRIX defines which picks are incompatible for the same match.
 * Structure: { market: { pick: [incompatible_picks_in_other_markets] } }
 */
const CONFLICT_MATRIX = {
    '1X2': {
        'home_win': [
            { market: '1X2', pick: 'away_win' },
            { market: '1X2', pick: 'draw' },
            { market: 'DOUBLE_CHANCE', pick: 'draw_or_away' },
            { market: 'OVER_UNDER_0_5', pick: 'under' },
            { market: 'CLEAN_SHEET_AWAY', pick: 'yes' }
        ],
        'away_win': [
            { market: '1X2', pick: 'home_win' },
            { market: '1X2', pick: 'draw' },
            { market: 'DOUBLE_CHANCE', pick: 'home_or_draw' },
            { market: 'OVER_UNDER_0_5', pick: 'under' },
            { market: 'CLEAN_SHEET_HOME', pick: 'yes' }
        ],
        'draw': [
            { market: '1X2', pick: 'home_win' },
            { market: '1X2', pick: 'away_win' },
            { market: 'DOUBLE_CHANCE', pick: 'home_or_away' }
        ]
    },
    'DOUBLE_CHANCE': {
        'home_or_draw': [
            { market: '1X2', pick: 'away_win' }
        ],
        'draw_or_away': [
            { market: '1X2', pick: 'home_win' }
        ],
        'home_or_away': [
            { market: '1X2', pick: 'draw' }
        ]
    },
    'OVER_UNDER_2_5': {
        'over': [
            { market: 'OVER_UNDER_2_5', pick: 'under' },
            { market: 'OVER_UNDER_1_5', pick: 'under' },
            { market: 'OVER_UNDER_0_5', pick: 'under' },
            { market: 'BTTS', pick: 'no' } // SOFT CONFLICT: Volatility Trap
        ],
        'under': [
            { market: 'OVER_UNDER_2_5', pick: 'over' },
            { market: 'BTTS', pick: 'yes' } // Paradox: BTTS requires at least 1-1 (2 goals)
        ]
    },
    'OVER_UNDER_1_5': {
        'under': [
            { market: 'OVER_UNDER_1_5', pick: 'over' },
            { market: 'OVER_UNDER_2_5', pick: 'over' },
            { market: 'BTTS', pick: 'yes' } // Paradox: BTTS requires at least 2 goals
        ],
        'over': [
            { market: 'OVER_UNDER_1_5', pick: 'under' },
            { market: 'OVER_UNDER_0_5', pick: 'under' }
        ]
    },
    'OVER_UNDER_0_5': {
        'under': [
            { market: 'OVER_UNDER_0_5', pick: 'over' },
            { market: 'OVER_UNDER_1_5', pick: 'over' },
            { market: 'OVER_UNDER_2_5', pick: 'over' },
            { market: 'BTTS', pick: 'yes' },
            { market: '1X2', pick: 'home_win' },
            { market: '1X2', pick: 'away_win' }
        ],
        'over': [
            { market: 'OVER_UNDER_0_5', pick: 'under' }
        ]
    },
    'BTTS': {
        'yes': [
            { market: 'BTTS', pick: 'no' },
            { market: 'OVER_UNDER_1_5', pick: 'under' },
            { market: 'OVER_UNDER_0_5', pick: 'under' },
            { market: 'CLEAN_SHEET_HOME', pick: 'yes' },
            { market: 'CLEAN_SHEET_AWAY', pick: 'yes' }
        ],
        'no': [
            { market: 'BTTS', pick: 'yes' },
            { market: 'OVER_UNDER_2_5', pick: 'over' } // SOFT CONFLICT: Volatility Trap
        ]
    },
    'CLEAN_SHEET_HOME': {
        'yes': [
            { market: '1X2', pick: 'away_win' },
            { market: 'BTTS', pick: 'yes' }
        ]
    },
    'CLEAN_SHEET_AWAY': {
        'yes': [
            { market: '1X2', pick: 'home_win' },
            { market: 'BTTS', pick: 'yes' }
        ]
    }
};

function isOverUnderMarket(market) {
    return /^OVER_UNDER_\d+_?\d*$/.test(market) || /^TOTAL_(GOALS|POINTS|RUNS|GAMES|POINTS)$/.test(market);
}

function isValidCombination(legs) {
    if (!Array.isArray(legs) || legs.length === 0) return false;

    const seenMarket = new Set();
    const marketToPick = new Map();

    for (const leg of legs) {
        const market = normalizeMarket(leg?.market);
        const pick = normalizePick(leg?.prediction || leg?.pick);

        if (!market || !pick) return false;

        // Same market duplicated
        if (seenMarket.has(market)) return false;
        seenMarket.add(market);

        // Check against conflict matrix
        if (CONFLICT_MATRIX[market] && CONFLICT_MATRIX[market][pick]) {
            const conflicts = CONFLICT_MATRIX[market][pick];
            for (const conflict of conflicts) {
                if (marketToPick.has(conflict.market) && marketToPick.get(conflict.market) === conflict.pick) {
                    return false;
                }
            }
        }

        // Check if other existing picks conflict with THIS new pick
        for (const [existingMarket, existingPick] of marketToPick.entries()) {
            if (CONFLICT_MATRIX[existingMarket] && CONFLICT_MATRIX[existingMarket][existingPick]) {
                const conflicts = CONFLICT_MATRIX[existingMarket][existingPick];
                for (const conflict of conflicts) {
                    if (conflict.market === market && conflict.pick === pick) {
                        return false;
                    }
                }
            }
        }

        marketToPick.set(market, pick);
    }

    return true;
}

module.exports = {
    isValidCombination
};
