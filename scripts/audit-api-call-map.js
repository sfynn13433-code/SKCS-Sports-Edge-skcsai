'use strict';

/**
 * Static map of known external API entry points (run: node scripts/audit-api-call-map.js).
 */

const CALL_MAP = [
    {
        sport: 'cricket',
        provider: 'cricket_live_line_advance',
        triggers: [
            'render.yaml → skcs-cricket-daily-fixtures → deploy-trigger-cricket.js',
            'GET /api/cron/cricket-daily-fixtures → publish-cricbuzz-cricket.js',
            'cricketLiveMatchResolver.fetchProviderMatches (1 call, 15m file cache)',
            'cricketLiveEnrichmentService.enrichMatch (up to 4 calls × 10 matches)'
        ],
        risk: 'HIGH — RapidAPI 100/day plan; in-memory counter was not instance-safe'
    },
    {
        sport: 'cricket',
        provider: 'cricapi',
        triggers: [
            'GET /api/cron/cricket/cricapi/daily',
            'GET /api/cron/cricket/cricapi/live',
            'scripts/cricapi-cache-refresh.js',
            'import-today-snapshot-pipeline.js (CRICKETDATA_API_KEY)'
        ],
        risk: 'MEDIUM — separate from Live Line Advance'
    },
    {
        sport: 'football',
        provider: 'api_sports_football',
        triggers: [
            'backend/apiClients.js',
            'scripts/import-today-snapshot-pipeline.js SPORT_SPECS',
            'syncService / refresh pipelines'
        ],
        risk: 'LOW when SKCS_ENABLED_SPORTS=football only'
    },
    {
        sport: 'football',
        provider: 'odds_api',
        triggers: [
            'backend/services/oddsApiPipeline.js',
            'server-express odds budget middleware'
        ],
        risk: 'LOW — existing shouldAllowOddsCall() guard'
    }
];

function main() {
    console.log('\n=== SKCS API CALL MAP (static audit) ===\n');
    for (const entry of CALL_MAP) {
        console.log(`[${entry.sport}] provider=${entry.provider} risk=${entry.risk}`);
        for (const t of entry.triggers) {
            console.log(`  - ${t}`);
        }
        console.log('');
    }
    console.log('Governance: apiQuotaRouter + blocked_api_calls_log');
console.log('Inspect: GET /api/debug/api-governance?days=7');
console.log('Mitigation: CRICKET_INGESTION_ENABLED=0 in production.\n');
}

main();
