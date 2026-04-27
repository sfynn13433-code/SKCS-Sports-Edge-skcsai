'use strict';

require('dotenv').config({ path: 'backend/.env' });

const { createClient } = require('@supabase/supabase-js');
const {
    normalizeCricketFormat,
    evaluateCricketInsight
} = require('../backend/services/cricketRulesEngine');

// Publisher helper functions for cricket
function buildPublisherCricketSelection(rule, fixture) {
    const key = String(rule.market_key || rule.market || rule.rule_key || "").toLowerCase();

    const home = fixture.home_team || fixture.team1 || fixture.home || "Home";
    const away = fixture.away_team || fixture.team2 || fixture.away || "Away";

    if (key.includes("match_winner")) return home;
    if (key.includes("test_match_result")) return `${home} or Draw`;
    if (key.includes("double_chance")) return `${home} or ${away}`;
    if (key.includes("draw_no_bet")) return `${home} Draw No Bet`;
    if (key.includes("innings_total_runs")) return "Over innings runs line";
    if (key.includes("day_total_runs")) return "Over day runs line";
    if (key.includes("team_total_runs")) return `${home} team runs`;
    if (key.includes("first_innings")) return "Over first innings runs";
    if (key.includes("second_innings")) return "Over second innings runs";
    if (key.includes("match_total")) return "Over match runs line";
    if (key.includes("boundaries_over")) return "Over boundaries line";
    if (key.includes("boundaries_under")) return "Under boundaries line";
    if (key.includes("fours_over") || key.includes("total_fours")) return "Over fours line";
    if (key.includes("sixes_over") || key.includes("total_sixes")) return "Over sixes line";
    if (key.includes("match_total_wickets")) return "Over wickets line";
    if (key.includes("wicket_total")) return "Over wickets line";
    if (key.includes("session_runs")) return "Over session runs";
    if (key.includes("powerplay_runs")) return "Over powerplay runs";

    return "Cricket insight";
}

function buildPublisherCricketExplanation(rule, fixture, selection, confidence) {
    const marketName = rule.market_name || rule.market_label || rule.rule_name || rule.market || "Cricket Market";

    const home = fixture.home_team || fixture.team1 || fixture.home || "Home";
    const away = fixture.away_team || fixture.team2 || fixture.away || "Away";
    const league = fixture.league || fixture.series_name || fixture.competition || "Cricket";

    return `${marketName}: ${selection}. Confidence ${Math.round(confidence)}%. ${home} vs ${away} in ${league}.`;
}

function buildPublisherCricketMarketName(rule) {
    const key = String(rule.market_key || rule.market || rule.rule_key || "").toLowerCase();

    const labels = {
        cricket_match_winner: "Match Winner",
        test_match_result_1x2: "Test Match Result",
        test_double_chance: "Double Chance",
        test_draw_no_bet: "Draw No Bet",
        innings_total_runs: "Innings Total Runs",
        test_day_total_runs: "Day Total Runs",
        team_total_runs: "Team Total Runs",
        first_innings_runs: "First Innings Total",
        second_innings_runs: "Second Innings Total",
        match_total_runs: "Match Total Runs",
        wicket_total: "Total Wickets",
        session_runs: "Session Runs",
        powerplay_runs: "Powerplay Runs",
        top_batter: "Top Batter",
        top_bowler: "Top Bowler"
    };

    return labels[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Cricket Market";
}

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

            const resolvedGroup =
                rule?.market_group ||
                rule?.category ||
                rule?.group_key ||
                candidate.market_group;

            const resolvedLabel =
                rule?.market_name ||
                rule?.market_label ||
                rule?.rule_name ||
                candidate.market_label ||
                buildPublisherCricketMarketName(candidate);

            const resolvedConfidence = Number(
                candidate.confidence ??
                rule?.min_display_confidence ??
                0
            );

            return {
                ...candidate,
                market_group: resolvedGroup,
                market_label: resolvedLabel,
                confidence: resolvedConfidence,
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

function calculateCricketExpiry(fixtureRow) {
    const start = fixtureRow.start_time ? new Date(fixtureRow.start_time) : new Date();
    const status = String(fixtureRow.status || '').toLowerCase();
    const format = String(fixtureRow.match_format || '').toLowerCase();

    if (status.includes('complete') || status.includes('result')) {
        return new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    }

    if (format === 'test') {
        return new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString();
    }

    if (format === 'odi') {
        return new Date(start.getTime() + 36 * 60 * 60 * 1000).toISOString();
    }

    if (format === 't20') {
        return new Date(start.getTime() + 18 * 60 * 60 * 1000).toISOString();
    }

    return new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

async function upsertInsight(fixtureRow, market) {
    const selection = buildPublisherCricketSelection(market, fixtureRow);
    const explanation = buildPublisherCricketExplanation(market, fixtureRow, selection, market.confidence);

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

        selection,
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

        reasoning: explanation,
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

        expires_at: calculateCricketExpiry(fixtureRow)
    };

    // Manual replace because Supabase upsert cannot target the COALESCE expression index.
    let deleteQuery = supabase
        .from('cricket_insights_final')
        .delete()
        .eq('provider', insight.provider)
        .eq('provider_match_id', insight.provider_match_id)
        .eq('market_key', insight.market_key);

    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
        throw new Error(`Insight replace delete failed: ${deleteError.message}`);
    }

    const { data, error } = await supabase
        .from('cricket_insights_final')
        .insert(insight)
        .select('*')
        .single();

    if (error) {
        throw new Error(`Insight insert failed: ${error.message}`);
    }

    return data;
}

async function publishCricbuzzCricket(options = {}) {
    const startedAt = new Date().toISOString();
    console.log('=== PUBLISH CRICBUZZ CRICKET START ===');

    const rules = await loadRules();
    const raw = await fetchCricbuzzMatches();
    
    if (!raw) {
        console.log('No Cricbuzz data received');
        console.log('=== PUBLISH CRICBUZZ CRICKET END ===');
        return {
            ok: false,
            source: 'cricbuzz',
            fetched: 0,
            normalized: 0,
            fixtureUpserts: 0,
            insightUpserts: 0,
            skipped: 0,
            errors: ['No Cricbuzz data received'],
            startedAt,
            finishedAt: new Date().toISOString()
        };
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

    const finishedAt = new Date().toISOString();
    const summary = {
        ok: true,
        source: 'cricbuzz',
        fetched: matches.length,
        normalized,
        fixtureUpserts,
        insightUpserts,
        skipped,
        errors: errors.slice(0, 10),
        startedAt,
        finishedAt,
        trigger: options.trigger || 'manual'
    };

    console.log({
        CRICBUZZ_FETCHED: matches.length,
        NORMALIZED: normalized,
        FIXTURE_UPSERTS: fixtureUpserts,
        INSIGHT_UPSERTS: insightUpserts,
        SKIPPED: skipped,
        ERRORS: errors.slice(0, 10)
    });

    console.log('=== PUBLISH CRICBUZZ CRICKET END ===');
    return summary;
}

if (require.main === module) {
    publishCricbuzzCricket()
        .then((summary) => {
            console.log('=== PUBLISH CRICBUZZ CRICKET COMPLETE ===');
            console.log(JSON.stringify(summary, null, 2));
        })
        .catch((err) => {
            console.error('=== PUBLISH CRICBUZZ CRICKET FAILED ===');
            console.error(err);
            process.exit(1);
        });
}

module.exports = {
    publishCricbuzzCricket
};
