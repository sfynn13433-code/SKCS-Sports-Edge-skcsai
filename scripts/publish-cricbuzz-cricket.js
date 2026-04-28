'use strict';

require('dotenv').config({ path: 'backend/.env' });

const { createClient } = require('@supabase/supabase-js');
const {
    normalizeCricketFormat,
    evaluateCricketInsight
} = require('../backend/services/cricketRulesEngine');
const {
    enrichTopCricketMatches
} = require('../backend/services/cricketLiveEnrichmentService');
const {
    resolveMatchIds
} = require('../backend/services/cricketLiveMatchResolver');

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

function toNum(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function classifyConfidence(confidence) {
    const c = toNum(confidence, 0);
    if (c >= 80) return { band: 'high_confidence', risk: 'low', advisory: 'Direct market can be used as the primary angle with standard staking.' };
    if (c >= 70) return { band: 'moderate', risk: 'medium', advisory: 'Playable but keep stake disciplined and pair with one safer cover.' };
    if (c >= 59) return { band: 'high_risk', risk: 'high', advisory: 'High-risk direct angle; prioritize safer secondary markets.' };
    return { band: 'extreme_risk', risk: 'extreme', advisory: 'Extreme-risk direct angle; avoid direct exposure and use only safer alternatives.' };
}

function marketLogicNote(marketGroup, marketKey, selection) {
    const group = String(marketGroup || '').toLowerCase();
    const key = String(marketKey || '').toLowerCase();

    if (group === 'direct') {
        return `Outcome market bias is ${selection}; edge depends on base strength and match state variance.`;
    }
    if (group === 'direct_cover') {
        return `Cover market selected (${selection}) to reduce variance while keeping directional bias.`;
    }
    if (group === 'totals' || key.includes('total') || key.includes('runs')) {
        return `Totals angle (${selection}) is tied to expected run environment and innings pace.`;
    }
    if (group === 'wickets' || key.includes('wicket')) {
        return `Wickets line (${selection}) reflects expected bowling pressure and batting depth.`;
    }
    if (group === 'boundaries' || key.includes('four') || key.includes('six') || key.includes('boundar')) {
        return `Boundary projection (${selection}) tracks strike intent and venue scoring profile.`;
    }
    if (group === 'phase' || group === 'test_phase' || key.includes('powerplay') || key.includes('session') || key.includes('day_')) {
        return `Phase market (${selection}) targets tempo windows where variance is usually lower than full-match outcomes.`;
    }

    return `Market selection ${selection} is kept as a context-aware supplemental angle.`;
}

function buildSixStageCricketNarrative(rule, fixture, selection, confidence, sourceMatch) {
    const marketName = rule.market_name || rule.market_label || rule.rule_name || rule.market || "Cricket Market";
    const marketGroup = String(rule.market_group || '').trim().toLowerCase() || 'unknown';
    const marketKey = String(rule.market_key || rule.market || '').trim().toLowerCase();

    const home = fixture.home_team || fixture.team1 || fixture.home || "Home";
    const away = fixture.away_team || fixture.team2 || fixture.away || "Away";
    const league = fixture.league || fixture.series_name || fixture.competition || "Cricket";
    const format = String(fixture.match_format || 'unknown').toUpperCase();
    const status = String(fixture.status || 'scheduled');
    const kickoff = fixture.start_time ? new Date(fixture.start_time).toISOString() : 'TBD';

    const info = sourceMatch?.cricket_live_enrichment?.info || {};
    const weather = info?.weather?.weather_desc || info?.weather?.weather || null;
    const pitch = info?.pitch?.pitch_condition || null;
    const venue = fixture.venue || info?.venue?.name || 'venue pending';
    const weatherText = String(weather || '').toLowerCase();
    const rainLikely = ['rain', 'storm', 'thunder', 'shower', 'drizzle'].some((t) => weatherText.includes(t));
    const lineupHint = String(info?.pre_squad || '').toLowerCase() === 'true'
        ? 'Pre-squad available; final XI not confirmed.'
        : 'Lineups not confirmed yet; monitor toss and XI updates.';
    const injuryHint = info?.injury_report
        ? `Injury watch: ${String(info.injury_report)}.`
        : 'Injury/availability feed is limited; verify final XI and late scratches before stake placement.';

    const momentum = toNum(sourceMatch?.intelligence?.momentum, 50);
    const volatility = toNum(sourceMatch?.intelligence?.volatility, 50);
    const pressure = toNum(sourceMatch?.intelligence?.pressure, 50);
    const confidenceMeta = classifyConfidence(confidence);
    const logic = marketLogicNote(marketGroup, marketKey, selection);

    const stage1 = `S1 Baseline: EdgeMind BOT here. We have ${home} vs ${away} in ${league} (${format}), and the initial model confidence is ${Math.round(toNum(confidence, 0))}%.`;
    const stage2 = `S2 Match State: Kickoff is ${kickoff}, current status is ${status}, and venue is ${venue}.`;
    const stage3 = `S3 Team News: ${lineupHint} ${injuryHint}`;
    const stage4 = `S4 Conditions: ${weather ? `Current weather signal is "${weather}".` : 'Weather signal is currently limited.'} ${pitch ? `Pitch profile shows "${pitch}".` : 'Pitch profile is currently limited.'} ${rainLikely ? 'Rain/storm risk is present, so a D/L scenario can materially change run-rate and target logic.' : 'No strong rain/storm trigger detected right now, so D/L disruption risk is lower at this stage.'}`;
    const stage5 = `S5 Market Logic (${marketName}): ${logic} Metrics check: momentum ${Math.round(momentum)}, pressure ${Math.round(pressure)}, volatility ${Math.round(volatility)}.`;
    const stage6 = `S6 Final Call: Selection is ${selection}. Risk is ${confidenceMeta.risk}. ${confidenceMeta.advisory}`;

    return `${stage1} ${stage2} ${stage3} ${stage4} ${stage5} ${stage6}`;
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

async function upsertInsight(fixtureRow, market, sourceMatch = null) {
    const selection = buildPublisherCricketSelection(market, fixtureRow);
    const explanation = buildPublisherCricketExplanation(market, fixtureRow, selection, market.confidence);
    const sixStageNarrative = buildSixStageCricketNarrative(market, fixtureRow, selection, market.confidence, sourceMatch);

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

        reasoning: sixStageNarrative,
        edgemind_summary: `${explanation} ${sixStageNarrative}`,
        pipeline_data: {
            source: 'cricbuzz_primary',
            rule_result: market
        },
        metadata: {
            provider: 'cricbuzz',
            source: 'cricbuzz_primary',
            analysis_status: market.recommendation_status,
            six_stage_logic: true
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
    const dryRunPreview = process.env.CRICKET_ENRICH_DRY_RUN === '1';
    const cricbuzzFeed = String(options.feed || process.env.CRICKET_CRICBUZZ_FEED || 'upcoming').trim().toLowerCase();
    console.log(`[cricket-policy] source=cricbuzz feed=${cricbuzzFeed} (live feed disabled for prediction ingestion)`);

    const rules = await loadRules();
    const raw = await fetchCricbuzzMatches({ feed: cricbuzzFeed });
    
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
    let resolvedMatches = matches;
    try {
        resolvedMatches = await resolveMatchIds(matches);
    } catch (err) {
        console.log(`Cricket Live ID resolution skipped: ${err.message}`);
        resolvedMatches = matches;
    }

    let enrichedMatches = resolvedMatches;
    try {
        enrichedMatches = await enrichTopCricketMatches(resolvedMatches);
    } catch (err) {
        console.log(`Cricket Live enrichment skipped: ${err.message}`);
        enrichedMatches = resolvedMatches;
    }

    if (dryRunPreview) {
        const enrichedCount = enrichedMatches.filter((m) => Boolean(m?.cricket_live_enrichment?.enriched)).length;
        const resolvedCount = enrichedMatches.filter((m) => Boolean(m?.cricket_live_match_id)).length;
        const intelligenceCount = enrichedMatches.filter((m) => Boolean(m?.intelligence)).length;
        const fallbackIntelligenceCount = enrichedMatches.filter((m) => Boolean(m?.intelligence?.fallback)).length;
        const firstHasEnrichment = Boolean(enrichedMatches[0]?.cricket_live_enrichment?.enriched);
        const eleventhHasEnrichment = Boolean(enrichedMatches[10]?.cricket_live_enrichment?.enriched);
        const sampleEnriched = enrichedMatches.find((m) => Boolean(m?.cricket_live_enrichment?.enriched)) || null;
        const sampleForPreview = sampleEnriched || enrichedMatches[0] || null;
        console.log(
            JSON.stringify(
                {
                    dryRun: true,
                    totalMatches: enrichedMatches.length,
                    resolvedCount,
                    enrichedCount,
                    intelligenceCount,
                    fallbackIntelligenceCount,
                    firstHasEnrichment,
                    eleventhHasEnrichment
                },
                null,
                2
            )
        );
        console.log(JSON.stringify(sampleForPreview, null, 2));
        process.exit(0);
    }

    let normalized = 0;
    let fixtureUpserts = 0;
    let insightUpserts = 0;
    let skipped = 0;
    const errors = [];

    for (const match of enrichedMatches) {
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
                await upsertInsight(fixtureRow, market, match);
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
        resolved: enrichedMatches.filter((m) => Boolean(m?.cricket_live_match_id)).length,
        enriched: enrichedMatches.filter((m) => Boolean(m?.cricket_live_enrichment?.enriched)).length,
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
        RESOLVED_MATCH_IDS: enrichedMatches.filter((m) => Boolean(m?.cricket_live_match_id)).length,
        ENRICHED_MATCHES: enrichedMatches.filter((m) => Boolean(m?.cricket_live_enrichment?.enriched)).length,
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
