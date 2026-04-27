'use strict';

require('dotenv').config();
require('dotenv').config({ path: 'backend/.env' });

const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

function toDisplayValue(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') {
        return value.length > 140 ? `${value.substring(0, 140)}...` : value;
    }
    if (typeof value === 'object') {
        const asJson = JSON.stringify(value);
        return asJson.length > 140 ? `${asJson.substring(0, 140)}...` : asJson;
    }
    return String(value);
}

async function debugCricketSchema() {
    console.log('=== CRICKET TABLES SCHEMA INSPECTION ===\n');
    const watchdog = setTimeout(() => {
        console.error('\n[debug-cricket-insights-schema] hard timeout reached');
        process.exit(2);
    }, 60000);
    
    let connectionString = process.env.DATABASE_URL || '';
    if (connectionString.includes('db.ghzjntdvaptuxfpvhybb.supabase.co')) {
        connectionString = connectionString
            .replace('db.ghzjntdvaptuxfpvhybb.supabase.co:5432', 'aws-1-eu-central-1.pooler.supabase.com:6543')
            .replace('postgres:', 'postgres.ghzjntdvaptuxfpvhybb:');
        if (!connectionString.includes('pgbouncer=')) {
            connectionString += (connectionString.includes('?') ? '&' : '?') + 'pgbouncer=true';
        }
    }

    const pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        ssl: connectionString ? { rejectUnauthorized: false } : undefined
    });

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_KEY ||
        process.env.SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );

    try {
        const connectWithTimeout = Promise.race([
            pool.connect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('PG connection timeout')), 20000))
        ]);

        await connectWithTimeout;
        console.log('✅ Connected to database\n');

        // cricket_insights_final schema
        console.log('--- cricket_insights_final schema ---');
        const insightsSchemaQuery = `
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'cricket_insights_final' 
            ORDER BY ordinal_position;
        `;
        
        const insightsSchemaResult = await pool.query(insightsSchemaQuery);
        insightsSchemaResult.rows.forEach(row => {
            console.log(`${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });
        
        console.log('\n--- cricket_insights_final sample rows (10) ---');
        const insightsSampleQuery = `
            SELECT *
            FROM cricket_insights_final 
            ORDER BY created_at DESC NULLS LAST 
            LIMIT 10;
        `;
        
        const insightsSampleResult = await pool.query(insightsSampleQuery);
        console.log(`Found ${insightsSampleResult.rows.length} rows`);
        insightsSampleResult.rows.forEach((row, i) => {
            console.log(`\nRow ${i + 1}:`);
            Object.keys(row).forEach(key => {
                const value = row[key];
                console.log(`  ${key}: ${toDisplayValue(value)}`);
            });
        });

        // cricket_fixtures schema
        console.log('\n\n--- cricket_fixtures schema ---');
        const fixturesSchemaQuery = `
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'cricket_fixtures' 
            ORDER BY ordinal_position;
        `;
        
        const fixturesSchemaResult = await pool.query(fixturesSchemaQuery);
        fixturesSchemaResult.rows.forEach(row => {
            console.log(`${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });
        
        console.log('\n--- cricket_fixtures sample rows (10) ---');
        const fixturesSampleQuery = `
            SELECT *
            FROM cricket_fixtures 
            ORDER BY created_at DESC NULLS LAST 
            LIMIT 10;
        `;
        
        const fixturesSampleResult = await pool.query(fixturesSampleQuery);
        console.log(`Found ${fixturesSampleResult.rows.length} rows`);
        fixturesSampleResult.rows.forEach((row, i) => {
            console.log(`\nRow ${i + 1}:`);
            Object.keys(row).forEach(key => {
                const value = row[key];
                console.log(`  ${key}: ${toDisplayValue(value)}`);
            });
        });

        // cricket_market_rules schema
        console.log('\n\n--- cricket_market_rules schema ---');
        const rulesSchemaQuery = `
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'cricket_market_rules' 
            ORDER BY ordinal_position;
        `;
        
        try {
            const rulesSchemaResult = await pool.query(rulesSchemaQuery);
            rulesSchemaResult.rows.forEach(row => {
                console.log(`${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
            });
            
            console.log('\n--- cricket_market_rules sample rows (10) ---');
            const rulesSampleQuery = `
                SELECT *
                FROM cricket_market_rules 
                ORDER BY created_at DESC NULLS LAST 
                LIMIT 10;
            `;
            
            const rulesSampleResult = await pool.query(rulesSampleQuery);
            console.log(`Found ${rulesSampleResult.rows.length} rows`);
            rulesSampleResult.rows.forEach((row, i) => {
                console.log(`\nRow ${i + 1}:`);
                Object.keys(row).forEach(key => {
                    const value = row[key];
                    console.log(`  ${key}: ${toDisplayValue(value)}`);
                });
            });
        } catch (err) {
            console.log('cricket_market_rules table not found or error:', err.message);
        }

        console.log('\n=== INSPECTION COMPLETE ===');

    } catch (error) {
        console.error('Database error:', error.message);
        console.log('\n--- Falling back to Supabase row-key schema introspection ---');

        const tables = ['cricket_insights_final', 'cricket_fixtures', 'cricket_market_rules'];
        for (const tableName of tables) {
            const { data, error: tableErr } = await supabase
                .from(tableName)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            if (tableErr) {
                console.log(`${tableName}: ${tableErr.message}`);
                continue;
            }

            const keys = Object.keys(data?.[0] || {});
            console.log(`\n--- ${tableName} inferred columns ---`);
            keys.forEach((key) => console.log(key));
            console.log(`--- ${tableName} sample rows (${data?.length || 0}) ---`);

            (data || []).slice(0, 10).forEach((row, idx) => {
                console.log(`\nRow ${idx + 1}:`);
                Object.keys(row).forEach((key) => {
                    console.log(`  ${key}: ${toDisplayValue(row[key])}`);
                });
            });
        }
        console.log('\n=== FALLBACK INSPECTION COMPLETE ===');
    } finally {
        clearTimeout(watchdog);
        try {
            await Promise.race([
                pool.end(),
                new Promise((resolve) => setTimeout(resolve, 2000))
            ]);
        } catch (_err) {
            // Ignore pool shutdown errors in debug utility.
        }
    }
}

debugCricketSchema().catch(console.error);
