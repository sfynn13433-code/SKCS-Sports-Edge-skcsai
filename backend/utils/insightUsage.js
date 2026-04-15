'use strict';

const { query } = require('../db');

async function isFixtureAvailableForFormat(fixtureId, format) {
    if (!fixtureId) return true;
    
    try {
        const weekStart = new Date();
        weekStart.setHours(0, 0, 0, 0);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        
        const columnMap = {
            'direct': 'used_in_direct',
            'analytical': 'used_in_analytical',
            'multi': 'used_in_multi',
            'same_match': 'used_in_same_match',
            'acca': 'used_in_acca'
        };
        
        const column = columnMap[format];
        if (!column) return true;
        
        const result = await query(`
            SELECT ${column} 
            FROM insight_usage 
            WHERE fixture_id = $1 AND week_start = $2
        `, [fixtureId, weekStart.toISOString().split('T')[0]]);
        
        if (result.rows.length === 0) return true;
        
        return !result.rows[0][column];
    } catch (err) {
        console.warn('[InsightUsage] Check availability error:', err.message);
        return true;
    }
}

async function markFixtureUsed(fixtureId, format) {
    if (!fixtureId || !format) return;
    
    try {
        const weekStart = new Date();
        weekStart.setHours(0, 0, 0, 0);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        
        const columnMap = {
            'direct': 'used_in_direct',
            'analytical': 'used_in_analytical',
            'multi': 'used_in_multi',
            'same_match': 'used_in_same_match',
            'acca': 'used_in_acca'
        };
        
        const column = columnMap[format];
        if (!column) return;
        
        await query(`
            INSERT INTO insight_usage (fixture_id, week_start, ${column}, created_at, updated_at)
            VALUES ($1, $2, true, NOW(), NOW())
            ON CONFLICT (fixture_id) DO UPDATE
            SET ${column} = true, updated_at = NOW()
        `, [fixtureId, weekStart.toISOString().split('T')[0]]);
        
        console.log(`[InsightUsage] Marked fixture ${fixtureId} as used in ${format}`);
    } catch (err) {
        console.warn('[InsightUsage] Mark used error:', err.message);
    }
}

async function filterPredictionsByUsagePolicy(predictions, format) {
    const available = [];
    const filtered = [];
    
    for (const pred of predictions) {
        const fixtureId = pred.fixture_id || pred.fixture?.id || pred.match?.id || null;
        
        if (!fixtureId) {
            available.push(pred);
            continue;
        }
        
        const isAvailable = await isFixtureAvailableForFormat(fixtureId, format);
        
        if (isAvailable) {
            available.push(pred);
        } else {
            filtered.push(pred);
            console.log(`[InsightUsage] Filtered fixture ${fixtureId} - already used in ${format}`);
        }
    }
    
    return { available, filtered };
}

async function getUsageSummary() {
    try {
        const weekStart = new Date();
        weekStart.setHours(0, 0, 0, 0);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        
        const result = await query(`
            SELECT 
                COUNT(*) FILTER (WHERE used_in_direct = true) as direct_count,
                COUNT(*) FILTER (WHERE used_in_analytical = true) as analytical_count,
                COUNT(*) FILTER (WHERE used_in_multi = true) as multi_count,
                COUNT(*) FILTER (WHERE used_in_same_match = true) as same_match_count,
                COUNT(*) FILTER (WHERE used_in_acca = true) as acca_count,
                COUNT(*) as total_count
            FROM insight_usage
            WHERE week_start = $1
        `, [weekStart.toISOString().split('T')[0]]);
        
        return result.rows[0] || {};
    } catch (err) {
        console.error('[InsightUsage] Get summary error:', err.message);
        return {};
    }
}

module.exports = {
    isFixtureAvailableForFormat,
    markFixtureUsed,
    filterPredictionsByUsagePolicy,
    getUsageSummary
};
