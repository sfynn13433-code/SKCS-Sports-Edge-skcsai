// API v1 ACCA Builder Endpoint for SKCS Master Rulebook
// POST /api/v1/acca/build

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { validate_acca_correlations } = require('../../db'); // From correlation schema
const { requireSupabaseUser } = require('../../middleware/supabaseJwt');
const accaBuilder = require('../../services/accaBuilder');

// Constants from Master Rulebook
const MAX_CORRELATION = 0.5;
const MIN_LEG_CONFIDENCE = 75;
const MAX_ACCA_LEGS = 12;

const MOCK_USER_UUID = '7dab62ea-8a25-42f7-9e28-032e7fa34a26';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.post('/acca/build', requireSupabaseUser, async (req, res) => {
    try {
        const { prediction_ids, matches } = req.body;
        let userId = req.user?.id;
        if (!userId || !UUID_REGEX.test(userId)) userId = MOCK_USER_UUID;
        
        let candidates = [];
        if (matches && Array.isArray(matches)) {
            for (const m of matches) {
                if (m.confidence >= 75) {
                    candidates.push({
                        match_id: String(m.match_id),
                        fixture_id: String(m.match_id),
                        market: m.market || '1x2',
                        prediction: m.prediction || 'home_win',
                        confidence: Number(m.confidence),
                        market_tier: 1,
                        odds: Number(m.odds) || 1.85,
                        type: 'SINGLE'
                    });
                } else {
                    const fallbacks = await accaBuilder.getDoubleChanceLegs([String(m.match_id)], 75, db);
                    if (fallbacks.length > 0) {
                        const fb = fallbacks[0];
                        candidates.push({
                            ...fb,
                            match_id: String(m.match_id),
                            fixture_id: String(m.match_id),
                            market: fb.market,
                            prediction: fb.pick,
                            confidence: Number(fb.confidence),
                            market_tier: 2,
                            odds: 1.45,
                            type: 'SINGLE'
                        });
                    } else {
                        candidates.push({
                            match_id: String(m.match_id),
                            fixture_id: String(m.match_id),
                            market: m.market || '1x2',
                            prediction: m.prediction || 'home_win',
                            confidence: Number(m.confidence),
                            market_tier: 1,
                            odds: Number(m.odds) || 1.85,
                            type: 'SINGLE'
                        });
                    }
                }
            }
        } else if (prediction_ids && Array.isArray(prediction_ids)) {
            for (const id of prediction_ids) {
                const val = await validateAccaLeg(id);
                if (val.valid) candidates.push({ ...val.prediction, market: val.prediction.market_type, type: 'SINGLE' });
            }
        } else {
            return res.status(400).json({ error: 'prediction_ids or matches array is required' });
        }
        
        if (candidates.length < 2) {
            return res.status(400).json({ error: 'Accumulator must have at least 2 legs', count: candidates.length });
        }
        
        const buildResult = accaBuilder.buildAccaV2({
            tier: 'normal',
            minSize: 2,
            maxSize: req.body.max_legs || 12,
            candidates: candidates
        });

        if (!buildResult.ok) {
            return res.status(400).json({
                error: `ACCA Build Failed: ${buildResult.reason}`,
                debug: {
                    candidates_in: candidates.map(c => ({ id: c.match_id, conf: c.confidence, m: c.market })),
                    build_result: buildResult
                }
            });
        }

        const finalLegs = buildResult.legs;
        const correlationValidation = await validateAccaCorrelations(finalLegs);
        if (!correlationValidation.valid) {
            return res.status(400).json({ error: 'Correlation conflict', conflicts: correlationValidation.conflicts });
        }
        
        const metrics = calculateAccaMetrics(finalLegs);
        const accaRes = await db.query(`
            INSERT INTO accas (user_id, total_confidence, combined_odds, leg_count, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())
            RETURNING id, total_confidence, combined_odds, leg_count, status, created_at
        `, [userId, metrics.averageConfidence, metrics.combinedOdds, finalLegs.length]);
        
        const newAcca = accaRes.rows[0];
        for (const leg of finalLegs) {
            const numId = parseInt(leg.match_id);
            if (!isNaN(numId)) {
                await db.query(`INSERT INTO acca_legs (acca_id, prediction_id, created_at) VALUES ($1, $2, NOW())`, [newAcca.id, numId]);
            }
        }
        
        const tierCounts = { tier1: 0, tier2: 0, tier3: 0 };
        finalLegs.forEach(leg => {
            const t = leg.market_tier || (leg.market === '1x2' || leg.market === '1X2' ? 1 : 2);
            tierCounts[`tier${t}`] = (tierCounts[`tier${t}`] || 0) + 1;
        });

        res.status(200).json({
            acca: { ...newAcca, estimated_return: metrics.combinedOdds, risk_assessment: { risk_level: metrics.averageConfidence < 75 ? 'Medium' : 'Low' } },
            leg_composition: tierCounts,
            legs: finalLegs.map(leg => ({
                match_id: leg.match_id,
                market: leg.market,
                prediction: leg.pick,
                confidence: Number(leg.confidence),
                market_tier: leg.market_tier,
                odds: leg.odds
            })),
            validation_summary: { passed_validation: finalLegs.length, max_correlation: correlationValidation.maxCorrelation }
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Internal error', message: error.message });
    }
});

async function validateAccaLeg(id) {
    const res = await db.query(`SELECT * FROM direct1x2_prediction_final WHERE id = $1`, [id]);
    if (res.rows.length === 0) return { valid: false };
    const p = res.rows[0];
    return { valid: true, prediction: { ...p, match_id: p.fixture_id, odds: p.odds || 1.85 } };
}

async function validateAccaCorrelations(legs) {
    for (let i = 0; i < legs.length; i++) {
        for (let j = i + 1; j < legs.length; j++) {
            const corr = await getMarketCorrelation(normalizeMarketKey(legs[i].market), normalizeMarketKey(legs[j].market));
            if (corr > 0.5) return { valid: false, conflicts: [{ a: legs[i].match_id, b: legs[j].match_id, corr }] };
        }
    }
    return { valid: true, maxCorrelation: 0 };
}

async function getMarketCorrelation(marketA, marketB) {
    const res = await db.query(`SELECT correlation FROM market_correlations WHERE (market_a = $1 AND market_b = $2) OR (market_a = $2 AND market_b = $1) LIMIT 1`, [marketA, marketB]);
    return res.rows.length > 0 ? Number(res.rows[0].correlation) : 0.0;
}

function calculateAccaMetrics(legs) {
    const avg = legs.reduce((s, p) => s + Number(p.confidence), 0) / legs.length;
    const odds = legs.reduce((p, l) => p * (Number(l.odds) || 1.85), 1.0);
    return { averageConfidence: avg, combinedOdds: odds };
}

function normalizeMarketKey(m) { return String(m || '').trim().toLowerCase().replace(/\s+/g, '_'); }

router.get('/acca/history', requireSupabaseUser, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM accas WHERE user_id = $1 ORDER BY created_at DESC', [req.user?.id]);
        res.json({ accas: result.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
