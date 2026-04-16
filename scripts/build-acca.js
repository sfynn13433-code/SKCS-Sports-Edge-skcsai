require('dotenv').config();

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ============================================================
// HOTFIX: STRICT 6-LEG & 12-LEG ACCA ENFORCEMENT
// ============================================================

async function buildAccumulators() {
    console.log('\n=== PHASE 3B: STRICT ACCA BUILDER (6-Fold & 12-Fold) ===\n');
    
    const client = await pool.connect();
    let sixLegAccas = 0;
    let twelveLegAccas = 0;
    let discardedRemainder = 0;
    
    try {
        // STEP 1: Fetch strict rules
        console.log('[STEP 1] Fetching strict acca_rules...');
        
        const rulesResult = await client.query('SELECT * FROM acca_rules');
        const rules = rulesResult.rows;
        
        const exactLegs6 = rules.find(r => r.rule_name === 'exact_legs_6')?.rule_value;
        const exactLegs12 = rules.find(r => r.rule_name === 'exact_legs_12')?.rule_value;
        const tier6 = rules.find(r => r.rule_name === '6fold_tier')?.rule_value;
        const tier12 = rules.find(r => r.rule_name === '12fold_tier')?.rule_value;
        
        console.log(`[STEP 1] Rules: 6-fold=${exactLegs6} (tier=${tier6}), 12-fold=${exactLegs12} (tier=${tier12})`);
        
        // STEP 2: Fetch candidates for each tier
        console.log('\n[STEP 2] Fetching candidate predictions from future matches...');
        
        const allCandidates = [];
        
        // Fetch normal tier candidates for 6-fold
        const normalResult = await client.query(`
            SELECT 
                pf.id,
                pf.matches,
                pf.total_confidence,
                pf.risk_level,
                pf.tier,
                e.id as event_id,
                e.home_team,
                e.away_team,
                e.commence_time
            FROM predictions_final pf
            JOIN LATERAL jsonb_array_elements(pf.matches) m ON true
            JOIN events e ON e.id = (m->>'fixture_id')::text
            WHERE pf.type = 'direct'
            AND pf.tier = $1
            AND e.commence_time > NOW()
            AND (e.status IS NULL OR e.status != 'FT')
            ORDER BY pf.total_confidence DESC
            LIMIT 500
        `, [tier6]);
        
        // Fetch deep tier candidates for 12-fold
        const deepResult = await client.query(`
            SELECT 
                pf.id,
                pf.matches,
                pf.total_confidence,
                pf.risk_level,
                pf.tier,
                e.id as event_id,
                e.home_team,
                e.away_team,
                e.commence_time
            FROM predictions_final pf
            JOIN LATERAL jsonb_array_elements(pf.matches) m ON true
            JOIN events e ON e.id = (m->>'fixture_id')::text
            WHERE pf.type = 'direct'
            AND pf.tier = $1
            AND e.commence_time > NOW()
            AND (e.status IS NULL OR e.status != 'FT')
            ORDER BY pf.total_confidence DESC
            LIMIT 1000
        `, [tier12]);
        
        const normalCandidates = normalResult.rows;
        const deepCandidates = deepResult.rows;
        
        console.log(`[STEP 2] Normal candidates: ${normalCandidates.length}, Deep candidates: ${deepCandidates.length}`);
        
        // STEP 3: Build 6-Fold Accumulators (Normal Tier)
        console.log('\n[STEP 3a] Building 6-Fold Accumulators...');
        
        const legCount6 = 6;
        const usedFixtures6 = new Set();
        const matchesFor6Fold = [];
        
        for (const c of normalCandidates) {
            if (c.event_id && !usedFixtures6.has(c.event_id)) {
                usedFixtures6.add(c.event_id);
                matchesFor6Fold.push(c);
            }
        }
        
        // Chunk into exact 6-leg arrays
        const sixFoldChunks = Math.floor(matchesFor6Fold.length / legCount6);
        discardedRemainder += matchesFor6Fold.length % legCount6;
        
        for (let i = 0; i < sixFoldChunks; i++) {
            const chunk = matchesFor6Fold.slice(i * legCount6, (i + 1) * legCount6);
            
            const finalMatches = chunk.map((m, idx) => ({
                fixture_id: m.event_id,
                home_team: m.home_team,
                away_team: m.away_team,
                commence_time: m.commence_time,
                market: '1X2',
                prediction: m.recommendation,
                confidence: m.total_confidence,
                metadata: { leg_index: idx, acca_name: 'Standard 6-Fold' }
            }));
            
            const avgConfidence = chunk.reduce((sum, m) => sum + (m.total_confidence || 65), 0) / chunk.length;
            
            await client.query(`
                INSERT INTO predictions_final (tier, type, matches, total_confidence, risk_level, sport, market_type, recommendation, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            `, [
                tier6,
                'acca',
                JSON.stringify(finalMatches),
                avgConfidence.toFixed(1),
                'medium',
                'football',
                '1X2',
                'Standard 6-Fold'
            ]);
            
            sixLegAccas++;
        }
        
        console.log(`[STEP 3a] Built ${sixLegAccas} x 6-Fold accumulators, discarded ${matchesFor6Fold.length % legCount6} remainder`);
        
        // STEP 4: Build 12-Fold Accumulators (Deep Tier)
        console.log('\n[STEP 3b] Building 12-Fold Accumulators...');
        
        const legCount12 = 12;
        const usedFixtures12 = new Set();
        const matchesFor12Fold = [];
        
        for (const c of deepCandidates) {
            if (c.event_id && !usedFixtures12.has(c.event_id)) {
                usedFixtures12.add(c.event_id);
                matchesFor12Fold.push(c);
            }
        }
        
        // Chunk into exact 12-leg arrays
        const twelveFoldChunks = Math.floor(matchesFor12Fold.length / legCount12);
        discardedRemainder += matchesFor12Fold.length % legCount12;
        
        for (let i = 0; i < twelveFoldChunks; i++) {
            const chunk = matchesFor12Fold.slice(i * legCount12, (i + 1) * legCount12);
            
            const finalMatches = chunk.map((m, idx) => ({
                fixture_id: m.event_id,
                home_team: m.home_team,
                away_team: m.away_team,
                commence_time: m.commence_time,
                market: '1X2',
                prediction: m.recommendation,
                confidence: m.total_confidence,
                metadata: { leg_index: idx, acca_name: 'Mega 12-Fold' }
            }));
            
            const avgConfidence = chunk.reduce((sum, m) => sum + (m.total_confidence || 65), 0) / chunk.length;
            
            await client.query(`
                INSERT INTO predictions_final (tier, type, matches, total_confidence, risk_level, sport, market_type, recommendation, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            `, [
                tier12,
                'acca',
                JSON.stringify(finalMatches),
                avgConfidence.toFixed(1),
                'high',
                'football',
                '1X2',
                'Mega 12-Fold'
            ]);
            
            twelveLegAccas++;
        }
        
        console.log(`[STEP 3b] Built ${twelveLegAccas} x 12-Fold accumulators, discarded ${matchesFor12Fold.length % legCount12} remainder`);
        
        const totalLegs = (sixLegAccas * legCount6) + (twelveLegAccas * legCount12);
        
        console.log(`\nHOTFIX SUCCESS: Built ${sixLegAccas} 6-leg accas and ${twelveLegAccas} 12-leg accas. Discarded ${discardedRemainder} remainder predictions.`);
        
        return { sixLeg: sixLegAccas, twelveLeg: twelveLegAccas, discarded: discardedRemainder, totalLegs };
        
    } catch (err) {
        console.error('[ERROR]', err.message);
        throw err;
    } finally {
        client.release();
    }
}

// Run if executed directly
if (require.main === module) {
    buildAccumulators()
        .then(r => {
            console.log('\n[RESULT]', JSON.stringify(r));
            process.exit(0);
        })
        .catch(err => {
            console.error('[FATAL]', err.message);
            process.exit(1);
        });
}

module.exports = { buildAccumulators };