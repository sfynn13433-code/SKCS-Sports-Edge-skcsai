'use strict';

const { query } = require('../../../db');

const CACHE_TTL_HOURS = 3;
let tableReadyPromise = null;

function normalizeToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function safeIsoDate(value) {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString();
}

function buildContextCacheKey(fixture = {}) {
    const matchId = normalizeToken(fixture.match_id || fixture.fixture_id || fixture.id || '');
    const home = normalizeToken(fixture.home_team || fixture.homeTeam || fixture.home || '');
    const away = normalizeToken(fixture.away_team || fixture.awayTeam || fixture.away || '');
    const kickoff = safeIsoDate(fixture.kickoffTime || fixture.kickoff || fixture.date || fixture.match_time || fixture.commence_time || '');
    const location = normalizeToken(fixture.location || fixture.venue || fixture.stadiumLocation || '');
    const competition = normalizeToken(
        fixture.competition ||
        fixture.league ||
        fixture.tournament ||
        fixture.competition_key ||
        ''
    );

    return [matchId, home, away, competition, kickoff, location]
        .map((part) => part || '_')
        .join('::');
}

async function ensureCacheTable() {
    if (!tableReadyPromise) {
        tableReadyPromise = query(`
            CREATE TABLE IF NOT EXISTS context_intelligence_cache (
                id bigserial PRIMARY KEY,
                cache_key text NOT NULL UNIQUE,
                fixture_id text,
                payload jsonb NOT NULL DEFAULT '{}'::jsonb,
                last_verified timestamptz NOT NULL DEFAULT now(),
                expires_at timestamptz NOT NULL DEFAULT (now() + interval '3 hour'),
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
        `)
            .then(() => query(`
                CREATE INDEX IF NOT EXISTS idx_context_intelligence_cache_expires_at
                ON context_intelligence_cache(expires_at);
            `))
            .catch((err) => {
                tableReadyPromise = null;
                throw err;
            });
    }
    return tableReadyPromise;
}

async function getFreshContextCache(cacheKey) {
    await ensureCacheTable();
    const res = await query(
        `
        SELECT payload, last_verified
        FROM context_intelligence_cache
        WHERE cache_key = $1
          AND last_verified >= now() - interval '${CACHE_TTL_HOURS} hour'
        LIMIT 1;
        `,
        [cacheKey]
    );

    if (!res.rows.length) return null;
    return {
        payload: res.rows[0].payload || {},
        last_verified: res.rows[0].last_verified || null
    };
}

async function upsertContextCache(cacheKey, fixtureId, payload) {
    await ensureCacheTable();
    await query(
        `
        INSERT INTO context_intelligence_cache (cache_key, fixture_id, payload, last_verified, expires_at, updated_at)
        VALUES ($1, $2, $3::jsonb, now(), now() + interval '${CACHE_TTL_HOURS} hour', now())
        ON CONFLICT (cache_key)
        DO UPDATE SET
            fixture_id = EXCLUDED.fixture_id,
            payload = EXCLUDED.payload,
            last_verified = now(),
            expires_at = now() + interval '${CACHE_TTL_HOURS} hour',
            updated_at = now();
        `,
        [cacheKey, fixtureId || null, JSON.stringify(payload || {})]
    );
}

module.exports = {
    CACHE_TTL_HOURS,
    buildContextCacheKey,
    ensureCacheTable,
    getFreshContextCache,
    upsertContextCache
};
