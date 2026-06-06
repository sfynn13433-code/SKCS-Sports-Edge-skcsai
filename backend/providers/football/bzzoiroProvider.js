'use strict';

const {
    getLineups,
    getOddsComparison,
    getPolymarket,
    isBzzoiroEnabled
} = require('../../services/bzzoiroApiClient');
const {
    normalizeLineups,
    normalizeOddsComparison,
    normalizePolymarket
} = require('./bzzoiroNormalizer');

const PROVIDER = 'bzzoiro';
const LANE = 'enrichment';

function disabledEnvelope(reason) {
    return {
        ok: false,
        provider: PROVIDER,
        lane: LANE,
        disabled: true,
        reason: reason || 'BSD provider disabled'
    };
}

/**
 * Sandboxed BSD enrichment adapter — governance-approved endpoints only.
 * Does NOT write canonical truth. Does NOT feed prediction engine directly.
 */
async function fetchEnrichmentBundle(eventId) {
    if (!isBzzoiroEnabled()) {
        return disabledEnvelope('ENABLE_BZZOIRO_PROVIDER is not true');
    }

    const id = String(eventId || '').trim();
    if (!id) {
        return disabledEnvelope('eventId is required');
    }

    const [oddsRes, polymarketRes, lineupsRes] = await Promise.all([
        getOddsComparison(id),
        getPolymarket(id),
        getLineups(id)
    ]);

    if (oddsRes.disabled || polymarketRes.disabled || lineupsRes.disabled) {
        return disabledEnvelope(
            oddsRes.reason || polymarketRes.reason || lineupsRes.reason || 'BSD disabled'
        );
    }

    const context = { eventId: id };
    return {
        ok: oddsRes.ok || polymarketRes.ok || lineupsRes.ok,
        provider: PROVIDER,
        lane: LANE,
        provider_event_id: id,
        odds_comparison: oddsRes.ok
            ? normalizeOddsComparison(oddsRes.data, context)
            : { error: oddsRes.reason || `HTTP ${oddsRes.status}` },
        polymarket: polymarketRes.ok
            ? normalizePolymarket(polymarketRes.data, context)
            : { error: polymarketRes.reason || `HTTP ${polymarketRes.status}` },
        lineups: lineupsRes.ok
            ? normalizeLineups(lineupsRes.data, context)
            : { error: lineupsRes.reason || `HTTP ${lineupsRes.status}` }
    };
}

async function fetchOddsComparisonNormalized(eventId) {
    const res = await getOddsComparison(eventId);
    if (!res.ok) return { ok: false, provider: PROVIDER, reason: res.reason, data: null };
    return {
        ok: true,
        provider: PROVIDER,
        lane: LANE,
        data: normalizeOddsComparison(res.data, { eventId })
    };
}

async function fetchPolymarketNormalized(eventId) {
    const res = await getPolymarket(eventId);
    if (!res.ok) return { ok: false, provider: PROVIDER, reason: res.reason, data: null };
    return {
        ok: true,
        provider: PROVIDER,
        lane: LANE,
        data: normalizePolymarket(res.data, { eventId })
    };
}

async function fetchLineupsNormalized(eventId) {
    const res = await getLineups(eventId);
    if (!res.ok) return { ok: false, provider: PROVIDER, reason: res.reason, data: null };
    return {
        ok: true,
        provider: PROVIDER,
        lane: LANE,
        data: normalizeLineups(res.data, { eventId })
    };
}

module.exports = {
    PROVIDER,
    LANE,
    fetchEnrichmentBundle,
    fetchOddsComparisonNormalized,
    fetchPolymarketNormalized,
    fetchLineupsNormalized,
    isBzzoiroEnabled
};
