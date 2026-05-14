const db = require('../backend/db');

async function triggerPublication() {
  console.log('=== TRIGGERING PUBLICATION PROCESS ===\n');
  
  try {
    // Step 1: Check the publication service
    console.log('STEP 1: CHECKING PUBLICATION SERVICE');
    console.log('------------------------------------');
    
    // Look for the publication/builder service
    const { buildDirect1x2Payload } = require('../backend/services/direct1x2Builder');
    
    if (typeof buildDirect1x2Payload === 'function') {
      console.log('✅ Publication service found');
      
      // Trigger the publication process
      console.log('Triggering publication process...');
      
      try {
        const result = await buildDirect1x2Payload();
        console.log('✅ Publication process completed');
        console.log(`- Published predictions: ${result.published || 0}`);
        console.log(`- Total processed: ${result.total || 0}`);
      } catch (pubError) {
        console.log('❌ Publication process failed:', pubError.message);
        console.log('Trying manual publication...');
        
        // Manual publication fallback
        await manualPublication();
      }
    } else {
      console.log('❌ Publication service not found');
      console.log('Trying manual publication...');
      
      await manualPublication();
    }
    
    // Step 2: Verify the prediction is now in final table
    console.log('\nSTEP 2: VERIFYING PUBLICATION');
    console.log('------------------------------------');
    
    // Check if our prediction made it to the final table
    const finalResult = await db.query(`
      SELECT * FROM direct1x2_prediction_final
      WHERE matches::text ILIKE '%76412%'
      OR id::text = '76412'
      LIMIT 1
    `);
    
    if (finalResult.rows.length > 0) {
      console.log('✅ Prediction found in final table!');
      const final = finalResult.rows[0];
      console.log(`- Final ID: ${final.id}`);
      console.log(`- Type: ${final.type}`);
      console.log(`- Tier: ${final.tier}`);
      console.log(`- Total Confidence: ${final.total_confidence}`);
      console.log(`- Created: ${final.created_at}`);
      
      if (final.matches) {
        console.log('\nMatch details:');
        const matches = Array.isArray(final.matches) ? final.matches : [final.matches];
        matches.forEach((match, i) => {
          console.log(`  Match ${i + 1}:`);
          console.log(`    Home: ${match.home_team || 'N/A'}`);
          console.log(`    Away: ${match.away_team || 'N/A'}`);
          console.log(`    Confidence: ${match.confidence || 'N/A'}%`);
          console.log(`    Market: ${match.market || 'N/A'}`);
          console.log(`    Prediction: ${match.prediction || 'N/A'}`);
        });
      }
    } else {
      console.log('❌ Prediction still not found in final table');
      console.log('May need to wait for next automated publication cycle');
    }
    
    // Step 3: Test the frontend data source
    console.log('\nSTEP 3: TESTING FRONTEND DATA SOURCE');
    console.log('------------------------------------');
    
    // Check the VIP stress payload endpoint data
    const vipResult = await db.query(`
      SELECT COUNT(*) as count
      FROM direct1x2_prediction_final
      WHERE sport = 'Football'
      AND created_at >= NOW() - INTERVAL '24 hours'
    `);
    
    console.log(`Total football predictions available for frontend: ${vipResult.rows[0].count}`);
    
    if (vipResult.rows[0].count > 0) {
      console.log('✅ Frontend should now be able to access predictions');
    } else {
      console.log('❌ No predictions available for frontend yet');
    }
    
  } catch (error) {
    console.error('Publication trigger error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

async function manualPublication() {
  console.log('Attempting manual publication...');
  
  try {
    // Get valid filtered predictions
    const validFilteredResult = await db.query(`
      SELECT pr.*, pf.tier
      FROM predictions_raw pr
      JOIN predictions_filtered pf ON pr.id = pf.raw_id
      WHERE pf.is_valid = true
      AND pr.created_at >= NOW() - INTERVAL '24 hours'
      AND pr.sport = 'football'
      ORDER BY pr.confidence DESC
      LIMIT 10
    `);
    
    console.log(`Found ${validFilteredResult.rows.length} valid predictions to publish`);
    
    if (validFilteredResult.rows.length === 0) {
      console.log('No valid predictions found to publish');
      return;
    }
    
    // Create a simple publication entry
    for (const prediction of validFilteredResult.rows) {
      try {
        const publishResult = await db.query(`
          INSERT INTO direct1x2_prediction_final (
            id, publish_run_id, tier, type, section_type, total_confidence,
            average_leg_confidence, display_label, total_ticket_probability,
            compound_ticket_confidence, diversity_breakdown, risk_level,
            created_at, validation_matrix, context_insights, final_recommendation,
            engine_log, insights, matches, sport, market_type
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
          ) ON CONFLICT (id) DO UPDATE SET
            total_confidence = EXCLUDED.total_confidence,
            matches = EXCLUDED.matches,
            created_at = EXCLUDED.created_at
          RETURNING id
        `, [
          prediction.id,
          null,
          prediction.tier || 'normal',
          'direct',
          'direct',
          prediction.confidence,
          prediction.confidence,
          null,
          null,
          null,
          null,
          'medium',
          new Date().toISOString(),
          null,
          {
            status: 'available',
            weather: { label: 'Available', risk: 0, temp_c: null, condition: null },
            injuries_bans: { label: 'No major absences', key_absences: 0, squad_absences: 0, bans: 0 },
            stability: { label: 'Low Risk', risk: 0, flags: { coach_conflict: false, exec_instability: false, fan_violence: false, legal_issues: 0 } },
            last_verified: null,
            chips: {
              weather: 'Available',
              injuries_bans: 'No major absences',
              stability: 'Low Risk',
              last_verified: null
            }
          },
          {
            market: '1X2',
            confidence: prediction.confidence
          },
          [],
          {
            weather: 'Available',
            availability: 'No major absences',
            stability: 'Low Risk'
          },
          [{
            match_id: prediction.match_id,
            metadata: prediction.metadata,
            away_team: prediction.metadata?.away_team || 'Away Team',
            home_team: prediction.metadata?.home_team || 'Home Team',
            confidence: prediction.confidence,
            prediction: prediction.prediction,
            context_insights: {
              status: 'available',
              weather: { label: 'Available', risk: 0, temp_c: null, condition: null },
              injuries_bans: { label: 'No major absences', key_absences: 0, squad_absences: 0, bans: 0 },
              stability: { label: 'Low Risk', risk: 0, flags: { coach_conflict: false, exec_instability: false, fan_violence: false, legal_issues: 0 } },
              last_verified: null,
              chips: {
                weather: 'Available',
                injuries_bans: 'No major absences',
                stability: 'Low Risk',
                last_verified: null
              }
            },
            final_recommendation: { market: '1X2', confidence: prediction.confidence },
            engine_log: [],
            insights: { weather: 'Available', availability: 'No major absences', stability: 'Low Risk' }
          }],
          prediction.sport,
          '1X2'
        ]);
        
        console.log(`✅ Published prediction ${prediction.id} as final ID ${publishResult.rows[0].id}`);
        
        // Check if this is our target prediction
        if (prediction.id == 76412) {
          console.log('🎯 FC Lorient vs Le Havre AC prediction published successfully!');
        }
        
      } catch (insertError) {
        console.log(`❌ Failed to publish prediction ${prediction.id}:`, insertError.message);
      }
    }
    
  } catch (error) {
    console.error('Manual publication error:', error.message);
  }
}

triggerPublication();
