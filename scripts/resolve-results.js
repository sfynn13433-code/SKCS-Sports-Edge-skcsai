require('dotenv').config();

const axios = require('axios');
const { Pool } = require('pg');
const moment = require('moment-timezone');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const APISPORTS_KEY = process.env.X_APISPORTS_KEY;
const SAST_TZ = 'Africa/Johannesburg';

// ============================================================
// PHASE 3A: RESOLUTION & ACCURACY ENGINE
// ============================================================

async function resolveResults() {
    console.log('\n=== PHASE 3A: RESOLUTION ENGINE ===\n');
    
    const client = await pool.connect();
    let resolvedCount = 0;
    let gradedCount = 0;
    
    try {
        // STEP 1: Find matches that should be finished
        console.log('[STEP 1] Finding matches to resolve...');
        
        const result = await client.query(`
            SELECT id, home_team, away_team, commence_time
            FROM events
            WHERE commence_time < NOW() - INTERVAL '3 hours'
            AND (status IS NULL OR status != 'FT')
            ORDER BY commence_time DESC
            LIMIT 50
        `);
        
        const matchesToResolve = result.rows;
        console.log(`[STEP 1] Found ${matchesToResolve.length} matches needing resolution`);
        
        if (matchesToResolve.length === 0) {
            console.log('No matches to resolve. All caught up!');
            return { resolved: 0, graded: 0 };
        }
        
        // STEP 2: Fetch final scores from API-Sports
        console.log('\n[STEP 2] Fetching final scores from API-Sports...');
        
        for (const match of matchesToResolve) {
            try {
                const response = await axios.get('https://v3.football.api-sports.io/fixtures', {
                    params: { id: match.id },
                    headers: { 'x-apisports-key': APISPORTS_KEY },
                    timeout: 10000
                });
                
                const fixture = response.data?.response?.[0];
                if (!fixture) {
                    console.warn(`[STEP 2] No fixture found for ID ${match.id}`);
                    continue;
                }
                
                const homeScore = fixture.goals?.home ?? null;
                const awayScore = fixture.goals?.away ?? null;
                const status = fixture.fixture?.status?.short || 'FT';
                
                // STEP 3: Update events table
                await client.query(`
                    UPDATE events 
                    SET status = $1, 
                        home_score = $2, 
                        away_score = $3
                    WHERE id = $4
                `, [status, homeScore, awayScore, match.id]);
                
                console.log(`[STEP 3] Updated ${match.home_team} vs ${match.away_team}: ${homeScore}-${awayScore} (${status})`);
                resolvedCount++;
                
                // STEP 4: Grade predictions
                if (homeScore !== null && awayScore !== null) {
                    await gradePrediction(client, match.id, homeScore, awayScore, status, match.commence_time, match.home_team, match.away_team);
                    gradedCount++;
                }
                
            } catch (err) {
                console.error(`[ERROR] Failed to resolve ${match.id}:`, err.message);
            }
        }
        
        console.log(`\nPHASE 3A SUCCESS: Resolved ${resolvedCount} matches and graded ${gradedCount} predictions.`);
        return { resolved: resolvedCount, graded: gradedCount };
        
    } catch (err) {
        console.error('[FATAL]', err.message);
        throw err;
    } finally {
        client.release();
    }
}

// ============================================================
// GRADING FUNCTION
// ============================================================

function classifyAIInsight(result, confidence, weatherRisk = null) {
    if (result === 'WON' && confidence >= 75) {
        return 'VERIFIED_EDGE';
    } else if (result === 'WON' && confidence < 75) {
        return 'LUCKY_WIN';
    } else if (result === 'LOST' && confidence >= 75) {
        let insight = 'CRITICAL_FAIL';
        if (weatherRisk && weatherRisk > 0.4) {
            insight += '|WEATHER';
        }
        return insight;
    } else if (result === 'LOST' && confidence < 75) {
        return 'EXPECTED_VARIANCE';
    }
    return 'UNKNOWN';
}

function toSastDate(value) {
    if (!value) return null;
    const m = moment(value);
    if (!m.isValid()) return null;
    return m.tz(SAST_TZ).format('YYYY-MM-DD');
}

function parseMatches(matchesValue) {
    if (Array.isArray(matchesValue)) return matchesValue;
    if (typeof matchesValue === 'string') {
        try {
            const parsed = JSON.parse(matchesValue);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_error) {
            return [];
        }
    }
    return [];
}

function normalizeTeamToken(value) {
    return String(value || '').trim().toLowerCase();
}

function resolvePredictionMatchIndex(matches, fixtureId, homeTeam, awayTeam) {
    const fixtureToken = String(fixtureId || '').trim();
    if (!Array.isArray(matches) || matches.length === 0) return 0;
    if (fixtureToken) {
        const byFixture = matches.findIndex((leg) => String(leg?.fixture_id || leg?.match_id || '').trim() === fixtureToken);
        if (byFixture >= 0) return byFixture;
    }
    const home = normalizeTeamToken(homeTeam);
    const away = normalizeTeamToken(awayTeam);
    if (home && away) {
        const byTeams = matches.findIndex((leg) => {
            const legHome = normalizeTeamToken(leg?.home_team || leg?.home_team_name || leg?.home);
            const legAway = normalizeTeamToken(leg?.away_team || leg?.away_team_name || leg?.away);
            return legHome === home && legAway === away;
        });
        if (byTeams >= 0) return byTeams;
    }
    return 0;
}

async function gradePrediction(client, fixtureId, homeScore, awayScore, status, matchDate, homeTeam, awayTeam) {
    // Find predictions for this fixture from the live publish table only
    // Match by fixture_id OR by team names (fuzzy match)
    const predResult = await client.query(`
        SELECT DISTINCT ON (id)
            id, 
            matches, 
            recommendation, 
            total_confidence,
            COALESCE(tier, 'normal') as tier,
            COALESCE(type, 'direct') as type,
            publish_run_id,
            COALESCE(home_team, $5) as home_team,
            COALESCE(away_team, $6) as away_team,
            COALESCE(match_date, $4::timestamptz) as match_date
        FROM direct1x2_prediction_final
        WHERE fixture_id = $1
           OR (home_team IS NOT NULL AND away_team IS NOT NULL 
               AND (LOWER(home_team) = LOWER($5) OR LOWER($5) LIKE '%' || LOWER(home_team) || '%')
               AND (LOWER(away_team) = LOWER($6) OR LOWER($6) LIKE '%' || LOWER(away_team) || '%'))
           OR matches::text LIKE '%' || $1 || '%'
          AND COALESCE(NULLIF(TRIM(home_team), ''), NULLIF(TRIM(matches->0->>'home_team'), ''), NULLIF(TRIM(matches->0->>'home_team_name'), '')) IS NOT NULL
          AND COALESCE(NULLIF(TRIM(away_team), ''), NULLIF(TRIM(matches->0->>'away_team'), ''), NULLIF(TRIM(matches->0->>'away_team_name'), '')) IS NOT NULL
          AND LOWER(COALESCE(NULLIF(TRIM(home_team), ''), NULLIF(TRIM(matches->0->>'home_team'), ''), NULLIF(TRIM(matches->0->>'home_team_name'), ''))) NOT IN ('unknown', 'unknown home', 'unknown away', 'home team', 'away team', 'tbd', 'n/a')
          AND LOWER(COALESCE(NULLIF(TRIM(away_team), ''), NULLIF(TRIM(matches->0->>'away_team'), ''), NULLIF(TRIM(matches->0->>'away_team_name'), ''))) NOT IN ('unknown', 'unknown home', 'unknown away', 'home team', 'away team', 'tbd', 'n/a')
          AND LOWER(COALESCE(NULLIF(TRIM(sport), ''), NULLIF(TRIM(matches->0->>'sport'), ''))) <> 'unknown'
    `, [fixtureId, homeTeam, awayTeam, matchDate, homeTeam, awayTeam]);
    
    if (predResult.rows.length === 0) {
        return;
    }
    
    const actualOutcome = homeScore > awayScore ? 'home' : (homeScore < awayScore ? 'away' : 'draw');
    let insightStats = { verified_edge: 0, lucky_win: 0, critical_fail: 0, expected_variance: 0 };
    
    const latestCompletedRunRes = await client.query(`
        SELECT id
        FROM prediction_publish_runs
        WHERE status = 'completed'
        ORDER BY completed_at DESC NULLS LAST, id DESC
        LIMIT 1
    `);
    const defaultPublishRunId = latestCompletedRunRes.rows?.[0]?.id || null;

    for (const pred of predResult.rows) {
        let result = 'VOID';
        let aiInsight = 'UNKNOWN';
        
        try {
            // 1. Extract confidence (total_confidence from predictions_final)
            const confidence = pred.total_confidence || 50;
            
            // 2. Extract prediction and determine outcome
            const rec = pred.recommendation?.toLowerCase() || '';
            const matches = parseMatches(pred.matches);
            const matchIndex = resolvePredictionMatchIndex(matches, fixtureId, homeTeam, awayTeam);
            const selectedLeg = matches[matchIndex] || matches[0] || {};
            
            // More comprehensive grading for 1X2 markets
            if (rec.includes('home') || rec === '1' || rec === 'home_win' || rec.includes('home win')) {
                result = homeScore > awayScore ? 'WON' : 'LOST';
            } else if (rec.includes('draw') || rec === 'x' || rec === 'draw') {
                result = homeScore === awayScore ? 'WON' : 'LOST';
            } else if (rec.includes('away') || rec === '2' || rec.includes('away_win') || rec.includes('away win')) {
                result = awayScore > homeScore ? 'WON' : 'LOST';
            } else {
                result = 'VOID';
            }
            
            // 3. Classify AI Insight
            aiInsight = classifyAIInsight(result, confidence);
            insightStats[aiInsight.toLowerCase().replace('|', '_').split('_')[0]]++;
            
            // Extract market from matches JSON
            let market = '1X2';
            if (selectedLeg && selectedLeg.market) market = selectedLeg.market;
            
            // Determine fixture_date from match data
            let fixtureDate = matchDate ? new Date(matchDate).toISOString().slice(0, 10) : null;
            if (selectedLeg && (selectedLeg.date || selectedLeg.match_date || selectedLeg.commence_time)) {
                fixtureDate = selectedLeg.date || selectedLeg.match_date || selectedLeg.commence_time;
            }
            if (pred.match_date) fixtureDate = pred.match_date;
            fixtureDate = toSastDate(fixtureDate) || toSastDate(matchDate) || null;

            // Determine prediction type
            let predictionType = 'direct';
            if (pred.type) {
                const type = pred.type.toLowerCase();
                if (type === 'same_match') predictionType = 'same_match';
                else if (type === 'secondary') predictionType = 'secondary';
                else if (type === 'multi' || type === 'acca') predictionType = 'multi';
                else if (type.includes('acca')) predictionType = 'acca';
            }

            // Determine resolution_status
            const resolutionStatus = result === 'WON' ? 'won' : (result === 'LOST' ? 'lost' : 'void');
            const publishRunId = pred.publish_run_id || defaultPublishRunId;

            // Insert into predictions_accuracy with all required fields
            await client.query(`
                INSERT INTO predictions_accuracy (
                    prediction_final_id, 
                    prediction_match_index,
                    event_id, 
                    sport,
                    prediction_tier,
                    prediction_type,
                    publish_run_id,
                    home_team,
                    away_team,
                    fixture_date,
                    predicted_outcome, 
                    actual_result, 
                    is_correct, 
                    actual_home_score, 
                    actual_away_score, 
                    event_status,
                    resolution_status,
                    market,
                    confidence,
                    evaluation_notes,
                    evaluated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
                ON CONFLICT (prediction_final_id, prediction_match_index) 
                DO UPDATE SET
                    publish_run_id = COALESCE(EXCLUDED.publish_run_id, predictions_accuracy.publish_run_id),
                    event_id = EXCLUDED.event_id,
                    sport = EXCLUDED.sport,
                    prediction_tier = EXCLUDED.prediction_tier,
                    prediction_type = EXCLUDED.prediction_type,
                    confidence = EXCLUDED.confidence,
                    market = EXCLUDED.market,
                    predicted_outcome = EXCLUDED.predicted_outcome,
                    home_team = EXCLUDED.home_team,
                    away_team = EXCLUDED.away_team,
                    fixture_date = EXCLUDED.fixture_date,
                    resolution_status = EXCLUDED.resolution_status,
                    is_correct = EXCLUDED.is_correct,
                    actual_result = EXCLUDED.actual_result,
                    actual_home_score = EXCLUDED.actual_home_score,
                    actual_away_score = EXCLUDED.actual_away_score,
                    event_status = EXCLUDED.event_status,
                    evaluation_notes = EXCLUDED.evaluation_notes,
                    evaluated_at = EXCLUDED.evaluated_at
            `, [
                pred.id, 
                matchIndex, 
                fixtureId, 
                'football',
                pred.tier,
                predictionType,
                publishRunId,
                pred.home_team || homeTeam,
                pred.away_team || awayTeam,
                fixtureDate,
                pred.recommendation, 
                `${homeScore}-${awayScore}`, 
                result === 'WON',
                homeScore, 
                awayScore, 
                status,
                resolutionStatus,
                market, 
                confidence,
                aiInsight,
                new Date().toISOString()
            ]);
            
            console.log(`[GRADED] ${pred.id}: ${result} | ${aiInsight} | conf=${confidence}% | ${pred.recommendation} vs ${homeScore}-${awayScore}`);
            
        } catch (err) {
            console.error(`[GRADE ERROR] Failed to grade prediction ${pred.id}:`, err.message);
        }
    }
    
    // Log insight summary
    console.log(`[INSIGHT] ${Object.entries(insightStats).map(([k,v])=>`${k}:${v}`).join(', ')}`);
}

// Run if executed directly
if (require.main === module) {
    resolveResults()
        .then(r => {
            console.log('\n[RESULT]', JSON.stringify(r));
            process.exit(0);
        })
        .catch(err => {
            console.error('[FATAL]', err.message);
            process.exit(1);
        });
}

module.exports = { resolveResults };
