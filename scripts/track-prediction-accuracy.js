require('dotenv').config();

const { Pool } = require('pg');
const axios = require('axios');
const moment = require('moment-timezone');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const APISPORTS_KEY = process.env.X_APISPORTS_KEY;

function parseArgs() {
    const args = process.argv.slice(2);
    const result = { sport: 'football', date: null };
    for (const arg of args) {
        if (arg.startsWith('--sport=')) {
            result.sport = arg.replace('--sport=', '');
        } else if (arg.startsWith('--date=')) {
            result.date = arg.replace('--date=', '');
        }
    }
    // Default to yesterday in Africa/Johannesburg if no date provided
    if (!result.date) {
        result.date = moment().tz('Africa/Johannesburg').subtract(1, 'day').format('YYYY-MM-DD');
    }
    return result;
}

function classifyAIInsight(result, confidence) {
    if (result === 'WON' && confidence >= 75) {
        return 'VERIFIED_EDGE';
    } else if (result === 'WON' && confidence < 75) {
        return 'LUCKY_WIN';
    } else if (result === 'LOST' && confidence >= 75) {
        return 'CRITICAL_FAIL';
    } else if (result === 'LOST' && confidence < 75) {
        return 'EXPECTED_VARIANCE';
    }
    return 'UNKNOWN';
}

function determineResolutionStatus(result) {
    if (result === 'WON') return 'won';
    if (result === 'LOST') return 'lost';
    return 'void';
}

async function fetchFixtureFromAPI(fixtureId) {
    try {
        const response = await axios.get('https://v3.football.api-sports.io/fixtures', {
            params: { id: fixtureId },
            headers: { 'x-apisports-key': APISPORTS_KEY },
            timeout: 10000
        });
        return response.data?.response?.[0] || null;
    } catch (err) {
        console.error(`[API] Error fetching fixture ${fixtureId}:`, err.message);
        return null;
    }
}

async function gradePredictionsForDate(sport, date) {
    console.log(`\n=== TRACKING ACCURACY FOR ${sport.toUpperCase()} ON ${date} ===\n`);

    const client = await pool.connect();
    let gradedCount = 0;
    let errorCount = 0;
    const stats = { won: 0, lost: 0, void: 0, verified_edge: 0, lucky_win: 0, critical_fail: 0, expected_variance: 0 };

    try {
        // Find events from the target date that are finished
        const eventsResult = await client.query(`
            SELECT 
                e.id, 
                e.home_team, 
                e.away_team, 
                e.home_score, 
                e.away_score, 
                e.status,
                e.commence_time,
                DATE(e.commence_time AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg') as fixture_date
            FROM events e
            WHERE e.status = 'FT'
              AND e.home_score IS NOT NULL
              AND e.away_score IS NOT NULL
              AND DATE(e.commence_time AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg') = $1
            ORDER BY e.commence_time DESC
        `, [date]);

        console.log(`[STEP 1] Found ${eventsResult.rows.length} finished events for ${date}`);

        if (eventsResult.rows.length === 0) {
            console.log('No finished events found for grading.');
            return { graded: 0, errors: 0, stats };
        }

        // Process each event
        for (const event of eventsResult.rows) {
            try {
                // Find predictions for this event from both tables
                // Match by fixture_id OR by team names (fuzzy match)
                const predResult = await client.query(`
                    SELECT DISTINCT ON (id)
                        id, 
                        matches, 
                        recommendation, 
                        total_confidence,
                        tier,
                        type,
                        publish_run_id,
                        home_team,
                        away_team,
                        match_date
                    FROM direct1x2_prediction_final
                    WHERE fixture_id = $1
                       OR (home_team IS NOT NULL AND away_team IS NOT NULL 
                           AND (LOWER(home_team) = LOWER($2) OR LOWER($2) LIKE '%' || LOWER(home_team) || '%')
                           AND (LOWER(away_team) = LOWER($3) OR LOWER($3) LIKE '%' || LOWER(away_team) || '%'))
                       OR matches::text LIKE '%' || $1 || '%'
                    UNION ALL
                    SELECT DISTINCT ON (id)
                        id, 
                        matches, 
                        recommendation, 
                        total_confidence,
                        tier,
                        type,
                        publish_run_id,
                        NULL as home_team,
                        NULL as away_team,
                        NULL as match_date
                    FROM predictions_final
                    WHERE matches::text LIKE '%' || $1 || '%'
                       OR matches::text LIKE '%' || $2 || '%'
                       OR matches::text LIKE '%' || $3 || '%'
                `, [event.id, event.home_team, event.away_team]);

                if (predResult.rows.length === 0) {
                    continue;
                }

                console.log(`[EVENT] ${event.home_team} vs ${event.away_team} (${event.home_score}-${event.away_score}) - ${predResult.rows.length} predictions`);

                for (const pred of predResult.rows) {
                    try {
                        const rec = pred.recommendation?.toLowerCase() || '';
                        let result = 'VOID';

                        // Determine prediction outcome
                        if (rec.includes('home') || rec === '1' || rec === 'home_win' || rec.includes('home win')) {
                            result = event.home_score > event.away_score ? 'WON' : 'LOST';
                        } else if (rec.includes('draw') || rec === 'x' || rec === 'draw') {
                            result = event.home_score === event.away_score ? 'WON' : 'LOST';
                        } else if (rec.includes('away') || rec === '2' || rec.includes('away_win') || rec.includes('away win')) {
                            result = event.away_score > event.home_score ? 'WON' : 'LOST';
                        } else {
                            // Default: assume home win
                            result = event.home_score > event.away_score ? 'WON' : 'LOST';
                        }

                        const confidence = pred.total_confidence || 50;
                        const aiInsight = classifyAIInsight(result, confidence);
                        const resolutionStatus = determineResolutionStatus(result);

                        // Extract market from matches JSON
                        let market = '1X2';
                        let fixtureDate = event.fixture_date;
                        try {
                            const matches = typeof pred.matches === 'string' ? JSON.parse(pred.matches) : pred.matches;
                            if (matches && matches[0]) {
                                if (matches[0].market) market = matches[0].market;
                                if (matches[0].date) fixtureDate = matches[0].date;
                            }
                        } catch (e) {}

                        // Use match_date from prediction if available
                        if (pred.match_date) {
                            fixtureDate = new Date(pred.match_date).toISOString().slice(0, 10);
                        }

                        // Determine prediction type
                        let predictionType = 'direct';
                        if (pred.type) {
                            const type = pred.type.toLowerCase();
                            if (type === 'same_match') predictionType = 'same_match';
                            else if (type === 'secondary') predictionType = 'secondary';
                            else if (type === 'multi' || type === 'acca') predictionType = 'multi';
                            else if (type.includes('acca')) predictionType = 'acca';
                        }

                        // Insert into predictions_accuracy with all required fields
                        await client.query(`
                            INSERT INTO predictions_accuracy (
                                prediction_final_id,
                                publish_run_id,
                                prediction_match_index,
                                event_id,
                                sport,
                                prediction_tier,
                                prediction_type,
                                confidence,
                                market,
                                predicted_outcome,
                                home_team,
                                away_team,
                                fixture_date,
                                actual_result,
                                actual_home_score,
                                actual_away_score,
                                event_status,
                                resolution_status,
                                is_correct,
                                evaluation_notes,
                                evaluated_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
                            ON CONFLICT (prediction_final_id, prediction_match_index) 
                            DO UPDATE SET
                                resolution_status = EXCLUDED.resolution_status,
                                is_correct = EXCLUDED.is_correct,
                                actual_result = EXCLUDED.actual_result,
                                actual_home_score = EXCLUDED.actual_home_score,
                                actual_away_score = EXCLUDED.actual_away_score,
                                event_status = EXCLUDED.event_status,
                                evaluation_notes = EXCLUDED.evaluation_notes,
                                evaluated_at = EXCLUDED.evaluated_at,
                                fixture_date = EXCLUDED.fixture_date
                        `, [
                            pred.id,
                            pred.publish_run_id,
                            0,
                            event.id,
                            sport,
                            pred.tier || 'normal',
                            predictionType,
                            confidence,
                            market,
                            pred.recommendation,
                            pred.home_team || event.home_team,
                            pred.away_team || event.away_team,
                            fixtureDate,
                            `${event.home_score}-${event.away_score}`,
                            event.home_score,
                            event.away_score,
                            event.status,
                            resolutionStatus,
                            result === 'WON',
                            aiInsight,
                            new Date().toISOString()
                        ]);

                        console.log(`  [GRADED] Pred ${pred.id}: ${result} | ${aiInsight} | conf=${confidence}% | tier=${pred.tier || 'normal'} | type=${predictionType}`);

                        // Update stats
                        gradedCount++;
                        if (result === 'WON') stats.won++;
                        else if (result === 'LOST') stats.lost++;
                        else stats.void++;

                        const insightKey = aiInsight.toLowerCase().replace('|', '_').split('_')[0];
                        if (stats[insightKey] !== undefined) stats[insightKey]++;

                    } catch (err) {
                        console.error(`  [ERROR] Failed to grade prediction ${pred.id}:`, err.message);
                        errorCount++;
                    }
                }

            } catch (err) {
                console.error(`[ERROR] Failed to process event ${event.id}:`, err.message);
                errorCount++;
            }
        }

        console.log(`\n=== GRADING COMPLETE ===`);
        console.log(`Total graded: ${gradedCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log(`Stats: ${JSON.stringify(stats)}`);

        return { graded: gradedCount, errors: errorCount, stats };

    } catch (err) {
        console.error('[FATAL]', err.message);
        throw err;
    } finally {
        client.release();
    }
}

// Main execution
(async () => {
    const { sport, date } = parseArgs();
    console.log(`[track-prediction-accuracy] Starting: sport=${sport}, date=${date}`);

    try {
        const result = await gradePredictionsForDate(sport, date);
        console.log('\n[RESULT]', JSON.stringify({
            ok: true,
            sport,
            date,
            ...result
        }));
        process.exit(0);
    } catch (err) {
        console.error('[FATAL]', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
})();
