'use strict';

const { query } = require('../db');

let tableReady = false;

async function ensureBlockedLogTable() {
    if (tableReady) return;
    await query(`
        CREATE TABLE IF NOT EXISTS blocked_api_calls_log (
            id BIGSERIAL PRIMARY KEY,
            sport TEXT NOT NULL,
            provider TEXT NOT NULL,
            reason TEXT NOT NULL,
            source TEXT,
            units INTEGER NOT NULL DEFAULT 1,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await query(`
        CREATE INDEX IF NOT EXISTS idx_blocked_api_calls_created
        ON blocked_api_calls_log(created_at DESC)
    `);
    await query(`
        CREATE INDEX IF NOT EXISTS idx_blocked_api_calls_sport_provider
        ON blocked_api_calls_log(sport, provider, created_at DESC)
    `);
    tableReady = true;
}

async function recordBlockedCall({
    sport,
    provider,
    reason,
    source = null,
    units = 1,
    metadata = {}
} = {}) {
    const payload = {
        sport: String(sport || 'unknown').slice(0, 64),
        provider: String(provider || 'unknown').slice(0, 128),
        reason: String(reason || 'blocked').slice(0, 128),
        source: source ? String(source).slice(0, 256) : null,
        units: Math.max(1, Number(units) || 1),
        metadata: metadata && typeof metadata === 'object' ? metadata : {}
    };

    try {
        await ensureBlockedLogTable();
        await query(
            `INSERT INTO blocked_api_calls_log (sport, provider, reason, source, units, metadata)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
            [
                payload.sport,
                payload.provider,
                payload.reason,
                payload.source,
                payload.units,
                JSON.stringify(payload.metadata)
            ]
        );
    } catch (err) {
        console.warn('[blockedApiCallsLog] persist failed:', err.message);
    }

    return payload;
}

async function getBlockedCallsSummary({ days = 7, sport = null, provider = null } = {}) {
    const windowDays = Math.max(1, Math.min(90, Number(days) || 7));
    try {
        await ensureBlockedLogTable();
        const params = [windowDays];
        let filterSql = '';
        if (sport) {
            params.push(String(sport).toLowerCase());
            filterSql += ` AND sport = $${params.length}`;
        }
        if (provider) {
            params.push(String(provider).toLowerCase());
            filterSql += ` AND provider = $${params.length}`;
        }

        const totalsRes = await query(
            `
            SELECT COUNT(*)::bigint AS blocked_total
            FROM blocked_api_calls_log
            WHERE created_at >= NOW() - ($1::int || ' days')::interval
            ${filterSql}
            `,
            params
        );

        const byReasonRes = await query(
            `
            SELECT reason, COUNT(*)::bigint AS count
            FROM blocked_api_calls_log
            WHERE created_at >= NOW() - ($1::int || ' days')::interval
            ${filterSql}
            GROUP BY reason
            ORDER BY count DESC
            LIMIT 20
            `,
            params
        );

        const bySportProviderRes = await query(
            `
            SELECT sport, provider, COUNT(*)::bigint AS count
            FROM blocked_api_calls_log
            WHERE created_at >= NOW() - ($1::int || ' days')::interval
            ${filterSql}
            GROUP BY sport, provider
            ORDER BY count DESC
            LIMIT 30
            `,
            params
        );

        const recentRes = await query(
            `
            SELECT sport, provider, reason, source, units, metadata, created_at
            FROM blocked_api_calls_log
            WHERE created_at >= NOW() - ($1::int || ' days')::interval
            ${filterSql}
            ORDER BY created_at DESC
            LIMIT 50
            `,
            params
        );

        return {
            ok: true,
            windowDays,
            blockedTotal: Number(totalsRes.rows[0]?.blocked_total || 0),
            byReason: byReasonRes.rows,
            bySportProvider: bySportProviderRes.rows,
            recent: recentRes.rows
        };
    } catch (err) {
        return {
            ok: false,
            error: err.message,
            windowDays,
            blockedTotal: 0,
            byReason: [],
            bySportProvider: [],
            recent: []
        };
    }
}

module.exports = {
    ensureBlockedLogTable,
    recordBlockedCall,
    getBlockedCallsSummary
};
