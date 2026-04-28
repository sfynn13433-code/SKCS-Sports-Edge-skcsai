'use strict';

function clampNumber(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
}

function toNum(value, fallback = null) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function findTeamRanking(rankingsData, teamId) {
    const source = rankingsData && typeof rankingsData === 'object' ? rankingsData : {};
    const teams = Array.isArray(source.teams) ? source.teams : [];
    const target = String(teamId || '').trim();
    if (!target) return null;
    return teams.find((team) => String(team?.team_id || '').trim() === target) || null;
}

function calculateRankingGap(homeRank, awayRank) {
    if (!homeRank || !awayRank) return null;

    const homePosition = toNum(homeRank.position);
    const awayPosition = toNum(awayRank.position);
    if (!Number.isFinite(homePosition) || !Number.isFinite(awayPosition)) return null;

    const rankGap = Math.abs(homePosition - awayPosition);
    const strongerSide = homePosition < awayPosition ? 'home' : (awayPosition < homePosition ? 'away' : 'balanced');
    const strongerTeamId = strongerSide === 'home'
        ? homeRank.team_id || null
        : (strongerSide === 'away' ? awayRank.team_id || null : null);

    const homePoints = toNum(homeRank.points);
    const awayPoints = toNum(awayRank.points);
    const pointsGap = Number.isFinite(homePoints) && Number.isFinite(awayPoints)
        ? Math.abs(homePoints - awayPoints)
        : null;

    const homeGd = toNum(homeRank.goal_difference);
    const awayGd = toNum(awayRank.goal_difference);
    const goalDifferenceGap = Number.isFinite(homeGd) && Number.isFinite(awayGd)
        ? Math.abs(homeGd - awayGd)
        : null;

    return {
        rank_gap: rankGap,
        stronger_team_id: strongerTeamId,
        stronger_side: strongerSide,
        points_gap: pointsGap,
        goal_difference_gap: goalDifferenceGap
    };
}

function buildLeagueRankingSignal(rankingsData, homeTeamId, awayTeamId) {
    const homeTeam = findTeamRanking(rankingsData, homeTeamId);
    const awayTeam = findTeamRanking(rankingsData, awayTeamId);
    const notes = [];

    if (!rankingsData?.rankings_available || !homeTeam || !awayTeam) {
        notes.push('ranking_data_incomplete');
        return {
            available: false,
            home_team: homeTeam,
            away_team: awayTeam,
            rank_gap: null,
            stronger_team_id: null,
            stronger_side: null,
            points_gap: null,
            goal_difference_gap: null,
            confidence_adjustment: 0,
            volatility_adjustment: 5,
            notes
        };
    }

    const gap = calculateRankingGap(homeTeam, awayTeam);
    if (!gap) {
        notes.push('ranking_data_incomplete');
        return {
            available: false,
            home_team: homeTeam,
            away_team: awayTeam,
            rank_gap: null,
            stronger_team_id: null,
            stronger_side: null,
            points_gap: null,
            goal_difference_gap: null,
            confidence_adjustment: 0,
            volatility_adjustment: 5,
            notes
        };
    }

    let confidenceAdjustment = 0;
    let volatilityAdjustment = 0;

    if (gap.rank_gap >= 10) {
        confidenceAdjustment += 4;
        volatilityAdjustment -= 6;
        notes.push('large_rank_gap');
    } else if (gap.rank_gap >= 6) {
        confidenceAdjustment += 2;
        volatilityAdjustment -= 3;
        notes.push('moderate_rank_gap');
    } else if (gap.rank_gap >= 3) {
        confidenceAdjustment += 0;
        volatilityAdjustment += 2;
        notes.push('small_rank_gap');
    } else {
        confidenceAdjustment -= 1;
        volatilityAdjustment += 5;
        notes.push('very_small_rank_gap');
    }

    if (Number.isFinite(gap.points_gap)) {
        if (gap.points_gap >= 10) {
            confidenceAdjustment += 1;
            volatilityAdjustment -= 1;
            notes.push('points_gap_supports_rank_edge');
        } else if (gap.points_gap <= 2) {
            volatilityAdjustment += 2;
            notes.push('points_gap_is_tight');
        }
    }

    if (Number.isFinite(gap.goal_difference_gap) && gap.goal_difference_gap >= 10) {
        confidenceAdjustment += 1;
        notes.push('goal_difference_supports_rank_edge');
    }

    confidenceAdjustment = clampNumber(Math.round(confidenceAdjustment), -2, +4);
    volatilityAdjustment = clampNumber(Math.round(volatilityAdjustment), -8, +12);

    return {
        available: true,
        home_team: homeTeam,
        away_team: awayTeam,
        rank_gap: gap.rank_gap,
        stronger_team_id: gap.stronger_team_id,
        stronger_side: gap.stronger_side,
        points_gap: gap.points_gap,
        goal_difference_gap: gap.goal_difference_gap,
        confidence_adjustment: confidenceAdjustment,
        volatility_adjustment: volatilityAdjustment,
        notes
    };
}

module.exports = {
    buildLeagueRankingSignal,
    findTeamRanking,
    calculateRankingGap
};
