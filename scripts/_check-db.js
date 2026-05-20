require('dotenv').config();
const { query } = require('../backend/database');

async function main() {
    // Check future predictions with all relevant metadata fields
    const res = await query(`
        select
            r.match_id,
            r.sport,
            r.market,
            r.prediction,
            r.confidence,
            r.metadata->>'match_time' as match_time,
            r.metadata->>'home_team' as home_team,
            r.metadata->>'away_team' as away_team,
            r.metadata->>'league' as league,
            r.metadata->>'prediction_source' as prediction_source,
            r.metadata->>'data_mode' as data_mode,
            r.metadata->>'source' as source
        from predictions_filtered f
        join predictions_raw r on r.id = f.raw_id
        where f.tier = 'normal'
          and f.is_valid = true
          and (r.metadata->>'match_time')::timestamptz > NOW()
        order by (r.metadata->>'match_time')::timestamptz ASC
        limit 10
    `);
    console.log('Future valid predictions (normal tier):');
    console.log('Count:', res.rows.length);
    for (const row of res.rows) {
        console.log(JSON.stringify(row));
    }

    // Check distinct markets
    const markets = await query(`
        select r.market, count(*) as cnt
        from predictions_filtered f
        join predictions_raw r on r.id = f.raw_id
        where f.tier = 'normal'
          and f.is_valid = true
          and (r.metadata->>'match_time')::timestamptz > NOW()
        group by r.market
        order by cnt desc
        limit 20
    `);
    console.log('\nMarket distribution (future, normal):');
    for (const row of markets.rows) {
        console.log(`  ${row.market}: ${row.cnt}`);
    }

    // Check distinct sports
    const sports = await query(`
        select r.sport, count(*) as cnt
        from predictions_filtered f
        join predictions_raw r on r.id = f.raw_id
        where f.tier = 'normal'
          and f.is_valid = true
          and (r.metadata->>'match_time')::timestamptz > NOW()
        group by r.sport
        order by cnt desc
    `);
    console.log('\nSport distribution (future, normal):');
    for (const row of sports.rows) {
        console.log(`  ${row.sport}: ${row.cnt}`);
    }

    process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
