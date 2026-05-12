/**
 * test-odds-integration.js - Test script for odds integration
 * 
 * This script will:
 * 1. Run the SQL migrations for bookmakers and odds columns
 * 2. Test the odds API pipeline
 * 3. Verify data is stored correctly
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const oddsApiPipeline = require('../backend/services/oddsApiPipeline');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function runMigrations() {
    console.log('[TEST] Running odds integration migrations...');
    
    try {
        // Run canonical_bookmakers migration
        const bookmakersSQL = fs.readFileSync(
            path.join(__dirname, '../supabase/migrations/20260512000001_create_canonical_bookmakers.sql'),
            'utf8'
        );
        await pool.query(bookmakersSQL);
        console.log('[TEST] ✓ canonical_bookmakers table created/populated');
        
        // Run odds column migration
        const oddsSQL = fs.readFileSync(
            path.join(__dirname, '../supabase/migrations/20260512000002_add_odds_to_match_context.sql'),
            'utf8'
        );
        await pool.query(oddsSQL);
        console.log('[TEST] ✓ odds column added to match_context_data');
        
        // Verify tables exist
        const bookmakersCheck = await pool.query(`
            SELECT COUNT(*) as count FROM canonical_bookmakers
        `);
        console.log(`[TEST] ✓ canonical_bookmakers has ${bookmakersCheck.rows[0].count} bookmakers`);
        
        const oddsColumnCheck = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'match_context_data' AND column_name = 'odds'
        `);
        if (oddsColumnCheck.rows.length > 0) {
            console.log('[TEST] ✓ odds column exists in match_context_data');
        }
        
        return true;
    } catch (error) {
        console.error('[TEST] Migration error:', error);
        return false;
    }
}

async function testOddsPipeline() {
    console.log('[TEST] Testing odds API pipeline...');
    
    try {
        // Test with just soccer to avoid rate limits
        const result = await oddsApiPipeline.runOddsPipeline(['soccer']);
        
        if (result.success) {
            console.log('[TEST] ✓ Odds pipeline completed successfully');
            console.log(`[TEST] Processed ${result.totalProcessed} fixtures`);
            console.log('[TEST] Rate limit status:', result.rateLimitStatus);
        } else {
            console.log('[TEST] ✗ Odds pipeline failed:', result.error);
        }
        
        return result;
    } catch (error) {
        console.error('[TEST] Pipeline test error:', error);
        return { success: false, error: error.message };
    }
}

async function verifyOddsData() {
    console.log('[TEST] Verifying odds data storage...');
    
    try {
        const result = await pool.query(`
            SELECT COUNT(*) as count,
                   COUNT(CASE WHEN odds IS NOT NULL AND odds != '{}'::JSONB THEN 1 END) as with_odds
            FROM match_context_data
        `);
        
        console.log(`[TEST] match_context_data has ${result.rows[0].count} total rows`);
        console.log(`[TEST] ${result.rows[0].with_odds} rows have odds data`);
        
        // Show sample odds data
        const sampleResult = await pool.query(`
            SELECT id_event, 
                   jsonb_typeof(odds) as odds_type,
                   jsonb_array_length(jsonb_object_keys(odds)) as odds_keys_count
            FROM match_context_data 
            WHERE odds IS NOT NULL AND odds != '{}'::JSONB
            LIMIT 3
        `);
        
        if (sampleResult.rows.length > 0) {
            console.log('[TEST] Sample odds data:');
            sampleResult.rows.forEach(row => {
                console.log(`  - ${row.id_event}: ${row.odds_keys_count} bookmakers`);
            });
        }
        
        return true;
    } catch (error) {
        console.error('[TEST] Verification error:', error);
        return false;
    }
}

async function main() {
    console.log('[TEST] Starting odds integration test...');
    

        // Step 1: Skip migrations (already run manually in Supabase)
    cons
    ole.log('[TEST] Skipping migrations - already run manually in Supabase');
    
    // Step 2: Test odds pipeline (only if ODDS_API_KEY is configured)
    if (process.env.ODDS_API_KEY) {
        const pipelineResult = await testOddsPipeline();
        
        if (pipelineResult.success) {
            // Step 3: Verify data storage
            await verifyOddsData();
        }
    } else {
        console.log('[TEST] ⚠ ODDS_API_KEY not configured. Skipping pipeline test.');
        console.log('[TEST] To test pipeline, set ODDS_API_KEY environment variable.');
    }
    
    console.log('[TEST] Odds integration test completed.');
    await pool.end();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    runMigrations,
    testOddsPipeline,
    verifyOddsData
};
