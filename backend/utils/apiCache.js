'use strict';

const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Cache TTL in minutes per provider type
const CACHE_TTL = {
    odds: 15,       // Odds change frequently - 15 min
    fixtures: 30,   // Fixtures less frequent - 30 min  
    news: 60,      // News less time-sensitive - 60 min
    injuries: 30,  // Injuries - 30 min
    default: 30
};

// Generate cache key from endpoint and params
function generateCacheKey(endpoint, params = {}) {
    const paramsStr = Object.keys(params).sort()
        .map(k => `${k}=${params[k]}`)
        .join('&');
    return `${endpoint}?${paramsStr}`.replace(/^\?$/, 'root');
}

// Determine TTL based on endpoint
function getTTLForEndpoint(endpoint) {
    if (endpoint.includes('odds')) return CACHE_TTL.odds;
    if (endpoint.includes('fixtures')) return CACHE_TTL.fixtures;
    if (endpoint.includes('news')) return CACHE_TTL.news;
    if (endpoint.includes('injury')) return CACHE_TTL.injuries;
    return CACHE_TTL.default;
}

// Check cache first
async function checkCache(cacheKey, providerName) {
    try {
        const ttlMinutes = getTTLForEndpoint(cacheKey);
        
        const result = await pool.query(`
            SELECT payload, updated_at 
            FROM rapidapi_cache 
            WHERE cache_key = $1 AND provider_name = $2
        `, [cacheKey, providerName]);
        
        if (result.rows.length > 0) {
            const row = result.rows[0];
            const updatedAt = new Date(row.updated_at);
            const now = new Date();
            const minutesOld = (now - updatedAt) / 1000 / 60;
            
            if (minutesOld < ttlMinutes) {
                console.log(`[CACHE HIT] Returning saved data for: ${cacheKey}`);
                return row.payload;
            } else {
                console.log(`[CACHE EXPIRED] ${cacheKey} was ${minutesOld.toFixed(1)} min old (TTL: ${ttlMinutes})`);
            }
        }
        
        console.log(`[CACHE MISS] Fetching from API and saving to cache for: ${cacheKey}`);
        return null;
        
    } catch (err) {
        console.warn(`[CACHE ERROR] ${err.message}`);
        return null;
    }
}

// Save to cache
async function saveToCache(cacheKey, providerName, payload) {
    try {
        await pool.query(`
            INSERT INTO rapidapi_cache (cache_key, provider_name, payload, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (cache_key) DO UPDATE SET
                payload = EXCLUDED.payload,
                updated_at = NOW()
        `, [cacheKey, providerName, JSON.stringify(payload)]);
        
        console.log(`[CACHE SAVED] ${cacheKey}`);
        
    } catch (err) {
        console.warn(`[CACHE SAVE ERROR] ${err.message}`);
    }
}

// Cached axios wrapper
async function cachedAxios(config, providerName) {
    const cacheKey = generateCacheKey(config.url || config.baseURL, config.params || {});
    const fullCacheKey = `${providerName}:${cacheKey}`;
    
    // Check cache first
    const cachedData = await checkCache(fullCacheKey, providerName);
    if (cachedData) {
        return { data: cachedData, fromCache: true };
    }
    
    // Fetch from API
    try {
        const response = await axios(config);
        
        // Save to cache
        if (response.data) {
            await saveToCache(fullCacheKey, providerName, response.data);
        }
        
        return { data: response.data, fromCache: false };
        
    } catch (error) {
        throw error;
    }
}

// Export for use
module.exports = {
    generateCacheKey,
    checkCache,
    saveToCache,
    cachedAxios,
    CACHE_TTL
};