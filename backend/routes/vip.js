'use strict';

const express = require('express');
const { query } = require('../db');
const { requireRole } = require('../utils/auth');
const {
    SUBSCRIPTION_MATRIX,
    calculateDailyAllocations,
    getPlanCapabilities,
    getMegaAccaDailyAllocation
} = require('../config/subscriptionMatrix');
const { validateInsightLegGroup } = require('../utils/insightValidationMatrix');

const router = express.Router();

const MASTER_PLAN_ID = 'elite_30day_deep_vip';
const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function normalizeDay(dayName) {
    const normalized = String(dayName || '').trim().toLowerCase();
    if (DAY_NAMES.includes(normalized)) return normalized;
    return 'saturday';
}

function getUtcWeekdayIndex(date) {
    const day = String(date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) || '').toLowerCase();
    return DAY_NAMES.indexOf(day);
}

function resolveReferenceDateForDay(day, now = new Date()) {
    const targetDay = normalizeDay(day);
    const targetIndex = DAY_NAMES.indexOf(targetDay);
    if (targetIndex < 0) return now;

    const reference = new Date(now);
    const currentIndex = getUtcWeekdayIndex(reference);
    if (currentIndex < 0) return reference;

    let delta = targetIndex - currentIndex;
    if (delta < 0) delta += 7;

    reference.setUTCDate(reference.getUTCDate() + delta);
    reference.setUTCHours(12, 0, 0, 0);
    return reference;
}

function normalizeSportName(value) {
    const sport = String(value || '').trim().toLowerCase();
    if (!sport) return '';
    if (sport.startsWith('soccer_')) return 'football';
    if (sport.startsWith('icehockey_')) return 'hockey';
    if (sport.startsWith('basketball_')) return 'basketball';
    if (sport.startsWith('americanfootball_')) return 'nfl';
    if (sport.startsWith('baseball_')) return 'baseball';
    if (sport.startsWith('rugbyunion_')) return 'rugby';
    if (sport.startsWith('aussierules_')) return 'afl';
    if (sport.startsWith('mma_')) return 'mma';
    return sport;
}

function parseKickoff(match) {
    const value =
        match?.commence_time ||
        match?.match_date ||
        match?.metadata?.match_time ||
        match?.metadata?.kickoff ||
        match?.metadata?.kickoff_time ||
        null;
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inferCategory(row) {
    const explicit = String(row?.type || '').trim().toLowerCase();
    const matches = Array.isArray(row?.matches) ? row.matches : [];

    if (explicit === 'direct' || explicit === 'secondary' || explicit === 'multi' || explicit === 'same_match' || explicit === 'mega_acca_12') {
        return explicit;
    }
    if (explicit === 'acca') return matches.length >= 12 ? 'mega_acca_12' : 'acca_6match';
    if (explicit === 'acca_6match') return 'acca_6match';
    if (matches.length >= 12) return 'mega_acca_12';
    if (matches.length >= 6) return 'acca_6match';
    if (matches.length >= 2) {
        const uniqueTeams = new Set(matches.map((match) => {
            const home = String(match?.home_team || match?.metadata?.home_team || '').trim().toLowerCase();
            const away = String(match?.away_team || match?.metadata?.away_team || '').trim().toLowerCase();
            return `${home}_${away}`;
        }));
        return uniqueTeams.size === 1 ? 'same_match' : 'multi';
    }
    const market = String(matches[0]?.market || '').trim().toLowerCase();
    if (matches.length === 1 && market && market !== '1x2' && market !== 'match_result') return 'secondary';
    return 'direct';
}

function compareRows(a, b) {
    const confidenceA = Number(a?.total_confidence || 0);
    const confidenceB = Number(b?.total_confidence || 0);
    if (confidenceB !== confidenceA) return confidenceB - confidenceA;
    return new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime();
}

function roundConfidence(value) {
    if (!Number.isFinite(Number(value))) return 0;
    return Math.round(Number(value) * 100) / 100;
}

function computeAverageLegConfidence(matches = []) {
    const values = (Array.isArray(matches) ? matches : [])
        .map((match) => Number(match?.confidence))
        .filter((value) => Number.isFinite(value));
    if (!values.length) return 0;
    return roundConfidence(Math.max(0, Math.min(100, values.reduce((sum, value) => sum + value, 0) / values.length)));
}

function resolveAverageLegConfidence(row, matches = []) {
    const explicit = Number(row?.average_leg_confidence);
    if (Number.isFinite(explicit)) return roundConfidence(Math.max(0, Math.min(100, explicit)));
    const fromMetadata = Number(matches?.[0]?.metadata?.average_leg_confidence);
    if (Number.isFinite(fromMetadata)) return roundConfidence(Math.max(0, Math.min(100, fromMetadata)));
    return computeAverageLegConfidence(matches);
}

function megaIsValid(row, plan, now = new Date()) {
    const constraints = plan?.capabilities?.mega_acca_constraints;
    if (!constraints) return true;
    const matches = Array.isArray(row?.matches) ? row.matches : [];
    if (!matches.length) return false;

    if (matches.some((match) => Number(match?.confidence || 0) < Number(constraints.min_leg_confidence || 0))) {
        return false;
    }

    if (!constraints.cricket_must_finish_before_expiry) return true;

    const expiry = new Date(now);
    expiry.setUTCDate(expiry.getUTCDate() + Number(plan.duration_days || 0));

    return matches.every((match) => {
        if (normalizeSportName(match?.sport || match?.metadata?.sport || '') !== 'cricket') return true;
        const kickoff = parseKickoff(match);
        if (!kickoff) return false;
        const estimatedCompletion = new Date(kickoff.getTime() + (12 * 60 * 60 * 1000));
        return estimatedCompletion <= expiry;
    });
}

function shapePrediction(row) {
    const category = inferCategory(row);
    const matches = Array.isArray(row?.matches) ? row.matches : [];
    const validation = category === 'same_match'
        ? validateInsightLegGroup(matches)
        : null;

    // Extract new stabilized fields from row or first match metadata
    const firstMatch = matches[0] || {};
    const displayLabel = row.display_label ||
        firstMatch.metadata?.display_label ||
        row.ticket_label ||
        firstMatch.metadata?.acca_ticket_label ||
        null;
    const totalTicketProbability = row.total_ticket_probability_display ||
        firstMatch.metadata?.total_ticket_probability_display ||
        null;
    const compoundConfidence = row.compound_ticket_confidence ||
        firstMatch.metadata?.compound_ticket_confidence ||
        null;
    const diversityBreakdown = row.diversity_breakdown ||
        firstMatch.metadata?.diversity_breakdown ||
        null;

    return {
        id: row.id,
        publish_run_id: row.publish_run_id,
        tier: row.tier,
        type: row.type,
        section_type: category,
        total_confidence: Number(row.total_confidence || 0),
        average_leg_confidence: resolveAverageLegConfidence(row, matches),
        display_label: displayLabel,
        total_ticket_probability: totalTicketProbability,
        compound_ticket_confidence: compoundConfidence,
        diversity_breakdown: diversityBreakdown,
        risk_level: row.risk_level,
        created_at: row.created_at,
        validation_matrix: validation,
        matches
    };
}

function buildCoverageMatrix(day, masterCounts, referenceDate, sourceRows) {
    const coverage = {};
    for (const planId of Object.keys(SUBSCRIPTION_MATRIX)) {
        const limits = calculateDailyAllocations(planId, day) || {};
        const plan = getPlanCapabilities(planId);
        const required = {
            direct: Number(limits.direct || 0),
            analytical_insights: Number(limits.secondary || 0),
            multi: Number(limits.multi || 0),
            same_match: Number(limits.same_match || 0),
            acca_6match: Number(limits.acca_6match || 0),
            mega_acca_12: getMegaAccaDailyAllocation(planId, referenceDate, { predictions: sourceRows })
        };

        const shortages = {};
        for (const key of Object.keys(required)) {
            const have = Number(masterCounts[key] || 0);
            if (have < required[key]) shortages[key] = required[key] - have;
        }

        coverage[planId] = {
            plan_id: planId,
            plan_name: plan?.name || planId,
            required,
            covered: Object.keys(shortages).length === 0,
            shortages
        };
    }

    return coverage;
}

router.get('/stress-payload', requireRole('user'), async (req, res) => {
    try {
        const day = normalizeDay(req.query.day || 'saturday');
        const now = new Date();
        const referenceDate = resolveReferenceDateForDay(day, now);
        const masterPlan = getPlanCapabilities(MASTER_PLAN_ID);
        const dailyLimits = calculateDailyAllocations(MASTER_PLAN_ID, day) || {};

        const dbRes = await query(
            `
            SELECT id, publish_run_id, tier, type, matches, total_confidence, risk_level, created_at
            FROM predictions_final
            WHERE LOWER(COALESCE(tier, 'normal')) = ANY($1::text[])
            ORDER BY total_confidence DESC, created_at DESC
            LIMIT 3000
            `,
            [masterPlan.tiers.map((tier) => String(tier).toLowerCase())]
        );

        const rows = (dbRes.rows || []).map(shapePrediction).sort(compareRows);
        const required = {
            direct: Number(dailyLimits.direct || 0),
            analytical_insights: Number(dailyLimits.secondary || 0),
            multi: Number(dailyLimits.multi || 0),
            same_match: Number(dailyLimits.same_match || 0),
            acca_6match: Number(dailyLimits.acca_6match || 0),
            mega_acca_12: getMegaAccaDailyAllocation(MASTER_PLAN_ID, referenceDate, { predictions: rows })
        };
        const buckets = {
            direct: [],
            analytical_insights: [],
            multi: [],
            same_match: [],
            acca_6match: [],
            mega_acca_12: []
        };

        for (const row of rows) {
            if (row.section_type === 'direct') buckets.direct.push(row);
            else if (row.section_type === 'secondary') buckets.analytical_insights.push(row);
            else if (row.section_type === 'multi') buckets.multi.push(row);
            else if (row.section_type === 'same_match' && row.validation_matrix?.valid === true) buckets.same_match.push(row);
            else if (row.section_type === 'acca_6match') buckets.acca_6match.push(row);
            else if (row.section_type === 'mega_acca_12' && megaIsValid(row, masterPlan, now)) buckets.mega_acca_12.push(row);
        }

        const selected = {
            direct: buckets.direct.slice(0, required.direct),
            analytical_insights: buckets.analytical_insights.slice(0, required.analytical_insights),
            multi: buckets.multi.slice(0, required.multi),
            same_match: buckets.same_match.slice(0, required.same_match),
            acca_6match: buckets.acca_6match.slice(0, required.acca_6match),
            mega_acca_12: buckets.mega_acca_12.slice(0, required.mega_acca_12)
        };

        const fulfilled = {
            direct: selected.direct.length,
            analytical_insights: selected.analytical_insights.length,
            multi: selected.multi.length,
            same_match: selected.same_match.length,
            acca_6match: selected.acca_6match.length,
            mega_acca_12: selected.mega_acca_12.length
        };

        const payload = {
            generated_at_utc: new Date().toISOString(),
            baseline_plan: MASTER_PLAN_ID,
            day,
            quotas: required,
            fulfilled,
            total_selected: Object.values(fulfilled).reduce((acc, value) => acc + value, 0),
            categories: selected
        };

        return res.status(200).json({
            ok: true,
            source_rows: rows.length,
            payload,
            tier_coverage: buildCoverageMatrix(day, fulfilled, referenceDate, rows)
        });
    } catch (err) {
        console.error('[vip/stress-payload] error:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
