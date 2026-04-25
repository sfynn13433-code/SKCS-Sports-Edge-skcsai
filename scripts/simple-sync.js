'use strict';

/**
 * SIMPLE SYNC - Direct insert with NO validation
 * Pulls ALL fixtures and inserts directly into predictions_final
 */

// dotenv loaded by parent
const axios = require('axios');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const APISPORTS_KEY = process.env.X_APISPORTS_KEY;

if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function fetchAllFixtures() {
    const today = new Date();
    const dates = [];
    
    // Fetch for today + next 7 days
    for (let i = 0; i <= 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
    }
    
    const allFixtures = [];
    
    for (const date of dates) {
        try {
            const url = `https://v3.football.api-sports.io/fixtures?date=${date}`;
            const response = await axios.get(url, {
                headers: { 'x-apisports-key': APISPORTS_KEY },
                timeout: 30000
            });
            
            const fixtures = response.data?.response || [];
            console.log(`[${date}] Got ${fixtures.length} fixtures`);
            
            for (const f of fixtures) {
                const fixture = {
                    match_id: f.fixture?.id,
                    league: f.league?.name,
                    league_id: f.league?.id,
                    home_team: f.teams?.home?.name,
                    away_team: f.teams?.away?.name,
                    home_score: f.score?.fulltime?.home,
                    away_score: f.score?.fulltime?.away,
                    date: f.fixture?.date,
                    venue: f.fixture?.venue?.name,
                    status: f.fixture?.status?.short
                };
                allFixtures.push(fixture);
            }
        } catch (err) {
            console.error(`[${date}] Error:`, err.message);
        }
    }
    
    return allFixtures;
}

async function insertDirect(fixtures) {
    const client = await pool.connect();
    let inserted = 0;
    let publishRunId = null;
    
    try {
        await client.query('BEGIN');

        const runRes = await client.query(`
            INSERT INTO prediction_publish_runs (
                trigger_source,
                requested_sports,
                run_scope,
                status,
                notes,
                metadata
            )
            VALUES ('manual_sync_simple', ARRAY['football']::text[], 'football_simple', 'running', 'simple-sync direct insert', $1::jsonb)
            RETURNING id
        `, [JSON.stringify({ started_at: new Date().toISOString() })]);
        publishRunId = runRes.rows?.[0]?.id || null;
        
        for (const f of fixtures) {
            if (!f.home_team || !f.away_team) continue;
            const fixtureId = String(f.match_id || '').trim();
            if (!fixtureId) continue;
            const kickoff = f.date ? new Date(f.date).toISOString() : null;
            
            // Proper JSON escaping
            const matchesJson = JSON.stringify([{
                fixture_id: fixtureId,
                home_team: String(f.home_team || ''),
                away_team: String(f.away_team || ''),
                league: String(f.league || ''),
                date: kickoff,
                match_date: kickoff,
                commence_time: kickoff,
                venue: String(f.venue || ''),
                status: String(f.status || '')
            }]);
            
            // Direct insert - no validation!
            await client.query(`
                INSERT INTO direct1x2_prediction_final (
                    publish_run_id, tier, type, matches, total_confidence, risk_level, 
                    sport, market_type, recommendation, fixture_id, home_team, away_team,
                    prediction, confidence, match_date, created_at
                ) VALUES (
                    $1, 'normal', 'direct', $2::jsonb, 65, 'medium',
                    'football', '1X2', $3, $4, $5, $6, 'home_win', 65, $7::timestamptz, NOW()
                )
                ON CONFLICT DO NOTHING
            `, [
                publishRunId,
                matchesJson,
                `${f.home_team} vs ${f.away_team}`,
                fixtureId,
                String(f.home_team || ''),
                String(f.away_team || ''),
                kickoff
            ]);
            
            inserted++;
            if (inserted % 50 === 0) {
                console.log(`[INSERT] ${inserted}...`);
            }
        }

        await client.query(`
            UPDATE prediction_publish_runs
            SET status = 'completed',
                completed_at = NOW(),
                metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
            WHERE id = $1
        `, [
            publishRunId,
            JSON.stringify({ inserted, finished_at: new Date().toISOString() })
        ]);
        
        await client.query('COMMIT');
        console.log(`[INSERT] ${inserted} predictions inserted`);
        return inserted;
        
    } catch (err) {
        await client.query('ROLLBACK');
        if (publishRunId) {
            try {
                await client.query(`
                    UPDATE prediction_publish_runs
                    SET status = 'failed',
                        completed_at = NOW(),
                        error_message = $2
                    WHERE id = $1
                `, [publishRunId, err.message]);
            } catch (_ignore) {}
        }
        throw err;
    } finally {
        client.release();
    }
}

async function main() {
    console.log('=== SIMPLE SYNC (No Validation) ===');
    console.log('API Key:', APISPORTS_KEY ? '✓ Set' : '✗ Missing');
    console.log('');
    
    const fixtures = await fetchAllFixtures();
    console.log(`[TOTAL] ${fixtures.length} fixtures fetched`);
    
    if (fixtures.length > 0) {
        await insertDirect(fixtures);
    }
    
    await pool.end();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
