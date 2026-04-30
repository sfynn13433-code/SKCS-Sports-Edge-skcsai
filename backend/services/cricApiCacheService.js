'use strict';

const fs = require('fs/promises');
const path = require('path');
const { CricketDataClient } = require('../apiClients');

const CACHE_FILE = path.resolve(__dirname, '..', '..', 'tmp', 'cricket_data.json');
const DEFAULT_TIMEZONE = process.env.CRICKET_TZ || 'Africa/Johannesburg';

function parsePositiveInt(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const rounded = Math.floor(n);
    if (rounded < min) return min;
    if (rounded > max) return max;
    return rounded;
}

function dateKeyInTimezone(timezone = DEFAULT_TIMEZONE) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
}

function toDateKey(value) {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
    }
    return null;
}

function toMatchId(match) {
    const id = match?.id || match?.match_id || match?.matchId || null;
    return id ? String(id).trim() : '';
}

function isLiveMatch(match) {
    if (!match || typeof match !== 'object') return false;
    if (match.matchStarted === true && match.matchEnded !== true) return true;
    const status = String(match.status || match.state || '').toLowerCase();
    return status.includes('live') || status.includes('in progress') || status.includes('innings');
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseSeriesIds(rawValue) {
    return String(rawValue || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

async function ensureCacheDir() {
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
}

async function writeCache(payload) {
    await ensureCacheDir();
    await fs.writeFile(CACHE_FILE, JSON.stringify(payload, null, 2), 'utf8');
}

async function readCache() {
    try {
        const raw = await fs.readFile(CACHE_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
}

async function refreshDailyCache(options = {}) {
    const client = new CricketDataClient();
    const featuredLimit = parsePositiveInt(
        options.featuredLimit ?? process.env.CRICAPI_FEATURED_LIMIT,
        5,
        1,
        20
    );
    const seriesLimit = parsePositiveInt(
        options.seriesLimit ?? process.env.CRICAPI_SERIES_LIMIT,
        0,
        0,
        10
    );
    const detailDelayMs = parsePositiveInt(
        options.detailDelayMs ?? process.env.CRICAPI_DETAIL_DELAY_MS,
        1000,
        0,
        5000
    );
    const dateKey = dateKeyInTimezone(DEFAULT_TIMEZONE);
    const trackedSeriesIds = parseSeriesIds(process.env.CRICAPI_TRACKED_SERIES_IDS);

    const matches = await client.getCurrentMatches(0);
    const todayMatches = matches.filter((match) => {
        const key = toDateKey(match?.date || match?.dateTimeGMT || match?.startDate);
        return key === dateKey;
    });

    const fallbackLive = todayMatches.length === 0
        ? matches.filter((match) => isLiveMatch(match))
        : [];
    const featuredMatches = (todayMatches.length > 0 ? todayMatches : fallbackLive).slice(0, featuredLimit);

    const fullData = [];
    for (const match of featuredMatches) {
        const matchId = toMatchId(match);
        const details = matchId ? await client.getMatchInfo(matchId) : null;
        fullData.push({
            summary: match,
            details: details || {}
        });
        if (detailDelayMs > 0) {
            await sleep(detailDelayMs);
        }
    }

    const discoveredSeriesIds = new Set(trackedSeriesIds);
    for (const item of featuredMatches) {
        const sid = item?.series_id || item?.seriesId || item?.series || null;
        if (sid) discoveredSeriesIds.add(String(sid).trim());
    }

    const limitedSeriesIds = Array.from(discoveredSeriesIds).slice(0, seriesLimit);
    const seriesData = [];
    for (const seriesId of limitedSeriesIds) {
        const pointsTable = await client.getSeriesPointsTable(seriesId);
        const squad = await client.getSeriesSquad(seriesId);
        seriesData.push({
            series_id: seriesId,
            points_table: pointsTable || {},
            squad: squad || {}
        });
        if (detailDelayMs > 0) {
            await sleep(detailDelayMs);
        }
    }

    const callsEstimate = {
        currentMatches: 1,
        matchInfo: fullData.length,
        seriesPointsTable: seriesData.length,
        seriesSquad: seriesData.length
    };
    callsEstimate.total = (
        callsEstimate.currentMatches
        + callsEstimate.matchInfo
        + callsEstimate.seriesPointsTable
        + callsEstimate.seriesSquad
    );

    const payload = {
        source: 'cricapi',
        timezone: DEFAULT_TIMEZONE,
        date_key: dateKey,
        last_updated: new Date().toISOString(),
        last_updated_unix: Math.floor(Date.now() / 1000),
        limits: {
            featured_matches: featuredLimit,
            series: seriesLimit
        },
        calls_estimate: callsEstimate,
        matches: fullData,
        series: seriesData
    };

    await writeCache(payload);
    return {
        cachedMatches: fullData.length,
        cachedSeries: seriesData.length,
        dateKey,
        callsEstimate,
        cacheFile: CACHE_FILE
    };
}

async function refreshLiveScores(options = {}) {
    const client = new CricketDataClient();
    const liveLimit = parsePositiveInt(
        options.liveLimit ?? process.env.CRICAPI_LIVE_MAX_MATCHES,
        6,
        1,
        20
    );
    const detailDelayMs = parsePositiveInt(
        options.detailDelayMs ?? process.env.CRICAPI_DETAIL_DELAY_MS,
        500,
        0,
        5000
    );

    const cache = await readCache();
    if (!cache || !Array.isArray(cache.matches)) {
        const bootstrap = await refreshDailyCache(options);
        return {
            ...bootstrap,
            bootstrapped: true,
            refreshedLive: 0
        };
    }

    const currentMatches = await client.getCurrentMatches(0);
    const liveNow = currentMatches.filter((match) => isLiveMatch(match));
    const liveNowIds = new Set(liveNow.map((item) => toMatchId(item)).filter(Boolean));

    const fromCacheLiveIds = cache.matches
        .map((item) => toMatchId(item?.summary))
        .filter((id) => id && liveNowIds.has(id));
    const idsToRefresh = (fromCacheLiveIds.length > 0
        ? fromCacheLiveIds
        : liveNow.map((item) => toMatchId(item)).filter(Boolean)
    ).slice(0, liveLimit);

    const liveById = new Map(liveNow.map((item) => [toMatchId(item), item]));
    const cachedRowsById = new Map(
        cache.matches
            .map((item, index) => [toMatchId(item?.summary), index])
            .filter(([id]) => Boolean(id))
    );

    let refreshed = 0;
    for (const matchId of idsToRefresh) {
        const details = await client.getMatchInfo(matchId);
        const summary = liveById.get(matchId) || {};
        const row = {
            summary,
            details: details || {}
        };

        if (cachedRowsById.has(matchId)) {
            cache.matches[cachedRowsById.get(matchId)] = row;
        } else {
            cache.matches.push(row);
        }
        refreshed += 1;
        if (detailDelayMs > 0) {
            await sleep(detailDelayMs);
        }
    }

    cache.last_live_update = new Date().toISOString();
    cache.last_live_update_unix = Math.floor(Date.now() / 1000);
    cache.live_matches_seen = liveNow.length;
    cache.live_matches_refreshed = refreshed;

    await writeCache(cache);
    return {
        refreshedLive: refreshed,
        liveMatchesSeen: liveNow.length,
        cacheFile: CACHE_FILE
    };
}

module.exports = {
    CACHE_FILE,
    readCache,
    refreshDailyCache,
    refreshLiveScores
};
