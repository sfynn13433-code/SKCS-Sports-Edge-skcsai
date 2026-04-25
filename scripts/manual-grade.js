require('dotenv').config();
const { Pool } = require('pg');
const moment = require('moment-timezone');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const SAST_TZ = 'Africa/Johannesburg';

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

async function manualGrade() {
    const client = await pool.connect();
    
    // Get one finished match
    const matchResult = await client.query(`
        SELECT id, home_team, away_team, home_score, away_score, status, commence_time
        FROM events
        WHERE status = 'FT' AND home_score IS NOT NULL
        LIMIT 1
    `);
    
    if (matchResult.rows.length === 0) {
        console.log('No finished matches found');
        return;
    }
    
    const match = matchResult.rows[0];
    console.log('Grading match:', match.home_team, 'vs', match.away_team);
    
    // Find predictions for this match from the live publish table only
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
          AND COALESCE(NULLIF(TRIM(home_team), ''), NULLIF(TRIM(matches->0->>'home_team'), ''), NULLIF(TRIM(matches->0->>'home_team_name'), '')) IS NOT NULL
          AND COALESCE(NULLIF(TRIM(away_team), ''), NULLIF(TRIM(matches->0->>'away_team'), ''), NULLIF(TRIM(matches->0->>'away_team_name'), '')) IS NOT NULL
          AND LOWER(COALESCE(NULLIF(TRIM(home_team), ''), NULLIF(TRIM(matches->0->>'home_team'), ''), NULLIF(TRIM(matches->0->>'home_team_name'), ''))) NOT IN ('unknown', 'unknown home', 'unknown away', 'home team', 'away team', 'tbd', 'n/a')
          AND LOWER(COALESCE(NULLIF(TRIM(away_team), ''), NULLIF(TRIM(matches->0->>'away_team'), ''), NULLIF(TRIM(matches->0->>'away_team_name'), ''))) NOT IN ('unknown', 'unknown home', 'unknown away', 'home team', 'away team', 'tbd', 'n/a')
          AND LOWER(COALESCE(NULLIF(TRIM(sport), ''), NULLIF(TRIM(matches->0->>'sport'), ''))) <> 'unknown'
    `, [match.id, match.home_team, match.away_team]);
    
    console.log('Found', predResult.rows.length, 'predictions');
    const latestCompletedRunRes = await client.query(`
        SELECT id
        FROM prediction_publish_runs
        WHERE status = 'completed'
        ORDER BY completed_at DESC NULLS LAST, id DESC
        LIMIT 1
    `);
    const defaultPublishRunId = latestCompletedRunRes.rows?.[0]?.id || null;
    
    for (const pred of predResult.rows) {
        const rec = pred.recommendation?.toLowerCase() || '';
        let result = 'VOID';
        const matches = parseMatches(pred.matches);
        const matchIndex = resolvePredictionMatchIndex(matches, match.id, match.home_team, match.away_team);
        const selectedLeg = matches[matchIndex] || matches[0] || {};
        
        // More comprehensive matching
        if (rec.includes('home') || rec === '1' || rec === 'home_win' || rec.includes('home win')) {
            result = match.home_score > match.away_score ? 'WON' : 'LOST';
        } else if (rec.includes('draw') || rec === 'x' || rec === 'draw') {
            result = match.home_score === match.away_score ? 'WON' : 'LOST';
        } else if (rec.includes('away') || rec === '2' || rec.includes('away_win') || rec.includes('away win')) {
            result = match.away_score > match.home_score ? 'WON' : 'LOST';
        } else {
            result = 'VOID';
        }
        
        console.log(`Pred ${pred.id}: ${pred.recommendation} -> ${result} (actual: ${match.home_score}-${match.away_score})`);
        
        // Get market from matches JSON
        let market = '1X2';
        let fixtureDate = null;
        if (selectedLeg.market) market = selectedLeg.market;
        if (selectedLeg.date || selectedLeg.match_date || selectedLeg.commence_time) {
            fixtureDate = selectedLeg.date || selectedLeg.match_date || selectedLeg.commence_time;
        }
        
        // Use match_date from prediction if available
        if (!fixtureDate && pred.match_date) {
            fixtureDate = pred.match_date;
        }
        fixtureDate = toSastDate(fixtureDate) || toSastDate(match.commence_time) || null;

        // Determine prediction type
        let predictionType = 'direct';
        if (pred.type) {
            const type = pred.type.toLowerCase();
            if (type === 'same_match') predictionType = 'same_match';
            else if (type === 'secondary') predictionType = 'secondary';
            else if (type === 'multi' || type === 'acca') predictionType = 'multi';
            else if (type.includes('acca')) predictionType = 'acca';
        }

        const confidence = pred.total_confidence || 50;
        const resolutionStatus = result === 'WON' ? 'won' : (result === 'LOST' ? 'lost' : 'void');
        const publishRunId = pred.publish_run_id || defaultPublishRunId;
        
        // Insert with all required fields
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
                evaluated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
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
                evaluated_at = EXCLUDED.evaluated_at
        `, [
            pred.id, 
            matchIndex, 
            match.id, 
            'football',
            pred.tier || 'normal',
            predictionType,
            publishRunId,
            pred.home_team || match.home_team,
            pred.away_team || match.away_team,
            fixtureDate,
            pred.recommendation, 
            `${match.home_score}-${match.away_score}`, 
            result === 'WON',
            match.home_score, 
            match.away_score, 
            match.status,
            resolutionStatus,
            market, 
            confidence,
            new Date().toISOString()
        ]);
        
        console.log('Inserted accuracy record!');
    }
    
    client.release();
    await pool.end();
    process.exit(0);
}

manualGrade();
