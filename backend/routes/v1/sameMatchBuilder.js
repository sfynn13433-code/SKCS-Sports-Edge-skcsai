const express = require('express');
const router = express.Router();
const db = require('../../db');

router.get('/build', async (req, res) => {
    try {
        const { fixture_id, legs = 4 } = req.query;
        const legCount = parseInt(legs, 10);
        if (![4, 6, 8].includes(legCount)) {
            return res.status(400).json({ error: 'legs must be 4, 6, or 8' });
        }

        // Fetch primary prediction (1X2)
        const primaryResult = await db.query(
            `SELECT market_type as market_key, prediction, confidence, edgemind_report as reasoning, id
             FROM direct1x2_prediction_final 
             WHERE fixture_id = $1 AND is_published = TRUE AND market_type IN ('1x2', '1X2') LIMIT 1`,
            [String(fixture_id)]
        );
        const primary = primaryResult.rows[0];

        // Fetch secondary predictions (all tiers)
        const secondaryResult = await db.query(
            `SELECT market_key, market_tier, recommendation as prediction, confidence, metadata->>'edgemind_report' as reasoning, id
             FROM secondary_market_predictions
             WHERE fixture_id = $1`,
            [String(fixture_id)]
        );
        const secondary = secondaryResult.rows;

        if (!primary && (!secondary || secondary.length === 0)) {
            return res.json({ combos: [], reasoning: "Not enough prediction data to build combinations for this match." });
        }

        console.log('[SMB] Primary found:', !!primary);
        console.log('[SMB] Secondary count:', secondary.length);

        const tier2 = secondary.filter(m => m.market_tier === 2);
        const tier3 = secondary.filter(m => m.market_tier === 3);

        // Build combos: always include Tier-1 (primary), then select from Tier-2 markets to fill legCount.
        const combos = [];
        
        if (legCount === 4) {
            const chosen = [primary].concat(tier2.slice(0, 3)).filter(Boolean);
            if (chosen.length === 4) combos.push(chosen);
        } else if (legCount === 6) {
            const chosen = [primary].concat(tier2.slice(0, 5)).filter(Boolean);
            if (chosen.length === 6) combos.push(chosen);
        } else if (legCount === 8) {
            const needed = 7;
            const fromTier2 = tier2.slice(0, Math.min(needed, tier2.length));
            const remaining = needed - fromTier2.length;
            const fromTier3 = tier3.slice(0, remaining);
            const chosen = [primary].concat(fromTier2, fromTier3).filter(Boolean);
            if (chosen.length === 8) combos.push(chosen);
        }

        const reasoning = `SMB ${legCount}-leg combo for ${primary?.prediction || 'this match'} using real market data.`;

        res.json({ combos, reasoning });
    } catch (e) {
        console.error('[SMB API] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
