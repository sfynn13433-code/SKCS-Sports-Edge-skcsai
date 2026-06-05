'use strict';

const governanceGatekeeper = require('./governanceGatekeeper');

function normalizeConstraints(result = {}, context = {}) {
    const base = governanceGatekeeper.getExecutionConstraints();
    const gate = result && typeof result === 'object' ? result : base;
    const constraints = gate.constraints && typeof gate.constraints === 'object'
        ? gate.constraints
        : {
            maxConfidence: Number.isFinite(Number(gate.confidenceCap)) ? Number(gate.confidenceCap) : 100
        };

    return {
        ...gate,
        context,
        constraints,
        reason: gate.reason || base.reason || 'OK'
    };
}

async function getExecutionConstraints(context = {}) {
    const result = governanceGatekeeper.getExecutionConstraints();
    return normalizeConstraints(result, context);
}

module.exports = {
    gatekeeper: { getExecutionConstraints }
};
