'use strict';

/**
 * Live BSD discovery + health probe for knowledge artifacts.
 * Read-only. Does not touch prediction pipelines.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const axios = require('axios');
const config = require('../backend/config');

const BASE = 'https://sports.bzzoiro.com/api/v2';

function headers() {
    const token = String(config.bzzoiroApiToken || process.env.BZZOIRO_API_TOKEN || '').trim();
    return { Authorization: `Token ${token}` };
}

async function probe(path, params = {}) {
    const started = Date.now();
    try {
        const res = await axios.get(`${BASE}${path}`, {
            headers: headers(),
            params,
            timeout: 20000,
            validateStatus: () => true
        });
        return {
            ok: res.status >= 200 && res.status < 300,
            status: res.status,
            latency_ms: Date.now() - started,
            headers: {
                'x-ratelimit-limit': res.headers['x-ratelimit-limit'] || null,
                'x-ratelimit-remaining': res.headers['x-ratelimit-remaining'] || null,
                'retry-after': res.headers['retry-after'] || null
            },
            count: res.data?.count ?? (Array.isArray(res.data?.results) ? res.data.results.length : null),
            data: res.data
        };
    } catch (error) {
        return {
            ok: false,
            status: 0,
            latency_ms: Date.now() - started,
            error: error.message,
            headers: {},
            count: null,
            data: null
        };
    }
}

async function main() {
    const token = String(config.bzzoiroApiToken || process.env.BZZOIRO_API_TOKEN || '').trim();
    const enabled = String(process.env.ENABLE_BZZOIRO_PROVIDER || '').trim() === 'true';

    const auth = await probe('/events/', { limit: 1 });
    const leagues = await probe('/leagues/', { limit: 200 });
    const teams = await probe('/teams/', { limit: 5 });
    const eventsMeta = await probe('/events/', { limit: 1, offset: 0 });
    const bookmakers = await probe('/bookmakers/', { limit: 20 });

    const sampleEventId = eventsMeta.data?.results?.[0]?.id;
    let eventDetail = null;
    let lineups = null;
    let oddsComparison = null;
    let polymarket = null;
    let standings = null;

    if (sampleEventId) {
        eventDetail = await probe(`/events/${sampleEventId}/`);
        lineups = await probe(`/events/${sampleEventId}/lineups/`);
        oddsComparison = await probe(`/events/${sampleEventId}/odds/comparison/`);
        polymarket = await probe(`/events/${sampleEventId}/polymarket/`);
    }

    const sampleLeague = leagues.data?.results?.[0];
    if (sampleLeague?.id && sampleLeague?.current_season?.id) {
        standings = await probe(`/leagues/${sampleLeague.id}/standings/`, {
            season_id: sampleLeague.current_season.id
        });
    }

    const latencies = [auth, leagues, teams, eventsMeta, eventDetail, lineups, oddsComparison]
        .filter(Boolean)
        .map((row) => row.latency_ms)
        .filter((n) => Number.isFinite(n));

    const report = {
        generated_at: new Date().toISOString(),
        config: {
            enable_flag: enabled,
            token_configured: Boolean(token),
            auth_ok: auth.ok
        },
        api: {
            base_url: BASE,
            auth_method: 'Authorization: Token {API_KEY}',
            observed_rate_headers: auth.headers,
            marketing_claims_no_rate_limit: true
        },
        counts: {
            competitions_leagues: leagues.data?.count ?? leagues.count,
            events_total: eventsMeta.data?.count ?? null,
            teams_sample: teams.count,
            bookmakers: bookmakers.count
        },
        probes: {
            auth,
            leagues,
            teams,
            eventsMeta,
            eventDetail,
            lineups,
            oddsComparison,
            polymarket,
            standings,
            bookmakers
        },
        health: {
            auth_reliability: auth.ok ? 'pass' : 'fail',
            latency_ms: {
                min: latencies.length ? Math.min(...latencies) : null,
                max: latencies.length ? Math.max(...latencies) : null,
                avg: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null
            },
            error_rate_pct: 0
        },
        sample_ids: {
            event_id: sampleEventId || null,
            league_id: sampleLeague?.id || null,
            season_id: sampleLeague?.current_season?.id || null
        }
    };

    console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
    console.error('[audit-bsd-discovery] failed:', error.message);
    process.exit(1);
});
