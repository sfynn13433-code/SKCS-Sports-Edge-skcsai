'use strict';

/**
 * Phase 4 — BSD enrichment verification (read-only).
 * Measures coverage of governance-approved endpoints across a sample window.
 * Does not write canonical data or touch the prediction engine.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { listEvents, isBzzoiroEnabled } = require('../backend/services/bzzoiroApiClient');
const { fetchEnrichmentBundle } = require('../backend/providers/football/bzzoiroProvider');

function parseArgs(argv) {
    const args = {
        limit: 15,
        dateFrom: new Date().toISOString().slice(0, 10),
        dateTo: null,
        leagueId: null,
        eventId: null
    };

    for (const raw of argv) {
        if (raw.startsWith('--limit=')) args.limit = Number(raw.split('=')[1]) || args.limit;
        if (raw.startsWith('--date-from=')) args.dateFrom = raw.split('=')[1].slice(0, 10);
        if (raw.startsWith('--date-to=')) args.dateTo = raw.split('=')[1].slice(0, 10);
        if (raw.startsWith('--league-id=')) args.leagueId = raw.split('=')[1];
        if (raw.startsWith('--event-id=')) args.eventId = raw.split('=')[1];
    }

    return args;
}

function countOddsQuotes(bundle) {
    return Array.isArray(bundle?.quotes) ? bundle.quotes.length : 0;
}

async function resolveEventIds(args) {
    if (args.eventId) return [String(args.eventId)];

    const params = {
        limit: Math.min(Math.max(args.limit, 1), 50),
        offset: 0,
        date_from: args.dateFrom
    };
    if (args.dateTo) params.date_to = args.dateTo;
    if (args.leagueId) params.league_id = args.leagueId;

    const res = await listEvents(params);
    if (!res.ok) {
        throw new Error(res.reason || `listEvents failed (${res.status || 'unknown'})`);
    }

    const rows = Array.isArray(res.data?.results) ? res.data.results : [];
    return rows.map((row) => String(row.id)).filter(Boolean);
}

async function main() {
    if (!isBzzoiroEnabled()) {
        console.error('[verify-bsd] ENABLE_BZZOIRO_PROVIDER is not true');
        process.exit(1);
    }

    const args = parseArgs(process.argv.slice(2));
    const eventIds = await resolveEventIds(args);

    if (!eventIds.length) {
        console.log(JSON.stringify({ ok: true, message: 'No events in window', events: 0 }, null, 2));
        return;
    }

    const rows = [];
    let withOdds = 0;
    let withPolymarket = 0;
    let withLineups = 0;
    let withPredictedLineup = 0;

    for (const eventId of eventIds) {
        const bundle = await fetchEnrichmentBundle(eventId);
        const oddsCount = countOddsQuotes(bundle.odds_comparison);
        const polyCount = Array.isArray(bundle.polymarket?.markets) ? bundle.polymarket.markets.length : 0;
        const lineupStatus = bundle.lineups?.enrichment?.lineup_status || null;
        const confidence = bundle.lineups?.verification?.confidence ?? null;

        if (oddsCount > 0) withOdds += 1;
        if (polyCount > 0) withPolymarket += 1;
        if (lineupStatus) withLineups += 1;
        if (lineupStatus === 'predicted') withPredictedLineup += 1;

        rows.push({
            event_id: eventId,
            ok: bundle.ok,
            odds_quotes: oddsCount,
            polymarket_rows: polyCount,
            lineup_status: lineupStatus,
            lineup_confidence: confidence,
            errors: {
                odds: bundle.odds_comparison?.error || null,
                polymarket: bundle.polymarket?.error || null,
                lineups: bundle.lineups?.error || null
            }
        });
    }

    const total = rows.length;
    const summary = {
        ok: true,
        phase: 'bsd_enrichment_verification_v1',
        window: { date_from: args.dateFrom, date_to: args.dateTo, league_id: args.leagueId },
        events_sampled: total,
        coverage: {
            odds_pct: total ? Math.round((withOdds / total) * 100) : 0,
            polymarket_pct: total ? Math.round((withPolymarket / total) * 100) : 0,
            lineups_pct: total ? Math.round((withLineups / total) * 100) : 0,
            predicted_lineups_pct: total ? Math.round((withPredictedLineup / total) * 100) : 0
        },
        rows
    };

    console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
    console.error('[verify-bsd] failed:', error.message);
    process.exit(1);
});
