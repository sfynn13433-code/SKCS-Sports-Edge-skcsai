require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function masterQA() {
    console.log('\n========================================');
    console.log('   MASTER QA CHECKLIST - ALL 8 PHASES');
    console.log('========================================\n');
    
    // PHASE 1 & 2: INGESTION & AI FLOW
    console.log('=== PHASE 1 & 2: INGESTION & AI FLOW ===\n');

    const finalTableLookup = await pool.query(`
        SELECT
            CASE
                WHEN to_regclass('public.direct1x2_prediction_final') IS NOT NULL THEN 'direct1x2_prediction_final'
                WHEN to_regclass('public.predictions_final') IS NOT NULL THEN 'predictions_final'
                ELSE NULL
            END AS table_name
    `);
    const finalTable = finalTableLookup.rows?.[0]?.table_name || null;
    
    // Check events
    const events = await pool.query(`
        SELECT id, home_team, away_team, commence_time, status 
        FROM events 
        ORDER BY commence_time DESC 
        LIMIT 5
    `);
    console.log('📅 Events (latest 5):');
    events.rows.forEach(e => {
        const time = e.commence_time ? new Date(e.commence_time).toISOString().slice(0,10) : 'N/A';
        console.log(`  - ${e.home_team} vs ${e.away_team} | ${time} | status: ${e.status || 'NS'}`);
    });
    
    // Check predictions_final (singles)
    let singles = { rows: [] };
    if (finalTable) {
        singles = await pool.query(`
            SELECT id, tier, type, recommendation
            FROM ${finalTable}
            WHERE type = 'direct'
            ORDER BY id DESC
            LIMIT 3
        `);
    }
    console.log('\n🎯 Predictions (direct/singles):');
    if (singles.rows.length > 0) {
        singles.rows.forEach(s => console.log(`  - ID ${s.id} | tier: ${s.tier} | type: ${s.type}`));
    } else {
        console.log(finalTable ? '  (no single predictions yet)' : '  (final predictions table missing)');
    }
    
    // Check predictions_accuracy
    let accuracyResult = { rows: [] };
    console.log('\n✅ Predictions Accuracy (graded):');
    try {
        accuracyResult = await pool.query(`
            SELECT id, predicted_outcome, actual_result, is_correct
            FROM predictions_accuracy 
            ORDER BY id DESC 
            LIMIT 5
        `);
        if (accuracyResult.rows.length > 0) {
            accuracyResult.rows.forEach(a => {
                console.log(`  - ${a.predicted_outcome} vs ${a.actual_result} = ${a.is_correct ? 'WON' : 'LOST'}`);
            });
        } else {
            console.log('  (no graded predictions yet)');
        }
    } catch (e) {
        console.log('  - Error checking accuracy:', e.message);
    }
    
    // PHASE 3B: MONETIZATION ENGINE
    console.log('\n\n=== PHASE 3B: MONETIZATION (ACCAS) ===\n');
    
    let accas = { rows: [] };
    if (finalTable) {
        accas = await pool.query(`
            SELECT id, tier, recommendation,
                   jsonb_array_length(matches) as legs
            FROM ${finalTable}
            WHERE type = 'acca'
            ORDER BY created_at DESC
            LIMIT 10
        `);
    }
    console.log('💰 Accumulators:');
    if (accas.rows.length === 0) {
        console.log('  ⚠️  No accas found!');
    } else {
        accas.rows.forEach(a => {
            const valid = (a.legs === 6 || a.legs === 12);
            console.log(`  - ${a.recommendation} | tier: ${a.tier} | legs: ${a.legs} ${valid ? '✅' : '❌ INVALID'}`);
        });
    }
    
    // Check tier rules
    const tierRules = await pool.query(`SELECT * FROM tier_rules`);
    console.log('\n📋 Tier Rules:');
    tierRules.rows.forEach(t => console.log(`  - ${t.tier}: min_conf=${t.min_confidence}, max_acca=${t.max_acca_size}`));
    
    // PHASE 4: CACHE
    console.log('\n\n=== PHASE 4: CACHE (rapidapi_cache) ===\n');
    
    const cache = await pool.query(`
        SELECT cache_key, provider_name, updated_at
        FROM rapidapi_cache 
        ORDER BY updated_at DESC 
        LIMIT 5
    `);
    console.log('📦 rapidapi_cache:');
    if (cache.rows.length === 0) {
        console.log('  ⚠️  Cache is empty - API calls not being cached');
    } else {
        cache.rows.forEach(c => {
            const time = c.updated_at ? new Date(c.updated_at).toISOString().slice(0,19) : 'N/A';
            console.log(`  - ${c.provider_name} | ${time}`);
        });
    }
    
    // PHASE 5: SCHEDULING
    console.log('\n\n=== PHASE 5: HEARTBEAT (scheduling_logs) ===\n');
    
    const logs = await pool.query(`
        SELECT schedule_type, status, duration_ms, started_at, completed_at, error_message
        FROM scheduling_logs 
        ORDER BY started_at DESC 
        LIMIT 5
    `);
    console.log('📊 Scheduling Logs:');
    logs.rows.forEach(l => {
        const statusIcon = l.status === 'success' ? '✅' : l.status === 'failed' ? '❌' : '⏳';
        const time = l.started_at ? new Date(l.started_at).toISOString().slice(0,19) : '';
        console.log(`  - ${l.schedule_type} | ${l.status} ${statusIcon} | ${l.duration_ms}ms | ${time}`);
        if (l.error_message) console.log(`    ERROR: ${l.error_message}`);
    });
    
    // PHASE 6: RLS
    console.log('\n\n=== PHASE 6: SECURITY (RLS) ===\n');
    
    let rlsEnabled = false;
    if (finalTable) {
        const rlsCheck = await pool.query(`
            SELECT relrowsecurity
            FROM pg_class
            WHERE relname = $1
            LIMIT 1
        `, [finalTable]);
        rlsEnabled = Boolean(rlsCheck.rows[0]?.relrowsecurity);
    }
    console.log(`🔐 RLS enabled (${finalTable || 'missing_final_table'}): ${rlsEnabled ? 'YES ✅' : 'NO ❌'}`);

    const policies = await pool.query(`
        SELECT policyname, cmd
        FROM pg_policies
        WHERE tablename = COALESCE($1, '')
    `, [finalTable]);
    console.log('Policies:', policies.rows.map(p => p.policyname).join(', '));
    
    // PHASE 7: ARCHIVING
    console.log('\n\n=== PHASE 7: MAINTENANCE (Archive/Cleanup) ===\n');
    
    const archive = await pool.query(`SELECT COUNT(*) as cnt FROM zz_archive_matches`);
    console.log(`📦 zz_archive_matches: ${archive.rows[0].cnt} rows`);
    
    // PHASE 8: INDEXES
    console.log('\n\n=== PHASE 8: PERFORMANCE (Indexes) ===\n');
    
    const indexes = await pool.query(`
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname LIKE 'idx_%'
    `);
    console.log(`⚡ Total custom indexes: ${indexes.rows.length}`);
    
// FINAL SUMMARY
    console.log('\n\n========================================');
    console.log('   QA SUMMARY');
    console.log('========================================\n');
    
    const hasEvents = events.rows.length > 0;
    const hasSingles = singles.rows.length > 0;
    const hasAccas = accas.rows.length > 0;
    const hasCache = cache.rows.length > 0;
    const hasSuccessLogs = logs.rows.some(l => l.status === 'success');
    const hasRls = rlsEnabled;
    const hasIndexes = indexes.rows.length >= 9;
    const hasAccuracy = accuracyResult && accuracyResult.rows.length > 0;
    
    console.log('Quick Status:');
    console.log(`  Events populated: ${hasEvents ? '✅' : '❌'}`);
    console.log(`  Predictions (direct): ${hasSingles ? '✅' : '❌'}`);
    console.log(`  Accuracy grading: ${hasAccuracy ? '✅' : '❌'}`);
    console.log(`  Accumulators (6/12-leg): ${hasAccas ? '✅' : '❌'}`);
    console.log(`  API Cache: ${hasCache ? '✅' : '⚠️ Empty'}`);
    console.log(`  Cron Jobs: ${hasSuccessLogs ? '✅' : '❌'}`);
    console.log(`  RLS Security: ${hasRls ? '✅' : '❌'}`);
    console.log(`  Performance Indexes: ${hasIndexes ? '✅' : '❌'}`);
    
    console.log('\n✅ QA Complete!\n');
    
    await pool.end();
    process.exit(0);
}

masterQA().catch(e => { console.error(e.message); process.exit(1); });
