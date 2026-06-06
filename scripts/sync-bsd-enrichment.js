'use strict';

/**
 * Phase 4 — Persist BSD enrichment bundles to rapidapi_cache (enrichment lane only).
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { query } = require('../backend/db');
const { listEvents, isBzzoiroEnabled } = require('../backend/services/bzzoiroApiClient');
const { fetchEnrichmentBundle } = require('../backend/providers/football/bzzoiroProvider');

const PROVIDER = 'bzzoiro';

function parseArgs(argv) {
    const args = {
        dryRun: false,
        limit: 10,
        dateFrom: new Date().toISOString().slice(0, 10),
        leagueId: null,
        eventId: null
    };

    for (const raw of argv) {
        if (raw === '--dry-run') args.dryRun = true;
        if (raw.startsWith('--limit=')) args.limit = Number(raw.split('=')[1]) || args.limit;
        if (raw.startsWith('--date-from=')) args.dateFrom = raw.split('=')[1].slice(0, 10);
        if (raw.startsWith('--league-id=')) args.leagueId = raw.split('=')[1];
        if (raw.startsWith('--event-id=')) args.eventId = raw.split('=')[1];
    }

    return args;
}

async function upsertCache(cacheKey, payload) {
    await query(`
        INSERT INTO rapidapi_cache (cache_key, provider_name, payload, updated_at)
        VALUES ($1, $2, $3::jsonb, NOW())
        ON CONFLICT (cache_key) DO UPDATE SET
            provider_name = EXCLUDED.provider_name,
            payload = EXCLUDED.payload,
            updated_at = NOW()
    `, [cacheKey, PROVIDER, JSON.stringify(payload)]);
}

async function resolveEventIds(args) {
    if (args.eventId) return [String(args.eventId)];

    const res = await listEvents({
        limit: Math.min(Math.max(args.limit, 1), 50),
        offset: 0,
        date_from: args.dateFrom,
        ...(args.leagueId ? { league_id: args.leagueId } : {})
    });

    if (!res.ok) {
        throw new Error(res.reason || `listEvents failed (${res.status || 'unknown'})`);
    }

    return (Array.isArray(res.data?.results) ? res.data.results : [])
        .map((row) => String(row.id))
        .filter(Boolean);
}

async function main() {
    if (!isBzzoiroEnabled()) {
        console.error('[sync-bsd-enrichment] ENABLE_BZZOIRO_PROVIDER is not true');
        process.exit(1);
    }

    const args = parseArgs(process.argv.slice(2));
    const eventIds = await resolveEventIds(args);

    if (!eventIds.length) {
        console.log(JSON.stringify({ ok: true, cached: 0, message: 'No events in window' }));
        return;
    }

    if (!args.dryRun && !process.env.DATABASE_URL) {
        console.error('[sync-bsd-enrichment] DATABASE_URL is required to persist cache');
        process.exit(1);
    }

    let cached = 0;
    const results = [];

    for (const eventId of eventIds) {
        const bundle = await fetchEnrichmentBundle(eventId);
        const payload = {
            schema_version: 'skcs:bzzoiro:enrichment-bundle:v1',
            provider_event_id: eventId,
            synced_at: new Date().toISOString(),
            lane: 'enrichment',
            bundle
        };

        if (!args.dryRun && bundle.ok) {
            await upsertCache(`bzzoiro_enrichment_${eventId}`, payload);
            cached += 1;
        }

        results.push({
            event_id: eventId,
            ok: bundle.ok,
            cached: !args.dryRun && bundle.ok,
            odds_quotes: bundle.odds_comparison?.quotes?.length || 0,
            polymarket_rows: bundle.polymarket?.markets?.length || 0,
            lineup_status: bundle.lineups?.enrichment?.lineup_status || null
        });
    }

    console.log(JSON.stringify({
        ok: true,
        dry_run: args.dryRun,
        events_processed: eventIds.length,
        cached,
        results
    }, null, 2));
}

main().catch((error) => {
    console.error('[sync-bsd-enrichment] failed:', error.message);
    process.exit(1);
});
