'use strict';

const { query } = require('../backend/db');

async function debugCricketTables() {
    console.log('=== CRICKET TABLES SCHEMA INSPECTION ===\n');

    try {
        // cricket_insights_final schema
        console.log('--- cricket_insights_final schema ---');
        const insightsSchemaQuery = `
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'cricket_insights_final' 
            ORDER BY ordinal_position;
        `;
        
        const insightsSchemaResult = await query(insightsSchemaQuery);
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
        
        const insightsSampleResult = await query(insightsSampleQuery);
        console.log(`Found ${insightsSampleResult.rows.length} rows`);
        insightsSampleResult.rows.forEach((row, i) => {
            console.log(`\nRow ${i + 1}:`);
            Object.keys(row).forEach(key => {
                const value = row[key];
                if (value !== null && value !== undefined) {
                    const displayValue = typeof value === 'string' && value.length > 100 
                        ? value.substring(0, 100) + '...' 
                        : value;
                    console.log(`  ${key}: ${displayValue}`);
                } else {
                    console.log(`  ${key}: null`);
                }
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
        
        const fixturesSchemaResult = await query(fixturesSchemaQuery);
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
        
        const fixturesSampleResult = await query(fixturesSampleQuery);
        console.log(`Found ${fixturesSampleResult.rows.length} rows`);
        fixturesSampleResult.rows.forEach((row, i) => {
            console.log(`\nRow ${i + 1}:`);
            Object.keys(row).forEach(key => {
                const value = row[key];
                if (value !== null && value !== undefined) {
                    const displayValue = typeof value === 'string' && value.length > 100 
                        ? value.substring(0, 100) + '...' 
                        : value;
                    console.log(`  ${key}: ${displayValue}`);
                } else {
                    console.log(`  ${key}: null`);
                }
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
            const rulesSchemaResult = await query(rulesSchemaQuery);
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
            
            const rulesSampleResult = await query(rulesSampleQuery);
            console.log(`Found ${rulesSampleResult.rows.length} rows`);
            rulesSampleResult.rows.forEach((row, i) => {
                console.log(`\nRow ${i + 1}:`);
                Object.keys(row).forEach(key => {
                    const value = row[key];
                    if (value !== null && value !== undefined) {
                        const displayValue = typeof value === 'string' && value.length > 100 
                            ? value.substring(0, 100) + '...' 
                            : value;
                        console.log(`  ${key}: ${displayValue}`);
                    } else {
                        console.log(`  ${key}: null`);
                    }
                });
            });
        } catch (err) {
            console.log('cricket_market_rules table not found or error:', err.message);
        }

        console.log('\n=== INSPECTION COMPLETE ===');

    } catch (error) {
        console.error('Database error:', error);
    }
}

debugCricketTables().catch(console.error);
