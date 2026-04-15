require('dotenv').config();
const { pool } = require('../backend/database');
(async () => {
  // Get all tables
  const tables = await pool.query(`
    SELECT 
      table_name,
      table_type
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type IN ('BASE TABLE', 'VIEW')
    ORDER BY table_name
  `);
  
  console.log('=== ALL TABLES/VIEWS IN PUBLIC SCHEMA ===\n');
  console.log(`Total: ${tables.rows.length}\n`);
  
  for (const t of tables.rows) {
    console.log(`📋 ${t.table_name} (${t.table_type})`);
  }
  
  // Get column details for each table
  console.log('\n\n=== DETAILED SCHEMA ===\n');
  for (const t of tables.rows) {
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [t.table_name]);
    
    console.log(`\n📌 ${t.table_name}`);
    console.log('─'.repeat(50));
    for (const c of cols.rows) {
      const nullable = c.is_nullable === 'YES' ? '(nullable)' : '(required)';
      const def = c.column_default ? ` DEFAULT ${c.column_default}` : '';
      console.log(`  • ${c.column_name}: ${c.data_type} ${nullable}${def}`);
    }
  }
  
  // Get foreign keys
  console.log('\n\n=== FOREIGN KEY RELATIONSHIPS ===\n');
  const fks = await pool.query(`
    SELECT 
      tc.table_name, 
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name
  `);
  
  const fkMap = {};
  for (const fk of fks.rows) {
    if (!fkMap[fk.table_name]) fkMap[fk.table_name] = [];
    fkMap[fk.table_name].push(`${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
  }
  
  for (const [table, fks_list] of Object.entries(fkMap)) {
    console.log(`🔗 ${table}:`);
    for (const fk of fks_list) {
      console.log(`   ${fk}`);
    }
  }
  
  // Get indexes
  console.log('\n\n=== INDEXES ===\n');
  const indexes = await pool.query(`
    SELECT 
      tablename,
      indexname,
      indexdef
    FROM pg_indexes 
    WHERE schemaname = 'public'
    AND indexname NOT LIKE '%_pkey'
    AND indexname NOT LIKE '%_idx'
    ORDER BY tablename, indexname
  `);
  
  const idxMap = {};
  for (const idx of indexes.rows) {
    if (!idxMap[idx.tablename]) idxMap[idx.tablename] = [];
    idxMap[idx.tablename].push(idx.indexname);
  }
  
  for (const [table, idxs] of Object.entries(idxMap)) {
    console.log(`📊 ${table}:`);
    for (const idx of idxs) {
      console.log(`   • ${idx}`);
    }
  }
  
  await pool.end();
})();
