'use strict';

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyNewPredictions() {
    console.log('[Verify] Checking new predictions in database...');

    try {
        // Check both direct1x2_prediction_final and predictions_raw tables
        const tables = ['direct1x2_prediction_final', 'predictions_raw'];

        for (const tableName of tables) {
            console.log(`\n[Verify] Checking table: ${tableName}`);

            const { data: predictions, error, count } = await supabase
                .from(tableName)
                .select('id, total_confidence, edgemind_report, created_at', { count: 'exact', head: false })
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error(`[Verify] Error fetching from ${tableName}:`, error.message);
                continue;
            }

            console.log(`[Verify] Total records in ${tableName}: ${count}`);
            console.log(`[Verify] Fetching recent 20 records...`);

            if (!predictions || predictions.length === 0) {
                console.log(`[Verify] No predictions found in ${tableName}`);
                continue;
            }

            console.log(`[Verify] Found ${predictions.length} recent predictions in ${tableName}`);

            // Check for varied confidence values
            const confidences = predictions.map(p => p.total_confidence || p.confidence);
            const uniqueConfidences = [...new Set(confidences)];
            console.log(`[Verify] Confidence values found: ${uniqueConfidences.join(', ')}`);

            // Check for unique edgemind_report text
            const reports = predictions.map(p => p.edgemind_report ? p.edgemind_report.substring(0, 100) : 'null');
            console.log(`[Verify] Sample edgemind_report texts:`);
            reports.slice(0, 5).forEach((report, i) => {
                console.log(`  ${i + 1}. ${report}...`);
            });

            // Check if any still have 58% confidence or "Ligue 1" text
            const stale58 = predictions.filter(p => (p.total_confidence || p.confidence) === 58);
            const staleLigue = predictions.filter(p => p.edgemind_report && p.edgemind_report.includes('Ligue 1'));

            if (stale58.length > 0) {
                console.warn(`[Verify] WARNING: Found ${stale58.length} predictions with 58% confidence (stale fallback)`);
            } else {
                console.log('[Verify] No predictions with 58% confidence (good - purge successful)');
            }

            if (staleLigue.length > 0) {
                console.warn(`[Verify] WARNING: Found ${staleLigue.length} predictions with "Ligue 1" text (stale fallback)`);
            } else {
                console.log('[Verify] No predictions with "Ligue 1" text (good - purge successful)');
            }

            // Verify confidence is now 85% (our new fallback) or varied (actual AI)
            if (uniqueConfidences.length > 1) {
                console.log('[Verify] SUCCESS: Varied confidence values indicate AI is generating unique insights');
            } else if (uniqueConfidences[0] === 85) {
                console.log('[Verify] INFO: All predictions at 85% - may still be using fallback template (but at correct threshold)');
            } else {
                console.log('[Verify] INFO: Single confidence value:', uniqueConfidences[0]);
            }
        }

    } catch (err) {
        console.error('[Verify] Unexpected error:', err);
        process.exit(1);
    }
}

verifyNewPredictions();
