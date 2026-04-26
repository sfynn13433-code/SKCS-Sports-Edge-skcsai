'use strict';

require('dotenv').config({ path: 'backend/.env' });

const { createClient } = require('@supabase/supabase-js');
const {
    normalizeCricketFormat,
    evaluateCricketInsight
} = require('../backend/services/cricketRulesEngine');

const { fetchCricbuzzMatches, normalizeCricbuzzData } = require('../backend/services/cricbuzzService');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

function safeText(value) {
    return String(value || '').trim();
}

function normalizeCricbuzzMatch(match) {
    const info = match?.matchInfo || match?.match_info || match || {};

    const providerMatchId = safeText(
        info.matchId ||
        info.match_id ||
        match.matchId ||
        match.id
    );

    const team1 =
        info.team1?.teamName ||
        info.team1?.name ||
        info.team1Name ||
        info.home_team ||
        info.team1 ||
        '';

    const team2 =
        info.team2?.teamName ||
        info.team2?.name ||
        info.team2Name ||
        info.away_team ||
        info.team2 ||
        '';

    const rawFormat =
        info.matchFormat ||
        info.match_format ||
        info.format ||
        '';

    const startRaw =
        info.startDate ||
        info.start_time ||
        info.matchDate ||
        info.match_date ||
        null;

    const startTime = startRaw
        ? new Date(Number(startRaw) || startRaw).toISOString()
        : null;

    return {
        provider: 'cricbuzz',
        provider_match_id: providerMatchId,
        sport: 'cricket',
        match_format: normalizeCricketFormat(rawFormat),
        competition: safeText(info.seriesName || info.competition || info.league || info.tournament),
        home_team: safeText(team1),
        away_team: safeText(team2),
        venue: safeText(info.venueInfo?.ground || info.venue || ''),
        country: safeText(info.venueInfo?.city || info.country || ''),
        start_time: startTime,
        status: safeText(info.state || info.status || ''),
        raw_status: safeText(info.status || info.state || ''),
        raw_payload: match
    };
}

async function loadRules() {
    const { data, error } = await supabase
        .from('cricket_market_rules')
        .select('*');

    if (error) throw new Error(`Failed to load cricket rules: ${error.message}`);

    const map = new Map();
    for (const rule of data || []) {
        map.set(rule.market_key, rule);
    }
    return map;
}

function buildStarterMarketsForFixture(fixture, rules) {
    const format = normalizeCricketFormat(fixture.match_format);

    const candidates = [];

    if (format === 't20') {
        candidates.push(
            { market_key: 'cricket_match_winner', market_group: 'direct', market_label: 'Match Winner', confidence: 50 },
            { market_key: 'innings_total_runs', market_group: 'totals', market_label: 'Innings Total Runs', confidence: 62 },
            { market_key: 'team_total_runs', market_group: 'totals', market_label: 'Team Total Runs', confidence: 63 },
            { market_key: 'powerplay_runs', market_group: 'phase', market_label: 'Powerplay Runs', confidence: 65 },
            { market_key: 'total_sixes', market_group: 'boundaries', market_label: 'Total Sixes', confidence: 65 }
        );
    } else if (format === 'odi') {
        candidates.push(
            { market_key: 'cricket_match_winner', market_group: 'direct', market_label: 'Match Winner', confidence: 50 },
            { market_key: 'innings_total_runs', market_group: 'totals', market_label: 'Innings Total Runs', confidence: 62 },
            { market_key: 'team_total_runs', market_group: 'totals', market_label: 'Team Total Runs', confidence: 63 },
            { market_key: 'first_10_overs_runs', market_group: 'phase', market_label: 'First 10 Overs Runs', confidence: 64 },
            { market_key: 'match_total_wickets', market_group: 'wickets', market_label: 'Match Total Wickets', confidence: 64 }
        );
    } else if (format === 'test') {
        candidates.push(
            { market_key: 'test_match_result_1x2', market_group: 'direct', market_label: 'Test Match Result', confidence: 50 },
            { market_key: 'test_draw_no_bet', market_group: 'direct_cover', market_label: 'Draw No Bet', confidence: 60 },
            { market_key: 'test_double_chance', market_group: 'direct_cover', market_label: 'Double Chance', confidence: 60 },
            { market_key: 'innings_total_runs', market_group: 'totals', market_label: 'Innings Total Runs', confidence: 62 },
            { market_key: 'test_day_total_runs', market_group: 'test_phase', market_label: 'Day Total Runs', confidence: 64 }
        );
    } else {
        candidates.push(
            { market_key: 'cricket_match_winner', market_group: 'direct', market_label: 'Match Winner', confidence: 50 }
        );
    }

    return candidates
        .map((candidate) => {
            const rule = rules.get(candidate.market_key);
            const evaluation = evaluateCricketInsight({
                marketKey: candidate.market_key,
                matchFormat: format,
                confidence: candidate.confidence,
                rule,
                context: {
                    confirmedLineup: false,
                    tossKnown: false,
                    highVolatility: false
                }
            });

            return {
                ...candidate,
                ...evaluation
            };
        })
        .filter((item) => item.allowed);
}

async function upsertFixture(fixture) {
    const { data, error } = await supabase
        .from('cricket_fixtures')
        .upsert(fixture, { onConflict: 'provider,provider_match_id' })
        .select('*')
        .single();

    if (error) throw new Error(`Fixture upsert failed: ${error.message}`);
    return data;
}

async function upsertInsight(fixtureRow, market) {
    const insight = {
        fixture_id: fixtureRow.id,
        provider: fixtureRow.provider,
        provider_match_id: fixtureRow.provider_match_id,
        sport: 'cricket',
        match_format: fixtureRow.match_format,
        competition: fixtureRow.competition,
        home_team: fixtureRow.home_team,
        away_team: fixtureRow.away_team,
        venue: fixtureRow.venue,
        start_time: fixtureRow.start_time,
        status: fixtureRow.status,

        market_group: market.market_group,
        market_key: market.market_key,
        market_label: market.market_label,

        selection: null,
        line: null,
        over_under: null,
        confidence: market.confidence,

        confidence_band: market.confidence_band,
        risk_tier: market.risk_tier,
        recommendation_status: market.recommendation_status,

        tier: 'normal',
        plan_visibility: ['core', 'elite', 'vip'],

        acca_eligible: market.acca_eligible,
        acca_reason: market.reason,

        reasoning: market.reason,
        edgemind_summary: `Cricket ${market.market_label} market prepared for ${fixtureRow.home_team} vs ${fixtureRow.away_team}. Full analysis pending context, lineup, venue, and format checks.`,
        pipeline_data: {
            source: 'cricbuzz_primary',
            rule_result: market
        },
        metadata: {
            provider: 'cricbuzz',
            source: 'cricbuzz_primary',
            analysis_status: market.recommendation_status
        },

        expires_at: fixtureRow.start_time
            ? new Date(new Date(fixtureRow.start_time).getTime() + 24 * 60 * 60 * 1000).toISOString()
            : null
    };

    const { data, error } = await supabase
        .from('cricket_insights_final')
        .upsert(insight, {
            onConflict: 'provider,provider_match_id,market_key,selection,line,over_under'
        })
        .select('*')
        .single();

    if (error) throw new Error(`Insight upsert failed: ${error.message}`);
    return data;
}

(async () => {
    console.log('=== PUBLISH CRICBUZZ CRICKET START ===');

    const rules = await loadRules();
    const raw = await fetchCricbuzzMatches();
    
    if (!raw) {
        console.log('No Cricbuzz data received');
        console.log('=== PUBLISH CRICBUZZ CRICKET END ===');
        return;
    }
    
    const matches = normalizeCricbuzzData(raw);

    let normalized = 0;
    let fixtureUpserts = 0;
    let insightUpserts = 0;
    let skipped = 0;
    const errors = [];

    for (const match of matches) {
        try {
            const fixture = normalizeCricbuzzMatch(match);

            if (!fixture.provider_match_id || !fixture.home_team || !fixture.away_team) {
                skipped++;
                continue;
            }

            normalized++;

            const fixtureRow = await upsertFixture(fixture);
            fixtureUpserts++;

            const markets = buildStarterMarketsForFixture(fixtureRow, rules);

            for (const market of markets) {
                await upsertInsight(fixtureRow, market);
                insightUpserts++;
            }
        } catch (err) {
            errors.push(err.message);
        }
    }

    console.log({
        CRICBUZZ_FETCHED: matches.length,
        NORMALIZED: normalized,
        FIXTURE_UPSERTS: fixtureUpserts,
        INSIGHT_UPSERTS: insightUpserts,
        SKIPPED: skipped,
        ERRORS: errors.slice(0, 10)
    });

    console.log('=== PUBLISH CRICBUZZ CRICKET END ===');
})();