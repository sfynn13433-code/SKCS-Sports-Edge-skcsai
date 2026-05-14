const db = require('../backend/db');

async function checkMatchDetails() {
  try {
    console.log('Checking FC Lorient vs Le Havre AC match details...\n');
    
    // Check raw fixtures
    const fixturesResult = await db.query(`
      SELECT * FROM raw_fixtures 
      WHERE home_team ILIKE '%Lorient%' OR away_team ILIKE '%Havre%' 
      ORDER BY start_time DESC
      LIMIT 5
    `);
    
    console.log('Raw fixtures found:', fixturesResult.rows.length);
    fixturesResult.rows.forEach(fixture => {
      console.log(`- ID: ${fixture.id_event}, Home: ${fixture.home_team}, Away: ${fixture.away_team}, Date: ${fixture.start_time}`);
    });
    
    // Check match context data
    if (fixturesResult.rows.length > 0) {
      const eventId = fixturesResult.rows[0].id_event;
      
      const contextResult = await db.query(`
        SELECT * FROM match_context_data 
        WHERE id_event = $1
      `, [eventId]);
      
      console.log('\nMatch context data:', contextResult.rows.length);
      if (contextResult.rows.length > 0) {
        const context = contextResult.rows[0];
        console.log('- Lineups:', context.lineups ? 'Yes' : 'No');
        console.log('- Stats:', context.stats ? 'Yes' : 'No');
        console.log('- Timeline:', context.timeline ? 'Yes' : 'No');
        console.log('- Standings:', context.standings ? 'Yes' : 'No');
        console.log('- H2H:', context.h2h ? 'Yes' : 'No');
      }
      
      // Check AI predictions
      const predictionResult = await db.query(`
        SELECT * FROM ai_predictions 
        WHERE id_event = $1
        ORDER BY created_at DESC
        LIMIT 3
      `, [eventId]);
      
      console.log('\nAI predictions:', predictionResult.rows.length);
      predictionResult.rows.forEach(pred => {
        console.log(`- Confidence: ${pred.confidence}%, Viability: ${pred.viability}`);
        console.log(`- Primary: ${pred.primary_prediction} (${pred.primary_confidence}%)`);
        console.log(`- Created: ${pred.created_at}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkMatchDetails();
