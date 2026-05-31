#!/usr/bin/env node
/**
 * Phase 0b.5 — Rebuild football_canonical_events from API-Sports only.
 * @see docs/SKCS_ENGINE_V2_PHASE0B5_REPLAY.md
 *
 * Usage:
 *   node scripts/rebuild-canonical-from-api-sports.js --from=2025-05-01 --to=2025-05-07
 *   node scripts/rebuild-canonical-from-api-sports.js --from=2025-05-01 --to=2025-05-01 --dry-run
 *   node scripts/rebuild-canonical-from-api-sports.js --leagues=39,140 --from=2025-05-01 --to=2025-05-03
 *
 * Requires: X_APISPORTS_KEY, SUPABASE_URL, DATABASE_URL or service role for writes.
 */
require('dotenv').config();

const { APISportsClient } = require('../backend/apiClients');
const { evaluateCanonicalIngest, createEmptyFirewallStats, recordFirewallAccept, recordFirewallRejection } = require('../backend/services/canonicalIngestFirewall');
const { upsertCanonicalEvents } = require('../backend/services/canonicalEvents');

/** API-Sports football league IDs — NOT TheSportsDB ids */
const DEFAULT_FOOTBALL_LEAGUES = [
    { id: 39, name: 'Premier League' },
    { id: 140, name: 'La Liga' },
    { id: 78, name: 'Bundesliga' },
    { id: 135, name: 'Serie A' },
    { id: 61, name: 'Ligue 1' }
];

function parseArgs(argv) {
    const out = {
        from: null,
        to: null,
        season: String(new Date().getUTCFullYear()),
        leagues: DEFAULT_FOOTBALL_LEAGUES.map((l) => l.id),
        dryRun: false,
        refreshFinished: false
    };
    for (const arg of argv) {
        if (arg.startsWith('--from=')) out.from = arg.slice(7);
        else if (arg.startsWith('--to=')) out.to = arg.slice(5);
        else if (arg.startsWith('--season=')) out.season = arg.slice(9);
        else if (arg.startsWith('--leagues=')) {
            out.leagues = arg.slice(10).split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
        } else if (arg === '--dry-run') out.dryRun = true;
        else if (arg === '--refresh-finished') out.refreshFinished = true;
    }
    if (!out.from || !out.to) {
        console.error('Required: --from=YYYY-MM-DD --to=YYYY-MM-DD');
        process.exit(1);
    }
    return out;
}

function dateRange(fromStr, toStr) {
    const dates = [];
    const start = new Date(`${fromStr}T00:00:00Z`);
    const end = new Date(`${toStr}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        throw new Error('Invalid date range');
    }
    const cursor = new Date(start);
    while (cursor <= end) {
        dates.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
}

function isFinishedStatus(payload) {
    const short = String(payload?.fixture?.status?.short || '').toUpperCase();
    return ['FT', 'AET', 'PEN'].includes(short);
}

async function fetchFixturesForDay(client, leagueId, season, date) {
    const data = await client.getFixtures(leagueId, season, { date }, 'Football');
    return Array.isArray(data?.response) ? data.response : [];
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const dates = dateRange(args.from, args.to);
    const client = new APISportsClient();
    const stats = createEmptyFirewallStats();
    let apiCalls = 0;
    const acceptedRows = [];

    console.log('[replay] SKCS canonical replay — API-Sports only');
    console.log('[replay] window:', args.from, '→', args.to, 'season:', args.season);
    console.log('[replay] leagues:', args.leagues.join(', '));
    console.log('[replay] dry-run:', args.dryRun);

    for (const leagueId of args.leagues) {
        for (const date of dates) {
            apiCalls += 1;
            const fixtures = await fetchFixturesForDay(client, leagueId, args.season, date);
            console.log(`[replay] league=${leagueId} date=${date} fetched=${fixtures.length} (api_calls≈${apiCalls})`);

            for (const payload of fixtures) {
                const gate = evaluateCanonicalIngest(
                    { sport: 'football', provider: 'api-sports', raw_provider_data: payload },
                    { requireGoals: false }
                );
                if (!gate.accept) {
                    recordFirewallRejection(stats, gate.reason);
                    continue;
                }
                recordFirewallAccept(stats);
                acceptedRows.push({
                    sport: 'football',
                    provider: 'api-sports',
                    provider_name: 'api-sports',
                    match_id: String(payload.fixture.id),
                    date: payload.fixture?.date,
                    status: payload.fixture?.status?.short,
                    league: payload.league?.name,
                    season: payload.league?.season,
                    raw_provider_data: payload
                });
            }
        }
    }

    console.log('[replay] firewall stats (pre-write):', stats);
    console.log('[replay] accepted fixtures:', acceptedRows.length);
    console.log('[replay] estimated API calls:', apiCalls);

    if (args.dryRun) {
        console.log('[replay] dry-run complete — no database writes');
        return;
    }

    if (acceptedRows.length === 0) {
        console.warn('[replay] nothing to write');
        return;
    }

    const writeStats = await upsertCanonicalEvents(acceptedRows, { logRejections: true });
    console.log('[replay] canonical write stats:', writeStats);

    if (args.refreshFinished) {
        console.warn('[replay] --refresh-finished: per-fixture id refresh not implemented yet (see PHASE0B5 doc)');
    }

    console.log('[replay] done. Run: node scripts/audit-v2-provider-coverage.js');
}

main().catch((err) => {
    console.error('[replay] fatal:', err);
    process.exit(1);
});
