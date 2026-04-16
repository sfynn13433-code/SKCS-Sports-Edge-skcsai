require('dotenv').config();

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ============================================================
// PHASE 3B: ACCA BUILDER
// ============================================================

async function buildAccumulators() {
    console.log('\n=== PHASE 3B: ACCA BUILDER ===\n');
    
    const client = await pool.connect();
    let totalAccas = 0;
    let totalLegs = 0;
    
    try {
        // STEP 1: Fetch rules
        console.log('[STEP 1] Fetching acca_rules and tier_rules...');
        
        const [accaRulesResult, tierRulesResult] = await Promise.all([
            client.query('SELECT * FROM acca_rules'),
            client.query('SELECT * FROM tier_rules')
        ]);
        
        const accaRules = accaRulesResult.rows;
        const tierRules = tierRulesResult.rows;
        
        console.log(`[STEP 1] Found ${accaRules.length} acca rules, ${tierRules.length} tier rules`);
        
        // STEP 2: Fetch candidates - join with events to get future matches only
        console.log('\n[STEP 2] Fetching candidate predictions from future matches...');
        
        const candidatesResult = await client.query(`
            SELECT 
                pf.id,
                pf.matches,
                pf.total_confidence,
                pf.risk_level,
                pf.tier,
                pf.type,
                pf.sport,
                pf.market_type,
                pf.recommendation,
                e.id as event_id,
                e.home_team,
                e.away_team,
                e.commence_time
            FROM predictions_final pf
            JOIN LATERAL jsonb_array_elements(pf.matches) m ON true
            JOIN events e ON e.id = (m->>'fixture_id')::text
            WHERE pf.type = 'direct'
            AND e.commence_time > NOW()
            AND (e.status IS NULL OR e.status != 'FT')
            AND pf.tier IN ('normal', 'deep')
            ORDER BY pf.total_confidence DESC
            LIMIT 200
        `);
        
        const candidates = candidatesResult.rows;
        console.log(`[STEP 2] Found ${candidates.length} candidate predictions`);
        
        if (candidates.length === 0) {
            console.log('No candidates available for accumulators');
            return { accas: 0, legs: 0 };
        }
        
        // STEP 3: Build accumulators
        console.log('\n[STEP 3] Building accumulators...');
        
        // Group by tier
        const normalCandidates = candidates.filter(c => c.tier === 'normal');
        const deepCandidates = candidates.filter(c => c.tier === 'deep');
        
        const accaConfigs = [
            { name: 'Safe Double', minLegs: 2, maxLegs: 2, risk: 'low', source: 'normal', count: 10 },
            { name: 'Medium Acca 3-Fold', minLegs: 3, maxLegs: 3, risk: 'medium', source: 'normal', count: 5 },
            { name: 'Deep 4-Fold', minLegs: 4, maxLegs: 4, risk: 'medium', source: 'deep', count: 5 },
            { name: 'High Roller 5-Fold', minLegs: 5, maxLegs: 5, risk: 'high', source: 'deep', count: 3 }
        ];
        
        for (const config of accaConfigs) {
            const poolCandidates = config.source === 'deep' ? deepCandidates : normalCandidates;
            
            // Get unique fixtures for this pool
            const usedFixtures = new Set();
            const poolMatches = [];
            
            for (const c of poolCandidates) {
                if (poolMatches.length >= config.maxLegs) break;
                if (c.event_id && !usedFixtures.has(c.event_id)) {
                    usedFixtures.add(c.event_id);
                    poolMatches.push(c);
                }
            }
            
            if (poolMatches.length < config.minLegs) {
                console.log(`[STEP 3] Skipping ${config.name} - not enough matches`);
                continue;
            }
            
            // Build accumulator matches array
            const finalMatches = poolMatches.map((m, idx) => ({
                fixture_id: m.event_id,
                home_team: m.home_team,
                away_team: m.away_team,
                league: m.league || null,
                commence_time: m.commence_time,
                market: '1X2',
                prediction: m.recommendation,
                confidence: m.total_confidence,
                metadata: { leg_index: idx, acca_name: config.name }
            }));
            
            const avgConfidence = poolMatches.reduce((sum, m) => sum + (m.total_confidence || 65), 0) / poolMatches.length;
            const riskLevel = config.risk;
            
            // STEP 4: Insert directly into predictions_final as ACCA type
            await client.query(`
                INSERT INTO predictions_final (tier, type, matches, total_confidence, risk_level, sport, market_type, recommendation, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            `, [
                config.source,
                'acca',
                JSON.stringify(finalMatches),
                avgConfidence,
                riskLevel,
                'football',
                '1X2',
                config.name
            ]);
            
            console.log(`[STEP 3] Built ${config.name}: ${poolMatches.length} legs, tier=${config.source}, confidence=${avgConfidence.toFixed(1)}`);
            totalAccas++;
            totalLegs += poolMatches.length;
        }
        
        console.log(`\nPHASE 3B SUCCESS: Built ${totalAccas} accumulators containing ${totalLegs} total legs and published to predictions_final.`);
        return { accas: totalAccas, legs: totalLegs };
        
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