'use strict';

function normalizeCricketFormat(value) {
    const raw = String(value || '').trim().toLowerCase();

    if (!raw) return 'unknown';

    if (
        raw.includes('t20') ||
        raw.includes('twenty20') ||
        raw.includes('20 over') ||
        raw === 't'
    ) {
        return 't20';
    }

    if (
        raw.includes('odi') ||
        raw.includes('one day') ||
        raw.includes('oneday') ||
        raw.includes('50 over') ||
        raw.includes('list a')
    ) {
        return 'odi';
    }

    if (
        raw.includes('test') ||
        raw.includes('first class') ||
        raw.includes('first-class') ||
        raw.includes('3 day') ||
        raw.includes('4 day') ||
        raw.includes('5 day') ||
        raw.includes('three day') ||
        raw.includes('four day') ||
        raw.includes('five day')
    ) {
        return 'test';
    }

    return raw;
}

function getConfidenceBand(confidence, rule) {
    const score = Number(confidence || 0);

    if (score >= Number(rule.elite_confidence || 80)) return 'elite';
    if (score >= Number(rule.strong_confidence || 70)) return 'strong';
    if (score >= Number(rule.min_display_confidence || 60)) return 'caution';
    return 'below_threshold';
}

function getRiskTier(confidence, rule) {
    const band = getConfidenceBand(confidence, rule);

    if (rule.display_only) return 'display_only';
    if (band === 'elite') return 'elite';
    if (band === 'strong') return 'strong';
    if (band === 'caution') return 'caution';
    return 'reject';
}

function isCricketMarketAllowedForFormat(marketKey, format, rule) {
    if (!rule) return false;

    const normalizedFormat = normalizeCricketFormat(format);
    const allowed = Array.isArray(rule.allowed_formats)
        ? rule.allowed_formats.map(normalizeCricketFormat)
        : [];

    return allowed.includes(normalizedFormat);
}

function evaluateCricketInsight({ marketKey, matchFormat, confidence, rule, context = {} }) {
    const normalizedFormat = normalizeCricketFormat(matchFormat);
    const score = Number(confidence || 0);

    if (!rule) {
        return {
            allowed: false,
            recommendation_status: 'rejected',
            reason: `No cricket rule found for market ${marketKey}`,
            confidence_band: 'rejected',
            risk_tier: 'reject',
            acca_eligible: false
        };
    }

    if (!isCricketMarketAllowedForFormat(marketKey, normalizedFormat, rule)) {
        return {
            allowed: false,
            recommendation_status: 'rejected',
            reason: `Market ${marketKey} is not allowed for format ${normalizedFormat}`,
            confidence_band: 'rejected',
            risk_tier: 'reject',
            acca_eligible: false
        };
    }

    if (rule.display_only) {
        return {
            allowed: true,
            recommendation_status: 'display_only',
            reason: rule.notes || 'Display-only market',
            confidence_band: 'display_only',
            risk_tier: 'display_only',
            acca_eligible: false
        };
    }

    if (rule.requires_confirmed_lineup && !context.confirmedLineup) {
        return {
            allowed: score >= Number(rule.min_display_confidence || 60),
            recommendation_status: 'pending_lineup',
            reason: 'Market requires confirmed lineup before full recommendation',
            confidence_band: getConfidenceBand(score, rule),
            risk_tier: 'caution',
            acca_eligible: false
        };
    }

    if (rule.requires_toss && !context.tossKnown) {
        return {
            allowed: score >= Number(rule.min_display_confidence || 60),
            recommendation_status: 'pending_toss',
            reason: 'Market requires toss information before full recommendation',
            confidence_band: getConfidenceBand(score, rule),
            risk_tier: 'caution',
            acca_eligible: false
        };
    }

    if (score < Number(rule.min_display_confidence || 60)) {
        return {
            allowed: false,
            recommendation_status: 'rejected',
            reason: `Confidence ${score}% below minimum ${rule.min_display_confidence}%`,
            confidence_band: 'below_threshold',
            risk_tier: 'reject',
            acca_eligible: false
        };
    }

    const confidenceBand = getConfidenceBand(score, rule);
    const riskTier = getRiskTier(score, rule);

    const accaEligible =
        Boolean(rule.acca_allowed) &&
        Number.isFinite(Number(rule.acca_min_confidence)) &&
        score >= Number(rule.acca_min_confidence) &&
        !context.highVolatility &&
        !context.weatherRiskHigh &&
        !context.lineupRiskHigh &&
        !context.tossRiskHigh;

    return {
        allowed: true,
        recommendation_status: confidenceBand,
        reason: accaEligible
            ? 'Meets cricket market confidence and volatility requirements'
            : 'Meets display requirements but not ACCA requirements',
        confidence_band: confidenceBand,
        risk_tier: riskTier,
        acca_eligible: accaEligible
    };
}

module.exports = {
    normalizeCricketFormat,
    getConfidenceBand,
    getRiskTier,
    isCricketMarketAllowedForFormat,
    evaluateCricketInsight
};