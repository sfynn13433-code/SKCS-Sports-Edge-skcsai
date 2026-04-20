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
    
    // Find predictions for this match from both tables
    // Match by fixture_id OR by team names (fuzzy match)
    const predResult = await client.query(`
        SELECT DISTINCT ON (id)
            id, 
            matches, 
            recommendation,
            total_confidence,
            tier,
            type,
            publish_run_id,
            home_team,
            away_team,
            match_date
        FROM direct1x2_prediction_final
        WHERE fixture_id = $1
           OR (home_team IS NOT NULL AND away_team IS NOT NULL 
               AND (LOWER(home_team) = LOWER($2) OR LOWER($2) LIKE '%' || LOWER(home_team) || '%')
               AND (LOWER(away_team) = LOWER($3) OR LOWER($3) LIKE '%' || LOWER(away_team) || '%'))
           OR matches::text LIKE '%' || $1 || '%'
        UNION ALL
        SELECT DISTINCT ON (id)
            id, 
            matches, 
            recommendation,
            total_confidence,
            tier,
            type,
            publish_run_id,
            NULL as home_team,
            NULL as away_team,
            NULL as match_date
        FROM predictions_final
        WHERE matches::text LIKE '%' || $1 || '%'
           OR matches::text LIKE '%' || $2 || '%'
           OR matches::text LIKE '%' || $3 || '%'
    `, [match.id, match.home_team, match.away_team]);
    
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
        let fixtureDate = null;
        try {
            const matches = typeof pred.matches === 'string' ? JSON.parse(pred.matches) : pred.matches;
            if (matches && matches[0]) {
                if (matches[0].market) market = matches[0].market;
                if (matches[0].date) fixtureDate = matches[0].date;
            }
        } catch (e) {}
        
        // Use match_date from prediction if available
        if (!fixtureDate && pred.match_date) {
            fixtureDate = new Date(pred.match_date).toISOString().slice(0, 10);
        }

        // Determine prediction type
        let predictionType = 'direct';
        if (pred.type) {
            const type = pred.type.toLowerCase();
            if (type === 'same_match') predictionType = 'same_match';
            else if (type === 'secondary') predictionType = 'secondary';
            else if (type === 'multi' || type === 'acca') predictionType = 'multi';
            else if (type.includes('acca')) predictionType = 'acca';
        }

        const confidence = pred.total_confidence || 50;
        const resolutionStatus = result === 'WON' ? 'won' : (result === 'LOST' ? 'lost' : 'void');
        
        // Insert with all required fields
        await client.query(`
            INSERT INTO predictions_accuracy (
                prediction_final_id, 
                prediction_match_index, 
                event_id,
                sport,
                prediction_tier,
                prediction_type,
                publish_run_id,
                home_team,
                away_team,
                fixture_date,
                predicted_outcome, 
                actual_result, 
                is_correct,
                actual_home_score, 
                actual_away_score, 
                event_status,
                resolution_status,
                market, 
                confidence,
                evaluated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
            ON CONFLICT (prediction_final_id, prediction_match_index) 
            DO UPDATE SET
                resolution_status = EXCLUDED.resolution_status,
                is_correct = EXCLUDED.is_correct,
                actual_result = EXCLUDED.actual_result,
                actual_home_score = EXCLUDED.actual_home_score,
                actual_away_score = EXCLUDED.actual_away_score,
                event_status = EXCLUDED.event_status,
                evaluated_at = EXCLUDED.evaluated_at
        `, [
            pred.id, 
            0, 
            match.id, 
            'football',
            pred.tier || 'normal',
            predictionType,
            pred.publish_run_id,
            pred.home_team || match.home_team,
            pred.away_team || match.away_team,
            fixtureDate,
            pred.recommendation, 
            `${match.home_score}-${match.away_score}`, 
            result === 'WON',
            match.home_score, 
            match.away_score, 
            match.status,
            resolutionStatus,
            market, 
            confidence,
            new Date().toISOString()
        ]);
        
        console.log('Inserted accuracy record!');
    }
    
    client.release();
    await pool.end();
    process.exit(0);
}

manualGrade();