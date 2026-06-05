'use strict';

const observations = [];
const failures = [];
const recommendations = [];
const MAX_ENTRIES = 250;

function pushLimited(target, value) {
    target.push({
        observedAt: new Date().toISOString(),
        ...value
    });

    if (target.length > MAX_ENTRIES) {
        target.splice(0, target.length - MAX_ENTRIES);
    }
}

function observe(event = {}) {
    pushLimited(observations, event);
    console.log('[ERROR_MEMORY]', JSON.stringify(event, null, 2));
}

function observeFailure(event = {}) {
    pushLimited(failures, event);
    console.log('[ERROR_MEMORY_FAILURE]', JSON.stringify(event, null, 2));
    return recommend(event);
}

function recommend(event = {}) {
    const pattern = String(event.pattern || event.error || event.stage || 'unknown').trim();
    const recommendation = {
        ...event,
        pattern,
        advisoryOnly: true,
        recommendedAt: new Date().toISOString()
    };
    pushLimited(recommendations, recommendation);
    console.log('[ERROR_MEMORY_RECOMMENDATION]', JSON.stringify(recommendation, null, 2));
    return recommendation;
}

function getObservations() {
    return observations.slice();
}

function getFailures() {
    return failures.slice();
}

function getRecommendations() {
    return recommendations.slice();
}

module.exports = {
    errorMemory: {
        observe,
        observeFailure,
        getObservations,
        getFailures,
        recommend,
        getRecommendations
    }
};
