'use strict';

const axios = require('axios');

const BASE_URL = 'https://cricket-live-line-advance.p.rapidapi.com';
const MAX_DAILY_CALLS = 90;
const MAX_ENRICH_MATCHES = 10;
let callCount = 0;

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

function safeText(value) {
    return String(value || '').trim();
}

function hasData(obj) {
    if (!obj) return false;
    if (Array.isArray(obj)) return obj.length > 0;
    if (typeof obj === 'object') return Object.keys(obj).length > 0;
    return false;
}

function fallbackIntelligence() {
    return {
        runRate: null,
        volatility: 50,
        confidence: 50,
        pressure: 50,
        momentum: 50,
        accaSafe: false,
        fallback: true
    };
}

function clampTo100(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
}

function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function getSecondInningsState(match) {
    const innings =
        match?.raw?.matchScore?.team2Score?.inngs1 ||
        match?.raw?.matchScore?.team2Score?.inngs ||
        null;

    const runs = toNumber(
        innings?.runs ??
            match?.team2_runs ??
            null,
        0
    );
    const wickets = toNumber(innings?.wickets, 0);
    const overs = toNumber(innings?.overs, 0);

    return { runs, wickets, overs };
}

function getFirstInningsTarget(match) {
    const innings =
        match?.raw?.matchScore?.team1Score?.inngs1 ||
        match?.raw?.matchScore?.team1Score?.inngs ||
        null;
    const runs = toNumber(innings?.runs ?? match?.team1_runs ?? 0, 0);
    return runs;
}

function buildStatsSignals(match) {
    const second = getSecondInningsState(match);
    const runRate = second.overs > 0 ? second.runs / second.overs : null;
    return {
        runRate,
        wickets: second.wickets,
        overs: second.overs
    };
}

function calculatePressure(signals, match) {
    if (!signals) return 50;

    const target = getFirstInningsTarget(match);
    const current = getSecondInningsState(match).runs;
    const overs = toNumber(signals.overs, 0);

    const remainingOvers = Math.max(20 - overs, 0.1);
    const requiredRate = target > 0 ? (target - current) / remainingOvers : 0;

    let pressure = 0;

    if (requiredRate > 10) pressure += 30;
    else if (requiredRate > 8) pressure += 20;

    if (toNumber(signals.wickets, 0) >= 4 && overs < 10) pressure += 25;

    return clampTo100(pressure);
}

function calculateMomentum(signals) {
    if (!signals) return 50;

    let momentum = 50;
    const runRate = toNumber(signals.runRate, 0);
    const wickets = toNumber(signals.wickets, 0);

    if (runRate > 8) momentum += 20;
    if (wickets <= 2) momentum += 15;
    if (wickets >= 5) momentum -= 25;

    return clampTo100(momentum);
}

function isAccaSafe(confidence, volatility, pressure) {
    return confidence >= 70 && volatility <= 40 && pressure <= 50;
}

function enrichedIntelligence(infoData, advanceData, statsData, venueData, match) {
    let confidence = 50;
    let volatility = 50;

    if (hasData(infoData)) confidence += 4;
    if (hasData(advanceData)) confidence += 6;
    if (hasData(statsData)) confidence += 8;
    if (hasData(venueData)) confidence += 2;

    const status = String(infoData?.status_str || infoData?.status || '').toLowerCase();
    if (status.includes('live') || status.includes('in progress')) {
        volatility += 8;
    }

    const statsSignals = buildStatsSignals(match);
    const pressure = calculatePressure(statsSignals, match);
    const momentum = calculateMomentum(statsSignals);

    confidence = clampTo100(confidence);
    volatility = clampTo100(volatility);

    return {
        runRate: statsSignals?.runRate ?? null,
        volatility,
        confidence,
        pressure,
        momentum,
        accaSafe: isAccaSafe(confidence, volatility, pressure),
        fallback: false
    };
}

function getMatchId(match) {
    return safeText(match?.cricket_live_match_id);
}

function findFirstByKeys(root, keys) {
    if (!root || typeof root !== 'object') return null;
    const queue = [root];
    const seen = new Set();

    while (queue.length > 0) {
        const node = queue.shift();
        if (!node || typeof node !== 'object') continue;
        if (seen.has(node)) continue;
        seen.add(node);

        for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(node, key)) {
                const value = safeText(node[key]);
                if (value) return value;
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

async function safeCall(label, path) {
    const headers = getHeaders();
    if (!headers['x-rapidapi-key']) {
        return null;
    }

    if (callCount >= MAX_DAILY_CALLS) {
        console.log('Cricket Live limit reached');
        return null;
    }

    try {
        callCount += 1;
        const res = await axios.get(`${BASE_URL}${path}`, { headers, timeout: 20000 });
        return res.data || null;
    } catch (_err) {
        console.log(`Cricket Live ${label} failed`);
        return null;
    }
}

async function enrichMatch(match) {
    const matchId = getMatchId(match);
    if (!matchId) {
        return {
            ...match,
            cricket_live_enrichment: {
                info: null,
                advance: null,
                statistics: null,
                venue: null,
                enriched: false,
                source: 'cricket_live_line_advance'
            },
            intelligence: fallbackIntelligence()
        };
    }

    const info = await safeCall('info', `/matches/${encodeURIComponent(matchId)}/info`);
    const advance = await safeCall('advance', `/matches/${encodeURIComponent(matchId)}/advance`);
    const stats = await safeCall('statistics', `/matches/${encodeURIComponent(matchId)}/statistics`);

    let venueData = null;
    const venueId =
        findFirstByKeys(info, ['venue_id', 'venueId', 'ground_id', 'stadium_id']) ||
        findFirstByKeys(advance, ['venue_id', 'venueId', 'ground_id', 'stadium_id']);

    if (venueId) {
        venueData = await safeCall('venue', `/venues/${encodeURIComponent(venueId)}`);
    }

    const infoData = info?.response || info?.data || null;
    const advanceData = advance?.response || advance?.data || null;
    const statsData = stats?.response || stats?.data || null;
    const venueFinal = venueData?.response || venueData?.data || null;

    const isEnriched =
        hasData(infoData) ||
        hasData(advanceData) ||
        hasData(statsData) ||
        hasData(venueFinal);

    if (!isEnriched) {
        console.log(`No usable enrichment for match ${matchId}`);
    }

    return {
        ...match,
        cricket_live_enrichment: {
            info: infoData,
            advance: advanceData,
            statistics: statsData,
            venue: venueFinal,
            enriched: isEnriched,
            source: 'cricket_live_line_advance'
        },
        intelligence: isEnriched
            ? enrichedIntelligence(infoData, advanceData, statsData, venueFinal, match)
            : fallbackIntelligence()
    };
}

async function enrichTopCricketMatches(matches = []) {
    console.log('\nCricket Live Enrichment Start');

    if (!Array.isArray(matches) || matches.length === 0) {
        console.log('No matches provided for enrichment');
        return Array.isArray(matches) ? matches : [];
    }

    const topMatches = matches.slice(0, MAX_ENRICH_MATCHES);
    const remainder = matches.slice(MAX_ENRICH_MATCHES);

    console.log(`Enriching ${topMatches.length} matches (max ${MAX_ENRICH_MATCHES})`);

    const enrichedTop = [];
    for (const match of topMatches) {
        const result = await enrichMatch(match);
        enrichedTop.push(result);
    }

    console.log('Enrichment complete');
    const remainderWithFallback = remainder.map((match) => ({
        ...match,
        intelligence: fallbackIntelligence()
    }));
    return [...enrichedTop, ...remainderWithFallback];
}

module.exports = {
    enrichTopCricketMatches
};
