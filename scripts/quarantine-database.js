require('dotenv').config();
const { pool } = require('../backend/database');
(async () => {
  console.log('=== DATABASE QUARANTINE ===\n');
  
  // 1. Archive matches table (rename to zz_archive_matches)
  console.log('1. Checking matches table...');
  const matchCheck = await pool.query("SELECT COUNT(*) as cnt FROM matches");
  console.log(`   matches table has ${matchCheck.rows[0].cnt} rows`);
  
  if (parseInt(matchCheck.rows[0].cnt) > 0) {
    console.log('   Renaming to zz_archive_matches...');
    await pool.query('ALTER TABLE matches RENAME TO zz_archive_matches');
    console.log('   ✅ Renamed matches -> zz_archive_matches');
  } else {
    console.log('   Table is empty, safe to drop');
    await pool.query('DROP TABLE matches');
    console.log('   ✅ Dropped matches table');
  }
  
  // 2. Drop test table (empty and unused)
  console.log('\n2. Dropping test table...');
  try {
    await pool.query('DROP TABLE test');
    console.log('   ✅ Dropped test table');
  } catch (e) {
    console.log(`   ⚠️ Could not drop: ${e.message}`);
  }
  
  // 3. Document staging tables (monitor only, don't delete)
  console.log('\n3. Staging tables status (MONITORING ONLY):');
  const stageTables = ['predictions_stage_1', 'predictions_stage_2', 'predictions_stage_3', 'normalized_fixtures', 'events'];
  for (const t of stageTables) {
    try {
      const cnt = await pool.query(`SELECT COUNT(*) as cnt FROM "${t}"`);
      console.log(`   ${t}: ${cnt.rows[0].cnt} rows`);
    } catch (e) {
      console.log(`   ${t}: ERROR - ${e.message}`);
    }
  }
  
  console.log('\n=== ARCHIVE COMPLETE ===');
  await pool.end();
})();
