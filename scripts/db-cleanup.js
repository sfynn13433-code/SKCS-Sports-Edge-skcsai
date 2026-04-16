'use strict';

require('dotenv').config();

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function dbCleanup() {
    console.log('\n=== PHASE 7: AUTOMATED PRUNING & ARCHIVING ===\n');
    
    const client = await pool.connect();
    let archived = 0;
    let purged = 0;
    
    try {
        // PART 1: Archive old finished matches
        console.log('[PART 1] Archiving old matches to zz_archive_matches...');
        
        // First ensure zz_archive_matches table exists with same schema
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS zz_archive_matches (
                    LIKE events INCLUDING ALL
                )
            `);
        } catch (e) { /* table may already exist */ }
        
        // Find old finished matches (> 7 days old, status = FT)
        const archiveResult = await client.query(`
            SELECT * FROM events 
            WHERE status = 'FT' 
            AND commence_time < NOW() - INTERVAL '7 days'
            LIMIT 5000
        `);
        
        const toArchive = archiveResult.rows;
        
        if (toArchive.length > 0) {
            console.log(`[PART 1] Found ${toArchive.length} matches to archive`);
            
            // Insert into archive table
            for (const row of toArchive) {
                await client.query(`
                    INSERT INTO zz_archive_matches 
                    SELECT * FROM events 
                    WHERE id = $1
                `, [row.id]);
            }
            
            // Delete from main table
            const deleteResult = await client.query(`
                DELETE FROM events 
                WHERE status = 'FT' 
                AND commence_time < NOW() - INTERVAL '7 days'
            `);
            
            archived = deleteResult.rowCount;
            console.log(`✅ Archived ${archived} old matches to zz_archive_matches`);
        } else {
            console.log('⏭️  No matches to archive');
        }
        
        // PART 2: Purge stale temporary data
        console.log('\n[PART 2] Purging stale temporary data...');
        
        // api_raw - check if it has created_at or updated_at
        try {
            const apiRawDeleted = await client.query(`
                DELETE FROM api_raw 
                WHERE created_at < NOW() - INTERVAL '7 days'
            `);
            console.log(`  - api_raw: ${apiRawDeleted.rowCount} rows deleted`);
            purged += apiRawDeleted.rowCount;
        } catch (e) {
            // Try updated_at instead
            try {
                const apiRawDeleted = await client.query(`
                    DELETE FROM api_raw 
                    WHERE updated_at < NOW() - INTERVAL '7 days'
                `);
                console.log(`  - api_raw: ${apiRawDeleted.rowCount} rows deleted`);
                purged += apiRawDeleted.rowCount;
            } catch (e2) {
                console.log(`  - api_raw: no timestamp column found`);
            }
        }
        
        // predictions_raw - use updated_at
        try {
            // First check row count to delete
            const countResult = await client.query(`
                SELECT COUNT(*) FROM predictions_raw 
                WHERE updated_at < NOW() - INTERVAL '7 days'
            `);
            const count = parseInt(countResult.rows[0].count);
            
            if (count > 0) {
                await client.query(`
                    DELETE FROM predictions_raw 
                    WHERE updated_at < NOW() - INTERVAL '7 days'
                `);
                console.log(`  - predictions_raw: ${count} rows deleted`);
                purged += count;
            } else {
                console.log(`  - predictions_raw: 0 rows to delete`);
            }
        } catch (e) {
            console.log(`  - predictions_raw: error - ${e.message}`);
        }
        
        // predictions_filtered - use created_at
        try {
            const countResult = await client.query(`
                SELECT COUNT(*) FROM predictions_filtered 
                WHERE created_at < NOW() - INTERVAL '7 days'
            `);
            const count = parseInt(countResult.rows[0].count);
            
            if (count > 0) {
                await client.query(`
                    DELETE FROM predictions_filtered 
                    WHERE created_at < NOW() - INTERVAL '7 days'
                `);
                console.log(`  - predictions_filtered: ${count} rows deleted`);
                purged += count;
            } else {
                console.log(`  - predictions_filtered: 0 rows to delete`);
            }
        } catch (e) {
            console.log(`  - predictions_filtered: error - ${e.message}`);
        }
        
        // rapidapi_cache - 3 days (shorter TTL for cache)
        const cacheDeleted = await client.query(`
            DELETE FROM rapidapi_cache 
            WHERE updated_at < NOW() - INTERVAL '3 days'
        `);
        console.log(`  - rapidapi_cache: ${cacheDeleted.rowCount} rows deleted`);
        purged += cacheDeleted.rowCount;
        
        // scheduling_logs - 7 days
        const schedDeleted = await client.query(`
            DELETE FROM scheduling_logs 
            WHERE started_at < NOW() - INTERVAL '7 days'
        `);
        console.log(`  - scheduling_logs: ${schedDeleted.rowCount} rows deleted`);
        purged += schedDeleted.rowCount;
        
        console.log('\n=== PHASE 7 SUCCESS ===');
        console.log(`Archived ${archived} old matches to zz_archive_matches.`);
        console.log(`Purged ${purged} stale rows across temporary tables.`);
        
        return { archived, purged };
        
    } catch (err) {
        console.error('[ERROR]', err.message);
        throw err;
    } finally {
        client.release();
    }
}

// Run if executed directly
if (require.main === module) {
    dbCleanup()
        .then(r => {
            console.log('\n[RESULT]', JSON.stringify(r));
            process.exit(0);
        })
        .catch(err => {
            console.error('[FATAL]', err.message);
            process.exit(1);
        });
}

module.exports = { dbCleanup };