'use strict';

require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
    throw new Error('Missing SUPABASE_URL in environment');
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        persistSession: false
    }
});

const SPORTSRC_BASE = 'https://api.sportsrc.org/';
const SUPPORTED_SPORTS = [
    'football',
    'basketball',
    'baseball',
    'ufc'
];

function safeString(value, fallback = null) {
    if (value === undefined || value === null) return fallback;
    const text = String(value).trim();
    return text.length ? text : fallback;
}

function pickFirst(match, keys, fallback = null) {
    for (const key of keys) {
        const value = match?.[key];
        if (value === undefined || value === null) continue;
        if (String(value).trim() === '') continue;
        return value;
    }
    return fallback;
}

function normalizeTimestamp(match) {
    const rawTime = pickFirst(match, [
        'timestamp',
        'time',
        'start_time',
        'kickoff',
        'date',
        'datetime'
    ]);
    if (!rawTime) return null;

    if (typeof rawTime === 'number') {
        const milliseconds = rawTime > 9999999999 ? rawTime : rawTime * 1000;
        const date = new Date(milliseconds);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    if (/^\d+$/.test(String(rawTime))) {
        const numeric = Number(rawTime);
        const milliseconds = numeric > 9999999999 ? numeric : numeric * 1000;
        const date = new Date(milliseconds);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    const date = new Date(rawTime);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeSportSRCMatch(match, sport) {
    const provider = 'sportsrc';
    const providerFixtureId = safeString(
        pickFirst(match, ['id', 'match_id', 'fixture_id', 'event_id'])
    );
    if (!providerFixtureId) {
        return {
            fixture: null,
            reason: 'missing provider fixture id'
        };
    }

    const homeTeam = safeString(
        pickFirst(match, [
            'home_team_name',
            'home_team',
            'home',
            'team_home',
            'homeName'
        ])
    );
    const awayTeam = safeString(
        pickFirst(match, [
            'away_team_name',
            'away_team',
            'away',
            'team_away',
            'awayName'
        ])
    );
    if (!homeTeam || !awayTeam) {
        return {
            fixture: null,
            reason: 'missing home or away team'
        };
    }

    const kickoffTime = normalizeTimestamp(match);
    const fixtureKey = `${provider}:${sport}:${providerFixtureId}`;

    return {
        fixture: {
            provider,
            provider_fixture_id: providerFixtureId,
            fixture_key: fixtureKey,
            sport,
            league: safeString(
                pickFirst(match, ['league_name', 'league', 'competition', 'competition_name']),
                'General'
            ),
            competition_id: safeString(pickFirst(match, ['competition_id', 'league_id'])),
            season: safeString(pickFirst(match, ['season'])),
            round: safeString(pickFirst(match, ['round'])),
            home_team: homeTeam,
            away_team: awayTeam,
            home_team_id: safeString(pickFirst(match, ['home_id', 'home_team_id'])),
            away_team_id: safeString(pickFirst(match, ['away_id', 'away_team_id'])),
            kickoff_time: kickoffTime,
            status: safeString(pickFirst(match, ['status', 'match_status']), 'upcoming'),
            venue: safeString(pickFirst(match, ['venue', 'stadium']), 'TBD'),
            country: safeString(pickFirst(match, ['country', 'country_name']), 'Unknown'),
            source_quality: 'fixture_only',
            raw_payload: match,
            updated_at: new Date().toISOString()
        },
        reason: null
    };
}

function normalizeSportSRCResponse(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.matches)) return payload.matches;
    if (Array.isArray(payload?.events)) return payload.events;
    if (Array.isArray(payload?.response)) return payload.response;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
}

function buildContextRows(fixtures) {
    const nowIso = new Date().toISOString();
    return fixtures.map((fixture) => ({
        fixture_key: fixture.fixture_key,
        provider: fixture.provider,
        provider_fixture_id: fixture.provider_fixture_id,
        sport: fixture.sport,
        context_quality_score: 10,
        volatility_score: 0,
        data_gaps: [
            'standings',
            'recent_form',
            'h2h',
            'odds',
            'injuries',
            'lineups',
            'weather',
            'news'
        ],
        updated_at: nowIso
    }));
}

async function fetchSportSRCMatches(sport) {
    const url = `${SPORTSRC_BASE}?data=matches&category=${encodeURIComponent(sport)}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: { accept: 'application/json' }
    });

    if (!response.ok) {
        throw new Error(`SportSRC HTTP ${response.status} for ${sport}`);
    }

    const payload = await response.json();
    return normalizeSportSRCResponse(payload);
}

async function upsertFixtures(fixtures) {
    if (!fixtures.length) return { count: 0 };

    const { error } = await supabase
        .from('raw_fixtures')
        .upsert(fixtures, {
            onConflict: 'provider,provider_fixture_id,sport'
        });

    if (error) throw error;
    return { count: fixtures.length };
}

async function upsertContextRows(fixtures) {
    if (!fixtures.length) return { count: 0 };
    const contextRows = buildContextRows(fixtures);

    const { error } = await supabase
        .from('match_context_data')
        .upsert(contextRows, {
            onConflict: 'fixture_key'
        });

    if (error) throw error;
    return { count: contextRows.length };
}

async function syncSport(sport) {
    console.log(`\n--- Syncing SportSRC ${sport} ---`);
    const rawMatches = await fetchSportSRCMatches(sport);
    const normalized = [];
    const rejected = [];

    for (const match of rawMatches) {
        const result = normalizeSportSRCMatch(match, sport);
        if (result.fixture) {
            normalized.push(result.fixture);
        } else {
            rejected.push({
                reason: result.reason,
                sample: match
            });
        }
    }

    await upsertFixtures(normalized);
    await upsertContextRows(normalized);

    console.log(`✅ ${sport}: raw=${rawMatches.length}, accepted=${normalized.length}, rejected=${rejected.length}`);
    if (rejected.length) {
        console.log(`⚠️ ${sport}: rejected samples:`);
        console.log(JSON.stringify(rejected.slice(0, 3), null, 2));
    }

    return {
        sport,
        raw: rawMatches.length,
        accepted: normalized.length,
        rejected: rejected.length
    };
}

async function syncSportSRC() {
    console.log('=== SKCS SportSRC Fixture Sync Started ===');
    const results = [];

    for (const sport of SUPPORTED_SPORTS) {
        try {
            const result = await syncSport(sport);
            results.push(result);
        } catch (error) {
            console.error(`❌ ${sport} failed:`, error.message);
            results.push({
                sport,
                error: error.message
            });
        }
    }

    console.log('\n=== SKCS SportSRC Fixture Sync Summary ===');
    console.table(results);
    return results;
}

syncSportSRC()
    .then(() => {
        console.log('✅ SportSRC sync complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ SportSRC sync failed:', error);
        process.exit(1);
    });
