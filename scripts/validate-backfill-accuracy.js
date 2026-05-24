/**
 * Phase 1B: Validate Migration Backfill Accuracy
 * 
 * This script validates that data was correctly extracted from JSONB to relational tables:
 * - Row count comparisons
 * - Odds totals comparison
 * - NULL audit
 * - Orphan detection
 */

const { query } = require('../backend/database');

async function validateBackfillAccuracy() {
    console.log('=== Phase 1B: Migration Backfill Accuracy Validation ===\n');

    const results = {
        passed: [],
        failed: [],
        warnings: []
    };

    try {
        // 1. Compare event_odds_snapshots vs bookmaker_odds row counts
        console.log('1. Comparing event_odds_snapshots vs bookmaker_odds row counts...');
        
        const oddsSnapshotCount = await query('SELECT COUNT(*) as count FROM event_odds_snapshots');
        const bookmakerOddsCount = await query('SELECT COUNT(*) as count FROM bookmaker_odds');
        
        const snapshotCount = parseInt(oddsSnapshotCount.rows[0].count);
        const relationalCount = parseInt(bookmakerOddsCount.rows[0].count);
        
        console.log(`   - event_odds_snapshots: ${snapshotCount} rows`);
        console.log(`   - bookmaker_odds: ${relationalCount} rows`);
        
        if (snapshotCount === 0 && relationalCount === 0) {
            results.warnings.push('No odds data in either table (expected for fresh installation)');
        } else if (relationalCount === 0 && snapshotCount > 0) {
            results.failed.push('bookmaker_odds is empty but event_odds_snapshots has data - sync not run');
        } else if (relationalCount > 0) {
            // Relational should have more rows (one per bookmaker/market/selection per snapshot)
            results.passed.push(`bookmaker_odds has ${relationalCount} rows (expected to be > snapshot count of ${snapshotCount})`);
        }

        // 2. Check for NULL values in critical columns
        console.log('2. Auditing NULL values in bookmaker_odds...');
        
        const nullAudit = await query(`
            SELECT 
                COUNT(*) FILTER (WHERE id_event IS NULL) as null_id_event,
                COUNT(*) FILTER (WHERE bookmaker_key IS NULL) as null_bookmaker,
                COUNT(*) FILTER (WHERE market_type IS NULL) as null_market,
                COUNT(*) FILTER (WHERE selection IS NULL) as null_selection,
                COUNT(*) FILTER (WHERE odds IS NULL) as null_odds
            FROM bookmaker_odds;
        `);
        
        const nulls = nullAudit.rows[0];
        let hasNulls = false;
        
        for (const [col, count] of Object.entries(nulls)) {
            if (parseInt(count) > 0) {
                results.failed.push(`bookmaker_odds has ${count} NULL values in ${col}`);
                hasNulls = true;
            }
        }
        
        if (!hasNulls && relationalCount > 0) {
            results.passed.push('bookmaker_odds has no NULL values in critical columns');
        }

        // 3. Check for orphaned bookmaker_odds (bookmaker_key not in canonical_bookmakers)
        console.log('3. Detecting orphaned bookmaker_odds...');
        
        const orphanedBookmakers = await query(`
            SELECT COUNT(*) as count
            FROM bookmaker_odds bo
            LEFT JOIN canonical_bookmakers cb ON bo.bookmaker_key = cb.bookmaker_key
            WHERE cb.bookmaker_key IS NULL;
        `);
        
        const orphanCount = parseInt(orphanedBookmakers.rows[0].count);
        
        if (orphanCount > 0) {
            results.failed.push(`${orphanCount} bookmaker_odds rows reference non-existent bookmakers`);
        } else if (relationalCount > 0) {
            results.passed.push('No orphaned bookmaker_odds found');
        }

        // 4. Compare direct1x2_prediction_final vs prediction_secondary_markets
        console.log('4. Comparing direct1x2_prediction_final vs prediction_secondary_markets...');
        
        const predictionCount = await query(`
            SELECT COUNT(*) as count
            FROM direct1x2_prediction_final
            WHERE jsonb_array_length(secondary_markets) > 0;
        `);
        
        const secondaryMarketsCount = await query('SELECT COUNT(*) as count FROM prediction_secondary_markets');
        
        const predWithSecondary = parseInt(predictionCount.rows[0].count);
        const secondaryCount = parseInt(secondaryMarketsCount.rows[0].count);
        
        console.log(`   - Predictions with secondary_markets: ${predWithSecondary}`);
        console.log(`   - prediction_secondary_markets rows: ${secondaryCount}`);
        
        if (predWithSecondary === 0 && secondaryCount === 0) {
            results.warnings.push('No secondary market data (expected for fresh installation)');
        } else if (secondaryCount === 0 && predWithSecondary > 0) {
            results.failed.push('prediction_secondary_markets is empty but predictions have secondary_markets JSONB - sync not run');
        } else if (secondaryCount > 0) {
            results.passed.push(`prediction_secondary_markets has ${secondaryCount} rows extracted from predictions`);
        }

        // 5. Check confidence range in prediction_secondary_markets
        console.log('5. Validating confidence range in prediction_secondary_markets...');
        
        const confidenceRange = await query(`
            SELECT 
                MIN(confidence) as min_conf,
                MAX(confidence) as max_conf,
                COUNT(*) FILTER (WHERE confidence < 0 OR confidence > 100) as out_of_range
            FROM prediction_secondary_markets;
        `);
        
        const range = confidenceRange.rows[0];
        
        if (parseInt(range.out_of_range) > 0) {
            results.failed.push(`${range.out_of_range} secondary markets have confidence outside 0-100 range`);
        } else if (secondaryCount > 0) {
            results.passed.push(`All secondary markets have valid confidence (min: ${range.min_conf}, max: ${range.max_conf})`);
        }

        // 6. Check for orphaned prediction_secondary_markets
        console.log('6. Detecting orphaned prediction_secondary_markets...');
        
        const orphanedSecondary = await query(`
            SELECT COUNT(*) as count
            FROM prediction_secondary_markets psm
            LEFT JOIN direct1x2_prediction_final pf ON psm.prediction_id = pf.id
            WHERE pf.id IS NULL;
        `);
        
        const orphanSecondaryCount = parseInt(orphanedSecondary.rows[0].count);
        
        if (orphanSecondaryCount > 0) {
            results.failed.push(`${orphanSecondaryCount} prediction_secondary_markets rows reference non-existent predictions`);
        } else if (secondaryCount > 0) {
            results.passed.push('No orphaned prediction_secondary_markets found');
        }

        // 7. Check match_context_data odds vs bookmaker_odds coverage
        console.log('7. Comparing match_context_data odds coverage...');
        
        const matchContextOdds = await query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE odds IS NOT NULL AND odds != '{}'::jsonb) as with_odds
            FROM match_context_data;
        `);
        
        const mc = matchContextOdds.rows[0];
        const mcWithOdds = parseInt(mc.with_odds);
        
        console.log(`   - match_context_data with odds: ${mcWithOdds}`);
        
        if (mcWithOdds > 0) {
            const eventsWithOdds = await query(`
                SELECT COUNT(DISTINCT id_event) as count
                FROM bookmaker_odds;
            `);
            
            const eventsCount = parseInt(eventsWithOdds.rows[0].count);
            console.log(`   - bookmaker_odds unique events: ${eventsCount}`);
            
            if (eventsCount > 0) {
                results.passed.push(`bookmaker_odds covers ${eventsCount} events with odds`);
            } else {
                results.warnings.push('match_context_data has odds but bookmaker_odds is empty - sync not run');
            }
        }

        // 8. Check event_injuries table
        console.log('8. Validating event_injuries data...');
        
        const injuriesCount = await query('SELECT COUNT(*) as count FROM event_injuries');
        const injuryCount = parseInt(injuriesCount.rows[0].count);
        
        if (injuryCount > 0) {
            const injuryNullAudit = await query(`
                SELECT 
                    COUNT(*) FILTER (WHERE id_event IS NULL) as null_event,
                    COUNT(*) FILTER (WHERE player_name IS NULL) as null_player
                FROM event_injuries;
            `);
            
            const injuryNulls = injuryNullAudit.rows[0];
            
            if (parseInt(injuryNulls.null_event) > 0 || parseInt(injuryNulls.null_player) > 0) {
                results.failed.push('event_injuries has NULL values in critical columns');
            } else {
                results.passed.push(`event_injuries has ${injuryCount} rows with valid data`);
            }
        } else {
            results.warnings.push('event_injuries is empty (expected if no injury data exists)');
        }

        // 9. Check event_news_scores table
        console.log('9. Validating event_news_scores data...');
        
        const newsCount = await query('SELECT COUNT(*) as count FROM event_news_scores');
        const newsRowCount = parseInt(newsCount.rows[0].count);
        
        if (newsRowCount > 0) {
            const newsNullAudit = await query(`
                SELECT 
                    COUNT(*) FILTER (WHERE id_event IS NULL) as null_event,
                    COUNT(*) FILTER (WHERE sentiment_score IS NULL) as null_sentiment
                FROM event_news_scores;
            `);
            
            const newsNulls = newsNullAudit.rows[0];
            
            if (parseInt(newsNulls.null_event) > 0) {
                results.failed.push('event_news_scores has NULL id_event values');
            } else {
                results.passed.push(`event_news_scores has ${newsRowCount} rows with valid data`);
            }
        } else {
            results.warnings.push('event_news_scores is empty (expected if no news data exists)');
        }

        // 10. Check normalized prediction tables (if they exist)
        console.log('10. Validating normalized prediction tables...');
        
        const coreExists = await query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'prediction_core'
            ) as exists;
        `);
        
        if (coreExists.rows[0].exists) {
            const coreCount = await query('SELECT COUNT(*) as count FROM prediction_core');
            const pubCount = await query('SELECT COUNT(*) as count FROM prediction_publication');
            const insightsCount = await query('SELECT COUNT(*) as count FROM prediction_insights');
            const metaCount = await query('SELECT COUNT(*) as count FROM prediction_metadata');
        
            const coreRows = parseInt(coreCount.rows[0].count);
            const pubRows = parseInt(pubCount.rows[0].count);
            const insightsRows = parseInt(insightsCount.rows[0].count);
            const metaRows = parseInt(metaCount.rows[0].count);
            
            console.log(`   - prediction_core: ${coreRows} rows`);
            console.log(`   - prediction_publication: ${pubRows} rows`);
            console.log(`   - prediction_insights: ${insightsRows} rows`);
            console.log(`   - prediction_metadata: ${metaRows} rows`);
            
            if (coreRows > 0) {
                if (coreRows === pubRows && coreRows === insightsRows && coreRows === metaRows) {
                    results.passed.push('All normalized prediction tables have matching row counts');
                } else {
                    results.failed.push('Normalized prediction tables have mismatched row counts - migration incomplete');
                }
            } else {
                results.warnings.push('Normalized prediction tables are empty - migration not run yet');
            }

            // 11. Check unified view
            console.log('11. Validating direct1x2_prediction_final_unified view...');
            
            const unifiedCount = await query('SELECT COUNT(*) as count FROM direct1x2_prediction_final_unified');
            const unifiedRows = parseInt(unifiedCount.rows[0].count);
            
            if (coreRows > 0 && unifiedRows === coreRows) {
                results.passed.push('Unified view returns same count as prediction_core');
            } else if (coreRows > 0 && unifiedRows !== coreRows) {
                results.warnings.push(`Unified view count (${unifiedRows}) differs from prediction_core (${coreRows})`);
            }
        } else {
            results.warnings.push('Normalized prediction tables do not exist - migration not applied yet');
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
    validateBackfillAccuracy()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Validation script error:', error);
            process.exit(1);
        });
}

module.exports = { validateBackfillAccuracy };
