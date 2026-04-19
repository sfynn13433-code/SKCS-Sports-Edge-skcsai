'use strict';

// Allowed markets (explicitly excludes red cards and full-match over_0_5).
const ALLOWED_MARKETS = Object.freeze([
    { market: 'double_chance_1x', category: 'double_chance' },
    { market: 'double_chance_x2', category: 'double_chance' },
    { market: 'double_chance_12', category: 'double_chance' },
    { market: 'draw_no_bet_home', category: 'dnb' },
    { market: 'draw_no_bet_away', category: 'dnb' },
    { market: 'over_1_5', category: 'goals' },
    { market: 'over_2_5', category: 'goals' },
    { market: 'over_3_5', category: 'goals' },
    { market: 'over_4_5', category: 'goals' },
    { market: 'over_5_5', category: 'goals' },
    { market: 'under_2_5', category: 'goals' },
    { market: 'under_3_5', category: 'goals' },
    { market: 'under_4_5', category: 'goals' },
    { market: 'home_over_0_5', category: 'team_goals' },
    { market: 'home_over_1_5', category: 'team_goals' },
    { market: 'away_over_0_5', category: 'team_goals' },
    { market: 'away_over_1_5', category: 'team_goals' },
    { market: 'btts_yes', category: 'btts' },
    { market: 'btts_no', category: 'btts' },
    { market: 'btts_and_over_2_5', category: 'btts' },
    { market: 'btts_and_under_3_5', category: 'btts' },
    { market: 'corners_over_6_5', category: 'corners' },
    { market: 'corners_over_7_5', category: 'corners' },
    { market: 'corners_over_8_5', category: 'corners' },
    { market: 'corners_over_9_5', category: 'corners' },
    { market: 'corners_over_10_5', category: 'corners' },
    { market: 'corners_under_6_5', category: 'corners' },
    { market: 'yellow_cards_over_1_5', category: 'cards' },
    { market: 'yellow_cards_over_2_5', category: 'cards' },
    { market: 'first_half_over_0_5', category: 'half' },
    { market: 'first_half_under_1_5', category: 'half' },
    { market: 'first_half_draw', category: 'half' },
    { market: 'ultra_over_1_5', category: 'ultra' },
    { market: 'ultra_under_4_5', category: 'ultra' },
    { market: 'ultra_home_over_0_5', category: 'ultra' },
    { market: 'ultra_away_over_0_5', category: 'ultra'
    }
]);

const DESCRIPTION_MAP = Object.freeze({
    double_chance_1x: 'Covers home selection or draw.',
    double_chance_x2: 'Covers away selection or draw.',
    double_chance_12: 'Covers either side winning in regulation.',
    draw_no_bet_home: 'Home side only, with draw protection.',
    draw_no_bet_away: 'Away side only, with draw protection.',
    over_1_5: 'Lower total-goals threshold for stability.',
    over_2_5: 'Balanced total-goals line with stronger upside.',
    under_3_5: 'Useful when match tempo projects controlled scoring.',
    btts_yes: 'Supports both sides contributing at least one goal.',
    btts_no: 'Supports one side likely staying scoreless.',
    corners_over_8_5: 'Targets sustained attacking pressure profile.',
    yellow_cards_over_2_5: 'Matches typically physical matchup profile.',
    first_half_draw: 'Early phase expected to remain compact.',
    ultra_over_1_5: 'Ultra-safe total-goals profile.',
    ultra_under_4_5: 'Ultra-safe cap for high-volatility fixtures.',
    ultra_home_over_0_5: 'Ultra-safe home scoring floor.',
    ultra_away_over_0_5: 'Ultra-safe away scoring floor.'
});

function normalizePrediction(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
}

function parseVolatility(value) {
    const text = String(value || '').trim().toLowerCase();
    if (text.includes('low')) return 'low';
    if (text.includes('high')) return 'high';
    return 'medium';
}

function marketBoostForDirectOutcome(market, directOutcome) {
    if (!directOutcome) return 0;
    if (directOutcome === 'home_win') {
        if (market === 'double_chance_1x' || market === 'draw_no_bet_home' || market === 'home_over_0_5' || market === 'ultra_home_over_0_5') return 6;
    }
    if (directOutcome === 'away_win') {
        if (market === 'double_chance_x2' || market === 'draw_no_bet_away' || market === 'away_over_0_5' || market === 'ultra_away_over_0_5') return 6;
    }
    if (directOutcome === 'draw') {
        if (market === 'first_half_draw' || market === 'double_chance_1x' || market === 'double_chance_x2' || market === 'under_3_5') return 5;
    }
    return 0;
}

function confidenceForMarket(marketDef, fixture, seed = 0) {
    const directOutcome = normalizePrediction(
        fixture?.prediction || fixture?.recommendation || fixture?.pick || fixture?.outcome
    );
    const volatility = parseVolatility(fixture?.volatility);

    let confidence = 76;
    confidence += marketBoostForDirectOutcome(marketDef.market, directOutcome);

    if (volatility === 'low') confidence += 3;
    if (volatility === 'medium') confidence += 1;
    if (volatility === 'high') confidence -= 2;

    if (marketDef.category === 'ultra') confidence += 3;
    if (marketDef.category === 'double_chance') confidence += 2;

    const stableNoise = (seed % 5) - 2; // deterministic range -2..2
    confidence += stableNoise;

    return Math.max(76, Math.min(92, Math.round(confidence)));
}

function marketLabel(market) {
    const map = {
        double_chance_1x: 'DOUBLE CHANCE - 1X',
        double_chance_x2: 'DOUBLE CHANCE - X2',
        double_chance_12: 'DOUBLE CHANCE - 12',
        draw_no_bet_home: 'DRAW NO SELECTION - HOME',
        draw_no_bet_away: 'DRAW NO SELECTION - AWAY',
        over_1_5: 'OVER 1.5 GOALS',
        over_2_5: 'OVER 2.5 GOALS',
        under_2_5: 'UNDER 2.5 GOALS',
        under_3_5: 'UNDER 3.5 GOALS',
        btts_yes: 'BTTS - YES',
        btts_no: 'BTTS - NO',
        corners_over_8_5: 'OVER 8.5 CORNERS',
        first_half_draw: 'FIRST HALF - DRAW'
    };
    return map[market] || market.replace(/_/g, ' ').toUpperCase();
}

function stableFixtureSeed(fixture) {
    const source = String(
        fixture?.id
        || fixture?.fixture_id
        || `${fixture?.home_team || ''}_${fixture?.away_team || ''}_${fixture?.match_date || fixture?.date || ''}`
    );
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
        hash = ((hash << 5) - hash) + source.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

/**
 * Select up to 4 secondary markets for lower-confidence direct 1X2 fixtures.
 * @param {object} fixture
 * @returns {Array<{market: string, confidence: number, prediction: string, description: string}>}
 */
function selectSecondaryMarkets(fixture) {
    const seed = stableFixtureSeed(fixture);
    const candidates = ALLOWED_MARKETS.map((marketDef, idx) => {
        const confidence = confidenceForMarket(marketDef, fixture, seed + idx);
        return {
            market: marketDef.market,
            confidence,
            prediction: marketLabel(marketDef.market),
            description: DESCRIPTION_MAP[marketDef.market] || ''
        };
    }).filter((candidate) => candidate.confidence >= 76);

    candidates.sort((a, b) => b.confidence - a.confidence || a.market.localeCompare(b.market));
    return candidates.slice(0, 4);
}

module.exports = {
    ALLOWED_MARKETS,
    selectSecondaryMarkets
};
