'use strict';

/**
 * Probe Soccer Data API for World Cup 2026 + summer-active leagues.
 * Skips ended European top flights. Default max 15 calls.
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
    resetCallStats
} = require('../backend/services/soccerDataApiClient');
const { hasUsableOdds, normalizeMatchesPayload } = require('../backend/providers/football/soccerDataApiNormalizer');

const HARD_CAP = Number(process.env.SOCCER_DATA_HARD_DAILY_CAP) || 75;
const MAX_CALLS = Math.min(Number(process.env.SOCCER_DATA_SUMMER_AUDIT_MAX_CALLS) || 15, HARD_CAP);

const SUMMER_TARGETS = [
    { label: 'Brazilian Série A', country: 'brazil', league_hints: ['serie a', 'brasileir', 'série a'] },
    { label: 'Chinese Super League', country: 'china', league_hints: ['super league', 'csl'] },
    { label: 'J1 League', country: 'japan', league_hints: ['j1 league', 'j.league', 'j1'] },
    { label: 'Russian Premier Liga', country: 'russia', league_hints: ['premier', 'premier liga', 'premier league'] },
    { label: 'Allsvenskan', country: 'sweden', league_hints: ['allsvenskan'] },
    { label: 'Eliteserien', country: 'norway', league_hints: ['eliteserien'] },
    { label: 'FIFA World Cup 2026', country: 'world', league_hints: ['world cup', 'fifa world cup'] },
    { label: 'FIFA World Cup 2026 (intl)', country: 'international', league_hints: ['world cup', 'fifa world cup'] },
    { label: 'FIFA World Cup 2026 (usa)', country: 'usa', league_hints: ['world cup', 'fifa world cup'] }
];

const WORLD_CUP_DATES = ['11/06/2026', '06/06/2026'];

function findCountryId(countries, name) {
    const needle = String(name || '').trim().toLowerCase();
    return (countries || []).find((c) => String(c.name || '').toLowerCase() === needle)?.id || null;
}

function pickLeague(leagues, hints = []) {
    const rows = Array.isArray(leagues) ? leagues : [];
    for (const hint of hints) {
        const h = String(hint).toLowerCase();
        const exact = rows.find((l) => String(l.name || '').toLowerCase() === h);
        if (exact) return exact;
        const partial = rows.find((l) => {
            const name = String(l.name || '').toLowerCase();
            return name.includes(h) && !l.is_cup;
        });
        if (partial) return partial;
    }
    return rows.find((l) => !l.is_cup) || rows[0] || null;
}

function summarizeMatches(data) {
    const items = normalizeMatchesPayload(data);
    const upcoming = items.filter((m) => m.status && !/finished/i.test(m.status));
    const sample = items[0] || null;
    return {
        total: items.length,
        upcoming: upcoming.length,
        sample: sample ? {
            match_id: sample.sda_match_id,
            home: sample.home_team,
            away: sample.away_team,
            date: sample.date,
            status: sample.status,
            has_odds: hasUsableOdds(sample)
        } : null
    };
}

async function main() {
    const report = {
        generated_at: new Date().toISOString(),
        provider: 'soccer_data_api',
        probe: 'world_cup_2026_and_summer_leagues',
        call_budget: { max_calls: MAX_CALLS, hard_daily_cap: HARD_CAP },
        world_cup_dates: {},
        summer_leagues: [],
        calls_used: 0
    };

    if (!isSoccerDataApiEnabled() || !getApiToken()) {
        console.log(JSON.stringify({ ...report, note: 'ENABLE_SOCCER_DATA_API + SOCCER_DATA_API_KEY required' }, null, 2));
        process.exit(0);
    }

    resetCallStats();
    const options = { maxCalls: MAX_CALLS };

    for (const date of WORLD_CUP_DATES) {
        if (getCallStats().total >= MAX_CALLS) break;
        const res = await listMatches({ date }, options);
        const summary = summarizeMatches(res.data);
        const mexPar = itemsFindMexicoParaguay(res.data);
        report.world_cup_dates[date] = {
            ok: res.ok,
            detail: res.detail,
            ...summary,
            mexico_paraguay_found: mexPar
        };
    }

    const countriesRes = await listCountries(options);
    const countries = countriesRes.data?.results || [];

    const seenLeagueIds = new Set();

    for (const target of SUMMER_TARGETS) {
        if (getCallStats().total >= MAX_CALLS) {
            report.summer_leagues.push({ ...target, skipped: true, reason: 'call_budget' });
            continue;
        }

        const countryId = findCountryId(countries, target.country);
        if (!countryId) {
            report.summer_leagues.push({ ...target, mapped: false, reason: 'country_not_found' });
            continue;
        }

        const leaguesRes = await listLeagues({ country_id: countryId }, options);
        const leagues = leaguesRes.data?.results || [];
        const picked = pickLeague(leagues, target.league_hints);

        const row = {
            label: target.label,
            country: target.country,
            country_id: countryId,
            sda_league_id: picked?.id || null,
            sda_league_name: picked?.name || null,
            league_count: leagues.length,
            mapped: Boolean(picked?.id)
        };

        if (picked?.id && !seenLeagueIds.has(picked.id) && getCallStats().total < MAX_CALLS) {
            seenLeagueIds.add(picked.id);
            const matchesRes = await listMatches({ league_id: picked.id }, options);
            Object.assign(row, {
                matches_ok: matchesRes.ok,
                matches_detail: matchesRes.detail,
                ...summarizeMatches(matchesRes.data)
            });

            if (row.sample?.match_id && getCallStats().total < MAX_CALLS) {
                const detail = await getMatch(row.sample.match_id, options);
                const odds = detail.data?.odds?.match_winner || {};
                row.match_detail_ok = detail.ok;
                row.match_detail_detail = detail.detail;
                row.match_winner_odds = {
                    home: odds.home ?? null,
                    draw: odds.draw ?? null,
                    away: odds.away ?? null
                };
            }
        } else if (picked?.id && seenLeagueIds.has(picked.id)) {
            row.note = 'league_already_probed';
        }

        report.summer_leagues.push(row);
    }

    report.calls_used = getCallStats().total;
    report.calls_remaining_free_tier = Math.max(0, HARD_CAP - report.calls_used);
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.calls_used <= MAX_CALLS ? 0 : 1);
}

function itemsFindMexicoParaguay(data) {
    const items = normalizeMatchesPayload(data);
    return items.some((m) => {
        const home = String(m.home_team || '').toLowerCase();
        const away = String(m.away_team || '').toLowerCase();
        const teams = [home, away];
        const hasMexico = teams.some((t) => t.includes('mexico'));
        const hasParaguay = teams.some((t) => t.includes('paraguay'));
        return hasMexico && hasParaguay;
    });
}

main().catch((error) => {
    console.error('[audit-soccerdata-summer-coverage] failed:', error.message);
    process.exit(1);
});
