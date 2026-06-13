'use strict';

const {
    clampLimit,
    getMatch,
    getMatchOdds,
    getStandings,
    getStoredMatch,
    isBigBallsDataEnabled,
    listLeagues,
    listMatches,
    listStoredMatches,
    unwrapFieldBundle
} = require('../../services/bigBallsDataApiClient');
const {
    normalizeCompetition,
    normalizeFixture,
    normalizeFixtureDetail,
    normalizeLineupsFromFields,
    normalizeOddsBundle,
    normalizeScoreRow,
    normalizeStandings,
    normalizeStoredFixture
} = require('./bigBallsDataNormalizer');

const PROVIDER = 'big_balls_data';
const LANE = 'evaluation';
const DEFAULT_SPORT = 'football';

function disabledEnvelope(reason) {
    return {
        ok: false,
        provider: PROVIDER,
        lane: LANE,
        disabled: true,
        reason: reason || 'Big Balls Data provider disabled'
    };
}

function asArray(data) {
    return Array.isArray(data) ? data : [];
}

/**
 * Big Balls Data evaluation adapter — read-only normalization layer.
 * NOT connected to prediction pipelines or canonical ingest.
 */
async function competitions(params = {}) {
    if (!isBigBallsDataEnabled()) return disabledEnvelope('ENABLE_BIG_BALLS_DATA_PROVIDER is not true');

    const query = { sport: params.sport || DEFAULT_SPORT, ...params };
    const res = await listLeagues(query);
    if (!res.ok) {
        return { ok: false, provider: PROVIDER, lane: LANE, reason: res.reason || res.error?.message || `HTTP ${res.status}`, items: [] };
    }

    const rows = asArray(res.data).map((row) => normalizeCompetition({ ...row, _meta: res.meta }));
    return { ok: true, provider: PROVIDER, lane: LANE, count: rows.length, items: rows, meta: res.meta, rate: res.rate };
}

async function fixtures(params = {}) {
    if (!isBigBallsDataEnabled()) return disabledEnvelope('ENABLE_BIG_BALLS_DATA_PROVIDER is not true');

    const query = { sport: params.sport || DEFAULT_SPORT, ...params, limit: clampLimit(params.limit) };
    const useStored = params.source !== 'live';

    if (useStored) {
        const stored = await listStoredMatches(query);
        if (stored.ok && asArray(stored.data).length) {
            const rows = asArray(stored.data).map((row) => normalizeStoredFixture(row, {
                sport: query.sport,
                confidence: stored.meta?.confidence,
                source: stored.meta?.source
            }));
            return { ok: true, provider: PROVIDER, lane: LANE, count: rows.length, items: rows, meta: stored.meta, rate: stored.rate, data_lane: 'stored' };
        }
    }

    const res = await listMatches(query);
    if (!res.ok) {
        return { ok: false, provider: PROVIDER, lane: LANE, reason: res.reason || res.error?.message || `HTTP ${res.status}`, items: [] };
    }

    const scoreRows = unwrapFieldBundle(res.data, 'scores') || [];
    const rows = scoreRows.length
        ? scoreRows.map((row) => normalizeScoreRow(row, { sport: query.sport, confidence: res.meta?.confidence, source: res.meta?.source }))
        : asArray(res.data).map((row) => normalizeFixture(row, { sport: query.sport, confidence: res.meta?.confidence, source: res.meta?.source }));

    return { ok: true, provider: PROVIDER, lane: LANE, count: rows.length, items: rows, meta: res.meta, rate: res.rate, data_lane: scoreRows.length ? 'live_scores' : 'live' };
}

async function fixtureDetails(matchId, params = {}) {
    if (!isBigBallsDataEnabled()) return disabledEnvelope('ENABLE_BIG_BALLS_DATA_PROVIDER is not true');

    const id = String(matchId || '').trim();
    if (!id) return disabledEnvelope('matchId is required');

    const query = {
        sport: params.sport || DEFAULT_SPORT,
        fields: params.fields || 'scores,odds,lineups,stats,events',
        ...params
    };

    if (!id.startsWith('bb_match_')) {
        const stored = await getStoredMatch(id, { sport: query.sport });
        if (stored.ok && stored.data) {
            return {
                ok: true,
                provider: PROVIDER,
                lane: LANE,
                item: normalizeStoredFixture(stored.data, { sport: query.sport, confidence: stored.meta?.confidence, source: stored.meta?.source }),
                meta: stored.meta,
                rate: stored.rate,
                data_lane: 'stored'
            };
        }
    }

    const res = await getMatch(id, query);
    if (!res.ok) {
        return { ok: false, provider: PROVIDER, lane: LANE, reason: res.reason || res.error?.message || `HTTP ${res.status}`, item: null };
    }

    const payload = res.data && typeof res.data === 'object' ? res.data : {};
    const item = normalizeFixtureDetail(
        { ...payload, _fields: payload },
        { sport: query.sport, confidence: res.meta?.confidence, source: res.meta?.source }
    );
    return { ok: true, provider: PROVIDER, lane: LANE, item, meta: res.meta, rate: res.rate };
}

async function standings(params = {}) {
    if (!isBigBallsDataEnabled()) return disabledEnvelope('ENABLE_BIG_BALLS_DATA_PROVIDER is not true');

    const query = { sport: params.sport || DEFAULT_SPORT, ...params };
    const res = await getStandings(query);
    if (!res.ok) {
        return { ok: false, provider: PROVIDER, lane: LANE, reason: res.reason || res.error?.message || `HTTP ${res.status}`, data: null };
    }

    return {
        ok: true,
        provider: PROVIDER,
        lane: LANE,
        data: normalizeStandings(res.data || {}, {
            league_id: query.league,
            sport: query.sport,
            season: query.season,
            confidence: res.meta?.confidence,
            source: res.meta?.source
        }),
        meta: res.meta,
        rate: res.rate
    };
}

async function lineups(matchId, params = {}) {
    const detail = await fixtureDetails(matchId, { ...params, fields: 'lineups' });
    if (!detail.ok) return { ok: false, provider: PROVIDER, lane: LANE, reason: detail.reason, data: null };

    return {
        ok: true,
        provider: PROVIDER,
        lane: LANE,
        data: normalizeLineupsFromFields(detail.item?.field_bundle || {}, {
            match_id: matchId,
            confidence: detail.meta?.confidence
        }),
        meta: detail.meta,
        rate: detail.rate
    };
}

async function odds(matchId, params = {}) {
    if (!isBigBallsDataEnabled()) return disabledEnvelope('ENABLE_BIG_BALLS_DATA_PROVIDER is not true');

    const id = String(matchId || '').trim();
    if (!id) return disabledEnvelope('matchId is required');

    const query = { sport: params.sport || DEFAULT_SPORT, ...params };
    const res = await getMatchOdds(id, query);
    if (!res.ok) {
        return { ok: false, provider: PROVIDER, lane: LANE, reason: res.reason || res.error?.message || `HTTP ${res.status}`, data: null };
    }

    const oddsPayload = res.data?.odds ?? res.data;
    const bundles = asArray(oddsPayload).map((row) => normalizeOddsBundle(row, { match_id: id, confidence: res.meta?.confidence }));
    if (!bundles.length && oddsPayload && typeof oddsPayload === 'object' && !Array.isArray(oddsPayload)) {
        bundles.push(normalizeOddsBundle(oddsPayload, { match_id: id, confidence: res.meta?.confidence }));
    }
    return { ok: true, provider: PROVIDER, lane: LANE, data: bundles, meta: res.meta, rate: res.rate };
}

module.exports = {
    PROVIDER,
    LANE,
    competitions,
    fixtures,
    fixtureDetails,
    standings,
    lineups,
    odds,
    isBigBallsDataEnabled
};
