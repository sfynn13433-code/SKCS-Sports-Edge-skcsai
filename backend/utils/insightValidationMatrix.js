'use strict';

function normalizeMarket(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizePick(value) {
    return String(value || '').trim().toLowerCase();
}

function parseLineToken(token) {
    if (!token) return null;
    const numeric = String(token).replace('_', '.');
    const line = Number(numeric);
    return Number.isFinite(line) ? line : null;
}

function parseGoalLineFromMarket(marketKey) {
    const market = normalizeMarket(marketKey);
    if (!market) return null;

    const directLine = market.match(/^(over|under)_(\d+)_(\d+)$/);
    if (directLine) {
        return {
            scope: 'full_time',
            side: directLine[1],
            line: parseLineToken(`${directLine[2]}_${directLine[3]}`)
        };
    }

    const firstHalfLineA = market.match(/^(over|under)_(\d+)_(\d+)_first_half$/);
    if (firstHalfLineA) {
        return {
            scope: 'first_half',
            side: firstHalfLineA[1],
            line: parseLineToken(`${firstHalfLineA[2]}_${firstHalfLineA[3]}`)
        };
    }

    const firstHalfLineB = market.match(/^first_half_(over|under)_(\d+)_(\d+)$/);
    if (firstHalfLineB) {
        return {
            scope: 'first_half',
            side: firstHalfLineB[1],
            line: parseLineToken(`${firstHalfLineB[2]}_${firstHalfLineB[3]}`)
        };
    }

    const firstHalfLineC = market.match(/^ht_(over|under)_(\d+)_(\d+)$/);
    if (firstHalfLineC) {
        return {
            scope: 'first_half',
            side: firstHalfLineC[1],
            line: parseLineToken(`${firstHalfLineC[2]}_${firstHalfLineC[3]}`)
        };
    }

    return null;
}

function resolveTeamSide(leg) {
    const metadata = leg?.metadata || {};
    const explicitSide =
        metadata.team_side ||
        metadata.selection_side ||
        metadata.player_team_side ||
        metadata.team ||
        null;
    const normalizedExplicit = normalizePick(explicitSide);
    if (normalizedExplicit === 'home' || normalizedExplicit === 'away') {
        return normalizedExplicit;
    }

    const market = normalizeMarket(leg?.market || '');
    if (market.includes('home')) return 'home';
    if (market.includes('away')) return 'away';
    return null;
}

function getMinimumTotalFromLeg(leg) {
    const market = normalizeMarket(leg?.market);
    const pick = normalizePick(leg?.prediction || leg?.pick);

    if (market === '1x2' || market === 'match_result') {
        if (pick === 'home_win' || pick === 'away_win' || pick === 'home win' || pick === 'away win') {
            return 1;
        }
        return 0;
    }

    if (market === 'btts_yes' || (market === 'btts' && pick === 'yes')) {
        return 2;
    }

    const line = parseGoalLineFromMarket(market);
    if (line?.scope === 'full_time' && line.side === 'over') {
        return Math.floor(line.line) + 1;
    }

    return 0;
}

function getMaximumTotalFromLeg(leg) {
    const market = normalizeMarket(leg?.market);
    const line = parseGoalLineFromMarket(market);
    if (line?.scope === 'full_time' && line.side === 'under') {
        return Math.ceil(line.line) - 1;
    }
    return Number.POSITIVE_INFINITY;
}

function toPredicate(leg) {
    const market = normalizeMarket(leg?.market);
    const pick = normalizePick(leg?.prediction || leg?.pick);
    const side = resolveTeamSide(leg);
    const line = parseGoalLineFromMarket(market);

    if (market === '1x2' || market === 'match_result') {
        if (pick === 'home_win' || pick === 'home win' || pick === 'home') {
            return (state) => state.home > state.away;
        }
        if (pick === 'away_win' || pick === 'away win' || pick === 'away') {
            return (state) => state.away > state.home;
        }
        if (pick === 'draw' || pick === 'x') {
            return (state) => state.home === state.away;
        }
    }

    if (market.startsWith('double_chance_') || market === 'double_chance') {
        const token = market.startsWith('double_chance_') ? market.replace('double_chance_', '') : pick;
        if (token === '1x' || token === 'home_or_draw') {
            return (state) => state.home >= state.away;
        }
        if (token === 'x2' || token === 'draw_or_away') {
            return (state) => state.away >= state.home;
        }
        if (token === '12' || token === 'home_or_away') {
            return (state) => state.home !== state.away;
        }
    }

    if (market === 'btts_yes' || (market === 'btts' && pick === 'yes')) {
        return (state) => state.home >= 1 && state.away >= 1;
    }
    if (market === 'btts_no' || (market === 'btts' && pick === 'no')) {
        return (state) => state.home === 0 || state.away === 0;
    }

    if (line) {
        if (line.scope === 'full_time') {
            if (line.side === 'over') {
                return (state) => (state.home + state.away) > line.line;
            }
            if (line.side === 'under') {
                return (state) => (state.home + state.away) < line.line;
            }
        }
        if (line.scope === 'first_half') {
            if (line.side === 'over') {
                return (state) => (state.homeHT + state.awayHT) > line.line;
            }
            if (line.side === 'under') {
                return (state) => (state.homeHT + state.awayHT) < line.line;
            }
        }
    }

    // Team total goals constraints
    const teamTotalMatch = market.match(/^(home|away)_team_total_(over|under)_(\d+)_(\d+)$/);
    if (teamTotalMatch) {
        const team = teamTotalMatch[1];
        const direction = teamTotalMatch[2];
        const teamLine = parseLineToken(`${teamTotalMatch[3]}_${teamTotalMatch[4]}`);
        if (direction === 'over') {
            return (state) => (team === 'home' ? state.home : state.away) > teamLine;
        }
        return (state) => (team === 'home' ? state.home : state.away) < teamLine;
    }

    // Player-to-score constraints
    const isPlayerToScoreMarket = market.includes('player') && market.includes('score');
    const isAnytimeGoalscorer = market.includes('goalscorer');
    if (isPlayerToScoreMarket || isAnytimeGoalscorer) {
        if (pick === 'no') {
            // "No" to score is not enough to constrain a full grouped insight meaningfully.
            return null;
        }
        if (side === 'home') return (state) => state.home >= 1;
        if (side === 'away') return (state) => state.away >= 1;
        return (state) => (state.home + state.away) >= 1;
    }

    return null;
}

function detectVarianceConflict(legs) {
    const normalized = legs.map((leg) => ({
        market: normalizeMarket(leg?.market),
        pick: normalizePick(leg?.prediction || leg?.pick)
    }));

    const hasBttsNo = normalized.some((leg) => leg.market === 'btts_no' || (leg.market === 'btts' && leg.pick === 'no'));
    if (!hasBttsNo) return null;

    for (const leg of normalized) {
        const line = parseGoalLineFromMarket(leg.market);
        if (line && line.scope === 'full_time' && line.side === 'over' && line.line >= 2.5) {
            return {
                reason_code: 'variance_conflict_btts_no_vs_over',
                reason: 'BTTS: No paired with Over 2.5+ is rejected as a conflicting game script.'
            };
        }
    }

    return null;
}

function buildGoalBoundSummary(legs) {
    let minTotalGoalsRequired = 0;
    let maxTotalGoalsAllowed = Number.POSITIVE_INFINITY;

    for (const leg of legs) {
        minTotalGoalsRequired = Math.max(minTotalGoalsRequired, getMinimumTotalFromLeg(leg));
        maxTotalGoalsAllowed = Math.min(maxTotalGoalsAllowed, getMaximumTotalFromLeg(leg));
    }

    return {
        minTotalGoalsRequired,
        maxTotalGoalsAllowed
    };
}

function findFeasibleScore(predicates) {
    for (let home = 0; home <= 6; home++) {
        for (let away = 0; away <= 6; away++) {
            for (let homeHT = 0; homeHT <= home; homeHT++) {
                for (let awayHT = 0; awayHT <= away; awayHT++) {
                    const state = { home, away, homeHT, awayHT };
                    const ok = predicates.every((predicate) => predicate(state));
                    if (!ok) continue;
                    return state;
                }
            }
        }
    }
    return null;
}

function validateInsightLegGroup(legs, options = {}) {
    const rows = Array.isArray(legs) ? legs : [];
    if (!rows.length) {
        return {
            valid: false,
            reason_code: 'empty_leg_group',
            reason: 'Insight group has no legs.',
            min_total_goals_required: 0,
            max_total_goals_allowed: Number.POSITIVE_INFINITY,
            feasible_score_example: null
        };
    }

    const summary = buildGoalBoundSummary(rows);
    if (summary.minTotalGoalsRequired > summary.maxTotalGoalsAllowed) {
        return {
            valid: false,
            reason_code: 'mathematical_goal_bounds_conflict',
            reason: 'Minimum goal requirement exceeds maximum allowed goals.',
            min_total_goals_required: summary.minTotalGoalsRequired,
            max_total_goals_allowed: summary.maxTotalGoalsAllowed,
            feasible_score_example: null
        };
    }

    const varianceConflict = options.rejectVarianceConflicts === false ? null : detectVarianceConflict(rows);
    if (varianceConflict) {
        return {
            valid: false,
            reason_code: varianceConflict.reason_code,
            reason: varianceConflict.reason,
            min_total_goals_required: summary.minTotalGoalsRequired,
            max_total_goals_allowed: summary.maxTotalGoalsAllowed,
            feasible_score_example: null
        };
    }

    const predicates = rows
        .map((leg) => toPredicate(leg))
        .filter((predicate) => typeof predicate === 'function');

    if (!predicates.length) {
        return {
            valid: true,
            reason_code: 'no_known_constraints',
            reason: 'No hard mathematical constraints detected.',
            min_total_goals_required: summary.minTotalGoalsRequired,
            max_total_goals_allowed: summary.maxTotalGoalsAllowed,
            feasible_score_example: null
        };
    }

    const feasible = findFeasibleScore(predicates);
    if (!feasible) {
        return {
            valid: false,
            reason_code: 'mathematical_impossibility',
            reason: 'Combined legs produce no feasible scoreline within validation bounds.',
            min_total_goals_required: summary.minTotalGoalsRequired,
            max_total_goals_allowed: summary.maxTotalGoalsAllowed,
            feasible_score_example: null
        };
    }

    return {
        valid: true,
        reason_code: 'valid',
        reason: 'Leg group passes mathematical and variance checks.',
        min_total_goals_required: summary.minTotalGoalsRequired,
        max_total_goals_allowed: summary.maxTotalGoalsAllowed,
        feasible_score_example: {
            full_time: `${feasible.home}-${feasible.away}`,
            first_half: `${feasible.homeHT}-${feasible.awayHT}`
        }
    };
}

module.exports = {
    validateInsightLegGroup
};
