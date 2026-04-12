'use strict';

const crypto = require('crypto');
const predictionOutcomes = require('../config/predictionOutcomes');
const { scoreMatch } = require('./aiScoring');

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function toProbability(confidence) {
    const n = Number(confidence);
    if (!Number.isFinite(n)) return 0;
    return clamp(n, 0, 100) / 100;
}

function intersectionConfidence(confidences = []) {
    const product = (Array.isArray(confidences) ? confidences : [])
        .reduce((acc, confidence) => acc * toProbability(confidence), 1);
    return clamp(Math.round(product * 10000) / 100, 0, 100);
}

function hashToUnit(seed) {
    const hash = crypto.createHash('sha256').update(String(seed)).digest('hex').slice(0, 8);
    return parseInt(hash, 16) / 0xFFFFFFFF;
}

function normalizeSport(sport) {
    const key = String(sport || '').toLowerCase();
    if (key === 'mma') return 'combat_sports';
    if (key === 'formula1') return 'motorsport';
    if (key === 'nfl') return 'american_football';
    if (key.startsWith('soccer_')) return 'football';
    if (key.startsWith('icehockey_')) return 'hockey';
    if (key.startsWith('basketball_')) return 'basketball';
    if (key.startsWith('americanfootball_')) return 'american_football';
    if (key.startsWith('baseball_')) return 'baseball';
    if (key.startsWith('rugbyunion_')) return 'rugby';
    if (key.startsWith('aussierules_')) return 'afl';
    return key;
}

function pickFromOutcomes(outcomes, matchData, market, scoring) {
    if (!Array.isArray(outcomes) || outcomes.length === 0) return null;

    const marketKey = String(market || '').toUpperCase();
    const winner = scoring?.winner === 'away' ? 'AWAY' : 'HOME';
    const diff = Number(scoring?.confidence || 50) - 60;
    const balanceSeed = hashToUnit(`${matchData?.match_id || matchData?.home_team || 'home'}:${market}`);

    if (marketKey.startsWith('OVER_UNDER_')) {
        return balanceSeed >= 0.45 ? 'OVER' : 'UNDER';
    }

    switch (marketKey) {
        case 'MATCH_RESULT':
            if (diff < 6 && outcomes.includes('DRAW') && balanceSeed < 0.22) return 'DRAW';
            return outcomes.includes(winner) ? winner : outcomes[0];
        case 'MATCH_WINNER':
        case 'WINNER':
            return outcomes.includes(winner) ? winner : outcomes[0];
        case 'DOUBLE_CHANCE':
            return winner === 'HOME' ? '1X' : 'X2';
        case 'DRAW_NO_BET':
            return winner === 'HOME' ? 'HOME' : 'AWAY';
        case 'BTTS':
            return diff < 10 ? 'YES' : 'NO';
        case 'TOTAL_POINTS':
        case 'TOTAL_GOALS':
        case 'TOTAL_RUNS':
        case 'TOTAL_GAMES':
        case 'CORNERS_OVER_UNDER':
        case 'YELLOW_CARDS_OVER_UNDER':
            return balanceSeed >= 0.45 ? 'OVER' : 'UNDER';
        case 'TEAM_TOTAL_GOALS':
            if (winner === 'HOME') return diff >= 10 ? 'HOME_OVER' : 'AWAY_UNDER';
            return diff >= 10 ? 'AWAY_OVER' : 'HOME_UNDER';
        case 'COMBO_MATCH_RESULT_OVER_UNDER':
            if (diff < 6 && outcomes.includes('DRAW_UNDER_3_5')) return 'DRAW_UNDER_3_5';
            if (winner === 'HOME') {
                return diff >= 10 ? 'HOME_OVER_2_5' : 'HOME_OVER_1_5';
            }
            return diff >= 10 ? 'AWAY_OVER_2_5' : 'AWAY_OVER_1_5';
        case 'COMBO_DC_OVER_UNDER':
            if (winner === 'HOME') return diff >= 8 ? '1X_OVER_2_5' : '1X_OVER_1_5';
            return diff >= 8 ? 'X2_OVER_2_5' : 'X2_OVER_1_5';
        case 'COMBO_BTTS_OVER_UNDER':
            if (diff < 8) return balanceSeed >= 0.5 ? 'YES_OVER_3_5' : 'YES_OVER_2_5';
            return balanceSeed >= 0.5 ? 'NO_UNDER_2_5' : 'NO_UNDER_3_5';
        case 'HT_FT':
            if (winner === 'HOME') {
                if (diff >= 12 && outcomes.includes('HOME_HOME')) return 'HOME_HOME';
                if (outcomes.includes('DRAW_HOME')) return 'DRAW_HOME';
                return outcomes.includes('HOME_DRAW') ? 'HOME_DRAW' : outcomes[0];
            }
            if (diff >= 12 && outcomes.includes('AWAY_AWAY')) return 'AWAY_AWAY';
            if (outcomes.includes('DRAW_AWAY')) return 'DRAW_AWAY';
            return outcomes.includes('AWAY_DRAW') ? 'AWAY_DRAW' : outcomes[0];
        case 'HANDICAP':
        case 'SPREAD':
        case 'SET_HANDICAP':
        case 'EUROPEAN_HANDICAP':
        case 'ASIAN_HANDICAP':
            return winner === 'HOME' ? outcomes[0] : (outcomes[1] || outcomes[0]);
        case 'METHOD':
            if (diff >= 18 && outcomes.includes('KO')) return 'KO';
            if (diff >= 10 && outcomes.includes('DECISION')) return 'DECISION';
            return outcomes.includes('SUBMISSION') ? 'SUBMISSION' : outcomes[0];
        case 'SET_BETTING':
        case 'MAP_SCORE':
            return diff >= 12 ? outcomes[0] : (outcomes[1] || outcomes[0]);
        case 'RACE_WINNER':
            return outcomes[0];
        case 'PODIUM':
            return outcomes.includes('TOP_3') ? 'TOP_3' : outcomes[0];
        case 'TOP_10':
            return balanceSeed >= 0.3 ? 'YES' : 'NO';
        default:
            return outcomes[0];
    }
}

function marketTypePenalty(type) {
    if (type === 'primary') return 0;
    if (type === 'secondary') return 3;
    return 6; // advanced
}

function lineToToken(line) {
    const n = Number(line);
    if (!Number.isFinite(n)) return null;
    return String(n).replace('.', '_');
}

function resolveMarketLine(sport, market) {
    const s = String(sport || '').toLowerCase();
    const m = String(market || '').toUpperCase();

    if (m === 'OVER_UNDER_0_5') return 0.5;
    if (m === 'OVER_UNDER_1_5') return 1.5;
    if (m === 'OVER_UNDER_2_5') return 2.5;
    if (m === 'OVER_UNDER_3_5') return 3.5;
    if (m === 'TEAM_TOTAL_GOALS') return 1.5;
    if (m === 'YELLOW_CARDS_OVER_UNDER') return 3.5;
    if (m === 'CORNERS_OVER_UNDER' && s === 'football') return 9.5;
    return null;
}

function withLineDescription(description, line) {
    const n = Number(line);
    if (!Number.isFinite(n)) return description;
    return `${description} (${n})`;
}

function isComboMarket(market) {
    const key = String(market || '').toUpperCase();
    return key === 'COMBO_MATCH_RESULT_OVER_UNDER'
        || key === 'COMBO_DC_OVER_UNDER'
        || key === 'COMBO_BTTS_OVER_UNDER';
}

function findMarketRow(rows, market) {
    const key = String(market || '').toUpperCase();
    return (Array.isArray(rows) ? rows : []).find((row) => String(row?.market || '').toUpperCase() === key) || null;
}

function lineTokenFromComboPick(pick) {
    const token = String(pick || '').toUpperCase();
    const match = token.match(/_(\d+)_(\d+)$/);
    if (!match) return null;
    return `${match[1]}_${match[2]}`;
}

function overUnderMarketFromLineToken(token = '2_5') {
    const normalized = String(token || '').trim();
    if (normalized === '1_5') return 'OVER_UNDER_1_5';
    if (normalized === '2_5') return 'OVER_UNDER_2_5';
    if (normalized === '3_5') return 'OVER_UNDER_3_5';
    return 'OVER_UNDER_2_5';
}

function confidenceForRequiredOutcome(row, requiredPick) {
    const market = String(row?.market || '').toUpperCase();
    const pick = String(row?.pick || '').toUpperCase();
    const required = String(requiredPick || '').toUpperCase();
    const confidence = clamp(Number(row?.confidence || 0), 0, 100);
    if (!required) return confidence;
    if (pick === required) return confidence;

    if (market === 'DOUBLE_CHANCE' || market === 'BTTS' || market === 'DRAW_NO_BET' || market.startsWith('OVER_UNDER_')) {
        return clamp(100 - confidence, 0, 100);
    }

    if (market === 'MATCH_RESULT') {
        return clamp((100 - confidence) / 2, 0, 100);
    }

    return 0;
}

function parseComboRequirements(row) {
    const market = String(row?.market || '').toUpperCase();
    const pick = String(row?.pick || '').toUpperCase();
    const lineToken = lineTokenFromComboPick(pick) || '2_5';
    const ouMarket = overUnderMarketFromLineToken(lineToken);

    if (market === 'COMBO_MATCH_RESULT_OVER_UNDER') {
        const match = pick.match(/^(HOME|AWAY|DRAW)_(OVER|UNDER)_\d+_\d+$/);
        if (!match) return null;
        return {
            primaryMarket: 'MATCH_RESULT',
            primaryPick: match[1],
            secondaryMarket: ouMarket,
            secondaryPick: match[2]
        };
    }

    if (market === 'COMBO_DC_OVER_UNDER') {
        const match = pick.match(/^(1X|X2|12)_(OVER|UNDER)_\d+_\d+$/);
        if (!match) return null;
        return {
            primaryMarket: 'DOUBLE_CHANCE',
            primaryPick: match[1],
            secondaryMarket: ouMarket,
            secondaryPick: match[2]
        };
    }

    if (market === 'COMBO_BTTS_OVER_UNDER') {
        const match = pick.match(/^(YES|NO)_(OVER|UNDER)_\d+_\d+$/);
        if (!match) return null;
        return {
            primaryMarket: 'BTTS',
            primaryPick: match[1],
            secondaryMarket: ouMarket,
            secondaryPick: match[2]
        };
    }

    return null;
}

function computeComboIntersectionConfidence(row, allRows) {
    const requirements = parseComboRequirements(row);
    if (!requirements) return Number(row?.confidence || 0);

    const primaryRow = findMarketRow(allRows, requirements.primaryMarket);
    const secondaryRow = findMarketRow(allRows, requirements.secondaryMarket);
    if (!primaryRow || !secondaryRow) return 0;

    const primaryConfidence = confidenceForRequiredOutcome(primaryRow, requirements.primaryPick);
    const secondaryConfidence = confidenceForRequiredOutcome(secondaryRow, requirements.secondaryPick);
    return intersectionConfidence([primaryConfidence, secondaryConfidence]);
}

function outcomeUniverseToLegacyMarket(sport, market, line = null) {
    // We keep outcome universe identifiers as primary source of truth,
    // but provide a pragmatic alias to the current pipeline naming where obvious.
    const s = String(sport || '').toLowerCase();
    const m = String(market || '').toUpperCase();
    const token = lineToToken(line);

    if (s === 'football' && m === 'MATCH_RESULT') return '1X2';
    if (s === 'football' && m === 'DOUBLE_CHANCE') return 'double_chance';
    if (s === 'football' && m === 'DRAW_NO_BET') return 'draw_no_bet';
    if (s === 'football' && m === 'BTTS') return 'btts_yes/btts_no';
    if (s === 'football' && m === 'TEAM_TOTAL_GOALS') return 'team_total_goals';
    if (s === 'football' && m === 'OVER_UNDER_2_5') return 'over_2_5/under_2_5';
    if (s === 'football' && m === 'OVER_UNDER_1_5') return 'over_1_5/under_1_5';
    if (s === 'football' && m === 'OVER_UNDER_3_5') return 'over_3_5/under_3_5';
    if (s === 'football' && m === 'COMBO_MATCH_RESULT_OVER_UNDER') return 'combo_match_result_ou';
    if (s === 'football' && m === 'COMBO_DC_OVER_UNDER') return 'combo_dc_ou';
    if (s === 'football' && m === 'COMBO_BTTS_OVER_UNDER') return 'combo_btts_ou';
    if (s === 'football' && m === 'EUROPEAN_HANDICAP') return 'european_handicap';
    if (s === 'football' && m === 'ASIAN_HANDICAP') return 'asian_handicap';
    if (s === 'football' && m === 'HT_FT') return 'ht_ft';
    if (s === 'football' && m === 'CORNERS_OVER_UNDER') {
        return token ? `corners_over_${token}/corners_under_${token}` : 'corners_over/corners_under';
    }
    if (s === 'football' && m === 'YELLOW_CARDS_OVER_UNDER') return 'over_3_5_yellows/under_3_5_yellows';

    return null;
}

async function scoreMarkets(matchData) {
    const sport = normalizeSport(matchData?.sport);
    const sportConfig = predictionOutcomes.getMarketsBySport(sport);
    if (!sportConfig) return [];

    const scoring = await scoreMatch({
        match_id: matchData?.match_id || matchData?.matchId || null,
        sport,
        home_team: matchData?.home_team || matchData?.homeTeam || null,
        away_team: matchData?.away_team || matchData?.awayTeam || null,
        base_prediction: matchData?.base_prediction || matchData?.prediction || null,
        base_confidence: matchData?.base_confidence ?? matchData?.confidence ?? null,
        raw_provider_data: matchData?.raw_provider_data || matchData?.metadata?.raw_provider_data || null
    });

    const baseConfidence = typeof scoring?.confidence === 'number' ? scoring.confidence : 50;

    const scoredRows = sportConfig.markets.map((m) => {
        const rawPick = pickFromOutcomes(m.outcomes, matchData, m.market, scoring);
        const pick = m.outcomes.includes(rawPick) ? rawPick : m.outcomes[0];
        const penalty = marketTypePenalty(m.type);
        const marketBias = hashToUnit(`${matchData?.match_id || matchData?.home_team || 'match'}:${m.market}`);
        const confidence = clamp(Math.round((baseConfidence - penalty - (marketBias * 4 - 2)) * 100) / 100, 0, 100);
        const line = resolveMarketLine(sport, m.market);

        return {
            market: m.market,
            pick,
            confidence,
            type: m.type,
            description: withLineDescription(m.description, line),
            line,
            legacyMarketHint: outcomeUniverseToLegacyMarket(sport, m.market, line)
        };
    });

    return scoredRows.map((row) => {
        if (!isComboMarket(row.market)) return row;
        const comboConfidence = computeComboIntersectionConfidence(row, scoredRows);
        return {
            ...row,
            confidence: comboConfidence,
            confidence_method: 'intersection_probability'
        };
    });
}

module.exports = {
    scoreMarkets
};
