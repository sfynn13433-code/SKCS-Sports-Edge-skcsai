'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

const connStr = process.env.DATABASE_URL;

console.log('═'.repeat(60));
console.log('   MIGRATION 1: PLAN VISIBILITY BACKFILL');
console.log('═'.repeat(60) + '\n');

const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
});

async function backfillPlanVisibility() {
    console.log('STEP 1: Analyzing existing predictions...\n');
    
    // Get all current predictions
    const predictions = await pool.query(`
        SELECT id, tier, type, total_confidence, plan_visibility
        FROM predictions_final
        ORDER BY id
    `);
    
    console.log(`Found ${predictions.rows.length} predictions to analyze\n`);
    
    // Define visibility rules based on tier
    function getVisibilityForTier(tier, type) {
        const tierLower = String(tier || '').toLowerCase();
        const typeLower = String(type || '').toLowerCase();
        
        // Mega acca only for elite plans
        if (typeLower === 'mega_acca_12') {
            return ['elite_4day_deep_dive', 'elite_9day_deep_strike', 
                    'elite_14day_deep_pro', 'elite_30day_deep_vip'];
        }
        
        // ACCA for all plans but different limits
        if (typeLower === 'acca_6match') {
            if (tierLower === 'elite' || tierLower === 'deep') {
                return ['core_4day_sprint', 'core_9day_run', 'core_14day_pro', 'core_30day_limitless',
                        'elite_4day_deep_dive', 'elite_9day_deep_strike', 
                        'elite_14day_deep_pro', 'elite_30day_deep_vip'];
            }
            return ['core_4day_sprint', 'core_9day_run', 'core_14day_pro', 'core_30day_limitless'];
        }
        
        // Multi and same_match for all core/elite plans
        if (typeLower === 'multi' || typeLower === 'same_match') {
            return ['core_4day_sprint', 'core_9day_run', 'core_14day_pro', 'core_30day_limitless',
                    'elite_4day_deep_dive', 'elite_9day_deep_strike', 
                    'elite_14day_deep_pro', 'elite_30day_deep_vip'];
        }
        
        // Secondary for all plans
        if (typeLower === 'secondary') {
            return ['core_4day_sprint', 'core_9day_run', 'core_14day_pro', 'core_30day_limitless',
                    'elite_4day_deep_dive', 'elite_9day_deep_strike', 
                    'elite_14day_deep_pro', 'elite_30day_deep_vip'];
        }
        
        // Direct predictions - tier-based
        if (tierLower === 'elite' || tierLower === 'deep') {
            return ['elite_4day_deep_dive', 'elite_9day_deep_strike', 
                    'elite_14day_deep_pro', 'elite_30day_deep_vip'];
        }
        
        // Core tier
        return ['core_4day_sprint', 'core_9day_run', 'core_14day_pro', 'core_30day_limitless'];
    }
    
    console.log('STEP 2: Generating visibility assignments...\n');
    
    const updates = [];
    let updateCount = 0;
    let skipCount = 0;
    
    for (const pred of predictions.rows) {
        const currentVisibility = pred.plan_visibility;
        const alreadyHasVisibility = Array.isArray(currentVisibility) && currentVisibility.length > 0;
        
        if (alreadyHasVisibility) {
            skipCount++;
            continue;
        }
        
        const visibility = getVisibilityForTier(pred.tier, pred.type);
        
        updates.push({
            id: pred.id,
            tier: pred.tier,
            type: pred.type,
            visibility: visibility
        });
        
        updateCount++;
    }
    
    console.log(`   Already have visibility: ${skipCount}`);
    console.log(`   Need to update: ${updateCount}\n`);
    
    if (updates.length === 0) {
        console.log('✓ All predictions already have visibility set!');
        await pool.end();
        return;
    }
    
    console.log('STEP 3: Applying updates...\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const update of updates) {
        try {
            await pool.query(`
                UPDATE predictions_final 
                SET plan_visibility = $1
                WHERE id = $2
            `, [JSON.stringify(update.visibility), update.id]);
            
            successCount++;
            if (successCount <= 5) {
                console.log(`   ✓ ID:${update.id} | ${update.tier} | ${update.type}`);
                console.log(`     visibility: ${JSON.stringify(update.visibility)}`);
            } else if (successCount === 6) {
                console.log(`   ... and ${updates.length - 5} more`);
            }
        } catch (e) {
            errorCount++;
            console.log(`   ✗ ID:${update.id} ERROR: ${e.message}`);
        }
    }
    
    console.log('\n' + '─'.repeat(60));
    console.log(`UPDATE SUMMARY: ${successCount} success, ${errorCount} errors\n`);
    
    // Verify the updates
    console.log('STEP 4: Verifying updates...\n');
    
    const verification = await pool.query(`
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN plan_visibility IS NULL OR jsonb_array_length(plan_visibility) = 0 THEN 1 END) as empty,
            COUNT(CASE WHEN jsonb_array_length(plan_visibility) > 0 THEN 1 END) as populated
        FROM predictions_final
    `);
    
    const v = verification.rows[0];
    console.log(`   Total predictions: ${v.total}`);
    console.log(`   With visibility: ${v.populated}`);
    console.log(`   Without visibility: ${v.empty}`);
    
    if (v.empty === '0') {
        console.log('\n✅ ALL PREDICTIONS NOW HAVE VISIBILITY SET!\n');
    } else {
        console.log(`\n⚠ ${v.empty} predictions still need visibility\n`);
    }
    
    await pool.end();
}

backfillPlanVisibility().catch(e => {
    console.error('FATAL:', e.message);
    pool.end();
});
