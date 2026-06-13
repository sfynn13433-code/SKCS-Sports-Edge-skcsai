'use strict';

/**
 * Soccer Data API discovery audit — read-only, strict call budget.
 * Default max 12 calls; hard stop at 75/day free tier.
 * Does NOT probe /matches/ for ended European top leagues (May–Aug).
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const {
    getApiToken,
    getCallStats,
    getMatch,
    isSoccerDataApiEnabled,
    listCountries,
    listLeagues,
    listMatches,
    listStandings,
    resetCallStats
} = require('../backend/services/soccerDataApiClient');
const {
    hasUsableOdds,
    normalizeMatchesPayload,
    passesSkcsFixtureGate
} = require('../backend/providers/football/soccerDataApiNormalizer');
const {
    TIER1_COUNTRY_HINTS,
    resolveFixtureProbeLeague,
    resolveSoccerDataLeague
} = require('../backend/config/soccerDataLeagueMap');

const HARD_CAP = Number(process.env.SOCCER_DATA_HARD_DAILY_CAP) || 75;
const MAX_CALLS = Math.min(Number(process.env.SOCCER_DATA_AUDIT_MAX_CALLS) || 12, HARD_CAP);

function findCountryId(countries, name) {
    const needle = String(name || '').trim().toLowerCase();
    const row = (countries || []).find((c) => String(c.name || '').toLowerCase() === needle);
    return row?.id || null;
}

function pickLeagueForCompetition(leagues, competition) {
    const needle = String(competition || '').trim().toLowerCase();
    const exact = (leagues || []).find((l) => String(l.name || '').toLowerCase() === needle);
    if (exact) return exact;
    return (leagues || []).find((l) => {
        const name = String(l.name || '').toLowerCase();
        return name.includes(needle) && !l.is_cup;
    }) || null;
}

async function main() {
    const fixtureProbe = resolveFixtureProbeLeague();
    const epl = resolveSoccerDataLeague('4328');

    const report = {
        generated_at: new Date().toISOString(),
        provider: 'soccer_data_api',
        call_budget: { max_calls: MAX_CALLS, hard_daily_cap: HARD_CAP },
        off_season_policy: {
            european_fixture_probes: 'skipped',
            reason: 'Top European leagues ended — use standings/league mapping only',
            fixture_probe_league: fixtureProbe
        },
        restrictions: {
            free_tier_daily_requests: 75,
            paid_tiers: {
                basic_14_usd: '15 leagues, higher daily quota',
                plus_29_usd: '50 leagues',
                pro_79_usd: '125+ leagues, 500k/day'
            },
            per_request: 'Every endpoint counts as 1 request toward daily quota',
            gzip_header: 'Accept-Encoding: gzip required on all calls',
            throttle: 'HTTP 200 with detail throttled message; retry after ~60s',
            invalid_token: 'May return HTTP 200 with {"detail":"Invalid token."}',
            pagination: 'country/ and league/ use results[] with count/next/previous',
            skcs_blocked: ['match-preview', 'match-previews-upcoming']
        },
        config: {
            enable_flag: isSoccerDataApiEnabled(),
            api_key_configured: Boolean(getApiToken())
        },
        tier1_mapping: [],
        probes: {},
        calls_used: 0
    };

    if (!isSoccerDataApiEnabled() || !getApiToken()) {
        console.log(JSON.stringify({
            ...report,
            note: 'Set ENABLE_SOCCER_DATA_API=true and SOCCER_DATA_API_KEY to run audit'
        }, null, 2));
        process.exit(0);
    }

    resetCallStats();
    const options = { maxCalls: MAX_CALLS };

    const countriesRes = await listCountries(options);
    report.probes.countries = {
        ok: countriesRes.ok,
        status: countriesRes.status,
        detail: countriesRes.detail,
        count: countriesRes.data?.count,
        latency_ms: countriesRes.latency_ms,
        rate: countriesRes.rate
    };

    const countries = countriesRes.data?.results || [];

    const summerMatches = await listMatches({ league_id: fixtureProbe.sda_league_id }, options);
    const summerItems = normalizeMatchesPayload(summerMatches.data);
    const summerSample = summerItems.find((row) => passesSkcsFixtureGate(row)) || summerItems[0] || null;

    report.probes.summer_league_matches = {
        ok: summerMatches.ok,
        status: summerMatches.status,
        detail: summerMatches.detail,
        league_id: fixtureProbe.sda_league_id,
        competition: fixtureProbe.competition,
        fixture_count: summerItems.length,
        sample: summerSample ? {
            match_id: summerSample.sda_match_id,
            home_team: summerSample.home_team,
            away_team: summerSample.away_team,
            date: summerSample.date,
            has_odds: hasUsableOdds(summerSample)
        } : null,
        latency_ms: summerMatches.latency_ms,
        rate: summerMatches.rate
    };

    if (summerSample?.sda_match_id && getCallStats().total < MAX_CALLS) {
        const detail = await getMatch(summerSample.sda_match_id, options);
        const odds = detail.data?.odds?.match_winner || {};
        report.probes.summer_match_detail = {
            ok: detail.ok,
            status: detail.status,
            detail: detail.detail,
            has_match_winner_odds: [odds.home, odds.draw, odds.away].some((v) => Number(v) > 1),
            latency_ms: detail.latency_ms,
            rate: detail.rate
        };
    }

    if (getCallStats().total < MAX_CALLS) {
        const standing = await listStandings(epl?.sda_league_id || 228, options);
        const rows = Array.isArray(standing.data?.stage)
            ? standing.data.stage.flatMap((s) => s.standings || [])
            : [];
        report.probes.epl_standings_metadata = {
            ok: standing.ok,
            status: standing.status,
            detail: standing.detail,
            team_count: rows.length,
            season: standing.data?.season,
            note: 'final table metadata — no fixture probe',
            latency_ms: standing.latency_ms,
            rate: standing.rate
        };
    }

    for (const hint of TIER1_COUNTRY_HINTS) {
        if (getCallStats().total >= MAX_CALLS) break;

        const countryId = findCountryId(countries, hint.country_name);
        if (!countryId) {
            report.tier1_mapping.push({
                skcs_league_id: hint.skcs_league_id,
                competition: hint.competition,
                country: hint.country_name,
                mapped: false,
                reason: 'country_not_found'
            });
            continue;
        }

        const leaguesRes = await listLeagues({ country_id: countryId }, options);
        const leagues = leaguesRes.data?.results || [];
        const picked = pickLeagueForCompetition(leagues, hint.competition);

        report.tier1_mapping.push({
            skcs_league_id: hint.skcs_league_id,
            competition: hint.competition,
            country: hint.country_name,
            country_id: countryId,
            sda_league_id: picked?.id || null,
            sda_league_name: picked?.name || null,
            mapped: Boolean(picked?.id),
            league_count_in_country: leagues.length,
            fixture_probe: false
        });
    }

    const stats = getCallStats();
    report.calls_used = stats.total;
    report.calls_remaining_budget = Math.max(0, MAX_CALLS - stats.total);
    report.calls_remaining_free_tier = Math.max(0, HARD_CAP - stats.total);
    report.rate_hints = stats.lastHeaders;
    report.last_detail = stats.lastDetail;

    console.log(JSON.stringify(report, null, 2));
    process.exit(stats.total <= MAX_CALLS ? 0 : 1);
}

main().catch((error) => {
    console.error('[audit-soccerdata-discovery] failed:', error.message);
    process.exit(1);
});
