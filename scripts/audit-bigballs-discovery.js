'use strict';

/**
 * Live Big Balls Data discovery probe.
 * Read-only. Does not touch prediction pipelines.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const axios = require('axios');
const {
    getBaseUrl,
    getApiKey,
    getMatch,
    getStandings,
    isBigBallsDataEnabled,
    listLeagues,
    listMatches,
    listSports,
    request
} = require('../backend/services/bigBallsDataApiClient');

const FOOTBALL_LEAGUE_ALIASES = ['epl', 'laliga', 'bundesliga', 'seriea', 'ligue1', 'mls', 'cl'];

async function probeUnauth() {
    const started = Date.now();
    try {
        const res = await axios.get(`${getBaseUrl()}/v1/sports`, {
            timeout: 15000,
            validateStatus: () => true
        });
        return {
            ok: res.status === 401,
            status: res.status,
            latency_ms: Date.now() - started,
            error_code: res.data?.error?.code || null,
            envelope: Boolean(res.data?.meta && Object.prototype.hasOwnProperty.call(res.data, 'error'))
        };
    } catch (error) {
        return { ok: false, status: 0, latency_ms: Date.now() - started, reason: error.message };
    }
}

async function main() {
    const report = {
        generated_at: new Date().toISOString(),
        provider: 'big_balls_data',
        base_url: getBaseUrl(),
        config: {
            enable_flag: isBigBallsDataEnabled(),
            api_key_configured: Boolean(getApiKey())
        },
        probes: {},
        health: {},
        football_leagues: []
    };

    report.probes.unauth = await probeUnauth();

    if (!isBigBallsDataEnabled()) {
        console.log(JSON.stringify({ ...report, note: 'Set ENABLE_BIG_BALLS_DATA_PROVIDER=true for authenticated probes' }, null, 2));
        process.exit(0);
    }

    if (!getApiKey()) {
        console.log(JSON.stringify({
            ...report,
            note: 'Set BIG_BALLS_DATA_API_KEY (bbs_live_…) from https://bigballsdata.com/dashboard/keys'
        }, null, 2));
        process.exit(0);
    }

    const sports = await listSports();
    const leagues = await listLeagues({ sport: 'football' });
    const matches = await listMatches({ sport: 'football', league: 'epl', limit: 3 });
    const standings = await getStandings({ sport: 'football', league: 'epl' });

    report.probes.sports = { ok: sports.ok, status: sports.status, latency_ms: sports.latency_ms, rate: sports.rate, count: Array.isArray(sports.data) ? sports.data.length : null };
    report.probes.leagues = { ok: leagues.ok, status: leagues.status, latency_ms: leagues.latency_ms, rate: leagues.rate, count: Array.isArray(leagues.data) ? leagues.data.length : null };
    report.probes.matches_epl = { ok: matches.ok, status: matches.status, latency_ms: matches.latency_ms, rate: matches.rate, count: Array.isArray(matches.data) ? matches.data.length : null };
    report.probes.standings_epl = { ok: standings.ok, status: standings.status, latency_ms: standings.latency_ms, rate: standings.rate };

    const sampleMatchId = Array.isArray(matches.data) && matches.data[0]?.id ? matches.data[0].id : null;
    if (sampleMatchId) {
        report.probes.match_detail = await getMatch(sampleMatchId, { sport: 'football', fields: 'scores,odds,lineups' });
        report.sample_match_id = sampleMatchId;
    }

    for (const alias of FOOTBALL_LEAGUE_ALIASES) {
        const res = await listMatches({ sport: 'football', league: alias, limit: 1 });
        report.football_leagues.push({
            alias,
            ok: res.ok,
            status: res.status,
            meta_source: res.meta?.source || null,
            meta_confidence: res.meta?.confidence ?? null,
            sample_count: Array.isArray(res.data) ? res.data.length : 0
        });
    }

    const latencies = Object.values(report.probes)
        .map((row) => row?.latency_ms)
        .filter((n) => Number.isFinite(n));

    report.health = {
        auth_reliability: sports.ok ? 'pass' : 'fail',
        latency_ms: {
            min: latencies.length ? Math.min(...latencies) : null,
            max: latencies.length ? Math.max(...latencies) : null,
            avg: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null
        },
        rate_limits_observed: sports.rate || null
    };

    console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
    console.error('[audit-bigballs-discovery] failed:', error.message);
    process.exit(1);
});
