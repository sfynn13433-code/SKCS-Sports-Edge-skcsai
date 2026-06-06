'use strict';

/**
 * Phase 4b — BSD ↔ API-Sports fixture crosswalk verification.
 * Read-only. Does not promote BSD into canonical truth.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { isBzzoiroEnabled } = require('../backend/services/bzzoiroApiClient');
const {
    TIER1_CROSSWALK_TARGETS,
    fetchAllBsdLeagues,
    resolveBsdLeagueMap,
    runLeagueCrosswalk,
    shiftIsoDate,
    getSoccerSeasonYear
} = require('../backend/services/bzzoiroCrosswalk');

function parseArgs(argv) {
    const today = new Date().toISOString().slice(0, 10);
    const args = {
        dateFrom: today,
        dateTo: shiftIsoDate(today, 7),
        leagues: null,
        mapOnly: false,
        maxKickoffDeltaMin: 180
    };

    for (const raw of argv) {
        if (raw === '--map-only') args.mapOnly = true;
        if (raw.startsWith('--date-from=')) args.dateFrom = raw.split('=')[1].slice(0, 10);
        if (raw.startsWith('--date-to=')) args.dateTo = raw.split('=')[1].slice(0, 10);
        if (raw.startsWith('--leagues=')) {
            args.leagues = raw.split('=')[1]
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean);
        }
        if (raw.startsWith('--max-kickoff-delta-min=')) {
            args.maxKickoffDeltaMin = Number(raw.split('=')[1]) || args.maxKickoffDeltaMin;
        }
    }

    return args;
}

async function main() {
    if (!isBzzoiroEnabled()) {
        console.error('[verify-bsd-crosswalk] ENABLE_BZZOIRO_PROVIDER is not true');
        process.exit(1);
    }

    if (!process.env.X_APISPORTS_KEY && !process.env.API_FOOTBALL_KEY) {
        console.error('[verify-bsd-crosswalk] API-Sports key missing (X_APISPORTS_KEY or API_FOOTBALL_KEY)');
        process.exit(1);
    }

    const args = parseArgs(process.argv.slice(2));
    const bsdLeagues = await fetchAllBsdLeagues();
    const leagueMap = resolveBsdLeagueMap(bsdLeagues);

    if (args.mapOnly) {
        console.log(JSON.stringify({
            ok: true,
            phase: 'bsd_crosswalk_league_map_v1',
            bsd_leagues_total: bsdLeagues.length,
            map: leagueMap
        }, null, 2));
        return;
    }

    const selected = (args.leagues
        ? leagueMap.filter((row) => args.leagues.includes(row.apisports_league_id))
        : leagueMap
    ).filter((row) => row.bsd_league_id);

    const season = String(getSoccerSeasonYear(args.dateFrom));
    const reports = [];

    for (const target of selected) {
        const report = await runLeagueCrosswalk({
            leagueTarget: target,
            dateFrom: args.dateFrom,
            dateTo: args.dateTo,
            season,
            maxKickoffDeltaMin: args.maxKickoffDeltaMin
        });
        reports.push(report);
    }

    const mapped = leagueMap;
    const activeReports = reports.filter((row) => !row.skipped);
    const quotaBlocked = reports.some((row) => row.quota_blocked);
    const totalMatched = activeReports.reduce((sum, row) => sum + (row.counts?.matched || 0), 0);
    const totalApi = activeReports.reduce((sum, row) => sum + (row.counts?.apisports_fixtures || 0), 0);

    console.log(JSON.stringify({
        ok: true,
        phase: 'bsd_crosswalk_verification_v1',
        window: { date_from: args.dateFrom, date_to: args.dateTo, season },
        league_map: mapped,
        leagues_tested: activeReports.length,
        leagues_skipped: reports.length - activeReports.length,
        apisports_quota_blocked: quotaBlocked,
        overall_match_rate_pct: totalApi ? Math.round((totalMatched / totalApi) * 100) : 0,
        reports
    }, null, 2));
}

main().catch((error) => {
    console.error('[verify-bsd-crosswalk] failed:', error.message);
    process.exit(1);
});
