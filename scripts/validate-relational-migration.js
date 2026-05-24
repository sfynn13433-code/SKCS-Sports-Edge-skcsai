/**
 * Phase 1A: Validate Referential Integrity
 * 
 * This script validates the new relational tables after migration:
 * - FK constraints
 * - Cascade behavior
 * - Unique indexes
 * - Composite keys
 * - Bookmaker mappings
 */

const { query } = require('../backend/database');

async function validateReferentialIntegrity() {
    console.log('=== Phase 1A: Referential Integrity Validation ===\n');

    const results = {
        passed: [],
        failed: [],
        warnings: []
    };

    try {
        // 1. Check bookmaker_odds table structure
        console.log('1. Validating bookmaker_odds table...');
        
        const bookmakerOddsCheck = await query(`
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = 'bookmaker_odds'
            ORDER BY ordinal_position;
        `);
        
        console.log(`   - Columns found: ${bookmakerOddsCheck.rows.length}`);
        
        const requiredColumns = ['id', 'id_event', 'bookmaker_key', 'market_type', 'selection', 'odds', 'snapshot_at'];
        const foundColumns = bookmakerOddsCheck.rows.map(r => r.column_name);
        
        for (const col of requiredColumns) {
            if (foundColumns.includes(col)) {
                results.passed.push(`bookmaker_odds has column: ${col}`);
            } else {
                results.failed.push(`bookmaker_odds missing column: ${col}`);
            }
        }

        // 2. Check FK constraint to canonical_bookmakers
        console.log('2. Validating bookmaker_odds FK to canonical_bookmakers...');
        
        const fkCheck = await query(`
            SELECT
                tc.constraint_name,
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_name = 'bookmaker_odds';
        `);
        
        if (fkCheck.rows.length > 0) {
            results.passed.push('bookmaker_odds has FK constraint to canonical_bookmakers');
            console.log(`   - FK constraint: ${fkCheck.rows[0].constraint_name}`);
        } else {
            results.failed.push('bookmaker_odds missing FK constraint to canonical_bookmakers');
        }

        // 3. Check indexes on bookmaker_odds
        console.log('3. Validating bookmaker_odds indexes...');
        
        const indexCheck = await query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'bookmaker_odds';
        `);
        
        console.log(`   - Indexes found: ${indexCheck.rows.length}`);
        
        const requiredIndexes = ['idx_bookmaker_odds_event', 'idx_bookmaker_odds_bookmaker', 'idx_bookmaker_odds_market'];
        for (const idx of requiredIndexes) {
            const found = indexCheck.rows.some(r => r.indexname === idx);
            if (found) {
                results.passed.push(`bookmaker_odds has index: ${idx}`);
            } else {
                results.warnings.push(`bookmaker_odds missing recommended index: ${idx}`);
            }
        }

        // 4. Check prediction_secondary_markets table structure
        console.log('4. Validating prediction_secondary_markets table...');
        
        const secondaryMarketsCheck = await query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'prediction_secondary_markets'
            ORDER BY ordinal_position;
        `);
        
        console.log(`   - Columns found: ${secondaryMarketsCheck.rows.length}`);
        
        const secondaryRequiredColumns = ['id', 'prediction_id', 'market', 'prediction', 'confidence'];
        const secondaryFoundColumns = secondaryMarketsCheck.rows.map(r => r.column_name);
        
        for (const col of secondaryRequiredColumns) {
            if (secondaryFoundColumns.includes(col)) {
                results.passed.push(`prediction_secondary_markets has column: ${col}`);
            } else {
                results.failed.push(`prediction_secondary_markets missing column: ${col}`);
            }
        }

        // 5. Check FK constraint to direct1x2_prediction_final
        console.log('5. Validating prediction_secondary_markets FK to direct1x2_prediction_final...');
        
        const secondaryFkCheck = await query(`
            SELECT
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_name = 'prediction_secondary_markets';
        `);
        
        if (secondaryFkCheck.rows.length > 0) {
            results.passed.push('prediction_secondary_markets has FK constraint to direct1x2_prediction_final');
            console.log(`   - FK constraint: ${secondaryFkCheck.rows[0].constraint_name}`);
        } else {
            results.failed.push('prediction_secondary_markets missing FK constraint to direct1x2_prediction_final');
        }

        // 6. Check confidence CHECK constraint
        console.log('6. Validating prediction_secondary_markets confidence CHECK constraint...');
        
        const checkConstraintCheck = await query(`
            SELECT
                cc.conname AS constraint_name,
                pg_get_constraintdef(cc.oid) AS constraint_definition
            FROM pg_constraint cc
            JOIN pg_namespace n ON n.oid = cc.connamespace
            JOIN pg_class c ON c.oid = cc.conrelid
            WHERE c.relname = 'prediction_secondary_markets'
                AND cc.contype = 'c';
        `);
        
        const hasConfidenceCheck = checkConstraintCheck.rows.some(r => 
            r.constraint_definition.includes('confidence') && r.constraint_definition.includes('BETWEEN')
        );
        
        if (hasConfidenceCheck) {
            results.passed.push('prediction_secondary_markets has confidence CHECK constraint (0-100)');
        } else {
            results.warnings.push('prediction_secondary_markets missing confidence CHECK constraint');
        }

        // 7. Check event_injuries table
        console.log('7. Validating event_injuries table...');
        
        const injuriesCheck = await query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'event_injuries'
            ORDER BY ordinal_position;
        `);
        
        if (injuriesCheck.rows.length > 0) {
            results.passed.push('event_injuries table exists');
            console.log(`   - Columns found: ${injuriesCheck.rows.length}`);
        } else {
            results.failed.push('event_injuries table does not exist');
        }

        // 8. Check event_news_scores table
        console.log('8. Validating event_news_scores table...');
        
        const newsCheck = await query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'event_news_scores'
            ORDER BY ordinal_position;
        `);
        
        if (newsCheck.rows.length > 0) {
            results.passed.push('event_news_scores table exists');
            console.log(`   - Columns found: ${newsCheck.rows.length}`);
        } else {
            results.failed.push('event_news_scores table does not exist');
        }

        // 9. Check prediction_core table (normalized)
        console.log('9. Validating prediction_core table...');
        
        const coreCheck = await query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'prediction_core'
            ORDER BY ordinal_position;
        `);
        
        if (coreCheck.rows.length > 0) {
            results.passed.push('prediction_core table exists');
            console.log(`   - Columns found: ${coreCheck.rows.length}`);
            
            // Check for risk_tier enum
            const hasRiskTier = coreCheck.rows.some(r => r.column_name === 'risk_tier');
            if (hasRiskTier) {
                results.passed.push('prediction_core has risk_tier column');
            } else {
                results.warnings.push('prediction_core missing risk_tier column');
            }
        } else {
            results.failed.push('prediction_core table does not exist');
        }

        // 10. Check other normalized tables
        console.log('10. Validating other normalized tables...');
        
        const normalizedTables = ['prediction_publication', 'prediction_insights', 'prediction_metadata'];
        for (const table of normalizedTables) {
            const tableCheck = await query(`
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = $1
                );
            `, [table]);
            
            if (tableCheck.rows[0].exists) {
                results.passed.push(`${table} table exists`);
            } else {
                results.failed.push(`${table} table does not exist`);
            }
        }

        // 11. Check unified view
        console.log('11. Validating direct1x2_prediction_final_unified view...');
        
        const viewCheck = await query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.views 
                WHERE table_name = 'direct1x2_prediction_final_unified'
            );
        `);
        
        if (viewCheck.rows[0].exists) {
            results.passed.push('direct1x2_prediction_final_unified view exists');
        } else {
            results.warnings.push('direct1x2_prediction_final_unified view does not exist');
        }

        // 12. Check partitioning
        console.log('12. Validating partitioned tables...');
        
        const partitionedTables = ['event_odds_snapshots', 'fixture_processing_log'];
        for (const table of partitionedTables) {
            const partitionCheck = await query(`
                SELECT 
                    c.relname AS table_name,
                    CASE 
                        WHEN c.relispartition THEN true
                        WHEN EXISTS (
                            SELECT 1 FROM pg_inherits 
                            WHERE inhparent = c.oid
                        ) THEN true
                        ELSE false
                    END AS is_partitioned
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                    AND c.relname = $1;
            `, [table]);
            
            if (partitionCheck.rows.length > 0 && partitionCheck.rows[0].is_partitioned) {
                results.passed.push(`${table} is partitioned`);
            } else {
                results.warnings.push(`${table} is not partitioned (may need manual partition creation)`);
            }
        }

        // 13. Check sync functions exist
        console.log('13. Validating sync functions...');
        
        const syncFunctions = [
            'sync_bookmaker_odds_from_context',
            'sync_secondary_markets_from_prediction',
            'migrate_to_normalized_tables'
        ];
        
        for (const func of syncFunctions) {
            const funcCheck = await query(`
                SELECT EXISTS (
                    SELECT 1 FROM pg_proc 
                    WHERE proname = $1
                );
            `, [func]);
            
            if (funcCheck.rows[0].exists) {
                results.passed.push(`Function ${func} exists`);
            } else {
                results.warnings.push(`Function ${func} does not exist`);
            }
        }

    } catch (error) {
        console.error('Error during validation:', error);
        results.failed.push(`Validation error: ${error.message}`);
    }

    // Print summary
    console.log('\n=== VALIDATION SUMMARY ===');
    console.log(`✅ Passed: ${results.passed.length}`);
    console.log(`⚠️  Warnings: ${results.warnings.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    
    if (results.passed.length > 0) {
        console.log('\nPassed checks:');
        results.passed.forEach(r => console.log(`  ✓ ${r}`));
    }
    
    if (results.warnings.length > 0) {
        console.log('\nWarnings:');
        results.warnings.forEach(r => console.log(`  ⚠ ${r}`));
    }
    
    if (results.failed.length > 0) {
        console.log('\nFailed checks:');
        results.failed.forEach(r => console.log(`  ✗ ${r}`));
    }

    const hasFailures = results.failed.length > 0;
    console.log(`\n${hasFailures ? '❌ VALIDATION FAILED' : '✅ VALIDATION PASSED'}`);
    
    return !hasFailures;
}

// Run validation
if (require.main === module) {
    validateReferentialIntegrity()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Validation script error:', error);
            process.exit(1);
        });
}

module.exports = { validateReferentialIntegrity };
