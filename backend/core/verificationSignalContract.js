'use strict';

const SIGNAL_TYPES = Object.freeze({
    pipeline: 'pipeline',
    enrichment: 'enrichment',
    quota: 'quota',
    api: 'api',
    db: 'db'
});

const SIGNAL_STATUS = Object.freeze({
    PASS: 'PASS',
    WARN: 'WARN',
    FAIL: 'FAIL'
});

const FAILURE_TYPES = Object.freeze({
    STRUCTURAL_FAIL: 'STRUCTURAL_FAIL',
    DATA_FAIL: 'DATA_FAIL',
    QUOTA_WARN: 'QUOTA_WARN',
    QUOTA_FAIL: 'QUOTA_FAIL',
    HEALTH_WARN: 'HEALTH_WARN',
    HEALTH_FAIL: 'HEALTH_FAIL',
    UNKNOWN: 'UNKNOWN'
});

function normalizeEnum(value, allowedValues, fallback) {
    const candidate = String(value || '').trim().toUpperCase();
    return allowedValues.includes(candidate) ? candidate : fallback;
}

function createVerificationSignal(input = {}) {
    const source = String(input.source || input.type || 'unknown').trim();
    const type = String(input.type || input.source || SIGNAL_TYPES.api).trim().toLowerCase();
    const status = normalizeEnum(input.status, Object.keys(SIGNAL_STATUS), SIGNAL_STATUS.PASS);
    const failureType = normalizeEnum(input.failureType, Object.keys(FAILURE_TYPES), FAILURE_TYPES.UNKNOWN);
    const severity = normalizeEnum(
        input.severity,
        ['UNKNOWN', 'HEALTHY', 'WARN', 'DEGRADED', 'CRITICAL', 'BLOCKED'],
        'UNKNOWN'
    );

    return {
        source,
        type: Object.values(SIGNAL_TYPES).includes(type) ? type : SIGNAL_TYPES.api,
        status,
        failureType,
        severity,
        reason: String(input.reason || input.message || '').trim(),
        metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
        timestamp: input.timestamp || new Date().toISOString()
    };
}

function isVerificationSignal(input) {
    return !!input && typeof input === 'object' && typeof input.source === 'string';
}

module.exports = {
    SIGNAL_TYPES,
    SIGNAL_STATUS,
    FAILURE_TYPES,
    createVerificationSignal,
    isVerificationSignal,
    normalizeEnum
};
