const { query } = require('../backend/db');

async function normalizeSportValues() {
  console.log('=== NORMALIZING SPORT VALUES TO TITLE CASE ===\n');

  // predictions_raw table
  console.log('--- Updating predictions_raw ---');
  
  const updates = [
    { from: 'afl', to: 'AFL' },
    { from: 'basketball', to: 'Basketball' },
    { from: 'cricket', to: 'Cricket' },
    { from: 'football', to: 'Football' },
    { from: 'formula1', to: 'F1' },
    { from: 'handball', to: 'Handball' },
    { from: 'baseball', to: 'MLB' },
    { from: 'mma', to: 'MMA' },
    { from: 'nba', to: 'Basketball' },
    { from: 'nfl', to: 'NFL' },
    { from: 'american_football', to: 'NFL' },
    { from: 'hockey', to: 'NHL' },
    { from: 'rugby', to: 'Rugby' },
    { from: 'tennis', to: 'Tennis' },
    { from: 'volleyball', to: 'Volleyball' }
  ];

  for (const update of updates) {
    try {
      const { rowCount } = await query(`
        UPDATE predictions_raw 
        SET sport = $1 
        WHERE sport = $2
      `, [update.to, update.from]);
      
      console.log(`  ${update.from} → ${update.to}: ${rowCount} rows updated`);
    } catch (error) {
      console.error(`  Error updating ${update.from}: ${error.message}`);
    }
  }

  // predictions_unified table
  console.log('\n--- Updating predictions_unified ---');
  
  try {
    const { rowCount } = await query(`
      UPDATE predictions_unified 
      SET sport = 'Football' 
      WHERE sport = 'football'
    `);
    console.log(`  football → Football: ${rowCount} rows updated`);
  } catch (error) {
    console.error(`  Error updating predictions_unified: ${error.message}`);
  }

  // fixtures table
  console.log('\n--- Updating fixtures ---');
  
  try {
    const { rowCount } = await query(`
      UPDATE fixtures 
      SET sport = 'Cricket' 
      WHERE sport = 'cricket'
    `);
    console.log(`  cricket → Cricket: ${rowCount} rows updated`);
  } catch (error) {
    console.error(`  Error updating fixtures: ${error.message}`);
  }

  // Verify results
  console.log('\n=== VERIFICATION ===\n');
  
  try {
    const { rows: rawSports } = await query(`
      SELECT DISTINCT sport, COUNT(*) as count
      FROM predictions_raw
      GROUP BY sport
      ORDER BY sport
    `);
    console.log('predictions_raw sport values:');
    rawSports.forEach(row => console.log(`  ${row.sport}: ${row.count} rows`));
  } catch (error) {
    console.error(`Error verifying predictions_raw: ${error.message}`);
  }

  try {
    const { rows: unifiedSports } = await query(`
      SELECT DISTINCT sport, COUNT(*) as count
      FROM predictions_unified
      GROUP BY sport
      ORDER BY sport
    `);
    console.log('\npredictions_unified sport values:');
    unifiedSports.forEach(row => console.log(`  ${row.sport}: ${row.count} rows`));
  } catch (error) {
    console.error(`Error verifying predictions_unified: ${error.message}`);
  }

  try {
    const { rows: fixtureSports } = await query(`
      SELECT DISTINCT sport, COUNT(*) as count
      FROM fixtures
      GROUP BY sport
      ORDER BY sport
    `);
    console.log('\nfixtures sport values:');
    fixtureSports.forEach(row => console.log(`  ${row.sport}: ${row.count} rows`));
  } catch (error) {
    console.error(`Error verifying fixtures: ${error.message}`);
  }

  console.log('\n=== NORMALIZATION COMPLETE ===');
  process.exit(0);
}

normalizeSportValues().catch(error => {
  console.error('Normalization failed:', error);
  process.exit(1);
});
