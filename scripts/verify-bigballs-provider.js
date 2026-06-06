'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const provider = require('../backend/providers/football/bigBallsDataProvider');

async function timed(label, fn) {
    const started = Date.now();
    try {
        const result = await fn();
        return {
            label,
            ok: result?.ok !== false,
            latency_ms: Date.now() - started,
            reason: result?.reason || result?.error?.message || null,
            count: result?.count ?? result?.items?.length ?? (result?.item ? 1 : null)
        };
    } catch (error) {
        return { label, ok: false, latency_ms: Date.now() - started, reason: error.message, count: null };
    }
}

async function main() {
    if (!provider.isBigBallsDataEnabled()) {
        console.error('[verify-bigballs-provider] ENABLE_BIG_BALLS_DATA_PROVIDER is not true');
        process.exit(1);
    }

    const competitions = await provider.competitions({ sport: 'football' });
    const fixtures = await provider.fixtures({ sport: 'football', league: 'epl', limit: 3 });
    const matchId = fixtures.items?.[0]?.GameId;

    const checks = [
        await timed('competitions', () => provider.competitions({ sport: 'football' })),
        await timed('fixtures', () => provider.fixtures({ sport: 'football', league: 'epl', limit: 3 })),
        await timed('standings', () => provider.standings({ sport: 'football', league: 'epl' })),
        matchId ? await timed('fixtureDetails', () => provider.fixtureDetails(matchId, { sport: 'football' })) : { label: 'fixtureDetails', ok: false, reason: 'no sample match' },
        matchId ? await timed('lineups', () => provider.lineups(matchId, { sport: 'football' })) : { label: 'lineups', ok: false, reason: 'no sample match' },
        matchId ? await timed('odds', () => provider.odds(matchId, { sport: 'football' })) : { label: 'odds', ok: false, reason: 'no sample match' }
    ];

    const passed = checks.filter((c) => c.ok).length;
    console.log(JSON.stringify({
        generated_at: new Date().toISOString(),
        provider: 'big_balls_data',
        checks,
        summary: { passed, total: checks.length, pass_rate_pct: Math.round((passed / checks.length) * 100) }
    }, null, 2));
    process.exit(passed >= 4 ? 0 : 1);
}

main().catch((error) => {
    console.error('[verify-bigballs-provider] failed:', error.message);
    process.exit(1);
});
