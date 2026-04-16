require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const indexes = [
    // events table - future matches
    { table: 'events', name: 'idx_events_status_commence', cols: '(status, commence_time)', ifNotExists: true },
    
    // predictions_final table
    { table: 'predictions_final', name: 'idx_predictions_final_tier', cols: '(tier)', ifNotExists: true },
    { table: 'predictions_final', name: 'idx_predictions_final_created_at', cols: '(created_at DESC)', ifNotExists: true },
    { table: 'predictions_final', name: 'idx_predictions_final_type', cols: '(type)', ifNotExists: true },
    
    // predictions_filtered table
    { table: 'predictions_filtered', name: 'idx_predictions_filtered_tier', cols: '(tier)', ifNotExists: true },
    
    // rapidapi_cache table
    { table: 'rapidapi_cache', name: 'idx_rapidapi_cache_updated_at', cols: '(updated_at)', ifNotExists: true },
    { table: 'rapidapi_cache', name: 'idx_rapidapi_cache_provider', cols: '(provider_name)', ifNotExists: true },
    
    // scheduling_logs table
    { table: 'scheduling_logs', name: 'idx_scheduling_logs_status', cols: '(status)', ifNotExists: true },
    { table: 'scheduling_logs', name: 'idx_scheduling_logs_started_at', cols: '(started_at DESC)', ifNotExists: true },
];

async function createIndexes() {
    console.log('\n=== PHASE 8: DATABASE HARDENING (QUERY INDEXING) ===\n');
    
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const idx of indexes) {
        const ifNotExists = idx.ifNotExists ? 'IF NOT EXISTS ' : '';
        const sql = `CREATE INDEX ${ifNotExists}${idx.name} ON ${idx.table} ${idx.cols}`;
        
        try {
            await pool.query(sql);
            console.log(`✅ Created index: ${idx.name} on ${idx.table}`);
            created++;
        } catch (err) {
            if (err.message.includes('already exists')) {
                console.log(`⏭️  Skipped (exists): ${idx.name}`);
                skipped++;
            } else {
                console.log(`❌ Error creating ${idx.name}: ${err.message}`);
                errors++;
            }
        }
    }
    
    console.log('\n=== INDEX CREATION SUMMARY ===');
    console.log(`Created: ${created}`);
    console.log(`Skipped (already exists): ${skipped}`);
    console.log(`Errors: ${errors}`);
    
    // Verify indexes
    console.log('\n=== VERIFYING INDEXES ===');
    const result = await pool.query(`
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
        ORDER BY tablename, indexname
    `);
    
    console.log(`Total indexes found: ${result.rows.length}`);
    result.rows.forEach(r => console.log(`  - ${r.tablename}.${r.indexname}`));
    
    await pool.end();
    process.exit(errors > 0 ? 1 : 0);
}

createIndexes();