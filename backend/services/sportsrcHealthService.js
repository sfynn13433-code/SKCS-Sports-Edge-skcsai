'use strict';

const axios = require('axios');
const config = require('../config');
const { query } = require('../database');

const SPORTSRC_BASE_URL = 'https://api.sportsrc.org/v2/';
const WARNING_THRESHOLD_PERCENT = 20;

let _supportedSportsCache = null;

async function checkAccountHealth() {
    try {
        const apiKey = config.sportSrcApiKey;
        if (!apiKey) {
            console.warn('[SportSRC Health] SPORTSRC_API_KEY is not configured');
            return null;
        }

        const response = await axios.get(SPORTSRC_BASE_URL, {
            params: { type: 'account' },
            headers: { 'X-API-KEY': apiKey },
            timeout: 10000
        });

        // The exact schema of ?type=account response from SportSRC might vary, but we expect standard quota fields.
        const data = response.data?.data || response.data || {};
        
        const plan = data.plan || 'UNKNOWN';
        const dailyLimit = Number(data.daily_limit || data.limit) || 0;
        const remaining = Number(data.remaining_requests || data.remaining) || 0;
        
        let resetTime = null;
        try {
            if (data.reset_time || data.reset) {
                const rt = data.reset_time || data.reset;
                // Check if it's a unix timestamp in seconds (numbers or numeric strings)
                if (!isNaN(rt) && Number(rt) > 0) {
                    // if it's a small number, it's likely seconds. If it's a large number it's ms.
                    const ms = Number(rt) > 9999999999 ? Number(rt) : Number(rt) * 1000;
                    resetTime = new Date(ms).toISOString();
                } else {
                    resetTime = new Date(rt).toISOString();
                }
            } else if (data.reset_countdown) {
                resetTime = new Date(Date.now() + Number(data.reset_countdown) * 1000).toISOString();
            }
        } catch (dateErr) {
            console.warn('[SportSRC Health] Failed to parse reset time:', dateErr.message);
            resetTime = null; // fallback to null instead of crashing
        }

        let status = 'HEALTHY';
        if (dailyLimit > 0) {
            const percentRemaining = (remaining / dailyLimit) * 100;
            if (percentRemaining < WARNING_THRESHOLD_PERCENT) {
                status = 'WARNING';
            }
            if (remaining <= 0) {
                status = 'EXHAUSTED';
            }
        }

        const insertQuery = `
            INSERT INTO sportsrc_account_health (plan, daily_limit, remaining, reset_time, status, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        
        const res = await query(insertQuery, [
            plan,
            dailyLimit,
            remaining,
            resetTime,
            status,
            JSON.stringify(data)
        ]);

        console.log(`[SportSRC Health] Checked account. Plan=${plan}, Remaining=${remaining}/${dailyLimit}. Status=${status}`);
        return res.rows[0];

    } catch (error) {
        console.error('[SportSRC Health] Error checking account health:', error.message);
        
        // Log the failure to telemetry as well to maintain observability
        await query(`
            INSERT INTO sportsrc_account_health (status, metadata)
            VALUES ($1, $2)
        `, ['ERROR', JSON.stringify({ error: error.message })]);

        return null;
    }
}

async function discoverCapabilities() {
    try {
        const apiKey = config.sportSrcApiKey;
        if (!apiKey) {
            console.warn('[SportSRC Health] SPORTSRC_API_KEY is not configured');
            return [];
        }

        const response = await axios.get(SPORTSRC_BASE_URL, {
            params: { type: 'sports' },
            headers: { 'X-API-KEY': apiKey },
            timeout: 10000
        });

        // Parse supported sports from response
        const data = response.data?.data || response.data || [];
        const sportsList = Array.isArray(data) ? data : (data.sports || []);
        
        const normalizedSports = sportsList
            .map(s => typeof s === 'string' ? s : s.name || s.id)
            .filter(Boolean)
            .map(s => s.toLowerCase());

        _supportedSportsCache = normalizedSports;

        console.log(`[SportSRC Health] Discovered ${normalizedSports.length} supported sports.`);
        return normalizedSports;

    } catch (error) {
        console.error('[SportSRC Health] Error discovering capabilities:', error.message);
        return _supportedSportsCache || [];
    }
}

function getSupportedSportsCache() {
    return _supportedSportsCache || [];
}

module.exports = {
    checkAccountHealth,
    discoverCapabilities,
    getSupportedSportsCache
};
