const { query } = require('../backend/database');

async function checkMatchPrediction(matchId) {
  console.log(`Checking prediction for match ID: ${matchId}`);
  
  try {
    // Check in direct1x2_prediction_final table
    const { rows: predictions } = await query(`
      SELECT id, fixture_id, matches, sport, market_type, created_at
      FROM direct1x2_prediction_final
      WHERE fixture_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [matchId]);
    
    console.log(`Found ${predictions.length} predictions with fixture_id = ${matchId}`);
    
    if (predictions.length > 0) {
      predictions.forEach((pred, index) => {
        console.log(`Prediction ${index + 1}:`);
        console.log(`  ID: ${pred.id}`);
        console.log(`  Fixture ID: ${pred.fixture_id}`);
        console.log(`  Sport: ${pred.sport}`);
        console.log(`  Market Type: ${pred.market_type}`);
        console.log(`  Created At: ${pred.created_at}`);
        console.log(`  Matches: ${JSON.stringify(pred.matches, null, 2)}`);
        console.log('');
      });
    }
    
    // Check in matches JSONB array
    const { rows: jsonMatches } = await query(`
      SELECT id, matches
      FROM direct1x2_prediction_final
      WHERE matches::jsonb @> '[{"match_id":"${matchId}"}]'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log(`Found ${jsonMatches.length} predictions with match_id in JSONB array`);
    
    if (jsonMatches.length > 0) {
      jsonMatches.forEach((pred, index) => {
        console.log(`JSONB Match ${index + 1}:`);
        console.log(`  ID: ${pred.id}`);
        console.log(`  Matches: ${JSON.stringify(pred.matches, null, 2)}`);
        console.log('');
      });
    }
    
    // Check fixture_processing_log for this match
    const { rows: processingLogs } = await query(`
      SELECT id_event, sport, ingestion_started_at, ingestion_completed_at, 
             enrichment_completed_at, ai_completed_at, publication_completed_at,
             suppression_reason, failure_reason
      FROM fixture_processing_log
      WHERE id_event LIKE '%${matchId}%'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log(`Found ${processingLogs.length} processing logs for match ID pattern: ${matchId}`);
    
    if (processingLogs.length > 0) {
      processingLogs.forEach((log, index) => {
        console.log(`Processing Log ${index + 1}:`);
        console.log(`  Event ID: ${log.id_event}`);
        console.log(`  Sport: ${log.sport}`);
        console.log(`  Ingestion: ${log.ingestion_started_at} -> ${log.ingestion_completed_at || 'pending'}`);
        console.log(`  Enrichment: ${log.enrichment_completed_at || 'pending'}`);
        console.log(`  AI: ${log.ai_completed_at || 'pending'}`);
        console.log(`  Publication: ${log.publication_completed_at || 'pending'}`);
        if (log.suppression_reason) {
          console.log(`  Suppression: ${log.suppression_reason}`);
        }
        if (log.failure_reason) {
          console.log(`  Failure: ${log.failure_reason}`);
        }
        console.log('');
      });
    }
    
    // Check if match exists in raw_fixtures
    const { rows: rawFixtures } = await query(`
      SELECT id_event, sport, home_team_id, away_team_id, start_time
      FROM raw_fixtures
      WHERE id_event = $1 OR id_event LIKE '%${matchId}%'
      ORDER BY start_time DESC
      LIMIT 5
    `, [matchId]);
    
    console.log(`Found ${rawFixtures.length} raw fixtures for match ID pattern: ${matchId}`);
    
    if (rawFixtures.length > 0) {
      rawFixtures.forEach((fixture, index) => {
        console.log(`Raw Fixture ${index + 1}:`);
        console.log(`  Event ID: ${fixture.id_event}`);
        console.log(`  Sport: ${fixture.sport}`);
        console.log(`  Teams: ${fixture.home_team_id} vs ${fixture.away_team_id}`);
        console.log(`  Start Time: ${fixture.start_time}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error checking match prediction:', error.message);
  }
}

// Get match ID from command line argument
const matchId = process.argv[2];

if (!matchId) {
  console.log('Usage: node check-match-prediction.js <matchId>');
  console.log('Example: node check-match-prediction.js 542708');
  process.exit(1);
}

checkMatchPrediction(matchId);
