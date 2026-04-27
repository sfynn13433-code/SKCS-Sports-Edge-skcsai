'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://cricket-live-line-advance.p.rapidapi.com';
const MATCH_LIST_PATH = '/matches?status=3&per_paged=20&paged=1&highlight_live_matches=1';
const MAX_TOP_MATCHES = 10;
const MIN_MATCH_SCORE = 60;
const CACHE_PATH = path.join(__dirname, '../cache/cricketLiveMatches.json');
const CACHE_TTL_MS = 15 * 60 * 1000;

function getHeaders() {
    const apiKey =
        process.env.RAPIDAPI_CRICKET_LIVE_LINE_ADVANCE_KEY ||
        process.env.RAPIDAPI_KEY ||
        process.env.X_RAPIDAPI_KEY;
    const host =
        process.env.RAPIDAPI_HOST_CRICKET_LIVE_LINE_ADVANCE ||
        process.env.RAPIDAPI_HOST_CRICKET_LIVE ||
        'cricket-live-line-advance.p.rapidapi.com';

    return {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': host,
        'Content-Type': 'application/json'
    };
}

function extractProviderMatchArray(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.response)) return payload.response;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.matches)) return payload.matches;
    if (Array.isArray(payload.response?.items)) return payload.response.items;
    if (Array.isArray(payload.data?.items)) return payload.data.items;

    if (typeof payload === 'object') {
        for (const value of Object.values(payload)) {
            if (Array.isArray(value) && value.length > 0) return value;
            if (value && typeof value === 'object') {
                for (const inner of Object.values(value)) {
                    if (Array.isArray(inner) && inner.length > 0) return inner;
                }
            }
        }
    }

    return [];
}

function readCacheRaw() {
    try {
        if (!fs.existsSync(CACHE_PATH)) return null;
        const raw = fs.readFileSync(CACHE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        if (!Array.isArray(parsed.data)) return null;
        return parsed;
    } catch (_err) {
        return null;
    }
}

function loadFreshCache() {
    const parsed = readCacheRaw();
    if (!parsed) return null;
    const timestamp = Number(parsed.timestamp || 0);
    if (!timestamp) return null;
    if (Date.now() - timestamp < CACHE_TTL_MS) {
        console.log('Using cached Cricket Live matches');
        return parsed.data;
    }
    return null;
}

function loadStaleCache() {
    const parsed = readCacheRaw();
    return parsed ? parsed.data : null;
}

function saveCache(data) {
    try {
        fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
        fs.writeFileSync(
            CACHE_PATH,
            JSON.stringify(
                {
                    timestamp: Date.now(),
                    data: Array.isArray(data) ? data : []
                },
                null,
                2
            )
        );
    } catch (_err) {
        // Ignore cache write failures; resolver should continue without cache.
    }
}

function norm(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z]/g, '');
}

function getMatchId(providerMatch) {
    if (!providerMatch || typeof providerMatch !== 'object') return null;
    const candidate =
        providerMatch.match_id ||
        providerMatch.matchId ||
        providerMatch.id ||
        providerMatch.mid ||
        providerMatch.cid;
    return candidate === undefined || candidate === null ? null : String(candidate).trim() || null;
}

function getProviderTeamTokens(providerMatch) {
    if (!providerMatch || typeof providerMatch !== 'object') return [];

    const raw = [
        providerMatch.team_a,
        providerMatch.team_b,
        providerMatch.teamA,
        providerMatch.teamB,
        providerMatch.team1,
        providerMatch.team2,
        providerMatch.home_team,
        providerMatch.away_team,
        providerMatch.localteam,
        providerMatch.visitorteam,
        providerMatch.teama,
        providerMatch.teamb,
        providerMatch.home,
        providerMatch.away,
        providerMatch.title,
        providerMatch.match_title
    ];

    const out = [];
    for (const value of raw) {
        if (!value) continue;
        if (typeof value === 'string') {
            const normalized = norm(value);
            if (normalized) out.push(normalized);
            const parts = String(value)
                .split(/vs|v|-/i)
                .map((p) => norm(p))
                .filter(Boolean);
            out.push(...parts);
            continue;
        }
        if (typeof value === 'object') {
            const names = [value.name, value.teamName, value.team_name, value.short_name, value.shortName, value.abbr];
            for (const name of names) {
                if (name) out.push(norm(name));
            }
        }
    }

    return Array.from(new Set(out.filter(Boolean)));
}

function getProviderTitle(providerMatch) {
    return String(providerMatch?.title || providerMatch?.match_title || providerMatch?.short_title || '').trim();
}

function getCricbuzzTeamTokens(match) {
    const out = [
        match?.team1,
        match?.team2,
        match?.raw?.matchInfo?.team1?.teamName,
        match?.raw?.matchInfo?.team2?.teamName,
        match?.raw?.matchInfo?.team1?.teamSName,
        match?.raw?.matchInfo?.team2?.teamSName
    ]
        .map((v) => norm(v))
        .filter(Boolean);

    return Array.from(new Set(out));
}

function getCanonicalFormat(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
        if (value === 1) return 'odi';
        if (value === 2) return 'test';
        if (value === 3) return 't20';
    }

    const text = String(value || '').toLowerCase();
    if (!text) return '';
    if (text === '1') return 'odi';
    if (text === '2') return 'test';
    if (text === '3') return 't20';
    if (text.includes('test')) return 'test';
    if (text.includes('odi')) return 'odi';
    if (text.includes('t20')) return 't20';
    return '';
}

function parseProviderDate(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const isoGuess = text.includes('T') ? text : text.replace(' ', 'T') + 'Z';
    const parsed = new Date(isoGuess);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}

function timeDiffMinutes(t1, t2) {
    if (!t1 || !t2) return 9999;
    const d1 = new Date(t1);
    const d2 = parseProviderDate(t2);
    if (Number.isNaN(d1.getTime()) || !d2) return 9999;
    return Math.abs(d1.getTime() - d2.getTime()) / 60000;
}

function scoreMatch(cbMatch, pvMatch) {
    let score = 0;

    const cbTeam1 = norm(cbMatch?.team1 || cbMatch?.raw?.matchInfo?.team1?.teamName || '');
    const cbTeam2 = norm(cbMatch?.team2 || cbMatch?.raw?.matchInfo?.team2?.teamName || '');
    const pvTeamText = norm(getProviderTitle(pvMatch));

    // Team match weight: high
    if (cbTeam1 && pvTeamText.includes(cbTeam1)) score += 20;
    if (cbTeam2 && pvTeamText.includes(cbTeam2)) score += 20;

    const cbTokens = getCricbuzzTeamTokens(cbMatch);
    const pvTokens = getProviderTeamTokens(pvMatch);
    for (const cbToken of cbTokens) {
        for (const pvToken of pvTokens) {
            if (!cbToken || !pvToken) continue;
            if (cbToken === pvToken) score += 8;
            else if (cbToken.includes(pvToken) || pvToken.includes(cbToken)) score += 4;
        }
    }

    // Start-time proximity: very high
    const diff = timeDiffMinutes(cbMatch?.start_time, pvMatch?.date_start);
    if (diff < 60) score += 40;
    else if (diff < 180) score += 25;
    else if (diff < 720) score += 10;

    // Format match: high
    const cbFormat = getCanonicalFormat(cbMatch?.match_format);
    const pvFormat = getCanonicalFormat(pvMatch?.format_str || pvMatch?.format);
    if (cbFormat && pvFormat && cbFormat === pvFormat) score += 25;

    // Competition hint: medium
    const cbComp = norm(cbMatch?.league || cbMatch?.raw?.matchInfo?.seriesName || '');
    const pvComp = norm(pvMatch?.competition?.title || pvMatch?.competition?.abbr || '');
    if (cbComp && pvComp && (cbComp.includes(pvComp) || pvComp.includes(cbComp))) {
        score += 10;
    }

    return score;
}

function findBestMatch(cbMatch, providerMatches) {
    if (!Array.isArray(providerMatches) || providerMatches.length === 0) {
        return { match: null, score: 0 };
    }

    let best = null;
    let bestScore = 0;

    for (const providerMatch of providerMatches) {
        const providerId = getMatchId(providerMatch);
        if (!providerId) continue;
        const score = scoreMatch(cbMatch, providerMatch);

        if (score > bestScore) {
            bestScore = score;
            best = providerMatch;
        }
    }

    if (!best || bestScore < MIN_MATCH_SCORE) {
        return { match: null, score: bestScore };
    }
    return { match: best, score: bestScore };
}

async function fetchProviderMatches() {
    const cached = loadFreshCache();
    if (cached) return cached;

    const headers = getHeaders();
    if (!headers['x-rapidapi-key']) {
        const stale = loadStaleCache();
        return stale || [];
    }

    console.log('Fetching Cricket Live matches from API');

    try {
        const res = await axios.get(`${BASE_URL}${MATCH_LIST_PATH}`, {
            headers,
            timeout: 20000
        });

        const items = extractProviderMatchArray(res.data);
        if (items.length > 0) {
            saveCache(items);
        }
        return items;
    } catch (_err) {
        console.log('Cricket Live match list fetch failed');
        const stale = loadStaleCache();
        if (stale) {
            console.log('Using stale cached Cricket Live matches');
            return stale;
        }
        return [];
    }
}

async function resolveMatchIds(cricbuzzMatches = []) {
    if (!Array.isArray(cricbuzzMatches) || cricbuzzMatches.length === 0) return [];

    const providerMatches = await fetchProviderMatches();
    if (!providerMatches.length) {
        console.log('No provider matches available (API + cache empty)');
        return cricbuzzMatches.map((match) => ({
            ...match,
            cricket_live_match_id: null,
            cricket_live_score: 0
        }));
    }

    const top = cricbuzzMatches.slice(0, MAX_TOP_MATCHES);
    const rest = cricbuzzMatches.slice(MAX_TOP_MATCHES);

    const resolvedTop = top.map((match) => {
        const { match: best, score } = findBestMatch(match, providerMatches);
        const providerId = best ? getMatchId(best) : null;
        return {
            ...match,
            cricket_live_match_id: providerId,
            cricket_live_score: providerId ? score : 0
        };
    });

    return [
        ...resolvedTop,
        ...rest.map((match) => ({
            ...match,
            cricket_live_match_id: null,
            cricket_live_score: 0
        }))
    ];
}

module.exports = {
    resolveMatchIds
};
