/**
 * Cleanup Duplicate Fallback Predictions
 * 
 * This script removes duplicate fallback predictions from direct1x2_prediction_final
 * where publish_run_id IS NULL, keeping only the newest record for each match.
 * 
 * RUN: node scripts/cleanup-duplicate-fallbacks.js
 * 
 * WARNING: This will DELETE data. Review the SQL before running in production.
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('❌ DATABASE_URL not set in environment variables');
    process.exit(1);
}

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function cleanupDuplicates() {
    console.log('🔍 Starting duplicate fallback prediction cleanup...\n');
    
    try {
        await pool.connect();
        console.log('✅ Connected to database\n');

        // First, count how many duplicates exist
        const countQuery = `
            SELECT COUNT(*) as duplicate_count
            FROM (
                SELECT 
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            LOWER(COALESCE(sport, '')),
                            LOWER(COALESCE(type, '')),
                            LOWER(COALESCE(tier, '')),
                            LOWER(COALESCE(market_type, '')),
                            LOWER(COALESCE(home_team, '')),
                            LOWER(COALESCE(away_team, '')),
                            COALESCE(matches->0->>'kickoff', created_at::date)
                        ORDER BY id DESC
                    ) as rn
                FROM direct1x2_prediction_final
                WHERE publish_run_id IS NULL
            ) duplicates
            WHERE rn > 1
        `;
        
        const countResult = await pool.query(countQuery);
        const duplicateCount = parseInt(countResult.rows[0].duplicate_count);
        
        console.log(`📊 Found ${duplicateCount} duplicate fallback predictions to remove\n`);
        
        if (duplicateCount === 0) {
            console.log('✅ No duplicates found. Nothing to cleanup.');
            return;
        }

        // Show what will be deleted (sample)
        const sampleQuery = `
            SELECT 
                id,
                sport,
                type,
                tier,
                market_type,
                home_team,
                away_team,
                created_at
            FROM (
                SELECT 
                    id,
                    sport,
                    type,
                    tier,
                    market_type,
                    home_team,
                    away_team,
                    created_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            LOWER(COALESCE(sport, '')),
                            LOWER(COALESCE(type, '')),
                            LOWER(COALESCE(tier, '')),
                            LOWER(COALESCE(market_type, '')),
                            LOWER(COALESCE(home_team, '')),
                            LOWER(COALESCE(away_team, '')),
                            COALESCE(matches->0->>'kickoff', created_at::date)
                        ORDER BY id DESC
                    ) as rn
                FROM direct1x2_prediction_final
                WHERE publish_run_id IS NULL
            ) duplicates
            WHERE rn > 1
            LIMIT 5
        `;
        
        const sampleResult = await pool.query(sampleQuery);
        
        console.log('📋 Sample of duplicates that will be removed:');
        console.log('─'.repeat(100));
        console.log('ID'.padEnd(10) + 'Sport'.padEnd(15) + 'Type'.padEnd(10) + 'Tier'.padEnd(8) + 'Home'.padEnd(20) + 'Away'.padEnd(20) + 'Created');
        console.log('─'.repeat(100));
        sampleResult.rows.forEach(row => {
            console.log(
                String(row.id).padEnd(10) +
                String(row.sport || '').padEnd(15) +
                String(row.type || '').padEnd(10) +
                String(row.tier || '').padEnd(8) +
                String(row.home_team || '').substring(0, 19).padEnd(20) +
                String(row.away_team || '').substring(0, 19).padEnd(20) +
                String(row.created_at).substring(0, 19)
            );
        });
        console.log('─'.repeat(100));
        console.log('');

        // Confirm before deletion
        console.log('⚠️  This will DELETE the duplicate records shown above and all others like them.');
        console.log('⚠️  The newest record (highest ID) for each match will be KEPT.');
        console.log('');
        
        // In production, you might want to add a confirmation prompt here
        // For now, we'll proceed with the deletion
        
        console.log('🗑️  Deleting duplicates...');
        
        // Delete duplicates (keep only newest per group)
        const deleteQuery = `
            WITH duplicates AS (
                SELECT 
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            LOWER(COALESCE(sport, '')),
                            LOWER(COALESCE(type, '')),
                            LOWER(COALESCE(tier, '')),
                            LOWER(COALESCE(market_type, '')),
                            LOWER(COALESCE(home_team, '')),
                            LOWER(COALESCE(away_team, '')),
                            COALESCE(matches->0->>'kickoff', created_at::date)
                        ORDER BY id DESC
                    ) as rn
                FROM direct1x2_prediction_final
                WHERE publish_run_id IS NULL
            )
            DELETE FROM direct1x2_prediction_final
            WHERE id IN (SELECT id FROM duplicates WHERE rn > 1)
        `;
        
        const deleteResult = await pool.query(deleteQuery);
        const deletedCount = deleteResult.rowCount;
        
        console.log(`✅ Successfully deleted ${deletedCount} duplicate fallback predictions\n`);
        
        // Verify the cleanup
        const verifyQuery = `
            SELECT COUNT(*) as remaining_duplicates
            FROM (
                SELECT 
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            LOWER(COALESCE(sport, '')),
                            LOWER(COALESCE(type, '')),
                            LOWER(COALESCE(tier, '')),
                            LOWER(COALESCE(market_type, '')),
                            LOWER(COALESCE(home_team, '')),
                            LOWER(COALESCE(away_team, '')),
                            COALESCE(matches->0->>'kickoff', created_at::date)
                        ORDER BY id DESC
                    ) as rn
                FROM direct1x2_prediction_final
                WHERE publish_run_id IS NULL
            ) duplicates
            WHERE rn > 1
        `;
        
        const verifyResult = await pool.query(verifyQuery);
        const remainingDuplicates = parseInt(verifyResult.rows[0].remaining_duplicates);
        
        if (remainingDuplicates === 0) {
            console.log('✅ Verification complete: No remaining duplicates found.');
        } else {
            console.log(`⚠️  Verification complete: ${remainingDuplicates} duplicates still remain.`);
        }
        
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('                    CLEANUP COMPLETE');
        console.log('═══════════════════════════════════════════════════════════════');
        
    } catch (err) {
        console.error('❌ Cleanup failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        await pool.end();
        console.log('\n✅ Database connection closed');
    }
}

cleanupDuplicates();
