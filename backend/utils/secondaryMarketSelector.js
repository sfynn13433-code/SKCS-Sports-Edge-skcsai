'use strict';

const { FOOTBALL_RULES } = require('../config/footballRules');

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
    { market: 'ultra_away_over_0_5', category: 'ultra' }
]);

const GOAL_HEAVY_CATEGORIES = new Set(['goals', 'team_goals', 'ultra']);
const SECONDARY_THRESHOLD = FOOTBALL_RULES.secondary.minConfidence;
const DIVERSITY_LIMITS = Object.freeze({ ...FOOTBALL_RULES.secondary.diversityCaps });

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function asNumber(value, fallback = NaN) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function normalizePercent(value) {
    const n = asNumber(value, NaN);
    if (!Number.isFinite(n)) return null;
    if (n > 0 && n <= 1) return clamp(n * 100, 0, 100);
    return clamp(n, 0, 100);
}

function normalizeRate(value, fallback) {
    const pct = normalizePercent(value);
    if (pct === null) return fallback;
    return pct / 100;
}

function normalizeBaseline(rawBaseline) {
    const baseline = rawBaseline && typeof rawBaseline === 'object' ? rawBaseline : {};
    let home = normalizePercent(baseline.home);
    let draw = normalizePercent(baseline.draw);
    let away = normalizePercent(baseline.away);
    if (home === null || draw === null || away === null) {
        home = 40;
        draw = 30;
        away = 30;
    }
    const sum = home + draw + away;
    if (sum <= 0) return { home: 40, draw: 30, away: 30 };
    const scaled = {
        home: Math.round((home / sum) * 100),
        draw: Math.round((draw / sum) * 100),
        away: 0
    };
    scaled.away = Math.max(0, 100 - scaled.home - scaled.draw);
    return scaled;
}

function parseVolatility(value) {
    const token = String(value || '').trim().toLowerCase();
    if (token.includes('high')) return 'high';
    if (token.includes('low')) return 'low';
    return 'medium';
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

function marketLabel(market) {
    const map = {
        double_chance_1x: 'DOUBLE CHANCE - 1X',
        double_chance_x2: 'DOUBLE CHANCE - X2',
        double_chance_12: 'DOUBLE CHANCE - 12',
        draw_no_bet_home: 'DRAW NO SELECTION - HOME',
        draw_no_bet_away: 'DRAW NO SELECTION - AWAY',
        over_1_5: 'OVER 1.5 GOALS',
        over_2_5: 'OVER 2.5 GOALS',
        over_3_5: 'OVER 3.5 GOALS',
        over_4_5: 'OVER 4.5 GOALS',
        over_5_5: 'OVER 5.5 GOALS',
        under_2_5: 'UNDER 2.5 GOALS',
        under_3_5: 'UNDER 3.5 GOALS',
        under_4_5: 'UNDER 4.5 GOALS',
        home_over_0_5: 'HOME OVER 0.5 GOALS',
        home_over_1_5: 'HOME OVER 1.5 GOALS',
        away_over_0_5: 'AWAY OVER 0.5 GOALS',
        away_over_1_5: 'AWAY OVER 1.5 GOALS',
        btts_yes: 'BTTS - YES',
        btts_no: 'BTTS - NO',
        btts_and_over_2_5: 'BTTS + OVER 2.5',
        btts_and_under_3_5: 'BTTS + UNDER 3.5',
        first_half_over_0_5: 'FIRST HALF OVER 0.5',
        first_half_under_1_5: 'FIRST HALF UNDER 1.5',
        first_half_draw: 'FIRST HALF - DRAW',
        ultra_over_1_5: 'ULTRA OVER 1.5 GOALS',
        ultra_under_4_5: 'ULTRA UNDER 4.5 GOALS',
        ultra_home_over_0_5: 'ULTRA HOME OVER 0.5',
        ultra_away_over_0_5: 'ULTRA AWAY OVER 0.5'
    };
    return map[market] || market.replace(/_/g, ' ').toUpperCase();
}

function buildDescription(market, context) {
    const { avgGoals, bttsRate, baseline } = context;
    const homeDraw = Math.round(baseline.home + baseline.draw);
    const drawAway = Math.round(baseline.draw + baseline.away);
    const bttsPct = Math.round(bttsRate * 100);
    const goalsRounded = avgGoals.toFixed(2);

    const map = {
        double_chance_1x: `Home or draw cover aligned with ${homeDraw}% combined baseline.`,
        double_chance_x2: `Away or draw cover aligned with ${drawAway}% combined baseline.`,
        draw_no_bet_home: 'Home draw-no-selection hedge reduces variance on level results.',
        draw_no_bet_away: 'Away draw-no-selection hedge reduces variance on level results.',
        over_1_5: `League goals profile (${goalsRounded}) supports lower totals line.`,
        over_2_5: `Average goals (${goalsRounded}) indicates room for 3+ total goals.`,
        under_2_5: `Totals control profile from league average (${goalsRounded}).`,
        under_3_5: `Lower-volatility totals read from goals average (${goalsRounded}).`,
        btts_yes: `League BTTS trend projects around ${bttsPct}% hit rate.`,
        btts_no: `Inverse BTTS profile indicates one side may stay scoreless.`,
        btts_and_over_2_5: `BTTS (${bttsPct}%) and total-goals profile combined.`,
        btts_and_under_3_5: `BTTS profile with tighter scoring cap for controlled tempo.`,
        yellow_cards_over_1_5: 'Card line kept conservative for discipline variability.',
        yellow_cards_over_2_5: 'Card line selected when volatility supports disruptions.',
        first_half_draw: 'Opening-half parity favored by baseline equilibrium.'
    };
    return map[market] || '';
}

function getLineValue(market) {
    const match = String(market || '').match(/_(\d+)_(\d+)$/);
    if (!match) return null;
    return Number(`${match[1]}.${match[2]}`);
}

function scoreOverMarket(line, avgGoals) {
    // Required formula baseline from instruction:
    // Over 1.5 confidence = league avg goals per game * 20 (capped at 95).
    if (line === 1.5) return clamp(avgGoals * 20, 45, 95);
    return clamp((avgGoals * 18) - ((line - 1.5) * 14), 30, 93);
}

function scoreUnderMarket(line, avgGoals) {
    return clamp(((line + 1.8 - avgGoals) * 18) + 50, 25, 94);
}

function confidenceForMarket(definition, context, seedAdjust) {
    const { baseline, avgGoals, bttsRate, volatility } = context;
    const bttsPct = bttsRate * 100;
    let confidence = 60;

    switch (definition.market) {
    case 'double_chance_1x':
        confidence = baseline.home + baseline.draw; // required shape
        break;
    case 'double_chance_x2':
        confidence = baseline.away + baseline.draw;
        break;
    case 'double_chance_12':
        confidence = baseline.home + baseline.away;
        break;
    case 'draw_no_bet_home':
        confidence = baseline.home + (baseline.draw * 0.3);
        break;
    case 'draw_no_bet_away':
        confidence = baseline.away + (baseline.draw * 0.3);
        break;
    case 'btts_yes':
        confidence = bttsPct; // required shape
        break;
    case 'btts_no':
        confidence = 100 - bttsPct;
        break;
    case 'btts_and_over_2_5':
        confidence = Math.min(bttsPct, scoreOverMarket(2.5, avgGoals));
        break;
    case 'btts_and_under_3_5':
        confidence = Math.min(bttsPct, scoreUnderMarket(3.5, avgGoals));
        break;
    case 'yellow_cards_over_1_5':
        confidence = volatility === 'high' ? 80 : (volatility === 'medium' ? 74 : 68);
        break;
    case 'yellow_cards_over_2_5':
        confidence = volatility === 'high' ? 77 : (volatility === 'medium' ? 71 : 64);
        break;
    case 'first_half_over_0_5':
        confidence = clamp((avgGoals * 14) + 32, 45, 90);
        break;
    case 'first_half_under_1_5':
        confidence = clamp((2.6 - (avgGoals / 2.7)) * 30 + 52, 35, 88);
        break;
    case 'first_half_draw':
        confidence = clamp(baseline.draw + 18, 40, 89);
        break;
    case 'ultra_over_1_5':
        confidence = clamp(scoreOverMarket(1.5, avgGoals) + 4, 55, 95);
        break;
    case 'ultra_under_4_5':
        confidence = clamp(scoreUnderMarket(4.5, avgGoals) + 5, 55, 95);
        break;
    case 'ultra_home_over_0_5':
        confidence = clamp(baseline.home + 28, 52, 95);
        break;
    case 'ultra_away_over_0_5':
        confidence = clamp(baseline.away + 28, 52, 95);
        break;
    default:
        if (definition.market.startsWith('over_')) {
            const line = getLineValue(definition.market);
            confidence = scoreOverMarket(line || 2.5, avgGoals);
        } else if (definition.market.startsWith('under_')) {
            const line = getLineValue(definition.market);
            confidence = scoreUnderMarket(line || 2.5, avgGoals);
        } else if (definition.market.startsWith('home_over_')) {
            const line = getLineValue(definition.market) || 0.5;
            confidence = clamp((baseline.home * 0.85) + scoreOverMarket(line, avgGoals) * 0.25, 35, 93);
        } else if (definition.market.startsWith('away_over_')) {
            const line = getLineValue(definition.market) || 0.5;
            confidence = clamp((baseline.away * 0.85) + scoreOverMarket(line, avgGoals) * 0.25, 35, 93);
        } else if (definition.market.startsWith('corners_')) {
            confidence = clamp((avgGoals * 7.5) + 48, 40, 86);
        }
        break;
    }

    if (definition.category === 'ultra') confidence += 3;
    if (volatility === 'high' && definition.category === 'cards') confidence += 3;
    if (volatility === 'high' && GOAL_HEAVY_CATEGORIES.has(definition.category)) confidence -= 4;
    if (volatility === 'low' && GOAL_HEAVY_CATEGORIES.has(definition.category)) confidence += 2;

    confidence += seedAdjust;
    return Math.round(clamp(confidence, 0, 95));
}

function buildContext(fixture, options) {
    const baseline = normalizeBaseline(options?.baseline || fixture?.baseline) || { home: 40, draw: 30, away: 30 };
    const stats = options?.leagueStats || fixture?.league_stats || fixture?.leagueStats || {};

    const avgGoals = asNumber(
        stats.avg_goals_per_game
        ?? stats.goals_per_game
        ?? stats.avg_goals
        ?? stats.league_avg_goals
        ?? stats.avg_total_goals,
        2.35
    );
    const bttsRate = normalizeRate(
        stats.btts_rate
        ?? stats.btts_yes_rate
        ?? stats.btts_pct
        ?? stats.both_teams_score_rate,
        clamp((avgGoals - 1.4) / 2.4, 0.35, 0.72)
    );
    const volatility = parseVolatility(fixture?.volatility);

    return {
        baseline,
        avgGoals: clamp(avgGoals, 1.1, 4.6),
        bttsRate: clamp(bttsRate, 0.2, 0.9),
        volatility
    };
}

/**
 * Select up to 4 secondary markets with match-aware confidence + diversity.
 * @param {object} fixture
 * @param {object} options
 * @returns {{markets: Array, note: string|null}}
 */
function selectSecondaryMarkets(fixture, options = {}) {
    const context = buildContext(fixture, options);
    const seed = stableFixtureSeed(fixture);

    const candidates = ALLOWED_MARKETS.map((definition, idx) => {
        const seedAdjust = ((seed + idx) % 7) - 3; // deterministic range [-3..3]
        const confidence = confidenceForMarket(definition, context, seedAdjust);
        return {
            market: definition.market,
            category: definition.category,
            confidence,
            prediction: marketLabel(definition.market),
            description: buildDescription(definition.market, context)
        };
    }).sort((a, b) => b.confidence - a.confidence || a.market.localeCompare(b.market));

    const highConfidence = candidates.filter((candidate) => candidate.confidence >= SECONDARY_THRESHOLD);
    const selected = [];
    let goalCount = 0;
    let cardCount = 0;

    for (const candidate of highConfidence) {
        if (selected.length >= 4) break;
        if (GOAL_HEAVY_CATEGORIES.has(candidate.category) && goalCount >= DIVERSITY_LIMITS.goals) continue;
        if (candidate.category === 'cards' && cardCount >= DIVERSITY_LIMITS.cards) continue;

        selected.push(candidate);
        if (GOAL_HEAVY_CATEGORIES.has(candidate.category)) goalCount += 1;
        if (candidate.category === 'cards') cardCount += 1;
    }

    const note = selected.length < 4 ? 'Limited secondary markets available' : null;
    return {
        markets: selected,
        note
    };
}

module.exports = {
    ALLOWED_MARKETS,
    selectSecondaryMarkets
};
