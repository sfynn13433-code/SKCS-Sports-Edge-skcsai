'use strict';

function objectKeys(obj) {
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? Object.keys(obj) : [];
}

function safeJsonPreview(obj, maxChars = 1500) {
    let text;
    try {
        text = JSON.stringify(obj, null, 2);
    } catch (error) {
        text = String(obj);
    }

    if (!text) return '';
    return text.length <= maxChars ? text : `${text.slice(0, maxChars)}...<truncated>`;
}

function sampleKeys(value) {
    if (Array.isArray(value)) {
        const firstObject = value.find((item) => item && typeof item === 'object' && !Array.isArray(item));
        return objectKeys(firstObject);
    }
    return objectKeys(value);
}

function findArraysDeep(obj, maxDepth = 4) {
    const out = [];

    function walk(value, path, depth) {
        if (depth > maxDepth) return;

        if (Array.isArray(value)) {
            out.push({
                path,
                count: value.length,
                sample_keys: sampleKeys(value)
            });
            return;
        }

        if (!value || typeof value !== 'object') return;

        for (const [key, child] of Object.entries(value)) {
            const nextPath = path ? `${path}.${key}` : key;
            walk(child, nextPath, depth + 1);
        }
    }

    walk(obj, 'root', 0);
    return out;
}

function extractLiveFootballApiShape(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const response = source.response && typeof source.response === 'object' && !Array.isArray(source.response)
        ? source.response
        : {};
    const data = source.data && typeof source.data === 'object' && !Array.isArray(source.data)
        ? source.data
        : {};
    const result = source.result && typeof source.result === 'object' && !Array.isArray(source.result)
        ? source.result
        : {};

    const arrayPaths = findArraysDeep(raw, 4);
    const countGuess = arrayPaths.reduce((max, item) => Math.max(max, Number(item?.count) || 0), 0);

    return {
        raw_top_level_keys: objectKeys(source),
        response_keys: objectKeys(response),
        data_keys: objectKeys(data),
        result_keys: objectKeys(result),
        array_paths: arrayPaths,
        count_guess: countGuess,
        safe_preview: safeJsonPreview(raw, 1500)
    };
}

function containsAnyKey(keys, candidates) {
    const normalized = new Set((keys || []).map((key) => String(key || '').toLowerCase()));
    return (candidates || []).some((candidate) => normalized.has(String(candidate || '').toLowerCase()));
}

function collectClassifierKeys(raw, shape) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const merged = new Set([
        ...shape.raw_top_level_keys,
        ...shape.response_keys,
        ...shape.data_keys,
        ...shape.result_keys
    ]);

    for (const pathInfo of shape.array_paths || []) {
        for (const key of pathInfo?.sample_keys || []) {
            merged.add(key);
        }
    }

    if (source.response && typeof source.response === 'object') {
        for (const key of Object.keys(source.response)) merged.add(key);
    }
    if (source.data && typeof source.data === 'object') {
        for (const key of Object.keys(source.data)) merged.add(key);
    }
    if (source.result && typeof source.result === 'object') {
        for (const key of Object.keys(source.result)) merged.add(key);
    }

    return Array.from(merged);
}

function isMeaningfullyEmpty(raw, shape) {
    if (raw === null || raw === undefined || raw === '') return true;
    if (Array.isArray(raw)) return raw.length === 0;
    if (typeof raw !== 'object') return false;
    const keys = Object.keys(raw);
    if (keys.length === 0) return true;

    const hasArrayData = (shape.array_paths || []).some((entry) => Number(entry?.count) > 0);
    if (hasArrayData) return false;

    const values = Object.values(raw);
    const hasSignal = values.some((value) => {
        if (value === null || value === undefined || value === '') return false;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        return true;
    });

    return !hasSignal;
}

function classifyLiveFootballApiPayload(raw, label, status) {
    const httpStatus = Number(status) || null;
    const normalizedLabel = String(label || '').trim().toLowerCase();
    const shape = extractLiveFootballApiShape(raw);

    if (!httpStatus) return 'request_failed';
    if (httpStatus === 401 || httpStatus === 403) return 'auth_or_subscription_issue';
    if (httpStatus === 404 || httpStatus === 400) return 'invalid_endpoint_or_params';
    if (httpStatus === 429 || httpStatus >= 500) return 'provider_error';
    if (httpStatus < 200 || httpStatus >= 300) return 'request_failed';

    const keys = collectClassifierKeys(raw, shape);
    const hasNonEmptyArrays = (shape.array_paths || []).some((entry) => Number(entry?.count) > 0);
    const hasUsefulKeys = keys.length > 0;

    if (!hasNonEmptyArrays && !hasUsefulKeys) {
        return isMeaningfullyEmpty(raw, shape) ? 'empty_success' : 'valid_but_unknown_shape';
    }

    const standingLike = containsAnyKey(keys, ['standing', 'standings', 'rank', 'position', 'points', 'played']);
    const h2hLike = containsAnyKey(keys, ['h2h', 'head_to_head', 'head2head', 'team_id1', 'team_id2', 'vs']);
    const statisticsLike = containsAnyKey(keys, ['statistics', 'stats', 'shots', 'possession', 'fouls']);
    const lineupLike = containsAnyKey(keys, ['lineup', 'lineups', 'formation', 'starting', 'bench', 'substitutes']);
    const eventsLike = containsAnyKey(keys, ['events', 'event', 'minute', 'card', 'goal', 'substitution']);
    const scorersLike = containsAnyKey(keys, ['top_scorers', 'scorers', 'goals', 'player', 'assists']);
    const predictionsLike = containsAnyKey(keys, ['prediction', 'predictions', 'advice', 'winner', 'win_or_draw']);

    if ((normalizedLabel.includes('standing') || normalizedLabel.includes('league')) && standingLike) {
        return 'confirmed_standing_source';
    }
    if ((normalizedLabel.includes('headtohead') || normalizedLabel.includes('head-to-head') || normalizedLabel.includes('h2h')) && h2hLike) {
        return 'confirmed_h2h_source';
    }
    if (normalizedLabel.includes('statistic') && statisticsLike) {
        return 'confirmed_match_statistics_source';
    }
    if ((normalizedLabel.includes('lineup') || normalizedLabel.includes('line-up')) && lineupLike) {
        return 'confirmed_match_lineup_source';
    }
    if (normalizedLabel.includes('event') && eventsLike) {
        return 'confirmed_match_event_source';
    }
    if ((normalizedLabel.includes('topscorer') || normalizedLabel.includes('top scorer')) && scorersLike) {
        return 'confirmed_top_scorers_source';
    }
    if (normalizedLabel.includes('prediction') && predictionsLike) {
        return 'confirmed_prediction_source';
    }

    if (isMeaningfullyEmpty(raw, shape)) return 'empty_success';
    return 'valid_but_unknown_shape';
}

module.exports = {
    extractLiveFootballApiShape,
    findArraysDeep,
    classifyLiveFootballApiPayload
};

