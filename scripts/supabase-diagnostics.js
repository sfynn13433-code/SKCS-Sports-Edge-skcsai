/**
 * Supabase Full Diagnostic Script
 * 
 * This script performs a comprehensive diagnostic of the Supabase database:
 * - Lists all tables with row counts and sizes
 * - Identifies duplicate records in key tables
 * - Extracts all constraints and rules
 * - Analyzes merge potential for duplicate data
 * 
 * RUN: node scripts/supabase-diagnostics.js
 * 
 * NOTE: This is READ-ONLY. No data will be modified.
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

async function runDiagnostics() {
    console.log('🔍 Starting Supabase Full Diagnostic...\n');
    
    const report = {
        timestamp: new Date().toISOString(),
        database_info: {},
        tables: [],
        duplicates: {},
        constraints: {},
        rules: {},
        recommendations: []
    };

    try {
        await pool.connect();
        console.log('✅ Connected to database\n');

        // 1. Database Information
        console.log('📊 Gathering database information...');
        const dbInfo = await pool.query(`
            SELECT 
                version() as postgresql_version,
                current_database() as database_name,
                current_user as current_user,
                inet_server_addr() as server_ip,
                inet_server_port() as server_port
        `);
        report.database_info = dbInfo.rows[0];
        console.log('   Database:', report.database_info.database_name);
        console.log('   PostgreSQL:', report.database_info.postgresql_version.split(',')[0]);
        console.log('   User:', report.database_info.current_user);
        console.log('');

        // 2. List all tables with row counts and sizes
        console.log('📋 Analyzing tables...');
        const tablesQuery = await pool.query(`
            SELECT 
                schemaname,
                tablename,
                tableowner
            FROM pg_tables
            WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY schemaname, tablename
        `);

        for (const table of tablesQuery.rows) {
            console.log(`   Analyzing table: ${table.tablename}`);
            
            // Get row count
            const countQuery = await pool.query(`
                SELECT COUNT(*) as row_count
                FROM "${table.schemaname}"."${table.tablename}"
            `);
            
            // Get table size
            const sizeQuery = await pool.query(`
                SELECT 
                    pg_size_pretty(pg_total_relation_size('${table.schemaname}.${table.tablename}')) as total_size,
                    pg_size_pretty(pg_relation_size('${table.schemaname}.${table.tablename}')) as table_size,
                    pg_size_pretty(pg_total_relation_size('${table.schemaname}.${table.tablename}') - pg_relation_size('${table.schemaname}.${table.tablename}')) as indexes_size
            `);

            report.tables.push({
                schema: table.schemaname,
                name: table.tablename,
                owner: table.tableowner,
                row_count: parseInt(countQuery.rows[0].row_count),
                total_size: sizeQuery.rows[0].total_size,
                table_size: sizeQuery.rows[0].table_size,
                indexes_size: sizeQuery.rows[0].indexes_size
            });
        }

        console.log(`   Found ${report.tables.length} tables\n`);

        // 3. Identify duplicate records in key tables
        console.log('🔍 Checking for duplicates in key tables...');
        const keyTables = [
            'direct1x2_prediction_final',
            'predictions_raw',
            'predictions_filtered',
            'raw_fixtures',
            'match_context_data',
            'ai_predictions',
            'rapidapi_cache'
        ];

        for (const tableName of keyTables) {
            const tableExists = report.tables.find(t => t.name === tableName);
            if (!tableExists || tableExists.row_count === 0) {
                console.log(`   ⏭️  Skipping ${tableName} (not found or empty)`);
                continue;
            }

            console.log(`   Checking ${tableName}...`);

            try {
                // Get primary key columns
                const pkQuery = await pool.query(`
                    SELECT a.attname
                    FROM pg_index i
                    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                    WHERE i.indrelid = '${tableName}'::regclass
                    AND i.indisprimary
                `);
                
                const pkColumns = pkQuery.rows.map(r => r.attname);
                
                // Check for duplicates based on all columns except id/created_at/updated_at
                const columnsQuery = await pool.query(`
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = $1
                    AND table_schema = 'public'
                    ORDER BY ordinal_position
                `, [tableName]);

                const excludeColumns = ['id', 'created_at', 'updated_at', 'publish_run_id'];
                const compareColumns = columnsQuery.rows
                    .filter(r => !excludeColumns.includes(r.column_name))
                    .map(r => r.column_name);

                if (compareColumns.length > 0) {
                    const duplicateQuery = `
                        SELECT COUNT(*) as duplicate_count
                        FROM (
                            SELECT ${compareColumns.join(', ')}, COUNT(*) as cnt
                            FROM ${tableName}
                            GROUP BY ${compareColumns.join(', ')}
                            HAVING COUNT(*) > 1
                        ) duplicates
                    `;
                    
                    const dupResult = await pool.query(duplicateQuery);
                    const dupCount = parseInt(dupResult.rows[0].duplicate_count);
                    
                    if (dupCount > 0) {
                        report.duplicates[tableName] = {
                            duplicate_groups: dupCount,
                            comparison_columns: compareColumns
                        };
                        console.log(`   ⚠️  Found ${dupCount} duplicate groups in ${tableName}`);
                    } else {
                        console.log(`   ✅ No duplicates found in ${tableName}`);
                    }
                }
            } catch (err) {
                console.log(`   ⚠️  Could not check duplicates for ${tableName}: ${err.message}`);
            }
        }
        console.log('');

        // 4. Extract all constraints
        console.log('📐 Extracting constraints...');
        const constraintsQuery = await pool.query(`
            SELECT
                tc.table_name,
                tc.constraint_name,
                tc.constraint_type,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            LEFT JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.table_schema = 'public'
            ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name
        `);

        // Group constraints by table
        constraintsQuery.rows.forEach(row => {
            if (!report.constraints[row.table_name]) {
                report.constraints[row.table_name] = [];
            }
            report.constraints[row.table_name].push({
                name: row.constraint_name,
                type: row.constraint_type,
                column: row.column_name,
                foreign_table: row.foreign_table_name,
                foreign_column: row.foreign_column_name
            });
        });

        console.log(`   Found constraints for ${Object.keys(report.constraints).length} tables\n`);

        // 5. Extract all rules (spotting codes)
        console.log('📜 Extracting rules (spotting codes)...');
        const rulesQuery = await pool.query(`
            SELECT 
                schemaname,
                tablename,
                rulename,
                definition
            FROM pg_rules
            WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY schemaname, tablename, rulename
        `);

        rulesQuery.rows.forEach(row => {
            const key = `${row.schemaname}.${row.tablename}`;
            if (!report.rules[key]) {
                report.rules[key] = [];
            }
            report.rules[key].push({
                name: row.rulename,
                definition: row.definition
            });
        });

        console.log(`   Found ${rulesQuery.rows.length} rules across ${Object.keys(report.rules).length} tables\n`);

        // 6. Check for merge potential
        console.log('🔗 Analyzing merge potential...');
        if (Object.keys(report.duplicates).length > 0) {
            for (const tableName in report.duplicates) {
                const dupInfo = report.duplicates[tableName];
                const tableInfo = report.tables.find(t => t.name === tableName);
                
                if (tableInfo && tableInfo.row_count > 0) {
                    const potentialSpace = dupInfo.duplicate_groups * (tableInfo.row_count / (dupInfo.duplicate_groups + 1));
                    report.recommendations.push({
                        table: tableName,
                        issue: 'Duplicate records found',
                        duplicate_groups: dupInfo.duplicate_groups,
                        potential_space_saved: potentialSpace,
                        action: 'Consider deduplication using latest record per group'
                    });
                }
            }
        }

        // Check for large tables that could be partitioned
        report.tables.forEach(table => {
            if (table.row_count > 100000) {
                report.recommendations.push({
                    table: table.name,
                    issue: 'Large table',
                    row_count: table.row_count,
                    size: table.total_size,
                    action: 'Consider partitioning or archiving old data'
                });
            }
        });

        console.log(`   Generated ${report.recommendations.length} recommendations\n`);

        // 7. Generate report
        console.log('📝 Generating diagnostic report...\n');
        
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('                    SUPABASE DIAGNOSTIC REPORT');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log(`Generated: ${report.timestamp}`);
        console.log(`Database: ${report.database_info.database_name}`);
        console.log(`PostgreSQL: ${report.database_info.postgresql_version}`);
        console.log('');

        console.log('─────────────────────────────────────────────────────────────');
        console.log('TABLE SUMMARY');
        console.log('─────────────────────────────────────────────────────────────');
        console.log('Schema'.padEnd(20) + 'Table'.padEnd(35) + 'Rows'.padEnd(12) + 'Size');
        console.log('─'.repeat(80));
        report.tables.forEach(table => {
            console.log(
                table.schema.padEnd(20) +
                table.name.padEnd(35) +
                table.row_count.toLocaleString().padEnd(12) +
                table.total_size
            );
        });
        console.log('');

        console.log('─────────────────────────────────────────────────────────────');
        console.log('DUPLICATE RECORDS ANALYSIS');
        console.log('─────────────────────────────────────────────────────────────');
        if (Object.keys(report.duplicates).length === 0) {
            console.log('✅ No duplicate records found in key tables');
        } else {
            for (const tableName in report.duplicates) {
                const dup = report.duplicates[tableName];
                console.log(`⚠️  ${tableName}:`);
                console.log(`   Duplicate groups: ${dup.duplicate_groups}`);
                console.log(`   Comparison columns: ${dup.comparison_columns.join(', ')}`);
            }
        }
        console.log('');

        console.log('─────────────────────────────────────────────────────────────');
        console.log('CONSTRAINTS SUMMARY');
        console.log('─────────────────────────────────────────────────────────────');
        for (const tableName in report.constraints) {
            console.log(`📐 ${tableName}:`);
            report.constraints[tableName].forEach(constraint => {
                console.log(`   ${constraint.type}: ${constraint.name} (${constraint.column})`);
                if (constraint.foreign_table) {
                    console.log(`      → ${constraint.foreign_table}.${constraint.foreign_column}`);
                }
            });
        }
        console.log('');

        console.log('─────────────────────────────────────────────────────────────');
        console.log('RULES (SPOTTING CODES) SUMMARY');
        console.log('─────────────────────────────────────────────────────────────');
        if (Object.keys(report.rules).length === 0) {
            console.log('ℹ️  No rules found in the database');
        } else {
            let totalRules = 0;
            for (const tableKey in report.rules) {
                console.log(`📜 ${tableKey}:`);
                report.rules[tableKey].forEach(rule => {
                    console.log(`   - ${rule.name}`);
                    console.log(`     ${rule.definition.substring(0, 100)}...`);
                    totalRules++;
                });
            }
            console.log(`\nTotal rules: ${totalRules}`);
        }
        console.log('');

        console.log('─────────────────────────────────────────────────────────────');
        console.log('RECOMMENDATIONS');
        console.log('─────────────────────────────────────────────────────────────');
        if (report.recommendations.length === 0) {
            console.log('✅ No recommendations - database looks healthy');
        } else {
            report.recommendations.forEach((rec, index) => {
                console.log(`${index + 1}. ${rec.table || 'General'}: ${rec.issue}`);
                if (rec.duplicate_groups !== undefined) {
                    console.log(`   Duplicate groups: ${rec.duplicate_groups}`);
                }
                if (rec.row_count !== undefined) {
                    console.log(`   Row count: ${rec.row_count.toLocaleString()}`);
                }
                if (rec.size) {
                    console.log(`   Size: ${rec.size}`);
                }
                console.log(`   Action: ${rec.action}`);
            });
        }
        console.log('');

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('                    END OF DIAGNOSTIC REPORT');
        console.log('═══════════════════════════════════════════════════════════════');

        // Save full report to JSON
        const fs = require('fs');
        const reportPath = './supabase-diagnostics-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Full report saved to: ${reportPath}`);

    } catch (err) {
        console.error('❌ Diagnostic failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        await pool.end();
        console.log('\n✅ Diagnostic complete');
    }
}

runDiagnostics();
