require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function manualGrade() {
    const client = await pool.connect();
    
    // Get one finished match
    const matchResult = await client.query(`
        SELECT id, home_team, away_team, home_score, away_score, status
        FROM events
        WHERE status = 'FT' AND home_score IS NOT NULL
        LIMIT 1
    `);
    
    if (matchResult.rows.length === 0) {
        console.log('No finished matches found');
        return;
    }
    
    const match = matchResult.rows[0];
    console.log('Grading match:', match.home_team, 'vs', match.away_team);
    
    // Find predictions for this match
    const predResult = await client.query(`
        SELECT id, matches, recommendation
        FROM predictions_final
        WHERE matches::text LIKE '%${match.id}%'
    `);
    
    console.log('Found', predResult.rows.length, 'predictions');
    
    for (const pred of predResult.rows) {
        const rec = pred.recommendation?.toLowerCase() || '';
        let result = 'VOID';
        
        // More comprehensive matching
        if (rec.includes('home') || rec === '1' || rec === 'home_win' || rec.includes('home win')) {
            result = match.home_score > match.away_score ? 'WON' : 'LOST';
        } else if (rec.includes('draw') || rec === 'x' || rec === 'draw') {
            result = match.home_score === match.away_score ? 'WON' : 'LOST';
        } else if (rec.includes('away') || rec === '2' || rec.includes('away_win') || rec.includes('away win')) {
            result = match.away_score > match.home_score ? 'WON' : 'LOST';
        } else {
            // Default: assume home win prediction
            result = match.home_score > match.away_score ? 'WON' : 'LOST';
        }
        
        console.log(`Pred ${pred.id}: ${pred.recommendation} -> ${result} (actual: ${match.home_score}-${match.away_score})`);
        
        // Get market from matches JSON
        let market = '1X2';
        try {
            const matches = typeof pred.matches === 'string' ? JSON.parse(pred.matches) : pred.matches;
            if (matches && matches[0] && matches[0].market) {
                market = matches[0].market;
            }
        } catch (e) {}
        
        // Insert with all required fields
        await client.query(`
            INSERT INTO predictions_accuracy (
                prediction_final_id, prediction_match_index, event_id,
                predicted_outcome, actual_result, is_correct,
                actual_home_score, actual_away_score, event_status, sport,
                market, prediction_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
            pred.id, 0, match.id, pred.recommendation, 
            `${match.home_score}-${match.away_score}`, result === 'WON',
            match.home_score, match.away_score, match.status, 'football',
            market, 'direct'
        ]);
        
        console.log('Inserted accuracy record!');
    }
    
    client.release();
    await pool.end();
    process.exit(0);
}

manualGrade();