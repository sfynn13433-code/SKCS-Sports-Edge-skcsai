'use strict';

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || ''
).trim();

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : null;
const RAPIDAPI_BYPASS_CACHE_WALL = ['1', 'true', 'yes'].includes(
    String(process.env.RAPIDAPI_BYPASS_CACHE_WALL || '').trim().toLowerCase()
);

function normalizeForHash(value) {
    if (Array.isArray(value)) {
        return value.map(normalizeForHash);
    }

    if (value && typeof value === 'object' && value.constructor === Object) {
        return Object.keys(value)
            .sort()
            .reduce((acc, key) => {
                const normalized = normalizeForHash(value[key]);
                if (normalized !== undefined) {
                    acc[key] = normalized;
                }
                return acc;
            }, {});
    }

    return value;
}

function buildCacheKey(providerName, endpointUrl, params) {
    const paramString = JSON.stringify(normalizeForHash(params || {}));
    const hash = crypto
        .createHash('md5')
        .update(`${providerName}_${endpointUrl}_${paramString}`)
        .digest('hex');

    return `${providerName}_${hash}`;
}

function isNoRowsError(error) {
    if (!error) return false;
    const message = String(error.message || '').toLowerCase();
    return error.code === 'PGRST116' || message.includes('0 rows');
}

function isCacheWallReady() {
    return Boolean(supabase);
}

async function readCache(cacheKey) {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('rapidapi_cache')
        .select('payload, updated_at')
        .eq('cache_key', cacheKey)
        .maybeSingle();

    if (error && !isNoRowsError(error)) {
        console.warn('[Cache Wall] Cache read failed:', error.message);
        return null;
    }

    return data || null;
}

async function writeCache(cacheKey, providerName, payload) {
    if (!supabase) return;

    const { error } = await supabase
        .from('rapidapi_cache')
        .upsert({
            cache_key: cacheKey,
            provider_name: providerName,
            payload,
            updated_at: new Date().toISOString()
        }, { onConflict: 'cache_key' });

    if (error) {
        console.warn('[Cache Wall] Cache upsert failed:', error.message);
    }
}

/**
 * Universal fetcher with strict quota protection.
 * @param {string} providerName - e.g., 'sofascore', 'f1_motorsport', 'cricket_api'
 * @param {string} endpointUrl - Full RapidAPI URL
 * @param {object} headers - RapidAPI headers (Key and Host)
 * @param {object} params - Query parameters
 * @param {number} cacheDurationMinutes - How long before a fresh pull is allowed (minutes)
 * @returns {Promise<*>}
 */
async function fetchWithCache(
    providerName,
    endpointUrl,
    headers,
    params = {},
    cacheDurationMinutes = 1440
) {
    const safeProvider = String(providerName || '').trim();
    const safeEndpoint = String(endpointUrl || '').trim();

    if (!safeProvider) throw new Error('providerName is required');
    if (!safeEndpoint) throw new Error('endpointUrl is required');

    if (!supabase) {
        if (!RAPIDAPI_BYPASS_CACHE_WALL) {
            console.error(`[Cache Wall] Supabase is not configured. Blocking uncached RapidAPI request for ${safeProvider}.`);
            return null;
        }

        try {
            console.warn(`[Cache Wall] Bypass enabled. Making uncached RapidAPI request for ${safeProvider}.`);
            const response = await axios.get(safeEndpoint, {
                headers,
                params,
                timeout: 15000
            });
            return response.data;
        } catch (error) {
            console.error(`[Cache Wall] Bypass fetch failed for ${safeProvider}:`, error.message);
            return null;
        }
    }

    const cacheKey = buildCacheKey(safeProvider, safeEndpoint, params);

    try {
        const cachedData = await readCache(cacheKey);
        if (cachedData) {
            const cacheAgeMinutes = (Date.now() - new Date(cachedData.updated_at).getTime()) / (1000 * 60);
            if (cacheAgeMinutes < cacheDurationMinutes) {
                console.log(`[Cache Wall] quota saved via cache: ${safeProvider}`);
                return cachedData.payload;
            }
        }

        console.log(`[Cache Wall] cache miss/expired: ${safeProvider}. consuming 1 RapidAPI call.`);
        const response = await axios.get(safeEndpoint, {
            headers,
            params,
            timeout: 15000
        });
        const payload = response.data;

        await writeCache(cacheKey, safeProvider, payload);

        return payload;
    } catch (error) {
        console.error(`[Cache Wall] Fetch failed for ${safeProvider}:`, error.message);
        return null;
    }
}

module.exports = {
    fetchWithCache,
    isCacheWallReady
};
