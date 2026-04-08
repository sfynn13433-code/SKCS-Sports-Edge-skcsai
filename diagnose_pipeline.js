#!/usr/bin/env node
/**
 * SKCS Pipeline Diagnostic Script
 * Checks the health of the entire prediction pipeline
 */

'use strict';

require('dotenv').config();
const { query } = require('./backend/db');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function checkDatabase() {
    console.log('\n=== DATABASE CONNECTION ===');
    try {
        const result = await query('SELECT NOW() as current_time, version()');
        console.log('✅ Database connected');
        console.log(`   Current time: ${result.rows[0].current_time}`);
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

async function checkDataCounts() {
    console.log('\n=== DATA COUNTS ===');
    try {
        const tables = [
            'predictions_raw',
            'predictions_filtered',
            'predictions_final',
            'prediction_publish_runs'
        ];

        for (const table of tables) {
            const result = await query(`SELECT COUNT(*) as count FROM ${table}`);
            const count = parseInt(result.rows[0].count);
            console.log(`${table}: ${count} records`);
        }

        // Check recent activity (last 24 hours)
        console.log('\n--- Last 24 Hours ---');
        const recentRaw = await query(
            `SELECT COUNT(*) as count FROM predictions_raw WHERE created_at > NOW() - INTERVAL '24 hours'`
        );
        console.log(`predictions_raw: ${recentRaw.rows[0].count} records`);

        const recentFinal = await query(
            `SELECT COUNT(*) as count FROM predictions_final WHERE created_at > NOW() - INTERVAL '24 hours'`
        );
        console.log(`predictions_final: ${recentFinal.rows[0].count} records`);

        return true;
    } catch (error) {
        console.error('❌ Failed to check data counts:', error.message);
        return false;
    }
}

async function checkRecentPublishRuns() {
    console.log('\n=== RECENT PUBLISH RUNS ===');
    try {
        const result = await query(`
            SELECT 
                id,
                trigger_source,
                status,
                requested_sports,
                run_scope,
                started_at,
                completed_at,
                error_message,
                metadata
            FROM prediction_publish_runs
            ORDER BY started_at DESC
            LIMIT 5
        `);

        if (result.rows.length === 0) {
            console.log('⚠️  No publish runs found');
            return false;
        }

        for (const run of result.rows) {
            const status = run.status === 'completed' ? '✅' : run.status === 'failed' ? '❌' : '⏳';
            console.log(`${status} Run #${run.id} - ${run.trigger_source}`);
            console.log(`   Status: ${run.status}`);
            console.log(`   Started: ${run.started_at}`);
            if (run.completed_at) {
                console.log(`   Completed: ${run.completed_at}`);
            }
            if (run.error_message) {
                console.log(`   Error: ${run.error_message}`);
            }
            if (run.metadata && run.metadata.summary) {
                console.log(`   Summary: ${JSON.stringify(run.metadata.summary, null, 2)}`);
            }
            console.log('');
        }

        return true;
    } catch (error) {
        console.error('❌ Failed to check publish runs:', error.message);
        return false;
    }
}

async function checkPredictionsByType() {
    console.log('\n=== PREDICTIONS BY TYPE (Last 7 Days) ===');
    try {
        const result = await query(`
            SELECT 
                type,
                tier,
                COUNT(*) as count,
                AVG(total_confidence) as avg_confidence,
                MIN(created_at) as earliest,
                MAX(created_at) as latest
            FROM predictions_final
            WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY type, tier
            ORDER BY type, tier
        `);

        if (result.rows.length === 0) {
            console.log('⚠️  No predictions found in the last 7 days');
            return false;
        }

        for (const row of result.rows) {
            console.log(`${row.type} (${row.tier}): ${row.count} predictions, avg confidence: ${parseFloat(row.avg_confidence).toFixed(1)}%`);
        }

        return true;
    } catch (error) {
        console.error('❌ Failed to check predictions by type:', error.message);
        return false;
    }
}

async function checkSupabaseConnection() {
    console.log('\n=== SUPABASE CONNECTION ===');
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.log('⚠️  Supabase credentials not configured');
        return false;
    }

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data, error } = await supabase
            .from('predictions_final')
            .select('id', { count: 'exact', head: true });

        if (error) {
            console.error('❌ Supabase connection failed:', error.message);
            return false;
        }

        console.log('✅ Supabase connected');
        console.log(`   predictions_final count: ${data.length || 0}`);
        return true;
    } catch (error) {
        console.error('❌ Supabase check failed:', error.message);
        return false;
    }
}

async function checkEnvironmentVariables() {
    console.log('\n=== ENVIRONMENT VARIABLES ===');
    const requiredVars = [
        'DATABASE_URL',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'X_APISPORTS_KEY',
        'ODDS_API_KEY'
    ];

    const optionalVars = [
        'OPENAI_KEY',
        'JWT_SECRET',
        'ADMIN_API_KEY',
        'USER_API_KEY'
    ];

    let allRequired = true;

    for (const envVar of requiredVars) {
        const value = process.env[envVar];
        if (!value || value.trim().length === 0) {
            console.log(`❌ ${envVar}: NOT SET`);
            allRequired = false;
        } else {
            const masked = value.substring(0, 10) + '...' + value.substring(value.length - 4);
            console.log(`✅ ${envVar}: ${masked}`);
        }
    }

    for (const envVar of optionalVars) {
        const value = process.env[envVar];
        if (!value || value.trim().length === 0) {
            console.log(`⚠️  ${envVar}: NOT SET (optional)`);
        } else {
            const masked = value.substring(0, 10) + '...' + value.substring(value.length - 4);
            console.log(`✅ ${envVar}: ${masked}`);
        }
    }

    return allRequired;
}

async function checkDataMode() {
    console.log('\n=== DATA MODE ===');
    const dataMode = process.env.DATA_MODE || 'test';
    if (dataMode === 'test') {
        console.log('⚠️  DATA_MODE is set to "test" - serving test data, not live predictions');
        console.log('   Set DATA_MODE=live in your .env file to use real predictions');
    } else {
        console.log(`✅ DATA_MODE: ${dataMode}`);
    }
    return dataMode;
}

async function generateReport() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║       SKCS AI PREDICTION PIPELINE DIAGNOSTIC REPORT      ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`\nGenerated at: ${new Date().toISOString()}`);

    const envOk = await checkEnvironmentVariables();
    const dataMode = await checkDataMode();
    const dbOk = await checkDatabase();
    
    if (!dbOk) {
        console.log('\n❌ Database connection failed - cannot continue diagnostic');
        return;
    }

    await checkDataCounts();
    await checkRecentPublishRuns();
    await checkPredictionsByType();
    await checkSupabaseConnection();

    console.log('\n=== RECOMMENDATIONS ===');
    if (dataMode === 'test') {
        console.log('1. Set DATA_MODE=live in your .env file to enable real predictions');
    }
    if (!envOk) {
        console.log('2. Configure all required environment variables');
    }
    
    console.log('\n=== QUICK FIXES ===');
    console.log('To trigger a manual sync, run:');
    console.log('  node backend/services/syncService.js');
    console.log('\nTo rebuild predictions, call:');
    console.log('  POST /api/predictions/rebuild (admin endpoint)');
    console.log('\nTo clear test data, call:');
    console.log('  POST /api/predictions/clear-test (admin endpoint)');
    console.log('');
}

// Run diagnostic
generateReport()
    .then(() => {
        console.log('✅ Diagnostic complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Diagnostic failed:', error);
        console.error(error.stack);
        process.exit(1);
    });
