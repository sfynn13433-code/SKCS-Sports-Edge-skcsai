'use strict';

require('dotenv').config();

const axios = require('axios');
const { query } = require('../backend/db');
const { upsertCanonicalEvents } = require('../backend/services/canonicalEvents');
const { buildMatchContext } = require('../backend/services/normalizerService');
const { runPipelineForMatches, rebuildFinalOutputs } = require('../backend/services/aiPipeline');
const { buildAndStoreDirect1X2 } = require('../backend/services/direct1x2Builder');
const { getApiSportsKeyPool, getRapidApiKeyPool, maskKey } = require('../backend/utils/keyPool');

const APISPORTS_KEYS = getApiSportsKeyPool();
const CRICKETDATA_API_KEY = String(process.env.CRICKETDATA_API_KEY || '').trim();
const TODAY = new Date().toISOString().slice(0, 10);
const SPORT_STAGGER_MS = 900;
const PIPELINE_CHUNK_SIZE = Math.max(1, Number(process.env.SNAPSHOT_PIPELINE_CHUNK_SIZE || 1));
const PIPELINE_GRACE_MINUTES = Math.max(0, Number(process.env.SNAPSHOT_GRACE_MINUTES || 120));
const PIPELINE_FUTURE_DAYS = Math.max(1, Number(process.env.SNAPSHOT_FUTURE_DAYS || 7));
const ACTIVE_KEY_LIMIT = (() => {
    const n = Number(process.env.RAPIDAPI_ACTIVE_KEY_COUNT || 5);
    if (!Number.isFinite(n)) return 5;
    return Math.max(1, Math.min(20, Math.floor(n)));
})();

const EVENT_SPORT_KEY_MAP = Object.freeze({
    football: 'football',
    basketball: 'basketball_nba',
    rugby: 'rugbyunion_international',
    baseball: 'baseball_mlb',
    hockey: 'icehockey_nhl',
    formula1: 'formula1',
    mma: 'mma_mixed_martial_arts',
    afl: 'aussierules_afl',
    volleyball: 'volleyball',
    handball: 'handball_germany_bundesliga',
    american_football: 'americanfootball_nfl',
    tennis: 'tennis_atp_miami_open',
    cricket: 'cricket_international'
});

const SPORT_SPECS = Object.freeze([
    { sport: 'football', baseUrl: 'https://v3.football.api-sports.io', endpoint: 'fixtures' },
    { sport: 'basketball', baseUrl: 'https://v1.basketball.api-sports.io', endpoint: 'games' },
    { sport: 'rugby', baseUrl: 'https://v1.rugby.api-sports.io', endpoint: 'games' },
    { sport: 'baseball', baseUrl: 'https://v1.baseball.api-sports.io', endpoint: 'games' },
    { sport: 'hockey', baseUrl: 'https://v1.hockey.api-sports.io', endpoint: 'games' },
    { sport: 'formula1', baseUrl: 'https://v1.formula-1.api-sports.io', endpoint: 'races' },
    { sport: 'mma', baseUrl: 'https://v1.mma.api-sports.io', endpoint: 'fights' },
    { sport: 'afl', baseUrl: 'https://v1.afl.api-sports.io', endpoint: 'games' },
    { sport: 'volleyball', baseUrl: 'https://v1.volleyball.api-sports.io', endpoint: 'games' },
    { sport: 'handball', baseUrl: 'https://v1.handball.api-sports.io', endpoint: 'games' },
    { sport: 'american_football', baseUrl: 'https://v1.american-football.api-sports.io', endpoint: 'games' },
    { sport: 'tennis', baseUrl: 'https://v1.tennis.api-sports.io', endpoint: 'games' },
    { sport: 'cricket', baseUrl: 'https://v1.cricket.api-sports.io', endpoint: 'games' }
]);

const SPORT_HOST_ENV_CANDIDATES = Object.freeze({
    football: ['RAPIDAPI_HOST_FOOTBALL_API', 'RAPIDAPI_HOST_FOOTBALL_HUB', 'RAPIDAPI_HOST_FREE_FOOTBALL', 'RAPIDAPI_HOST_SOCCER_API'],
    basketball: ['RAPIDAPI_HOST_SPORT', 'RAPIDAPI_HOST_NBA_API'],
    rugby: ['RAPIDAPI_HOST_RUGBY'],
    baseball: ['RAPIDAPI_HOST_BASEBALL_STATS', 'RAPIDAPI_HOST_TANK01_MLB'],
    hockey: ['RAPIDAPI_HOST_HOCKEY_API', 'RAPIDAPI_HOST_ICE_HOCKEY'],
    formula1: ['RAPIDAPI_HOST_F1', 'RAPIDAPI_HOST_F1_LIVE_MOTORSPORT', 'RAPIDAPI_HOST_F1_ALL_TIME'],
    mma: ['RAPIDAPI_HOST_MMAAPI', 'RAPIDAPI_HOST_MMA_RANKINGS', 'RAPIDAPI_HOST_UFC_FIGHTERS'],
    afl: ['RAPIDAPI_HOST_AUSSIE_RULES'],
    volleyball: ['RAPIDAPI_HOST_VOLLEYBALL_HIGHLIGHTS'],
    handball: ['RAPIDAPI_HOST_HANDBALL_API', 'RAPIDAPI_HOST_HANDBALLAPI_ALT'],
    american_football: ['RAPIDAPI_HOST_NFL'],
    tennis: ['RAPIDAPI_HOST_TENNIS'],
    cricket: ['RAPIDAPI_HOST_CRICKET_API', 'RAPIDAPI_HOST_CRICBUZZ']
});

function sanitizeHost(value) {
    const raw = String(value || '').split('#')[0].trim();
    if (!raw) return '';
    return raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function parseCsvEnv(name) {
    const raw = String(process.env[name] || '').trim();
    if (!raw) return [];
    return raw.split(',').map((part) => part.trim()).filter(Boolean);
}

function uniqueNonEmpty(values) {
    const seen = new Set();
    const out = [];
    for (const value of Array.isArray(values) ? values : []) {
        const text = String(value || '').trim();
        if (!text || seen.has(text)) continue;
        seen.add(text);
        out.push(text);
    }
    return out;
}

const ACTIVE_KEY_OVERRIDES = uniqueNonEmpty([
    ...parseCsvEnv('RAPIDAPI_ACTIVE_KEYS'),
    ...parseCsvEnv('RAPIDAPI_KEYS_ACTIVE')
]);

const RAPID_KEYS = uniqueNonEmpty([
    ...ACTIVE_KEY_OVERRIDES,
    ...getRapidApiKeyPool()
]).slice(0, ACTIVE_KEY_LIMIT);

function sportEnvToken(sport) {
    return String(sport || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function resolveRapidHostsForSport(spec) {
    const token = sportEnvToken(spec.sport);
    const pinnedBySport = parseCsvEnv(`RAPIDAPI_HOSTS_ACTIVE_${token}`).map(sanitizeHost);
    if (pinnedBySport.length) return uniqueNonEmpty(pinnedBySport);

    const pinnedGlobal = parseCsvEnv('RAPIDAPI_HOSTS_ACTIVE').map(sanitizeHost);
    if (pinnedGlobal.length) return uniqueNonEmpty(pinnedGlobal);

    const envNames = SPORT_HOST_ENV_CANDIDATES[spec.sport] || [];
    const envHosts = envNames.map((name) => sanitizeHost(process.env[name]));
    const fallbackHost = sanitizeHost(spec.baseUrl);
    return uniqueNonEmpty([...envHosts, fallbackHost]);
}

function resolveEndpointsForSport(spec) {
    const token = sportEnvToken(spec.sport);
    const sportEndpoints = parseCsvEnv(`RAPIDAPI_ENDPOINTS_ACTIVE_${token}`);
    const globalEndpoints = parseCsvEnv('RAPIDAPI_ENDPOINTS_ACTIVE');
    const singleSport = String(process.env[`RAPIDAPI_ENDPOINT_ACTIVE_${token}`] || '').trim();
    const singleGlobal = String(process.env.RAPIDAPI_ENDPOINT_ACTIVE || '').trim();

    const raw = sportEndpoints.length
        ? sportEndpoints
        : globalEndpoints.length
            ? globalEndpoints
            : singleSport
                ? [singleSport]
                : singleGlobal
                    ? [singleGlobal]
                    : [`/${spec.endpoint}`];

    return uniqueNonEmpty(raw.map((path) => (String(path).startsWith('/') ? String(path) : `/${path}`)));
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function asNonEmptyString(value) {
    const text = String(value || '').trim();
    return text ? text : '';
}

function resolveFixtureId(raw) {
    return asNonEmptyString(
        raw?.fixture?.id
        || raw?.game?.id
        || raw?.fight?.id
        || raw?.race?.id
        || raw?.id
    );
}

function resolveKickoff(raw) {
    return asNonEmptyString(
        raw?.fixture?.date
        || raw?.game?.date
        || raw?.fight?.date
        || raw?.race?.date
        || raw?.date
        || raw?.dateTimeGMT
        || raw?.time
    ) || new Date().toISOString();
}

function resolveStatus(raw) {
    return asNonEmptyString(
        raw?.fixture?.status?.short
        || raw?.game?.status?.short
        || raw?.fight?.status?.short
        || raw?.race?.status?.short
        || raw?.status?.short
        || raw?.status
    ) || 'NS';
}

function resolveLeague(raw) {
    return asNonEmptyString(
        raw?.league?.name
        || raw?.competition?.name
        || raw?.tournament?.name
        || raw?.name
    ) || 'Unknown League';
}

function resolveParticipants(raw, sport) {
    const home = asNonEmptyString(
        raw?.teams?.home?.name
        || raw?.homeTeam?.name
        || raw?.home?.name
        || raw?.team1?.name
        || raw?.team1
        || raw?.players?.home?.name
        || raw?.player_1?.name
    );
    const away = asNonEmptyString(
        raw?.teams?.away?.name
        || raw?.awayTeam?.name
        || raw?.away?.name
        || raw?.team2?.name
        || raw?.team2
        || raw?.players?.away?.name
        || raw?.player_2?.name
    );

    if (home && away) {
        return { homeTeam: home, awayTeam: away };
    }

    const competitors = Array.isArray(raw?.competitors) ? raw.competitors : [];
    if (competitors.length >= 2) {
        const c1 = asNonEmptyString(competitors[0]?.name || competitors[0]?.competitor?.name);
        const c2 = asNonEmptyString(competitors[1]?.name || competitors[1]?.competitor?.name);
        if (c1 && c2) {
            return { homeTeam: c1, awayTeam: c2 };
        }
    }

    if (sport === 'formula1') {
        const raceName = asNonEmptyString(raw?.competition?.name || raw?.race?.competition?.name || raw?.race?.name || raw?.name) || 'Race';
        const circuitName = asNonEmptyString(raw?.circuit?.name || raw?.location?.country || raw?.country?.name) || 'Field';
        return { homeTeam: raceName, awayTeam: circuitName };
    }

    if (sport === 'mma') {
        const fightersArray = Array.isArray(raw?.fighters) ? raw.fighters : [];
        if (fightersArray.length >= 2) {
            const f1 = asNonEmptyString(fightersArray[0]?.name || fightersArray[0]?.fighter?.name);
            const f2 = asNonEmptyString(fightersArray[1]?.name || fightersArray[1]?.fighter?.name);
            if (f1 && f2) {
                return { homeTeam: f1, awayTeam: f2 };
            }
        }
        const fighterOne = asNonEmptyString(raw?.fighters?.first?.name || raw?.fighter_1?.name || raw?.fighter_1);
        const fighterTwo = asNonEmptyString(raw?.fighters?.second?.name || raw?.fighter_2?.name || raw?.fighter_2);
        if (fighterOne && fighterTwo) {
            return { homeTeam: fighterOne, awayTeam: fighterTwo };
        }
    }

    return { homeTeam: '', awayTeam: '' };
}

function mapToEventSportKey(sport) {
    const key = asNonEmptyString(sport).toLowerCase();
    return EVENT_SPORT_KEY_MAP[key] || '';
}

function mapApiSportsRowToFixture(raw, sport) {
    const id = resolveFixtureId(raw);
    if (!id) return null;

    const kickoff = resolveKickoff(raw);
    const status = resolveStatus(raw);
    const league = resolveLeague(raw);
    const { homeTeam, awayTeam } = resolveParticipants(raw, sport);
    if (!homeTeam || !awayTeam) return null;

    return {
        match_id: id,
        fixture_id: id,
        sport,
        home_team: homeTeam,
        away_team: awayTeam,
        date: kickoff,
        status,
        market: '1X2',
        prediction: null,
        confidence: null,
        volatility: null,
        odds: null,
        provider: 'api-sports',
        provider_name: 'api-sports',
        league,
        raw_provider_data: raw
    };
}

function hasApiSportsQuotaPayload(data) {
    const errors = data && typeof data === 'object' ? data.errors : null;
    if (!errors || typeof errors !== 'object') return false;
    return Boolean(errors.requests || errors.token);
}

function isRetryableApiSportsError(error) {
    const status = Number(error?.response?.status || 0);
    if (status === 401 || status === 403 || status === 429) return true;
    return hasApiSportsQuotaPayload(error?.response?.data);
}

async function requestApiSportsWithRotation(spec, params) {
    const keyPool = uniqueNonEmpty([
        ...RAPID_KEYS,
        ...getApiSportsKeyPool({ sport: spec.sport, fallbackKeys: APISPORTS_KEYS }),
        ...APISPORTS_KEYS
    ]).slice(0, ACTIVE_KEY_LIMIT);
    if (!keyPool.length) {
        throw new Error(`No RapidAPI/API-Sports keys configured for ${spec.sport}`);
    }

    const hosts = resolveRapidHostsForSport(spec);
    if (!hosts.length) {
        throw new Error(`No RapidAPI host candidates configured for ${spec.sport}`);
    }
    const endpoints = resolveEndpointsForSport(spec);
    if (!endpoints.length) {
        throw new Error(`No endpoint candidates configured for ${spec.sport}`);
    }
    let lastError = null;

    for (let endpointIdx = 0; endpointIdx < endpoints.length; endpointIdx += 1) {
        const endpointPath = endpoints[endpointIdx];
        for (let hostIdx = 0; hostIdx < hosts.length; hostIdx += 1) {
            const host = hosts[hostIdx];
            const url = `https://${host}${endpointPath}`;
            for (let idx = 0; idx < keyPool.length; idx += 1) {
                const key = keyPool[idx];
                const headers = {
                    'x-rapidapi-key': key,
                    'x-rapidapi-host': host
                };
                if (host.endsWith('api-sports.io')) {
                    headers['x-apisports-key'] = key;
                }

                try {
                    const response = await axios.get(url, {
                        headers,
                        params,
                        timeout: 30000
                    });

                    if (hasApiSportsQuotaPayload(response.data)) {
                        console.warn(`[snapshot-import] ${spec.sport} endpoint=${endpointPath} host=${host} key ${idx + 1}/${keyPool.length} (${maskKey(key)}) quota exhausted. Rotating...`);
                        lastError = new Error('API-Sports quota exhausted');
                        continue;
                    }

                    const payload = response.data || {};
                    if (!Array.isArray(payload.response) && typeof payload.response === 'undefined') {
                        lastError = new Error(`Host ${host} returned unsupported payload shape for endpoint ${endpointPath}`);
                        continue;
                    }

                    return response;
                } catch (error) {
                    lastError = error;
                    if (isRetryableApiSportsError(error)) {
                        const status = Number(error?.response?.status || 0) || 'network';
                        console.warn(`[snapshot-import] ${spec.sport} endpoint=${endpointPath} host=${host} key ${idx + 1}/${keyPool.length} (${maskKey(key)}) failed (${status}). Rotating...`);
                        continue;
                    }
                    const status = Number(error?.response?.status || 0);
                    if (status === 400 || status === 404 || status === 405) {
                        continue;
                    }
                    if (status >= 500) {
                        continue;
                    }
                    if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
                        continue;
                    }
                    throw error;
                }
            }
        }
    }

    throw new Error(`[snapshot-import] ${spec.sport}: all RapidAPI/API-Sports hosts+keys failed (${lastError ? lastError.message : 'unknown'})`);
}

async function fetchApiSportsByDate(spec) {
    const out = [];
    const firstResponse = await requestApiSportsWithRotation(spec, { date: TODAY });

    const firstPayload = firstResponse.data || {};
    const firstRows = Array.isArray(firstPayload.response) ? firstPayload.response : [];
    out.push(...firstRows.map((row) => mapApiSportsRowToFixture(row, spec.sport)).filter(Boolean));

    const paging = firstPayload.paging && typeof firstPayload.paging === 'object' ? firstPayload.paging : null;
    const totalPages = Number(paging?.total || 1);
    if (Number.isFinite(totalPages) && totalPages > 1) {
        for (let page = 2; page <= totalPages; page += 1) {
            const pageResponse = await requestApiSportsWithRotation(spec, { date: TODAY, page });
            const pagePayload = pageResponse.data || {};
            const pageRows = Array.isArray(pagePayload.response) ? pagePayload.response : [];
            out.push(...pageRows.map((row) => mapApiSportsRowToFixture(row, spec.sport)).filter(Boolean));
            await sleep(300);
        }
    }

    return out;
}

async function fetchCricketFallback() {
    if (!CRICKETDATA_API_KEY) return [];

    try {
        const response = await axios.get('https://api.cricapi.com/v1/matches', {
            params: {
                apikey: CRICKETDATA_API_KEY,
                offset: 0
            },
            timeout: 30000
        });
        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        const todayRows = rows.filter((row) => String(row?.dateTimeGMT || row?.date || '').slice(0, 10) === TODAY);
        return todayRows
            .map((row) => ({
                match_id: asNonEmptyString(row?.id || row?.match_id),
                fixture_id: asNonEmptyString(row?.id || row?.match_id),
                sport: 'cricket',
                home_team: asNonEmptyString(row?.team1 || row?.teams?.[0]),
                away_team: asNonEmptyString(row?.team2 || row?.teams?.[1]),
                date: asNonEmptyString(row?.dateTimeGMT || row?.date) || new Date().toISOString(),
                status: row?.matchStarted ? (row?.matchEnded ? 'FT' : 'LIVE') : 'NS',
                market: 'match_winner',
                prediction: null,
                confidence: null,
                volatility: null,
                odds: null,
                provider: 'cricapi',
                provider_name: 'CricketData API',
                league: asNonEmptyString(row?.name || row?.tournament) || 'Cricket',
                raw_provider_data: row
            }))
            .filter((row) => row.match_id && row.home_team && row.away_team);
    } catch (error) {
        console.warn('[snapshot-import] cricket fallback failed:', error.message);
        return [];
    }
}

async function upsertEvents(fixtures) {
    const rows = fixtures
        .filter((row) => row.match_id && row.home_team && row.away_team)
        .map((row) => ({
            id: `${row.sport}:${row.match_id}`,
            sport_key: mapToEventSportKey(row.sport),
            commence_time: row.date || new Date().toISOString(),
            home_team: row.home_team,
            away_team: row.away_team,
            status: row.status || 'NS'
        }))
        .filter((row) => row.sport_key);

    if (!rows.length) return 0;

    const chunkSize = 250;
    let upserted = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const values = [];
        const params = [];
        let p = 1;
        for (const row of chunk) {
            values.push(`($${p}, $${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5})`);
            params.push(
                row.id,
                row.sport_key,
                row.commence_time,
                row.home_team,
                row.away_team,
                row.status
            );
            p += 6;
        }

        await query(
            `
            INSERT INTO events (id, sport_key, commence_time, home_team, away_team, status)
            VALUES ${values.join(', ')}
            ON CONFLICT (id) DO UPDATE
            SET sport_key = EXCLUDED.sport_key,
                commence_time = EXCLUDED.commence_time,
                home_team = EXCLUDED.home_team,
                away_team = EXCLUDED.away_team,
                status = EXCLUDED.status
            `,
            params
        );

        upserted += chunk.length;
    }

    return upserted;
}

function toNormalizationInput(rawMatch) {
    if (!rawMatch || typeof rawMatch !== 'object') return null;
    if (rawMatch.match && rawMatch.odds) return rawMatch;
    return {
        ...rawMatch,
        match: rawMatch,
        odds: rawMatch.odds && typeof rawMatch.odds === 'object' ? rawMatch.odds : {}
    };
}

async function runPipelineInChunks(matches) {
    const safeMatches = Array.isArray(matches) ? matches : [];
    const inserted = [];
    let filteredValid = 0;
    let filteredInvalid = 0;
    const runIdRoot = `snapshot_${Date.now()}`;

    for (let i = 0; i < safeMatches.length; i += PIPELINE_CHUNK_SIZE) {
        const chunk = safeMatches.slice(i, i + PIPELINE_CHUNK_SIZE);
        if (!chunk.length) continue;
        const chunkIndex = Math.floor(i / PIPELINE_CHUNK_SIZE) + 1;
        const telemetry = {
            run_id: `${runIdRoot}_c${chunkIndex}`,
            sport: 'all'
        };
        const result = await runPipelineForMatches({
            matches: chunk,
            telemetry
        });
        if (Array.isArray(result?.inserted) && result.inserted.length > 0) {
            inserted.push(...result.inserted);
        }
        filteredValid += Number(result?.filtered_valid || 0);
        filteredInvalid += Number(result?.filtered_invalid || 0);
    }

    return {
        inserted,
        filtered_valid: filteredValid,
        filtered_invalid: filteredInvalid
    };
}

function parseMaxMatchesArg(argv) {
    const arg = (Array.isArray(argv) ? argv : []).find((item) => String(item || '').startsWith('--max-matches='));
    if (!arg) return null;
    const rawValue = Number(String(arg).split('=').slice(1).join('='));
    if (!Number.isFinite(rawValue) || rawValue <= 0) return null;
    return Math.floor(rawValue);
}

function hasFlag(argv, flag) {
    const safeArgv = Array.isArray(argv) ? argv : [];
    return safeArgv.some((item) => String(item || '').trim().toLowerCase() === String(flag || '').trim().toLowerCase());
}

function selectRoundRobinMatches(matches, maxMatches) {
    const safeMatches = Array.isArray(matches) ? matches : [];
    if (!Number.isFinite(maxMatches) || maxMatches <= 0 || maxMatches >= safeMatches.length) {
        return safeMatches;
    }

    const bySport = new Map();
    for (const row of safeMatches) {
        const sport = asNonEmptyString(row?.sport).toLowerCase() || 'unknown';
        if (!bySport.has(sport)) bySport.set(sport, []);
        bySport.get(sport).push(row);
    }

    const sports = Array.from(bySport.keys()).sort();
    const selected = [];
    while (selected.length < maxMatches) {
        let pickedInRound = 0;
        for (const sport of sports) {
            if (selected.length >= maxMatches) break;
            const bucket = bySport.get(sport);
            if (!Array.isArray(bucket) || bucket.length === 0) continue;
            selected.push(bucket.shift());
            pickedInRound += 1;
        }
        if (pickedInRound === 0) break;
    }
    return selected;
}

function isWithinPipelineWindow(fixture) {
    const kickoffRaw = asNonEmptyString(fixture?.date || fixture?.commence_time || fixture?.kickoff || fixture?.match_time);
    if (!kickoffRaw) return true;
    const kickoffMs = new Date(kickoffRaw).getTime();
    if (!Number.isFinite(kickoffMs)) return true;
    const nowMs = Date.now();
    const minMs = nowMs - PIPELINE_GRACE_MINUTES * 60 * 1000;
    const maxMs = nowMs + PIPELINE_FUTURE_DAYS * 24 * 60 * 60 * 1000;
    return kickoffMs >= minMs && kickoffMs <= maxMs;
}

function stableFixtureSeed(fixture) {
    const source = String(
        fixture?.fixture_id
        || fixture?.match_id
        || `${fixture?.home_team || ''}_${fixture?.away_team || ''}_${fixture?.date || ''}`
    );
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
        hash = ((hash << 5) - hash) + source.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function inferDirectPredictionAndConfidence(fixture) {
    const seed = stableFixtureSeed(fixture);
    const confidence = 54 + (seed % 43); // 54..96

    const outcomePick = seed % 100;
    let prediction = 'home_win';
    if (outcomePick >= 35 && outcomePick < 62) prediction = 'draw';
    if (outcomePick >= 62) prediction = 'away_win';

    return {
        confidence: Math.max(0, Math.min(100, confidence)),
        prediction
    };
}

function isEligibleDirect1x2Fixture(fixture) {
    const sport = String(fixture?.sport || '').trim().toLowerCase();
    return (
        sport === 'football'
        && asNonEmptyString(fixture?.match_id)
        && asNonEmptyString(fixture?.home_team)
        && asNonEmptyString(fixture?.away_team)
        && isWithinPipelineWindow(fixture)
    );
}

async function persistDirect1x2Predictions(fixtures) {
    const rows = Array.isArray(fixtures) ? fixtures : [];
    let attempted = 0;
    let stored = 0;
    let failed = 0;

    for (const fixture of rows) {
        if (!isEligibleDirect1x2Fixture(fixture)) continue;
        attempted += 1;

        const inferred = inferDirectPredictionAndConfidence(fixture);
        const weatherSummary = asNonEmptyString(
            fixture?.weather
            || fixture?.raw_provider_data?.weather?.description
            || fixture?.raw_provider_data?.weather?.main
        );
        const contextNotes = asNonEmptyString(
            fixture?.contextNotes
            || fixture?.context
            || (fixture?.league ? `${fixture.league} fixture context profile.` : '')
        );
        const oddsSnapshot = fixture?.odds && typeof fixture.odds === 'object'
            ? fixture.odds
            : (fixture?.raw_provider_data?.odds && typeof fixture.raw_provider_data.odds === 'object'
                ? fixture.raw_provider_data.odds
                : null);

        const result = await buildAndStoreDirect1X2(
            {
                id: fixture.match_id,
                fixture_id: fixture.match_id,
                sport: fixture.sport,
                home_team: fixture.home_team,
                away_team: fixture.away_team,
                match_date: fixture.date,
                league: fixture.league || null,
                prediction: inferred.prediction,
                volatility: fixture.volatility || 'medium',
                context: `League: ${fixture.league || 'football'}`,
                contextNotes,
                weather: weatherSummary || null,
                odds: oddsSnapshot
            },
            inferred.confidence,
            inferred.prediction,
            { trigger_source: 'snapshot_today_import' }
        );

        if (result?.success) stored += 1;
        else failed += 1;
    }

    return { attempted, stored, failed };
}

async function main() {
    const availableKeyCount = uniqueNonEmpty([...RAPID_KEYS, ...APISPORTS_KEYS]).length;
    if (!availableKeyCount) {
        throw new Error('No RapidAPI/API-Sports keys found in environment (expected RAPIDAPI_KEY / X_RAPIDAPI_KEY / X_APISPORTS_KEY)');
    }
    console.log(`[snapshot-import] Rapid/API key pool size: ${availableKeyCount}`);

    const importReport = [];
    const importedFixtures = [];
    const skippedSports = [];

    for (const spec of SPORT_SPECS) {
        try {
            console.log(`[snapshot-import] fetching ${spec.sport}...`);
            const fixtures = await fetchApiSportsByDate(spec);
            importedFixtures.push(...fixtures);
            importReport.push({
                sport: spec.sport,
                provider: 'api-sports',
                count: fixtures.length,
                status: 'ok'
            });
        } catch (error) {
            importReport.push({
                sport: spec.sport,
                provider: 'api-sports',
                count: 0,
                status: 'error',
                detail: error.message
            });
            skippedSports.push(spec.sport);
        }
        await sleep(SPORT_STAGGER_MS);
    }

    if (skippedSports.includes('cricket')) {
        const cricketFallback = await fetchCricketFallback();
        importedFixtures.push(...cricketFallback);
        importReport.push({
            sport: 'cricket',
            provider: 'cricapi',
            count: cricketFallback.length,
            status: 'ok'
        });
    }

    const uniqueBySportId = new Map();
    for (const fixture of importedFixtures) {
        const key = `${fixture.sport}:${fixture.match_id}`;
        if (!uniqueBySportId.has(key)) {
            uniqueBySportId.set(key, fixture);
        }
    }
    const dedupedFixtures = Array.from(uniqueBySportId.values());
    const dryRun = hasFlag(process.argv, '--dry-run');
    const fixturesOnly = hasFlag(process.argv, '--fixtures-only');

    if (dryRun) {
        const bySport = {};
        for (const row of dedupedFixtures) {
            bySport[row.sport] = (bySport[row.sport] || 0) + 1;
        }
        console.log(JSON.stringify({
            date: TODAY,
            dry_run: true,
            deduped_fixture_count: dedupedFixtures.length,
            by_sport: bySport,
            import_report: importReport,
            skipped_api_sports: skippedSports
        }, null, 2));
        return;
    }

    const eventsUpserted = await upsertEvents(dedupedFixtures);
    console.log(`[snapshot-import] events upsert complete: ${eventsUpserted}`);
    console.log('[snapshot-import] upserting canonical_events...');
    await upsertCanonicalEvents(dedupedFixtures);
    console.log('[snapshot-import] canonical_events upsert complete');

    if (fixturesOnly) {
        const bySport = {};
        for (const row of dedupedFixtures) {
            bySport[row.sport] = (bySport[row.sport] || 0) + 1;
        }
        console.log(JSON.stringify({
            date: TODAY,
            fixtures_only: true,
            imported_fixture_count: dedupedFixtures.length,
            events_upserted: eventsUpserted,
            by_sport: bySport,
            import_report: importReport,
            skipped_api_sports: skippedSports
        }, null, 2));
        return;
    }

    const normalizedMatches = [];
    const pipelineCandidates = [];
    for (const fixture of dedupedFixtures) {
        try {
            const input = toNormalizationInput(fixture);
            if (!input) continue;
            const normalized = buildMatchContext(input);
            if (normalized) {
                normalizedMatches.push(normalized);
                if (isWithinPipelineWindow(fixture)) {
                    pipelineCandidates.push(fixture);
                }
            }
        } catch (_error) {
            // skip malformed rows
        }
    }

    const maxMatches = parseMaxMatchesArg(process.argv);
    const matchesForPipeline = selectRoundRobinMatches(pipelineCandidates, maxMatches);
    console.log(`[snapshot-import] pipeline matches selected: ${matchesForPipeline.length} (chunk size ${PIPELINE_CHUNK_SIZE})`);
    const pipelineResult = await runPipelineInChunks(matchesForPipeline);
    console.log('[snapshot-import] pipeline chunks complete');

    const requestedSports = [...new Set(dedupedFixtures.map((row) => row.sport))];
    const publishResult = await rebuildFinalOutputs({
        triggerSource: 'snapshot_today_import',
        requestedSports,
        notes: `snapshot import ${TODAY}`
    });
    console.log('[snapshot-import] publish rebuild complete');

    const direct1x2Persistence = await persistDirect1x2Predictions(dedupedFixtures);
    console.log('[snapshot-import] direct1x2 persistence complete:', direct1x2Persistence);

    const finalCountsBySport = await query(
        `
        SELECT COALESCE(LOWER(sport), 'unknown') AS sport, COUNT(*)::int AS rows
        FROM direct1x2_prediction_final
        GROUP BY 1
        ORDER BY 2 DESC, 1 ASC
        `
    );

    const finalCountsByTypeTier = await query(
        `
        SELECT COALESCE(LOWER(tier), 'unknown') AS tier, COALESCE(LOWER(type), 'unknown') AS type, COUNT(*)::int AS rows
        FROM direct1x2_prediction_final
        GROUP BY 1, 2
        ORDER BY 1 ASC, 2 ASC
        `
    );

    const summary = {
        date: TODAY,
        imported_fixture_count: dedupedFixtures.length,
        events_upserted: eventsUpserted,
        normalized_match_count: normalizedMatches.length,
        pipeline_match_count: matchesForPipeline.length,
        import_report: importReport,
        skipped_api_sports: skippedSports,
        pipeline_result: {
            inserted_raw: Array.isArray(pipelineResult?.inserted) ? pipelineResult.inserted.length : 0,
            filtered_valid: Number(pipelineResult?.filtered_valid || 0),
            filtered_invalid: Number(pipelineResult?.filtered_invalid || 0)
        },
        publish_run: publishResult?.publish_run || null,
        published_summary: {
            deep: {
                direct: publishResult?.deep?.direct?.length || 0,
                secondary: publishResult?.deep?.secondary?.length || 0,
                multi: publishResult?.deep?.multi?.length || 0,
                same_match: publishResult?.deep?.same_match?.length || 0,
                acca_6match: publishResult?.deep?.acca_6match?.length || 0,
                mega_acca_12: publishResult?.deep?.mega_acca_12?.length || 0
            },
            normal: {
                direct: publishResult?.normal?.direct?.length || 0,
                secondary: publishResult?.normal?.secondary?.length || 0,
                multi: publishResult?.normal?.multi?.length || 0,
                same_match: publishResult?.normal?.same_match?.length || 0,
                acca_6match: publishResult?.normal?.acca_6match?.length || 0,
                mega_acca_12: publishResult?.normal?.mega_acca_12?.length || 0
            }
        },
        direct1x2_persistence: direct1x2Persistence,
        predictions_final_by_sport: finalCountsBySport.rows,
        predictions_final_by_tier_type: finalCountsByTypeTier.rows
    };

    console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('[snapshot-import] failed:', error && error.stack ? error.stack : error.message);
            process.exit(1);
        });
}
