'use strict';

/**
 * Validates BSD evaluation adapter + emits health summary.
 * Read-only. Does not touch prediction pipelines.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const bsd = require('../backend/providers/football/bsdProvider');

async function timed(label, fn) {
    const started = Date.now();
    try {
        const result = await fn();
        return {
            label,
            ok: result?.ok !== false,
            latency_ms: Date.now() - started,
            reason: result?.reason || null,
            count: result?.count ?? result?.items?.length ?? (result?.item ? 1 : null)
        };
    } catch (error) {
        return { label, ok: false, latency_ms: Date.now() - started, reason: error.message, count: null };
    }
}

async function main() {
    if (!bsd.isBzzoiroEnabled()) {
        console.error('[verify-bsd-provider] ENABLE_BZZOIRO_PROVIDER is not true');
        process.exit(1);
    }

    const competitions = await bsd.competitions({ limit: 5 });
    const leagueId = competitions.items?.[0]?.provider_league_id;
    const seasonId = competitions.items?.[0]?.provider_season_id;

    const fixtures = leagueId
        ? await bsd.fixtures({ league_id: leagueId, limit: 3 })
        : { ok: false, items: [] };

    const eventId = fixtures.items?.[0]?.GameId;
    const checks = [
        await timed('competitions', () => bsd.competitions({ limit: 5 })),
        await timed('fixtures', () => bsd.fixtures({ league_id: leagueId || 1, limit: 3 })),
        eventId ? await timed('fixtureDetails', () => bsd.fixtureDetails(eventId)) : { label: 'fixtureDetails', ok: false, reason: 'no sample event' },
        leagueId && seasonId
            ? await timed('standings', () => bsd.standings(leagueId, { season_id: seasonId }))
            : { label: 'standings', ok: false, reason: 'no season on sample league' },
        eventId ? await timed('lineups', () => bsd.lineups(eventId)) : { label: 'lineups', ok: false, reason: 'no sample event' },
        eventId ? await timed('odds', () => bsd.odds(eventId)) : { label: 'odds', ok: false, reason: 'no sample event' }
    ];

    const passed = checks.filter((c) => c.ok).length;
    const report = {
        generated_at: new Date().toISOString(),
        provider: 'bsd',
        lane: 'evaluation',
        checks,
        summary: {
            passed,
            total: checks.length,
            pass_rate_pct: Math.round((passed / checks.length) * 100)
        }
    };

    console.log(JSON.stringify(report, null, 2));
    process.exit(passed >= 4 ? 0 : 1);
}

main().catch((error) => {
    console.error('[verify-bsd-provider] failed:', error.message);
    process.exit(1);
});
