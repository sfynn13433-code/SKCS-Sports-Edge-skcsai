'use strict';

const KNOWN_MARKETS = new Set([
    '1X2',
    'home_win',
    'away_win',
    'draw',
    'double_chance',
    'double_chance_1x',
    'double_chance_x2',
    'double_chance_12',
    'match_result',
    'over_0_5',
    'over_1_5',
    'over_2_5',
    'over_3_5',
    'over_4_5',
    'under_0_5',
    'under_1_5',
    'under_2_5',
    'under_3_5',
    'under_4_5',
    'home_over_0_5',
    'away_over_0_5',
    'home_over_1_5',
    'away_over_1_5',
    'btts_yes',
    'btts_no',
    'btts_over_2_5',
    'btts_under_3_5',
    'home_win_btts_yes',
    'away_win_btts_yes',
    'home_win_btts_no',
    'away_win_btts_no',
    'draw_no_bet_home',
    'draw_no_bet_away',
    'home_win_under_4_5',
    'away_win_under_4_5',
    'home_win_over_1_5',
    'away_win_over_1_5',
    'double_chance_over_1_5',
    'double_chance_under_3_5',
    'over_0_5_first_half',
    'under_1_5_first_half',
    'first_half_draw',
    'home_win_either_half',
    'away_win_either_half',
    'win_either_half',
    'team_to_score_first_home',
    'team_to_score_first_away',
    'ht_draw',
    'ht_ft',
    'corners_over_7_5',
    'corners_over_8_5',
    'corners_over_9_5',
    'corners_over_10_5',
    'corners_under_10_5',
    'corners_under_11_5',
    'red_cards_under_0_5',
    'red_cards_under_1_5',
    'yellow_cards_over_2_5',
    'yellow_cards_over_3_5',
    'yellow_cards_over_4_5',
    'penalty_yes',
    'penalty_no'
]);

const KNOWN_SPORTS = new Set([
    'football', 'tennis', 'basketball', 'cricket', 'esports',
    'NFL', 'MLB', 'MMA', 'F1', 'Golf', 'Rugby', 'Boxing',
    'NHL', 'AFL', 'Volleyball', 'Handball', 'darts'
]);

const KNOWN_VOLATILITY = new Set(['low', 'medium', 'high']);

function assert(condition, message) {
    if (!condition) {
        const err = new Error(message);
        err.name = 'ValidationError';
        throw err;
    }
}

function validateSport(sport) {
    assert(typeof sport === 'string' && sport.trim().length > 0, 'sport must be a non-empty string');
    assert(KNOWN_SPORTS.has(sport), `sport is not known: ${sport}`);
}

function validateConfidence(confidence) {
    assert(typeof confidence === 'number' && !Number.isNaN(confidence), 'confidence must be a number');
    assert(confidence >= 0 && confidence <= 100, 'confidence must be between 0 and 100');
}

function validateMarket(market) {
    assert(typeof market === 'string' && market.length > 0, 'market must be a non-empty string');
    assert(KNOWN_MARKETS.has(market), `market is not known: ${market}`);
}

function validateVolatility(volatility) {
    assert(typeof volatility === 'string' && volatility.length > 0, 'volatility must be a non-empty string');
    assert(KNOWN_VOLATILITY.has(volatility), `volatility is not valid: ${volatility}`);
}

function validateMatchId(matchId) {
    assert(typeof matchId === 'string' && matchId.trim().length > 0, 'match_id must be a non-empty string');
}

function validateRawPredictionInput(pred) {
    assert(pred && typeof pred === 'object', 'prediction must be an object');

    validateMatchId(pred.match_id);
    validateSport(pred.sport);
    validateMarket(pred.market);

    assert(typeof pred.prediction === 'string' && pred.prediction.trim().length > 0, 'prediction must be a non-empty string');
    validateConfidence(pred.confidence);
    validateVolatility(pred.volatility);

    if (pred.odds !== null && pred.odds !== undefined) {
        assert(typeof pred.odds === 'number' && !Number.isNaN(pred.odds), 'odds must be a number when provided');
        assert(pred.odds > 0, 'odds must be > 0');
    }

    if (pred.metadata !== null && pred.metadata !== undefined) {
        assert(typeof pred.metadata === 'object', 'metadata must be an object when provided');
    }
}

function validateRawPredictionForInsert(row) {
    validateRawPredictionInput({
        match_id: row.match_id,
        sport: row.sport,
        market: row.market,
        prediction: row.prediction,
        confidence: row.confidence,
        volatility: row.volatility,
        odds: row.odds,
        metadata: row.metadata
    });
}

module.exports = {
    KNOWN_MARKETS,
    KNOWN_VOLATILITY,
    validateConfidence,
    validateMarket,
    validateVolatility,
    validateMatchId,
    validateRawPredictionInput,
    validateRawPredictionForInsert
};
