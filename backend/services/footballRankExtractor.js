'use strict';

function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function toProbability(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (n > 1 && n <= 100) return clampNumber(n / 100, 0, 1);
    return clampNumber(n, 0, 1);
}

function toRankNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n;
}

function getConfidenceBand(confidence) {
    const score = clampNumber(Number(confidence) || 55, 55, 92);
    if (score >= 85) return 'PREMIUM_EDGE';
    if (score >= 75) return 'STRONG_EDGE';
    if (score >= 65) return 'MODERATE_EDGE';
    return 'LOW_EDGE';
}

function getVolatilityLabel(volatilityScore) {
    const score = clampNumber(Number(volatilityScore) || 0, 0, 100);
    if (score >= 60) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
}

function resolveRankGap(rankData) {
    const explicitGap = toRankNumber(rankData?.rank_gap);
    if (Number.isFinite(explicitGap)) return Math.abs(explicitGap);

    const homeRank = toRankNumber(rankData?.home_rank);
    const awayRank = toRankNumber(rankData?.away_rank);
    if (Number.isFinite(homeRank) && Number.isFinite(awayRank)) {
        return Math.abs(homeRank - awayRank);
    }

    const oneX2 = [rankData?.homeWin, rankData?.draw, rankData?.awayWin]
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v));
    if (oneX2.length >= 2) {
        const max = Math.max(...oneX2);
        const min = Math.min(...oneX2);
        return Math.abs(max - min) * 20;
    }

    return null;
}

function calibrateRankConfidence(rankData) {
    const probabilityRaw = Number(rankData?.probability);
    const probability01 = Number.isFinite(probabilityRaw)
        ? (probabilityRaw > 1 ? clampNumber(probabilityRaw / 100, 0, 1) : clampNumber(probabilityRaw, 0, 1))
        : 0.5;
    const probabilityPct = probability01 * 100;
    const market = String(rankData?.market || '').trim().toUpperCase();
    const rankGap = resolveRankGap(rankData);
    const homeRank = toRankNumber(rankData?.home_rank);
    const awayRank = toRankNumber(rankData?.away_rank);
    const metadata = rankData && typeof rankData.metadata === 'object' ? rankData.metadata : {};
    const notes = [];

    let confidence;
    if (probabilityPct >= 83) confidence = 88;
    else if (probabilityPct >= 78) confidence = 84;
    else if (probabilityPct >= 73) confidence = 80;
    else if (probabilityPct >= 68) confidence = 76;
    else if (probabilityPct >= 64) confidence = 72;
    else if (probabilityPct >= 60) confidence = 68;
    else if (probabilityPct >= 55) confidence = 63;
    else confidence = 59;

    if (Number.isFinite(rankGap)) {
        if (rankGap >= 15) {
            confidence += 5;
            notes.push('large_rank_gap_boost');
        } else if (rankGap >= 10) {
            confidence += 3;
            notes.push('strong_rank_gap_boost');
        } else if (rankGap >= 6) {
            confidence += 2;
            notes.push('moderate_rank_gap_boost');
        } else if (rankGap < 2) {
            confidence -= 5;
            notes.push('very_small_rank_gap_penalty');
        } else if (rankGap < 4) {
            confidence -= 3;
            notes.push('small_rank_gap_penalty');
        }
    } else {
        confidence -= 2;
        notes.push('rank_gap_missing_penalty');
    }

    const closenessToFifty = Math.abs(probabilityPct - 50);
    if (closenessToFifty < 4) {
        confidence -= 5;
        notes.push('coinflip_probability_penalty');
    } else if (closenessToFifty < 8) {
        confidence -= 3;
        notes.push('near_coinflip_probability_penalty');
    } else if (probabilityPct >= 78) {
        confidence += 2;
        notes.push('high_probability_boost');
    }

    const hasHomeRank = Number.isFinite(homeRank);
    const hasAwayRank = Number.isFinite(awayRank);
    if (!hasHomeRank && !hasAwayRank) {
        confidence -= 6;
        notes.push('home_away_rank_missing_penalty');
    } else if (!hasHomeRank || !hasAwayRank) {
        confidence -= 3;
        notes.push('partial_rank_missing_penalty');
    } else {
        confidence += 1;
        notes.push('rank_fields_complete_boost');
    }

    if (market === 'DRAW') {
        confidence -= 3;
        notes.push('draw_market_risk_penalty');
    } else if (market !== 'HOME_WIN' && market !== 'AWAY_WIN') {
        confidence -= 4;
        notes.push('unclear_market_penalty');
    }

    const completenessFields = [
        rankData?.homeWin,
        rankData?.draw,
        rankData?.awayWin,
        rankData?.over15,
        rankData?.over25,
        rankData?.btts
    ];
    const completenessRatio = completenessFields.filter((v) => Number.isFinite(v)).length / completenessFields.length;
    if (completenessRatio >= 0.85) {
        confidence += 1;
        notes.push('rank_source_complete_boost');
    } else if (completenessRatio <= 0.5) {
        confidence -= 2;
        notes.push('rank_source_incomplete_penalty');
    }

    if (Number(metadata?.source_completeness) < 0.5) {
        confidence -= 1;
        notes.push('metadata_incomplete_penalty');
    }

    const veryStrongEvidence = probabilityPct >= 82
        && Number.isFinite(rankGap)
        && rankGap >= 12
        && hasHomeRank
        && hasAwayRank
        && completenessRatio >= 0.8;
    const confidenceCap = veryStrongEvidence ? 92 : 90;
    if (confidence > confidenceCap) {
        notes.push('confidence_cap_applied');
    }
    confidence = clampNumber(Math.round(confidence), 55, confidenceCap);
    confidence = clampNumber(confidence, 55, 92);

    let volatility = 45;
    if (Number.isFinite(rankGap)) {
        if (rankGap >= 15) volatility -= 18;
        else if (rankGap >= 10) volatility -= 12;
        else if (rankGap >= 6) volatility -= 6;
        else if (rankGap < 2) volatility += 26;
        else if (rankGap < 4) volatility += 18;
        else volatility += 10;
    } else {
        volatility += 12;
    }

    if (probabilityPct < 55) volatility += 20;
    else if (probabilityPct < 65) volatility += 12;
    else if (probabilityPct < 75) volatility += 5;
    else if (probabilityPct >= 82) volatility -= 12;
    else if (probabilityPct >= 75) volatility -= 8;

    if (!hasHomeRank && !hasAwayRank) volatility += 15;
    else if (!hasHomeRank || !hasAwayRank) volatility += 8;
    else volatility -= 4;

    if (market === 'DRAW') volatility += 8;
    else if (market !== 'HOME_WIN' && market !== 'AWAY_WIN') volatility += 12;

    if (completenessRatio >= 0.85) volatility -= 7;
    else if (completenessRatio <= 0.5) volatility += 10;

    volatility = clampNumber(Math.round(volatility), 0, 100);

    const confidenceBand = getConfidenceBand(confidence);
    const volatilityLabel = getVolatilityLabel(volatility);
    const rankFilterWarning = confidence < 60 ? 'below_direct_threshold' : null;
    const rankVolatilityWarning = volatility >= 60 ? 'high_volatility' : null;

    return {
        confidence,
        confidence_band: confidenceBand,
        volatility_score: volatility,
        volatility_label: volatilityLabel,
        calibration_notes: notes,
        rank_filter_warning: rankFilterWarning,
        rank_volatility_warning: rankVolatilityWarning
    };
}

function extractRankData(match) {
    const source = match && typeof match === 'object' ? match : {};
    const rankData = {
        homeWin: toProbability(source.rank_htw_ft),
        draw: toProbability(source.rank_drw_ft),
        awayWin: toProbability(source.rank_atw_ft),
        over15: toProbability(source.rank_to_15_ft),
        over25: toProbability(source.rank_to_25_ft),
        over35: toProbability(source.rank_to_35_ft),
        btts: toProbability(source.rank_btts_ft),
        homeOver05: toProbability(source.rank_ho_05_ft),
        awayOver05: toProbability(source.rank_ao_05_ft),
        home_rank: toRankNumber(source.home_rank ?? source.rank_home ?? source.home_position ?? source.home_table_rank),
        away_rank: toRankNumber(source.away_rank ?? source.rank_away ?? source.away_position ?? source.away_table_rank),
        rank_gap: toRankNumber(source.rank_gap),
        metadata: source.rank_metadata && typeof source.rank_metadata === 'object' ? source.rank_metadata : {}
    };

    const hasAnyRankValue = [
        rankData.homeWin,
        rankData.draw,
        rankData.awayWin,
        rankData.over15,
        rankData.over25,
        rankData.over35,
        rankData.btts,
        rankData.homeOver05,
        rankData.awayOver05
    ].some((value) => value !== null);
    if (!hasAnyRankValue) return null;

    if (!Number.isFinite(rankData.rank_gap)
        && Number.isFinite(rankData.home_rank)
        && Number.isFinite(rankData.away_rank)) {
        rankData.rank_gap = Math.abs(rankData.home_rank - rankData.away_rank);
    }

    return rankData;
}

function buildPredictionFromRank(rankData) {
    if (!rankData || typeof rankData !== 'object') return null;

    const primaryCandidates = [
        { market: 'HOME_WIN', probability: rankData.homeWin },
        { market: 'DRAW', probability: rankData.draw },
        { market: 'AWAY_WIN', probability: rankData.awayWin }
    ].filter((candidate) => Number.isFinite(candidate.probability));

    if (!primaryCandidates.length) return null;

    primaryCandidates.sort((a, b) => b.probability - a.probability);
    const primary = primaryCandidates[0];
    const calibration = calibrateRankConfidence({
        ...rankData,
        probability: primary.probability,
        market: primary.market
    });

    let secondary = null;
    if (Number.isFinite(rankData.over25) && rankData.over25 >= 0.65) {
        secondary = 'OVER_2.5';
    } else if (Number.isFinite(rankData.over15) && rankData.over15 >= 0.70) {
        secondary = 'OVER_1.5';
    } else if (Number.isFinite(rankData.btts) && rankData.btts >= 0.65) {
        secondary = 'BTTS_YES';
    }

    return {
        market: primary.market,
        probability: primary.probability,
        confidence: calibration.confidence,
        volatility: calibration.volatility_score,
        confidence_band: calibration.confidence_band,
        volatility_score: calibration.volatility_score,
        volatility_label: calibration.volatility_label,
        calibration_notes: calibration.calibration_notes,
        rank_filter_warning: calibration.rank_filter_warning,
        rank_volatility_warning: calibration.rank_volatility_warning,
        secondary
    };
}

module.exports = {
    extractRankData,
    buildPredictionFromRank,
    calibrateRankConfidence,
    clampNumber,
    getConfidenceBand,
    getVolatilityLabel
};
