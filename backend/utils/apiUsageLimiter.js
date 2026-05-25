'use strict';

const { createClient } = require('@supabase/supabase-js');
const { DAILY_HARD_CAP } = require('../config/apiEndpoints');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '';

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
    })
    : null;

async function enforceRateLimitAndFetch(operationName, fetchFn) {
    if (typeof fetchFn !== 'function') {
        throw new Error('enforceRateLimitAndFetch requires a fetchFn callback');
    }

    if (!supabase) {
        console.warn('[apiUsageLimiter] Supabase not configured; skipping daily hard-cap enforcement.');
        return fetchFn();
    }

    const today = new Date().toISOString().split('T')[0];

    const { data: usageLog, error: usageError } = await supabase
        .from('api_usage_logs')
        .select('calls_made')
        .eq('date', today)
        .single();

    if (usageError && usageError.code !== 'PGRST116') {
        console.warn('[apiUsageLimiter] Failed to read usage logs:', usageError.message);
    }

    const callsMadeToday = usageLog ? usageLog.calls_made : 0;

    if (callsMadeToday >= DAILY_HARD_CAP) {
        console.warn(`🛑 SYSTEM HALT: API-Sports internal hard cap reached (${callsMadeToday}/${DAILY_HARD_CAP}). Aborting fetch to protect the buffer.`);
        return null;
    }

    console.log(`✅ Rate limit safe (${callsMadeToday}/${DAILY_HARD_CAP}) for ${operationName || 'api-sports-fetch'}. Fetching data...`);

    const result = await fetchFn();

    if (result !== null && result !== undefined) {
        const updatedCount = callsMadeToday + 1;
        const { error: upsertError } = await supabase
            .from('api_usage_logs')
            .upsert({ date: today, calls_made: updatedCount }, { onConflict: 'date' });

        if (upsertError) {
            console.warn('[apiUsageLimiter] Failed to update usage logs:', upsertError.message);
        } else {
            console.log(`[apiUsageLimiter] Recorded API call ${updatedCount}/${DAILY_HARD_CAP} for ${today}.`);
        }
    }

    return result;
}

module.exports = {
    enforceRateLimitAndFetch
};
