const { query } = require('../backend/db');

async function auditSportValues() {
  console.log('=== AUDITING SPORT VALUES ACROSS ALL TABLES ===\n');

  const tables = [
    'predictions_raw',
    'direct1x2_prediction_final',
    'predictions_filtered',
    'fixtures',
    'predictions_unified',
    'tier_rules'
  ];

  const results = {};

  for (const table of tables) {
    try {
      const { rows } = await query(`
        SELECT DISTINCT sport, COUNT(*) as count
        FROM ${table}
        WHERE sport IS NOT NULL
        GROUP BY sport
        ORDER BY sport
      `);
      
      if (rows.length > 0) {
        results[table] = rows;
        console.log(`\n--- ${table} ---`);
        rows.forEach(row => {
          console.log(`  ${row.sport}: ${row.count} rows`);
        });
      } else {
        console.log(`\n--- ${table} ---`);
        console.log('  No sport data found');
      }
    } catch (error) {
      console.log(`\n--- ${table} ---`);
      console.log(`  Error: ${error.message}`);
    }
  }

  // Check JSONB metadata for sport fields
  console.log('\n=== CHECKING JSONB METADATA FOR SPORT FIELDS ===\n');
  
  try {
    const { rows: rawMetadata } = await query(`
      SELECT DISTINCT metadata->>'sport' as sport, COUNT(*) as count
      FROM predictions_raw
      WHERE metadata->>'sport' IS NOT NULL
      GROUP BY metadata->>'sport'
      ORDER BY sport
    `);
    
    console.log('--- predictions_raw.metadata->sport ---');
    rawMetadata.forEach(row => {
      console.log(`  ${row.sport}: ${row.count} rows`);
    });
  } catch (error) {
    console.log(`Error checking metadata: ${error.message}`);
  }

  try {
    const { rows: finalMatches } = await query(`
      SELECT DISTINCT matches->0->>'sport' as sport, COUNT(*) as count
      FROM direct1x2_prediction_final
      WHERE matches->0->>'sport' IS NOT NULL
      GROUP BY matches->0->>'sport'
      ORDER BY sport
    `);
    
    console.log('\n--- direct1x2_prediction_final.matches[0].sport ---');
    finalMatches.forEach(row => {
      console.log(`  ${row.sport}: ${row.count} rows`);
    });
  } catch (error) {
    console.log(`Error checking matches: ${error.message}`);
  }

  console.log('\n=== SUMMARY ===');
  console.log('Check for inconsistencies in sport spelling and capitalization');
  console.log('All sports should be Title Case (e.g., "Football", "Basketball")');

  process.exit(0);
}

auditSportValues().catch(error => {
  console.error('Audit failed:', error);
  process.exit(1);
});
