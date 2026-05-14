const db = require('../backend/db');

async function checkFinalTableSchema() {
  console.log('=== CHECKING FINAL TABLE SCHEMA ===\n');
  
  try {
    // Get the actual schema of the final table
    const schemaResult = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'direct1x2_prediction_final'
      ORDER BY ordinal_position
    `);
    
    console.log('direct1x2_prediction_final table schema:');
    schemaResult.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check if there are any existing rows to understand the structure
    console.log('\nChecking existing rows in final table...');
    
    const existingResult = await db.query(`
      SELECT COUNT(*) as count
      FROM direct1x2_prediction_final
    `);
    
    console.log(`Total rows in final table: ${existingResult.rows[0].count}`);
    
    if (existingResult.rows[0].count > 0) {
      const sampleResult = await db.query(`
        SELECT * FROM direct1x2_prediction_final
        LIMIT 1
      `);
      
      console.log('\nSample row structure:');
      const sample = sampleResult.rows[0];
      Object.keys(sample).forEach(key => {
        const value = sample[key];
        const type = typeof value;
        console.log(`- ${key}: ${type} = ${JSON.stringify(value)}`);
      });
    }
    
    // Now create a proper publication script
    console.log('\n=== CREATING PROPER PUBLICATION ===');
    
    // Get our specific prediction
    const predictionResult = await db.query(`
      SELECT pr.*, pf.tier
      FROM predictions_raw pr
      JOIN predictions_filtered pf ON pr.id = pf.raw_id
      WHERE pr.id = 76412 AND pf.is_valid = true
    `);
    
    if (predictionResult.rows.length === 0) {
      console.log('❌ Prediction 76412 not found or not valid');
      return;
    }
    
    const prediction = predictionResult.rows[0];
    console.log('✅ Found prediction 76412 to publish');
    console.log(`- Teams: ${prediction.metadata?.home_team} vs ${prediction.metadata?.away_team}`);
    console.log(`- Confidence: ${prediction.confidence}`);
    console.log(`- Tier: ${prediction.tier}`);
    
    // Create a minimal publication entry
    const minimalInsertResult = await db.query(`
      INSERT INTO direct1x2_prediction_final (
        id, total_confidence, created_at, sport, matches
      ) VALUES (
        $1, $2, $3, $4, $5
      ) ON CONFLICT (id) DO UPDATE SET
        total_confidence = EXCLUDED.total_confidence,
        matches = EXCLUDED.matches,
        created_at = EXCLUDED.created_at
      RETURNING id, created_at
    `, [
      prediction.id,
      prediction.confidence,
      new Date().toISOString(),
      prediction.sport,
      JSON.stringify([{
        match_id: prediction.match_id,
        metadata: prediction.metadata,
        away_team: prediction.metadata?.away_team || 'Away Team',
        home_team: prediction.metadata?.home_team || 'Home Team',
        confidence: prediction.confidence,
        prediction: prediction.prediction
      }])
    ]);
    
    console.log('✅ Prediction 76412 published successfully!');
    console.log(`- Final ID: ${minimalInsertResult.rows[0].id}`);
    console.log(`- Created: ${minimalInsertResult.rows[0].created_at}`);
    
    // Verify it's there
    const verifyResult = await db.query(`
      SELECT id, total_confidence, matches, created_at
      FROM direct1x2_prediction_final
      WHERE id = $1
    `, [prediction.id]);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Verification successful - prediction is in final table');
      const final = verifyResult.rows[0];
      console.log(`- Total Confidence: ${final.total_confidence}`);
      console.log(`- Created: ${final.created_at}`);
      
      if (final.matches) {
        const matches = JSON.parse(final.matches);
        console.log(`- Matches: ${matches.length} match(es)`);
        matches.forEach((match, i) => {
          console.log(`  ${i + 1}. ${match.home_team} vs ${match.away_team} (${match.confidence}% confidence)`);
        });
      }
    } else {
      console.log('❌ Verification failed - prediction not found in final table');
    }
    
  } catch (error) {
    console.error('Schema check error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

checkFinalTableSchema();
