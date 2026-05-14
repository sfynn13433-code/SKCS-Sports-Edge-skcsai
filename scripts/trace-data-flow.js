const db = require('../backend/db');

async function traceDataFlow() {
  console.log('=== END-TO-END DATA FLOW TRACE: FC Lorient vs Le Havre AC ===\n');
  
  try {
    // Step 1: Check all tables for any Lorient/Havre data
    console.log('STEP 1: DATABASE INVENTORY');
    console.log('-----------------------------------------');
    
    const tables = [
      'raw_fixtures',
      'match_context_data', 
      'ai_predictions',
      'direct1x2_prediction_final',
      'predictions_raw',
      'predictions_filtered'
    ];
    
    for (const table of tables) {
      try {
        const result = await db.query(`
          SELECT COUNT(*) as count 
          FROM ${table}
        `);
        console.log(`- ${table}: ${result.rows[0].count} total rows`);
      } catch (err) {
        console.log(`- ${table}: ERROR - ${err.message}`);
      }
    }
    
    // Step 2: Search for FC Lorient vs Le Havre AC across all tables
    console.log('\nSTEP 2: SEARCH FOR FC LORIENT VS LE HAVRE AC');
    console.log('-----------------------------------------');
    
    const searchTerms = ['Lorient', 'Havre', '542703', '76412'];
    
    for (const table of tables) {
      try {
        let found = false;
        for (const term of searchTerms) {
          const result = await db.query(`
            SELECT COUNT(*) as count 
            FROM ${table}
            WHERE 
              home_team ILIKE '%${term}%' OR 
              away_team ILIKE '%${term}%' OR
              raw_json::text ILIKE '%${term}%' OR
              matches::text ILIKE '%${term}%' OR
              id::text = '${term}' OR
              match_id::text = '${term}'
          `);
          
          if (result.rows[0].count > 0) {
            console.log(`- ${table}: Found ${result.rows[0].count} rows with "${term}"`);
            found = true;
            
            // Get sample data
            const sampleResult = await db.query(`
              SELECT * FROM ${table}
              WHERE 
                home_team ILIKE '%${term}%' OR 
                away_team ILIKE '%${term}%' OR
                raw_json::text ILIKE '%${term}%' OR
                matches::text ILIKE '%${term}%' OR
                id::text = '${term}' OR
                match_id::text = '${term}'
              LIMIT 1
            `);
            
            if (sampleResult.rows.length > 0) {
              const sample = sampleResult.rows[0];
              console.log(`  Sample ID: ${sample.id || sample.match_id || 'N/A'}`);
              console.log(`  Sample teams: ${sample.home_team || 'N/A'} vs ${sample.away_team || 'N/A'}`);
              console.log(`  Sample confidence: ${sample.confidence || sample.total_confidence || 'N/A'}`);
            }
          }
        }
        
        if (!found) {
          console.log(`- ${table}: No Lorient/Havre data found`);
        }
      } catch (err) {
        console.log(`- ${table}: Search error - ${err.message}`);
      }
    }
    
    // Step 3: Check the specific match ID 542703
    console.log('\nSTEP 3: SPECIFIC MATCH ID 542703 TRACE');
    console.log('-----------------------------------------');
    
    for (const table of tables) {
      try {
        const result = await db.query(`
          SELECT * FROM ${table}
          WHERE id::text = '542703' OR match_id::text = '542703'
          LIMIT 3
        `);
        
        if (result.rows.length > 0) {
          console.log(`- ${table}: Found ${result.rows.length} rows with ID 542703`);
          result.rows.forEach((row, i) => {
            console.log(`  Row ${i + 1}:`);
            console.log(`    ID: ${row.id || row.match_id}`);
            console.log(`    Teams: ${row.home_team || 'N/A'} vs ${row.away_team || 'N/A'}`);
            console.log(`    Confidence: ${row.confidence || row.total_confidence || 'N/A'}`);
            console.log(`    Created: ${row.created_at || 'N/A'}`);
          });
        }
      } catch (err) {
        console.log(`- ${table}: ID search error - ${err.message}`);
      }
    }
    
    // Step 4: Check recent predictions to understand the data flow
    console.log('\nSTEP 4: RECENT PREDICTIONS ANALYSIS');
    console.log('-----------------------------------------');
    
    try {
      const recentPredictions = await db.query(`
        SELECT id, home_team, away_team, confidence, total_confidence, created_at
        FROM direct1x2_prediction_final
        ORDER BY created_at DESC
        LIMIT 5
      `);
      
      console.log('Recent predictions:');
      recentPredictions.rows.forEach((pred, i) => {
        console.log(`  ${i + 1}. ID: ${pred.id}`);
        console.log(`     Teams: ${pred.home_team || 'N/A'} vs ${pred.away_team || 'N/A'}`);
        console.log(`     Confidence: ${pred.confidence || pred.total_confidence || 'N/A'}%`);
        console.log(`     Created: ${pred.created_at}`);
      });
    } catch (err) {
      console.log(`Recent predictions error: ${err.message}`);
    }
    
  } catch (error) {
    console.error('Trace error:', error.message);
  } finally {
    process.exit(0);
  }
}

traceDataFlow();
