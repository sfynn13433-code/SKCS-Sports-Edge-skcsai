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

async function purgeFallbackData() {
    console.log('[Purge] Starting purge of stale fallback data...');

    try {
        // Delete records with 58% confidence (stale fallback)
        console.log('[Purge] Deleting records with confidence = 58...');
        const { error: error58 } = await supabase
            .from('direct1x2_prediction_final')
            .delete()
            .eq('total_confidence', 58);

        if (error58) {
            console.error('[Purge] Error deleting 58% confidence records:', error58);
        } else {
            console.log('[Purge] Successfully deleted 58% confidence records');
        }

        // Delete records containing "Ligue 1" (stale fallback text)
        console.log('[Purge] Deleting records containing "Ligue 1"...');
        const { error: errorLigue } = await supabase
            .from('direct1x2_prediction_final')
            .delete()
            .ilike('edgemind_report', '%Ligue 1%');

        if (errorLigue) {
            console.error('[Purge] Error deleting Ligue 1 records:', errorLigue);
        } else {
            console.log('[Purge] Successfully deleted Ligue 1 records');
        }

        // Alternative: Truncate entire table for clean slate (uncomment if needed)
        // console.log('[Purge] Truncating direct1x2_prediction_final table...');
        // const { error: errorTruncate } = await supabase
        //     .from('direct1x2_prediction_final')
        //     .delete()
        //     .neq('id', 0); // Delete all records

        console.log('[Purge] Purge completed successfully');
    } catch (err) {
        console.error('[Purge] Unexpected error:', err);
        process.exit(1);
    }
}

purgeFallbackData();
