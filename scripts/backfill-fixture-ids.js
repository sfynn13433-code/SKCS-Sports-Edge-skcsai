require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const client = await pool.connect();
  let updated = 0;
  let matched = 0;
  
  try {
    // Get all predictions without fixture_id
    const preds = await client.query(`
      SELECT id, matches, match_date
      FROM direct1x2_prediction_final
      WHERE fixture_id IS NULL
    `);
    
    console.log(`[backfill] Found ${preds.rows.length} predictions without fixture_id`);
    
    for (const pred of preds.rows) {
      try {
        const matches = typeof pred.matches === 'string' ? JSON.parse(pred.matches) : pred.matches;
        const firstMatch = matches?.[0];
        if (!firstMatch) continue;
        
        const homeTeam = firstMatch.home_team;
        const awayTeam = firstMatch.away_team;
        const matchDate = firstMatch.match_date || firstMatch.date || pred.match_date;
        
        if (!homeTeam || !awayTeam) continue;
        
        // Try to match by team names (fuzzy match)
        const eventResult = await client.query(`
          SELECT id, home_team, away_team, commence_time
          FROM events
          WHERE (
            LOWER(home_team) = LOWER($1) 
            OR LOWER(home_team) LIKE '%' || LOWER($1) || '%'
            OR LOWER($1) LIKE '%' || LOWER(home_team) || '%'
          )
          AND (
            LOWER(away_team) = LOWER($2)
            OR LOWER(away_team) LIKE '%' || LOWER($2) || '%'  
            OR LOWER($2) LIKE '%' || LOWER(away_team) || '%'
          )
          ORDER BY ABS(EXTRACT(EPOCH FROM (commence_time - COALESCE($3::timestamptz, commence_time))))
          LIMIT 1
        `, [homeTeam, awayTeam, matchDate]);
        
        if (eventResult.rows.length > 0) {
          const event = eventResult.rows[0];
          
          // Update prediction with fixture_id
          await client.query(`
            UPDATE direct1x2_prediction_final
            SET fixture_id = $1,
                home_team = COALESCE(home_team, $2),
                away_team = COALESCE(away_team, $3),
                match_date = COALESCE(match_date, $4)
            WHERE id = $5
          `, [event.id, homeTeam, awayTeam, event.commence_time, pred.id]);
          
          console.log(`[match] Pred ${pred.id}: ${homeTeam} vs ${awayTeam} → Event ${event.id}`);
          matched++;
        } else {
          console.log(`[nomatch] Pred ${pred.id}: ${homeTeam} vs ${awayTeam} - No matching event`);
        }
        
        updated++;
        
      } catch (e) {
        console.error(`[error] Pred ${pred.id}: ${e.message}`);
      }
    }
    
    console.log(`\n[backfill] Processed ${updated} predictions, matched ${matched} to events`);
    
  } catch (err) {
    console.error('[FATAL]', err.message);
  } finally {
    client.release();
    await pool.end();
  }
})();
