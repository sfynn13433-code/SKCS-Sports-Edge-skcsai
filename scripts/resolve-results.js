require('dotenv').config();

const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const APISPORTS_KEY = process.env.X_APISPORTS_KEY;

// ============================================================
// PHASE 3A: RESOLUTION & ACCURACY ENGINE
// ============================================================

async function resolveResults() {
    console.log('\n=== PHASE 3A: RESOLUTION ENGINE ===\n');
    
    const client = await pool.connect();
    let resolvedCount = 0;
    let gradedCount = 0;
    
    try {
        // STEP 1: Find matches that should be finished
        console.log('[STEP 1] Finding matches to resolve...');
        
        const result = await client.query(`
            SELECT id, home_team, away_team, commence_time
            FROM events
            WHERE commence_time < NOW() - INTERVAL '3 hours'
            AND (status IS NULL OR status != 'FT')
            ORDER BY commence_time DESC
            LIMIT 50
        `);
        
        const matchesToResolve = result.rows;
        console.log(`[STEP 1] Found ${matchesToResolve.length} matches needing resolution`);
        
        if (matchesToResolve.length === 0) {
            console.log('No matches to resolve. All caught up!');
            return { resolved: 0, graded: 0 };
        }
        
        // STEP 2: Fetch final scores from API-Sports
        console.log('\n[STEP 2] Fetching final scores from API-Sports...');
        
        for (const match of matchesToResolve) {
            try {
                const response = await axios.get('https://v3.football.api-sports.io/fixtures', {
                    params: { id: match.id },
                    headers: { 'x-apisports-key': APISPORTS_KEY },
                    timeout: 10000
                });
                
                const fixture = response.data?.response?.[0];
                if (!fixture) {
                    console.warn(`[STEP 2] No fixture found for ID ${match.id}`);
                    continue;
                }
                
                const homeScore = fixture.goals?.home ?? null;
                const awayScore = fixture.goals?.away ?? null;
                const status = fixture.fixture?.status?.short || 'FT';
                
                // STEP 3: Update events table
                await client.query(`
                    UPDATE events 
                    SET status = $1, 
                        home_score = $2, 
                        away_score = $3
                    WHERE id = $4
                `, [status, homeScore, awayScore, match.id]);
                
                console.log(`[STEP 3] Updated ${match.home_team} vs ${match.away_team}: ${homeScore}-${awayScore} (${status})`);
                resolvedCount++;
                
                // STEP 4: Grade predictions
                if (homeScore !== null && awayScore !== null) {
                    await gradePrediction(client, match.id, homeScore, awayScore, status);
                    gradedCount++;
                }
                
            } catch (err) {
                console.error(`[ERROR] Failed to resolve ${match.id}:`, err.message);
            }
        }
        
        console.log(`\nPHASE 3A SUCCESS: Resolved ${resolvedCount} matches and graded ${gradedCount} predictions.`);
        return { resolved: resolvedCount, graded: gradedCount };
        
    } catch (err) {
        console.error('[FATAL]', err.message);
        throw err;
    } finally {
        client.release();
    }
}

// ============================================================
// GRADING FUNCTION
// ============================================================

async function gradePrediction(client, fixtureId, homeScore, awayScore, status) {
    // Find predictions for this fixture
    const predResult = await client.query(`
        SELECT id, matches, recommendation
        FROM predictions_final
        WHERE matches::text LIKE '%${fixtureId}%'
    `);
    
    if (predResult.rows.length === 0) {
        return;
    }
    
for (const pred of predResult.rows) {
        let result = 'VOID';
        
        try {
            const rec = pred.recommendation?.toLowerCase() || '';
            
            // More comprehensive grading for 1X2 markets
            if (rec.includes('home') || rec === '1' || rec === 'home_win' || rec.includes('home win')) {
                result = homeScore > awayScore ? 'WON' : 'LOST';
            } else if (rec.includes('draw') || rec === 'x' || rec === 'draw') {
                result = homeScore === awayScore ? 'WON' : 'LOST';
            } else if (rec.includes('away') || rec === '2' || rec.includes('away_win') || rec.includes('away win')) {
                result = awayScore > homeScore ? 'WON' : 'LOST';
            } else {
                // Default: assume home win
                result = homeScore > awayScore ? 'WON' : 'LOST';
            }
            
            // Extract market from matches JSON
            let market = '1X2';
            try {
                const matches = typeof pred.matches === 'string' ? JSON.parse(pred.matches) : pred.matches;
                if (matches && matches[0] && matches[0].market) {
                    market = matches[0].market;
                }
            } catch (e) {}
            
            // Insert into predictions_accuracy
            await client.query(`
                INSERT INTO predictions_accuracy (
                    prediction_final_id, 
                    prediction_match_index,
                    event_id, 
                    predicted_outcome, 
                    actual_result, 
                    is_correct, 
                    actual_home_score, 
                    actual_away_score, 
                    event_status,
                    sport,
                    market,
                    prediction_type
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, [
                pred.id, 0, fixtureId, pred.recommendation, 
                `${homeScore}-${awayScore}`, result === 'WON',
                homeScore, awayScore, status, 'football',
                market, 'direct'
            ]);
            
            console.log(`[GRADED] Prediction ${pred.id}: ${result} (predicted: ${pred.recommendation}, actual: ${homeScore}-${awayScore})`);
            
        } catch (err) {
            console.error(`[GRADE ERROR] Failed to grade prediction ${pred.id}:`, err.message);
        }
    }
}

// Run if executed directly
if (require.main === module) {
    resolveResults()
        .then(r => {
            console.log('\n[RESULT]', JSON.stringify(r));
            process.exit(0);
        })
        .catch(err => {
            console.error('[FATAL]', err.message);
            process.exit(1);
        });
}

module.exports = { resolveResults };