'use strict';

// Load environment variables for local testing
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { checkAccountHealth, discoverCapabilities } = require('../backend/services/sportsrcHealthService');

async function runTest() {
    console.log('=== SKCS SportSRC Provider Health & Discovery Test ===');
    
    try {
        // Ensure table exists locally for testing
        const { query } = require('../backend/database');
        await query(`
            CREATE TABLE IF NOT EXISTS sportsrc_account_health (
                id           BIGSERIAL PRIMARY KEY,
                checked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                plan         TEXT,
                daily_limit  INTEGER,
                remaining    INTEGER,
                reset_time   TIMESTAMPTZ,
                status       TEXT,
                metadata     JSONB NOT NULL DEFAULT '{}'::jsonb
            );
        `);

        console.log('\n1. Fetching Account Health...');
        const health = await checkAccountHealth();
        if (health) {
            console.log('✅ Account Health Retrieved:');
            console.table([{
                plan: health.plan,
                daily_limit: health.daily_limit,
                remaining: health.remaining,
                reset_time: health.reset_time,
                status: health.status
            }]);
        } else {
            console.log('⚠️ Failed to retrieve account health. Ensure SPORTSRC_API_KEY is configured correctly.');
        }

        console.log('\n2. Fetching Capability Discovery...');
        const sports = await discoverCapabilities();
        console.log(`✅ Discovered ${sports.length} supported sports:`);
        console.log(sports.join(', '));
        
        console.log('\n=== Test Complete ===');
        process.exit(0);
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        process.exit(1);
    }
}

runTest();
