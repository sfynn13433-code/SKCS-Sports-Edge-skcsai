'use strict';

const verificationController = require('../core/verificationController');

const EXECUTION_MODES = Object.freeze({
    STANDARD: 'standard',
    FALLBACK: 'fallback',
    HALT: 'halt'
});

function normalizeState(snapshot = {}) {
    const raw = String(snapshot.controlState || snapshot.state || 'UNKNOWN').trim().toUpperCase();
    switch (raw) {
        case 'PASS':
        case 'HEALTHY':
            return 'PASS';
        case 'WARN':
            return 'WARN';
        case 'DEGRADED':
            return 'DEGRADE';
        case 'FAIL':
        case 'CRITICAL':
        case 'BLOCKED':
            return 'FAIL';
        default:
            return 'UNKNOWN';
    }
}

function translateState(snapshot = {}) {
    const state = normalizeState(snapshot);
    const reasons = Array.isArray(snapshot.reasons) ? snapshot.reasons : [];

    switch (state) {
        case 'FAIL':
            return {
                state,
                proceed: false,
                mode: EXECUTION_MODES.HALT,
                allowEnrichment: false,
                canPublish: false,
                abortExecution: true,
                logWarning: true,
                confidenceCap: 0,
                reason: reasons[0] || 'Control plane blocked execution.'
            };
        case 'DEGRADE':
            return {
                state,
                proceed: true,
                mode: EXECUTION_MODES.FALLBACK,
                allowEnrichment: false,
                canPublish: true,
                abortExecution: false,
                logWarning: true,
                confidenceCap: 0,
                reason: reasons[0] || 'Control plane operating in fallback mode.'
            };
        case 'WARN':
            return {
                state,
                proceed: true,
                mode: EXECUTION_MODES.STANDARD,
                allowEnrichment: true,
                canPublish: true,
                abortExecution: false,
                logWarning: true,
                confidenceCap: null,
                reason: reasons[0] || 'Control plane is operating with warnings.'
            };
        case 'PASS':
            return {
                state,
                proceed: true,
                mode: EXECUTION_MODES.STANDARD,
                allowEnrichment: true,
                canPublish: true,
                abortExecution: false,
                logWarning: false,
                confidenceCap: null,
                reason: reasons[0] || 'Control plane is healthy.'
            };
        default:
            return {
                state,
                proceed: true,
                mode: EXECUTION_MODES.STANDARD,
                allowEnrichment: true,
                canPublish: true,
                abortExecution: false,
                logWarning: true,
                confidenceCap: null,
                reason: reasons[0] || 'Control plane state is unknown.'
            };
    }
}

function getExecutionConstraints() {
    const snapshot = verificationController.getSnapshot();
    return {
        ...translateState(snapshot),
        snapshot
    };
}

module.exports = {
    EXECUTION_MODES,
    getExecutionConstraints,
    normalizeState,
    translateState
};
