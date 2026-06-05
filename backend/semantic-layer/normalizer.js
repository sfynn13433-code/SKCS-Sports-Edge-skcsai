'use strict';

const {
    CANONICAL_ID_FIELDS,
    STATUS_FIELDS,
    CONTEXT_POLICY,
    normalizeStatus,
    normalizePeriodState
} = require('./registry');

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getPath(source, path) {
    if (!source || !path) return undefined;
    const parts = Array.isArray(path) ? path : String(path).split('.');
    let current = source;
    for (const part of parts) {
        if (!current || typeof current !== 'object') return undefined;
        if (!(part in current)) return undefined;
        current = current[part];
    }
    return current;
}

function pickFirst(source, paths) {
    for (const path of paths) {
        const value = getPath(source, path);
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return null;
}

function resolveGameId(source) {
    return pickFirst(source, [
        ...CANONICAL_ID_FIELDS,
        'match_info.match_id',
        'match_info.game_id',
        'metadata.game_id',
        'metadata.match_id',
        'match.id',
        'match.game_id',
        'match.match_id',
        'match.fixture_id',
        'game.id',
        'fixture.id'
    ]);
}

function detectForbiddenContext(source) {
    const blocked = [];
    const context = isObject(source.contextual_intelligence) ? source.contextual_intelligence : {};
    const metadataContext = isObject(source.metadata?.contextual_intelligence)
        ? source.metadata.contextual_intelligence
        : {};
    const hasValue = (value) => value !== undefined && value !== null && value !== '';

    const weather = pickFirst(source, [
        'contextual_intelligence.weather',
        'metadata.contextual_intelligence.weather',
        'weather'
    ]);
    const news = pickFirst(source, [
        'contextual_intelligence.public_incidents',
        'metadata.contextual_intelligence.public_incidents',
        'news',
        'news_mentions'
    ]);

    if (hasValue(weather) || hasValue(context.weather) || hasValue(metadataContext.weather)) {
        blocked.push({
            rule_id: 'NO_EXTERNAL_WEATHER_CONTEXT',
            violation_type: 'FORBIDDEN_CONTEXT',
            field_path: 'contextual_intelligence.weather',
            raw_value: weather ?? context.weather ?? metadataContext.weather ?? null,
            severity: 'blocked',
            message: 'Weather context is not permitted unless explicitly whitelisted.'
        });
    }
    if (hasValue(news) || Array.isArray(context.public_incidents) || Array.isArray(metadataContext.public_incidents)) {
        blocked.push({
            rule_id: 'NO_EXTERNAL_NEWS_CONTEXT',
            violation_type: 'FORBIDDEN_CONTEXT',
            field_path: 'contextual_intelligence.public_incidents',
            raw_value: news ?? context.public_incidents ?? metadataContext.public_incidents ?? null,
            severity: 'blocked',
            message: 'News context is not permitted unless explicitly whitelisted.'
        });
    }

    return blocked;
}

function normalizeSemanticEnvelope(input) {
    const source = isObject(input) ? input : {};
    const gameId = resolveGameId(source);
    const statusRaw = pickFirst(source, [...STATUS_FIELDS, 'match_info.status', 'metadata.status']);
    const statusNormalized = normalizeStatus(statusRaw);
    const periodState = normalizePeriodState(statusRaw);
    const blockedContexts = detectForbiddenContext(source);

    const semantic = {
        game_id: gameId,
        status_raw: statusRaw || null,
        status_normalized: statusNormalized,
        period_state: periodState,
        blocked_contexts: blockedContexts.map((item) => item.field_path || item.rule_id || 'unknown'),
        context_policy: { ...CONTEXT_POLICY }
    };

    const violations = [];
    if (!gameId) {
        violations.push({
            rule: 'CANONICAL_ID_REQUIRED',
            rule_id: 'IDENTITY_REQUIRED',
            violation_type: 'MISSING_CANONICAL_ID',
            field_path: 'match_id',
            raw_value: source.match_id || source.id || source.gameId || null,
            severity: 'critical',
            message: 'GameId could not be resolved from provider payload.'
        });
    }
    if (statusRaw && statusNormalized === 'Unknown') {
        violations.push({
            rule: 'UNMAPPED_STATUS',
            rule_id: 'STATUS_NORMALIZATION_REQUIRED',
            violation_type: 'UNMAPPED_STATUS',
            field_path: 'status',
            raw_value: statusRaw,
            severity: 'warning',
            message: `Status "${String(statusRaw)}" is not mapped to a canonical SKCS status.`
        });
    }
    if (blockedContexts.length > 0) {
        for (const blocked of blockedContexts) {
            violations.push({
                rule: 'FORBIDDEN_CONTEXT_SOURCE',
                rule_id: blocked.rule_id || 'FORBIDDEN_CONTEXT',
                violation_type: blocked.violation_type || 'FORBIDDEN_CONTEXT',
                field_path: blocked.field_path || 'contextual_intelligence',
                raw_value: blocked.raw_value ?? null,
                severity: blocked.severity || 'blocked',
                message: blocked.message || 'Unsupported context fields were present.'
            });
        }
    }

    const normalized = {
        ...source,
        match_id: String(gameId || source.match_id || source.id || '').trim(),
        status: statusNormalized,
        match_status_normalized: statusNormalized,
        period_state: periodState,
        semantic
    };

    if (normalized.metadata && typeof normalized.metadata === 'object') {
        normalized.metadata = {
            ...normalized.metadata,
            semantic
        };
    } else {
        normalized.metadata = { semantic };
    }

    return {
        normalized,
        semantic,
        violations,
        quarantined: !gameId
    };
}

module.exports = {
    detectForbiddenContext,
    normalizeSemanticEnvelope,
    resolveGameId
};
