const express = require('express');
const router = express.Router();
const db = require('../../db');

router.get('/:fixture_id', async (req, res) => {
    try {
        const { fixture_id } = req.params;
        const result = await db.query(
            `SELECT market_key as market, recommendation as prediction, confidence, metadata->>'edgemind_report' as reasoning
             FROM secondary_market_predictions
             WHERE fixture_id = $1`,
            [fixture_id]
        );
        res.json({ markets: result.rows });
    } catch (e) {
        console.error('[Secondary Markets API] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
