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
const { buildContextInsightsFromMetadata } = require('../utils/contextInsights');

const router = express.Router();

const MASTER_PLAN_ID = 'elite_30day_deep_vip';
const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const ELITE_CONFIDENCE_FLOOR = 75;

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

function toConfidencePercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    const normalized = n > 0 && n <= 1 ? n * 100 : n;
    return Math.max(0, Math.min(100, normalized));
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

function getPredictionConfidencePercent(row) {
    const explicit = toConfidencePercent(row?.total_confidence);
    if (explicit > 0) return roundConfidence(explicit);
    return resolveAverageLegConfidence(row, Array.isArray(row?.matches) ? row.matches : []);
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
    const matchesWithContext = matches.map((match) => {
        const contextInsights = buildContextInsightsFromMetadata(match?.metadata?.context_intelligence || null);
        const routerMeta = match?.metadata?.market_router || {};
        return {
            ...match,
            context_insights: contextInsights,
            final_recommendation: routerMeta?.final_recommendation || {
                market: String(match?.market || '').toUpperCase(),
                confidence: Number(match?.confidence || row?.total_confidence || 0)
            },
            engine_log: Array.isArray(routerMeta.engine_log) ? routerMeta.engine_log : [],
            insights: routerMeta?.insights || {
                weather: contextInsights?.chips?.weather || 'Unavailable',
                availability: contextInsights?.chips?.injuries_bans || 'No major absences',
                stability: contextInsights?.chips?.stability || 'Unknown'
            }
        };
    });
    const validation = category === 'same_match'
        ? validateInsightLegGroup(matchesWithContext)
        : null;

    // Extract new stabilized fields from row or first match metadata
    const firstMatch = matchesWithContext[0] || {};
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
        context_insights: firstMatch?.context_insights || buildContextInsightsFromMetadata(firstMatch?.metadata?.context_intelligence || null),
        final_recommendation: firstMatch?.final_recommendation || null,
        engine_log: Array.isArray(firstMatch?.engine_log) ? firstMatch.engine_log : [],
        insights: firstMatch?.insights || null,
        matches: matchesWithContext
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
        // Force fresh response — no caching
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        const includeAll = ['1', 'true'].includes(String(req.query.include_all || '').trim().toLowerCase());
        const day = normalizeDay(req.query.day || 'saturday');
        const now = new Date();
        const generatedAt = now.toISOString();
        const referenceDate = resolveReferenceDateForDay(day, now);
        const masterPlan = getPlanCapabilities(MASTER_PLAN_ID);
        const dailyLimits = calculateDailyAllocations(MASTER_PLAN_ID, day) || {};

        // Fetch the latest publish_run_id to avoid stale rows (unless include_all bypass is active)
        let latestPublishRunId = null;
        if (!includeAll) {
            const latestRunRes = await query(
                `SELECT id FROM prediction_publish_runs WHERE status = 'completed' ORDER BY created_at DESC LIMIT 1`
            );
            latestPublishRunId = latestRunRes.rows.length ? latestRunRes.rows[0].id : null;
        }

        console.log('[vip/stress-payload] latest_publish_run_id=%s include_all=%s', latestPublishRunId, includeAll ? '1' : '0');

        // include_all bypass: query wide set for UI stress testing without plan/tier gating.
        const queryText = includeAll
            ? `SELECT id, publish_run_id, tier, type, matches, total_confidence, risk_level, created_at
               FROM direct1x2_prediction_final
               WHERE LOWER(COALESCE(sport, 'football')) = 'football'
               ORDER BY created_at DESC
               LIMIT 2500`
            : latestPublishRunId
                ? `SELECT id, publish_run_id, tier, type, matches, total_confidence, risk_level, created_at
                   FROM direct1x2_prediction_final
                   WHERE publish_run_id = $1
                     AND LOWER(COALESCE(sport, 'football')) = 'football'
                   ORDER BY total_confidence DESC, created_at DESC
                   LIMIT 3000`
                : `SELECT id, publish_run_id, tier, type, matches, total_confidence, risk_level, created_at
                   FROM direct1x2_prediction_final
                   WHERE LOWER(COALESCE(tier, 'normal')) = ANY($1::text[])
                     AND LOWER(COALESCE(sport, 'football')) = 'football'
                   ORDER BY total_confidence DESC, created_at DESC
                   LIMIT 3000`;
        const queryParams = includeAll
            ? []
            : (latestPublishRunId ? [latestPublishRunId] : masterPlan.tiers.map((tier) => String(tier).toLowerCase()));

        const dbRes = await query(queryText, queryParams);

        console.log('[vip/stress-payload] db_rows=%d tier_filter=%s', dbRes.rows.length, includeAll ? 'include_all' : (latestPublishRunId ? `run_${latestPublishRunId}` : 'tier-only'));

        const rows = (dbRes.rows || []).map(shapePrediction).sort(compareRows);

        // Pre-response logging: log fixture key sets for ACCA cards to detect duplicates
        const accaRows = rows.filter(r => r.section_type === 'acca_6match' || r.section_type === 'mega_acca_12');
        const fixtureSets = accaRows.map(r => ({
            label: r.display_label || r.type,
            fixtureKeys: (r.matches || []).map(m => m.match_id).filter(Boolean),
        }));
        console.log('[vip response] acca_cards=%d', accaRows.length);
        console.log('[vip response] labels=%o', accaRows.map(r => r.display_label));
        console.log('[vip response] fixture_sets=%o', fixtureSets);
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
            const confidencePct = getPredictionConfidencePercent(row);
            const passesEliteFloor = confidencePct >= ELITE_CONFIDENCE_FLOOR;

            if (row.section_type === 'direct') buckets.direct.push(row);
            else if (row.section_type === 'secondary' && (includeAll || passesEliteFloor)) buckets.analytical_insights.push(row);
            else if (row.section_type === 'multi' && passesEliteFloor) buckets.multi.push(row);
            else if (row.section_type === 'same_match' && passesEliteFloor && (includeAll || row.validation_matrix?.valid === true)) buckets.same_match.push(row);
            else if (row.section_type === 'acca_6match') buckets.acca_6match.push(row);
            else if (row.section_type === 'mega_acca_12' && (includeAll || megaIsValid(row, masterPlan, now))) buckets.mega_acca_12.push(row);
        }

        const selected = includeAll
            ? {
                direct: buckets.direct,
                analytical_insights: buckets.analytical_insights,
                multi: buckets.multi,
                same_match: buckets.same_match,
                acca_6match: buckets.acca_6match,
                mega_acca_12: buckets.mega_acca_12
            }
            : {
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
            include_all: includeAll,
            day,
            quotas: required,
            fulfilled,
            total_selected: Object.values(fulfilled).reduce((acc, value) => acc + value, 0),
            categories: selected
        };

        return res.status(200).json({
            ok: true,
            source_rows: rows.length,
            build_commit: '8e429fe',
            build_timestamp: generatedAt,
            builder_version: 'skcs-card-uniqueness-v3',
            publish_run_id: latestPublishRunId,
            generated_at: generatedAt,
            include_all: includeAll,
            payload,
            tier_coverage: buildCoverageMatrix(day, fulfilled, referenceDate, rows)
        });
    } catch (err) {
        console.error('[vip/stress-payload] error:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
