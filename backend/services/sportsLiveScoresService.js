'use strict';

const axios = require('axios');

const ENDPOINT = 'football/rankings';
const MAX_SAFE_DAILY_LIMIT = 20;
const DEFAULT_DAILY_LIMIT = 12;

const usageState = {
    dayKey: null,
    usedToday: 0
};

const rankingsCache = new Map();
let highLimitWarningLogged = false;

function getDayKey() {
    return new Date().toISOString().slice(0, 10);
}

function ensureUsageWindow() {
    const dayKey = getDayKey();
    if (usageState.dayKey !== dayKey) {
        usageState.dayKey = dayKey;
        usageState.usedToday = 0;
    }
}

function toPositiveInt(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1, Math.floor(n));
}

function normalizeLeagueId(leagueId) {
    if (leagueId === null || leagueId === undefined) return null;
    if (typeof leagueId === 'number' && Number.isFinite(leagueId)) return String(Math.floor(leagueId));
    const value = String(leagueId || '').trim();
    if (!/^\d+$/.test(value)) return null;
    return value;
}

function toIntOrNull(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
}

function toNumberOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function firstNonEmptyString(values) {
    for (const value of values) {
        const text = String(value || '').trim();
        if (text) return text;
    }
    return null;
}

function parseGoalsToken(token) {
    const value = String(token || '').trim();
    const match = value.match(/^(\d{1,3})\s*[:\-]\s*(\d{1,3})$/);
    if (!match) return null;
    const goalsFor = toIntOrNull(match[1]);
    const goalsAgainst = toIntOrNull(match[2]);
    if (!Number.isFinite(goalsFor) || !Number.isFinite(goalsAgainst)) return null;
    return { goals_for: goalsFor, goals_against: goalsAgainst };
}

function parseRankingTextRow(text) {
    const rawText = String(text || '').trim();
    const base = {
        team_id: null,
        team_name: null,
        position: null,
        points: null,
        played: null,
        wins: null,
        draws: null,
        losses: null,
        goals_for: null,
        goals_against: null,
        goal_difference: null,
        form: null,
        parse_quality: 'failed',
        parse_notes: ['unable_to_parse_text_row']
    };
    if (!rawText) return base;

    const compact = rawText
        .replace(/[\t|,]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const fullPattern = /^(\d{1,3})\s+(.+?)\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*[:\-]\s*(\d{1,3})\s+([+\-]?\d{1,3})\s+(\d{1,3})$/;
    const fullMatch = compact.match(fullPattern);
    if (fullMatch) {
        return {
            ...base,
            team_name: fullMatch[2].trim(),
            position: toIntOrNull(fullMatch[1]),
            played: toIntOrNull(fullMatch[3]),
            wins: toIntOrNull(fullMatch[4]),
            draws: toIntOrNull(fullMatch[5]),
            losses: toIntOrNull(fullMatch[6]),
            goals_for: toIntOrNull(fullMatch[7]),
            goals_against: toIntOrNull(fullMatch[8]),
            goal_difference: toIntOrNull(fullMatch[9]),
            points: toIntOrNull(fullMatch[10]),
            parse_quality: 'full',
            parse_notes: ['parsed_from_text_row']
        };
    }

    const tokens = compact.split(' ');
    const posCandidate = toIntOrNull(tokens[0]);
    const goalsIndex = tokens.findIndex((token) => /^\d{1,3}\s*[:\-]\s*\d{1,3}$/.test(token));
    if (goalsIndex > 0 && tokens.length >= 8) {
        const points = toIntOrNull(tokens[tokens.length - 1]);
        const gdMaybe = toIntOrNull(tokens[tokens.length - 2]);
        const g = parseGoalsToken(tokens[goalsIndex]);

        const numericBeforeGoals = [];
        for (let i = goalsIndex - 1; i >= 0; i -= 1) {
            const n = toIntOrNull(tokens[i]);
            if (!Number.isFinite(n)) break;
            numericBeforeGoals.unshift({ index: i, value: n });
        }

        const wdlp = numericBeforeGoals.slice(-4);
        const hasWdlp = wdlp.length === 4;
        const nameStart = Number.isFinite(posCandidate) ? 1 : 0;
        const nameEnd = hasWdlp ? wdlp[0].index : goalsIndex;
        const nameTokens = tokens.slice(nameStart, nameEnd).filter(Boolean);
        const teamName = nameTokens.length ? nameTokens.join(' ').trim() : null;

        if (teamName) {
            return {
                ...base,
                team_name: teamName,
                position: Number.isFinite(posCandidate) ? posCandidate : null,
                played: hasWdlp ? wdlp[0].value : null,
                wins: hasWdlp ? wdlp[1].value : null,
                draws: hasWdlp ? wdlp[2].value : null,
                losses: hasWdlp ? wdlp[3].value : null,
                goals_for: g ? g.goals_for : null,
                goals_against: g ? g.goals_against : null,
                goal_difference: Number.isFinite(gdMaybe) ? gdMaybe : (g ? (g.goals_for - g.goals_against) : null),
                points: Number.isFinite(points) ? points : null,
                parse_quality: hasWdlp && g && Number.isFinite(points) ? 'full' : 'partial',
                parse_notes: hasWdlp && g && Number.isFinite(points)
                    ? ['parsed_from_text_row']
                    : ['text_row_unstructured']
            };
        }
    }

    const partial = compact.replace(/^\d+\s+/, '').replace(/\s+\d[\d\s:+\-]*$/, '').trim();
    if (partial && /[A-Za-z]/.test(partial)) {
        return {
            ...base,
            team_name: partial,
            position: Number.isFinite(posCandidate) ? posCandidate : null,
            parse_quality: 'partial',
            parse_notes: ['text_row_unstructured']
        };
    }

    return base;
}

function getSportsLiveScoresConfig() {
    const host = String(process.env.SPORTS_LIVE_SCORES_RAPIDAPI_HOST || '').trim();
    const baseUrlRaw = String(process.env.SPORTS_LIVE_SCORES_BASE_URL || '').trim();
    const baseUrl = baseUrlRaw.replace(/\/+$/, '');
    const apiKey = String(process.env.SPORTS_LIVE_SCORES_RAPIDAPI_KEY || '').trim();
    const configuredLimit = toPositiveInt(process.env.SPORTS_LIVE_SCORES_DAILY_LIMIT, DEFAULT_DAILY_LIMIT);
    let dailyLimit = configuredLimit;
    if (configuredLimit > MAX_SAFE_DAILY_LIMIT) {
        dailyLimit = DEFAULT_DAILY_LIMIT;
        if (!highLimitWarningLogged) {
            console.log('[SPORTS_LIVE_SCORES] warning: configured daily limit too high for monthly provider limit, clamping to 12');
            highLimitWarningLogged = true;
        }
    }
    const timeoutMs = toPositiveInt(process.env.SPORTS_LIVE_SCORES_TIMEOUT_MS, 8000);
    const enabled = Boolean(apiKey && host && baseUrl);

    return {
        enabled,
        host,
        baseUrl,
        apiKeyPresent: Boolean(apiKey),
        dailyLimit,
        timeoutMs
    };
}

function canUseSportsLiveScores() {
    const config = getSportsLiveScoresConfig();
    if (!config.enabled) return false;
    ensureUsageWindow();
    return usageState.usedToday < config.dailyLimit;
}

function resolveStandingsArray(raw) {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== 'object') return [];

    // Priority order required by integration diagnostics:
    // 1. raw.rankings
    // 2. raw.data
    // 3. raw.data.rankings
    // 4. raw.table
    // 5. raw.standings
    // 6. raw.response
    // 7. raw.results
    const candidates = [
        raw.rankings,
        raw.data,
        raw.data?.rankings,
        raw.table,
        raw.standings,
        raw.response,
        raw.results
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length > 0) return candidate;
        if (candidate && typeof candidate === 'object') {
            const nestedArrays = Object.values(candidate).filter((value) => Array.isArray(value) && value.length > 0);
            if (nestedArrays.length > 0) return nestedArrays[0];
        }
    }

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate;
    }
    return [];
}

function normalizeFootballLeagueRankings(raw, leagueId) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const standings = resolveStandingsArray(raw);

    const providerNoStandings = standings.some((row) => {
        if (!row || typeof row !== 'object') return false;
        const text = String(row.Text || row.text || '').toLowerCase();
        return text.includes('no standings for this league');
    });

    if (providerNoStandings) {
        return {
            provider: 'sports_live_scores',
            endpoint: ENDPOINT,
            league_id: String(leagueId),
            rankings_available: false,
            team_count: 0,
            reason: 'provider_no_standings',
            teams: [],
            raw_compact: {
                top_level_keys: source && typeof source === 'object' ? Object.keys(source).slice(0, 12) : [],
                standings_count: standings.length
            }
        };
    }

    const teams = standings
        .map((row) => {
            const item = row && typeof row === 'object' ? row : {};
            const teamObj = item.team && typeof item.team === 'object' ? item.team : {};
            const goals = item.goals && typeof item.goals === 'object' ? item.goals : {};
            const textRaw = firstNonEmptyString([item.Text, item.text, item.description, item.value]);
            const parsedText = textRaw ? parseRankingTextRow(textRaw) : null;

            const position = toNumberOrNull(
                item.position
                ?? item.rank
                ?? item.pos
                ?? item.standing
                ?? parsedText?.position
            );
            const points = toNumberOrNull(item.points ?? item.pts ?? parsedText?.points);
            const played = toNumberOrNull(item.played ?? item.matches_played ?? item.games ?? item.p ?? parsedText?.played);
            const wins = toNumberOrNull(item.wins ?? item.w ?? item.win ?? parsedText?.wins);
            const draws = toNumberOrNull(item.draws ?? item.d ?? item.draw ?? parsedText?.draws);
            const losses = toNumberOrNull(item.losses ?? item.l ?? item.loss ?? parsedText?.losses);
            const goalsFor = toNumberOrNull(item.goals_for ?? goals.for ?? item.gf ?? parsedText?.goals_for);
            const goalsAgainst = toNumberOrNull(item.goals_against ?? goals.against ?? item.ga ?? parsedText?.goals_against);
            const goalDifference = toNumberOrNull(
                item.goal_difference
                ?? item.gd
                ?? parsedText?.goal_difference
            );

            const teamId = firstNonEmptyString([
                teamObj.id,
                item.team_id,
                item.teamId,
                item.id
            ]);
            const teamName = firstNonEmptyString([
                teamObj.name,
                item.team_name,
                item.teamName,
                item.name,
                parsedText?.team_name
            ]);

            return {
                team_id: teamId,
                team_name: teamName,
                position,
                points,
                played,
                wins,
                draws,
                losses,
                goals_for: goalsFor,
                goals_against: goalsAgainst,
                goal_difference: goalDifference,
                form: firstNonEmptyString([item.form, item.last5, item.recent_form, parsedText?.form]),
                parse_quality: parsedText?.parse_quality || 'structured',
                parse_notes: Array.isArray(parsedText?.parse_notes) ? parsedText.parse_notes : [],
                raw_compact: {
                    id: teamId,
                    name: teamName,
                    position,
                    points,
                    played,
                    TextPreview: textRaw ? String(textRaw).slice(0, 300) : null
                }
            };
        });

    const rankingsAvailable = teams.length > 0;
    return {
        provider: 'sports_live_scores',
        endpoint: ENDPOINT,
        league_id: String(leagueId),
        rankings_available: rankingsAvailable,
        team_count: teams.length,
        teams,
        raw_compact: {
            top_level_keys: source && typeof source === 'object' ? Object.keys(source).slice(0, 12) : [],
            standings_count: standings.length
        }
    };
}

function mapHttpFailureReason(statusCode) {
    if (statusCode === 401) return 'unauthorized';
    if (statusCode === 403) return 'forbidden';
    if (statusCode === 429) return 'rate_limited';
    if (statusCode >= 500) return 'upstream_error';
    return `http_${statusCode}`;
}

function buildRawPreview(raw) {
    const isArray = Array.isArray(raw);
    const isObject = raw && typeof raw === 'object' && !isArray;
    const topLevelKeys = isObject ? Object.keys(raw).slice(0, 12) : [];
    const dataValue = isObject ? raw.data : undefined;
    let dataType = 'undefined';
    if (Array.isArray(dataValue)) dataType = 'array';
    else if (dataValue === null) dataType = 'null';
    else if (dataValue !== undefined) dataType = typeof dataValue;

    const message = firstNonEmptyString([
        isObject ? raw.message : null,
        isObject ? raw.error : null,
        isObject && typeof raw.errors === 'string' ? raw.errors : null,
        isObject && typeof raw.detail === 'string' ? raw.detail : null
    ]);
    const status = firstNonEmptyString([
        isObject ? raw.status : null,
        isObject ? raw.code : null
    ]);
    const rankingsCandidate = isObject ? raw.rankings : null;
    const rankingsType = Array.isArray(rankingsCandidate)
        ? 'array'
        : (rankingsCandidate === null ? 'null' : typeof rankingsCandidate);
    const firstRankingRowKeys = Array.isArray(rankingsCandidate)
        && rankingsCandidate.length > 0
        && rankingsCandidate[0]
        && typeof rankingsCandidate[0] === 'object'
        ? Object.keys(rankingsCandidate[0]).slice(0, 20)
        : [];

    return {
        topLevelKeys,
        responseType: isArray ? 'array' : (isObject ? 'object' : typeof raw),
        dataType,
        rankingsType,
        firstRankingRowKeys,
        message: message || null,
        status: status || null
    };
}

async function fetchFootballLeagueRankingsFallback(leagueId, options = {}) {
    const normalizedLeagueId = normalizeLeagueId(leagueId);
    if (!normalizedLeagueId) {
        console.log('[SPORTS_LIVE_SCORES] skipped: missing_league_id');
        return {
            ok: false,
            skipped: true,
            reason: 'missing_league_id',
            data: null
        };
    }

    const config = getSportsLiveScoresConfig();
    if (!config.enabled) {
        console.log('[SPORTS_LIVE_SCORES] skipped: sports_live_scores_disabled');
        return {
            ok: false,
            skipped: true,
            reason: 'sports_live_scores_disabled',
            data: null
        };
    }

    if (!options.forceRefresh && rankingsCache.has(normalizedLeagueId)) {
        const cached = rankingsCache.get(normalizedLeagueId);
        return {
            ok: true,
            skipped: false,
            reason: null,
            source: 'sports_live_scores',
            endpoint: ENDPOINT,
            leagueId: normalizedLeagueId,
            raw: cached.raw,
            data: cached.data
        };
    }

    ensureUsageWindow();
    if (usageState.usedToday >= config.dailyLimit) {
        console.log('[SPORTS_LIVE_SCORES] skipped: daily_budget_reached');
        return {
            ok: false,
            skipped: true,
            reason: 'daily_budget_reached',
            data: null
        };
    }

    const timeoutMs = toPositiveInt(options.timeoutMs, config.timeoutMs);
    const url = `${config.baseUrl}/${ENDPOINT}/${encodeURIComponent(normalizedLeagueId)}`;
    usageState.usedToday += 1;
    console.log(`[SPORTS_LIVE_SCORES] request: endpoint=${ENDPOINT} leagueId=${normalizedLeagueId}`);

    try {
        const response = await axios.get(url, {
            timeout: timeoutMs,
            validateStatus: () => true,
            headers: {
                'Content-Type': 'application/json',
                'x-rapidapi-host': config.host,
                'x-rapidapi-key': String(process.env.SPORTS_LIVE_SCORES_RAPIDAPI_KEY || '').trim()
            }
        });

        if (!response || typeof response !== 'object') {
            console.log(`[SPORTS_LIVE_SCORES] failed: endpoint=${ENDPOINT} leagueId=${normalizedLeagueId} reason=invalid_response`);
            return {
                ok: false,
                skipped: false,
                reason: 'invalid_response',
                source: 'sports_live_scores',
                endpoint: ENDPOINT,
                leagueId: normalizedLeagueId,
                data: null
            };
        }

        if (response.status < 200 || response.status >= 300) {
            const reason = mapHttpFailureReason(response.status);
            console.log(`[SPORTS_LIVE_SCORES] failed: endpoint=${ENDPOINT} leagueId=${normalizedLeagueId} reason=${reason}`);
            return {
                ok: false,
                skipped: false,
                reason,
                source: 'sports_live_scores',
                endpoint: ENDPOINT,
                leagueId: normalizedLeagueId,
                raw_preview: buildRawPreview(response.data),
                data: null
            };
        }

        const raw = response.data;
        if (!raw || (typeof raw !== 'object' && !Array.isArray(raw))) {
            console.log(`[SPORTS_LIVE_SCORES] failed: endpoint=${ENDPOINT} leagueId=${normalizedLeagueId} reason=invalid_json`);
            return {
                ok: false,
                skipped: false,
                reason: 'invalid_json',
                source: 'sports_live_scores',
                endpoint: ENDPOINT,
                leagueId: normalizedLeagueId,
                raw_preview: buildRawPreview(raw),
                data: null
            };
        }

        const normalized = normalizeFootballLeagueRankings(raw, normalizedLeagueId);
        if (!normalized.rankings_available || normalized.team_count === 0) {
            const reason = normalized?.reason || 'empty_result';
            console.log(`[SPORTS_LIVE_SCORES] failed: endpoint=${ENDPOINT} leagueId=${normalizedLeagueId} reason=${reason}`);
            return {
                ok: false,
                skipped: false,
                reason,
                source: 'sports_live_scores',
                endpoint: ENDPOINT,
                leagueId: normalizedLeagueId,
                raw_preview: buildRawPreview(raw),
                data: null
            };
        }

        rankingsCache.set(normalizedLeagueId, { raw, data: normalized });
        console.log(`[SPORTS_LIVE_SCORES] success: endpoint=${ENDPOINT} leagueId=${normalizedLeagueId}`);
        return {
            ok: true,
            skipped: false,
            reason: null,
            source: 'sports_live_scores',
            endpoint: ENDPOINT,
            leagueId: normalizedLeagueId,
            raw,
            data: normalized
        };
    } catch (error) {
        const code = String(error?.code || '').toUpperCase();
        const reason = code.includes('TIMEOUT') || code === 'ECONNABORTED'
            ? 'timeout'
            : 'request_failed';
        console.log(`[SPORTS_LIVE_SCORES] failed: endpoint=${ENDPOINT} leagueId=${normalizedLeagueId} reason=${reason}`);
        return {
            ok: false,
            skipped: false,
            reason,
            source: 'sports_live_scores',
            endpoint: ENDPOINT,
            leagueId: normalizedLeagueId,
            data: null
        };
    }
}

function getSportsLiveScoresUsageState() {
    ensureUsageWindow();
    const { dailyLimit } = getSportsLiveScoresConfig();
    return {
        usedToday: usageState.usedToday,
        dailyLimit,
        remainingToday: Math.max(0, dailyLimit - usageState.usedToday)
    };
}

function resetSportsLiveScoresUsageForTests() {
    usageState.dayKey = getDayKey();
    usageState.usedToday = 0;
    rankingsCache.clear();
}

module.exports = {
    getSportsLiveScoresConfig,
    canUseSportsLiveScores,
    fetchFootballLeagueRankingsFallback,
    normalizeFootballLeagueRankings,
    parseRankingTextRow,
    getSportsLiveScoresUsageState,
    resetSportsLiveScoresUsageForTests
};
