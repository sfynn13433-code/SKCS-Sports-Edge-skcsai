'use strict';

require('dotenv').config();
require('dotenv').config({ path: 'backend/.env' });

const BASE_URL = 'https://cricket-live-line-advance.p.rapidapi.com';
const MAX_CALLS = 8;
const SAMPLE_FALLBACK_MATCH_ID = '87014';

const MATCH_ID_FIELDS = ['id', 'match_id', 'matchId', 'cid', 'mid'];
const TEAM_ID_FIELDS = [
    'team_a_id',
    'team_b_id',
    'home_team_id',
    'away_team_id',
    'localteam_id',
    'visitorteam_id',
    'team1_id',
    'team2_id'
];
const VENUE_ID_FIELDS = ['venue_id', 'venueId', 'ground_id', 'stadium_id'];
const COMPETITION_FIELDS = ['competition', 'tournament', 'series', 'league', 'comp', 'competition_name', 'tournament_name'];
const FORMAT_FIELDS = ['format', 'match_format', 'matchType', 'match_type', 'type'];
const STATUS_FIELDS = ['status', 'match_status', 'state', 'matchState'];

function loadConfig() {
    const primary = String(process.env.RAPIDAPI_CRICKET_LIVE_LINE_ADVANCE_KEY || '').trim();
    const fallback1 = String(process.env.RAPIDAPI_KEY || '').trim();
    const fallback2 = String(process.env.X_RAPIDAPI_KEY || '').trim();

    return {
        host: process.env.RAPIDAPI_HOST_CRICKET_LIVE_LINE_ADVANCE || 'cricket-live-line-advance.p.rapidapi.com',
        apiKey: primary || fallback1 || fallback2
    };
}

function safePreview(value, maxLength = 1200) {
    try {
        const json = JSON.stringify(value, null, 2);
        if (json.length <= maxLength) return json;
        return `${json.slice(0, maxLength)}\n...truncated`;
    } catch (_err) {
        return String(value);
    }
}

function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
}

function isEmptyValue(value) {
    if (value === null || value === undefined) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (isPlainObject(value)) return Object.keys(value).length === 0;
    if (typeof value === 'string') return value.trim() === '';
    return false;
}

function isUsableResponse(status, payload) {
    if (status === 204) return false;
    if (status !== 200) return false;
    if (payload === null || payload === undefined) return false;
    if (isEmptyValue(payload)) return false;

    if (isPlainObject(payload)) {
        if (payload.status === false) {
            if (isEmptyValue(payload.data)) return false;
            if (
                isEmptyValue(payload.result) &&
                isEmptyValue(payload.response) &&
                isEmptyValue(payload.match) &&
                isEmptyValue(payload.matches)
            ) {
                return false;
            }
        }

        const keys = Object.keys(payload);
        if (keys.length === 1 && (keys[0] === 'message' || keys[0] === 'error')) return false;
        if (keys.length === 2 && keys.includes('status') && (keys.includes('message') || keys.includes('error'))) return false;
    }

    return true;
}

function getTopLevelKeys(payload) {
    if (!payload || typeof payload !== 'object') return [];
    return Object.keys(payload);
}

function normalizeScalar(value) {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    return str ? str : null;
}

function findFirstScalarByFields(root, fields) {
    if (!root || typeof root !== 'object') return null;
    const queue = [root];
    const seen = new Set();

    while (queue.length > 0) {
        const node = queue.shift();
        if (!node || typeof node !== 'object') continue;
        if (seen.has(node)) continue;
        seen.add(node);

        for (const field of fields) {
            if (Object.prototype.hasOwnProperty.call(node, field)) {
                const normalized = normalizeScalar(node[field]);
                if (normalized) return normalized;
            }
        }

        if (Array.isArray(node)) {
            for (const item of node) {
                if (item && typeof item === 'object') queue.push(item);
            }
        } else {
            for (const value of Object.values(node)) {
                if (value && typeof value === 'object') queue.push(value);
            }
        }
    }

    return null;
}

function collectScalarsByFields(root, fields) {
    const out = [];
    if (!root || typeof root !== 'object') return out;

    const queue = [root];
    const seen = new Set();

    while (queue.length > 0) {
        const node = queue.shift();
        if (!node || typeof node !== 'object') continue;
        if (seen.has(node)) continue;
        seen.add(node);

        for (const field of fields) {
            if (Object.prototype.hasOwnProperty.call(node, field)) {
                const normalized = normalizeScalar(node[field]);
                if (normalized) out.push(normalized);
            }
        }

        if (Array.isArray(node)) {
            for (const item of node) {
                if (item && typeof item === 'object') queue.push(item);
            }
        } else {
            for (const value of Object.values(node)) {
                if (value && typeof value === 'object') queue.push(value);
            }
        }
    }

    return Array.from(new Set(out));
}

function extractTopMatchItem(payload) {
    if (!payload) return null;
    if (Array.isArray(payload) && payload.length > 0) return payload[0];

    const directArrays = [];
    if (isPlainObject(payload)) {
        for (const value of Object.values(payload)) {
            if (Array.isArray(value) && value.length > 0) directArrays.push(value);
        }
    }
    if (directArrays.length > 0) return directArrays[0][0] || null;

    if (Array.isArray(payload.data) && payload.data.length > 0) {
        return payload.data[0] || null;
    }
    if (isPlainObject(payload.data)) {
        for (const value of Object.values(payload.data)) {
            if (Array.isArray(value) && value.length > 0) return value[0] || null;
        }
    }

    return null;
}

async function makeRequester() {
    try {
        const axios = require('axios');
        return async function request(url, headers) {
            try {
                const response = await axios.get(url, {
                    timeout: 20000,
                    headers
                });
                return {
                    status: response.status,
                    payload: response.data,
                    headers: response.headers || {}
                };
            } catch (error) {
                return {
                    status: error?.response?.status || null,
                    payload: error?.response?.data,
                    headers: error?.response?.headers || {},
                    error: error.message
                };
            }
        };
    } catch (_err) {
        if (typeof fetch !== 'function') {
            throw new Error('Neither axios nor native fetch is available.');
        }
        return async function request(url, headers) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers
                });

                const text = await response.text();
                let payload = null;
                if (text && text.trim() !== '') {
                    try {
                        payload = JSON.parse(text);
                    } catch (_jsonErr) {
                        payload = { raw: text };
                    }
                }

                const responseHeaders = {};
                response.headers.forEach((value, key) => {
                    responseHeaders[key.toLowerCase()] = value;
                });

                return {
                    status: response.status,
                    payload,
                    headers: responseHeaders
                };
            } catch (error) {
                return {
                    status: null,
                    payload: null,
                    headers: {},
                    error: error.message
                };
            }
        };
    }
}

function buildUrl(path, query) {
    const url = new URL(`${BASE_URL}${path}`);
    if (query && typeof query === 'object') {
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value));
            }
        }
    }
    return url.toString();
}

function printCallReport(meta) {
    const {
        callNumber,
        endpoint,
        status,
        remaining,
        reset,
        payload,
        usable,
        skcsUse,
        extracted
    } = meta;

    const topLevelKeys = getTopLevelKeys(payload);

    console.log(`\nCall #${callNumber}`);
    console.log(`Endpoint: ${endpoint}`);
    console.log(`HTTP status: ${status === null ? 'n/a' : status}`);
    console.log(`Rate-limit remaining: ${remaining || 'unknown'}`);
    console.log(`Rate-limit reset: ${reset || 'unknown'}`);
    console.log(`Top-level keys: ${topLevelKeys.length ? topLevelKeys.join(', ') : '(none)'}`);
    console.log(`Usable: ${usable ? 'yes' : 'no'}`);
    console.log(`SKCS use: ${skcsUse}`);
    console.log(
        `Extracted IDs: match=${extracted.matchId || '-'} | teams=${extracted.teamIds.length ? extracted.teamIds.join(', ') : '-'} | venue=${extracted.venueId || '-'}`
    );
    console.log('Safe preview:');
    console.log(safePreview(payload, 1200));
}

function updateExtracted(summary, payload) {
    const foundMatchIds = collectScalarsByFields(payload, MATCH_ID_FIELDS);
    if (!summary.matchId && foundMatchIds.length > 0) {
        summary.matchId = foundMatchIds[0];
    }

    const foundTeamIds = collectScalarsByFields(payload, TEAM_ID_FIELDS);
    if (foundTeamIds.length > 0) {
        summary.teamIds = Array.from(new Set([...summary.teamIds, ...foundTeamIds]));
    }

    const foundVenueId = findFirstScalarByFields(payload, VENUE_ID_FIELDS);
    if (!summary.venueId && foundVenueId) {
        summary.venueId = foundVenueId;
    }

    const comp = findFirstScalarByFields(payload, COMPETITION_FIELDS);
    if (!summary.competition && comp) summary.competition = comp;

    const format = findFirstScalarByFields(payload, FORMAT_FIELDS);
    if (!summary.matchFormat && format) summary.matchFormat = format;

    const status = findFirstScalarByFields(payload, STATUS_FIELDS);
    if (!summary.status && status) summary.status = status;
}

function decideRole(summary) {
    const matches = summary.results.matches === true;
    const info = summary.results.info === true;
    const advance = summary.results.advance === true;
    const statistics = summary.results.statistics === true;
    const squads = summary.results.squads === true;

    if (matches && info && advance && statistics && squads) {
        return 'strong premium cricket enrichment provider';
    }
    if (matches && info && (statistics || squads)) {
        return 'premium top-10 enrichment candidate';
    }
    if (matches && info) {
        return 'fixture fallback only';
    }
    return 'not useful';
}

async function main() {
    const config = loadConfig();
    if (!config.apiKey) {
        console.error(
            'Missing API key. Set RAPIDAPI_CRICKET_LIVE_LINE_ADVANCE_KEY or fallback RAPIDAPI_KEY / X_RAPIDAPI_KEY.'
        );
        process.exit(1);
    }

    const request = await makeRequester();

    const context = {
        callCount: 0,
        stop: false,
        lastRateRemaining: 'unknown'
    };

    const summary = {
        matchId: null,
        matchIdDiscovered: false,
        teamIds: [],
        venueId: null,
        competition: null,
        matchFormat: null,
        status: null,
        results: {
            matches: false,
            info: false,
            advance: false,
            statistics: false,
            squads: false,
            teamTracker1: 'skipped',
            teamTracker2: 'skipped',
            venue: 'skipped'
        }
    };

    console.log('SKCS Cricket Live Line Advance Provider Discovery');
    console.log(`Host: ${config.host}`);
    console.log(`Hard discovery call budget: ${MAX_CALLS}`);

    async function performCall(path, query, skcsUse, onPayload) {
        if (context.stop || context.callCount >= MAX_CALLS) {
            context.stop = true;
            return null;
        }

        context.callCount += 1;
        if (context.callCount >= MAX_CALLS) context.stop = true;

        const url = buildUrl(path, query);
        const headers = {
            'Content-Type': 'application/json',
            'x-rapidapi-host': config.host,
            'x-rapidapi-key': config.apiKey
        };

        const result = await request(url, headers);

        const remaining = result.headers?.['x-ratelimit-requests-remaining'] || result.headers?.['X-Ratelimit-Requests-Remaining'];
        const reset = result.headers?.['x-ratelimit-requests-reset'] || result.headers?.['X-Ratelimit-Requests-Reset'];
        if (remaining) context.lastRateRemaining = remaining;

        const usable = isUsableResponse(result.status, result.payload);
        if (usable) {
            updateExtracted(summary, result.payload);
        }
        if (typeof onPayload === 'function') {
            onPayload(result.payload, usable);
        }

        printCallReport({
            callNumber: context.callCount,
            endpoint: url.replace(`${BASE_URL}`, ''),
            status: result.status,
            remaining,
            reset,
            payload: result.payload,
            usable,
            skcsUse,
            extracted: {
                matchId: summary.matchId,
                teamIds: summary.teamIds,
                venueId: summary.venueId
            }
        });

        if (result.error) {
            console.log(`Request error: ${result.error}`);
        }

        return {
            usable,
            status: result.status,
            payload: result.payload
        };
    }

    await performCall(
        '/matches',
        {
            status: 3,
            per_paged: 50,
            paged: 1,
            highlight_live_matches: 1
        },
        'confirm provider access + detect match list shape + discover IDs',
        (payload, usable) => {
            summary.results.matches = usable;
            if (!summary.matchId && usable) {
                const firstMatchItem = extractTopMatchItem(payload);
                const itemMatchId = firstMatchItem ? findFirstScalarByFields(firstMatchItem, MATCH_ID_FIELDS) : null;
                if (itemMatchId) {
                    summary.matchId = itemMatchId;
                    summary.matchIdDiscovered = true;
                }
                if (firstMatchItem) {
                    const teams = collectScalarsByFields(firstMatchItem, TEAM_ID_FIELDS);
                    if (teams.length > 0) summary.teamIds = Array.from(new Set([...summary.teamIds, ...teams]));
                    const venue = findFirstScalarByFields(firstMatchItem, VENUE_ID_FIELDS);
                    if (!summary.venueId && venue) summary.venueId = venue;
                }
            }
        }
    );

    if (!summary.matchId) {
        summary.matchId = SAMPLE_FALLBACK_MATCH_ID;
        console.log(`\nUsing RapidAPI sample match ID fallback: ${SAMPLE_FALLBACK_MATCH_ID}`);
    }

    const matchId = summary.matchId;
    await performCall(
        `/matches/${encodeURIComponent(matchId)}/info`,
        null,
        'match details, teams, venue, competition, format, date/time, status',
        (_payload, usable) => {
            summary.results.info = usable;
        }
    );

    await performCall(
        `/matches/${encodeURIComponent(matchId)}/advance`,
        null,
        'advanced match context enrichment',
        (_payload, usable) => {
            summary.results.advance = usable;
        }
    );

    await performCall(
        `/matches/${encodeURIComponent(matchId)}/statistics`,
        null,
        'team/match statistics enrichment',
        (_payload, usable) => {
            summary.results.statistics = usable;
        }
    );

    await performCall(
        `/matches/${encodeURIComponent(matchId)}/squads`,
        null,
        'squad and player availability enrichment',
        (_payload, usable) => {
            summary.results.squads = usable;
        }
    );

    const teamId1 = summary.teamIds[0] || null;
    const teamId2 = summary.teamIds[1] || null;

    if (teamId1 && context.callCount < MAX_CALLS) {
        await performCall(
            `/team/${encodeURIComponent(teamId1)}/crickettracker`,
            { format: 1 },
            'team tracker / form signal',
            (_payload, usable) => {
                summary.results.teamTracker1 = usable ? 'yes' : 'no';
            }
        );
    } else {
        summary.results.teamTracker1 = 'skipped';
    }

    if (summary.venueId && context.callCount < MAX_CALLS) {
        await performCall(
            `/venues/${encodeURIComponent(summary.venueId)}`,
            null,
            'venue information enrichment',
            (_payload, usable) => {
                summary.results.venue = usable ? 'yes' : 'no';
            }
        );
    } else {
        summary.results.venue = 'skipped';
    }

    if (teamId2 && context.callCount < MAX_CALLS) {
        await performCall(
            `/team/${encodeURIComponent(teamId2)}/crickettracker`,
            { format: 1 },
            'opponent team tracker / form signal',
            (_payload, usable) => {
                summary.results.teamTracker2 = usable ? 'yes' : 'no';
            }
        );
    } else {
        summary.results.teamTracker2 = 'skipped';
    }

    const teamTrackerSummary =
        summary.results.teamTracker1 === 'skipped' && summary.results.teamTracker2 === 'skipped'
            ? 'skipped'
            : summary.results.teamTracker1 === 'yes' || summary.results.teamTracker2 === 'yes'
              ? 'yes'
              : 'no';

    console.log('\nSKCS Cricket Live Line Advance Provider Summary\n');
    console.log(`Total calls used: ${context.callCount}`);
    console.log(`Rate-limit remaining: ${context.lastRateRemaining}`);
    console.log(`Matches list works: ${summary.results.matches ? 'yes' : 'no'}`);
    console.log(`Match ID discovered: ${summary.matchIdDiscovered ? 'yes' : 'no'}`);
    console.log(`Match info works: ${summary.results.info ? 'yes' : 'no'}`);
    console.log(`Match advance works: ${summary.results.advance ? 'yes' : 'no'}`);
    console.log(`Match statistics works: ${summary.results.statistics ? 'yes' : 'no'}`);
    console.log(`Match squads works: ${summary.results.squads ? 'yes' : 'no'}`);
    console.log(`Team tracker works: ${teamTrackerSummary}`);
    console.log(`Venue info works: ${summary.results.venue}`);
    console.log('');
    console.log('Extracted:');
    console.log(`Match ID: ${summary.matchId || '-'}`);
    console.log(`Team IDs: ${summary.teamIds.length ? summary.teamIds.join(', ') : '-'}`);
    console.log(`Venue ID: ${summary.venueId || '-'}`);
    console.log(`Competition: ${summary.competition || '-'}`);
    console.log(`Match format: ${summary.matchFormat || '-'}`);
    console.log(`Status: ${summary.status || '-'}`);
    console.log('');
    console.log(`Recommended provider role: ${decideRole(summary)}`);

    if (context.callCount >= MAX_CALLS) {
        console.log('\nCall budget exhausted. Stopped at hard limit.');
    }
}

main().catch((error) => {
    console.error('Discovery script failed:', error.message);
    process.exit(1);
});
