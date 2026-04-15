require('dotenv').config();
const { pool } = require('../backend/database');
(async () => {
  console.log('=== TASK 1: DATABASE SCHEMA UPDATE ===\n');
  
  // Add edgemind_report column
  console.log('1. Adding edgemind_report column...');
  try {
    await pool.query(`
      ALTER TABLE public.predictions_final 
      ADD COLUMN IF NOT EXISTS edgemind_report TEXT;
    `);
    console.log('   ✅ edgemind_report column added');
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log('   ℹ️ edgemind_report column already exists');
    } else {
      console.log('   ⚠️ Error:', e.message);
    }
  }
  
  // Add secondary_insights column
  console.log('\n2. Adding secondary_insights column...');
  try {
    await pool.query(`
      ALTER TABLE public.predictions_final 
      ADD COLUMN IF NOT EXISTS secondary_insights JSONB DEFAULT '[]'::jsonb;
    `);
    console.log('   ✅ secondary_insights column added');
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log('   ℹ️ secondary_insights column already exists');
    } else {
      console.log('   ⚠️ Error:', e.message);
    }
  }
  
  // Verify columns exist
  console.log('\n3. Verifying columns...');
  const cols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'predictions_final' 
    AND column_name IN ('edgemind_report', 'secondary_insights')
  `);
  console.log('   Columns found:', cols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
  
  await pool.end();
  console.log('\n✅ TASK 1 COMPLETE');
})();
