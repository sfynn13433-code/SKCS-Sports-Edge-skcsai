'use strict';

const axios = require('axios');
const config = require('../config');

const BASE_URL = 'https://sports.bzzoiro.com/api/v2';
const APPROVED_PATHS = Object.freeze([
    '/events/{id}/odds/comparison/',
    '/events/{id}/polymarket/',
    '/events/{id}/lineups/'
]);

function isBzzoiroEnabled() {
    return String(process.env.ENABLE_BZZOIRO_PROVIDER || '').trim() === 'true';
}

function getToken() {
    return String(config.bzzoiroApiToken || process.env.BZZOIRO_API_TOKEN || '').trim();
}

function buildPath(template, eventId) {
    return template.replace('{id}', encodeURIComponent(String(eventId)));
}

async function getApprovedEndpoint(pathTemplate, eventId) {
    if (!isBzzoiroEnabled()) {
        return { ok: false, disabled: true, reason: 'ENABLE_BZZOIRO_PROVIDER is not true', data: null };
    }

    const token = getToken();
    if (!token) {
        return { ok: false, disabled: true, reason: 'BZZOIRO_API_TOKEN is missing', data: null };
    }

    const path = buildPath(pathTemplate, eventId);
    if (!APPROVED_PATHS.some((allowed) => buildPath(allowed, eventId) === path)) {
        return { ok: false, disabled: true, reason: 'Endpoint not governance-approved', data: null };
    }

    const url = `${BASE_URL}${path}`;
    try {
        const response = await axios.get(url, {
            headers: { Authorization: `Token ${token}` },
            timeout: 15000,
            validateStatus: () => true
        });

        if (response.status >= 200 && response.status < 300) {
            return { ok: true, disabled: false, status: response.status, data: response.data || {} };
        }

        return {
            ok: false,
            disabled: false,
            status: response.status,
            reason: `BSD HTTP ${response.status}`,
            data: null
        };
    } catch (error) {
        return { ok: false, disabled: false, reason: error.message, data: null };
    }
}

async function getOddsComparison(eventId) {
    return getApprovedEndpoint('/events/{id}/odds/comparison/', eventId);
}

async function getPolymarket(eventId) {
    return getApprovedEndpoint('/events/{id}/polymarket/', eventId);
}

async function getLineups(eventId) {
    return getApprovedEndpoint('/events/{id}/lineups/', eventId);
}

/**
 * Verification-lane only — fixture discovery for crosswalk, not canonical ingest.
 * @see SKCS-KNOWLEDGE/governance/feature_risk_registry.md
 */
async function listLeagues(params = {}) {
    if (!isBzzoiroEnabled()) {
        return { ok: false, disabled: true, reason: 'ENABLE_BZZOIRO_PROVIDER is not true', data: null };
    }

    const token = getToken();
    if (!token) {
        return { ok: false, disabled: true, reason: 'BZZOIRO_API_TOKEN is missing', data: null };
    }

    const url = `${BASE_URL}/leagues/`;
    try {
        const response = await axios.get(url, {
            headers: { Authorization: `Token ${token}` },
            params,
            timeout: 20000,
            validateStatus: () => true
        });

        if (response.status >= 200 && response.status < 300) {
            return { ok: true, disabled: false, status: response.status, data: response.data || {} };
        }
        return { ok: false, disabled: false, status: response.status, reason: `BSD HTTP ${response.status}`, data: null };
    } catch (error) {
        return { ok: false, disabled: false, reason: error.message, data: null };
    }
}

async function listEvents(params = {}) {
    if (!isBzzoiroEnabled()) {
        return { ok: false, disabled: true, reason: 'ENABLE_BZZOIRO_PROVIDER is not true', data: null };
    }

    const token = getToken();
    if (!token) {
        return { ok: false, disabled: true, reason: 'BZZOIRO_API_TOKEN is missing', data: null };
    }

    const url = `${BASE_URL}/events/`;
    try {
        const response = await axios.get(url, {
            headers: { Authorization: `Token ${token}` },
            params,
            timeout: 20000,
            validateStatus: () => true
        });

        if (response.status >= 200 && response.status < 300) {
            return { ok: true, disabled: false, status: response.status, data: response.data || {} };
        }
        return { ok: false, disabled: false, status: response.status, reason: `BSD HTTP ${response.status}`, data: null };
    } catch (error) {
        return { ok: false, disabled: false, reason: error.message, data: null };
    }
}

module.exports = {
    APPROVED_PATHS,
    BASE_URL,
    getLineups,
    getOddsComparison,
    getPolymarket,
    isBzzoiroEnabled,
    listEvents,
    listLeagues
};
