'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { query } = require('../backend/db');
const {
    SportsDataIOClient,
    getSoccerSeasonYear,
    resolveSportsDataIOCompetitionId
} = require('../backend/apiClients');
const { buildSportsDataIOContractView } = require('../backend/semantic-layer/sportsdataioContractHelpers');

const UCL_COMPETITION = '3';
const PROVIDER = 'sportsdata-io';

function parseArgs(argv) {
    const args = {
        dryRun: false,
        withOdds: false,
        season: null,
        date: new Date().toISOString().slice(0, 10)
    };

    for (const raw of argv) {
        if (raw === '--dry-run') args.dryRun = true;
        if (raw === '--with-odds') args.withOdds = true;
        if (raw.startsWith('--season=')) args.season = raw.split('=')[1];
        if (raw.startsWith('--date=')) args.date = raw.split('=')[1].slice(0, 10);
    }

    args.season = args.season || String(getSoccerSeasonYear(args.date));
    return args;
}

function shiftIsoDate(dateString, offsetDays) {
    const date = new Date(`${dateString}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return dateString;
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
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

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const competitionId = resolveSportsDataIOCompetitionId(UCL_COMPETITION);
    if (!competitionId) {
        console.error('[sync-ucl-context] UCL competition 3 is not entitled on the current key.');
        process.exit(1);
    }

    const client = new SportsDataIOClient();
    const schedule = await client.getSchedule('soccer', competitionId, args.season);
    const contractViews = schedule.map((game) => ({
        contract: buildSportsDataIOContractView(game),
        home_team: game.HomeTeamName || game.HomeTeam || null,
        away_team: game.AwayTeamName || game.AwayTeam || null
    }));

    const upcoming = contractViews.filter((row) => {
        const kickoff = row.contract.date_time_utc || row.contract.date;
        if (!kickoff) return true;
        return new Date(kickoff).getTime() >= Date.now();
    });

    const payload = {
        schema_version: 'skcs:ucl-context:v1',
        competition_id: competitionId,
        season: args.season,
        synced_at: new Date().toISOString(),
        schedule_count: schedule.length,
        upcoming_count: upcoming.length,
        games: schedule,
        contract_views: contractViews
    };

    let oddsPayload = null;
    if (args.withOdds) {
        const oddsByDate = {};
        for (let offset = 0; offset <= 7; offset += 1) {
            const date = shiftIsoDate(args.date, offset);
            oddsByDate[date] = await client.getPreGameOddsByDate('soccer', competitionId, date);
        }
        oddsPayload = {
            schema_version: 'skcs:ucl-odds:v1',
            competition_id: competitionId,
            synced_at: new Date().toISOString(),
            odds_by_date: oddsByDate
        };
    }

    if (args.dryRun) {
        console.log(JSON.stringify({
            dry_run: true,
            competition_id: competitionId,
            season: args.season,
            schedule_count: schedule.length,
            upcoming_count: upcoming.length,
            with_odds: args.withOdds
        }, null, 2));
        return;
    }

    if (!process.env.DATABASE_URL) {
        console.error('[sync-ucl-context] DATABASE_URL is required to persist context cache.');
        process.exit(1);
    }

    await upsertCache(`sportsdataio_ucl_schedule_${args.season}`, payload);
    if (oddsPayload) {
        await upsertCache(`sportsdataio_ucl_odds_${args.date}`, oddsPayload);
    }

    console.log(JSON.stringify({
        ok: true,
        competition_id: competitionId,
        season: args.season,
        schedule_count: schedule.length,
        upcoming_count: upcoming.length,
        odds_cached: Boolean(oddsPayload)
    }));
}

main().catch((error) => {
    console.error('[sync-ucl-context] failed:', error.message);
    process.exit(1);
});
