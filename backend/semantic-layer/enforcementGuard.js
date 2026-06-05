'use strict';

const { normalizeSemanticEnvelope } = require('./normalizer');
const { logViolation } = require('./violationLogger');

function enforceSemanticAlignment(input, context = {}) {
    const semanticResult = normalizeSemanticEnvelope(input);
    const policy = semanticResult.semantic?.context_policy || {};
    const blockedContexts = Array.isArray(semanticResult.semantic?.blocked_contexts)
        ? semanticResult.semantic.blocked_contexts
        : [];
    const pipeline = String(context.pipeline || context.source || 'semantic-layer').trim() || 'semantic-layer';

    for (const violation of semanticResult.violations) {
        void logViolation({
            pipeline,
            violation_type: violation.violation_type || violation.rule || 'SEMANTIC_VIOLATION',
            severity: violation.severity || 'warning',
            rule_id: violation.rule_id || violation.rule || 'UNKNOWN_RULE',
            field_path: violation.field_path || null,
            raw_value: violation.raw_value ?? null,
            context: {
                source: context.source || 'semantic-layer',
                blocked_contexts: blockedContexts,
                semantic: semanticResult.semantic
            },
            game_id: semanticResult.semantic?.game_id == null
                ? null
                : Number.isFinite(Number(semanticResult.semantic.game_id))
                    ? Number(semanticResult.semantic.game_id)
                    : null,
            message: violation.message || 'Semantic violation detected.',
            resolved: false
        }).catch((error) => {
            console.warn('[semantic-layer] violation log enqueue failed:', error.message);
        });
    }

    return {
        quarantined: semanticResult.quarantined,
        violations: semanticResult.violations,
        normalizedInput: semanticResult.normalized,
        semantic: semanticResult.semantic,
        contextPolicy: {
            allowInjuries: policy.injuries !== false,
            allowH2H: policy.h2h !== false,
            allowWeather: policy.weather === true && !blockedContexts.includes('weather'),
            allowNews: policy.news === true && !blockedContexts.includes('news'),
            blockedContexts
        },
        source: context.source || 'semantic-layer'
    };
}

function sanitizeGradingPayload(payload) {
    const safe = payload && typeof payload === 'object' ? { ...payload } : {};
    const forbiddenKeys = ['status', 'gameStatus', 'state', 'liveStatus', 'period', 'statusText', 'shortStatusText'];
    for (const key of forbiddenKeys) {
        if (key in safe) {
            delete safe[key];
        }
    }
    return safe;
}

module.exports = {
    enforceSemanticAlignment,
    sanitizeGradingPayload
};
