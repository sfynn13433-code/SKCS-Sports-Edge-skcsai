'use strict';

const axios = require('axios');

const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';
const OPEN_WEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';
const NEWS_API_BASE_URL = 'https://newsapi.org/v2/everything';
const NEWSAPI_DEFAULT_DAILY_LIMIT = 95;
const NEWSAPI_MAX_ARTICLES_PER_CALL = 20;
const NEWS_INCIDENT_LIMIT_PER_FIXTURE = 6;
const NEWS_IMPACT_KEYWORDS = Object.freeze({
    injury: ['injury', 'injured', 'hamstring', 'acl', 'ankle', 'knee', 'concussion', 'muscle strain', 'out injured', 'out for'],
    suspension: ['suspension', 'suspended', 'ban', 'banned', 'red card ban', 'disciplinary action'],
    personal_issue: ['personal issue', 'family issue', 'bereavement', 'court', 'legal', 'arrest', 'scandal', 'police', 'off-field'],
    availability: ['doubtful', 'doubt', 'unavailable', 'ruled out', 'misses', 'absence', 'illness', 'sick']
});

const newsUsageState = {
    dayKey: '',
    calls: 0
};
const fixtureNewsCache = new Map();

function getUtcDateKey(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    if (!Number.isFinite(d.getTime())) return new Date().toISOString().slice(0, 10);
    return d.toISOString().slice(0, 10);
}

function getDateFromUtcKey(dayKey) {
    return new Date(`${String(dayKey || '').trim()}T00:00:00.000Z`);
}

function normalizeTextToken(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function uniqueNonEmpty(values = []) {
    const out = [];
    const seen = new Set();
    for (const value of values) {
        const text = String(value || '').trim();
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(text);
    }
    return out;
}

function parseFixtureDateKey(kickoffRaw) {
    const kickoffDate = new Date(kickoffRaw || Date.now());
    if (!Number.isFinite(kickoffDate.getTime())) return getUtcDateKey();
    return getUtcDateKey(kickoffDate);
}

function dayOffset(dayKey, offsetDays) {
    const date = getDateFromUtcKey(dayKey);
    if (!Number.isFinite(date.getTime())) return dayKey;
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return getUtcDateKey(date);
}

function resetNewsUsageForNewDay() {
    const todayKey = getUtcDateKey();
    if (newsUsageState.dayKey !== todayKey) {
        newsUsageState.dayKey = todayKey;
        newsUsageState.calls = 0;
        fixtureNewsCache.clear();
    }
}

function getNewsApiDailyLimit() {
    const n = Number(process.env.NEWSAPI_DAILY_CALL_LIMIT || NEWSAPI_DEFAULT_DAILY_LIMIT);
    if (!Number.isFinite(n)) return NEWSAPI_DEFAULT_DAILY_LIMIT;
    return Math.max(1, Math.min(100, Math.floor(n)));
}

function canConsumeNewsApiCall() {
    resetNewsUsageForNewDay();
    return newsUsageState.calls < getNewsApiDailyLimit();
}

function consumeNewsApiCall() {
    resetNewsUsageForNewDay();
    newsUsageState.calls += 1;
}

function classifyIncidentType(textLower) {
    if (!textLower) return null;
    for (const [type, keywords] of Object.entries(NEWS_IMPACT_KEYWORDS)) {
        if (keywords.some((keyword) => textLower.includes(keyword))) {
            return type;
        }
    }
    return null;
}

function detectTeamSideInArticle(articleTextLower, homeTeam, awayTeam) {
    const homeKey = normalizeTextToken(homeTeam);
    const awayKey = normalizeTextToken(awayTeam);
    const hasHome = homeKey && articleTextLower.includes(homeKey);
    const hasAway = awayKey && articleTextLower.includes(awayKey);
    if (hasHome && !hasAway) return 'home';
    if (hasAway && !hasHome) return 'away';
    if (hasHome && hasAway) return 'both';
    return null;
}

function trimSummary(text, maxLength = 240) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return null;
    if (clean.length <= maxLength) return clean;
    return `${clean.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function normalizeNewsIncidents(articles, options = {}) {
    const safeArticles = Array.isArray(articles) ? articles : [];
    const homeTeam = String(options.homeTeam || '').trim();
    const awayTeam = String(options.awayTeam || '').trim();
    const fixtureDate = String(options.fixtureDate || '').trim() || null;
    const out = [];
    const seen = new Set();

    for (const article of safeArticles) {
        const title = String(article?.title || '').trim();
        const description = String(article?.description || '').trim();
        const content = String(article?.content || '').trim();
        const body = `${title} ${description} ${content}`.trim();
        const bodyLower = normalizeTextToken(body);
        if (!bodyLower) continue;

        const incidentType = classifyIncidentType(bodyLower);
        if (!incidentType) continue;

        const side = detectTeamSideInArticle(bodyLower, homeTeam, awayTeam);
        if (!side) continue;

        let teamName = null;
        if (side === 'home') teamName = homeTeam || null;
        if (side === 'away') teamName = awayTeam || null;
        if (side === 'both') {
            const homeTeamNorm = normalizeTextToken(homeTeam);
            const awayTeamNorm = normalizeTextToken(awayTeam);
            teamName = bodyLower.includes(homeTeamNorm) ? homeTeam : awayTeam || null;
        }

        const dedupeKey = String(article?.url || `${teamName || ''}:${title}`).trim().toLowerCase();
        if (!dedupeKey || seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        out.push({
            side: side === 'both' ? null : side,
            team_name: teamName,
            title: title || null,
            summary: trimSummary(description || content || title),
            incident_type: incidentType,
            source: String(article?.source?.name || 'newsapi').trim() || 'newsapi',
            author: String(article?.author || '').trim() || null,
            url: String(article?.url || '').trim() || null,
            published_at: String(article?.publishedAt || '').trim() || null,
            fixture_date: fixtureDate
        });
    }

    return out.slice(0, NEWS_INCIDENT_LIMIT_PER_FIXTURE);
}

function buildApiSportsHeaders() {
    const apiSportsKey = String(process.env.X_APISPORTS_KEY || '').trim();
    const rapidApiKey = String(
        process.env.X_RAPIDAPI_KEY
        || process.env.RAPIDAPI_KEY
        || ''
    ).trim();

    const headers = {};
    if (apiSportsKey) headers['x-apisports-key'] = apiSportsKey;
    if (rapidApiKey) headers['x-rapidapi-key'] = rapidApiKey;
    return headers;
}

async function getInjuries(fixtureId) {
    const id = String(fixtureId || '').trim();
    if (!id) return null;

    try {
        const res = await axios.get(
            `${API_SPORTS_BASE_URL}/injuries?fixture=${encodeURIComponent(id)}`,
            { headers: buildApiSportsHeaders(), timeout: 10000 }
        );
        return Array.isArray(res?.data?.response) ? res.data.response : null;
    } catch (err) {
        console.error('API ERROR:', err.message);
        return null;
    }
}

async function getH2H(team1, team2) {
    const homeId = String(team1 || '').trim();
    const awayId = String(team2 || '').trim();
    if (!homeId || !awayId) return null;

    try {
        const res = await axios.get(
            `${API_SPORTS_BASE_URL}/fixtures/headtohead?h2h=${encodeURIComponent(`${homeId}-${awayId}`)}`,
            { headers: buildApiSportsHeaders(), timeout: 10000 }
        );
        return Array.isArray(res?.data?.response) ? res.data.response : null;
    } catch (err) {
        console.error('API ERROR:', err.message);
        return null;
    }
}

async function getWeather(city) {
    const cityName = String(city || '').trim();
    const weatherApiKey = String(process.env.WEATHER_API_KEY || '').trim();
    if (!cityName || !weatherApiKey) return null;

    try {
        const res = await axios.get(
            `${OPEN_WEATHER_BASE_URL}?q=${encodeURIComponent(cityName)}&appid=${encodeURIComponent(weatherApiKey)}`,
            { timeout: 10000 }
        );
        return res?.data || null;
    } catch (err) {
        console.error('API ERROR:', err.message);
        return null;
    }
}

async function getTeamNewsContext(options = {}) {
    const newsApiKey = String(process.env.NEWSAPI_KEY || '').trim();
    if (!newsApiKey) return [];

    const homeTeam = String(options.homeTeam || '').trim();
    const awayTeam = String(options.awayTeam || '').trim();
    if (!homeTeam && !awayTeam) return [];

    const fixtureDateKey = parseFixtureDateKey(options.kickoff || options.fixtureDate);
    const fromDateKey = dayOffset(fixtureDateKey, -1);
    const fixtureCacheKey = [
        fixtureDateKey,
        ...uniqueNonEmpty([homeTeam, awayTeam]).map((team) => normalizeTextToken(team)).sort()
    ].join('|');

    if (fixtureNewsCache.has(fixtureCacheKey)) {
        return fixtureNewsCache.get(fixtureCacheKey);
    }

    if (!canConsumeNewsApiCall()) {
        console.warn('[contextIngestion] NewsAPI daily call budget reached. Skipping news context.');
        fixtureNewsCache.set(fixtureCacheKey, []);
        return [];
    }

    const teamTokens = uniqueNonEmpty([homeTeam, awayTeam]).map((team) => `"${team}"`);
    const impactClause = '(injury OR injured OR suspension OR suspended OR doubtful OR unavailable OR illness OR "personal issue" OR legal OR scandal OR arrested OR banned)';
    const q = `(${teamTokens.join(' OR ')}) AND ${impactClause}`;

    try {
        consumeNewsApiCall();
        const response = await axios.get(NEWS_API_BASE_URL, {
            params: {
                apiKey: newsApiKey,
                q,
                from: fromDateKey,
                to: fixtureDateKey,
                language: 'en',
                sortBy: 'publishedAt',
                pageSize: NEWSAPI_MAX_ARTICLES_PER_CALL
            },
            timeout: 10000
        });

        const articles = Array.isArray(response?.data?.articles) ? response.data.articles : [];
        const incidents = normalizeNewsIncidents(articles, {
            homeTeam,
            awayTeam,
            fixtureDate: fixtureDateKey
        });
        fixtureNewsCache.set(fixtureCacheKey, incidents);
        return incidents;
    } catch (err) {
        const status = Number(err?.response?.status);
        if (status === 429) {
            console.warn('[contextIngestion] NewsAPI returned 429 rate limit.');
        } else {
            console.error('NEWS API ERROR:', err.message);
        }
        fixtureNewsCache.set(fixtureCacheKey, []);
        return [];
    }
}

async function safeFetch(fn, label) {
    try {
        const result = await fn();
        return result || {};
    } catch (err) {
        console.error(`${label} FAILED:`, err.message);
        return {};
    }
}

module.exports = {
    safeFetch,
    getInjuries,
    getH2H,
    getWeather,
    getTeamNewsContext
};
