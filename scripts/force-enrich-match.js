const { enrichMatchContext, generateEdgeMindInsight } = require('../backend/services/thesportsdbPipeline');
const db = require('../backend/db');

async function forceEnrichMatch() {
  try {
    console.log('Force enriching FC Lorient vs Le Havre AC match...\n');
    
    // Find the match in raw_fixtures
    const matchResult = await db.query(`
      SELECT id_event, raw_json, start_time 
      FROM raw_fixtures 
      WHERE raw_json::text ILIKE '%Lorient%' 
      AND raw_json::text ILIKE '%Havre%'
      ORDER BY start_time DESC
      LIMIT 1
    `);
    
    if (matchResult.rows.length === 0) {
      console.log('Match not found in raw_fixtures');
      return;
    }
    
    const match = matchResult.rows[0];
    const eventId = match.id_event;
    const matchData = JSON.parse(match.raw_json);
    
    console.log(`Found match: ${matchData.strHomeTeam} vs ${matchData.strAwayTeam}`);
    console.log(`Event ID: ${eventId}`);
    console.log(`Match time: ${match.start_time}`);
    console.log(`League: ${matchData.strLeague}\n`);
    
    // Force enrichment (bypass 72-hour check)
    console.log('Step 1: Enriching match context...');
    const enriched = await enrichMatchContext(eventId);
    
    if (enriched) {
      console.log('✅ Match context enriched successfully\n');
      
      // Force AI prediction generation
      console.log('Step 2: Generating AI predictions...');
      const insight = await generateEdgeMindInsight(eventId);
      
      if (insight) {
        console.log('✅ AI predictions generated successfully\n');
        
        // Check the results
        const predictionResult = await db.query(`
          SELECT confidence_score, edgemind_feedback, value_combos, same_match_builder, created_at
          FROM ai_predictions 
          WHERE match_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `, [eventId]);
        
        if (predictionResult.rows.length > 0) {
          const prediction = predictionResult.rows[0];
          console.log('📊 Generated Analysis:');
          console.log(`- Confidence: ${prediction.confidence_score}%`);
          console.log(`- EdgeMind: ${prediction.edgemind_feedback}`);
          console.log(`- Created: ${prediction.created_at}`);
          
          const valueCombos = JSON.parse(prediction.value_combos || '{}');
          if (valueCombos.under_over) {
            console.log(`- Value Pick: ${valueCombos.under_over}`);
          }
          if (valueCombos.double_chance) {
            console.log(`- Value Pick: ${valueCombos.double_chance}`);
          }
        }
        
        console.log('\n🎉 Match enrichment completed successfully!');
        console.log('The match details should now show high-quality analysis instead of placeholders.');
        
      } else {
        console.log('❌ AI prediction generation failed');
      }
    } else {
      console.log('❌ Match context enrichment failed');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

forceEnrichMatch();
